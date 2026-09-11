import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { getTrip } from '../services/trips.js';
import {
  listPois,
  listPoiCategories,
  createPoi,
  updatePoi,
  deletePoi,
} from '../services/pois.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Modal from '../components/Modal.jsx';
import PoiForm from '../components/PoiForm.jsx';
import TripTabs from '../components/TripTabs.jsx';
import PoiFilterBar from '../components/PoiFilterBar.jsx';
import { categoryColor, categoryEmoji } from '../utils/poiCategories.js';
import { safeUrl } from '../utils/safeUrl.js';
import { formatDuration } from '../utils/format.js';
import { applyPoiFilters, citiesOf } from '../utils/poiFilters.js';
import { usePoiFilters } from '../hooks/usePoiFilters.js';

export default function PoisPage() {
  const { id } = useParams();

  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([listPois(id), listPoiCategories(), getTrip(id)]).then(
        ([pois, categories, trip]) => ({ pois, categories, trip })
      ),
    [id]
  );

  const [modal, setModal] = useState(null); // { poi? }
  const [actionError, setActionError] = useState(null);
  const [confirmNode, confirm] = useConfirm();
  const { filters, toggleCategory, setCity, clear, isActive } = usePoiFilters(id);

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

  const { pois, categories, trip } = data;
  const cities = citiesOf(pois);
  const filteredPois = applyPoiFilters(pois, filters);

  const handleSubmit = (payload) =>
    run(async () => {
      if (modal.poi) await updatePoi(modal.poi.id, payload);
      else await createPoi(id, payload);
      setModal(null);
    });

  const handleDelete = async (p) => {
    const ok = await confirm({
      title: 'Eliminar lugar',
      message: `¿Eliminar "${p.name}"?`,
    });
    if (!ok) return;
    run(() => deletePoi(p.id));
  };

  return (
    <div>
      <TripTabs tripId={id} />

      {actionError && <ErrorMessage error={actionError} />}

      <div className="row-between" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.2rem' }}>Lugares</h1>
          <div className="muted">{trip.name}</div>
        </div>
        <button className="btn" onClick={() => setModal({})}>
          + Lugar
        </button>
      </div>

      {pois.length > 0 && (
        <PoiFilterBar
          categories={categories}
          cities={cities}
          filters={filters}
          onToggleCategory={toggleCategory}
          onSetCity={setCity}
          onClear={clear}
          isActive={isActive}
        />
      )}

      {pois.length === 0 ? (
        <div className="empty-state">Todavía no guardaste lugares.</div>
      ) : filteredPois.length === 0 ? (
        <div className="empty-state">
          Ningún lugar coincide con el filtro. <button className="btn-link" onClick={clear}>Limpiar filtros</button>
        </div>
      ) : (
        filteredPois.map((p) => (
          <div className="card" key={p.id}>
            <div className="row-between">
              <div>
                <h3 style={{ marginBottom: '0.15rem' }}>
                  {p.accommodation_id && '🏨 '}
                  {p.name}{' '}
                  <span className="tag" style={{ color: categoryColor(p) }}>
                    {categoryEmoji(p)} {p.category_name}
                  </span>
                </h3>
                {p.accommodation_id && (
                  <div className="muted">Generado por el alojamiento</div>
                )}
                {p.address && <div className="muted">📍 {p.address}</div>}
                <div className="muted">
                  {Number(p.latitude).toFixed(5)}, {Number(p.longitude).toFixed(5)}
                </div>
                {p.estimated_duration_minutes != null && (
                  <div className="muted">⏱️ ~{formatDuration(p.estimated_duration_minutes)}</div>
                )}
                {p.notes && <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>{p.notes}</div>}
                {safeUrl(p.url) && (
                  <div className="muted">
                    <a href={safeUrl(p.url)} target="_blank" rel="noreferrer">
                      enlace
                    </a>
                  </div>
                )}
              </div>
              <div className="activity-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => setModal({ poi: p })}>
                  Editar
                </button>
                {!p.accommodation_id && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p)}>
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      {confirmNode}

      {modal && (
        <Modal title={modal.poi ? 'Editar lugar' : 'Nuevo lugar'} onClose={() => setModal(null)}>
          <PoiForm
            initial={modal.poi}
            categories={categories}
            onSubmit={handleSubmit}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
