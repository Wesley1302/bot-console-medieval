import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, Bot, ExternalLink, FileText, LoaderCircle, Search, Trash2, Upload,
} from 'lucide-react';
import {
  cancelAiQuery, createAiQuery, getAiQueries, getAiQuery,
} from '../../api/ai.api.js';
import {
  deleteKnowledgeDocument,
  getKnowledgeDocuments,
  reprocessKnowledgeDocument,
  uploadKnowledgeDocument,
} from '../../api/knowledge.api.js';
import { Button } from '../ui/Button.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Toast } from '../ui/Toast.jsx';

const terminal = new Set(['completed', 'partial', 'failed', 'cancelled']);
const documentTypes = [
  ['lore', 'Lore'], ['law', 'Lei'], ['tradition', 'Tradicao'], ['house', 'Casa'],
  ['character', 'Personagem'], ['server_rule', 'Regra do servidor'], ['reference', 'Referencia'],
];

function ScopeCheckbox({ area, checked, partial = false, onToggle }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partial && !checked;
  }, [checked, partial]);
  return (
    <label className="ai-scope__item">
      <input ref={ref} type="checkbox" checked={checked} onChange={() => onToggle(area)} />
      <span>{area.name}</span>
      <small>{area.type}</small>
    </label>
  );
}

function KnowledgeManager() {
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('lore');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const payload = await getKnowledgeDocuments();
      setDocuments(payload.documents || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (!documents.some((document) => document.status === 'processing')) return undefined;
    const interval = window.setInterval(refresh, 2_000);
    return () => window.clearInterval(interval);
  }, [documents]);

  async function upload(event) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await uploadKnowledgeDocument({ title, type, file });
      setFile(null);
      setTitle('');
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(document) {
    if (!window.confirm(`Excluir o documento "${document.title}"?`)) return;
    await deleteKnowledgeDocument(document.id);
    await refresh();
  }

  return (
    <section className="ai-knowledge">
      <div className="section-heading">
        <div><h3>Base de conhecimento</h3><p>Lore, leis, tradicoes e referencias.</p></div>
        <BookOpen size={20} />
      </div>
      {error && <Toast tone="error">{error}</Toast>}
      <form className="ai-knowledge__form" onSubmit={upload}>
        <label className="field"><span>Titulo</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="field"><span>Classificacao</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {documentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="field ai-knowledge__file"><span>Arquivo PDF, MD, TXT ou DOCX</span>
          <input accept=".pdf,.md,.txt,.docx" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>
        <Button disabled={!file || busy} type="submit"><Upload size={16} /> Enviar</Button>
      </form>
      <div className="ai-knowledge__list">
        {documents.map((document) => (
          <article key={document.id}>
            <FileText size={18} />
            <div><strong>{document.title}</strong><small>{document.type} · {document.status}</small></div>
            {document.status === 'failed' && (
              <Button className="button--ghost" aria-label="Reprocessar" onClick={async () => {
                await reprocessKnowledgeDocument(document.id); await refresh();
              }}><LoaderCircle size={15} /></Button>
            )}
            <Button className="button--ghost" aria-label="Excluir documento" onClick={() => remove(document)}>
              <Trash2 size={15} />
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResultPanel({ query }) {
  const result = query?.resultJson;
  if (!query) return <EmptyState title="Nenhuma consulta selecionada" description="Envie uma pergunta ou abra o historico." />;
  if (!terminal.has(query.status)) {
    return (
      <div className="ai-progress">
        <LoaderCircle className="is-spinning" size={22} />
        <strong>{query.step || 'Processando'}</strong>
        <progress max="100" value={query.progress || 0} />
      </div>
    );
  }
  if (query.status === 'failed') return <Toast tone="error">{query.error || 'A consulta falhou.'}</Toast>;
  if (!result) return <EmptyState title="Consulta sem resposta" description="Nao ha resultado disponivel." />;
  return (
    <div className="ai-result">
      <header><span>{result.answerType}</span><h2>{result.summary}</h2></header>
      {[
        ['Fatos', result.facts],
        ['Interpretacoes', result.interpretations],
        ['Hipoteses', result.hypotheses],
        ['Recomendacoes', result.recommendations],
      ].map(([title, items]) => Boolean(items?.length) && (
        <section key={title}><h3>{title}</h3>
          {items.map((item, index) => (
            <p key={`${title}-${index}`}>{item.statement} {item.confidence && <small>{item.confidence}</small>}</p>
          ))}
        </section>
      ))}
      <section className="ai-evidence"><h3>Evidencias</h3>
        {(query.evidence || []).map((item) => (
          <article key={item.id}>
            <div><strong>{item.metadataJson?.authorName || item.metadataJson?.title || item.sourceType}</strong>
              <small>{item.metadataJson?.createdAt || item.metadataJson?.section || ''}</small>
            </div>
            <p>{item.excerpt || 'Fonte removida ou indisponivel.'}</p>
            {item.messageUrl && <a href={item.messageUrl} target="_blank" rel="noreferrer">Abrir no Discord <ExternalLink size={13} /></a>}
          </article>
        ))}
      </section>
    </div>
  );
}

export function AiPanel({ channelTree }) {
  const [selected, setSelected] = useState(() => new Map());
  const [dateMode, setDateMode] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [prompt, setPrompt] = useState('');
  const [queries, setQueries] = useState([]);
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const categories = channelTree?.categories || [];
  const activeThreads = channelTree?.activeThreads || [];
  const selectableCategories = categories.filter((category) => !category.virtual);

  const selectedTargets = useMemo(() => [...selected.values()], [selected]);

  async function refreshHistory() {
    try {
      const payload = await getAiQueries();
      setQueries(payload.queries || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => { refreshHistory(); }, []);
  useEffect(() => {
    if (!current?.id || terminal.has(current.status)) return undefined;
    const interval = window.setInterval(async () => {
      try {
        const payload = await getAiQuery(current.id);
        setCurrent(payload.query);
        if (terminal.has(payload.query.status)) refreshHistory();
      } catch (requestError) {
        setError(requestError.message);
      }
    }, 1_500);
    return () => window.clearInterval(interval);
  }, [current?.id, current?.status]);

  function toggle(area) {
    setSelected((previous) => {
      const next = new Map(previous);
      if (next.has(area.id)) next.delete(area.id);
      else next.set(area.id, { id: area.id, name: area.name, type: area.type });
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const created = await createAiQuery({
        prompt, selectedTargets, dateMode,
        dateFrom: dateFrom || null, dateTo: dateTo || null,
      });
      const payload = await getAiQuery(created.queryId);
      setCurrent(payload.query);
      setPrompt('');
      await refreshHistory();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function openQuery(id) {
    try {
      setCurrent((await getAiQuery(id)).query);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="ai-panel">
      <aside className="ai-panel__controls">
        <div className="section-heading"><div><h2>Assistente de IA</h2><p>Pesquisa com fontes do Discord e da lore.</p></div><Bot size={22} /></div>
        {error && <Toast tone="error">{error}</Toast>}
        <form onSubmit={submit}>
          <fieldset className="ai-scope">
            <legend>Locais da pesquisa</legend>
            {selectableCategories.map((category) => {
              const children = category.channels || [];
              const selectedChildren = children.filter((item) => selected.has(item.id)).length;
              return (
                <div key={category.id}>
                  <ScopeCheckbox
                    area={category}
                    checked={selected.has(category.id)}
                    partial={selectedChildren > 0 && selectedChildren < children.length}
                    onToggle={toggle}
                  />
                  <div className="ai-scope__children">
                    {children.map((area) => (
                      <ScopeCheckbox key={area.id} area={area} checked={selected.has(area.id)} onToggle={toggle} />
                    ))}
                  </div>
                </div>
              );
            })}
            {activeThreads.map((area) => (
              <ScopeCheckbox key={area.id} area={area} checked={selected.has(area.id)} onToggle={toggle} />
            ))}
          </fieldset>
          <label className="field"><span>Periodo</span>
            <select value={dateMode} onChange={(event) => setDateMode(event.target.value)}>
              <option value="all">Todo o historico</option>
              <option value="since">Desde uma data</option>
              <option value="until">Ate uma data</option>
              <option value="range">Entre duas datas</option>
            </select>
          </label>
          {['since', 'range'].includes(dateMode) && (
            <label className="field"><span>Data inicial</span><input type="datetime-local" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          )}
          {['until', 'range'].includes(dateMode) && (
            <label className="field"><span>Data final</span><input type="datetime-local" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
          )}
          <label className="field"><span>Pergunta</span>
            <textarea rows="6" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="O que deseja encontrar ou analisar?" />
          </label>
          <Button disabled={busy || !prompt.trim() || !selectedTargets.length} type="submit">
            <Search size={16} /> Consultar
          </Button>
          {current && !terminal.has(current.status) && (
            <Button className="button--ghost" onClick={() => cancelAiQuery(current.id).then((payload) => setCurrent(payload.query))}>
              Cancelar consulta
            </Button>
          )}
        </form>
        <KnowledgeManager />
      </aside>
      <section className="ai-panel__workspace">
        <ResultPanel query={current} />
      </section>
      <aside className="ai-panel__history">
        <h3>Historico</h3>
        {queries.map((query) => (
          <button key={query.id} type="button" onClick={() => openQuery(query.id)}>
            <span>{query.prompt}</span><small>{query.status}</small>
          </button>
        ))}
      </aside>
    </div>
  );
}
