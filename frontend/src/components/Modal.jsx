import { useEffect } from 'react';

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-on-surface/45 flex items-start justify-center p-4 sm:p-12 z-50 overflow-y-auto"
      onMouseDown={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-lg w-full max-w-[480px] p-6 max-h-[calc(100vh-6rem)] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="row-between mb-4">
          <h2 className="m-0 text-[17px] font-bold">{title}</h2>
          <button className="btn-icon msi text-[18px] text-on-surface-variant" onClick={onClose} aria-label="Cerrar">
            close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
