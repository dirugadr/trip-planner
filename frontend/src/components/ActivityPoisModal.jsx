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
import { categoryColor, categoryEmoji } from '../utils/poiCategories.js';

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
            <p className="muted" style={{ marginTop: 0 }}>
              Todavía no asociaste lugares a esta actividad.
            </p>
          ) : (
            <ol className="assoc-poi-list">
              {data.associated.map((p, i) => (
                <li key={p.id}>
                  <span className="assoc-poi-main">
                    <span className="tag" style={{ color: categoryColor(p) }}>
                      {categoryEmoji(p)}
                    </span>{' '}
                    <span>
                      <strong>{p.name}</strong>
                      {p.address && <div className="muted">{p.address}</div>}
                    </span>
                  </span>
                  <span className="activity-actions">
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
                      ↑
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
                      ↓
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
            <div className="assoc-poi-add">
              <select
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
            <div className="assoc-poi-create">
              <h3 style={{ fontSize: '0.95rem' }}>Nuevo lugar</h3>
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
