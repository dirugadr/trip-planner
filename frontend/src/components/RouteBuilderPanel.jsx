import { useEffect, useState } from 'react';
import ErrorMessage from './ErrorMessage.jsx';
import { formatDuration, formatDistance } from '../utils/format.js';
import { previewRouteDuration, smartOrderPois, createRouteTemplate, updateRouteTemplate } from '../services/routeTemplates.js';
import { categoryMsi } from '../utils/poiCategories.js';

/**
 * Panel for building (or editing) a route template: the traveler picks POIs
 * either on the map or from the "visible in this area" list below (both
 * call the same `onToggleSelect`), reorders them here by dragging, and can
 * ask for a smart walking order before saving.
 */
export default function RouteBuilderPanel({
  tripId,
  selected,
  onChangeOrder,
  onToggleSelect,
  viewportPois,
  editingTemplate,
  onSaved,
  onCancel,
}) {
  const [name, setName] = useState(editingTemplate?.name || '');
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [totalDistanceMeters, setTotalDistanceMeters] = useState(0);
  const [reasons, setReasons] = useState({}); // poi_id -> reason, from the last smart-order suggestion
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const selectedIds = new Set(selected.map((p) => p.id));

  useEffect(() => {
    let alive = true;
    if (selected.length === 0) {
      setTotalMinutes(0);
      setTotalDistanceMeters(0);
      return undefined;
    }
    previewRouteDuration(tripId, selected.map((p) => p.id))
      .then((data) => {
        if (!alive) return;
        setTotalMinutes(data.total_minutes);
        setTotalDistanceMeters(data.total_distance_meters);
      })
      .catch(() => {
        if (!alive) return;
        setTotalMinutes(0);
        setTotalDistanceMeters(0);
      });
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
    <div className="bg-surface rounded-2xl shadow-sm border border-outline-variant/20 p-4 h-fit">
      <div className="flex items-center justify-between mb-1">
        <div className="font-semibold text-[14px]">{editingTemplate ? 'Editar recorrido' : 'Armar recorrido'}</div>
        <span className="text-[11px] text-on-surface-variant">{selected.length} lugares</span>
      </div>
      <div className="row-between mb-3">
        <p className="text-[12px] text-on-surface-variant m-0">Tocá lugares en el mapa o en la lista para agregarlos</p>
        <button className="btn-link" onClick={onCancel}>
          Cancelar
        </button>
      </div>

      <div className="mb-3">
        <div className="text-[11px] font-semibold text-on-surface-variant mb-1.5">Lugares visibles en el mapa</div>
        {viewportPois.length === 0 ? (
          <div className="text-[12px] text-on-surface-variant">Ningún lugar visible en esta zona del mapa.</div>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {viewportPois.map((p) => {
              const isSelected = selectedIds.has(p.id);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-container-low"
                >
                  <span className="msi text-[14px] text-on-surface-variant/60 shrink-0">{categoryMsi(p)}</span>
                  <span className="text-[12px] flex-1 truncate">{p.name}</span>
                  <button
                    type="button"
                    className={`text-[11px] font-semibold shrink-0 ${isSelected ? 'text-tertiary' : 'text-secondary'}`}
                    onClick={() => onToggleSelect(p.id)}
                  >
                    {isSelected ? '✓ En el recorrido' : '+ Agregar'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected.length === 0 ? (
        <div className="empty-state">Todavía no agregaste ningún lugar.</div>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {selected.map((p, i) => (
              <div
                key={p.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(i)}
                className="flex items-center gap-2 bg-surface-container-low rounded-lg p-2 cursor-grab"
              >
                <span className="w-5 h-5 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-[13px] font-medium flex-1 truncate">{p.name}</span>
                <button
                  type="button"
                  onClick={() => onToggleSelect(p.id)}
                  aria-label="Quitar"
                  className="msi text-[16px] text-on-surface-variant/60"
                >
                  close
                </button>
                <span className="msi text-[16px] text-on-surface-variant/50">drag_indicator</span>
                {reasons[p.id] && <div className="basis-full text-[12px] text-on-surface-variant">{reasons[p.id]}</div>}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[12px] text-on-surface-variant bg-surface-container-low rounded-lg px-3 py-2 mb-1">
            <span>Duración total estimada</span>
            <span className="font-semibold text-on-surface">{formatDuration(totalMinutes) || '0 min'}</span>
          </div>
          <div className="flex items-center justify-between text-[12px] text-on-surface-variant bg-surface-container-low rounded-lg px-3 py-2 mb-3">
            <span>Distancia total estimada</span>
            <span className="font-semibold text-on-surface">{formatDistance(totalDistanceMeters) || '0 m'}</span>
          </div>

          {orderError && <ErrorMessage error={orderError} />}
          <button
            className="btn btn-ai w-full justify-center mb-2"
            onClick={handleSmartOrder}
            disabled={selected.length < 3 || ordering}
          >
            <span className="msi text-[16px]">auto_awesome</span>
            {ordering ? 'Pensando el mejor orden…' : 'Ordenar automáticamente'}
          </button>

          <div className="field">
            <label>Nombre del recorrido</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Centro histórico" />
          </div>

          {saveError && <ErrorMessage error={saveError} />}
          <button className="btn btn-secondary w-full justify-center" onClick={handleSave} disabled={saving}>
            <span className="msi text-[16px]">bookmark_add</span>
            {saving ? 'Guardando…' : 'Guardar recorrido'}
          </button>
        </>
      )}
    </div>
  );
}
