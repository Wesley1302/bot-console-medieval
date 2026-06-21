import { useEffect, useMemo, useState } from 'react';
import { getChannels } from '../../api/channels.api.js';
import { createAutomation } from '../../api/automations.api.js';
import { Button } from '../ui/Button.jsx';
import { Toast } from '../ui/Toast.jsx';

const sampleText = 'Mensagem 1\n---\nMensagem 2\n---\nMensagem 3';

function flattenMessageableChannels(tree) {
  const options = [];
  for (const category of tree?.categories || []) {
    for (const channel of category.channels || []) {
      if (['text', 'announcement'].includes(channel.type)) {
        options.push({ id: channel.id, name: channel.name, label: `${category.name} / ${channel.name}`, type: channel.type });
      }
    }
  }
  for (const thread of tree?.activeThreads || []) {
    options.push({ id: thread.id, name: thread.name, label: `Topico ativo / ${thread.name}`, type: 'thread' });
  }
  return options;
}

function splitMessages(value) {
  return value
    .split(/\r?\n---\r?\n/g)
    .map((message) => message.trim())
    .filter(Boolean);
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  return `${Math.round(minutes / 60)}h`;
}

function messageCountLabel(count) {
  return `${count} ${count === 1 ? 'mensagem' : 'mensagens'}`;
}

function defaultScheduleValue() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function scheduleDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isAutomationTarget(channel) {
  return channel?.messageable && ['text', 'announcement', 'thread'].includes(channel.type);
}

export function AutomationForm({ selectedChannel, onCreated }) {
  const [channels, setChannels] = useState([]);
  const [channelId, setChannelId] = useState('');
  const [desktopMode, setDesktopMode] = useState(false);
  const [mode, setMode] = useState('sequence');
  const [intervalValue, setIntervalValue] = useState(60);
  const [unit, setUnit] = useState('seconds');
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleValue);
  const [body, setBody] = useState(sampleText);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 901px)');
    function syncDesktopMode() {
      setDesktopMode(mediaQuery.matches);
    }

    syncDesktopMode();
    mediaQuery.addEventListener('change', syncDesktopMode);
    return () => mediaQuery.removeEventListener('change', syncDesktopMode);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadChannels() {
      try {
        const tree = await getChannels();
        const options = flattenMessageableChannels(tree);
        if (!active) return;
        setChannels(options);
        setChannelId((current) => current || options[0]?.id || '');
      } catch (requestError) {
        if (active) setError(requestError.message);
      }
    }

    loadChannels();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isAutomationTarget(selectedChannel)) setChannelId(selectedChannel.id);
  }, [selectedChannel?.id]);

  const messages = useMemo(() => splitMessages(body), [body]);
  const totalCharacters = useMemo(() => messages.reduce((total, message) => total + message.length, 0), [messages]);
  const intervalSeconds = Math.max(1, Math.trunc(Number(intervalValue || 0) * (unit === 'minutes' ? 60 : 1)));
  const estimatedSeconds = mode === 'scheduled' ? 0 : Math.max(0, messages.length - 1) * intervalSeconds;
  const selectedOption = channels.find((channel) => channel.id === channelId);
  const selectedDesktopTarget = isAutomationTarget(selectedChannel) ? selectedChannel : null;
  const automationTarget = desktopMode ? selectedDesktopTarget : selectedOption;
  const scheduledDate = scheduleDate(scheduledAt);

  function validate() {
    if (!automationTarget?.id) return desktopMode
      ? 'Selecione um canal ou topico valido na lista da esquerda.'
      : 'Escolha um canal ou topico.';
    if (!messages.length) return 'Informe ao menos uma mensagem.';
    if (mode === 'scheduled' && messages.length !== 1) return 'Agendamento aceita uma mensagem por vez.';
    if (messages.length > 100) return 'Informe no maximo 100 mensagens.';
    if (mode === 'sequence' && intervalSeconds < 1) return 'Intervalo minimo e 1 segundo.';
    if (mode === 'sequence' && intervalSeconds > 86400) return 'Intervalo maximo e 86400 segundos.';
    if (mode === 'scheduled' && (!scheduledDate || scheduledDate.getTime() <= Date.now())) return 'Escolha uma data e hora futura.';
    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setStatus('creating');
    setError('');
    setSuccess('');
    try {
      const payload = await createAutomation({
        mode: mode === 'scheduled' ? 'scheduled' : 'sequence',
        channelId: automationTarget.id,
        channelName: automationTarget.name || null,
        intervalSeconds: mode === 'scheduled' ? 0 : intervalSeconds,
        scheduledAt: mode === 'scheduled' ? scheduledDate.toISOString() : null,
        messages,
      });
      setBody('');
      setSuccess('Automacao criada.');
      onCreated?.(payload.automation);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setStatus('idle');
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    if (nextMode === 'scheduled') {
      setBody((current) => splitMessages(current)[0] || '');
    }
  }

  return (
    <form className="automation-form" onSubmit={handleSubmit}>
      <div>
        <h3>Nova automacao</h3>
        <p>Envie mensagens de texto em sequencia com intervalo fixo.</p>
      </div>

      {error && <Toast tone="error">{error}</Toast>}
      {success && <Toast>{success}</Toast>}

      <div className="automation-mode-toggle" role="group" aria-label="Tipo de automacao">
        <button className={mode === 'sequence' ? 'is-active' : ''} onClick={() => changeMode('sequence')} type="button">Sequencia</button>
        <button className={mode === 'scheduled' ? 'is-active' : ''} onClick={() => changeMode('scheduled')} type="button">Agendada</button>
      </div>

      <div className="automation-target-selected">
        <span>Alvo selecionado</span>
        <strong>{selectedDesktopTarget?.name || 'Selecione um canal ou topico na esquerda'}</strong>
      </div>

      <label className="field automation-target-picker">
        <span>Canal ou topico alvo</span>
        <select value={channelId} onChange={(event) => setChannelId(event.target.value)}>
          <option value="">Selecione</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>{channel.label}</option>
          ))}
        </select>
      </label>

      {mode === 'sequence' ? (
        <div className="automation-form__interval">
          <label className="field">
            <span>Intervalo</span>
            <input min="1" type="number" value={intervalValue} onChange={(event) => setIntervalValue(event.target.value)} />
          </label>
          <label className="field">
            <span>Unidade</span>
            <select value={unit} onChange={(event) => setUnit(event.target.value)}>
              <option value="seconds">Segundos</option>
              <option value="minutes">Minutos</option>
            </select>
          </label>
        </div>
      ) : (
        <label className="field">
          <span>Data e hora de Brasilia</span>
          <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
        </label>
      )}

      <label className="field">
        <span>{mode === 'sequence' ? 'Mensagens, separe cada bloco com uma linha contendo apenas ---' : 'Mensagem agendada'}</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={mode === 'sequence' ? 12 : 8} />
      </label>

      <div className="automation-preview">
        <strong>{messageCountLabel(messages.length)}</strong>
        <span>Intervalo: {mode === 'scheduled' ? 'agendado' : formatDuration(intervalSeconds)}</span>
        <span>Tempo estimado: {mode === 'scheduled' ? (scheduledDate ? scheduledDate.toLocaleString('pt-BR') : 'data invalida') : formatDuration(estimatedSeconds)}</span>
        <span>Total de caracteres: {totalCharacters}</span>
        {mode === 'scheduled' && (
          <span>Será enviada em: {scheduledDate ? scheduledDate.toLocaleString('pt-BR') : 'data invalida'}</span>
        )}
      </div>

      <Button disabled={status === 'creating'} type="submit">
        {status === 'creating' ? 'Criando...' : 'Criar Automacao'}
      </Button>
    </form>
  );
}
