import { useState } from 'react';

const CURRENCIES = ['USD', 'EUR', 'ARS', 'GBP', 'JPY', 'BRL', 'CLP', 'MXN'];

const empty = {
  name: '',
  description: '',
  start_date: '',
  end_date: '',
  currency_code: 'USD',
  total_budget: '',
};

export default function TripForm({ initial, onSubmit, onCancel, submitLabel = 'Guardar' }) {
  const [form, setForm] = useState({ ...empty, ...pickFields(initial) });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim() || !form.start_date || !form.end_date) {
      setError('Nombre, fecha de inicio y fecha de fin son obligatorios.');
      return;
    }
    if (new Date(form.end_date) <= new Date(form.start_date)) {
      setError('La fecha de fin debe ser posterior a la de inicio.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date,
      currency_code: form.currency_code,
      total_budget: form.total_budget === '' ? null : Number(form.total_budget),
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
        <label htmlFor="tf-name">Nombre *</label>
        <input id="tf-name" value={form.name} onChange={set('name')} placeholder="Viaje a Japón" />
      </div>

      <div className="field">
        <label htmlFor="tf-desc">Descripción</label>
        <textarea id="tf-desc" rows={2} value={form.description} onChange={set('description')} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="tf-start">Inicio *</label>
          <input id="tf-start" type="date" value={form.start_date} onChange={set('start_date')} />
        </div>
        <div className="field">
          <label htmlFor="tf-end">Fin *</label>
          <input id="tf-end" type="date" value={form.end_date} onChange={set('end_date')} />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="tf-currency">Moneda</label>
          <select id="tf-currency" value={form.currency_code} onChange={set('currency_code')}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tf-budget">Presupuesto total</label>
          <input
            id="tf-budget"
            type="number"
            min="0"
            step="0.01"
            value={form.total_budget}
            onChange={set('total_budget')}
          />
        </div>
      </div>

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

function pickFields(trip) {
  if (!trip) return {};
  return {
    name: trip.name ?? '',
    description: trip.description ?? '',
    start_date: (trip.start_date ?? '').slice(0, 10),
    end_date: (trip.end_date ?? '').slice(0, 10),
    currency_code: trip.currency_code ?? 'USD',
    total_budget: trip.total_budget ?? '',
  };
}
