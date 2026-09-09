import { useState } from 'react';

const CURRENCIES = ['USD', 'EUR', 'ARS', 'GBP', 'JPY', 'BRL', 'CLP', 'MXN'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpenseForm({
  initial,
  categories,
  paymentMethods,
  activityOptions,
  defaultCurrency,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState({
    amount: initial?.amount != null ? String(initial.amount) : '',
    currency_code: initial?.currency_code ?? defaultCurrency ?? 'USD',
    category_id: initial?.category_id ?? categories[0]?.id ?? '',
    payment_method_id: initial?.payment_method_id ?? '',
    activity_id: initial?.activity_id ?? '',
    expense_date: initial?.expense_date ?? today(),
    description: initial?.description ?? '',
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.amount || Number(form.amount) <= 0) {
      setError('El monto debe ser mayor a 0.');
      return;
    }
    if (!form.category_id) {
      setError('Elegí una categoría.');
      return;
    }
    if (!form.expense_date) {
      setError('Elegí una fecha.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        amount: Number(form.amount),
        currency_code: form.currency_code,
        category_id: form.category_id,
        payment_method_id: form.payment_method_id || null,
        activity_id: form.activity_id || null,
        expense_date: form.expense_date,
        description: form.description.trim() || null,
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
        <label htmlFor="ef-desc">Descripción</label>
        <input
          id="ef-desc"
          value={form.description}
          onChange={set('description')}
          placeholder="Cena en el centro"
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="ef-amount">Monto *</label>
          <input
            id="ef-amount"
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={set('amount')}
          />
        </div>
        <div className="field">
          <label htmlFor="ef-currency">Moneda</label>
          <select id="ef-currency" value={form.currency_code} onChange={set('currency_code')}>
            {[...new Set([form.currency_code, ...CURRENCIES])].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="ef-cat">Categoría *</label>
          <select id="ef-cat" value={form.category_id} onChange={set('category_id')}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ef-date">Fecha *</label>
          <input id="ef-date" type="date" value={form.expense_date} onChange={set('expense_date')} />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="ef-pm">Método de pago</label>
          <select id="ef-pm" value={form.payment_method_id} onChange={set('payment_method_id')}>
            <option value="">—</option>
            {paymentMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ef-act">Actividad</label>
          <select id="ef-act" value={form.activity_id} onChange={set('activity_id')}>
            <option value="">—</option>
            {activityOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
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
