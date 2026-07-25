import { Plus, Send, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { listMentions } from '../../api/mentions.api.js';
import { sendMessage } from '../../api/messages.api.js';
import { Button } from '../ui/Button.jsx';
import { Toast } from '../ui/Toast.jsx';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 8 * 1024 * 1024;

function sizeLabel(bytes) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function blockedMessage(channel) {
  if (!channel) return 'Escolha um canal de texto ou topico para enviar mensagens.';
  if (channel.type === 'forum') return 'Abra um topico deste forum para enviar mensagens.';
  if (channel.type === 'voice') return 'Canais de voz nao aceitam mensagens nesta V1.';
  if (channel.type === 'category') return 'Escolha um canal dentro desta categoria.';
  if (!channel.messageable) return 'Escolha um canal de texto ou topico para enviar mensagens.';
  return '';
}

function findMentionTrigger(value, cursor) {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
  if (!match) return null;
  return {
    start: beforeCursor.lastIndexOf('@'),
    end: cursor,
    query: match[1] || '',
  };
}

export function Composer({ selectedChannel, onMessageSent }) {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [mentionTrigger, setMentionTrigger] = useState(null);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionStatus, setMentionStatus] = useState('idle');
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const lockedReason = blockedMessage(selectedChannel);
  const disabled = Boolean(lockedReason) || status === 'sending';
  const canSend = !disabled && (content.trim() || files.length > 0);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const isMobile = window.matchMedia('(max-width: 620px)').matches;
    const lineHeight = isMobile ? 20 : 22;
    const verticalPadding = isMobile ? 11 : 19;
    const maxLines = isMobile ? 10 : 15;
    const maxHeight = (lineHeight * maxLines) + verticalPadding;

    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    textarea.scrollTop = textarea.scrollHeight;
  }, [content]);

  useEffect(() => {
    if (disabled || !mentionTrigger) {
      setMentionResults([]);
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setMentionStatus('loading');
      try {
        const payload = await listMentions(mentionTrigger.query);
        if (active) setMentionResults(payload.results || []);
      } catch {
        if (active) setMentionResults([]);
      } finally {
        if (active) setMentionStatus('idle');
      }
    }, 120);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [disabled, mentionTrigger]);

  function addFiles(event) {
    const nextFiles = [...files, ...Array.from(event.target.files || [])];
    event.target.value = '';
    setError('');

    if (nextFiles.length > MAX_FILES) {
      setError('Envie no maximo 5 arquivos por mensagem.');
      return;
    }

    if (nextFiles.some((file) => file.size > MAX_FILE_SIZE)) {
      setError('Arquivo excede o limite de 8 MB.');
      return;
    }

    setFiles(nextFiles);
  }

  function removeFile(index) {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submitMessage() {
    if (!canSend) return;
    setStatus('sending');
    setError('');
    try {
      const result = await sendMessage({ channelId: selectedChannel.id, content, files });
      setContent('');
      setMentionTrigger(null);
      setMentionResults([]);
      setFiles([]);
      onMessageSent(result.messages || [result.message]);
      setStatus('sent');
      window.setTimeout(() => setStatus('idle'), 1800);
    } catch (requestError) {
      setStatus('idle');
      setError(requestError.message);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  }

  function updateMentionState(value, cursor) {
    setMentionTrigger(findMentionTrigger(value, cursor));
  }

  function handleContentChange(event) {
    const nextContent = event.target.value;
    setContent(nextContent);
    updateMentionState(nextContent, event.target.selectionStart || nextContent.length);
  }

  function handleCaretMove(event) {
    updateMentionState(event.target.value, event.target.selectionStart || event.target.value.length);
  }

  function selectMention(target) {
    if (!mentionTrigger) return;
    const before = content.slice(0, mentionTrigger.start);
    const after = content.slice(mentionTrigger.end);
    const nextContent = `${before}${target.value} ${after}`;
    const nextCursor = before.length + target.value.length + 1;

    setContent(nextContent);
    setMentionTrigger(null);
    setMentionResults([]);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return (
    <div className="composer">
      {mentionTrigger && (mentionResults.length > 0 || mentionStatus === 'loading') && (
        <div className="mention-menu" role="listbox">
          {mentionStatus === 'loading' && <span className="mention-menu__status">Buscando...</span>}
          {mentionResults.map((item) => (
            <button key={`${item.type}-${item.id}`} onMouseDown={(event) => event.preventDefault()} onClick={() => selectMention(item)} type="button">
              <span className={item.type === 'role' ? 'mention-menu__icon is-role' : 'mention-menu__icon'}>
                {item.type === 'role' ? '@' : item.label.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
            </button>
          ))}
        </div>
      )}
      <textarea
        aria-label={lockedReason || 'Mensagem do bot'}
        disabled={disabled}
        onBlur={() => window.setTimeout(() => setMentionTrigger(null), 120)}
        onChange={handleContentChange}
        onClick={handleCaretMove}
        onKeyDown={handleKeyDown}
        onKeyUp={handleCaretMove}
        placeholder={lockedReason || 'Escreva como o bot...'}
        ref={textareaRef}
        value={content}
      />
      <div className="composer__meta">
        <small>{content.length}</small>
      </div>
      {files.length > 0 && (
        <div className="attachment-list">
          {files.map((file, index) => (
            <span className="attachment-pill" key={`${file.name}-${index}`}>
              {file.name} ({sizeLabel(file.size)})
              <button onClick={() => removeFile(index)} type="button" aria-label="Remover anexo"><X size={13} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="composer__actions">
        <input aria-label="Selecionar anexos" hidden multiple onChange={addFiles} ref={fileInputRef} type="file" />
        <Button className="button--ghost composer__attach" disabled={disabled || files.length >= MAX_FILES} onClick={() => fileInputRef.current?.click()} aria-label="Anexar arquivos">
          <Plus size={22} />
        </Button>
        <Button className="composer__send" disabled={!canSend} onClick={submitMessage} aria-label="Enviar mensagem">
          <Send size={16} />
        </Button>
      </div>
      {status === 'sent' && <Toast>Mensagem enviada.</Toast>}
      {error && <Toast tone="error">{error}</Toast>}
    </div>
  );
}
