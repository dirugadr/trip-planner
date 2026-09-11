/** Categories AND city, both optional; an empty filter matches everything. */
export function applyPoiFilters(pois, filters) {
  const { categories, city } = filters;
  return pois.filter((p) => {
    if (categories.length > 0 && !categories.includes(p.category_id)) return false;
    if (city && p.city !== city) return false;
    return true;
  });
}

/** Distinct, sorted city names present among the given POIs (nulls excluded). */
export function citiesOf(pois) {
  return [...new Set(pois.map((p) => p.city).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es')
  );
}
