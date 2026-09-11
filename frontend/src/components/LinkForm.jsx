import { useState } from 'react';

function initFrom(l) {
  return {
    title: l?.title ?? '',
    url: l?.url ?? '',
    tags: l?.tags?.map((t) => t.name) ?? [],
  };
}

/** Tag chips with a text input: Enter/comma adds the typed value, suggestions
 * come from tags already used elsewhere in the trip (click to add). */
function TagInput({ value, onChange, suggestions }) {
  const [text, setText] = useState('');

  const add = (raw) => {
    const t = raw.trim();
    if (!t) return;
    if (value.some((v) => v.toLowerCase() === t.toLowerCase())) {
      setText('');
      return;
    }
    onChange([...value, t]);
    setText('');
  };
  const remove = (t) => onChange(value.filter((v) => v !== t));

  const matches = text.trim()
    ? suggestions
        .filter(
          (s) =>
            s.toLowerCase().includes(text.trim().toLowerCase()) &&
            !value.some((v) => v.toLowerCase() === s.toLowerCase())
        )
        .slice(0, 6)
    : [];

  return (
    <div className="link-tag-input">
      {value.length > 0 && (
        <div className="link-tag-chips">
          {value.map((t) => (
            <span className="link-tag-chip" key={t}>
              {t}
              <button type="button" onClick={() => remove(t)} aria-label={`Quitar tag ${t}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(text);
          }
        }}
        placeholder="Agregar tag y Enter…"
      />
      {matches.length > 0 && (
        <ul className="link-tag-suggestions">
          {matches.map((s) => (
            <li key={s}>
              <button type="button" onClick={() => add(s)}>
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function LinkForm({ initial, existingTags, onSubmit, onCancel }) {
  const [form, setForm] = useState(initFrom(initial));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) return setError('Falta el título.');
    if (!form.url.trim()) return setError('Falta el link.');

    const payload = {
      title: form.title.trim(),
      url: form.url.trim(),
      tags: form.tags,
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
        <label htmlFor="link-title">Título / nota *</label>
        <input
          id="link-title"
          value={form.title}
          onChange={set('title')}
          placeholder="Mejores ramen de Tokio, según Reddit"
        />
      </div>

      <div className="field">
        <label htmlFor="link-url">Link *</label>
        <input id="link-url" type="url" value={form.url} onChange={set('url')} placeholder="https://…" />
      </div>

      <div className="field">
        <label htmlFor="link-tags">Tags</label>
        <TagInput
          value={form.tags}
          onChange={(tags) => setForm((f) => ({ ...f, tags }))}
          suggestions={existingTags}
        />
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
