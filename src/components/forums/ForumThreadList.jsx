import { useEffect, useRef, useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import { getForumThreads } from '../../api/channels.api.js';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Loading } from '../ui/Loading.jsx';
import { Toast } from '../ui/Toast.jsx';

function ThreadRow({ onExportThread, onSelectThread, thread }) {
  const timerRef = useRef(null);

  function startLongPress(_event) {
    timerRef.current = window.setTimeout(() => {
      onExportThread?.(thread);
    }, 520);
  }

  function stopLongPress() {
    window.clearTimeout(timerRef.current);
  }

  return (
    <button
      className="thread-row"
      onClick={() => onSelectThread(thread)}
      onContextMenu={(event) => {
        event.preventDefault();
        onExportThread?.(thread);
      }}
      onPointerDown={startLongPress}
      onPointerLeave={stopLongPress}
      onPointerUp={stopLongPress}
      type="button"
    >
      <MessagesSquare size={17} />
      <span>{thread.name}</span>
      {thread.archived && <em>arquivado</em>}
    </button>
  );
}

export function ForumThreadList({ forum, onExportThread, onSelectThread }) {
  const [threads, setThreads] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function loadThreads() {
      setStatus('loading');
      setError('');
      try {
        const payload = await getForumThreads(forum.id, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setThreads(payload.threads || []);
        setWarnings(payload.warnings || []);
        setStatus((payload.threads || []).length ? 'ready' : 'empty');
      } catch (requestError) {
        if (requestError.name === 'AbortError' || controller.signal.aborted) return;
        setStatus('error');
        setError(requestError.message);
      }
    }

    if (forum?.id) loadThreads();
    return () => controller.abort();
  }, [forum?.id]);

  return (
    <section className="forum-thread-list">
      {warnings.map((warning) => <Toast key={warning}>{warning}</Toast>)}
      {status === 'loading' && <Loading label="Carregando topicos" />}
      {status === 'error' && <Toast tone="error">{error}</Toast>}
      {status === 'empty' && <EmptyState title="Forum sem topicos" description="Nenhum topico ativo ou arquivado foi encontrado." />}

      {status === 'ready' && (
        <div className="thread-list">
          {threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              onExportThread={onExportThread}
              onSelectThread={onSelectThread}
              thread={thread}
            />
          ))}
        </div>
      )}
    </section>
  );
}
