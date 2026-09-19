import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import Trip from '../models/Trip.js';
import Day from '../models/Day.js';
import Budget from '../models/Budget.js';
import Expense from '../models/Expense.js';
import BudgetCategory from '../models/BudgetCategory.js';
import PaymentMethod from '../models/PaymentMethod.js';
import Accommodation from '../models/Accommodation.js';
import Poi from '../models/Poi.js';
import Document from '../models/Document.js';
import InterestLink from '../models/InterestLink.js';
import { parseHM, minutesToHM } from '../models/Activity.js';
import { loadActivityDetails } from '../lib/activityDetails.js';

// Épica 12 / HU-12.2 — read-only tools. Every handler is a thin wrapper over
// the same model/lib functions the REST endpoints use; nothing here writes,
// and nothing makes an HTTP call back to this server.
//
// Access model: like the web app, any allowlisted user sees every trip (there
// is no per-trip owner). requireBearerAuth + verifyAccessToken already gated
// the caller by allowlist before a tool runs.

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const tripId = z.string().min(1).describe('ID del viaje (se obtiene con list_trips)');

const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = (message) => ({ isError: true, content: [{ type: 'text', text: message }] });

const normalize = (s) =>
  (s ?? '').toString().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Wraps a tool body: resolves the trip, and turns unexpected errors into a
 * generic message so internal details never reach the model. */
function tripTool(handler) {
  return async (args) => {
    try {
      const trip = await Trip.findById(args.trip_id);
      if (!trip) return fail(`No existe un viaje con id "${args.trip_id}". Usá list_trips para ver los disponibles.`);
      return await handler(trip, args);
    } catch (error) {
      console.error('MCP tool error:', error);
      return fail('Error interno al consultar los datos.');
    }
  };
}

export function createMcpServer() {
  const server = new McpServer({ name: 'trip-planner', version: '1.0.0' });

  server.registerTool(
    'list_trips',
    {
      title: 'Listar viajes',
      description: 'Lista todos los viajes con nombre, fechas, moneda y presupuesto total. Es el punto de partida: devuelve los trip_id que usan las demás herramientas.',
      inputSchema: {},
      annotations: READ_ONLY
    },
    async () => {
      try {
        const trips = await Trip.findAll();
        return ok({
          trips: trips.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            start_date: t.start_date,
            end_date: t.end_date,
            currency_code: t.currency_code,
            total_budget: t.total_budget,
            timezone: t.timezone
          }))
        });
      } catch (error) {
        console.error('MCP tool error:', error);
        return fail('Error interno al consultar los datos.');
      }
    }
  );

  server.registerTool(
    'get_day_itinerary',
    {
      title: 'Ver itinerario de un día',
      description:
        'Itinerario de un día de un viaje: actividades ordenadas por horario, con hora de inicio/fin, lugares (POIs) asociados con su categoría y dirección, gasto vinculado y documentos adjuntos. Indicá el día por fecha (YYYY-MM-DD) o por número de día (1 = primer día del viaje).',
      inputSchema: {
        trip_id: tripId,
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Fecha del día, formato YYYY-MM-DD'),
        day_number: z.number().int().positive().optional().describe('Número de día dentro del viaje (1 = primer día)')
      },
      annotations: READ_ONLY
    },
    tripTool(async (trip, { date, day_number }) => {
      if (!date && !day_number) return fail('Indicá date (YYYY-MM-DD) o day_number.');

      const days = await Day.findByTripId(trip.id);
      const day = date ? days.find((d) => d.date === date) : days.find((d) => d.day_number === day_number);
      if (!day) {
        return fail(
          `El viaje "${trip.name}" no tiene ese día. Va del ${trip.start_date} al ${trip.end_date} (${days.length} días).`
        );
      }

      const activities = await Day.getActivities(day.id);
      const withDetails = await loadActivityDetails(activities.map((a) => a.id));

      return ok({
        trip: { id: trip.id, name: trip.name, currency_code: trip.currency_code },
        day: { id: day.id, day_number: day.day_number, date: day.date, title: day.title, notes: day.notes },
        activities: activities.map((raw, i) => {
          const a = withDetails(raw);
          const start = parseHM(a.start_time);
          return {
            position: i + 1,
            id: a.id,
            title: a.title,
            description: a.description,
            start_time: a.start_time,
            end_time: start != null && a.duration_minutes ? minutesToHM(start + a.duration_minutes) : null,
            duration_minutes: a.duration_minutes,
            completed: !!a.completed,
            tentative: !!a.tentative,
            fixed_time: !!a.is_fixed,
            url: a.url,
            pois: a.pois.map((p) => ({
              id: p.id,
              name: p.name,
              category: p.category_name,
              address: p.address,
              city: p.city,
              latitude: p.latitude,
              longitude: p.longitude
            })),
            expense: a.expense
              ? { amount: a.expense.amount, currency_code: a.expense.currency_code, paid: !!a.expense.is_paid }
              : null,
            documents: a.documents.map((d) => ({ title: d.title, file_name: d.file_name, file_type: d.file_type }))
          };
        })
      });
    })
  );

  server.registerTool(
    'get_budget_summary',
    {
      title: 'Resumen de presupuesto',
      description: 'Resumen de presupuesto de un viaje: total, gastado, pendiente de pago, restante y el detalle por categoría (asignado vs gastado).',
      inputSchema: { trip_id: tripId },
      annotations: READ_ONLY
    },
    tripTool(async (trip) => {
      const s = await Budget.getSummary(trip.id);
      return ok({
        trip: { id: trip.id, name: trip.name },
        currency_code: s.currency_code,
        total_budget: s.total_budget,
        total_allocated: s.total_allocated,
        total_spent: s.total_spent,
        total_pending_payment: s.total_pending,
        remaining: s.remaining,
        over_budget: s.over_budget,
        categories: s.categories.map((c) => ({
          name: c.name,
          allocated_budget: c.allocated_budget,
          spent: c.spent,
          remaining: c.remaining,
          over_budget: c.over_budget,
          expense_count: c.expense_count
        }))
      });
    })
  );

  server.registerTool(
    'list_expenses',
    {
      title: 'Listar gastos',
      description: 'Lista los gastos de un viaje, del más reciente al más antiguo, con categoría, medio de pago, monto, fecha y si está pagado o pendiente.',
      inputSchema: { trip_id: tripId },
      annotations: READ_ONLY
    },
    tripTool(async (trip) => {
      const [expenses, categories, methods] = await Promise.all([
        Expense.findByTripId(trip.id),
        BudgetCategory.findByTripId(trip.id),
        PaymentMethod.findAll()
      ]);
      const categoryName = new Map(categories.map((c) => [c.id, c.name]));
      const methodName = new Map(methods.map((m) => [m.id, m.name]));
      return ok({
        trip: { id: trip.id, name: trip.name },
        expenses: expenses.map((e) => ({
          id: e.id,
          description: e.description,
          amount: e.amount,
          currency_code: e.currency_code,
          expense_date: e.expense_date,
          category: categoryName.get(e.category_id) ?? null,
          payment_method: methodName.get(e.payment_method_id) ?? null,
          paid: !!e.is_paid,
          activity_id: e.activity_id,
          accommodation_id: e.accommodation_id
        }))
      });
    })
  );

  server.registerTool(
    'list_accommodations',
    {
      title: 'Listar alojamientos',
      description: 'Lista los alojamientos de un viaje ordenados por check-in: nombre, fechas y horas de check-in/check-out, dirección, ciudad, contacto y link de reserva.',
      inputSchema: { trip_id: tripId },
      annotations: READ_ONLY
    },
    tripTool(async (trip) => {
      const rows = await Accommodation.findByTripId(trip.id);
      return ok({
        trip: { id: trip.id, name: trip.name },
        accommodations: rows.map((a) => ({
          id: a.id,
          name: a.name,
          check_in: a.check_in,
          check_out: a.check_out,
          address: a.address,
          city: a.city,
          phone: a.phone,
          email: a.email,
          booking_url: a.booking_url
        }))
      });
    })
  );

  server.registerTool(
    'list_pois',
    {
      title: 'Listar lugares guardados',
      description: 'Lista los lugares (POIs) guardados de un viaje con categoría, dirección, ciudad y coordenadas. Filtros opcionales por categoría (ej. "gastronomía", "estación") y por ciudad; ignoran mayúsculas y acentos.',
      inputSchema: {
        trip_id: tripId,
        category: z.string().optional().describe('Filtrar por categoría (coincidencia parcial, sin acentos)'),
        city: z.string().optional().describe('Filtrar por ciudad (coincidencia parcial, sin acentos)')
      },
      annotations: READ_ONLY
    },
    tripTool(async (trip, { category, city }) => {
      let pois = await Poi.findByTripId(trip.id);
      if (category) pois = pois.filter((p) => normalize(p.category_name).includes(normalize(category)));
      if (city) pois = pois.filter((p) => normalize(p.city).includes(normalize(city)));
      return ok({
        trip: { id: trip.id, name: trip.name },
        pois: pois.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category_name,
          description: p.description,
          address: p.address,
          city: p.city,
          latitude: p.latitude,
          longitude: p.longitude,
          notes: p.notes,
          url: p.url,
          estimated_duration_minutes: p.estimated_duration_minutes
        }))
      });
    })
  );

  server.registerTool(
    'list_documents',
    {
      title: 'Listar documentos',
      description: 'Lista los documentos cargados en un viaje (título, nombre de archivo, tipo, tamaño, fecha de carga y actividad vinculada). No devuelve el contenido ni enlaces de descarga.',
      inputSchema: { trip_id: tripId },
      annotations: READ_ONLY
    },
    tripTool(async (trip) => {
      const docs = await Document.findByTripId(trip.id);
      // file_path is the private Blob URL — deliberately not exposed.
      return ok({
        trip: { id: trip.id, name: trip.name },
        documents: docs.map((d) => ({
          id: d.id,
          title: d.title,
          file_name: d.file_name,
          file_type: d.file_type,
          file_size_bytes: d.file_size_bytes,
          uploaded_at: d.uploaded_at,
          activity_title: d.activity_title
        }))
      });
    })
  );

  server.registerTool(
    'list_interest_links',
    {
      title: 'Listar links de interés',
      description: 'Lista los links de interés guardados en un viaje, con sus tags. Filtro opcional por tags (devuelve los que tengan al menos uno de los indicados).',
      inputSchema: {
        trip_id: tripId,
        tags: z.array(z.string()).optional().describe('Tags por los que filtrar (OR)')
      },
      annotations: READ_ONLY
    },
    tripTool(async (trip, { tags }) => {
      const links = await InterestLink.findByTripId(trip.id, tags?.length ? tags : null);
      return ok({
        trip: { id: trip.id, name: trip.name },
        links: links.map((l) => ({ id: l.id, title: l.title, url: l.url, tags: l.tags.map((t) => t.name) }))
      });
    })
  );

  return server;
}
