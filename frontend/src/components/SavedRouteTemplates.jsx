import { formatDuration } from '../utils/format.js';

export default function SavedRouteTemplates({ templates, onEdit, onDelete, onApply }) {
  if (templates.length === 0) {
    return <div className="empty-state">Todavía no guardaste ningún recorrido.</div>;
  }
  return (
    <div className="space-y-2">
      {templates.map((t) => (
        <div className="card" key={t.id}>
          <div className="row-between">
            <strong className="text-[15px]">{t.name}</strong>
            <span className="muted flex items-center gap-1">
              <span className="msi text-[14px]">schedule</span>
              {formatDuration(t.total_minutes) || '0 min'}
            </span>
          </div>
          <div className="muted my-1.5">{t.stops.map((s) => s.name).join(' → ')}</div>
          <div className="flex gap-2 flex-wrap mt-2">
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
