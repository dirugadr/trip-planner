import { NavLink } from 'react-router-dom';

// 5-tab nav (Mapa+Lugares and Documentos+Links each fused behind an
// internal toggle on their own page). Order matches the v2 design brief.
const TABS = [
  { to: '', label: 'Itinerario', end: true },
  { to: 'mapa', label: 'Mapa & Lugares' },
  { to: 'budget', label: 'Presupuesto' },
  { to: 'alojamientos', label: 'Alojamientos' },
  { to: 'documentos', label: 'Documentos & Links' },
];

export default function TripTabs({ tripId }) {
  const base = `/trips/${tripId}`;
  return (
    <nav className="flex items-center gap-1 text-[13px] font-medium text-on-surface-variant">
      {TABS.map((t) => (
        <NavLink
          key={t.to || 'root'}
          to={t.to ? `${base}/${t.to}` : base}
          end={t.end}
          className={({ isActive }) =>
            `px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
              isActive ? 'bg-surface-container-low text-on-surface' : 'hover:text-on-surface'
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
