import { useEffect, useMemo, useRef } from 'react';
import { MessageItem } from './MessageItem.jsx';

function minuteKey(timestamp) {
  if (!timestamp) return 'sem-data';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'sem-data';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
}

function groupMessages(messages) {
  const groups = [];

  for (const message of messages) {
    const previous = groups.at(-1);
    const authorId = String(message.author?.id || '');
    const key = minuteKey(message.timestamp);

    if (previous?.authorId === authorId && previous.minuteKey === key) {
      previous.messages.push(message);
    } else {
      groups.push({
        id: message.id,
        authorId,
        minuteKey: key,
        author: message.author,
        timestamp: message.timestamp,
        messages: [message],
      });
    }
  }

  return groups;
}

export function MessageList({ messages = [], onContextMenu, onDelete, onEdit }) {
  const listRef = useRef(null);
  const lastMessageId = messages.at(-1)?.id;
  const groups = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'auto' });
  }, [lastMessageId]);

  return (
    <div className={messages.length ? 'message-list' : 'message-list is-empty'} aria-label="Historico de mensagens" ref={listRef}>
      {messages.length ? (
        groups.map((group) => (
          <MessageItem
            group={group}
            key={group.id}
            onContextMenu={onContextMenu}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))
      ) : (
        <div className="message-list__empty">Ainda não há mensagens aqui</div>
      )}
    </div>
  );
}
