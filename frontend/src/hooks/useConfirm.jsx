import { useCallback, useState } from 'react';
import Modal from '../components/Modal.jsx';

/**
 * Promise-based confirmation dialog.
 *   const [confirmNode, confirm] = useConfirm();
 *   if (await confirm({ message: '¿Eliminar?' })) { ... }
 * Render {confirmNode} once in the component.
 */
export function useConfirm() {
  const [state, setState] = useState(null); // { message, title, confirmLabel, resolve }

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setState({
        title: opts.title || 'Confirmar',
        message: opts.message || '¿Estás seguro?',
        confirmLabel: opts.confirmLabel || 'Eliminar',
        resolve,
      });
    });
  }, []);

  const close = (result) => {
    state?.resolve(result);
    setState(null);
  };

  const node = state ? (
    <Modal title={state.title} onClose={() => close(false)}>
      <p style={{ marginTop: 0 }}>{state.message}</p>
      <div className="row-between" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={() => close(false)}>
          Cancelar
        </button>
        <button className="btn btn-danger" onClick={() => close(true)}>
          {state.confirmLabel}
        </button>
      </div>
    </Modal>
  ) : null;

  return [node, confirm];
}
