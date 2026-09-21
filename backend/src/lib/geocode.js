/**
 * Server-side address → coordinates via Nominatim (OpenStreetMap), for the MCP
 * `create_poi` tool (HU-12.3). Same service, endpoint and query the web app's
 * PoiForm uses (frontend/src/utils/geocode.js) — the browser can't be involved
 * when the request comes from Claude/ChatGPT, so the backend makes the call.
 *
 * Nominatim's usage policy asks for an identifying User-Agent and at most one
 * request per second; a tool call geocodes once, so that holds.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'TripPlanner/1.0 (personal trip-planning app, no public contact)';
const TIMEOUT_MS = 8000;

/** city -> town -> village -> municipality -> null (HU-2.7). Mirrors the frontend. */
function extractCity(address) {
  if (!address) return null;
  return address.city || address.town || address.village || address.municipality || null;
}

/**
 * @returns {Promise<{label:string, latitude:number, longitude:number, city:string|null}|null>}
 *   the best match, or null when Nominatim has nothing for that text.
 * @throws when the service can't be reached (callers turn that into a clear tool error).
 */
export async function geocodeAddress(query) {
  const q = (query ?? '').toString().trim();
  if (q.length < 3) return null;

  const params = new URLSearchParams({ q, format: 'jsonv2', addressdetails: '1', limit: '1' });
  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);

  const data = await res.json();
  const first = Array.isArray(data) ? data[0] : null;
  if (!first) return null;

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { label: first.display_name, latitude, longitude, city: extractCity(first.address) };
}
