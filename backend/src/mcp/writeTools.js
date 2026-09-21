import { z } from 'zod';
import Activity, { parseHM, minutesToHM } from '../models/Activity.js';
import BudgetCategory from '../models/BudgetCategory.js';
import Day from '../models/Day.js';
import Poi from '../models/Poi.js';
import PoiCategory from '../models/PoiCategory.js';
import Trip from '../models/Trip.js';
import { createActivity, updateActivity, createExpense, createPoi } from '../lib/mutations.js';
import { geocodeAddress } from '../lib/geocode.js';
import { sanitizeHttpUrl } from '../lib/url.js';
import { MCP_WRITE_SCOPE } from './scopes.js';

// Épica 12 / HU-12.3 — create/edit tools. The first time a language model can
// write to the app from free text, so the design is deliberately narrow:
//
//  - ONE entity per call: no batch/"load my whole day" tool. (create_activity
//    may also link an existing POI, and cascade-shift later activities exactly
//    like the web does — both reported back in the result.)
//  - ZERO deletes: nothing here (or anywhere in the MCP server) removes data.
//  - NO logic of their own: validation, conflict handling and defaults live in
//    lib/mutations.js, shared with the REST endpoints. These handlers only
//    translate the model's arguments (names instead of internal ids, an end
//    time instead of a duration) and the result back into text.
//  - Registered only for tokens with the mcp:write scope, and each handler
//    re-checks that scope before running.
//
// Access model: as everywhere in this app there is no per-trip owner — every
// allowlisted user sees and edits every trip (already enforced by the bearer
// middleware). What IS checked here is that the ids the model passes belong
// together (the day is in that trip, the POI is in that trip, ...), since a
// model can mix ids up.

const CREATE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const EDIT = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = (message) => ({ isError: true, content: [{ type: 'text', text: message }] });
const failJson = (data) => ({ isError: true, content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });

const normalize = (s) =>
  (s ?? '').toString().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

const HM = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM (24 h)');
const tripId = z.string().min(1).describe('ID del viaje (se obtiene con list_trips)');

/** Audit trail in the server logs: who wrote what, through which tool. No payloads. */
function audit(tool, extra, entity, id) {
  console.log(`MCP write | ${tool} | ${extra?.authInfo?.extra?.email ?? 'unknown'} | ${entity}=${id}`);
}

/**
 * Wraps a write tool body: re-checks the mcp:write scope (the tools aren't even
 * registered without it — this is the second lock), and turns unexpected errors
 * into a generic message so internal details never reach the model.
 */
function writeTool(name, handler) {
  return async (args, extra) => {
    if (!extra?.authInfo?.scopes?.includes(MCP_WRITE_SCOPE)) {
      return fail('Esta conexión es de solo lectura. Para crear o editar hay que reconectarla y permitir "crear y editar" en la pantalla de autorización.');
    }
    try {
      return await handler(args, (entity, id) => audit(name, extra, entity, id));
    } catch (error) {
      console.error('MCP write tool error:', error);
      return fail('Error interno al guardar. No se aplicó ningún cambio confirmado; consultá el estado antes de reintentar.');
    }
  };
}

const activityView = (a, { poi = null } = {}) => {
  const start = parseHM(a.start_time);
  return {
    id: a.id,
    day_id: a.day_id,
    title: a.title,
    description: a.description,
    start_time: a.start_time,
    end_time: start != null && a.duration_minutes ? minutesToHM(start + a.duration_minutes) : null,
    duration_minutes: a.duration_minutes,
    location_name: a.location_name,
    url: a.url,
    tentative: !!a.tentative,
    fixed_time: !!a.is_fixed,
    ...(poi && { poi })
  };
};

const adjustedView = (shifts) =>
  shifts.map((s) => ({ id: s.id, title: s.title, previous_start_time: s.previous_start_time, new_start_time: s.start_time }));

/** Explains a refused schedule change in a structured way, so the model can tell the person why. */
function conflictResult(result) {
  const { reason, blocker } = result.conflict ?? {};
  const why =
    reason === 'would_move_fixed_activity'
      ? `Para acomodar el horario habría que mover "${blocker?.title}" (${blocker?.start_time}–${blocker?.end_time}), que es una actividad inamovible.`
      : `El horario se superpone con "${blocker?.title}" (${blocker?.start_time}–${blocker?.end_time}), que empieza antes; no se mueve nada hacia atrás automáticamente.`;
  return failJson({
    error: 'schedule_conflict',
    applied: false,
    message: `${why} No se aplicó ningún cambio. Ofrecele a la persona otro horario o que cambie/quite la marca de inamovible desde la app; no inventes una solución.`,
    reason,
    blocked_by: blocker
  });
}

/** Turns end_time / duration_minutes into a duration; only one of them may be given. */
function resolveDuration({ start, end_time, duration_minutes }) {
  if (end_time && duration_minutes) return { error: 'Indicá end_time o duration_minutes, no ambos.' };
  if (end_time) {
    if (start == null) return { error: 'Para usar end_time hace falta start_time.' };
    const end = parseHM(end_time);
    if (end <= start) return { error: 'end_time tiene que ser posterior a start_time (las actividades no cruzan la medianoche).' };
    return { duration: end - start };
  }
  return { duration: duration_minutes ?? null };
}

/**
 * Finds a category by name, ignoring case and accents. Exact by default; with
 * `partial` a single unambiguous partial match is also accepted (used for a
 * trip's free-form budget categories, never for the fixed POI categories).
 */
function matchByName(items, wanted, { partial: allowPartial = false } = {}) {
  const w = normalize(wanted);
  const exact = items.filter((c) => normalize(c.name) === w);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1 || !allowPartial) return null;
  const partial = items.filter((c) => normalize(c.name).includes(w) || w.includes(normalize(c.name)));
  return partial.length === 1 ? partial[0] : null;
}

/** Today's date (YYYY-MM-DD) in the trip's timezone; UTC if the timezone is missing/invalid. */
function todayIn(timezone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'UTC' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function registerWriteTools(server) {
  server.registerTool(
    'create_activity',
    {
      title: 'Crear actividad',
      description:
        'Crea UNA actividad en un día de un viaje. Necesita el day_id (se obtiene con get_day_itinerary). Indicá el horario con start_time y end_time (o duration_minutes). ' +
        'Si el horario se superpone con actividades posteriores, se las corre automáticamente hacia adelante (igual que en la web) y la respuesta lo informa en adjusted_activities: contáselo a la persona. ' +
        'Si el choque no se puede resolver (implicaría mover una actividad inamovible, o se superpone con una que empieza antes) no se aplica nada y devuelve el error schedule_conflict: explicáselo sin inventar soluciones. ' +
        'poi_id (opcional) vincula un lugar ya guardado del viaje (list_pois). No borra ni modifica nada más.',
      inputSchema: {
        trip_id: tripId,
        day_id: z.string().min(1).describe('ID del día donde va la actividad (get_day_itinerary → day.id)'),
        title: z.string().min(1).max(200).describe('Nombre de la actividad'),
        start_time: HM.optional().describe('Hora de inicio HH:MM'),
        end_time: HM.optional().describe('Hora de fin HH:MM (alternativa a duration_minutes)'),
        duration_minutes: z.number().int().min(1).max(1440).optional().describe('Duración en minutos (alternativa a end_time)'),
        description: z.string().max(2000).optional(),
        location_name: z.string().max(200).optional(),
        url: z.string().max(2000).optional().describe('Enlace http(s)'),
        tentative: z.boolean().optional().describe('Plan tentativo: no genera ni sufre conflictos de horario'),
        is_fixed: z.boolean().optional().describe('Inamovible: nunca se mueve automáticamente. Default false'),
        poi_id: z.string().optional().describe('ID de un lugar guardado del mismo viaje para vincular')
      },
      annotations: CREATE
    },
    writeTool('create_activity', async (args, log) => {
      const trip = await Trip.findById(args.trip_id);
      if (!trip) return fail(`No existe un viaje con id "${args.trip_id}". Usá list_trips para ver los disponibles.`);

      const day = await Day.findById(args.day_id);
      if (!day || day.trip_id !== trip.id) {
        return fail(`El día "${args.day_id}" no pertenece al viaje "${trip.name}". Obtené el day_id con get_day_itinerary.`);
      }

      let poi = null;
      if (args.poi_id) {
        const found = await Poi.findById(args.poi_id);
        if (!found || found.trip_id !== trip.id) {
          return fail(`El lugar "${args.poi_id}" no existe en el viaje "${trip.name}". Usá list_pois para ver los disponibles.`);
        }
        poi = { id: found.id, name: found.name };
      }

      const { duration, error } = resolveDuration({
        start: parseHM(args.start_time),
        end_time: args.end_time,
        duration_minutes: args.duration_minutes
      });
      if (error) return fail(error);

      const result = await createActivity(
        {
          day_id: day.id,
          title: args.title,
          description: args.description,
          start_time: args.start_time,
          duration_minutes: duration,
          location_name: args.location_name,
          url: args.url,
          tentative: args.tentative,
          is_fixed: args.is_fixed
        },
        { poiId: poi?.id }
      );

      if (!result.ok) return result.conflict ? conflictResult(result) : fail(result.error);

      log('activity', result.row.id);
      return ok({
        created: activityView(result.row, { poi }),
        adjusted_activities: adjustedView(result.shifts),
        note: result.shifts.length
          ? `Se ajustaron los horarios de ${result.shifts.length} actividad(es) posteriores para evitar superposición.`
          : undefined
      });
    })
  );

  server.registerTool(
    'update_activity',
    {
      title: 'Editar actividad',
      description:
        'Edita UNA actividad existente; solo cambian los campos que indiques (activity_id sale de get_day_itinerary). Con el horario aplica la misma resolución de conflictos que create_activity ' +
        '(informa adjusted_activities, o devuelve schedule_conflict sin aplicar nada). No borra ni mueve la actividad a otro día.',
      inputSchema: {
        activity_id: z.string().min(1).describe('ID de la actividad (get_day_itinerary)'),
        title: z.string().min(1).max(200).optional(),
        start_time: HM.optional().describe('Nueva hora de inicio HH:MM (conserva la duración si no indicás end_time/duration_minutes)'),
        end_time: HM.optional().describe('Nueva hora de fin HH:MM (alternativa a duration_minutes)'),
        duration_minutes: z.number().int().min(1).max(1440).optional(),
        description: z.string().max(2000).optional().describe('Texto vacío para borrar la descripción'),
        location_name: z.string().max(200).optional().describe('Texto vacío para borrarlo'),
        url: z.string().max(2000).optional().describe('Enlace http(s); texto vacío para quitarlo'),
        tentative: z.boolean().optional(),
        is_fixed: z.boolean().optional().describe('Marcar/desmarcar como inamovible')
      },
      annotations: EDIT
    },
    writeTool('update_activity', async (args, log) => {
      const activity = await Activity.findById(args.activity_id);
      if (!activity) return fail(`No existe una actividad con id "${args.activity_id}". Obtené el id con get_day_itinerary.`);

      const patch = {};
      for (const key of ['title', 'tentative', 'is_fixed']) if (args[key] !== undefined) patch[key] = args[key];
      for (const key of ['description', 'location_name', 'url']) if (args[key] !== undefined) patch[key] = args[key].trim() || null;

      const touchesTime = args.start_time !== undefined || args.end_time !== undefined || args.duration_minutes !== undefined;
      if (touchesTime) {
        const start = parseHM(args.start_time ?? activity.start_time);
        if (start == null) return fail('La actividad no tiene horario de inicio: indicá start_time.');
        const { duration, error } = resolveDuration({
          start,
          end_time: args.end_time,
          duration_minutes: args.duration_minutes
        });
        if (error) return fail(error);
        // Always send BOTH values: the shared conflict check only runs when it has
        // a start and a duration, and a partial edit must not skip it.
        patch.start_time = minutesToHM(start);
        patch.duration_minutes = duration ?? activity.duration_minutes;
        if (!patch.duration_minutes) return fail('La actividad no tiene duración: indicá end_time o duration_minutes.');
      }

      if (Object.keys(patch).length === 0) return fail('No indicaste ningún campo para cambiar.');

      const result = await updateActivity(activity.id, patch);
      if (!result.ok) return result.conflict ? conflictResult(result) : fail(result.error);

      log('activity', activity.id);
      return ok({
        updated: activityView(result.updated),
        adjusted_activities: adjustedView(result.shifts),
        note: result.shifts.length
          ? `Se ajustaron los horarios de ${result.shifts.length} actividad(es) posteriores para evitar superposición.`
          : undefined
      });
    })
  );

  server.registerTool(
    'create_expense',
    {
      title: 'Registrar gasto',
      description:
        'Registra UN gasto en un viaje. category es el nombre de una categoría de presupuesto del viaje (ver get_budget_summary; sin distinguir mayúsculas ni acentos). ' +
        'Por defecto queda como pagado y con fecha de hoy (en la zona horaria del viaje) y en la moneda del viaje. activity_id (opcional) lo vincula a una actividad del mismo viaje. ' +
        'Es un alta: si ya respondió OK no lo repitas (duplicaría el gasto).',
      inputSchema: {
        trip_id: tripId,
        amount: z.number().positive().describe('Monto, mayor a 0, en la moneda del viaje'),
        category: z.string().min(1).describe('Nombre de la categoría de presupuesto (get_budget_summary)'),
        description: z.string().max(500).optional(),
        expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('YYYY-MM-DD. Default: hoy en la zona horaria del viaje'),
        is_paid: z.boolean().optional().describe('Default true. false = pendiente de pago'),
        activity_id: z.string().optional().describe('Actividad del mismo viaje a la que vincular el gasto')
      },
      annotations: CREATE
    },
    writeTool('create_expense', async (args, log) => {
      const trip = await Trip.findById(args.trip_id);
      if (!trip) return fail(`No existe un viaje con id "${args.trip_id}". Usá list_trips para ver los disponibles.`);

      const categories = await BudgetCategory.findByTripId(trip.id);
      const category = matchByName(categories, args.category, { partial: true });
      if (!category) {
        const available = categories.map((c) => c.name).join(', ') || '(el viaje no tiene categorías)';
        return fail(`No pude identificar una única categoría "${args.category}" en "${trip.name}". Categorías disponibles: ${available}.`);
      }

      if (args.activity_id) {
        const activity = await Activity.findById(args.activity_id);
        if (!activity || (await Activity.tripIdOf(activity.id)) !== trip.id) {
          return fail(`La actividad "${args.activity_id}" no pertenece al viaje "${trip.name}".`);
        }
      }

      const dateGiven = !!args.expense_date;
      const result = await createExpense({
        trip_id: trip.id,
        amount: args.amount,
        category_id: category.id,
        description: args.description,
        expense_date: args.expense_date ?? todayIn(trip.timezone),
        activity_id: args.activity_id,
        ...(args.is_paid !== undefined && { is_paid: args.is_paid })
      });
      if (!result.ok) return fail(result.error);

      log('expense', result.expense.id);
      const e = result.expense;
      return ok({
        created: {
          id: e.id,
          amount: e.amount,
          currency_code: e.currency_code,
          category: category.name,
          description: e.description,
          expense_date: e.expense_date,
          paid: !!e.is_paid,
          activity_id: e.activity_id
        },
        note: dateGiven ? undefined : `Sin fecha indicada: se usó hoy (${e.expense_date}, zona horaria del viaje).`
      });
    })
  );

  server.registerTool(
    'create_poi',
    {
      title: 'Guardar lugar',
      description:
        'Guarda UN lugar (POI) en un viaje. category debe ser una de las 7 categorías válidas: Atracción turística, Estación, Alojamiento, Gastronomía, Naturaleza/aire libre, Cultura, Otro. ' +
        'address es texto libre y se geocodifica (OpenStreetMap/Nominatim) para obtener las coordenadas; la respuesta trae la dirección resuelta (geocoded.matched_address): verificá con la persona que sea el lugar correcto. ' +
        'Si la dirección no se encuentra, no se guarda nada.',
      inputSchema: {
        trip_id: tripId,
        name: z.string().min(1).max(200).describe('Nombre del lugar'),
        category: z.string().min(1).describe('Una de: Atracción turística, Estación, Alojamiento, Gastronomía, Naturaleza/aire libre, Cultura, Otro'),
        address: z.string().min(3).max(300).describe('Dirección o nombre del lugar (texto libre; incluí la ciudad para mayor precisión)'),
        notes: z.string().max(2000).optional(),
        link: z.string().max(2000).optional().describe('Enlace http(s)')
      },
      annotations: { ...CREATE, openWorldHint: true }
    },
    writeTool('create_poi', async (args, log) => {
      const trip = await Trip.findById(args.trip_id);
      if (!trip) return fail(`No existe un viaje con id "${args.trip_id}". Usá list_trips para ver los disponibles.`);

      // Everything that can be rejected is rejected BEFORE geocoding or any write.
      const categories = await PoiCategory.findAll();
      const category = matchByName(categories, args.category);
      if (!category) {
        return fail(`La categoría "${args.category}" no es válida. Las válidas son: ${categories.map((c) => c.name).join(', ')}.`);
      }
      if (args.link && !sanitizeHttpUrl(args.link)) return fail('El enlace debe empezar con http:// o https://');

      let geo;
      try {
        geo = await geocodeAddress(args.address);
      } catch (error) {
        console.error('MCP create_poi geocoding error:', error);
        return fail('No se pudo consultar el servicio de direcciones. No se guardó nada; reintentá en un momento.');
      }
      if (!geo) return fail(`No encontré la dirección "${args.address}". No se guardó nada; probá con una dirección más completa (calle, ciudad, país).`);

      const result = await createPoi(trip.id, {
        name: args.name,
        category_id: category.id,
        latitude: geo.latitude,
        longitude: geo.longitude,
        address: geo.label,
        city: geo.city,
        notes: args.notes,
        ...(args.link && { url: args.link })
      });
      if (!result.ok) return fail(result.error);

      log('poi', result.poi.id);
      const p = result.poi;
      return ok({
        created: {
          id: p.id,
          name: p.name,
          category: category.name,
          address: p.address,
          city: p.city,
          latitude: p.latitude,
          longitude: p.longitude,
          notes: p.notes,
          url: p.url
        },
        geocoded: { requested_address: args.address, matched_address: geo.label, latitude: geo.latitude, longitude: geo.longitude }
      });
    })
  );
}
