// Google Maps Directions URL scheme (no API key): origin + destination +
// up to 8 waypoints, so 10 stops total is the practical limit for a route
// built this way. https://developers.google.com/maps/documentation/urls/get-started
const MAX_STOPS = 10;

/**
 * Walking-directions URL for a day's route-view stops (already in schedule
 * order). Caps at the first 10 stops — everything past that is dropped, not
 * silently broken — and reports whether it had to.
 *
 * @param {{lat:number,lng:number}[]} stops
 * @returns {{url:string, truncated:boolean, includedCount:number}|null} null if fewer than 2 stops
 */
export function buildWalkingDirectionsUrl(stops) {
  if (!stops || stops.length < 2) return null;

  const included = stops.slice(0, MAX_STOPS);
  const truncated = stops.length > MAX_STOPS;
  const origin = included[0];
  const destination = included[included.length - 1];
  const waypoints = included.slice(1, -1);

  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: 'walking',
  });
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map((s) => `${s.lat},${s.lng}`).join('|'));
  }

  return {
    url: `https://www.google.com/maps/dir/?${params.toString()}`,
    truncated,
    includedCount: included.length,
  };
}
