import { Bot, Download, Hash, Shield, Sparkles } from 'lucide-react';

export function MobileNav({ activeView = 'console', channelsOpen = false, compact = false, onChangeView, onToggleChannels }) {
  return (
    <nav className={compact ? 'mobile-nav is-slim' : 'mobile-nav'} aria-label="Navegacao movel">
      <button className={activeView === 'console' && !channelsOpen ? 'is-active' : ''} onClick={() => onChangeView?.('console')} type="button">
        <Shield size={18} /><span>Console</span>
      </button>
      <button className={channelsOpen ? 'is-active' : ''} type="button" onClick={onToggleChannels}>
        <Hash size={18} /><span>Canais</span>
      </button>
      <button className={activeView === 'downloads' ? 'is-active' : ''} onClick={() => onChangeView?.('downloads')} type="button">
        <Download size={18} /><span>Baixar</span>
      </button>
      <button className={activeView === 'automations' ? 'is-active' : ''} onClick={() => onChangeView?.('automations')} type="button">
        <Bot size={18} /><span>Auto</span>
      </button>
      <button className={activeView === 'ai' ? 'is-active' : ''} onClick={() => onChangeView?.('ai')} type="button">
        <Sparkles size={18} /><span>IA</span>
      </button>
    </nav>
  );
}
