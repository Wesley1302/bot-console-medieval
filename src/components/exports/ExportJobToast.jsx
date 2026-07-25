import { useEffect, useRef, useState } from 'react';
import { getExportJob } from '../../api/exports.api.js';
import { Toast } from '../ui/Toast.jsx';

export function ExportJobToast({ jobId, onDone }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    if (!jobId) return undefined;
    let active = true;
    let intervalId = 0;
    let timeoutId = 0;
    const controller = new AbortController();
    setVisible(true);
    setError('');

    async function poll() {
      try {
        const payload = await getExportJob(jobId, { signal: controller.signal });
        if (!active) return;
        setJob(payload);
        if (payload.status === 'done' || payload.status === 'error') {
          window.clearInterval(intervalId);
          if (payload.status === 'done') onDoneRef.current?.(payload);
          timeoutId = window.setTimeout(() => {
            if (active) setVisible(false);
          }, 4200);
        }
      } catch (requestError) {
        if (!active || requestError.name === 'AbortError') return;
        setError(requestError.message);
        window.clearInterval(intervalId);
      }
    }

    poll();
    intervalId = window.setInterval(poll, 900);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [jobId]);

  if (!visible || (!job && !error)) return null;

  const done = job?.status === 'done';
  const failed = job?.status === 'error' || error;
  const title = failed ? 'Exportacao falhou' : done ? 'Exportacao concluida' : 'Exportando mensagens';
  const detail = error || job?.error || job?.step || 'Preparando arquivos';

  return (
    <div className="export-toast">
      <Toast tone={failed ? 'error' : 'default'}>
        <strong>{title}</strong>
        <span>{detail}</span>
        {job && !failed && (
          <div className="progress-track" aria-label={`Progresso ${job.progress}%`}>
            <div style={{ width: `${job.progress || 0}%` }} />
          </div>
        )}
      </Toast>
    </div>
  );
}
