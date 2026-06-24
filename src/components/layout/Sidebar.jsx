import { Bot } from 'lucide-react';

export function Sidebar({ bot, children, open = false }) {
  const displayName = bot?.displayName || bot?.globalName || bot?.username || 'Bot Discord';

  return (
    <aside className={open ? 'sidebar is-open' : 'sidebar'} aria-label="Navegacao principal">
      <div className="sidebar__bot-profile">
        <div className="sidebar__bot-avatar">
          {bot?.avatarUrl ? <img alt={`Avatar de ${displayName}`} src={bot.avatarUrl} /> : <Bot aria-hidden="true" size={28} />}
        </div>
        <strong>{displayName}</strong>
      </div>
      {children}
    </aside>
  );
}
