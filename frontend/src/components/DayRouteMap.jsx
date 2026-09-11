import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** A numbered circular badge — a divIcon, so no external images. */
function numberedIcon(n) {
  const html = `
    <div style="
      width: 28px; height: 28px; border-radius: 50%;
      background: var(--primary, #2f6fed); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.85rem; font-weight: 700;
      border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.35);
    ">${n}</div>`;
  return L.divIcon({
    html,
    className: 'route-view-pin',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return undefined;

    const apply = () => {
      map.invalidateSize();
      if (points.length === 1) {
        map.setView(points[0], 15);
      } else {
        map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
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

/** Read-only map: numbered stops in schedule order + the walked path between them. */
export default function DayRouteMap({ stops, segments }) {
  const points = useMemo(() => stops.map((s) => [s.lat, s.lng]), [stops]);

  return (
    <div className="map-wrap">
      <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {segments.map((seg, i) => (
          <Polyline
            key={i}
            positions={seg.coordinates}
            pathOptions={{
              color: '#2f6fed',
              weight: 4,
              opacity: seg.source === 'osrm' ? 0.8 : 0.6,
              dashArray: seg.source === 'osrm' ? undefined : '8 8',
            }}
          />
        ))}
        {stops.map((s) => (
          <Marker key={s.activity_id} position={[s.lat, s.lng]} icon={numberedIcon(s.sequence_number)}>
            <Popup>
              <strong>
                {s.sequence_number}. {s.activity_name}
              </strong>
              <br />
              <span className="muted">📍 {s.poi_name}</span>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
