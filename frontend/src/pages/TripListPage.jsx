import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { listTrips, createTrip } from '../services/trips.js';
import { formatDateRange } from '../utils/format.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Modal from '../components/Modal.jsx';
import TripForm from '../components/TripForm.jsx';

function tripDays(trip) {
  const start = new Date(`${trip.start_date}T00:00:00`);
  const end = new Date(`${trip.end_date}T00:00:00`);
  return Math.round((end - start) / 86400000) + 1;
}

function isPastTrip(trip) {
  return trip.end_date < new Date().toISOString().slice(0, 10);
}

export default function TripListPage() {
  const { data: trips, loading, error, reload } = useAsync(listTrips, []);
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async (payload) => {
    await createTrip(payload);
    setShowForm(false);
    reload();
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="row-between mb-6">
        <h1 className="text-[24px] font-bold">Tus viajes</h1>
        <button className="btn" onClick={() => setShowForm(true)}>
          <span className="msi text-[18px]">add</span>Nuevo viaje
        </button>
      </div>

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

      {!loading && !error && (
        <div className="space-y-3">
          {trips.map((trip) => {
            const past = isPastTrip(trip);
            return (
              <Link
                key={trip.id}
                to={`/trips/${trip.id}`}
                className={`flex bg-surface rounded-2xl shadow-sm border border-outline-variant/20 overflow-hidden hover:shadow-md transition-shadow ${
                  past ? 'opacity-70 hover:opacity-100' : ''
                }`}
              >
                {trip.cover_photo_url ? (
                  <img
                    className={`w-24 h-24 object-cover shrink-0 ${past ? 'grayscale' : ''}`}
                    src={trip.cover_photo_url}
                    alt=""
                  />
                ) : (
                  <div className="w-24 h-24 shrink-0 bg-surface-container-low flex items-center justify-center">
                    <span className="msi text-[28px] text-on-surface-variant/50">luggage</span>
                  </div>
                )}
                <div className="p-3 flex-1 flex flex-col justify-center min-w-0">
                  <div className="font-semibold text-[15px] truncate">{trip.name}</div>
                  <div className="text-[12px] text-on-surface-variant mt-0.5">
                    {formatDateRange(trip.start_date, trip.end_date)} · {tripDays(trip)} días
                  </div>
                </div>
                <div className="flex items-center pr-4 text-on-surface-variant">
                  <span className="msi text-[20px]">chevron_right</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal title="Nuevo viaje" onClose={() => setShowForm(false)}>
          <TripForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} submitLabel="Crear viaje" />
        </Modal>
      )}
    </div>
  );
}
