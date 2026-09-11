import { formatDuration } from '../utils/format.js';
import { categoryEmoji } from '../utils/poiCategories.js';

export default function SavedRouteTemplates({ templates, onEdit, onDelete, onApply }) {
  if (templates.length === 0) {
    return <div className="empty-state">Todavía no guardaste ningún recorrido.</div>;
  }

  return (
    <div>
      {templates.map((t) => (
        <div className="card" key={t.id}>
          <div className="row-between">
            <strong>{t.name}</strong>
            <span className="muted">⏱️ {formatDuration(t.total_minutes) || '0 min'}</span>
          </div>
          <div className="muted" style={{ margin: '0.35rem 0' }}>
            {t.stops.map((s) => `${categoryEmoji(s)} ${s.name}`).join(' → ')}
          </div>
          <div className="activity-actions">
            <button className="btn btn-sm" onClick={() => onApply(t)}>
              Aplicar a un día
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onEdit(t)}>
              Editar
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(t)}>
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
