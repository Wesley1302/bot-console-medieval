import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Download, Hash, RefreshCw, Search } from 'lucide-react';
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
  const [messageMenu, setMessageMenu] = useState(null);
  const [refreshStatus, setRefreshStatus] = useState('idle');

  useEffect(() => {
    async function loadMessages() {
      if (!selectedChannel?.messageable) return;
      setStatus('loading');
      setError('');
      setMessages([]);
      setHasMore(false);
      try {
        const payload = await getMessages(selectedChannel.id, { limit: 50 });
        setMessages(payload.messages || []);
        setHasMore(Boolean(payload.hasMore));
        setStatus('ready');
      } catch (requestError) {
        setStatus('error');
        setError(requestError.message);
      }
    }

    setMessageQuery('');
    setThreadsOpen(false);
    loadMessages();
  }, [selectedChannel?.id, selectedChannel?.messageable]);

  useEffect(() => {
    function closeMenu() {
      setMessageMenu(null);
    }

    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const channelThreads = useMemo(() => {
    if (!selectedChannel?.id) return [];
    return activeThreads.filter((thread) => thread.parentId === selectedChannel.id);
  }, [activeThreads, selectedChannel?.id]);

  const visibleMessages = useMemo(() => {
    const query = messageQuery.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((message) => {
      const author = `${message.author?.serverName || ''} ${message.author?.displayName || ''} ${message.author?.globalName || ''} ${message.author?.username || ''}`.toLowerCase();
      return author.includes(query) || (message.content || '').toLowerCase().includes(query);
    });
  }, [messageQuery, messages]);

  async function refreshLatestMessages({ manual = false } = {}) {
    if (!selectedChannel?.messageable || refreshStatus === 'loading') return;
    setRefreshStatus('loading');
    if (manual) setError('');
    try {
      const payload = await getMessages(selectedChannel.id, { limit: 50 });
      const latestMessages = payload.messages || [];
      setMessages((current) => {
        if (!current.length) return latestMessages;
        if (!latestMessages.length) return [];

        const latestIds = new Set(latestMessages.map((message) => message.id));
        const firstLatestId = latestMessages[0]?.id;
        const boundaryIndex = current.findIndex((message) => message.id === firstLatestId);
        const olderMessages = boundaryIndex >= 0
          ? current.slice(0, boundaryIndex)
          : current.filter((message) => !latestIds.has(message.id) && new Date(message.timestamp || 0) < new Date(latestMessages[0]?.timestamp || 0));

        return [...olderMessages, ...latestMessages];
      });
      setHasMore(Boolean(payload.hasMore));
      if (manual) {
        setToast('Canal atualizado.');
        window.setTimeout(() => setToast(''), 1400);
      }
    } catch (requestError) {
      if (manual) setError(requestError.message);
    } finally {
      setRefreshStatus('idle');
    }
  }

  useEffect(() => {
    if (status !== 'ready' || !selectedChannel?.messageable) return undefined;
    const timer = window.setInterval(() => {
      refreshLatestMessages();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [messages, refreshStatus, selectedChannel?.id, selectedChannel?.messageable, status]);

  async function loadOlderMessages() {
    if (!messages.length || olderStatus === 'loading') return;
    setOlderStatus('loading');
    setError('');
    try {
      const payload = await getMessages(selectedChannel.id, { limit: 50, before: messages[0].id });
      const olderMessages = payload.messages || [];
      setMessages((current) => {
        const existing = new Set(current.map((message) => message.id));
        return [...olderMessages.filter((message) => !existing.has(message.id)), ...current];
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

      {threadsOpen && channelThreads.length > 0 && (
        <div className="channel-thread-drawer">
          {channelThreads.map((thread) => (
            <button key={thread.id} type="button" onClick={() => onSelectChannel(thread)}>
              <Hash size={16} />
              <span>{thread.name}</span>
            </button>
          ))}
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
