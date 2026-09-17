import Anthropic from '@anthropic-ai/sdk';
import config from '../config/index.js';

const MODEL = 'claude-sonnet-5';

const TOOL = {
  name: 'propose_day_route',
  description:
    'Propone un orden y horarios optimizados para las actividades de un día de viaje. ' +
    'IMPORTANTE: suggested_order debe tener exactamente una entrada por cada actividad ' +
    'recibida, aunque dos actividades compartan el mismo POI (p. ej. almorzar y cenar en ' +
    'el mismo lugar) — nunca fusiones ni omitas actividades por compartir ubicación.',
  input_schema: {
    type: 'object',
    properties: {
      suggested_order: {
        type: 'array',
        description:
          'Una entrada por cada activity_id del input, sin excepción — el largo de este ' +
          'array debe ser idéntico a la cantidad de actividades recibidas.',
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
    'de menos, usando el activity_id exacto. Si dos actividades comparten el mismo POI ' +
    '(mismo lat/lng), son igual dos paradas separadas: no las fusiones en una sola entrada ' +
    'de suggested_order.\n\n' +
    JSON.stringify(input, null, 2);

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
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
  const suggestedOrder = Array.isArray(proposal?.suggested_order) ? proposal.suggested_order : [];
  const outIds = suggestedOrder.map((s) => s.activity_id);
  const outSet = new Set(outIds);
  const ok =
    outIds.length === inSet.size &&
    outSet.size === inSet.size &&
    [...inSet].every((id) => outSet.has(id));
  if (!ok) {
    console.error('validateProposal mismatch:', {
      expected: inSet.size,
      got: outIds.length,
      missing: [...inSet].filter((id) => !outSet.has(id)),
      extra: [...outSet].filter((id) => !inSet.has(id)),
      duplicated: outIds.length !== outSet.size,
    });
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
  const outIds = Array.isArray(proposal?.ordered_poi_ids) ? proposal.ordered_poi_ids : [];
  const outSet = new Set(outIds);
  const ok =
    outIds.length === inSet.size &&
    outSet.size === inSet.size &&
    [...inSet].every((id) => outSet.has(id));
  if (!ok) {
    console.error('validatePoiOrderProposal mismatch:', {
      expected: inSet.size,
      got: outIds.length,
      missing: [...inSet].filter((id) => !outSet.has(id)),
      extra: [...outSet].filter((id) => !inSet.has(id)),
      duplicated: outIds.length !== outSet.size,
    });
    const e = new Error('La sugerencia de Claude no coincide con los lugares enviados (IDs de más o de menos)');
    e.status = 502;
    throw e;
  }
}

const DISCOVERY_CATEGORIES = ['cat_attraction', 'cat_nature', 'cat_culture'];

const CLASSIFY_DISCOVERED_TOOL = {
  name: 'classify_discovered_pois',
  description:
    'Clasifica una lista de lugares crudos de OpenStreetMap en las categorías Atracción ' +
    'turística, Naturaleza/Aire libre o Cultura, descartando (no incluyendo en la respuesta) ' +
    'los que no encajen claramente en ninguna, o sean de baja calidad: nombre que no parece un ' +
    'lugar real, ruido, o duplicados entre sí.',
  input_schema: {
    type: 'object',
    properties: {
      accepted: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            candidate_id: { type: 'string', description: 'ID exacto del candidato, tal como vino en el input' },
            category_id: {
              type: 'string',
              enum: DISCOVERY_CATEGORIES,
              description: 'Categoría elegida para este lugar',
            },
          },
          required: ['candidate_id', 'category_id'],
        },
        description:
          'Los candidatos que vale la pena mostrarle al viajero como descubrimiento, cada uno ' +
          'con su categoría. Omití los que no encajen o sean de baja calidad — no hace falta ' +
          'devolver todos los que recibiste, ni ninguno si ninguno vale la pena.',
      },
    },
    required: ['accepted'],
  },
};

/**
 * Ask Claude to classify raw Overpass candidates (HU-2.8) into the 3
 * categories this search covers, discarding low-quality/unclear/duplicate
 * ones. A SUBSET of the input like proposeAreaRoute/proposePoiOrder used to
 * be, but with no minimum size — Claude may keep anywhere from none to all
 * of them, since "discard the bad ones" is the whole point of this pass.
 * `input`: { candidates: [{candidate_id, name, hint}] }
 * @returns {Promise<{candidate_id:string, category_id:string}[]>}
 */
export async function classifyDiscoveredPois(input) {
  const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

  const prompt =
    'Sos un asistente de planificación de viajes. Te paso una lista cruda de lugares sacados ' +
    'de OpenStreetMap dentro de una zona del mapa, cada uno con una pista (hint) de sus tags ' +
    'originales. Clasificá cada lugar que tenga sentido mostrarle a un viajero en una de estas ' +
    '3 categorías: cat_attraction (atracción turística), cat_nature (naturaleza/aire libre) o ' +
    'cat_culture (cultura — museos, sitios históricos). Descartá (no incluyas en la respuesta) ' +
    'los que no encajen claramente en ninguna categoría, tengan un nombre que no parezca un ' +
    'lugar real, o sean ruido/duplicados entre sí. Usá el candidate_id exacto de cada uno que ' +
    'aceptes.\n\n' +
    JSON.stringify(input, null, 2);

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      tools: [CLASSIFY_DISCOVERED_TOOL],
      tool_choice: { type: 'tool', name: 'classify_discovered_pois' },
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (err) {
    const e = new Error(`No se pudo clasificar los lugares encontrados (API de Claude): ${err.message}`);
    e.status = 502;
    throw e;
  }

  const block = response.content.find((b) => b.type === 'tool_use');
  if (!block?.input?.accepted) {
    const e = new Error('La API de Claude no devolvió una clasificación válida');
    e.status = 502;
    throw e;
  }

  return validateClassifiedPois(block.input, input.candidates.map((c) => c.candidate_id));
}

const ALLOWED_DISCOVERY_CATEGORIES = new Set(DISCOVERY_CATEGORIES);

/**
 * Unlike validateProposal()/validatePoiOrderProposal()/the old
 * validateAreaRouteProposal() (throw on any mismatch), this filters instead
 * of throwing: a per-item bad id/category from Claude just means that one
 * item gets dropped, not that the whole classification fails — "discard the
 * ones that don't fit" is expected, normal output here, not an error case.
 */
export function validateClassifiedPois(proposal, candidateIds) {
  const validIds = new Set(candidateIds);
  const accepted = Array.isArray(proposal?.accepted) ? proposal.accepted : [];
  const seen = new Set();
  const out = [];
  for (const item of accepted) {
    if (!item?.candidate_id || !validIds.has(item.candidate_id)) continue;
    if (seen.has(item.candidate_id)) continue;
    if (!ALLOWED_DISCOVERY_CATEGORIES.has(item.category_id)) continue;
    seen.add(item.candidate_id);
    out.push({ candidate_id: item.candidate_id, category_id: item.category_id });
  }
  return out;
}

export default proposeDayRoute;
