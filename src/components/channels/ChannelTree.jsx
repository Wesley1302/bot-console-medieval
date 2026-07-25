import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Hash,
  Lock,
  Megaphone,
  MessageSquare,
  Download,
  Trash2,
} from 'lucide-react';
import { createExport } from '../../api/exports.api.js';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Loading } from '../ui/Loading.jsx';
import { Toast } from '../ui/Toast.jsx';
import { ChannelSearch } from './ChannelSearch.jsx';
import { CleanupModal } from '../cleanup/CleanupModal.jsx';

function channelIcon(channel) {
  if (channel.type === 'forum') return MessageSquare;
  if (channel.type === 'announcement') return Megaphone;
  if (channel.type === 'category') return Folder;
  if (!channel.messageable) return Lock;
  return Hash;
}

function canExport(target) {
  return ['category', 'text', 'announcement', 'forum', 'thread'].includes(target?.type) && !target.virtual;
}

function matchesQuery(category, channel, query) {
  if (!query) return true;
  const text = `${category?.name || ''} ${channel?.name || ''}`.toLowerCase();
  return text.includes(query.toLowerCase());
}

function ContextMenu({ menu, onClose, onExport, onOpen, onCleanup }) {
  if (!menu) return null;
  return (
    <div className="context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
      <button type="button" onClick={() => { onOpen(menu.target); onClose(); }}>
        <FolderOpen size={15} /> Abrir
      </button>
      <button type="button" onClick={() => { onExport(menu.target); onClose(); }}>
        <Download size={15} /> Exportar
      </button>
      <button className="is-danger" type="button" onClick={() => { onCleanup(menu.target); onClose(); }}>
        <Trash2 size={15} /> Limpar
      </button>
    </div>
  );
}

function ChannelButton({ channel, selected, onContext, onSelect }) {
  const Icon = channelIcon(channel);
  const timerRef = useRef(null);
  const longPressedRef = useRef(false);
  const hasLock = !channel.messageable && !['forum', 'category'].includes(channel.type);

  function startLongPress(event) {
    longPressedRef.current = false;
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      onContext(channel, event.clientX || 24, event.clientY || 120);
    }, 520);
  }

  function stopLongPress() {
    window.clearTimeout(timerRef.current);
  }

  return (
    <button
      className={selected?.id === channel.id ? 'channel-row is-selected' : 'channel-row'}
      onClick={() => {
        if (longPressedRef.current) {
          longPressedRef.current = false;
          return;
        }
        onSelect(channel);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onContext(channel, event.clientX, event.clientY);
      }}
      onPointerDown={startLongPress}
      onPointerLeave={stopLongPress}
      onPointerUp={stopLongPress}
      title={channel.name}
      type="button"
    >
      <Icon size={18} />
      <span>{channel.name}</span>
      {hasLock && <Lock size={13} className="channel-row__lock" />}
    </button>
  );
}

export function ChannelTree({ selectedChannel, tree, status, error, onRefresh, onExportStarted, onSelectChannel }) {
  const [query, setQuery] = useState('');
  const [openCategories, setOpenCategories] = useState(() => new Set());
  const [localError, setLocalError] = useState('');
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState(null);
  const [cleanupTarget, setCleanupTarget] = useState(null);
  const categoryPressRef = useRef(null);
  const categoryLongPressedRef = useRef(false);

  useEffect(() => {
    function closeMenu() {
      setMenu(null);
    }

    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const filteredCategories = useMemo(() => {
    return (tree?.categories || [])
      .map((category) => ({
        ...category,
        channels: (category.channels || []).filter((channel) => channel.type !== 'voice' && matchesQuery(category, channel, query)),
      }))
      .filter((category) => category.channels.length || category.name.toLowerCase().includes(query.toLowerCase()));
  }, [tree, query]);

  async function exportTarget(target) {
    if (!canExport(target)) return;
    setLocalError('');
    try {
      const payload = await createExport({ id: target.id, name: target.name, type: target.type });
      onExportStarted?.(payload.jobId);
      setToast('Exportacao iniciada.');
      window.setTimeout(() => setToast(''), 1800);
    } catch (requestError) {
      setLocalError(requestError.message);
    }
  }

  function openMenu(target, x, y) {
    if (!canExport(target)) return;
    setMenu({
      target,
      x: Math.max(8, Math.min(x, window.innerWidth - 194)),
      y: Math.max(8, Math.min(y, window.innerHeight - 142)),
    });
  }

  function startCategoryLongPress(category, event) {
    categoryLongPressedRef.current = false;
    categoryPressRef.current = window.setTimeout(() => {
      categoryLongPressedRef.current = true;
      openMenu(category, event.clientX || 24, event.clientY || 120);
    }, 520);
  }

  function stopCategoryLongPress() {
    window.clearTimeout(categoryPressRef.current);
  }

  function toggleCategory(category) {
    setOpenCategories((current) => {
      const next = new Set(current);
      if (next.has(category.id)) next.delete(category.id);
      else next.add(category.id);
      return next;
    });
  }

  function openTarget(target) {
    if (target.type === 'category') {
      toggleCategory(target);
      return;
    }
    onSelectChannel?.(target);
  }

  return (
    <div className="channel-tree">
      <ChannelSearch value={query} onChange={setQuery} />

      {status === 'loading' && <Loading label="Carregando canais" />}
      {status === 'error' && <Toast tone="error">{error || localError}</Toast>}
      {status === 'error' && <button className="button button--ghost" type="button" onClick={onRefresh}>Tentar novamente</button>}
      {toast && <Toast>{toast}</Toast>}
      {status === 'ready' && !filteredCategories.length && (
        <EmptyState title="Nada encontrado" description="Ajuste a busca ou verifique as permissoes do bot." />
      )}

      {filteredCategories.map((category) => {
        const open = Boolean(query) || category.virtual || openCategories.has(category.id);
        return (
          <section className="channel-category" key={category.id}>
            {!category.virtual && (
              <button
                className="category-toggle"
                onClick={() => {
                  if (categoryLongPressedRef.current) {
                    categoryLongPressedRef.current = false;
                    return;
                  }
                  toggleCategory(category);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  openMenu(category, event.clientX, event.clientY);
                }}
                onPointerDown={(event) => startCategoryLongPress(category, event)}
                onPointerLeave={stopCategoryLongPress}
                onPointerUp={stopCategoryLongPress}
                type="button"
              >
                {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <Folder size={18} />
                <span>{category.name}</span>
              </button>
            )}
            {open && (
              <div className={category.virtual ? 'channel-category__items is-uncategorized' : 'channel-category__items'}>
                {(category.channels || []).map((channel) => (
                  <ChannelButton
                    channel={channel}
                    key={channel.id}
                    onContext={openMenu}
                    onSelect={onSelectChannel}
                    selected={selectedChannel}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <ContextMenu
        menu={menu}
        onCleanup={setCleanupTarget}
        onClose={() => setMenu(null)}
        onExport={exportTarget}
        onOpen={openTarget}
      />
      <CleanupModal target={cleanupTarget} onClose={() => setCleanupTarget(null)} />
    </div>
  );
}
