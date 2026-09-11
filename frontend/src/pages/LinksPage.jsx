import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { getTrip } from '../services/trips.js';
import { listLinks, listTags, createLink, updateLink, deleteLink } from '../services/links.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Modal from '../components/Modal.jsx';
import LinkForm from '../components/LinkForm.jsx';
import LinkFilterBar from '../components/LinkFilterBar.jsx';
import TripTabs from '../components/TripTabs.jsx';
import { safeUrl } from '../utils/safeUrl.js';

export default function LinksPage() {
  const { id } = useParams();

  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([listLinks(id), listTags(id), getTrip(id)]).then(([links, tags, trip]) => ({
        links,
        tags,
        trip,
      })),
    [id]
  );

  const [modal, setModal] = useState(null); // { link? }
  const [actionError, setActionError] = useState(null);
  const [confirmNode, confirm] = useConfirm();
  const [selectedTags, setSelectedTags] = useState([]);

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

  const { links, tags, trip } = data;
  const filteredLinks =
    selectedTags.length === 0
      ? links
      : links.filter((l) => l.tags.some((t) => selectedTags.includes(t.name)));

  const toggleTag = (name) =>
    setSelectedTags((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]));

  const handleSubmit = (payload) =>
    run(async () => {
      if (modal.link) await updateLink(modal.link.id, payload);
      else await createLink(id, payload);
      setModal(null);
    });

  const handleDelete = async (l) => {
    const ok = await confirm({ title: 'Eliminar link', message: `¿Eliminar "${l.title}"?` });
    if (!ok) return;
    run(() => deleteLink(l.id));
  };

  return (
    <div>
      <TripTabs tripId={id} />

      {actionError && <ErrorMessage error={actionError} />}

      <div className="row-between" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.2rem' }}>Links de interés</h1>
          <div className="muted">{trip.name}</div>
        </div>
        <button className="btn" onClick={() => setModal({})}>
          + Link
        </button>
      </div>

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
        filteredLinks.map((l) => (
          <div className="card" key={l.id}>
            <div className="row-between">
              <div>
                <h3 style={{ marginBottom: '0.15rem' }}>{l.title}</h3>
                {l.tags.length > 0 && (
                  <div className="stack-sm" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.3rem' }}>
                    {l.tags.map((t) => (
                      <span className="tag" key={t.id}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
                {safeUrl(l.url) && (
                  <div className="muted">
                    <a href={safeUrl(l.url)} target="_blank" rel="noopener noreferrer">
                      abrir link
                    </a>
                  </div>
                )}
              </div>
              <div className="activity-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => setModal({ link: l })}>
                  Editar
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(l)}>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {confirmNode}

      {modal && (
        <Modal title={modal.link ? 'Editar link' : 'Nuevo link'} onClose={() => setModal(null)}>
          <LinkForm
            initial={modal.link}
            existingTags={tags.map((t) => t.name)}
            onSubmit={handleSubmit}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
