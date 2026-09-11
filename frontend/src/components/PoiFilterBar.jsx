import { categoryColor, categoryEmoji } from '../utils/poiCategories.js';

/**
 * Category (multi-select chips) + city (dropdown) filter for POIs, shared by
 * the Lugares list and the Mapa view so the same filter applies to both
 * (HU-2.7). The active filter itself lives in `usePoiFilters`.
 */
export default function PoiFilterBar({ categories, cities, filters, onToggleCategory, onSetCity, onClear, isActive }) {
  return (
    <div className="poi-filter-bar">
      <div className="poi-filter-chips">
        {categories.map((c) => {
          const active = filters.categories.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              className={`poi-filter-chip${active ? ' poi-filter-chip-active' : ''}`}
              style={active ? { borderColor: categoryColor({ category_color: c.color }), color: categoryColor({ category_color: c.color }) } : undefined}
              onClick={() => onToggleCategory(c.id)}
              aria-pressed={active}
            >
              {categoryEmoji({ category_icon: c.icon })} {c.name}
            </button>
          );
        })}
      </div>

      <div className="poi-filter-city">
        <select value={filters.city} onChange={(e) => onSetCity(e.target.value)} aria-label="Filtrar por ciudad">
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
    </div>
  );
}
