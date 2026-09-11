/**
 * Multi-select tag filter (OR) for the links list (HU-9.3). Reuses the same
 * chip look as PoiFilterBar (.poi-filter-*) — same interaction, just tags
 * instead of categories, so no need for a separate visual language.
 */
export default function LinkFilterBar({ tags, selected, onToggle, onClear }) {
  if (tags.length === 0) return null;
  return (
    <div className="poi-filter-bar">
      <div className="poi-filter-chips">
        {tags.map((t) => {
          const active = selected.includes(t.name);
          return (
            <button
              key={t.id}
              type="button"
              className={`poi-filter-chip${active ? ' poi-filter-chip-active' : ''}`}
              onClick={() => onToggle(t.name)}
              aria-pressed={active}
            >
              {t.name}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <button type="button" className="btn-link" onClick={onClear}>
          Limpiar filtro
        </button>
      )}
    </div>
  );
}
