import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button.jsx';

export function Modal({ open, title, children, onClose }) {
  const closeRef = useRef(null);
  const backdropRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const modal = event.currentTarget;
      const focusable = [...modal.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter((item) => !item.disabled);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    const backdrop = backdropRef.current;
    backdrop?.addEventListener('keydown', handleKeyDown);
    return () => {
      backdrop?.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = bodyOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={backdropRef} className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal">
        <header className="modal__header">
          <h2 id="modal-title">{title}</h2>
          <Button ref={closeRef} className="button--ghost" onClick={onClose} aria-label="Fechar">
            <X size={16} />
          </Button>
        </header>
        {children}
      </div>
    </div>
  );
}
