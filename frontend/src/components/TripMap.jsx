import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { categoryColor, categoryEmoji } from '../utils/poiCategories.js';
import { safeUrl } from '../utils/safeUrl.js';
import { formatDuration } from '../utils/format.js';

/** A teardrop pin coloured by category — a divIcon, so no external images. */
function pinIcon(color) {
  const html = `
    <svg width="28" height="36" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg"
         style="filter: drop-shadow(0 2px 3px rgba(20,30,50,0.35))">
      <path d="M13 0C5.8 0 0 5.8 0 13c0 9.2 11.5 20 12 20.5.3.3.7.3 1 0 .5-.5 12-11.3 12-20.5C25 5.8 19.2 0 13 0z"
            fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="13" cy="13" r="5" fill="#fff"/>
    </svg>`;
  return L.divIcon({
    html,
    className: 'poi-pin',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  });
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

export default function TripMap({ pois, selectable = false, selectedIds, onToggleSelect }) {
  const points = useMemo(
    () => pois.map((p) => [Number(p.latitude), Number(p.longitude)]),
    [pois]
  );

  return (
    <div className="map-wrap">
      <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {pois.map((p) => (
          <Marker key={p.id} position={[Number(p.latitude), Number(p.longitude)]} icon={pinIcon(categoryColor(p))}>
            <Popup>
              <strong>
                {categoryEmoji(p)} {p.name}
              </strong>
              <br />
              <span className="muted">{p.category_name}</span>
              {p.accommodation_id && (
                <>
                  <br />
                  <span className="muted">🏨 Generado por el alojamiento</span>
                </>
              )}
              {p.address && (
                <>
                  <br />
                  {p.address}
                </>
              )}
              {p.estimated_duration_minutes != null && (
                <>
                  <br />
                  <span className="muted">⏱️ ~{formatDuration(p.estimated_duration_minutes)}</span>
                </>
              )}
              {p.notes && (
                <>
                  <br />
                  {p.notes}
                </>
              )}
              {safeUrl(p.url) && (
                <>
                  <br />
                  <a href={safeUrl(p.url)} target="_blank" rel="noreferrer">
                    enlace
                  </a>
                </>
              )}
              {selectable && (
                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn btn-sm${selectedIds?.has(p.id) ? ' btn-secondary' : ''}`}
                    onClick={() => onToggleSelect?.(p.id)}
                  >
                    {selectedIds?.has(p.id) ? '✓ En el recorrido' : '➕ Agregar al recorrido'}
                  </button>
                </div>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
