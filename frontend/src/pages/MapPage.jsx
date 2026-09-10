import { useParams, Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { getTrip } from '../services/trips.js';
import { listPois } from '../services/pois.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import TripMap from '../components/TripMap.jsx';
import TripTabs from '../components/TripTabs.jsx';

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
      <TripTabs tripId={id} />

      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ marginBottom: '0.2rem' }}>Mapa</h1>
        <div className="muted">{trip.name}</div>
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
