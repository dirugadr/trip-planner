import { useParams, Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { getTrip } from '../services/trips.js';
import { getDayRouteView } from '../services/days.js';
import { formatDayHeading } from '../utils/format.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import DayRouteMap from '../components/DayRouteMap.jsx';

export default function DayRouteView() {
  const { id, dayId } = useParams();

  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([getTrip(id), getDayRouteView(dayId)]).then(([trip, routeView]) => ({
        trip,
        routeView,
      })),
    [id, dayId]
  );

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} onRetry={reload} />;

  const { trip, routeView } = data;
  const day = trip.days.find((d) => d.id === dayId);
  const { stops, segments, activities_without_poi_count: withoutPoiCount } = routeView;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/trips/${id}`} className="btn-link">
          ← Volver al itinerario
        </Link>
      </div>

      <h1 style={{ marginBottom: '0.2rem' }}>Recorrido del día</h1>
      <div className="muted" style={{ marginBottom: '1rem' }}>
        {day ? formatDayHeading(day.date) : trip.name}
        {day?.title && ` — ${day.title}`}
      </div>

      {withoutPoiCount > 0 && (
        <div className="alert alert-warning">
          {withoutPoiCount === 1
            ? '1 actividad no tiene lugar asociado y no aparece en el mapa.'
            : `${withoutPoiCount} actividades no tienen lugar asociado y no aparecen en el mapa.`}
        </div>
      )}

      {stops.length === 0 ? (
        <div className="empty-state">Este día no tiene paradas con lugar asociado para mostrar.</div>
      ) : (
        <DayRouteMap stops={stops} segments={segments} />
      )}
    </div>
  );
}
