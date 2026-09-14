import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { getTrip } from '../services/trips.js';
import { listDocuments, uploadDocument, deleteDocument, downloadDocument } from '../services/documents.js';
import { listLinks, listTags, createLink, updateLink, deleteLink } from '../services/links.js';
import { ACCEPT, checkFileClient, fileIcon } from '../utils/fileTypes.js';
import { formatBytes } from '../utils/format.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Modal from '../components/Modal.jsx';
import LinkForm from '../components/LinkForm.jsx';
import LinkFilterBar from '../components/LinkFilterBar.jsx';
import { safeUrl } from '../utils/safeUrl.js';

function ViewToggle({ view, onChange }) {
  return (
    <div className="flex items-center bg-surface-container-low rounded-full p-1">
      <button
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] transition-colors ${
          view === 'documentos' ? 'bg-surface shadow-sm font-semibold' : 'text-on-surface-variant font-medium'
        }`}
        onClick={() => onChange('documentos')}
      >
        <span className="msi text-[16px]">description</span>Documentos
      </button>
      <button
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] transition-colors ${
          view === 'links' ? 'bg-surface shadow-sm font-semibold' : 'text-on-surface-variant font-medium'
        }`}
        onClick={() => onChange('links')}
      >
        <span className="msi text-[16px]">link</span>Links
      </button>
    </div>
  );
}

export default function DocumentosLinksPage() {
  const { id } = useParams();
  const [view, setView] = useState('documentos');

  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([listDocuments(id), listLinks(id), listTags(id), getTrip(id)]).then(
        ([documents, links, tags, trip]) => ({ documents, links, tags, trip })
      ),
    [id]
  );

  const fileRef = useRef(null);
  const [activityId, setActivityId] = useState('');
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [linkModal, setLinkModal] = useState(null); // { link? }
  const [selectedTags, setSelectedTags] = useState([]);
  const [actionError, setActionError] = useState(null);
  const [confirmNode, confirm] = useConfirm();

  const run = async (fn) => {
    setActionError(null);
    try {
      await fn();
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} onRetry={reload} />;

  const { documents, links, tags, trip } = data;
  const activities = (trip.days || []).flatMap((d) => d.activities.map((a) => ({ id: a.id, label: a.title })));
  const filteredLinks =
    selectedTags.length === 0 ? links : links.filter((l) => l.tags.some((t) => selectedTags.includes(t.name)));

  const toggleTag = (name) =>
    setSelectedTags((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]));

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

  const handleDeleteDoc = async (doc) => {
    const ok = await confirm({ title: 'Eliminar documento', message: `¿Eliminar "${doc.title}"? El archivo se borra definitivamente.` });
    if (!ok) return;
    run(() => deleteDocument(doc.id));
  };

  const handleSubmitLink = (payload) =>
    run(async () => {
      if (linkModal.link) await updateLink(linkModal.link.id, payload);
      else await createLink(id, payload);
      setLinkModal(null);
    });

  const handleDeleteLink = async (l) => {
    const ok = await confirm({ title: 'Eliminar link', message: `¿Eliminar "${l.title}"?` });
    if (!ok) return;
    run(() => deleteLink(l.id));
  };

  return (
    <div className="px-6 py-6">
      {actionError && <ErrorMessage error={actionError} />}

      <div className="row-between mb-4">
        <h1 className="text-[22px] font-bold">Documentos &amp; Links</h1>
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={setView} />
          {view === 'documentos' ? (
            <button className="btn" onClick={() => fileRef.current?.parentElement?.scrollIntoView({ behavior: 'smooth' })}>
              <span className="msi text-[16px]">upload</span>Subir
            </button>
          ) : (
            <button className="btn" onClick={() => setLinkModal({})}>
              <span className="msi text-[16px]">add</span>Agregar link
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl">
      {view === 'documentos' ? (
        <>
          <form className="card mb-4" onSubmit={handleUpload}>
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
            <div className="row-between justify-end">
              <button type="submit" className="btn" disabled={uploading}>
                {uploading ? 'Subiendo…' : 'Subir documento'}
              </button>
            </div>
          </form>

          {documents.length === 0 ? (
            <div className="empty-state">Todavía no subiste documentos a este viaje.</div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-outline-variant/20">
                  <div className="w-10 h-10 rounded-lg bg-tertiary-container flex items-center justify-center shrink-0">
                    <span className="msi text-[20px] text-tertiary">{fileIcon(doc.file_type)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{doc.title}</div>
                    <div className="text-[11px] text-on-surface-variant">
                      {doc.activity_title ? `Vinculado a: ${doc.activity_title}` : 'Sin actividad vinculada'}
                    </div>
                  </div>
                  <button className="btn-icon msi text-[18px] text-on-surface-variant" onClick={() => handleDownload(doc)} aria-label="Descargar">
                    download
                  </button>
                  <button className="btn-icon msi text-[18px] text-error" onClick={() => handleDeleteDoc(doc)} aria-label="Eliminar">
                    delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {links.length > 0 && (
            <LinkFilterBar tags={tags} selected={selectedTags} onToggle={toggleTag} onClear={() => setSelectedTags([])} />
          )}

          {links.length === 0 ? (
            <div className="empty-state">Todavía no guardaste links.</div>
          ) : filteredLinks.length === 0 ? (
            <div className="empty-state">
              Ningún link coincide con el filtro.{' '}
              <button className="btn-link" onClick={() => setSelectedTags([])}>
                Limpiar filtro
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLinks.map((l) => (
                <div key={l.id} className="card">
                  <div className="row-between">
                    <div className="min-w-0">
                      <div className="font-semibold text-[15px]">{l.title}</div>
                      {l.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {l.tags.map((t) => (
                            <span className="tag" key={t.id}>
                              {t.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {safeUrl(l.url) && (
                        <a
                          className="btn-link inline-block mt-1.5"
                          href={safeUrl(l.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Abrir link
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button className="btn btn-secondary btn-sm" onClick={() => setLinkModal({ link: l })}>
                        Editar
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteLink(l)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </div>

      {confirmNode}

      {linkModal && (
        <Modal title={linkModal.link ? 'Editar link' : 'Nuevo link'} onClose={() => setLinkModal(null)}>
          <LinkForm
            initial={linkModal.link}
            existingTags={tags.map((t) => t.name)}
            onSubmit={handleSubmitLink}
            onCancel={() => setLinkModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
