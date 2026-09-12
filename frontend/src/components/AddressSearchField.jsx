import { useState } from 'react';
import { useAddressSearch } from '../hooks/useAddressSearch.js';

/**
 * Address input with a Nominatim autocomplete dropdown. On pick it calls
 * `onResolve({ address, latitude, longitude, city })`; while the user types it
 * calls `onInvalidate(text)` so the parent can drop stale coordinates.
 */
export default function AddressSearchField({
  id,
  label,
  initialAddress = '',
  disabled = false,
  onResolve,
  onInvalidate,
}) {
  const [query, setQuery] = useState(initialAddress);
  const [dirty, setDirty] = useState(false);
  const { results, searching, error, clear } = useAddressSearch(query, dirty && !disabled);

  const pick = (r) => {
    setQuery(r.label);
    setDirty(false);
    clear();
    onResolve({ address: r.label, latitude: r.latitude, longitude: r.longitude, city: r.city ?? null });
  };

  return (
    <div className="field relative">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={query}
        autoComplete="off"
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setDirty(true);
          onInvalidate(e.target.value);
        }}
        placeholder="Escribí una dirección o lugar…"
      />
      {searching && <div className="muted -mt-2 mb-2">Buscando…</div>}
      {error && <div className="muted -mt-2 mb-2">{error}</div>}
      {!searching && dirty && query.trim().length >= 3 && results.length === 0 && !error && (
        <div className="muted -mt-2 mb-2">Sin resultados. Probá con otra búsqueda.</div>
      )}
      {results.length > 0 && (
        <ul className="poi-results">
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" onClick={() => pick(r)}>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
