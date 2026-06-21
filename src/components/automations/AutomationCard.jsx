import { useState } from 'react';
import { ChevronDown, ChevronRight, Pause, Play, Square, Trash2 } from 'lucide-react';
import { deleteAutomation, updateAutomationAction } from '../../api/automations.api.js';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { Toast } from '../ui/Toast.jsx';

const statusLabel = {
  running: 'Rodando',
  paused: 'Pausada',
  done: 'Concluida',
  cancelled: 'Cancelada',
  error: 'Erro',
  queued: 'Na fila',
  sending: 'Enviando',
  sent: 'Enviada',
};

function formatDate(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : 'sem data';
}

function formatInterval(seconds) {
  if (!seconds) return 'agendado';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${Math.round(seconds / 3600)}h`;
}

function messageCountLabel(count) {
  return `${count} ${count === 1 ? 'mensagem' : 'mensagens'}`;
}

function estimatedLabel(automation) {
  if (automation.mode === 'scheduled') return automation.scheduledAt ? formatDate(automation.scheduledAt) : 'sem data';
  return formatInterval(Math.max(0, (automation.totalMessages - 1) * automation.intervalSeconds));
}

function progressPercent(automation) {
  if (!automation.totalMessages) return 0;
  return Math.round((automation.sentCount / automation.totalMessages) * 100);
}

function statusText(automation) {
  if (automation.mode === 'scheduled' && automation.status === 'running') return 'Agendada';
  return statusLabel[automation.status] || automation.status;
}

export function AutomationCard({ automation, onChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const progress = progressPercent(automation);

  async function runAction(action) {
    if (action === 'cancel' && !window.confirm('Cancelar esta automacao?')) return;
    setBusy(action);
    setError('');
    try {
      await updateAutomationAction(automation.id, action);
      onChanged?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  async function removeAutomation() {
    if (!window.confirm('Remover esta automacao local?')) return;
    setBusy('delete');
    setError('');
    try {
      await deleteAutomation(automation.id);
      onChanged?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <article className="automation-card">
      <header className="automation-card__header">
        <div>
          <h3>{automation.channelName || automation.channelId}</h3>
          <p>Criada em {formatDate(automation.createdAt)}</p>
        </div>
        <Badge tone={automation.status}>{statusText(automation)}</Badge>
      </header>

      {error && <Toast tone="error">{error}</Toast>}
      {automation.lastError && <Toast tone="error">{automation.lastError}</Toast>}

      <div className="automation-card__metrics">
        <span>{automation.sentCount} / {automation.totalMessages} enviadas</span>
        <span>Intervalo: {formatInterval(automation.intervalSeconds)}</span>
        <span>Proxima: {automation.nextRunAt ? formatDate(automation.nextRunAt) : 'sem agendamento'}</span>
      </div>

      <div className="progress-track" aria-label={`Progresso ${progress}%`}>
        <div style={{ width: `${progress}%` }} />
      </div>

      <div className="automation-preview">
        <strong>{messageCountLabel(automation.totalMessages || 0)}</strong>
        <span>Intervalo: {formatInterval(automation.intervalSeconds)}</span>
        <span>Tempo estimado: {estimatedLabel(automation)}</span>
        <span>Total de caracteres: {automation.totalCharacters || 0}</span>
        {automation.mode === 'scheduled' && (
          <span>Será enviada em: {automation.scheduledAt ? formatDate(automation.scheduledAt) : 'sem data'}</span>
        )}
      </div>

      <div className="automation-card__actions">
        {automation.status === 'running' && (
          <>
            <Button className="button--ghost" disabled={Boolean(busy)} onClick={() => runAction('pause')}><Pause size={15} />Pausar</Button>
            <Button className="button--ghost" disabled={Boolean(busy)} onClick={() => runAction('cancel')}><Square size={15} />Cancelar</Button>
          </>
        )}
        {['paused', 'error'].includes(automation.status) && (
          <>
            <Button className="button--ghost" disabled={Boolean(busy)} onClick={() => runAction('resume')}><Play size={15} />Retomar</Button>
            <Button className="button--ghost" disabled={Boolean(busy)} onClick={() => runAction('cancel')}><Square size={15} />Cancelar</Button>
          </>
        )}
        {['done', 'cancelled'].includes(automation.status) && (
          <Button className="button--ghost" disabled={Boolean(busy)} onClick={removeAutomation}><Trash2 size={15} />Remover</Button>
        )}
        <Button className="button--ghost" onClick={() => setExpanded((open) => !open)}>
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          Mensagens
        </Button>
      </div>

      {expanded && (
        <div className="automation-message-list">
          {(automation.messages || []).map((message) => (
            <div className="automation-message-row" key={message.id}>
              <Badge tone={message.status}>{statusLabel[message.status] || message.status}</Badge>
              <span>{message.position + 1}. {message.content}</span>
              {message.sentAt && <time>{formatDate(message.sentAt)}</time>}
              {message.error && <strong>{message.error}</strong>}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
