import { useState } from 'react';
import Modal from './Modal.jsx';
import Spinner from './Spinner.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import PoiForm from './PoiForm.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { listPois, listPoiCategories } from '../services/pois.js';
import {
  listActivityPois,
  associatePoi,
  associateNewPoi,
  reorderActivityPois,
  dissociatePoi,
} from '../services/activityPois.js';
import { categoryMsi } from '../utils/poiCategories.js';

export default function ActivityPoisModal({ activity, tripId, onClose, onChanged }) {
  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([
        listActivityPois(activity.id),
        listPois(tripId),
        listPoiCategories(),
      ]).then(([associated, tripPois, categories]) => ({ associated, tripPois, categories })),
    [activity.id, tripId]
  );

  const [selected, setSelected] = useState('');
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setActionError(null);
    setBusy(true);
    try {
      await fn();
      await reload();
      onChanged?.();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Lugares — ${activity.title}`} onClose={onClose}>
      {loading && <Spinner />}
      {error && <ErrorMessage error={error} onRetry={reload} />}

      {data && (
        <>
          {actionError && <ErrorMessage error={actionError} />}

          {data.associated.length === 0 ? (
            <p className="muted mt-0">Todavía no asociaste lugares a esta actividad.</p>
          ) : (
            <ol className="list-none m-0 p-0 mb-4 space-y-2">
              {data.associated.map((p, i) => (
                <li key={p.id} className="flex items-start gap-3 py-2 border-t border-outline-variant/20 first:border-t-0 first:pt-0">
                  <span className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="msi text-[16px] text-tertiary mt-0.5">{categoryMsi(p)}</span>
                    <span className="min-w-0">
                      <strong className="text-[14px]">{p.name}</strong>
                      {p.address && <div className="muted truncate">{p.address}</div>}
                    </span>
                  </span>
                  <span className="flex gap-1.5 shrink-0">
                    <button
                      className="btn btn-secondary btn-sm btn-icon"
                      disabled={i === 0 || busy}
                      onClick={() =>
                        run(() =>
                          reorderActivityPois(
                            activity.id,
                            swap(data.associated.map((x) => x.id), i, i - 1)
                          )
                        )
                      }
                      aria-label="Subir"
                    >
                      <span className="msi text-[16px]">arrow_upward</span>
                    </button>
                    <button
                      className="btn btn-secondary btn-sm btn-icon"
                      disabled={i === data.associated.length - 1 || busy}
                      onClick={() =>
                        run(() =>
                          reorderActivityPois(
                            activity.id,
                            swap(data.associated.map((x) => x.id), i, i + 1)
                          )
                        )
                      }
                      aria-label="Bajar"
                    >
                      <span className="msi text-[16px]">arrow_downward</span>
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={busy}
                      onClick={() => run(() => dissociatePoi(activity.id, p.id))}
                    >
                      Quitar
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}

          {!creating && (
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <select
                className="flex-1 min-w-[12rem] border border-outline-variant/50 rounded-xl px-3 py-2 text-[14px] bg-surface text-on-surface"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={busy}
              >
                <option value="">Agregar un lugar guardado…</option>
                {data.tripPois
                  .filter((p) => !data.associated.some((a) => a.id === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.category_name}
                    </option>
                  ))}
              </select>
              <button
                className="btn btn-sm"
                disabled={!selected || busy}
                onClick={() =>
                  run(async () => {
                    await associatePoi(activity.id, selected);
                    setSelected('');
                  })
                }
              >
                Agregar
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => setCreating(true)}
              >
                + Crear lugar nuevo
              </button>
            </div>
          )}

          {creating && (
            <div className="border border-outline-variant/40 rounded-xl p-4 mt-2">
              <h3 className="text-[15px] font-semibold mt-0">Nuevo lugar</h3>
              <PoiForm
                categories={data.categories}
                onSubmit={async (payload) => {
                  await associateNewPoi(activity.id, payload);
                  setCreating(false);
                  await reload();
                  onChanged?.();
                }}
                onCancel={() => setCreating(false)}
              />
            </div>
          )}

          <div className="row-between" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Listo
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function swap(arr, i, j) {
  const copy = arr.slice();
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}
