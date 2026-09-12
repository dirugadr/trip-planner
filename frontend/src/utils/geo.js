/** Great-circle distance between two [lat, lng] points, in kilometers. */
export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Sums the real walked length of a day-route-view's segments (polylines
 * already resolved by OSRM, or the straight-line fallback), in kilometers. */
export function totalDistanceKm(segments) {
  let km = 0;
  for (const seg of segments) {
    const coords = seg.coordinates;
    for (let i = 1; i < coords.length; i++) {
      km += haversineKm(coords[i - 1], coords[i]);
    }
  }
  return km;
}

/** Walking time estimate at ~80 m/min, matching the backend's own constant
 * (lib/routing.js) so the two never disagree. */
export function walkMinutesForKm(km) {
  return Math.round((km * 1000) / 80);
}
