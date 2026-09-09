import { useState } from 'react';
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
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Modal from '../components/Modal.jsx';
import TripForm from '../components/TripForm.jsx';
import DayForm from '../components/DayForm.jsx';
import ActivityForm from '../components/ActivityForm.jsx';

export default function TripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: trip, loading, error, reload } = useAsync(() => getTrip(id), [id]);

  const [editingTrip, setEditingTrip] = useState(false);
  const [dayModal, setDayModal] = useState(null); // day being edited
  const [activityModal, setActivityModal] = useState(null); // { dayId, activity? }
  const [actionError, setActionError] = useState(null);
  const [busyActivityId, setBusyActivityId] = useState(null);
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

      {actionError && <ErrorMessage error={actionError} />}

      <div className="card">
        <div className="row-between">
          <div>
            <h1 style={{ marginBottom: '0.2rem' }}>{trip.name}</h1>
            <div className="muted">{formatDateRange(trip.start_date, trip.end_date)}</div>
            {trip.description && <p style={{ marginBottom: 0 }}>{trip.description}</p>}
          </div>
          <div className="activity-actions">
            <Link className="btn btn-secondary btn-sm" to={`/trips/${id}/alojamientos`}>
              Alojamientos
            </Link>
            <Link className="btn btn-secondary btn-sm" to={`/trips/${id}/budget`}>
              Presupuesto
            </Link>
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

      {trip.days.map((day) => (
        <div className="card day-card" key={day.id}>
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
                  className={`activity${activity.completed ? ' activity-done' : ''}`}
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
                    <div className="activity-title">{activity.title}</div>
                    {activity.description && <div className="muted">{activity.description}</div>}
                    {activity.location_name && (
                      <div className="muted">📍 {activity.location_name}</div>
                    )}
                    <div className="muted">
                      {activity.duration_minutes ? formatDuration(activity.duration_minutes) : ''}
                      {activity.url && (
                        <>
                          {activity.duration_minutes ? ' · ' : ''}
                          <a href={activity.url} target="_blank" rel="noreferrer">
                            enlace
                          </a>
                        </>
                      )}
                    </div>
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
    </div>
  );
}
