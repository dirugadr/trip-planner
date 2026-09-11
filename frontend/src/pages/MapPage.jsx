import { useParams, Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { getTrip } from '../services/trips.js';
import { listPois, listPoiCategories } from '../services/pois.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import TripMap from '../components/TripMap.jsx';
import TripTabs from '../components/TripTabs.jsx';
import PoiFilterBar from '../components/PoiFilterBar.jsx';
import { applyPoiFilters, citiesOf } from '../utils/poiFilters.js';
import { usePoiFilters } from '../hooks/usePoiFilters.js';

export default function MapPage() {
  const { id } = useParams();

  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([getTrip(id), listPois(id), listPoiCategories()]).then(
        ([trip, pois, categories]) => ({ trip, pois, categories })
      ),
    [id]
  );
  const { filters, toggleCategory, setCity, clear, isActive } = usePoiFilters(id);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} onRetry={reload} />;

  const { trip, pois, categories } = data;
  const cities = citiesOf(pois);
  const filteredPois = applyPoiFilters(pois, filters);

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
        <>
          <PoiFilterBar
            categories={categories}
            cities={cities}
            filters={filters}
            onToggleCategory={toggleCategory}
            onSetCity={setCity}
            onClear={clear}
            isActive={isActive}
          />
          {filteredPois.length === 0 ? (
            <div className="empty-state">
              Ningún lugar coincide con el filtro. <button className="btn-link" onClick={clear}>Limpiar filtros</button>
            </div>
          ) : (
            <TripMap pois={filteredPois} />
          )}
        </>
      )}
    </div>
  );
}
