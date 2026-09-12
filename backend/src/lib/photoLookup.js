/**
 * Automatic POI photo lookup (foto por lugar) — Wikipedia's public GeoSearch
 * + PageImages APIs, no API key needed. Best-effort only: on any failure or
 * empty result this resolves to null, and callers must never let that block
 * creating/editing a POI.
 */

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const SEARCH_RADIUS_METERS = 300;
// Wikipedia's API etiquette asks for an identifying User-Agent on server-side
// calls (unidentified traffic gets throttled/blocked) — same reasoning as the
// Nominatim User-Agent requirement already noted for HU-2.1's geocoding.
const USER_AGENT = 'TripPlanner/1.0 (personal trip-planning app, no public contact)';

async function wikiFetch(params) {
  const url = new URL(WIKIPEDIA_API);
  url.search = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', ...params }).toString();
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(body.error.info || 'Wikipedia API error');
  return body;
}

/**
 * @returns {Promise<{url: string, source: 'auto_wikipedia'}|null>}
 */
export async function lookupPhotoNear(lat, lng) {
  try {
    const geo = await wikiFetch({
      list: 'geosearch',
      gscoord: `${lat}|${lng}`,
      gsradius: String(SEARCH_RADIUS_METERS),
      gslimit: '5',
    });
    const pages = geo?.query?.geosearch;
    if (!Array.isArray(pages) || pages.length === 0) return null;

    const images = await wikiFetch({
      prop: 'pageimages',
      piprop: 'original',
      pageids: pages.map((p) => p.pageid).join('|'),
    });
    const byId = new Map((images?.query?.pages || []).map((p) => [p.pageid, p]));

    // geosearch results are already distance-sorted — take the closest page
    // that actually has an image.
    for (const p of pages) {
      const imageUrl = byId.get(p.pageid)?.original?.source;
      if (imageUrl) return { url: imageUrl, source: 'auto_wikipedia' };
    }
    return null;
  } catch {
    return null;
  }
}
