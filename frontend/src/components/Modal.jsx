import { useEffect } from 'react';

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(20, 30, 50, 0.45)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '3rem 1rem',
  zIndex: 50,
  overflowY: 'auto',
};

const panel = {
  background: 'var(--surface)',
  borderRadius: 'var(--radius)',
  boxShadow: '0 10px 40px rgba(20, 30, 50, 0.25)',
  width: '100%',
  maxWidth: '480px',
  padding: '1.5rem',
  maxHeight: 'calc(100vh - 6rem)',
  overflowY: 'auto',
};

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={panel} onMouseDown={(e) => e.stopPropagation()}>
        <div className="row-between" style={{ marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h2>
          <button className="btn-link" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
