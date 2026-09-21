import Activity from '../models/Activity.js';
import ActivityPoi from '../models/ActivityPoi.js';
import Expense from '../models/Expense.js';
import BudgetCategory from '../models/BudgetCategory.js';
import Poi from '../models/Poi.js';
import PoiCategory from '../models/PoiCategory.js';
import Trip from '../models/Trip.js';
import { dbBatch } from '../db/database.js';
import { sanitizeHttpUrl } from './url.js';
import { lookupPhotoNear } from './photoLookup.js';

/**
 * Create/edit operations shared by the REST endpoints and the MCP write tools
 * (HU-12.3). This is the ONE place that validates and applies them — the MCP
 * tools must not reimplement any of it, so a rule added here (conflict
 * handling, category checks, defaults) reaches both the web app and Claude/
 * ChatGPT at once.
 *
 * Every function resolves to `{ ok: true, ... }` or
 * `{ ok: false, status, error, ...extra }`; the callers map that to an HTTP
 * response or an MCP tool result. Messages are the same ones the REST API has
 * always returned.
 */

const fail = (status, error, extra = {}) => ({ ok: false, status, error, ...extra });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── Activities ──────────────────────────────────────────────────

/**
 * Creates an activity. A real schedule conflict is resolved by cascading later
 * activities forward (Activity.resolveScheduleShift, Ajuste 4) unless that would
 * move an "inamovible" one, in which case nothing is written.
 *
 * `poiId` (MCP only) also associates an existing POI, in the same transaction.
 *
 * @returns {Promise<{ok:true,row:object,shifts:object[]}|{ok:false,status:number,error:string,warning?:boolean,conflict?:object}>}
 */
export async function createActivity(body, { poiId = null } = {}) {
  const { day_id, title, description, start_time, duration_minutes, location_name, latitude, longitude, tentative, is_fixed } = body;

  if (!day_id || !title) return fail(400, 'day_id and title are required');

  const url = 'url' in body ? sanitizeHttpUrl(body.url) : undefined;
  if (body.url && !url) return fail(400, 'El enlace debe empezar con http:// o https://');

  // Tentative plans don't need to be conflict-free.
  let shifts = [];
  if (!tentative && start_time && duration_minutes) {
    const resolved = await Activity.resolveScheduleShift(day_id, { startTime: start_time, durationMinutes: duration_minutes });
    if (resolved.blocked) {
      return fail(400, 'Time conflict: activity overlaps with existing activities', { warning: true, conflict: resolved });
    }
    shifts = resolved.shifts;
  }

  const row = Activity.rowFor(
    { day_id, title, description, start_time, duration_minutes, location_name, latitude, longitude, url, tentative, is_fixed },
    await Activity.nextSortOrder(day_id)
  );
  await dbBatch([
    Activity.insertStmt(row),
    ...(poiId ? [ActivityPoi.insertStmt(row.id, poiId, 1)] : []),
    ...shifts.map((s) => Activity.updateStmt(s.id, { start_time: s.start_time })),
  ]);

  return { ok: true, row, shifts };
}

/** Edits an activity. Same conflict handling as createActivity (the activity itself is excluded). */
export async function updateActivity(id, input) {
  const activity = await Activity.findById(id);
  if (!activity) return fail(404, 'Activity not found');

  const body = { ...input };
  if ('tentative' in body) body.tentative = body.tentative ? 1 : 0;
  if ('is_fixed' in body) body.is_fixed = body.is_fixed ? 1 : 0;
  const isTentative = 'tentative' in body ? body.tentative : activity.tentative;

  if ('url' in body) {
    const clean = sanitizeHttpUrl(body.url);
    if (body.url && !clean) return fail(400, 'El enlace debe empezar con http:// o https://');
    body.url = clean;
  }

  let shifts = [];
  if (!isTentative && body.start_time && body.duration_minutes) {
    const resolved = await Activity.resolveScheduleShift(activity.day_id, {
      startTime: body.start_time,
      durationMinutes: body.duration_minutes,
      excludeId: activity.id,
    });
    if (resolved.blocked) {
      return fail(400, 'Time conflict: activity overlaps with existing activities', { warning: true, conflict: resolved });
    }
    shifts = resolved.shifts;
  }

  await dbBatch([
    Activity.updateStmt(id, body),
    ...shifts.map((s) => Activity.updateStmt(s.id, { start_time: s.start_time })),
  ]);
  const updated = await Activity.findById(id);
  if (!updated) return fail(500, 'Failed to update activity');

  return { ok: true, updated, shifts };
}

// ── Expenses ────────────────────────────────────────────────────

export async function validateExpensePayload(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (!partial || 'amount' in body) {
    const amount = Number(body.amount);
    if (Number.isNaN(amount) || amount <= 0) errors.push('amount debe ser un número mayor a 0');
    else out.amount = amount;
  }
  if (!partial || 'expense_date' in body) {
    if (!DATE_RE.test(body.expense_date || '')) errors.push('expense_date debe tener formato YYYY-MM-DD');
    else out.expense_date = body.expense_date;
  }
  if (!partial || 'category_id' in body) {
    if (!body.category_id) errors.push('category_id es obligatorio');
    else out.category_id = body.category_id;
  }
  if ('description' in body) out.description = body.description?.trim() || null;
  if ('payment_method_id' in body) out.payment_method_id = body.payment_method_id || null;
  if ('activity_id' in body) out.activity_id = body.activity_id || null;
  if ('currency_code' in body && body.currency_code) out.currency_code = body.currency_code;
  if ('is_paid' in body) out.is_paid = body.is_paid ? 1 : 0;

  return { errors, out };
}

/** Records an expense (is_paid defaults to true in Expense.create). */
export async function createExpense(body) {
  const { trip_id } = body;
  if (!trip_id) return fail(400, 'trip_id es obligatorio');

  const trip = await Trip.findById(trip_id);
  if (!trip) return fail(404, 'Trip not found');

  const { errors, out } = await validateExpensePayload(body);
  if (errors.length) return fail(400, errors.join('. '));

  const category = await BudgetCategory.findById(out.category_id);
  if (!category || category.trip_id !== trip_id) return fail(400, 'La categoría no pertenece a este viaje');

  const expense = await Expense.create({
    trip_id,
    ...out,
    currency_code: out.currency_code || trip.currency_code || 'USD',
  });
  return { ok: true, expense };
}

// ── POIs ────────────────────────────────────────────────────────

/**
 * Validate the POI payload. The web frontend geocodes the address (Nominatim)
 * and sends resolved coordinates + address; the MCP tool geocodes server-side
 * (lib/geocode.js) and then goes through this same validation.
 */
export async function validatePoiPayload(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (!partial || 'name' in body) {
    const name = (body.name ?? '').toString().trim();
    if (!name) errors.push('Falta el nombre');
    else out.name = name;
  }

  if (!partial || 'category_id' in body) {
    const categoryId = (body.category_id ?? '').toString().trim();
    if (!categoryId) {
      errors.push('Falta la categoría');
    } else {
      const category = await PoiCategory.findById(categoryId);
      if (!category) errors.push('La categoría no es válida');
      else out.category_id = categoryId;
    }
  }

  // lat/lng travel together — if either is present, both must be valid.
  const hasLat = 'latitude' in body || 'longitude' in body;
  if (!partial || hasLat) {
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      errors.push('La latitud no es válida');
    } else if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      errors.push('La longitud no es válida');
    } else {
      out.latitude = lat;
      out.longitude = lng;
    }
  }

  for (const key of ['address', 'city', 'notes', 'description']) {
    if (key in body) out[key] = (body[key] ?? '').toString().trim() || null;
  }
  if ('url' in body) {
    const raw = (body.url ?? '').toString().trim();
    if (raw && !sanitizeHttpUrl(raw)) errors.push('El enlace debe empezar con http:// o https://');
    else out.url = sanitizeHttpUrl(raw);
  }

  if ('estimated_duration_minutes' in body) {
    const raw = body.estimated_duration_minutes;
    if (raw === '' || raw == null) {
      out.estimated_duration_minutes = null;
    } else {
      const minutes = Number(raw);
      if (!Number.isInteger(minutes) || minutes <= 0) {
        errors.push('La duración estimada debe ser un número entero de minutos mayor a 0');
      } else {
        out.estimated_duration_minutes = minutes;
      }
    }
  }

  return { errors, out };
}

/** Creates a POI in a trip, then a best-effort photo (never blocks the create). */
export async function createPoi(tripId, body) {
  const trip = await Trip.findById(tripId);
  if (!trip) return fail(404, 'Trip not found');

  const { errors, out } = await validatePoiPayload(body);
  if (!('latitude' in out)) errors.push('Falta la ubicación');
  if (errors.length) return fail(400, errors.join('. '));

  let poi = await Poi.create({ trip_id: trip.id, ...out });

  const photo = await lookupPhotoNear(poi.latitude, poi.longitude);
  if (photo) poi = (await Poi.setPhoto(poi.id, photo)) || poi;

  return { ok: true, poi };
}
