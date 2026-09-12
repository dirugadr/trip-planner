import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { getTrip } from '../services/trips.js';
import { listBudgetCategories, listPaymentMethods, listExpenses } from '../services/budget.js';
import { listPois } from '../services/pois.js';
import { listAccommodations, createAccommodation, updateAccommodation, deleteAccommodation } from '../services/accommodations.js';
import { formatDateTime, formatMoney } from '../utils/format.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Modal from '../components/Modal.jsx';
import AccommodationForm from '../components/AccommodationForm.jsx';
import { safeUrl } from '../utils/safeUrl.js';

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
        listPois(id),
      ]).then(([accommodations, categories, paymentMethods, expenses, trip, pois]) => ({
        accommodations,
        categories,
        paymentMethods,
        expenses,
        trip,
        pois,
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

  const { accommodations, categories, paymentMethods, expenses, trip, pois } = data;
  const currency = trip.currency_code || 'USD';
  const expenseByAcc = new Map(expenses.filter((e) => e.accommodation_id).map((e) => [e.accommodation_id, e]));
  const poiByAcc = new Map(pois.filter((p) => p.accommodation_id).map((p) => [p.accommodation_id, p]));

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
        ? `¿Eliminar "${a.name}"? También se borrará el gasto vinculado (${formatMoney(linked.amount, linked.currency_code)}).`
        : `¿Eliminar "${a.name}"?`,
    });
    if (!ok) return;
    run(() => deleteAccommodation(a.id));
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      <div className="row-between mb-4">
        <h1 className="text-[22px] font-bold">Alojamientos</h1>
        <button className="btn" onClick={() => setModal({})}>
          <span className="msi text-[16px]">add</span>Nuevo alojamiento
        </button>
      </div>

      {actionError && <ErrorMessage error={actionError} />}
      <div className="muted mb-3">{trip.name}</div>

      {accommodations.length === 0 ? (
        <div className="empty-state">Todavía no cargaste alojamientos.</div>
      ) : (
        <div className="space-y-3">
          {accommodations.map((a) => {
            const linked = expenseByAcc.get(a.id);
            const poi = poiByAcc.get(a.id);
            return (
              <div key={a.id} className="bg-surface rounded-2xl shadow-sm border border-outline-variant/20 overflow-hidden flex">
                {poi?.photo_url ? (
                  <img className="w-28 h-auto object-cover shrink-0" src={poi.photo_url} alt={a.name} />
                ) : (
                  <div className="w-28 shrink-0 bg-surface-container-low flex items-center justify-center">
                    <span className="msi text-[32px] text-on-surface-variant/50">hotel</span>
                  </div>
                )}
                <div className="p-4 flex-1 min-w-0">
                  <div className="row-between">
                    <div className="font-semibold text-[15px] truncate">
                      {a.name} <span className="tag">{a.city}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {linked && <span className="text-[13px] font-semibold">{formatMoney(linked.amount, linked.currency_code)}</span>}
                      <button className="btn-icon msi text-[16px] text-on-surface-variant" onClick={() => setModal({ accommodation: a })} aria-label="Editar">
                        edit
                      </button>
                      <button className="btn-icon msi text-[16px] text-error" onClick={() => handleDelete(a)} aria-label="Eliminar">
                        delete
                      </button>
                    </div>
                  </div>
                  <div className="text-[12px] text-on-surface-variant flex items-center gap-1 mt-1">
                    <span className="msi text-[14px]">location_on</span>
                    {a.address}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-[12px] text-on-surface-variant flex-wrap">
                    <span className="flex items-center gap-1">
                      <span className="msi text-[14px]">login</span>
                      {formatDateTime(a.check_in)}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="msi text-[14px]">logout</span>
                      {formatDateTime(a.check_out)}
                    </span>
                    {a.phone && <span>📞 {a.phone}</span>}
                    {a.email && <span>✉️ {a.email}</span>}
                    {safeUrl(a.booking_url) && (
                      <a href={safeUrl(a.booking_url)} target="_blank" rel="noreferrer" className="text-secondary font-medium">
                        Ver reserva
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-[11px] text-secondary font-medium">
                    <span className="msi text-[13px]">check_circle</span>Actividades de check-in/out generadas
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmNode}

      {modal && (
        <Modal title={modal.accommodation ? 'Editar alojamiento' : 'Nuevo alojamiento'} onClose={() => setModal(null)}>
          <AccommodationForm
            initial={modal.accommodation}
            linkedExpense={modal.accommodation ? expenseByAcc.get(modal.accommodation.id) : null}
            linkedPoi={modal.accommodation ? poiByAcc.get(modal.accommodation.id) : null}
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
