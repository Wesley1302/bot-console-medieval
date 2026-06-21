import { useEffect, useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Toast } from '../ui/Toast.jsx';

export function EditMessageModal({ message, onClose = () => {}, onSave }) {
  const [content, setContent] = useState(message?.content || '');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const open = Boolean(message);

  useEffect(() => {
    setContent(message?.content || '');
    setStatus('idle');
    setError('');
  }, [message?.id, message?.content]);

  async function saveEdit() {
    const text = content.trim();
    if (!text || text.length > 2000 || status === 'saving') return;
    setStatus('saving');
    setError('');
    try {
      await onSave(text);
    } catch (requestError) {
      setError(requestError.message);
      setStatus('idle');
    }
  }

  return (
    <Modal open={open} title="Editar mensagem" onClose={onClose}>
      <div className="edit-form">
        <textarea onChange={(event) => setContent(event.target.value)} value={content} />
        <small>{content.length}/2000</small>
        {error && <Toast tone="error">{error}</Toast>}
        <div className="modal-actions">
          <Button className="button--ghost" onClick={onClose} disabled={status === 'saving'}>Cancelar</Button>
          <Button onClick={saveEdit} disabled={!content.trim() || content.length > 2000 || status === 'saving'}>
            {status === 'saving' ? 'Salvando' : 'Salvar alteracao'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
