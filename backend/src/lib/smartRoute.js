import Anthropic from '@anthropic-ai/sdk';
import config from '../config/index.js';

const MODEL = 'claude-sonnet-5';

const TOOL = {
  name: 'propose_day_route',
  description: 'Propone un orden y horarios optimizados para visitar los POIs de un día de viaje.',
  input_schema: {
    type: 'object',
    properties: {
      suggested_order: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            activity_id: { type: 'string', description: 'ID exacto de la actividad, tal como vino en el input' },
            suggested_start_time: { type: 'string', description: 'Formato HH:MM' },
            suggested_end_time: { type: 'string', description: 'Formato HH:MM' },
            reason: { type: 'string', description: 'Justificación breve, una oración' },
          },
          required: ['activity_id', 'suggested_start_time', 'suggested_end_time', 'reason'],
        },
      },
      summary: { type: 'string', description: 'Resumen de la lógica del recorrido, 1-2 oraciones' },
    },
    required: ['suggested_order', 'summary'],
  },
};

/**
 * Ask Claude for a route proposal. `input` is the structured day context.
 * Returns the tool_use payload, validated so its activity_id set matches the input.
 * Throws an Error with `.status` on any problem.
 */
export async function proposeDayRoute(input) {
  const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

  const prompt =
    'Sos un asistente de planificación de viajes. Te paso las actividades de un día ' +
    'con el POI (lugar) de cada una, sus horarios actuales y la matriz de tiempos de ' +
    'caminata reales entre paradas. Proponé el mejor orden de visita y un horario para ' +
    'cada parada, respetando los tiempos de caminata, los horarios ya fijados que tengan ' +
    'sentido, y las notas. Devolvé TODAS las actividades que te paso, ninguna de más ni ' +
    'de menos, usando el activity_id exacto.\n\n' +
    JSON.stringify(input, null, 2);

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'propose_day_route' },
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (err) {
    const e = new Error(`No se pudo generar la sugerencia (API de Claude): ${err.message}`);
    e.status = 502;
    throw e;
  }

  const block = response.content.find((b) => b.type === 'tool_use');
  if (!block?.input?.suggested_order) {
    const e = new Error('La API de Claude no devolvió una propuesta válida');
    e.status = 502;
    throw e;
  }

  validateProposal(block.input, input.activities.map((a) => a.activity_id));
  return block.input;
}

/**
 * The proposal's activity_id set must match `inputIds` exactly (same size, same
 * members, no duplicates). Throws a 502 Error otherwise. Never return or apply a
 * partial proposal or one with unknown IDs.
 */
export function validateProposal(proposal, inputIds) {
  const inSet = new Set(inputIds);
  const outIds = (proposal?.suggested_order || []).map((s) => s.activity_id);
  const outSet = new Set(outIds);
  const ok =
    outIds.length === inSet.size &&
    outSet.size === inSet.size &&
    [...inSet].every((id) => outSet.has(id));
  if (!ok) {
    const e = new Error('La sugerencia de Claude no coincide con las actividades del día (IDs de más o de menos)');
    e.status = 502;
    throw e;
  }
}

const POI_ORDER_TOOL = {
  name: 'propose_poi_order',
  description: 'Propone un orden lógico para recorrer una lista de POIs a pie',
  input_schema: {
    type: 'object',
    properties: {
      ordered_poi_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs de POI en el orden sugerido, exactamente los mismos recibidos, sin agregar ni quitar',
      },
      reasons: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            poi_id: { type: 'string' },
            reason: { type: 'string', description: 'Justificación breve, una oración' },
          },
          required: ['poi_id', 'reason'],
        },
      },
    },
    required: ['ordered_poi_ids', 'reasons'],
  },
};

/**
 * Ask Claude for a walking order over a set of POIs still being assembled
 * into a route template (HU-2.6) — no schedule involved yet, order only.
 * `input`: { pois: [{poi_id, name, category}], walking_times_minutes: [{from,to,minutes,source}] }
 */
export async function proposePoiOrder(input) {
  const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

  const prompt =
    'Sos un asistente de planificación de viajes. Te paso una lista de lugares (POIs) ' +
    'que un viajero quiere visitar a pie, junto con los tiempos de caminata reales entre ' +
    'cada par. Proponé el mejor orden para recorrerlos caminando, minimizando idas y ' +
    'vueltas innecesarias. No hay horarios todavía. Devolvé TODOS los poi_id que te paso, ' +
    'ninguno de más ni de menos, usando el poi_id exacto.\n\n' +
    JSON.stringify(input, null, 2);

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      tools: [POI_ORDER_TOOL],
      tool_choice: { type: 'tool', name: 'propose_poi_order' },
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (err) {
    const e = new Error(`No se pudo generar la sugerencia (API de Claude): ${err.message}`);
    e.status = 502;
    throw e;
  }

  const block = response.content.find((b) => b.type === 'tool_use');
  if (!block?.input?.ordered_poi_ids) {
    const e = new Error('La API de Claude no devolvió una propuesta válida');
    e.status = 502;
    throw e;
  }

  validatePoiOrderProposal(block.input, input.pois.map((p) => p.poi_id));
  return block.input;
}

/** Same guard as validateProposal(), but over ordered_poi_ids / poi_id. */
export function validatePoiOrderProposal(proposal, inputIds) {
  const inSet = new Set(inputIds);
  const outIds = proposal?.ordered_poi_ids || [];
  const outSet = new Set(outIds);
  const ok =
    outIds.length === inSet.size &&
    outSet.size === inSet.size &&
    [...inSet].every((id) => outSet.has(id));
  if (!ok) {
    const e = new Error('La sugerencia de Claude no coincide con los lugares enviados (IDs de más o de menos)');
    e.status = 502;
    throw e;
  }
}

export default proposeDayRoute;
