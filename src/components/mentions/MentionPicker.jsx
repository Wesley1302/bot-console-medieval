import { useEffect, useState } from 'react';
import { AtSign, Bot, Search, Shield } from 'lucide-react';
import { listMentions } from '../../api/mentions.api.js';

const groups = [
  { key: 'users', label: 'Usuarios' },
  { key: 'roles', label: 'Cargos' },
  { key: 'special', label: 'Especiais' },
];

function MentionIcon({ item }) {
  if (item.avatarUrl) {
    return <img alt="" className="mention-picker__avatar" src={item.avatarUrl} />;
  }
  if (item.type === 'role') return <Shield aria-hidden="true" size={16} />;
  if (item.type === 'special') return <AtSign aria-hidden="true" size={16} />;
  return <Bot aria-hidden="true" size={16} />;
}

export function MentionPicker({ onSelect }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [payload, setPayload] = useState({ users: [], roles: [], special: [], warnings: [] });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setStatus('loading');
      setError('');
      try {
        const result = await listMentions(query.trim());
        if (active) {
          setPayload({
            users: result.users || (result.results || []).filter((item) => item.type === 'user'),
            roles: result.roles || (result.results || []).filter((item) => item.type === 'role'),
            special: result.special || [],
            warnings: result.warnings || [],
          });
          setStatus('ready');
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message);
          setStatus('error');
        }
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  function choose(item) {
    onSelect?.(item.mention || item.value);
    setOpen(false);
    setQuery('');
  }

  const resultCount = groups.reduce((total, group) => total + (payload[group.key]?.length || 0), 0);

  return (
    <div className="mention-picker">
      <button className="mention-picker__trigger" onClick={() => setOpen((current) => !current)} type="button">
        <AtSign aria-hidden="true" size={16} />
        Mencionar
      </button>
      {open && (
        <div className="mention-picker__panel">
          <label className="mention-picker__search">
            <Search aria-hidden="true" size={16} />
            <span className="sr-only">Buscar usuario ou cargo</span>
            <input autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="Buscar usuario ou cargo" value={query} />
          </label>

          {status === 'loading' && <p className="mention-picker__status">Buscando...</p>}
          {status === 'error' && <p className="mention-picker__status is-error">{error}</p>}
          {status === 'ready' && !resultCount && <p className="mention-picker__status">Nenhum resultado.</p>}

          {groups.map((group) => payload[group.key]?.length > 0 && (
            <section className="mention-picker__group" key={group.key}>
              <h4>{group.label}</h4>
              {payload[group.key].map((item) => (
                <button className="mention-picker__item" key={`${group.key}-${item.id}`} onClick={() => choose(item)} type="button">
                  <span className={`mention-picker__icon is-${item.type || group.key}`}><MentionIcon item={item} /></span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.detail || item.mention || item.value}</small>
                  </span>
                </button>
              ))}
            </section>
          ))}

          {payload.warnings.map((warning) => <p className="mention-picker__warning" key={warning}>{warning}</p>)}
        </div>
      )}
    </div>
  );
}
