import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Spinner from './Spinner.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import { discoverAreaRoute } from '../services/routeTemplates.js';
import { createPoi } from '../services/pois.js';
import { categoryMsi } from '../utils/poiCategories.js';
import { formatDuration } from '../utils/format.js';

/**
 * HU-2.6b: proposes a 4-6 stop walking route for the map's current visible
 * area, mixing already-saved POIs with new Overpass discoveries. Nothing is
 * persisted until the traveler confirms — discarding never creates a POI,
 * and only the discoveries still in the final list get created on confirm.
 */
export default function DiscoverRouteModal({ tripId, bounds, onClose, onConfirmed }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [summary, setSummary] = useState('');
  const [estimated, setEstimated] = useState(false);
  const [stops, setStops] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await discoverAreaRoute(tripId, bounds);
        if (!alive) return;
        setSummary(data.summary);
        setEstimated(data.has_estimated_walk_times);
        setStops(data.stops);
      } catch (err) {
        if (alive) setLoadError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tripId, bounds]);

  const removeStop = (candidateId) => setStops((prev) => prev.filter((s) => s.candidate_id !== candidateId));

  const totalMinutes = stops.reduce(
    (sum, s, i) => sum + s.estimated_duration_minutes + (i < stops.length - 1 ? s.walk_minutes_to_next || 0 : 0),
    0
  );

  const handleConfirm = async () => {
    setConfirmError(null);
    setConfirming(true);
    try {
      const realPois = [];
      for (const stop of stops) {
        if (stop.is_new) {
          const poi = await createPoi(tripId, {
            name: stop.name,
            category_id: stop.category_id,
            latitude: stop.latitude,
            longitude: stop.longitude,
          });
          realPois.push(poi);
        } else {
          realPois.push({
            id: stop.candidate_id.replace(/^saved:/, ''),
            name: stop.name,
            category_id: stop.category_id,
            latitude: stop.latitude,
            longitude: stop.longitude,
          });
        }
      }
      onConfirmed(realPois);
    } catch (err) {
      setConfirmError(err.message);
      setConfirming(false);
    }
  };

  return (
    <Modal title="Sugerir recorrido en esta zona" onClose={onClose}>
      {loading && (
        <div>
          <Spinner />
          <p className="muted text-center">Buscando lugares y pensando el mejor recorrido…</p>
        </div>
      )}

      {loadError && <ErrorMessage error={loadError} />}

      {!loading && !loadError && (
        <>
          <p className="mt-0">{summary}</p>
          {estimated && (
            <p className="muted">
              <span className="msi text-[14px] align-middle">warning</span> Algunos tiempos de caminata son
              estimados: OSRM no pudo calcular la ruta real.
            </p>
          )}

          {confirmError && <ErrorMessage error={confirmError} />}

          {stops.length === 0 ? (
            <div className="empty-state">Sacaste todas las paradas de la propuesta.</div>
          ) : (
            <ol className="list-none m-0 p-0 mt-2">
              {stops.map((s, i) => (
                <li key={s.candidate_id} className="py-3 border-t border-outline-variant/20 first:border-t-0 first:pt-0">
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-[12px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="msi text-[16px] text-tertiary">{categoryMsi({ category_icon: s.category_id })}</span>
                        <strong className="text-[14px]">{s.name}</strong>
                        {s.is_new && <span className="tag-category">Nuevo</span>}
                      </div>
                      <div className="muted mt-0.5">~{formatDuration(s.estimated_duration_minutes) || '0 min'} de visita</div>
                      {s.reason && <div className="muted mt-0.5">{s.reason}</div>}
                    </div>
                    <button
                      type="button"
                      className="btn-icon msi text-[16px] text-on-surface-variant/60"
                      onClick={() => removeStop(s.candidate_id)}
                      aria-label="Sacar parada"
                    >
                      close
                    </button>
                  </div>
                  {i < stops.length - 1 && s.walk_minutes_to_next != null && (
                    <div className="flex items-center gap-1.5 text-[12px] text-on-surface-variant mt-2 ml-8">
                      <span className="msi text-[14px]">directions_walk</span>
                      {s.walk_minutes_to_next} min a pie hacia la siguiente parada
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          <div className="flex items-center justify-between text-[12px] text-on-surface-variant bg-surface-container-low rounded-lg px-3 py-2 my-3">
            <span>Duración total estimada</span>
            <span className="font-semibold text-on-surface">{formatDuration(totalMinutes) || '0 min'}</span>
          </div>

          <div className="row-between justify-end">
            <button className="btn btn-secondary" onClick={onClose} disabled={confirming}>
              Descartar
            </button>
            <button className="btn" onClick={handleConfirm} disabled={confirming || stops.length === 0}>
              {confirming ? 'Creando lugares…' : 'Usar este recorrido'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
