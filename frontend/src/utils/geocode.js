/**
 * Address search via Nominatim (OpenStreetMap). Light use only — the caller
 * debounces input and we ask for a handful of results. Per Nominatim's usage
 * policy the browser's Referer header identifies the app; we don't send any
 * personal data in the query string.
 *
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

export async function searchAddress(query, { signal } = {}) {
  const q = query.trim();
  if (q.length < 3) return [];

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5',
  });

  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('No se pudo buscar la dirección');

  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((r) => ({
    label: r.display_name,
    latitude: Number(r.lat),
    longitude: Number(r.lon),
    city: extractCity(r.address),
  }));
}

/** city -> town -> village -> municipality -> null (HU-2.7). */
function extractCity(address) {
  if (!address) return null;
  return address.city || address.town || address.village || address.municipality || null;
}
