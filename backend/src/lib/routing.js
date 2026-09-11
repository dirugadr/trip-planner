import PoiWalkTime from '../models/PoiWalkTime.js';

// The public OSRM demo server only serves the car profile (asking for /foot/
// returns car speeds), so we take its road-network *distance* matrix and
// convert to a walking time ourselves. That still beats a straight line
// because it follows actual streets.
const OSRM_TABLE = 'https://router.project-osrm.org/table/v1/foot';
const WALK_METERS_PER_MIN = 80; // ~4.8 km/h

/** Great-circle distance in metres. */
function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Straight-line walking estimate, in minutes (rounded). */
export function haversineMinutes(a, b) {
  return Math.max(1, Math.round(haversineMeters(a, b) / WALK_METERS_PER_MIN));
}

/**
 * OSRM road-network distance matrix → walking minutes. One request.
 * @returns {Promise<number[][]|null>} minutes[i][j], or null on failure.
 */
async function osrmMatrix(points, { signal } = {}) {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
  try {
    const res = await fetch(`${OSRM_TABLE}/${coords}?annotations=distance`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !Array.isArray(data.distances)) return null;
    return data.distances.map((row) =>
      row.map((m) => (m == null ? null : Math.max(1, Math.round(m / WALK_METERS_PER_MIN))))
    );
  } catch {
    return null;
  }
}

/**
 * Walking-time matrix between every ordered pair of the given POIs.
 * Uses the cache first, one OSRM call for the rest, haversine as fallback.
 *
 * @param {{id:string, lat:number, lng:number}[]} pois
 * @returns {Promise<{from:string,to:string,minutes:number,source:'osrm'|'haversine_estimate'}[]>}
 */
export async function walkTimeMatrix(pois) {
  const pairs = [];
  for (const from of pois) {
    for (const to of pois) {
      if (from.id !== to.id) pairs.push({ from: from.id, to: to.id });
    }
  }

  const cached = await PoiWalkTime.getMany(pairs);
  const missing = pairs.filter((p) => !cached.has(`${p.from}|${p.to}`));

  let osrm = null;
  if (missing.length > 0) {
    osrm = await osrmMatrix(pois);
  }
  const idx = new Map(pois.map((p, i) => [p.id, i]));
  const toPersist = [];

  const result = pairs.map(({ from, to }) => {
    const hit = cached.get(`${from}|${to}`);
    if (hit) return { from, to, minutes: hit.minutes, source: hit.source };

    const osrmMin = osrm ? osrm[idx.get(from)]?.[idx.get(to)] : null;
    if (osrmMin != null) {
      toPersist.push({ from, to, minutes: osrmMin, source: 'osrm' });
      return { from, to, minutes: osrmMin, source: 'osrm' };
    }

    const a = pois[idx.get(from)];
    const b = pois[idx.get(to)];
    return { from, to, minutes: haversineMinutes(a, b), source: 'haversine_estimate' };
  });

  if (toPersist.length > 0) {
    // Best-effort — a cache write failure shouldn't break the suggestion.
    await PoiWalkTime.saveMany(toPersist).catch((e) => console.error('walk-time cache write failed:', e));
  }

  return result;
}
