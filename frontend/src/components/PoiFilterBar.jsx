import { categoryMsi } from '../utils/poiCategories.js';

/**
 * Category (multi-select chips) + city (dropdown) filter for POIs, shared by
 * the Lista and Mapa views of "Mapa & Lugares" (HU-2.7). The active filter
 * itself lives in `usePoiFilters`.
 */
export default function PoiFilterBar({ categories, cities, filters, onToggleCategory, onSetCity, onClear, isActive }) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      {categories.map((c) => {
        const active = filters.categories.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
              active ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
            }`}
            onClick={() => onToggleCategory(c.id)}
            aria-pressed={active}
          >
            <span className="msi text-[14px]">{categoryMsi({ category_icon: c.icon })}</span>
            {c.name}
          </button>
        );
      })}

      <select
        className="px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant text-[12px]
          font-medium border-none focus:outline-none focus:ring-2 focus:ring-secondary/30"
        value={filters.city}
        onChange={(e) => onSetCity(e.target.value)}
        aria-label="Filtrar por ciudad"
      >
        <option value="">Todas las ciudades</option>
        {cities.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>

      {isActive && (
        <button type="button" className="btn-link" onClick={onClear}>
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
