/**
 * HU-2.8 — discover new places in the map's visible area via Overpass API
 * (OpenStreetMap), restricted to the 3 categories this search covers:
 * Atracción turística, Naturaleza/Aire libre, Cultura. Best-effort: an
 * Overpass failure yields an empty list rather than blocking the search —
 * there's nothing to fall back to here (unlike HU-2.5's walk-time matrix),
 * discovery is the whole point of this endpoint.
 *
 * Replaces the HU-2.6b prototype (`discoverPois`/`areaKm2`/`MAX_AREA_KM2`,
 * used by the now-removed `POST /trips/:tripId/smart-route/discover`): no
 * area size cap, a different (narrower) set of OSM tags, and raw results are
 * classified by Claude (see `classifyDiscoveredPois` in `smartRoute.js`)
 * instead of mapped to a category by a fixed tag table.
 */

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const MAX_RAW_CANDIDATES = 60; // cap before handing the list to Claude for classification
const DUPLICATE_RADIUS_METERS = 50;

// A short tag-derived hint per candidate — not used to decide the category
// directly (that's Claude's job below), just extra context in the prompt.
function hintFor(tags) {
  if (tags.tourism === 'museum') return 'tourism=museum';
  if (tags.tourism === 'attraction') return 'tourism=attraction';
  if (tags.tourism === 'viewpoint') return 'tourism=viewpoint';
  if (tags.historic) return `historic=${tags.historic}`;
  if (tags.leisure === 'park') return 'leisure=park';
  if (tags.natural) return `natural=${tags.natural}`;
  return 'other';
}

function addressFor(tags) {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const parts = [street, tags['addr:city']].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * @param {{south:number,west:number,north:number,east:number}} bounds
 * @returns {Promise<{name:string, latitude:number, longitude:number, address:string|null, hint:string}[]>}
 */
export async function discoverPois(bounds) {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  const query =
    `[out:json][timeout:20];` +
    `(` +
    `node["tourism"~"^(attraction|viewpoint|museum)$"](${bbox});` +
    `node["historic"](${bbox});` +
    `node["leisure"="park"](${bbox});` +
    `node["natural"](${bbox});` +
    `);` +
    `out body ${MAX_RAW_CANDIDATES};`;

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
      .slice(0, MAX_RAW_CANDIDATES)
      .map((el) => ({
        name: el.tags.name,
        latitude: el.lat,
        longitude: el.lon,
        address: addressFor(el.tags),
        hint: hintFor(el.tags),
      }));
  } catch {
    return [];
  }
}

/** Great-circle distance in metres — a local copy so this module stays
 * self-contained (routing.js's own haversine is walk-time-matrix internal). */
function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Drops discovered candidates within DUPLICATE_RADIUS_METERS of any POI
 * already saved in the trip — geographic proximity only, no name matching.
 */
export function dropNearSaved(candidates, savedPois) {
  return candidates.filter(
    (c) =>
      !savedPois.some(
        (p) =>
          haversineMeters({ lat: c.latitude, lng: c.longitude }, { lat: Number(p.latitude), lng: Number(p.longitude) }) <
          DUPLICATE_RADIUS_METERS
      )
  );
}
