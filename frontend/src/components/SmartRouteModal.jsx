import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Spinner from './Spinner.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import { getSmartRoute, applySmartRoute } from '../services/smartRoute.js';

export default function SmartRouteModal({ day, onClose, onApplied }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [summary, setSummary] = useState('');
  const [estimated, setEstimated] = useState(false);
  const [stops, setStops] = useState([]); // { activity_id, activity_title, poi_name, suggested_start_time, suggested_end_time, reason }
  const [actionError, setActionError] = useState(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getSmartRoute(day.id);
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
  }, [day.id]);

  const setTime = (i, field) => (e) =>
    setStops((s) => s.map((stop, j) => (j === i ? { ...stop, [field]: e.target.value } : stop)));

  const handleApply = async () => {
    setActionError(null);
    setApplying(true);
    try {
      await applySmartRoute(
        day.id,
        stops.map((s) => ({
          activity_id: s.activity_id,
          suggested_start_time: s.suggested_start_time,
          suggested_end_time: s.suggested_end_time,
        }))
      );
      onApplied();
      onClose();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal title="Sugerir recorrido" onClose={onClose}>
      {loading && (
        <div>
          <Spinner />
          <p className="muted" style={{ textAlign: 'center' }}>
            Pensando el mejor orden y horarios…
          </p>
        </div>
      )}

      {loadError && <ErrorMessage error={loadError} />}

      {!loading && !loadError && (
        <>
          <p style={{ marginTop: 0 }}>{summary}</p>
          {estimated && (
            <p className="muted">
              ⚠️ Algunos tiempos de caminata son estimados (línea recta): OSRM no
              pudo calcular la ruta real.
            </p>
          )}

          {actionError && <ErrorMessage error={actionError} />}

          <ol className="smart-route-list">
            {stops.map((s, i) => (
              <li key={s.activity_id}>
                <div className="smart-route-head">
                  <strong>{s.activity_title}</strong>
                  {s.poi_name && <span className="muted"> · 📍 {s.poi_name}</span>}
                </div>
                <div className="field-row" style={{ margin: '0.35rem 0' }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Desde</label>
                    <input type="time" value={s.suggested_start_time} onChange={setTime(i, 'suggested_start_time')} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Hasta</label>
                    <input type="time" value={s.suggested_end_time} onChange={setTime(i, 'suggested_end_time')} />
                  </div>
                </div>
                <div className="muted">{s.reason}</div>
              </li>
            ))}
          </ol>

          <div className="row-between" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={applying}>
              Descartar
            </button>
            <button className="btn" onClick={handleApply} disabled={applying}>
              {applying ? 'Aplicando…' : 'Aplicar'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
