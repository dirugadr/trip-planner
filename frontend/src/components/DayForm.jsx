import { useState } from 'react';

export default function DayForm({ initial, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ title: title.trim() || null, notes: notes.trim() || null });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="field">
        <label htmlFor="df-title">Título del día</label>
        <input
          id="df-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Día de museos"
        />
      </div>

      <div className="field">
        <label htmlFor="df-notes">Notas</label>
        <textarea id="df-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
