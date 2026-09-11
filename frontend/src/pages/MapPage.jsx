import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { getTrip } from '../services/trips.js';
import { listPois, listPoiCategories } from '../services/pois.js';
import { listRouteTemplates, deleteRouteTemplate } from '../services/routeTemplates.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import TripMap from '../components/TripMap.jsx';
import TripTabs from '../components/TripTabs.jsx';
import PoiFilterBar from '../components/PoiFilterBar.jsx';
import RouteBuilderPanel from '../components/RouteBuilderPanel.jsx';
import SavedRouteTemplates from '../components/SavedRouteTemplates.jsx';
import ApplyRouteModal from '../components/ApplyRouteModal.jsx';
import { applyPoiFilters, citiesOf } from '../utils/poiFilters.js';
import { usePoiFilters } from '../hooks/usePoiFilters.js';

export default function MapPage() {
  const { id } = useParams();

  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([getTrip(id), listPois(id), listPoiCategories(), listRouteTemplates(id)]).then(
        ([trip, pois, categories, routeTemplates]) => ({ trip, pois, categories, routeTemplates })
      ),
    [id]
  );
  const { filters, toggleCategory, setCity, clear, isActive } = usePoiFilters(id);
  const [confirmNode, confirm] = useConfirm();

  const [building, setBuilding] = useState(false); // false | { editingTemplate: null|template }
  const [selected, setSelected] = useState([]); // ordered POI objects
  const [applyTarget, setApplyTarget] = useState(null); // template being applied
  const [actionError, setActionError] = useState(null);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} onRetry={reload} />;

  const { trip, pois, categories, routeTemplates } = data;
  const cities = citiesOf(pois);
  const filteredPois = applyPoiFilters(pois, filters);

  const startBuilding = (editingTemplate = null) => {
    setBuilding({ editingTemplate });
    setSelected(editingTemplate ? editingTemplate.stops.map((s) => pois.find((p) => p.id === s.id) || s) : []);
  };
  const cancelBuilding = () => {
    setBuilding(false);
    setSelected([]);
  };

  const toggleSelect = (poiId) => {
    setSelected((prev) =>
      prev.some((p) => p.id === poiId) ? prev.filter((p) => p.id !== poiId) : [...prev, pois.find((p) => p.id === poiId)]
    );
  };

  const handleSaved = () => {
    cancelBuilding();
    reload();
  };

  const handleDeleteTemplate = async (t) => {
    const ok = await confirm({ title: 'Eliminar recorrido', message: `¿Eliminar el recorrido "${t.name}"?` });
    if (!ok) return;
    setActionError(null);
    try {
      await deleteRouteTemplate(t.id);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <div>
      <TripTabs tripId={id} />

      <div className="row-between" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.2rem' }}>Mapa</h1>
          <div className="muted">{trip.name}</div>
        </div>
        {!building && pois.length > 0 && (
          <button className="btn" onClick={() => startBuilding()}>
            🧭 Armar recorrido
          </button>
        )}
      </div>

      {actionError && <ErrorMessage error={actionError} />}

      {pois.length === 0 ? (
        <div className="empty-state">
          Este viaje todavía no tiene lugares.{' '}
          <Link to={`/trips/${id}/lugares`}>Agregá el primero</Link> para verlo en el mapa.
        </div>
      ) : (
        <>
          {!building && (
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

          <div className={building ? 'route-builder-layout' : undefined}>
            {filteredPois.length === 0 && !building ? (
              <div className="empty-state">
                Ningún lugar coincide con el filtro. <button className="btn-link" onClick={clear}>Limpiar filtros</button>
              </div>
            ) : (
              <TripMap
                pois={building ? pois : filteredPois}
                selectable={!!building}
                selectedIds={new Set(selected.map((p) => p.id))}
                onToggleSelect={toggleSelect}
              />
            )}

            {building && (
              <RouteBuilderPanel
                tripId={id}
                selected={selected}
                onChangeOrder={setSelected}
                onRemove={toggleSelect}
                editingTemplate={building.editingTemplate}
                onSaved={handleSaved}
                onCancel={cancelBuilding}
              />
            )}
          </div>

          {!building && (
            <div style={{ marginTop: '1.5rem' }}>
              <h2 style={{ fontSize: '1.05rem' }}>Recorridos guardados</h2>
              <SavedRouteTemplates
                templates={routeTemplates}
                onEdit={startBuilding}
                onDelete={handleDeleteTemplate}
                onApply={setApplyTarget}
              />
            </div>
          )}
        </>
      )}

      {confirmNode}

      {applyTarget && (
        <ApplyRouteModal
          template={applyTarget}
          days={trip.days}
          onClose={() => setApplyTarget(null)}
          onApplied={reload}
        />
      )}
    </div>
  );
}
