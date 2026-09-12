import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { categoryMsi } from '../utils/poiCategories.js';
import { safeUrl } from '../utils/safeUrl.js';
import { formatDuration } from '../utils/format.js';

/** A small circular badge with the category's Material Symbol — blue for a
 * regular POI, amber + sequence number when it's part of the route being
 * built (matches mockup-mapa.html's marker language). */
function poiIcon(msi) {
  const html = `
    <div class="w-6 h-6 rounded-full bg-secondary text-white flex items-center justify-center shadow-md border-2 border-white">
      <span class="msi" style="font-size:13px">${msi}</span>
    </div>`;
  return L.divIcon({ html, className: 'poi-pin', iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14] });
}

function routeStopIcon(n) {
  const html = `
    <div class="w-8 h-8 rounded-full bg-tertiary text-white text-[13px] font-bold flex items-center justify-center shadow-md border-2 border-white">${n}</div>`;
  return L.divIcon({ html, className: 'poi-pin', iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18] });
}

/** Hands the underlying Leaflet map instance up to the parent once, so it
 * can read live state (e.g. getBounds() for HU-2.6b's area discovery)
 * without this component needing to know why. */
function MapInstanceReporter({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady?.(map);
  }, [map, onReady]);
  return null;
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return undefined;

    const apply = () => {
      // The container can still be 0×0 on the first tick (lazy route + layout);
      // invalidateSize picks up the real size before we fit.
      map.invalidateSize();
      if (points.length === 1) {
        map.setView(points[0], 14);
      } else {
        map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
      }
    };

    const raf = requestAnimationFrame(apply);
    map.on('resize', apply);
    return () => {
      cancelAnimationFrame(raf);
      map.off('resize', apply);
    };
  }, [map, points]);
  return null;
}

export default function TripMap({ pois, selectable = false, selectedIds, onToggleSelect, selectedOrder, onMapReady }) {
  const points = useMemo(() => pois.map((p) => [Number(p.latitude), Number(p.longitude)]), [pois]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-outline-variant/20 shadow-sm h-[70vh] min-h-[360px]">
      <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {onMapReady && <MapInstanceReporter onReady={onMapReady} />}
        {pois.map((p) => {
          const sequence = selectedOrder?.get(p.id);
          return (
            <Marker
              key={p.id}
              position={[Number(p.latitude), Number(p.longitude)]}
              icon={sequence ? routeStopIcon(sequence) : poiIcon(categoryMsi(p))}
            >
              <Popup>
                <div className="flex w-64">
                  {p.photo_url ? (
                    <img className="w-20 h-20 object-cover shrink-0" src={p.photo_url} alt={p.name} />
                  ) : (
                    <div className="w-20 h-20 shrink-0 bg-surface-container-low flex items-center justify-center">
                      <span className="msi text-[24px] text-on-surface-variant/50">{categoryMsi(p)}</span>
                    </div>
                  )}
                  <div className="p-2.5 flex-1 min-w-0">
                    <div className="font-semibold text-[13px] truncate">{p.name}</div>
                    <div className="text-[11px] text-on-surface-variant mt-0.5 flex items-center gap-1">
                      <span className="msi text-[13px]">{categoryMsi(p)}</span>
                      {p.category_name}
                      {p.estimated_duration_minutes != null && ` · ~${formatDuration(p.estimated_duration_minutes)}`}
                    </div>
                    {p.accommodation_id && (
                      <div className="text-[11px] text-on-surface-variant mt-0.5">🏨 Generado por el alojamiento</div>
                    )}
                    {p.address && <div className="text-[11px] text-on-surface-variant mt-0.5 truncate">{p.address}</div>}
                    {safeUrl(p.url) && (
                      <a
                        className="block text-[11px] text-secondary font-semibold mt-1"
                        href={safeUrl(p.url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver enlace
                      </a>
                    )}
                    {selectable && (
                      <button
                        type="button"
                        className={`text-[11px] font-semibold mt-1.5 ${selectedIds?.has(p.id) ? 'text-tertiary' : 'text-secondary'}`}
                        onClick={() => onToggleSelect?.(p.id)}
                      >
                        {selectedIds?.has(p.id) ? '✓ En el recorrido' : '+ Agregar al recorrido'}
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
