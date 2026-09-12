/**
 * Multi-select tag filter (OR) for the links list (HU-9.3). Same chip
 * language as PoiFilterBar — tags instead of categories.
 */
export default function LinkFilterBar({ tags, selected, onToggle, onClear }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      {tags.map((t) => {
        const active = selected.includes(t.name);
        return (
          <button
            key={t.id}
            type="button"
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
              active ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
            }`}
            onClick={() => onToggle(t.name)}
            aria-pressed={active}
          >
            {t.name}
          </button>
        );
      })}
      {selected.length > 0 && (
        <button type="button" className="btn-link" onClick={onClear}>
          Limpiar filtro
        </button>
      )}
    </div>
  );
}
