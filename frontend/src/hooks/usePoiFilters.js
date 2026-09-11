import { useCallback, useState } from 'react';

// Kept in sessionStorage (not React context) so the same filter survives
// navigating between the Lugares and Mapa tabs — they're separate routes/pages,
// not siblings sharing in-memory state (HU-2.7).
const key = (tripId) => `tp_poi_filters:${tripId}`;
const EMPTY = { categories: [], city: '' };

function read(tripId) {
  try {
    const raw = sessionStorage.getItem(key(tripId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      city: typeof parsed.city === 'string' ? parsed.city : '',
    };
  } catch {
    return EMPTY;
  }
}

function write(tripId, filters) {
  try {
    sessionStorage.setItem(key(tripId), JSON.stringify(filters));
  } catch {
    /* private mode / storage disabled — filter just won't persist across tabs */
  }
}

export function usePoiFilters(tripId) {
  const [filters, setFiltersState] = useState(() => read(tripId));

  const apply = useCallback(
    (updater) => {
      setFiltersState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        write(tripId, next);
        return next;
      });
    },
    [tripId]
  );

  const toggleCategory = useCallback(
    (categoryId) =>
      apply((prev) => ({
        ...prev,
        categories: prev.categories.includes(categoryId)
          ? prev.categories.filter((c) => c !== categoryId)
          : [...prev.categories, categoryId],
      })),
    [apply]
  );

  const setCity = useCallback((city) => apply((prev) => ({ ...prev, city })), [apply]);
  const clear = useCallback(() => apply(EMPTY), [apply]);

  const isActive = filters.categories.length > 0 || !!filters.city;

  return { filters, toggleCategory, setCity, clear, isActive };
}
