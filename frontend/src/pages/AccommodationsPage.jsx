import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { getTrip } from '../services/trips.js';
import { listBudgetCategories, listPaymentMethods, listExpenses } from '../services/budget.js';
import {
  listAccommodations,
  createAccommodation,
  updateAccommodation,
  deleteAccommodation,
} from '../services/accommodations.js';
import { formatDateTime, formatMoney } from '../utils/format.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Modal from '../components/Modal.jsx';
import AccommodationForm from '../components/AccommodationForm.jsx';

export default function AccommodationsPage() {
  const { id } = useParams();

  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([
        listAccommodations(id),
        listBudgetCategories(id),
        listPaymentMethods(),
        listExpenses(id),
        getTrip(id),
      ]).then(([accommodations, categories, paymentMethods, expenses, trip]) => ({
        accommodations,
        categories,
        paymentMethods,
        expenses,
        trip,
      })),
    [id]
  );

  const [modal, setModal] = useState(null); // { accommodation? }
  const [actionError, setActionError] = useState(null);
  const [confirmNode, confirm] = useConfirm();

  const run = async (fn) => {
    setActionError(null);
    try {
      await fn();
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} onRetry={reload} />;

  const { accommodations, categories, paymentMethods, expenses, trip } = data;
  const currency = trip.currency_code || 'USD';
  const expenseByAcc = new Map(
    expenses.filter((e) => e.accommodation_id).map((e) => [e.accommodation_id, e])
  );

  const handleSubmit = (payload) =>
    run(async () => {
      if (modal.accommodation) {
        await updateAccommodation(modal.accommodation.id, payload);
      } else {
        await createAccommodation({ trip_id: id, ...payload });
      }
      setModal(null);
    });

  const handleDelete = async (a) => {
    const linked = expenseByAcc.get(a.id);
    const ok = await confirm({
      title: 'Eliminar alojamiento',
      message: linked
        ? `¿Eliminar "${a.name}"? También se borrará el gasto vinculado (${formatMoney(
            linked.amount,
            linked.currency_code
          )}).`
        : `¿Eliminar "${a.name}"?`,
    });
    if (!ok) return;
    run(() => deleteAccommodation(a.id));
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/trips/${id}`} className="btn-link">
          ← Volver al viaje
        </Link>
      </div>

      {actionError && <ErrorMessage error={actionError} />}

      <div className="row-between" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.2rem' }}>Alojamientos</h1>
          <div className="muted">{trip.name}</div>
        </div>
        <button className="btn" onClick={() => setModal({})}>
          + Alojamiento
        </button>
      </div>

      {accommodations.length === 0 ? (
        <div className="empty-state">Todavía no cargaste alojamientos.</div>
      ) : (
        accommodations.map((a) => {
          const linked = expenseByAcc.get(a.id);
          return (
            <div className="card" key={a.id}>
              <div className="row-between">
                <div>
                  <h3 style={{ marginBottom: '0.15rem' }}>
                    {a.name} <span className="tag">{a.city}</span>
                  </h3>
                  <div className="muted">
                    {formatDateTime(a.check_in)} → {formatDateTime(a.check_out)}
                  </div>
                  <div className="muted">{a.address}</div>
                  <div className="muted stack-sm">
                    {a.phone && <span>📞 {a.phone}</span>}
                    {a.email && <span>✉️ {a.email}</span>}
                    {a.booking_url && (
                      <span>
                        <a href={a.booking_url} target="_blank" rel="noreferrer">
                          reserva
                        </a>
                      </span>
                    )}
                  </div>
                  {linked && (
                    <div style={{ marginTop: '0.35rem' }}>
                      <span className="tag">Pagado {formatMoney(linked.amount, linked.currency_code)}</span>
                    </div>
                  )}
                </div>
                <div className="activity-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setModal({ accommodation: a })}
                  >
                    Editar
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a)}>
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {confirmNode}

      {modal && (
        <Modal
          title={modal.accommodation ? 'Editar alojamiento' : 'Nuevo alojamiento'}
          onClose={() => setModal(null)}
        >
          <AccommodationForm
            initial={modal.accommodation}
            linkedExpense={modal.accommodation ? expenseByAcc.get(modal.accommodation.id) : null}
            categories={categories}
            paymentMethods={paymentMethods}
            currency={currency}
            onSubmit={handleSubmit}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
