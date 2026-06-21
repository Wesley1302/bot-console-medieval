import { Bot, Download, LogOut, TerminalSquare } from 'lucide-react';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';

const navItems = [
  { id: 'console', label: 'Console', icon: TerminalSquare },
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'automations', label: 'Automacoes', icon: Bot },
];

export function TopBar({ activeView = 'console', onChangeView, onLogout, operator }) {
  return (
    <header className="topbar">
      <div className="topbar__identity">
        <strong>Console do Operador</strong>
        <span>{operator?.role === 'admin' ? 'Operador autenticado' : 'Sessao ativa'}</span>
      </div>
      <div className="topbar__actions">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              className={activeView === item.id ? 'button--ghost is-active topbar__nav-button' : 'button--ghost topbar__nav-button'}
              key={item.id}
              onClick={() => onChangeView?.(item.id)}
            >
              <Icon size={16} />
              {item.label}
            </Button>
          );
        })}
        <Badge tone="gold">V1</Badge>
        <Button className="button--ghost" onClick={onLogout}>
          <LogOut size={16} />
          Sair
        </Button>
      </div>
    </header>
  );
}
