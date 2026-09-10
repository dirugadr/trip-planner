import { useEffect, useState } from 'react';
import { searchAddress } from '../utils/geocode.js';

/**
 * Debounced Nominatim address search shared by the POI and accommodation forms.
 * `enabled` gates the effect so we don't search until the user edits the field.
 */
export function useAddressSearch(query, enabled) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return undefined;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        setResults(await searchAddress(q, { signal: ctrl.signal }));
      } catch (err) {
        if (err.name !== 'AbortError') setError('No se pudo buscar la dirección. Probá de nuevo.');
      } finally {
        setSearching(false);
      }
    }, 700);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, enabled]);

  return { results, searching, error, clear: () => setResults([]) };
}
