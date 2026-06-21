import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';

function formatTime(timestamp) {
  if (!timestamp) return 'sem data';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

function authorName(author) {
  return author?.serverName || author?.displayName || author?.globalName || author?.username || 'Usuario';
}

function avatarUrl(author) {
  if (author?.serverAvatarUrl) return author.serverAvatarUrl;
  if (author?.avatarUrl) return author.avatarUrl;
  if (!author?.id || !author?.avatar) return '';
  if (String(author.avatar).startsWith('http')) return author.avatar;
  const extension = String(author.avatar).startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.${extension}?size=80`;
}

function mentionName(mention) {
  return mention?.serverName || mention?.displayName || mention?.globalName || mention?.username || 'Usuario';
}

function renderContent(message) {
  const content = message.content || '';
  if (!content) return null;

  const mentions = new Map((message.mentions || []).map((mention) => [String(mention.id), mention]));
  const roleMentions = new Map((message.roleMentions || []).map((role) => [String(role.id), role]));
  const parts = [];
  const pattern = /<@!?(\d+)>|<@&(\d+)>/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));

    const userId = match[1];
    const roleId = match[2];
    const mention = userId ? mentions.get(userId) : null;
    const roleMention = roleId ? roleMentions.get(roleId) : null;

    if (mention) {
      parts.push(
        <span className="message-mention" key={`${message.id}-${match.index}`}>
          @{mentionName(mention)}
        </span>,
      );
    } else if (roleMention) {
      parts.push(
        <span className="message-mention is-role" key={`${message.id}-${match.index}`}>
          @{roleMention.name}
        </span>,
      );
    } else {
      parts.push(match[0]);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return parts;
}

function MessageEntry({ message, onContextMenu, onDelete, onEdit }) {
  return (
    <div
      className="message-entry"
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu?.(message, event.clientX, event.clientY);
      }}
    >
      {message.content ? (
        <p className="message-entry__content">{renderContent(message)}</p>
      ) : (
        <p className="message-entry__content message-item__muted">Mensagem sem texto.</p>
      )}

      {message.editedTimestamp && <span className="message-item__edited">editada</span>}
      <div className="message-actions">
        {message.author?.bot && <Button className="button--ghost" onClick={() => onEdit(message)}>Editar</Button>}
        <Button className="button--ghost" onClick={() => onDelete(message)}>Apagar</Button>
      </div>

      {message.attachments?.length > 0 && (
        <div className="message-block">
          <strong>Anexos</strong>
          {message.attachments.map((attachment) => (
            <a href={attachment.url} key={attachment.id} rel="noreferrer" target="_blank">
              {attachment.filename} ({Math.round((attachment.size || 0) / 1024)} KB)
            </a>
          ))}
        </div>
      )}

      {message.embeds?.length > 0 && (
        <div className="message-block">
          <strong>Embeds</strong>
          {message.embeds.map((embed, index) => (
            <div className="embed-block" key={`${message.id}-embed-${index}`}>
              {embed.title && <span>{embed.title}</span>}
              {embed.description && <p>{embed.description}</p>}
              {embed.url && <a href={embed.url} rel="noreferrer" target="_blank">{embed.url}</a>}
            </div>
          ))}
        </div>
      )}

      {message.stickers?.length > 0 && (
        <div className="message-block">
          <strong>Stickers</strong>
          {message.stickers.map((sticker) => <span key={sticker.id}>{sticker.name}</span>)}
        </div>
      )}
    </div>
  );
}

export function MessageItem({ group, onContextMenu, onDelete, onEdit }) {
  const firstMessage = group.messages[0];
  const name = authorName(group.author);
  const avatar = avatarUrl(group.author);

  return (
    <article className="message-item message-item--group">
      <div className="message-avatar" aria-hidden="true">
        {avatar ? <img src={avatar} alt="" loading="lazy" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
      </div>
      <header className="message-item__header">
        <strong>{name}</strong>
        {group.author?.bot && <Badge>BOT</Badge>}
        <time dateTime={firstMessage.timestamp}>{formatTime(firstMessage.timestamp)}</time>
      </header>

      <div className="message-item__body">
        {group.messages.map((message) => (
          <MessageEntry
            key={message.id}
            message={message}
            onContextMenu={onContextMenu}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
      </div>
    </article>
  );
}
