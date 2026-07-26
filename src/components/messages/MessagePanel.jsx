import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Download, Hash, RefreshCw, Search } from 'lucide-react';
import { getChannelThreads } from '../../api/channels.api.js';
import { createExport } from '../../api/exports.api.js';
import { deleteMessage, editMessage, getMessages } from '../../api/messages.api.js';
import { ForumThreadList } from '../forums/ForumThreadList.jsx';
import { Button } from '../ui/Button.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Loading } from '../ui/Loading.jsx';
import { Toast } from '../ui/Toast.jsx';
import { Composer } from './Composer.jsx';
import { EditMessageModal } from './EditMessageModal.jsx';
import { MessageList } from './MessageList.jsx';
import { mergeLatestMessages, prependOlderMessages } from './messageMerge.js';

function canExportChannel(channel) {
  return ['text', 'announcement', 'thread', 'forum', 'category'].includes(channel?.type);
}

function MessageContextMenu({ menu, onClose, onDelete, onEdit }) {
  if (!menu) return null;
  const canEdit = Boolean(menu.message.author?.bot);
  return (
    <div className="context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
      {canEdit && (
        <button type="button" onClick={() => { onEdit(menu.message); onClose(); }}>
          Editar
        </button>
      )}
      <button type="button" onClick={() => { onDelete(menu.message); onClose(); }}>
        Apagar
      </button>
    </div>
  );
}

export function MessagePanel({
  activeThreads = [],
  selectedChannel,
  onBackToChannels,
  onExportStarted,
  onSelectChannel,
}) {
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState('idle');
  const [olderStatus, setOlderStatus] = useState('idle');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [messageQuery, setMessageQuery] = useState('');
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [channelThreads, setChannelThreads] = useState([]);
  const [threadWarnings, setThreadWarnings] = useState([]);
  const [messageMenu, setMessageMenu] = useState(null);
  const [refreshStatus, setRefreshStatus] = useState('idle');
  const refreshInFlightRef = useRef(false);
  const refreshAbortRef = useRef(null);
  const selectionGenerationRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const generation = ++selectionGenerationRef.current;
    async function loadMessages() {
      if (!selectedChannel?.messageable) return;
      setStatus('loading');
      setError('');
      setMessages([]);
      setHasMore(false);
      try {
        const payload = await getMessages(selectedChannel.id, { limit: 50, signal: controller.signal });
        if (controller.signal.aborted || generation !== selectionGenerationRef.current) return;
        setMessages(payload.messages || []);
        setHasMore(Boolean(payload.hasMore));
        setStatus('ready');
      } catch (requestError) {
        if (requestError.name === 'AbortError' || controller.signal.aborted || generation !== selectionGenerationRef.current) return;
        setStatus('error');
        setError(requestError.message);
      }
    }

    setMessageQuery('');
    setThreadsOpen(false);
    loadMessages();
    return () => controller.abort();
  }, [selectedChannel?.id, selectedChannel?.messageable]);

  useEffect(() => {
    function closeMenu() {
      setMessageMenu(null);
    }

    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const active = selectedChannel?.id
      ? activeThreads.filter((thread) => thread.parentId === selectedChannel.id)
      : [];
    setChannelThreads(active);
    setThreadWarnings([]);

    if (!['text', 'announcement'].includes(selectedChannel?.type)) {
      return () => controller.abort();
    }

    getChannelThreads(selectedChannel.id, { signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setChannelThreads(payload.threads || []);
        setThreadWarnings(payload.warnings || []);
      })
      .catch((requestError) => {
        if (requestError.name === 'AbortError' || controller.signal.aborted) return;
        setThreadWarnings([requestError.message]);
      });

    return () => controller.abort();
  }, [activeThreads, selectedChannel?.id, selectedChannel?.type]);

  const visibleMessages = useMemo(() => {
    const query = messageQuery.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((message) => {
      const author = `${message.author?.serverName || ''} ${message.author?.displayName || ''} ${message.author?.globalName || ''} ${message.author?.username || ''}`.toLowerCase();
      return author.includes(query) || (message.content || '').toLowerCase().includes(query);
    });
  }, [messageQuery, messages]);

  const refreshLatestMessages = useCallback(async ({ manual = false } = {}) => {
    if (!selectedChannel?.messageable || refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    const controller = new AbortController();
    refreshAbortRef.current?.abort();
    refreshAbortRef.current = controller;
    setRefreshStatus('loading');
    if (manual) setError('');
    try {
      const payload = await getMessages(selectedChannel.id, { limit: 50, signal: controller.signal });
      const latestMessages = payload.messages || [];
      if (controller.signal.aborted) return;
      setMessages((current) => mergeLatestMessages(current, latestMessages));
      setHasMore(Boolean(payload.hasMore));
      if (manual) {
        setToast('Canal atualizado.');
        window.setTimeout(() => setToast(''), 1400);
      }
    } catch (requestError) {
      if (manual && requestError.name !== 'AbortError') setError(requestError.message);
    } finally {
      if (refreshAbortRef.current === controller) refreshAbortRef.current = null;
      refreshInFlightRef.current = false;
      setRefreshStatus('idle');
    }
  }, [selectedChannel?.id, selectedChannel?.messageable]);

  useEffect(() => {
    if (status !== 'ready' || !selectedChannel?.messageable) return undefined;
    const timer = window.setInterval(() => {
      refreshLatestMessages();
    }, 5000);

    return () => {
      window.clearInterval(timer);
      refreshAbortRef.current?.abort();
    };
  }, [refreshLatestMessages, selectedChannel?.id, selectedChannel?.messageable, status]);

  async function loadOlderMessages() {
    if (!messages.length || olderStatus === 'loading') return;
    setOlderStatus('loading');
    setError('');
    try {
      const payload = await getMessages(selectedChannel.id, { limit: 50, before: messages[0].id });
      const olderMessages = payload.messages || [];
      setMessages((current) => {
        return prependOlderMessages(current, olderMessages);
      });
      setHasMore(Boolean(payload.hasMore));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setOlderStatus('idle');
    }
  }

  function addSentMessage(sentMessages) {
    const list = Array.isArray(sentMessages) ? sentMessages.filter(Boolean) : [sentMessages].filter(Boolean);
    setMessages((current) => {
      const sentIds = new Set(list.map((message) => message.id));
      return [...current.filter((item) => !sentIds.has(item.id)), ...list];
    });
    setToast('Mensagem enviada.');
    window.setTimeout(() => setToast(''), 1800);
  }

  async function saveEditedMessage(content) {
    const result = await editMessage({ channelId: selectedChannel.id, messageId: editingMessage.id, content });
    setMessages((current) => current.map((message) => (message.id === result.message.id ? result.message : message)));
    setEditingMessage(null);
    setToast('Mensagem editada.');
    window.setTimeout(() => setToast(''), 1800);
  }

  async function removeMessage(message) {
    const author = message.author?.globalName || message.author?.username || 'Usuario';
    if (!window.confirm(`Apagar esta mensagem de ${author}?`)) return;
    setError('');
    try {
      await deleteMessage({ channelId: selectedChannel.id, messageId: message.id });
      setMessages((current) => current.filter((item) => item.id !== message.id));
      setToast('Mensagem apagada.');
      window.setTimeout(() => setToast(''), 1800);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function startExport() {
    if (!canExportChannel(selectedChannel)) return;
    setError('');
    try {
      const payload = await createExport({
        id: selectedChannel.id,
        name: selectedChannel.name,
        type: selectedChannel.type,
      });
      onExportStarted?.(payload.jobId);
      setToast('Exportacao iniciada.');
      window.setTimeout(() => setToast(''), 1800);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function exportThread(thread) {
    setError('');
    try {
      const payload = await createExport({ id: thread.id, name: thread.name, type: 'thread' });
      onExportStarted?.(payload.jobId);
      setToast('Exportacao iniciada.');
      window.setTimeout(() => setToast(''), 1800);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function openMessageMenu(message, x, y) {
    setMessageMenu({ message, x, y });
  }

  function renderChatHeader(subtitle) {
    return (
      <header className="chat-header">
        <button className="chat-header__back" type="button" onClick={onBackToChannels} aria-label="Voltar para canais">
          <ArrowLeft size={23} />
        </button>
        <div className="chat-header__title">
          <Hash size={25} />
          <div>
            <h2>{selectedChannel.name}</h2>
            <span>{subtitle}</span>
          </div>
        </div>
        {channelThreads.length > 0 && selectedChannel.messageable && (
          <button className="chat-header__icon" onClick={() => setThreadsOpen((open) => !open)} type="button" aria-label="Mostrar topicos">
            {threadsOpen ? <ChevronDown size={22} /> : <ChevronUp size={22} />}
          </button>
        )}
        {selectedChannel.messageable && (
          <button
            className="chat-header__icon"
            disabled={refreshStatus === 'loading'}
            onClick={() => refreshLatestMessages({ manual: true })}
            type="button"
            aria-label="Atualizar mensagens"
            title="Atualizar mensagens"
          >
            <RefreshCw className={refreshStatus === 'loading' ? 'is-spinning' : ''} size={20} />
          </button>
        )}
        <label className="chat-search">
          <Search size={18} />
          <input value={messageQuery} onChange={(event) => setMessageQuery(event.target.value)} placeholder="Buscar mensagens" />
        </label>
      </header>
    );
  }

  if (!selectedChannel) {
    return <EmptyState title="Escolha uma categoria, canal, forum ou topico." description="A lista lateral mostra a estrutura real do servidor Discord." />;
  }

  if (selectedChannel.type === 'voice') {
    return <EmptyState title="Canais de voz nao sao suportados nesta V1." description="Selecione um canal de texto, anuncio, forum ou topico." />;
  }

  if (selectedChannel.type === 'category') {
    return (
      <section className="message-panel">
        {renderChatHeader('Categoria Discord')}
        <EmptyState title="Escolha um canal dentro desta categoria." description="Use clique direito na categoria para baixar mensagens." />
      </section>
    );
  }

  if (selectedChannel.type === 'forum') {
    return (
      <section className="forum-panel">
        {renderChatHeader('Forum Discord')}
        {error && <Toast tone="error">{error}</Toast>}
        {toast && <Toast>{toast}</Toast>}
        <ForumThreadList forum={selectedChannel} onExportThread={exportThread} onSelectThread={onSelectChannel} />
      </section>
    );
  }

  return (
    <section className="message-panel">
      {renderChatHeader(selectedChannel.type === 'thread' ? 'Topico Discord' : 'Canal Discord')}

      {threadsOpen && (
        <div className="channel-thread-drawer">
          {threadWarnings.map((warning) => <Toast key={warning}>{warning}</Toast>)}
          {channelThreads.length > 0
            ? channelThreads.map((thread) => (
                <button key={thread.id} type="button" onClick={() => onSelectChannel(thread)}>
                  <Hash size={16} />
                  <span>{thread.name}</span>
                </button>
              ))
            : <span>Nenhum topico encontrado neste canal.</span>}
        </div>
      )}

      {error && <Toast tone="error">{error}</Toast>}
      {toast && <Toast>{toast}</Toast>}
      {status === 'loading' && <Loading label="Carregando mensagens" />}
      {status === 'error' && !messages.length && (
        <EmptyState title="Nao foi possivel carregar mensagens." description="Verifique token, permissao do bot e acesso ao canal." />
      )}

      {status === 'ready' && (
        <>
          {hasMore && (
            <Button className="button--ghost load-older" onClick={loadOlderMessages} disabled={olderStatus === 'loading'}>
              {olderStatus === 'loading' ? 'Carregando' : 'Carregar mensagens antigas'}
            </Button>
          )}
          <MessageList messages={visibleMessages} onContextMenu={openMessageMenu} onDelete={removeMessage} onEdit={setEditingMessage} />
          <Composer selectedChannel={selectedChannel} onMessageSent={addSentMessage} />
          <EditMessageModal message={editingMessage} onClose={() => setEditingMessage(null)} onSave={saveEditedMessage} />
        </>
      )}

      <button className="floating-export" onClick={startExport} type="button" aria-label="Exportar mensagens">
        <Download size={18} />
      </button>
      <MessageContextMenu
        menu={messageMenu}
        onClose={() => setMessageMenu(null)}
        onDelete={removeMessage}
        onEdit={setEditingMessage}
      />
    </section>
  );
}
