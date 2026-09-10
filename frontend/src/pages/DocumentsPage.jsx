import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { getTrip } from '../services/trips.js';
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  downloadDocument,
} from '../services/documents.js';
import { ACCEPT, checkFileClient, fileIcon } from '../utils/fileTypes.js';
import { formatBytes } from '../utils/format.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import TripTabs from '../components/TripTabs.jsx';

export default function DocumentsPage() {
  const { id } = useParams();

  const { data, loading, error, reload } = useAsync(
    () => Promise.all([listDocuments(id), getTrip(id)]).then(([documents, trip]) => ({ documents, trip })),
    [id]
  );

  const fileRef = useRef(null);
  const [activityId, setActivityId] = useState('');
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [confirmNode, confirm] = useConfirm();

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} onRetry={reload} />;

  const { documents, trip } = data;
  const activities = (trip.days || []).flatMap((d) =>
    d.activities.map((a) => ({ id: a.id, label: `${a.title}` }))
  );

  const handleUpload = async (e) => {
    e.preventDefault();
    setActionError(null);
    const file = fileRef.current?.files?.[0];
    const err = checkFileClient(file);
    if (err) {
      setActionError(err);
      return;
    }
    setUploading(true);
    try {
      await uploadDocument(id, file, { activityId: activityId || undefined, title: title.trim() || undefined });
      fileRef.current.value = '';
      setActivityId('');
      setTitle('');
      reload();
    } catch (err2) {
      setActionError(err2.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    setActionError(null);
    try {
      await downloadDocument(doc.id, doc.file_name);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleDelete = async (doc) => {
    const ok = await confirm({
      title: 'Eliminar documento',
      message: `¿Eliminar "${doc.title}"? El archivo se borra definitivamente.`,
    });
    if (!ok) return;
    setActionError(null);
    try {
      await deleteDocument(doc.id);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <div>
      <TripTabs tripId={id} />

      {actionError && <ErrorMessage error={actionError} />}

      <div className="row-between" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.2rem' }}>Documentos</h1>
          <div className="muted">{trip.name}</div>
        </div>
      </div>

      <form className="card" onSubmit={handleUpload} style={{ marginBottom: '1rem' }}>
        <div className="field">
          <label htmlFor="doc-file">Archivo * — PDF, Word o imagen (máx. 5 MB)</label>
          <input id="doc-file" type="file" ref={fileRef} accept={ACCEPT} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="doc-title">Título (opcional)</label>
            <input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Se usa el nombre del archivo si lo dejás vacío"
            />
          </div>
          <div className="field">
            <label htmlFor="doc-activity">Actividad (opcional)</label>
            <select id="doc-activity" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
              <option value="">— Sin actividad —</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row-between" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" className="btn" disabled={uploading}>
            {uploading ? 'Subiendo…' : 'Subir documento'}
          </button>
        </div>
      </form>

      {documents.length === 0 ? (
        <div className="empty-state">Todavía no subiste documentos a este viaje.</div>
      ) : (
        documents.map((doc) => (
          <div className="card" key={doc.id}>
            <div className="row-between">
              <div>
                <h3 style={{ marginBottom: '0.15rem' }}>
                  {fileIcon(doc.file_type)} {doc.title}
                </h3>
                <div className="muted">
                  {doc.file_name} · {formatBytes(doc.file_size_bytes)}
                </div>
                {doc.activity_title && (
                  <div className="muted">🔗 {doc.activity_title}</div>
                )}
              </div>
              <div className="activity-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => handleDownload(doc)}>
                  Descargar
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc)}>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {confirmNode}
    </div>
  );
}
