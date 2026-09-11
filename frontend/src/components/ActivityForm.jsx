import { useState } from 'react';

const empty = {
  title: '',
  description: '',
  start_time: '',
  duration_minutes: '',
  url: '',
  tentative: false,
};

export default function ActivityForm({ dayId, initial, onSubmit, onCancel, submitLabel = 'Guardar' }) {
  const [form, setForm] = useState({ ...empty, ...pickFields(initial) });
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setChecked = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setWarning(null);

    if (!form.title.trim()) {
      setError('El título es obligatorio.');
      return;
    }

    const payload = {
      day_id: dayId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      start_time: form.start_time || null,
      duration_minutes: form.duration_minutes === '' ? null : Number(form.duration_minutes),
      url: form.url.trim() || null,
      tentative: form.tentative ? 1 : 0,
    };

    setSaving(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      if (err.warning) {
        setWarning(err.message);
      } else {
        setError(err.message);
      }
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      {warning && <div className="alert alert-warning">{warning}</div>}

      <div className="field">
        <label htmlFor="af-title">Título *</label>
        <input id="af-title" value={form.title} onChange={set('title')} placeholder="Visita al templo Senso-ji" />
      </div>

      <div className="field">
        <label htmlFor="af-desc">Descripción</label>
        <textarea id="af-desc" rows={2} value={form.description} onChange={set('description')} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="af-time">Hora de inicio</label>
          <input id="af-time" type="time" value={form.start_time} onChange={set('start_time')} />
        </div>
        <div className="field">
          <label htmlFor="af-dur">Duración (min)</label>
          <input
            id="af-dur"
            type="number"
            min="0"
            step="5"
            value={form.duration_minutes}
            onChange={set('duration_minutes')}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="af-url">Enlace</label>
        <input id="af-url" type="url" value={form.url} onChange={set('url')} placeholder="https://…" />
      </div>

      <label className="checkbox-field">
        <input type="checkbox" checked={form.tentative} onChange={setChecked('tentative')} />
        <span>Tentativa — plan sin confirmar (no cuenta para los conflictos de horario)</span>
      </label>

      <div className="row-between" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function pickFields(activity) {
  if (!activity) return {};
  return {
    title: activity.title ?? '',
    description: activity.description ?? '',
    start_time: activity.start_time ?? '',
    duration_minutes: activity.duration_minutes ?? '',
    url: activity.url ?? '',
    tentative: !!activity.tentative,
  };
}
