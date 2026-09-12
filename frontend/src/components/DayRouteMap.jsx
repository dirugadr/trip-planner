import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** A numbered circular badge — a divIcon, so no external images. */
function numberedIcon(n) {
  const html = `
    <div class="w-7 h-7 rounded-full bg-primary text-on-primary text-[12px] font-bold flex items-center justify-center shadow-md border-2 border-white">${n}</div>`;
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
    <div className="relative rounded-2xl overflow-hidden border border-outline-variant/20 shadow-sm h-[70vh] min-h-[360px]">
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
              color: '#0051d5',
              weight: 4,
              opacity: seg.source === 'osrm' ? 0.8 : 0.6,
              dashArray: seg.source === 'osrm' ? undefined : '8 8',
            }}
          />
        ))}
        {stops.map((s) => (
          <Marker key={s.activity_id} position={[s.lat, s.lng]} icon={numberedIcon(s.sequence_number)}>
            <Popup>
              <div className="p-2.5">
                <strong className="text-[13px]">
                  {s.sequence_number}. {s.activity_name}
                </strong>
                <div className="text-[11px] text-on-surface-variant mt-0.5">📍 {s.poi_name}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
