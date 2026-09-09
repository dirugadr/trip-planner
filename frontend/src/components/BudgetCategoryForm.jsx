import { useState } from 'react';

export default function BudgetCategoryForm({ initial, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [allocated, setAllocated] = useState(
    initial?.allocated_budget != null ? String(initial.allocated_budget) : ''
  );
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (allocated !== '' && (Number.isNaN(Number(allocated)) || Number(allocated) < 0)) {
      setError('El monto asignado debe ser un número ≥ 0.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        allocated_budget: allocated === '' ? null : Number(allocated),
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="field">
        <label htmlFor="bcf-name">Nombre *</label>
        <input
          id="bcf-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alojamiento"
        />
      </div>

      <div className="field">
        <label htmlFor="bcf-alloc">Monto asignado</label>
        <input
          id="bcf-alloc"
          type="number"
          min="0"
          step="0.01"
          value={allocated}
          onChange={(e) => setAllocated(e.target.value)}
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
