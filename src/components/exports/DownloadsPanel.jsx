import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import { bulkDownloadExports, deleteExport, downloadExport, listExports } from '../../api/exports.api.js';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Loading } from '../ui/Loading.jsx';
import { Toast } from '../ui/Toast.jsx';

function formatDate(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : 'sem data';
}

function exportTitle(item) {
  return item.target?.name || item.id;
}

export function DownloadsPanel({ refreshKey = 0 }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [format, setFormat] = useState('md');
  const [mode, setMode] = useState('combined');
  const [status, setStatus] = useState('loading');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  async function loadExports() {
    setStatus('loading');
    setError('');
    try {
      const payload = await listExports();
      setItems(payload.exports || []);
      setSelected((current) => {
        const existing = new Set((payload.exports || []).map((item) => item.id));
        return new Set([...current].filter((id) => existing.has(id)));
      });
      setStatus('ready');
    } catch (requestError) {
      setStatus('error');
      setError(requestError.message);
    }
  }

  useEffect(() => {
    loadExports();
  }, [refreshKey]);

  const selectedIds = useMemo(() => [...selected], [selected]);
  const allSelected = items.length > 0 && selected.size === items.length;

  function toggleSelected(exportId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(exportId)) next.delete(exportId);
      else next.add(exportId);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)));
  }

  async function runWithFeedback(label, action, successMessage) {
    setBusy(label);
    setError('');
    try {
      await action();
      setToast(successMessage);
      window.setTimeout(() => setToast(''), 1800);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  async function handleDownload(item, itemFormat) {
    await runWithFeedback(`download-${item.id}-${itemFormat}`, () => downloadExport(item.id, itemFormat), 'Download iniciado.');
  }

  async function handleBulkDownload() {
    await runWithFeedback('bulk', () => bulkDownloadExports({ ids: selectedIds, format, mode }), 'Download em lote iniciado.');
  }

  async function handleDelete(item) {
    if (!window.confirm(`Excluir exportacao de ${exportTitle(item)}?`)) return;
    await runWithFeedback(`delete-${item.id}`, async () => {
      await deleteExport(item.id);
      await loadExports();
    }, 'Exportacao excluida.');
  }

  return (
    <section className="downloads-panel">
      <header className="panel-header">
        <div>
          <h2>Downloads</h2>
          <p>Pacotes locais gerados em JSON, Markdown e TXT.</p>
        </div>
        <Button className="button--ghost" onClick={loadExports} disabled={status === 'loading' || Boolean(busy)}>
          <RefreshCw size={16} />
          Atualizar
        </Button>
      </header>

      {error && <Toast tone="error">{error}</Toast>}
      {toast && <Toast>{toast}</Toast>}
      {status === 'loading' && <Loading label="Carregando exportacoes" />}
      {status === 'error' && !items.length && (
        <EmptyState title="Nao foi possivel listar downloads." description="Verifique a sessao e a pasta local de exportacoes." />
      )}
      {status === 'ready' && !items.length && (
        <EmptyState title="Nenhuma exportacao gerada." description="Abra um canal, forum, topico ou categoria e use Exportar." />
      )}

      {items.length > 0 && (
        <>
          <div className="bulk-toolbar">
            <label className="check-row">
              <input checked={allSelected} onChange={toggleAll} type="checkbox" />
              <span>{selected.size} selecionada(s)</span>
            </label>
            <label>
              <span>Formato</span>
              <select value={format} onChange={(event) => setFormat(event.target.value)}>
                <option value="md">Markdown</option>
                <option value="txt">TXT</option>
                <option value="json">JSON</option>
              </select>
            </label>
            <label>
              <span>Modo</span>
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="combined">Arquivo unico</option>
                <option value="separate">ZIP separado</option>
              </select>
            </label>
            <Button onClick={handleBulkDownload} disabled={!selected.size || Boolean(busy)}>
              <Download size={16} />
              Baixar lote
            </Button>
          </div>

          <div className="exports-list">
            {items.map((item) => (
              <article className="export-card" key={item.id}>
                <label className="check-row">
                  <input checked={selected.has(item.id)} onChange={() => toggleSelected(item.id)} type="checkbox" />
                  <span>{exportTitle(item)}</span>
                </label>
                <div className="export-card__meta">
                  <Badge>{item.target?.type || 'export'}</Badge>
                  <span>{formatDate(item.completedAt)}</span>
                  <span>{item.summary?.totalMessages || 0} mensagens</span>
                  <span>{item.summary?.totalConversations || 0} conversas</span>
                </div>
                <div className="export-card__actions">
                  <Button className="button--ghost" disabled={Boolean(busy)} onClick={() => handleDownload(item, 'md')}>MD</Button>
                  <Button className="button--ghost" disabled={Boolean(busy)} onClick={() => handleDownload(item, 'txt')}>TXT</Button>
                  <Button className="button--ghost" disabled={Boolean(busy)} onClick={() => handleDownload(item, 'json')}>JSON</Button>
                  <Button className="button--ghost" disabled={Boolean(busy)} onClick={() => handleDelete(item)}>
                    <Trash2 size={15} />
                    Excluir
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
