import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { getTrip, updateTrip, deleteTrip } from '../services/trips.js';
import { updateDay, getDayRouteView } from '../services/days.js';
import { listPois } from '../services/pois.js';
import { createActivity, updateActivity, deleteActivity, moveActivity } from '../services/activities.js';
import {
  formatDayHeading,
  formatShortDay,
  formatDateRange,
  formatDuration,
  formatEndTime,
  formatMoney,
} from '../utils/format.js';
import { categoryMsi } from '../utils/poiCategories.js';
import { fileIcon } from '../utils/fileTypes.js';
import { safeUrl } from '../utils/safeUrl.js';
import { findScheduleConflicts } from '../utils/scheduleConflicts.js';
import { totalDistanceKm, walkMinutesForKm } from '../utils/geo.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Modal from '../components/Modal.jsx';
import TripForm from '../components/TripForm.jsx';
import DayForm from '../components/DayForm.jsx';
import ActivityForm from '../components/ActivityForm.jsx';
import ActivityPoisModal from '../components/ActivityPoisModal.jsx';
import SmartRouteModal from '../components/SmartRouteModal.jsx';
import DayRouteMap from '../components/DayRouteMap.jsx';
import TripMap from '../components/TripMap.jsx';

const ROUTE_MIN_STOPS = 2;

function hasRoute(day) {
  return day.activities.filter((a) => a.pois?.length > 0).length >= ROUTE_MIN_STOPS;
}

/** Right-hand map panel for the active day: the real walked route (HU-11.1)
 * once the day has enough stops with a POI, a loading placeholder while
 * that's being fetched, or — so the panel is never empty — every saved POI
 * of the trip (no route line, same as the general "Mapa & Lugares" view). */
function DayMapPanel({ day, routeView, pois }) {
  if (day && hasRoute(day)) {
    if (routeView === 'loading') {
      return (
        <div className="h-[70vh] min-h-[360px] rounded-2xl border border-outline-variant/20 bg-surface-container-low flex items-center justify-center">
          <Spinner />
        </div>
      );
    }
    if (routeView && routeView.stops?.length > 0) {
      return (
        <>
          {routeView.activities_without_poi_count > 0 && (
            <div className="alert alert-warning">
              {routeView.activities_without_poi_count === 1
                ? '1 actividad no tiene lugar asociado y no aparece en el mapa.'
                : `${routeView.activities_without_poi_count} actividades no tienen lugar asociado y no aparecen en el mapa.`}
            </div>
          )}
          <DayRouteMap stops={routeView.stops} segments={routeView.segments} />
        </>
      );
    }
  }
  return <TripMap pois={pois} />;
}

export default function TripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: trip, loading, error, reload } = useAsync(() => getTrip(id), [id]);
  const { data: pois } = useAsync(() => listPois(id), [id]);

  const [activeDayId, setActiveDayId] = useState(null);
  const [routeViews, setRouteViews] = useState({}); // dayId -> { stops, segments } | 'loading'
  const [editingTrip, setEditingTrip] = useState(false);
  const [dayModal, setDayModal] = useState(null);
  const [activityModal, setActivityModal] = useState(null); // { dayId, activity? }
  const [poisModal, setPoisModal] = useState(null);
  const [smartRouteDay, setSmartRouteDay] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyActivityId, setBusyActivityId] = useState(null);
  const [confirmNode, confirm] = useConfirm();

  // Default to the first day that hasn't happened yet, or the last day if the
  // whole trip is in the past.
  useEffect(() => {
    if (!trip?.days?.length || activeDayId) return;
    const today = new Date().toISOString().slice(0, 10);
    const next = trip.days.find((d) => d.date >= today);
    setActiveDayId((next || trip.days[trip.days.length - 1]).id);
  }, [trip, activeDayId]);

  const activeDay = trip?.days.find((d) => d.id === activeDayId) || null;

  // Lazy-load the real walked distance/route for the active day (reuses the
  // Épica 11 endpoint) — only for days worth it, and only once per day.
  useEffect(() => {
    if (!activeDay || !hasRoute(activeDay) || routeViews[activeDay.id]) return;
    setRouteViews((rv) => ({ ...rv, [activeDay.id]: 'loading' }));
    getDayRouteView(activeDay.id)
      .then((data) => setRouteViews((rv) => ({ ...rv, [activeDay.id]: data })))
      .catch(() => setRouteViews((rv) => ({ ...rv, [activeDay.id]: null })));
  }, [activeDay, routeViews]);

  const activeRouteView = activeDay ? routeViews[activeDay.id] : null;
  const conflicts = useMemo(() => (activeDay ? findScheduleConflicts(activeDay.activities) : []), [activeDay]);

  const walkAfter = useMemo(() => {
    // activity_id -> { km, minutes, toTitle } for the leg to the *next* stop.
    const map = new Map();
    if (!activeRouteView || activeRouteView === 'loading') return map;
    const { stops, segments } = activeRouteView;
    for (const seg of segments) {
      const from = stops.find((s) => s.sequence_number === seg.from);
      const to = stops.find((s) => s.sequence_number === seg.to);
      if (!from || !to) continue;
      const km = totalDistanceKm([seg]);
      map.set(from.activity_id, { km, minutes: walkMinutesForKm(km), toTitle: to.activity_name });
    }
    return map;
  }, [activeRouteView]);

  const dayTotals = useMemo(() => {
    if (!activeDay) return null;
    const spent = activeDay.activities.reduce((sum, a) => sum + (a.expense ? Number(a.expense.amount) : 0), 0);
    const hasPending = activeDay.activities.some((a) => a.expense && !a.expense.is_paid);
    const currency = activeDay.activities.find((a) => a.expense)?.expense.currency_code || trip?.currency_code;
    if (!activeRouteView || activeRouteView === 'loading') {
      return { spent, hasPending, currency, km: null, transitMin: null };
    }
    const km = totalDistanceKm(activeRouteView.segments);
    return { spent, hasPending, currency, km, transitMin: walkMinutesForKm(km) };
  }, [activeDay, activeRouteView, trip]);

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
    const ok = await confirm({ title: 'Eliminar actividad', message: `¿Eliminar la actividad "${activity.title}"?` });
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
    <div className="px-6 py-6">
      <Link to="/" className="btn-link inline-block mb-3">
        ← Volver a mis viajes
      </Link>

      <div className="row-between mb-4">
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold truncate">{trip.name}</h1>
          <div className="muted">{formatDateRange(trip.start_date, trip.end_date)}</div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="btn btn-secondary btn-sm" onClick={() => setEditingTrip(true)}>
            Editar viaje
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleDeleteTrip}>
            Eliminar
          </button>
        </div>
      </div>

      {actionError && <ErrorMessage error={actionError} />}

      {/* Day pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-5 -mx-1 px-1">
        {trip.days.map((day) => {
          const active = day.id === activeDayId;
          const rv = routeViews[day.id];
          const km = rv && rv !== 'loading' ? totalDistanceKm(rv.segments) : null;
          return (
            <button
              key={day.id}
              onClick={() => setActiveDayId(day.id)}
              className={`flex flex-col text-left px-3 py-1.5 rounded-xl min-w-[130px] shrink-0 transition-colors ${
                active ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface'
              }`}
            >
              <span className={`text-[11px] ${active ? 'text-white/70' : 'text-on-surface-variant'}`}>
                Día {day.day_number} · {formatShortDay(day.date)}
              </span>
              <span className="text-[13px] font-semibold">
                {day.activities.length} activ.
                {km != null && ` · ${km.toFixed(1)} km`}
              </span>
            </button>
          );
        })}
      </div>

      {activeDay && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div>
            <div className="row-between mb-4">
              <div>
                <div className="text-[11px] font-semibold text-secondary uppercase tracking-wide">
                  Día {activeDay.day_number} · {formatDayHeading(activeDay.date)}
                </div>
                <h2 className="text-[22px] font-bold">{activeDay.title || 'Sin título'}</h2>
                {activeDay.cities?.length > 0 && (
                  <div className="muted flex items-center gap-1 mt-0.5">
                    <span className="msi text-[14px]">location_on</span>
                    {activeDay.cities.join(' → ')}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button className="btn btn-secondary btn-sm" onClick={() => setDayModal(activeDay)}>
                  <span className="msi text-[16px]">edit</span>Editar día
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setActivityModal({ dayId: activeDay.id })}>
                  <span className="msi text-[16px]">add</span>Nueva actividad
                </button>
                {hasRoute(activeDay) && (
                  <button className="btn btn-ai btn-sm" onClick={() => setSmartRouteDay(activeDay)}>
                    <span className="msi text-[16px]">auto_awesome</span>Sugerir recorrido
                  </button>
                )}
              </div>
            </div>
  
            {conflicts.length > 0 && (
              <div className="bg-error-container rounded-xl p-4 mb-5 flex items-start gap-3">
                <span className="msi text-error mt-0.5">warning</span>
                <div className="flex-1">
                  <div className="font-semibold text-[14px]">Conflicto de horario detectado</div>
                  <div className="text-[13px] text-on-surface-variant mt-0.5">
                    «{conflicts[0].a.title}» se superpone con «{conflicts[0].b.title}»
                    {conflicts.length > 1 && ` (+${conflicts.length - 1} más)`}.
                  </div>
                </div>
                <button
                  className="px-3 py-1.5 rounded-full bg-surface text-[13px] font-medium shrink-0"
                  onClick={() => {
                    const a = activeDay.activities.find((x) => x.id === conflicts[0].a.id);
                    if (a) setActivityModal({ dayId: activeDay.id, activity: a });
                  }}
                >
                  Ajustar manual
                </button>
              </div>
            )}
  
            {activeDay.activities.length === 0 ? (
              <div className="empty-state">Este día no tiene actividades todavía.</div>
            ) : (
              <div>
                {activeDay.activities.map((activity, idx) => {
                  const primaryPoi = activity.pois?.[0];
                  const walk = walkAfter.get(activity.id);
                  const isLast = idx === activeDay.activities.length - 1;
                  return (
                    <div className="flex gap-4" key={activity.id}>
                      <div className="flex flex-col items-center">
                        <button
                          className={`w-7 h-7 rounded-full text-[12px] font-bold flex items-center justify-center shrink-0 ${
                            activity.completed ? 'bg-surface-container-low text-on-surface-variant' : 'bg-primary text-on-primary'
                          }`}
                          onClick={() => handleToggleComplete(activity)}
                          disabled={busyActivityId === activity.id}
                          title={activity.completed ? 'Marcar como pendiente' : 'Marcar como hecha'}
                        >
                          {activity.completed ? <span className="msi text-[14px]">check</span> : idx + 1}
                        </button>
                        {!isLast && <div className="w-px flex-1 bg-outline-variant/50 my-1" />}
                      </div>
                      <div className="flex-1 pb-5 min-w-0">
                        <div
                          className={`bg-surface rounded-xl shadow-sm border overflow-hidden flex ${
                            conflicts.some((c) => c.a.id === activity.id || c.b.id === activity.id)
                              ? 'border-error/30'
                              : 'border-outline-variant/20'
                          } ${activity.completed ? 'opacity-60' : ''}`}
                        >
                          {primaryPoi?.photo_url ? (
                            <img className="w-28 h-28 object-cover shrink-0" src={primaryPoi.photo_url} alt="" />
                          ) : (
                            primaryPoi && (
                              <div className="w-28 h-28 shrink-0 bg-surface-container-low flex items-center justify-center">
                                <span className="msi text-[32px] text-on-surface-variant/50">{categoryMsi(primaryPoi)}</span>
                              </div>
                            )
                          )}
                          <div className="p-4 flex-1 min-w-0">
                          <div className="row-between items-start">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-[13px] font-semibold">
                                {activity.start_time || '—'}
                                {formatEndTime(activity.start_time, activity.duration_minutes) &&
                                  ` – ${formatEndTime(activity.start_time, activity.duration_minutes)}`}
                              </span>
                              {primaryPoi && (
                                <span className="tag-category">
                                  <span className="msi text-[12px]">{categoryMsi(primaryPoi)}</span>
                                  {primaryPoi.category_name}
                                </span>
                              )}
                              <span className="tag">{activity.tentative ? 'Tentativa' : 'Confirmada'}</span>
                            </div>
                            {activity.expense && (
                              <span className="text-[13px] font-semibold shrink-0">
                                {formatMoney(activity.expense.amount, activity.expense.currency_code)}{' '}
                                <span className={`text-[11px] font-normal ${activity.expense.is_paid ? 'text-on-surface-variant' : 'text-tertiary'}`}>
                                  · {activity.expense.is_paid ? 'Pagado' : 'Pendiente'}
                                </span>
                              </span>
                            )}
                          </div>
                          <div className={`font-semibold text-[15px] ${activity.completed ? 'line-through' : ''}`}>
                            {activity.accommodation_id && '🏨 '}
                            {activity.title}
                          </div>
                          {activity.accommodation_id && <div className="muted">Generada por el alojamiento</div>}
                          {activity.description && <div className="muted mt-0.5">{activity.description}</div>}
                          {primaryPoi && (
                            <div className="text-[13px] text-on-surface-variant flex items-center gap-1 mt-1">
                              <span className="msi text-[14px]">location_on</span>
                              {primaryPoi.address || primaryPoi.name}
                            </div>
                          )}
                          {safeUrl(activity.url) && (
                            <a
                              className="block text-[12px] text-secondary font-medium mt-1"
                              href={safeUrl(activity.url)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ver enlace
                            </a>
                          )}
                          {activity.documents?.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-2 text-[12px] text-secondary font-medium">
                              <span className="msi text-[14px]">{fileIcon(activity.documents[0].file_type)}</span>
                              {activity.documents[0].title}
                              {activity.documents.length > 1 && ` (+${activity.documents.length - 1})`}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 flex-wrap mt-3">
                            <button className="btn btn-secondary btn-sm" onClick={() => setPoisModal(activity)}>
                              Lugares{activity.pois?.length ? ` (${activity.pois.length})` : ''}
                            </button>
                            <button
                              className="btn-icon msi text-[16px] text-on-surface-variant"
                              disabled={idx === 0 || busyActivityId === activity.id}
                              onClick={() => handleMove(activity, 'up')}
                              aria-label="Subir"
                            >
                              arrow_upward
                            </button>
                            <button
                              className="btn-icon msi text-[16px] text-on-surface-variant"
                              disabled={isLast || busyActivityId === activity.id}
                              onClick={() => handleMove(activity, 'down')}
                              aria-label="Bajar"
                            >
                              arrow_downward
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setActivityModal({ dayId: activeDay.id, activity })}
                            >
                              Editar
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteActivity(activity)}>
                              Eliminar
                            </button>
                          </div>
                          </div>
                        </div>
                        {walk && (
                          <div className="flex items-center gap-1.5 text-[12px] text-on-surface-variant mt-2 ml-1">
                            <span className="msi text-[14px]">directions_walk</span>
                            {walk.minutes} min a pie hacia {walk.toTitle}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {dayTotals && (
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="bg-surface-container-low rounded-xl p-3 text-center">
                  <div className="text-[11px] text-on-surface-variant">Caminata total</div>
                  <div className="text-[15px] font-bold">{dayTotals.km != null ? `${dayTotals.km.toFixed(1)} km` : '—'}</div>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3 text-center">
                  <div className="text-[11px] text-on-surface-variant">Tiempo en tránsito</div>
                  <div className="text-[15px] font-bold">
                    {dayTotals.transitMin != null ? formatDuration(dayTotals.transitMin) : '—'}
                  </div>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3 text-center">
                  <div className="text-[11px] text-on-surface-variant">Gastado hoy</div>
                  <div className="text-[15px] font-bold">
                    {dayTotals.spent > 0 ? formatMoney(dayTotals.spent, dayTotals.currency) : '—'}
                    {dayTotals.hasPending && <span className="text-tertiary text-[11px] font-medium"> · Pendiente</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-20">
            <DayMapPanel day={activeDay} routeView={activeRouteView} pois={pois || []} />
          </div>
        </div>
      )}

      {confirmNode}

      {editingTrip && (
        <Modal title="Editar viaje" onClose={() => setEditingTrip(false)}>
          <TripForm initial={trip} onSubmit={handleUpdateTrip} onCancel={() => setEditingTrip(false)} />
        </Modal>
      )}

      {dayModal && (
        <Modal title={`Editar día — ${formatDayHeading(dayModal.date)}`} onClose={() => setDayModal(null)}>
          <DayForm initial={dayModal} onSubmit={handleUpdateDay} onCancel={() => setDayModal(null)} />
        </Modal>
      )}

      {activityModal && (
        <Modal title={activityModal.activity ? 'Editar actividad' : 'Nueva actividad'} onClose={() => setActivityModal(null)}>
          <ActivityForm
            dayId={activityModal.dayId}
            initial={activityModal.activity}
            onSubmit={handleActivitySubmit}
            onCancel={() => setActivityModal(null)}
          />
        </Modal>
      )}

      {poisModal && (
        <ActivityPoisModal activity={poisModal} tripId={id} onChanged={reload} onClose={() => setPoisModal(null)} />
      )}

      {smartRouteDay && <SmartRouteModal day={smartRouteDay} onApplied={reload} onClose={() => setSmartRouteDay(null)} />}
    </div>
  );
}
