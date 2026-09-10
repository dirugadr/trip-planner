import { useParams, Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { getTrip } from '../services/trips.js';
import { listPois } from '../services/pois.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import TripMap from '../components/TripMap.jsx';

export default function MapPage() {
  const { id } = useParams();

  const { data, loading, error, reload } = useAsync(
    () => Promise.all([getTrip(id), listPois(id)]).then(([trip, pois]) => ({ trip, pois })),
    [id]
  );

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} onRetry={reload} />;

  const { trip, pois } = data;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/trips/${id}`} className="btn-link">
          ← Volver al viaje
        </Link>
      </div>

      <div className="row-between" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.2rem' }}>Mapa</h1>
          <div className="muted">{trip.name}</div>
        </div>
        <Link className="btn btn-secondary btn-sm" to={`/trips/${id}/lugares`}>
          Lista de lugares
        </Link>
      </div>

      {pois.length === 0 ? (
        <div className="empty-state">
          Este viaje todavía no tiene lugares.{' '}
          <Link to={`/trips/${id}/lugares`}>Agregá el primero</Link> para verlo en el mapa.
        </div>
      ) : (
        <TripMap pois={pois} />
      )}
    </div>
  );
}
