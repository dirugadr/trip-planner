import { useEffect, useState } from 'react';
import ErrorMessage from './ErrorMessage.jsx';
import { formatDuration } from '../utils/format.js';
import { categoryEmoji } from '../utils/poiCategories.js';
import { previewRouteDuration, smartOrderPois, createRouteTemplate, updateRouteTemplate } from '../services/routeTemplates.js';

/**
 * Panel for building (or editing) a route template: the traveler picks POIs
 * on the map (selection lives in the parent, via `selected`), reorders them
 * here by dragging, and can ask for a smart walking order before saving.
 */
export default function RouteBuilderPanel({ tripId, selected, onChangeOrder, onRemove, editingTemplate, onSaved, onCancel }) {
  const [name, setName] = useState(editingTemplate?.name || '');
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [reasons, setReasons] = useState({}); // poi_id -> reason, from the last smart-order suggestion
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);

  useEffect(() => {
    let alive = true;
    if (selected.length === 0) {
      setTotalMinutes(0);
      return undefined;
    }
    previewRouteDuration(tripId, selected.map((p) => p.id))
      .then((data) => alive && setTotalMinutes(data.total_minutes))
      .catch(() => alive && setTotalMinutes(0));
    return () => {
      alive = false;
    };
  }, [tripId, selected]);

  const handleDrop = (dropIndex) => {
    if (dragIndex == null || dragIndex === dropIndex) return;
    const next = [...selected];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    onChangeOrder(next);
    setDragIndex(null);
  };

  const handleSmartOrder = async () => {
    setOrderError(null);
    setOrdering(true);
    try {
      const data = await smartOrderPois(tripId, selected.map((p) => p.id));
      const byId = new Map(selected.map((p) => [p.id, p]));
      onChangeOrder(data.ordered_poi_ids.map((id) => byId.get(id)).filter(Boolean));
      setReasons(Object.fromEntries(data.reasons.map((r) => [r.poi_id, r.reason])));
    } catch (err) {
      setOrderError(err.message);
    } finally {
      setOrdering(false);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    if (!name.trim()) {
      setSaveError('Falta el nombre del recorrido');
      return;
    }
    setSaving(true);
    try {
      const poiIds = selected.map((p) => p.id);
      const saved = editingTemplate
        ? await updateRouteTemplate(editingTemplate.id, name.trim(), poiIds)
        : await createRouteTemplate(tripId, name.trim(), poiIds);
      onSaved(saved);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="route-builder">
      <div className="row-between" style={{ marginBottom: '0.5rem' }}>
        <strong>{editingTemplate ? 'Editar recorrido' : 'Armar recorrido'}</strong>
        <button className="btn-link" onClick={onCancel}>
          Cancelar
        </button>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        Tocá lugares en el mapa para agregarlos, en el orden que quieras visitarlos.
      </p>

      {selected.length === 0 ? (
        <div className="empty-state">Todavía no agregaste ningún lugar.</div>
      ) : (
        <>
          <ol className="route-builder-list">
            {selected.map((p, i) => (
              <li
                key={p.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(i)}
              >
                <span className="route-builder-handle" title="Arrastrar para reordenar">⠿</span>
                <span>
                  {categoryEmoji(p)} {p.name}
                </span>
                {reasons[p.id] && <div className="muted route-builder-reason">{reasons[p.id]}</div>}
                <button className="btn-link" onClick={() => onRemove(p.id)} aria-label="Quitar">
                  ✕
                </button>
              </li>
            ))}
          </ol>

          <div className="route-builder-duration">
            ⏱️ Duración total estimada: <strong>{formatDuration(totalMinutes) || '0 min'}</strong>
          </div>

          {orderError && <ErrorMessage error={orderError} />}
          <button
            className="btn btn-ai"
            onClick={handleSmartOrder}
            disabled={selected.length < 3 || ordering}
            style={{ marginBottom: '1rem' }}
          >
            {ordering ? 'Pensando el mejor orden…' : '🧭 Ordenar automáticamente'}
          </button>

          <div className="field">
            <label>Nombre del recorrido</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Centro histórico" />
          </div>

          {saveError && <ErrorMessage error={saveError} />}
          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar recorrido'}
          </button>
        </>
      )}
    </div>
  );
}
