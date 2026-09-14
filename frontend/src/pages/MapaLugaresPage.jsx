import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { getTrip } from '../services/trips.js';
import { listPois, listPoiCategories, createPoi, updatePoi, deletePoi } from '../services/pois.js';
import { listRouteTemplates, deleteRouteTemplate } from '../services/routeTemplates.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Modal from '../components/Modal.jsx';
import PoiForm from '../components/PoiForm.jsx';
import TripMap from '../components/TripMap.jsx';
import PoiFilterBar from '../components/PoiFilterBar.jsx';
import RouteBuilderPanel from '../components/RouteBuilderPanel.jsx';
import SavedRouteTemplates from '../components/SavedRouteTemplates.jsx';
import ApplyRouteModal from '../components/ApplyRouteModal.jsx';
import DiscoverRouteModal from '../components/DiscoverRouteModal.jsx';
import { categoryMsi } from '../utils/poiCategories.js';
import { applyPoiFilters, citiesOf } from '../utils/poiFilters.js';
import { usePoiFilters } from '../hooks/usePoiFilters.js';

function ViewToggle({ view, onChange }) {
  return (
    <div className="flex items-center bg-surface-container-low rounded-full p-1">
      <button
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] transition-colors ${
          view === 'lista' ? 'bg-surface shadow-sm font-semibold' : 'text-on-surface-variant font-medium'
        }`}
        onClick={() => onChange('lista')}
      >
        <span className="msi text-[16px]">list</span>Lista
      </button>
      <button
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] transition-colors ${
          view === 'mapa' ? 'bg-surface shadow-sm font-semibold' : 'text-on-surface-variant font-medium'
        }`}
        onClick={() => onChange('mapa')}
      >
        <span className="msi text-[16px]">map</span>Mapa
      </button>
    </div>
  );
}

export default function MapaLugaresPage() {
  const { id } = useParams();
  const [view, setView] = useState('lista');

  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([getTrip(id), listPois(id), listPoiCategories(), listRouteTemplates(id)]).then(
        ([trip, pois, categories, routeTemplates]) => ({ trip, pois, categories, routeTemplates })
      ),
    [id]
  );
  const { filters, toggleCategory, setCity, clear, isActive } = usePoiFilters(id);
  const [confirmNode, confirm] = useConfirm();

  const [poiModal, setPoiModal] = useState(null); // { poi? }
  const [building, setBuilding] = useState(false); // false | { editingTemplate: null|template }
  const [selected, setSelected] = useState([]); // ordered POI objects
  const [applyTarget, setApplyTarget] = useState(null); // template being applied
  const [actionError, setActionError] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [discoverBounds, setDiscoverBounds] = useState(null); // truthy opens DiscoverRouteModal

  const run = async (fn) => {
    setActionError(null);
    try {
      await fn();
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} onRetry={reload} />;

  const { trip, pois, categories, routeTemplates } = data;
  const cities = citiesOf(pois);
  const filteredPois = applyPoiFilters(pois, filters);

  const handleSubmitPoi = (payload) =>
    run(async () => {
      if (poiModal.poi) await updatePoi(poiModal.poi.id, payload);
      else await createPoi(id, payload);
      setPoiModal(null);
    });

  const handleDeletePoi = async (p) => {
    const ok = await confirm({ title: 'Eliminar lugar', message: `¿Eliminar "${p.name}"?` });
    if (!ok) return;
    run(() => deletePoi(p.id));
  };

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
  const handleSavedRoute = () => {
    cancelBuilding();
    reload();
  };
  const handleDeleteTemplate = async (t) => {
    const ok = await confirm({ title: 'Eliminar recorrido', message: `¿Eliminar el recorrido "${t.name}"?` });
    if (!ok) return;
    run(() => deleteRouteTemplate(t.id));
  };

  const openDiscovery = () => {
    if (!mapInstance) return;
    const b = mapInstance.getBounds();
    setDiscoverBounds({
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    });
  };
  const handleDiscoveryConfirmed = (realPois) => {
    setDiscoverBounds(null);
    setBuilding({ editingTemplate: null });
    setSelected(realPois);
    reload();
  };

  const selectedOrder = new Map(selected.map((p, i) => [p.id, i + 1]));

  return (
    <div className="px-6 py-6">
      <div className="row-between mb-4">
        <h1 className="text-[22px] font-bold">Mapa &amp; Lugares</h1>
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={setView} />
          {view === 'lista' && (
            <button className="btn" onClick={() => setPoiModal({})}>
              <span className="msi text-[16px]">add</span>Lugar
            </button>
          )}
          {view === 'mapa' && !building && (
            <>
              <button className="btn btn-ai" onClick={openDiscovery} disabled={!mapInstance}>
                <span className="msi text-[16px]">auto_awesome</span>Sugerir recorrido en esta zona
              </button>
              {pois.length > 0 && (
                <button className="btn" onClick={() => startBuilding()}>
                  <span className="msi text-[16px]">explore</span>Armar recorrido
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {actionError && <ErrorMessage error={actionError} />}

      {!building && pois.length > 0 && (
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

      {view === 'lista' ? (
        pois.length === 0 ? (
          <div className="empty-state max-w-4xl">Este viaje todavía no tiene lugares. Usá "+ Lugar" para agregar el primero.</div>
        ) : filteredPois.length === 0 ? (
          <div className="empty-state max-w-4xl">
            Ningún lugar coincide con el filtro.{' '}
            <button className="btn-link" onClick={clear}>
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-w-4xl">
            {filteredPois.map((p) => (
              <div key={p.id} className="bg-surface rounded-xl shadow-sm border border-outline-variant/20 overflow-hidden flex">
                {p.photo_url ? (
                  <img className="w-20 h-20 object-cover shrink-0" src={p.photo_url} alt={p.name} />
                ) : (
                  <div className="w-20 h-20 shrink-0 bg-surface-container-low flex items-center justify-center">
                    <span className="msi text-[26px] text-on-surface-variant/50">{categoryMsi(p)}</span>
                  </div>
                )}
                <div className="p-3 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-[14px] truncate">
                      {p.accommodation_id && '🏨 '}
                      {p.name}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button className="btn btn-secondary btn-sm" onClick={() => setPoiModal({ poi: p })}>
                        Editar
                      </button>
                      {!p.accommodation_id && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeletePoi(p)}>
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-[12px] text-on-surface-variant flex items-center gap-1 mt-0.5">
                    <span className="msi text-[13px]">{categoryMsi(p)}</span>
                    {p.category_name}
                    {p.city && ` · ${p.city}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className={building ? 'grid grid-cols-1 md:grid-cols-3 gap-4' : ''}>
            {building && (
              <div className="order-2 md:order-1">
                <RouteBuilderPanel
                  tripId={id}
                  selected={selected}
                  onChangeOrder={setSelected}
                  onRemove={toggleSelect}
                  editingTemplate={building.editingTemplate}
                  onSaved={handleSavedRoute}
                  onCancel={cancelBuilding}
                />
              </div>
            )}
            <div className={building ? 'order-1 md:order-2 md:col-span-2' : ''}>
              {pois.length > 0 && filteredPois.length === 0 && !building ? (
                <div className="empty-state">
                  Ningún lugar coincide con el filtro.{' '}
                  <button className="btn-link" onClick={clear}>
                    Limpiar filtros
                  </button>
                </div>
              ) : (
                <TripMap
                  pois={building ? pois : filteredPois}
                  selectable={!!building}
                  selectedIds={new Set(selected.map((p) => p.id))}
                  selectedOrder={building ? selectedOrder : undefined}
                  onToggleSelect={toggleSelect}
                  onMapReady={setMapInstance}
                />
              )}
            </div>
          </div>

          {!building && (
            <div className="mt-6 max-w-4xl">
              <h2 className="text-[15px] font-semibold mb-2">Recorridos guardados</h2>
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

      {poiModal && (
        <Modal title={poiModal.poi ? 'Editar lugar' : 'Nuevo lugar'} onClose={() => setPoiModal(null)}>
          <PoiForm
            initial={poiModal.poi}
            categories={categories}
            onSubmit={handleSubmitPoi}
            onCancel={() => setPoiModal(null)}
            onPhotoChanged={reload}
          />
        </Modal>
      )}

      {applyTarget && (
        <ApplyRouteModal template={applyTarget} days={trip.days} onClose={() => setApplyTarget(null)} onApplied={reload} />
      )}

      {discoverBounds && (
        <DiscoverRouteModal
          tripId={id}
          bounds={discoverBounds}
          onClose={() => setDiscoverBounds(null)}
          onConfirmed={handleDiscoveryConfirmed}
        />
      )}
    </div>
  );
}
