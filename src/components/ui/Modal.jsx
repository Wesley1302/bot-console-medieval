import { X } from 'lucide-react';
import { Button } from './Button.jsx';

export function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <header className="modal__header">
          <h2>{title}</h2>
          <Button className="button--ghost" onClick={onClose} aria-label="Fechar">
            <X size={16} />
          </Button>
        </header>
        {children}
      </div>
    </div>
  );
}
