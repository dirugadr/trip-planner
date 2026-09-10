import { useEffect, useRef, useState } from 'react';
import { searchAddress } from '../utils/geocode.js';

function initFrom(p) {
  return {
    name: p?.name ?? '',
    category_id: p?.category_id ?? '',
    address: p?.address ?? '',
    latitude: p?.latitude ?? null,
    longitude: p?.longitude ?? null,
    url: p?.url ?? '',
    notes: p?.notes ?? '',
  };
}

export default function PoiForm({ initial, categories, onSubmit, onCancel }) {
  const [form, setForm] = useState(initFrom(initial));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Address search
  const [query, setQuery] = useState(initial?.address ?? '');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [dirty, setDirty] = useState(false); // typed since last pick — location unresolved

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (!dirty) return;
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        setResults(await searchAddress(q, { signal: ctrl.signal }));
      } catch (err) {
        if (err.name !== 'AbortError') setSearchError('No se pudo buscar la dirección. Probá de nuevo.');
      } finally {
        setSearching(false);
      }
    }, 700);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, dirty]);

  const pick = (r) => {
    setForm((f) => ({ ...f, address: r.label, latitude: r.latitude, longitude: r.longitude }));
    setQuery(r.label);
    setResults([]);
    setDirty(false);
  };

  const resolved = form.latitude != null && form.longitude != null && !dirty;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) return setError('Falta el nombre.');
    if (!form.category_id) return setError('Elegí una categoría.');
    if (!resolved) return setError('Buscá una dirección y elegí un resultado de la lista.');

    const payload = {
      name: form.name.trim(),
      category_id: form.category_id,
      address: form.address,
      latitude: form.latitude,
      longitude: form.longitude,
      url: form.url.trim() || null,
      notes: form.notes.trim() || null,
    };

    setSaving(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="field">
        <label htmlFor="poi-name">Nombre *</label>
        <input
          id="poi-name"
          value={form.name}
          onChange={set('name')}
          placeholder="Templo Kiyomizu-dera"
        />
      </div>

      <div className="field">
        <label htmlFor="poi-cat">Categoría *</label>
        <select id="poi-cat" value={form.category_id} onChange={set('category_id')}>
          <option value="">Elegí una…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field poi-search">
        <label htmlFor="poi-addr">Dirección * (buscá y elegí un resultado)</label>
        <input
          id="poi-addr"
          value={query}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setDirty(true);
          }}
          placeholder="Escribí una dirección o lugar…"
        />
        {searching && <div className="muted poi-search-hint">Buscando…</div>}
        {searchError && <div className="muted poi-search-hint">{searchError}</div>}
        {!searching && dirty && query.trim().length >= 3 && results.length === 0 && !searchError && (
          <div className="muted poi-search-hint">Sin resultados. Probá con otra búsqueda.</div>
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
        {resolved && (
          <div className="muted poi-search-hint">
            📍 {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)} — ubicación resuelta
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="poi-url">Enlace</label>
        <input
          id="poi-url"
          type="url"
          value={form.url}
          onChange={set('url')}
          placeholder="https://…"
        />
      </div>

      <div className="field">
        <label htmlFor="poi-notes">Notas</label>
        <textarea id="poi-notes" rows={3} value={form.notes} onChange={set('notes')} />
      </div>

      <div className="row-between" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
