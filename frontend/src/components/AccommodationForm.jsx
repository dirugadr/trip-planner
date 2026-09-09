import { useState } from 'react';
import { formatMoney } from '../utils/format.js';

function initFrom(a, existingExpense) {
  return {
    name: a?.name ?? '',
    check_in: a?.check_in ?? '',
    check_out: a?.check_out ?? '',
    address: a?.address ?? '',
    city: a?.city ?? '',
    phone: a?.phone ?? '',
    email: a?.email ?? '',
    booking_url: a?.booking_url ?? '',
    pay_amount: existingExpense?.amount != null ? String(existingExpense.amount) : '',
    pay_category_id: existingExpense?.category_id ?? '',
    pay_method_id: existingExpense?.payment_method_id ?? '',
  };
}

export default function AccommodationForm({
  initial,
  linkedExpense,
  categories,
  paymentMethods,
  currency,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState(initFrom(initial, linkedExpense));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    for (const [k, label] of [
      ['name', 'nombre'],
      ['check_in', 'fecha de entrada'],
      ['check_out', 'fecha de salida'],
      ['address', 'dirección'],
      ['city', 'ciudad'],
    ]) {
      if (!form[k].trim()) {
        setError(`Falta ${label}.`);
        return;
      }
    }
    if (form.check_out <= form.check_in) {
      setError('La salida debe ser posterior a la entrada.');
      return;
    }
    if (form.pay_amount && Number(form.pay_amount) > 0 && !form.pay_category_id) {
      setError('Elegí una categoría para el pago.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      check_in: form.check_in,
      check_out: form.check_out,
      address: form.address.trim(),
      city: form.city.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      booking_url: form.booking_url.trim() || null,
      payment: {
        amount: form.pay_amount === '' ? '' : Number(form.pay_amount),
        category_id: form.pay_category_id || null,
        payment_method_id: form.pay_method_id || null,
      },
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
        <label htmlFor="af-name">Nombre *</label>
        <input id="af-name" value={form.name} onChange={set('name')} placeholder="Ryokan Gion" />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="af-in">Entrada *</label>
          <input id="af-in" type="datetime-local" value={form.check_in} onChange={set('check_in')} />
        </div>
        <div className="field">
          <label htmlFor="af-out">Salida *</label>
          <input id="af-out" type="datetime-local" value={form.check_out} onChange={set('check_out')} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="af-addr">Dirección *</label>
        <input id="af-addr" value={form.address} onChange={set('address')} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="af-city">Ciudad *</label>
          <input id="af-city" value={form.city} onChange={set('city')} placeholder="Kioto" />
        </div>
        <div className="field">
          <label htmlFor="af-phone">Teléfono</label>
          <input id="af-phone" value={form.phone} onChange={set('phone')} />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="af-email">Email</label>
          <input id="af-email" type="email" value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="af-url">Link de la reserva</label>
          <input id="af-url" type="url" value={form.booking_url} onChange={set('booking_url')} placeholder="https://…" />
        </div>
      </div>

      <fieldset className="paybox">
        <legend>Pago (opcional)</legend>
        <div className="field-row">
          <div className="field">
            <label htmlFor="af-pay">Monto{currency ? ` (${currency})` : ''}</label>
            <input
              id="af-pay"
              type="number"
              min="0"
              step="0.01"
              value={form.pay_amount}
              onChange={set('pay_amount')}
            />
          </div>
          <div className="field">
            <label htmlFor="af-paycat">Categoría</label>
            <select id="af-paycat" value={form.pay_category_id} onChange={set('pay_category_id')}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="af-paypm">Método de pago</label>
          <select id="af-paypm" value={form.pay_method_id} onChange={set('pay_method_id')}>
            <option value="">—</option>
            {paymentMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        {categories.length === 0 && (
          <p className="muted" style={{ margin: 0 }}>
            Creá una categoría de presupuesto para poder registrar el pago.
          </p>
        )}
        {linkedExpense && (
          <p className="muted" style={{ margin: '0.4rem 0 0' }}>
            Gasto vinculado actual: {formatMoney(linkedExpense.amount, linkedExpense.currency_code)}.
            Dejá el monto vacío para borrarlo.
          </p>
        )}
      </fieldset>

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
