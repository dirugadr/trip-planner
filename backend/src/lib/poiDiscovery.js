/**
 * HU-2.6b — discover new places inside the map's visible area via Overpass
 * API (OpenStreetMap), to mix with POIs already saved in that same area
 * when proposing an area route. Best-effort: an Overpass failure yields an
 * empty discovery list rather than blocking the whole suggestion — there
 * may still be enough already-saved POIs to propose something.
 */

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
export const MAX_AREA_KM2 = 4; // a comfortably walkable area, not a whole city
const MAX_CANDIDATES = 30;

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Rough width × height of a lat/lng box, in km². Good enough for a size cap. */
export function areaKm2(bounds) {
  const midLat = (bounds.north + bounds.south) / 2;
  const heightKm = ((bounds.north - bounds.south) * Math.PI * EARTH_RADIUS_KM) / 180;
  const widthKm = ((bounds.east - bounds.west) * Math.PI * EARTH_RADIUS_KM * Math.cos(toRad(midLat))) / 180;
  return Math.abs(widthKm * heightKm);
}

// OSM tag -> our fixed poi_categories id (backend/src/db/002_seed_data.sql).
function categoryFor(tags) {
  if (tags.tourism === 'museum') return 'cat_culture';
  if (tags.tourism === 'attraction') return 'cat_attraction';
  if (tags.tourism === 'hotel') return 'cat_accommodation';
  if (tags.amenity === 'restaurant' || tags.amenity === 'cafe') return 'cat_food';
  if (tags.leisure === 'park' || tags.natural) return 'cat_nature';
  if (tags.railway === 'station') return 'cat_station';
  return 'cat_other';
}

/**
 * @param {{south:number,west:number,north:number,east:number}} bounds
 * @returns {Promise<{name:string, latitude:number, longitude:number, category_id:string}[]>}
 */
export async function discoverPois(bounds) {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  const query =
    `[out:json][timeout:15];` +
    `(` +
    `node["tourism"~"^(attraction|museum|hotel)$"](${bbox});` +
    `node["amenity"~"^(restaurant|cafe)$"](${bbox});` +
    `node["leisure"="park"](${bbox});` +
    `node["natural"](${bbox});` +
    `node["railway"="station"](${bbox});` +
    `);` +
    `out body ${MAX_CANDIDATES};`;

  try {
    const res = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: '*/*',
        'User-Agent': 'TripPlanner/1.0 (personal trip-planning app, no public contact)',
      },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const elements = Array.isArray(data.elements) ? data.elements : [];

    return elements
      .filter((el) => el.tags?.name && el.lat != null && el.lon != null)
      .slice(0, MAX_CANDIDATES)
      .map((el) => ({
        name: el.tags.name,
        latitude: el.lat,
        longitude: el.lon,
        category_id: categoryFor(el.tags),
      }));
  } catch {
    return [];
  }
}
