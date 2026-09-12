import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { getTrip, updateTrip, deleteTrip } from '../services/trips.js';
import { updateDay } from '../services/days.js';
import {
  createActivity,
  updateActivity,
  deleteActivity,
  moveActivity,
} from '../services/activities.js';
import { formatDayHeading, formatDateRange, formatDuration, formatMoney } from '../utils/format.js';
import { categoryColor, categoryEmoji } from '../utils/poiCategories.js';
import { safeUrl } from '../utils/safeUrl.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Modal from '../components/Modal.jsx';
import TripForm from '../components/TripForm.jsx';
import DayForm from '../components/DayForm.jsx';
import ActivityForm from '../components/ActivityForm.jsx';
import ActivityPoisModal from '../components/ActivityPoisModal.jsx';
import SmartRouteModal from '../components/SmartRouteModal.jsx';
import TripTabs from '../components/TripTabs.jsx';

export default function TripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: trip, loading, error, reload } = useAsync(() => getTrip(id), [id]);

  const [editingTrip, setEditingTrip] = useState(false);
  const [dayModal, setDayModal] = useState(null); // day being edited
  const [activityModal, setActivityModal] = useState(null); // { dayId, activity? }
  const [poisModal, setPoisModal] = useState(null); // activity whose POIs are being managed
  const [smartRouteDay, setSmartRouteDay] = useState(null); // day for the smart-route suggestion
  const [actionError, setActionError] = useState(null);
  const [busyActivityId, setBusyActivityId] = useState(null);
  const [confirmNode, confirm] = useConfirm();
  const [visibleDayCity, setVisibleDayCity] = useState(null);
  const dayRefs = useRef(new Map());

  // Context sub-bar (visual only): tracks which day card is closest to the
  // top of the viewport and shows its accommodation city — data already
  // computed server-side (HU-8.4), just surfaced here as the day scrolls
  // into view.
  useEffect(() => {
    if (!trip?.days?.length) return undefined;
    const REFERENCE_LINE = 140; // px from the top of the viewport

    const updateVisibleDay = () => {
      const positions = [];
      dayRefs.current.forEach((el, dayId) => {
        positions.push({ dayId, top: el.getBoundingClientRect().top });
      });
      if (positions.length === 0) return;
      // The day-card that has scrolled past the reference line most recently
      // is "current"; before the first one reaches it, default to the first day.
      const passed = positions.filter((p) => p.top <= REFERENCE_LINE);
      const current =
        passed.length > 0
          ? passed.reduce((a, b) => (b.top > a.top ? b : a))
          : positions.reduce((a, b) => (b.top < a.top ? b : a));
      const day = trip.days.find((d) => d.id === current.dayId);
      setVisibleDayCity(day?.cities?.[0] || null);
    };

    updateVisibleDay();
    window.addEventListener('scroll', updateVisibleDay, { passive: true });
    window.addEventListener('resize', updateVisibleDay);
    return () => {
      window.removeEventListener('scroll', updateVisibleDay);
      window.removeEventListener('resize', updateVisibleDay);
    };
  }, [trip]);

  const run = async (fn) => {
    setActionError(null);
    try {
      await fn();
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleUpdateTrip = async (payload) => {
    await updateTrip(id, payload);
    setEditingTrip(false);
    reload();
  };

  const handleDeleteTrip = async () => {
    const ok = await confirm({
      title: 'Eliminar viaje',
      message: `¿Eliminar el viaje "${trip.name}"? Esta acción no se puede deshacer.`,
    });
    if (!ok) return;
    try {
      await deleteTrip(id);
      navigate('/');
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleUpdateDay = async (payload) => {
    await updateDay(dayModal.id, payload);
    setDayModal(null);
    reload();
  };

  const handleActivitySubmit = async (payload) => {
    if (activityModal.activity) {
      await updateActivity(activityModal.activity.id, payload);
    } else {
      await createActivity(payload);
    }
    setActivityModal(null);
    reload();
  };

  const handleDeleteActivity = async (activity) => {
    const ok = await confirm({
      title: 'Eliminar actividad',
      message: `¿Eliminar la actividad "${activity.title}"?`,
    });
    if (!ok) return;
    run(() => deleteActivity(activity.id));
  };

  const handleToggleComplete = (activity) =>
    run(async () => {
      setBusyActivityId(activity.id);
      try {
        await updateActivity(activity.id, { completed: activity.completed ? 0 : 1 });
      } finally {
        setBusyActivityId(null);
      }
    });

  const handleMove = (activity, direction) =>
    run(async () => {
      setBusyActivityId(activity.id);
      try {
        await moveActivity(activity.id, direction);
      } finally {
        setBusyActivityId(null);
      }
    });

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} onRetry={reload} />;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/" className="btn-link">
          ← Volver a mis viajes
        </Link>
      </div>

      <TripTabs tripId={id} />

      {actionError && <ErrorMessage error={actionError} />}

      <div className="card">
        <div className="row-between">
          <div>
            <h1 style={{ marginBottom: '0.2rem' }}>{trip.name}</h1>
            <div className="muted">{formatDateRange(trip.start_date, trip.end_date)}</div>
            {trip.description && <p style={{ marginBottom: 0 }}>{trip.description}</p>}
          </div>
          <div className="activity-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setEditingTrip(true)}>
              Editar
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleDeleteTrip}>
              Eliminar
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <span className="tag">{trip.days.length} días</span>
          <span className="tag">{trip.stats.activities} actividades</span>
          {trip.total_budget != null && (
            <span className="tag">
              Presupuesto {formatMoney(trip.total_budget, trip.currency_code)}
            </span>
          )}
          {trip.stats.totalExpenses > 0 && (
            <span className="tag">
              Gastos {formatMoney(trip.stats.totalExpenses, trip.currency_code)}
            </span>
          )}
        </div>
      </div>

      <h2 style={{ margin: '1.5rem 0 0.75rem' }}>Itinerario</h2>
      {visibleDayCity && (
        <div className="context-subbar">
          <span className="context-subbar-icon">📍</span>
          {visibleDayCity}
        </div>
      )}
      {trip.days.map((day) => (
        <div
          className="card day-card"
          key={day.id}
          data-day-id={day.id}
          ref={(el) => {
            if (el) dayRefs.current.set(day.id, el);
            else dayRefs.current.delete(day.id);
          }}
        >
          <div className="row-between">
            <h3>
              {formatDayHeading(day.date)}
              {day.title && <span> — {day.title}</span>}
              {day.totalDuration > 0 && (
                <span className="muted" style={{ fontWeight: 400 }}>
                  {' '}
                  · {formatDuration(day.totalDuration)}
                </span>
              )}
            </h3>
            <div className="activity-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setDayModal(day)}>
                Editar día
              </button>
              {day.activities.filter((a) => a.pois?.length > 0).length >= 2 && (
                <>
                  <button className="btn btn-ai btn-sm" onClick={() => setSmartRouteDay(day)}>
                    ✨ Sugerir recorrido
                  </button>
                  <Link className="btn btn-secondary btn-sm" to={`/trips/${id}/days/${day.id}/route`}>
                    🗺️ Ver recorrido en el mapa
                  </Link>
                </>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setActivityModal({ dayId: day.id })}
              >
                + Actividad
              </button>
            </div>
          </div>

          {day.cities?.length > 0 && (
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>
              📍 {day.cities.join(' → ')}
            </p>
          )}

          {day.notes && (
            <p className="muted" style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>
              {day.notes}
            </p>
          )}

          {day.activities.length === 0 ? (
            <p className="muted" style={{ margin: '0.5rem 0 0' }}>
              Sin actividades.
            </p>
          ) : (
            <div style={{ marginTop: '0.5rem' }}>
              {day.activities.map((activity, idx) => (
                <div
                  className={`activity${activity.completed ? ' activity-done' : ''}${
                    activity.tentative ? ' activity-tentative' : ''
                  }`}
                  key={activity.id}
                >
                  <input
                    type="checkbox"
                    className="activity-check"
                    checked={!!activity.completed}
                    disabled={busyActivityId === activity.id}
                    onChange={() => handleToggleComplete(activity)}
                    aria-label={activity.completed ? 'Marcar como pendiente' : 'Marcar como hecha'}
                  />
                  <div className="activity-time">{activity.start_time || '—'}</div>
                  <div className="activity-body">
                    <div className="activity-title">
                      {activity.accommodation_id && '🏨 '}
                      {activity.title}
                      <span
                        className={`activity-status ${
                          activity.tentative ? 'activity-status-tentative' : 'activity-status-confirmed'
                        }`}
                      >
                        {activity.tentative ? 'Tentativa' : 'Confirmada'}
                      </span>
                    </div>
                    {activity.accommodation_id && (
                      <div className="muted">Generada por el alojamiento</div>
                    )}
                    {activity.description && <div className="muted">{activity.description}</div>}
                    <div className="muted">
                      {activity.duration_minutes ? formatDuration(activity.duration_minutes) : ''}
                      {safeUrl(activity.url) && (
                        <>
                          {activity.duration_minutes ? ' · ' : ''}
                          <a href={safeUrl(activity.url)} target="_blank" rel="noreferrer">
                            enlace
                          </a>
                        </>
                      )}
                    </div>
                    {activity.pois?.length > 0 && (
                      <div className="activity-pois">
                        {activity.pois.map((p) => (
                          <span key={p.id} className="tag" style={{ color: categoryColor(p) }}>
                            {categoryEmoji(p)} {p.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="activity-actions">
                    <button
                      className="btn btn-secondary btn-sm btn-icon"
                      disabled={idx === 0 || busyActivityId === activity.id}
                      onClick={() => handleMove(activity, 'up')}
                      aria-label="Subir"
                      title="Subir"
                    >
                      ↑
                    </button>
                    <button
                      className="btn btn-secondary btn-sm btn-icon"
                      disabled={idx === day.activities.length - 1 || busyActivityId === activity.id}
                      onClick={() => handleMove(activity, 'down')}
                      aria-label="Bajar"
                      title="Bajar"
                    >
                      ↓
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setPoisModal(activity)}
                    >
                      Lugares{activity.pois?.length ? ` (${activity.pois.length})` : ''}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActivityModal({ dayId: day.id, activity })}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteActivity(activity)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {confirmNode}

      {editingTrip && (
        <Modal title="Editar viaje" onClose={() => setEditingTrip(false)}>
          <TripForm initial={trip} onSubmit={handleUpdateTrip} onCancel={() => setEditingTrip(false)} />
        </Modal>
      )}

      {dayModal && (
        <Modal
          title={`Editar día — ${formatDayHeading(dayModal.date)}`}
          onClose={() => setDayModal(null)}
        >
          <DayForm initial={dayModal} onSubmit={handleUpdateDay} onCancel={() => setDayModal(null)} />
        </Modal>
      )}

      {activityModal && (
        <Modal
          title={activityModal.activity ? 'Editar actividad' : 'Nueva actividad'}
          onClose={() => setActivityModal(null)}
        >
          <ActivityForm
            dayId={activityModal.dayId}
            initial={activityModal.activity}
            onSubmit={handleActivitySubmit}
            onCancel={() => setActivityModal(null)}
          />
        </Modal>
      )}

      {poisModal && (
        <ActivityPoisModal
          activity={poisModal}
          tripId={id}
          onChanged={reload}
          onClose={() => setPoisModal(null)}
        />
      )}

      {smartRouteDay && (
        <SmartRouteModal
          day={smartRouteDay}
          onApplied={reload}
          onClose={() => setSmartRouteDay(null)}
        />
      )}
    </div>
  );
}
