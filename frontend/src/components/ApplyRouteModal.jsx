import { useState } from 'react';
import Modal from './Modal.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import { formatDayHeading } from '../utils/format.js';
import { applyRouteTemplate } from '../services/routeTemplates.js';

export default function ApplyRouteModal({ template, days, onClose, onApplied }) {
  const [dayId, setDayId] = useState(days[0]?.id || '');
  const [startTime, setStartTime] = useState('09:00');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);

  const handleApply = async () => {
    setError(null);
    if (!dayId) {
      setError('Elegí un día');
      return;
    }
    setApplying(true);
    try {
      await applyRouteTemplate(template.id, dayId, startTime);
      onApplied();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal title={`Aplicar "${template.name}"`} onClose={onClose}>
      <div className="field">
        <label>Día</label>
        <select value={dayId} onChange={(e) => setDayId(e.target.value)}>
          {days.map((d) => (
            <option key={d.id} value={d.id}>
              {formatDayHeading(d.date)}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Hora de inicio</label>
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
      </div>

      {error && <ErrorMessage error={error} />}

      <div className="row-between" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onClose} disabled={applying}>
          Cancelar
        </button>
        <button className="btn" onClick={handleApply} disabled={applying}>
          {applying ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
    </Modal>
  );
}
