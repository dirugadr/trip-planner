import { NavLink } from 'react-router-dom';

// Section tabs for a trip. Order is fixed; "Itinerario" is the trip root route.
const TABS = [
  { to: '', label: 'Itinerario', end: true },
  { to: 'alojamientos', label: 'Alojamientos' },
  { to: 'lugares', label: 'Lugares' },
  { to: 'mapa', label: 'Mapa' },
  { to: 'documentos', label: 'Documentos' },
  { to: 'budget', label: 'Presupuesto' },
];

export default function TripTabs({ tripId }) {
  const base = `/trips/${tripId}`;
  return (
    <nav className="trip-tabs">
      {TABS.map((t) => (
        <NavLink
          key={t.to || 'root'}
          to={t.to ? `${base}/${t.to}` : base}
          end={t.end}
          className={({ isActive }) => `trip-tab${isActive ? ' trip-tab-active' : ''}`}
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
