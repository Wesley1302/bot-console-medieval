import { useEffect, useState } from 'react';
import { AlertTriangle, Pause, Play, Square } from 'lucide-react';
import {
  getCleanupJob,
  previewCleanup,
  startCleanup,
  updateCleanupJob,
} from '../../api/cleanup.api.js';
import { Button } from '../ui/Button.jsx';
import { Loading } from '../ui/Loading.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Toast } from '../ui/Toast.jsx';

const terminal = new Set(['completed', 'partial', 'failed', 'cancelled']);

export function CleanupModal({ target, onClose }) {
  const [preview, setPreview] = useState(null);
  const [job, setJob] = useState(null);
  const [confirmationText, setConfirmationText] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!target) return undefined;
    let active = true;
    setStatus('loading');
    previewCleanup(target)
      .then((payload) => {
        if (!active) return;
        setPreview(payload);
        setStatus('ready');
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message);
        setStatus('error');
      });
    return () => { active = false; };
  }, [target]);

  useEffect(() => {
    if (!job?.id || terminal.has(job.status)) return undefined;
    const interval = window.setInterval(() => {
      getCleanupJob(job.id).then(setJob).catch((requestError) => setError(requestError.message));
    }, 1_500);
    return () => window.clearInterval(interval);
  }, [job?.id, job?.status]);

  async function begin() {
    setError('');
    setStatus('submitting');
    try {
      const created = await startCleanup({
        previewId: preview.previewId,
        confirmationToken: preview.confirmationToken,
        confirmationText,
      });
      setJob(created);
      setStatus('ready');
    } catch (requestError) {
      setError(requestError.message);
      setStatus('ready');
    }
  }

  async function action(name) {
    try {
      setJob(await updateCleanupJob(job.id, name));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const processedWork = (job?.processedMessages || 0) + (job?.processedThreads || 0);
  const estimatedWork = (job?.estimatedMessages || 0) + (job?.estimatedThreads || 0);

  return (
    <Modal open={Boolean(target)} title="Limpar mensagens" onClose={onClose}>
      <div className="cleanup-modal">
        {status === 'loading' && <Loading label="Calculando escopo" />}
        {error && <Toast tone="error">{error}</Toast>}
        {preview && !job && (
          <>
            <div className="cleanup-warning">
              <AlertTriangle size={20} />
              <div>
                <strong>Acao irreversivel</strong>
                <p>
                  As mensagens serao apagadas do Discord e removidas do indice local.
                  {preview.estimatedThreads > 0
                    ? ` ${preview.estimatedThreads} topico(s) serao excluidos por inteiro.`
                    : ''}
                </p>
              </div>
            </div>
            <dl className="cleanup-summary">
              <div><dt>Alvo</dt><dd>{preview.target.name}</dd></div>
              <div><dt>Tipo</dt><dd>{preview.target.type}</dd></div>
              <div><dt>Mensagens diretas</dt><dd>{preview.estimatedMessages}</dd></div>
              <div><dt>Topicos a excluir</dt><dd>{preview.estimatedThreads || 0}</dd></div>
              <div><dt>Locais afetados</dt><dd>{preview.resolvedTargets.length}</dd></div>
              <div><dt>Inacessiveis</dt><dd>{preview.inaccessibleTargets.length}</dd></div>
            </dl>
            <div className="cleanup-targets" aria-label="Locais afetados">
              {preview.resolvedTargets.map((item) => (
                <span key={item.id}>{item.name}</span>
              ))}
            </div>
            {preview.threadsToDelete?.length > 0 && (
              <div className="cleanup-targets" aria-label="Topicos que serao excluidos">
                {preview.threadsToDelete.map((item) => (
                  <span key={item.id}>{item.name}</span>
                ))}
              </div>
            )}
            {preview.confirmationText && (
              <label className="field">
                <span>Digite exatamente: <strong>{preview.confirmationText}</strong></span>
                <input
                  autoComplete="off"
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value)}
                />
              </label>
            )}
            <div className="modal__actions">
              <Button className="button--ghost" onClick={onClose}>Cancelar</Button>
              <Button
                className="button--danger"
                disabled={status === 'submitting'
                  || Boolean(preview.confirmationText && confirmationText !== preview.confirmationText)}
                onClick={begin}
              >
                Iniciar limpeza
              </Button>
            </div>
          </>
        )}
        {job && (
          <>
            <div className="job-progress">
              <div className="job-progress__header">
                <strong>{job.status}</strong>
                <span>{processedWork}/{estimatedWork || '?'}</span>
              </div>
              <progress
                max={Math.max(estimatedWork || processedWork || 1, 1)}
                value={processedWork}
              />
            </div>
            <dl className="cleanup-summary">
              <div><dt>Processadas</dt><dd>{job.processedMessages}</dd></div>
              <div><dt>Excluidas</dt><dd>{job.deletedMessages}</dd></div>
              <div><dt>Falhas</dt><dd>{job.failedMessages}</dd></div>
              <div><dt>Ignoradas</dt><dd>{job.skippedMessages}</dd></div>
              <div><dt>Topicos excluidos</dt><dd>{job.deletedThreads || 0}</dd></div>
              <div><dt>Falhas em topicos</dt><dd>{job.failedThreads || 0}</dd></div>
            </dl>
            {job.error && <Toast tone="error">{job.error}</Toast>}
            {!terminal.has(job.status) && (
              <div className="modal__actions">
                {job.status === 'paused' ? (
                  <Button onClick={() => action('resume')}><Play size={16} /> Retomar</Button>
                ) : (
                  <Button className="button--ghost" onClick={() => action('pause')}>
                    <Pause size={16} /> Pausar
                  </Button>
                )}
                <Button className="button--danger" onClick={() => action('cancel')}>
                  <Square size={16} /> Cancelar
                </Button>
              </div>
            )}
            {terminal.has(job.status) && (
              <div className="modal__actions"><Button onClick={onClose}>Fechar</Button></div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
