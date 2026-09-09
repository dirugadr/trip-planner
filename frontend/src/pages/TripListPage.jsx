import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { listTrips, createTrip, deleteTrip } from '../services/trips.js';
import { formatDateRange } from '../utils/format.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Modal from '../components/Modal.jsx';
import TripForm from '../components/TripForm.jsx';

export default function TripListPage() {
  const { data: trips, loading, error, reload } = useAsync(listTrips, []);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [confirmNode, confirm] = useConfirm();

  const handleCreate = async (payload) => {
    await createTrip(payload);
    setShowForm(false);
    reload();
  };

  const handleDelete = async (trip) => {
    const ok = await confirm({
      title: 'Eliminar viaje',
      message: `¿Eliminar el viaje "${trip.name}"? Esta acción no se puede deshacer.`,
    });
    if (!ok) return;
    setActionError(null);
    setBusyId(trip.id);
    try {
      await deleteTrip(trip.id);
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="row-between" style={{ marginBottom: '1.25rem' }}>
        <h1>Mis viajes</h1>
        <button className="btn" onClick={() => setShowForm(true)}>
          + Nuevo viaje
        </button>
      </div>

      {actionError && <ErrorMessage error={actionError} />}

      {loading && <Spinner />}
      {error && <ErrorMessage error={error} onRetry={reload} />}

      {!loading && !error && trips.length === 0 && (
        <div className="empty-state">
          <p>Todavía no tenés viajes.</p>
          <button className="btn" onClick={() => setShowForm(true)}>
            Crear el primero
          </button>
        </div>
      )}

      {!loading &&
        !error &&
        trips.map((trip) => (
          <div className="card" key={trip.id}>
            <div className="row-between">
              <div>
                <h3 style={{ marginBottom: '0.15rem' }}>
                  <Link to={`/trips/${trip.id}`}>{trip.name}</Link>
                </h3>
                <div className="muted">{formatDateRange(trip.start_date, trip.end_date)}</div>
                {trip.description && <div className="muted">{trip.description}</div>}
              </div>
              <div className="activity-actions">
                <Link className="btn btn-secondary btn-sm" to={`/trips/${trip.id}`}>
                  Abrir
                </Link>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(trip)}
                  disabled={busyId === trip.id}
                >
                  {busyId === trip.id ? '…' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        ))}

      {confirmNode}

      {showForm && (
        <Modal title="Nuevo viaje" onClose={() => setShowForm(false)}>
          <TripForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            submitLabel="Crear viaje"
          />
        </Modal>
      )}
    </div>
  );
}
