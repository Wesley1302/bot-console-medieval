import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { listAutomations } from '../../api/automations.api.js';
import { Button } from '../ui/Button.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Loading } from '../ui/Loading.jsx';
import { Toast } from '../ui/Toast.jsx';
import { AutomationCard } from './AutomationCard.jsx';
import { AutomationForm } from './AutomationForm.jsx';

export function AutomationPanel({ selectedChannel }) {
  const [automations, setAutomations] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  async function loadAutomations({ quiet = false } = {}) {
    if (!quiet) setStatus('loading');
    setError('');
    try {
      const payload = await listAutomations();
      setAutomations(payload.automations || []);
      setStatus('ready');
    } catch (requestError) {
      setError(requestError.message);
      setStatus('error');
    }
  }

  useEffect(() => {
    loadAutomations();
  }, []);

  const hasRunning = useMemo(() => automations.some((automation) => automation.status === 'running'), [automations]);

  useEffect(() => {
    if (!hasRunning) return undefined;
    const intervalId = window.setInterval(() => loadAutomations({ quiet: true }), 2000);
    return () => window.clearInterval(intervalId);
  }, [hasRunning]);

  return (
    <section className="automation-panel">
      <header className="panel-header">
        <div>
          <h2>Automacoes</h2>
          <p>Sequencias locais de mensagens enviadas pelo bot.</p>
        </div>
        <Button className="button--ghost" onClick={() => loadAutomations()} disabled={status === 'loading'}>
          <RefreshCw size={16} />
          Atualizar
        </Button>
      </header>

      <div className="automation-layout">
        <AutomationForm selectedChannel={selectedChannel} onCreated={() => loadAutomations({ quiet: true })} />

        <div className="automation-list">
          {error && <Toast tone="error">{error}</Toast>}
          {status === 'loading' && <Loading label="Carregando automacoes" />}
          {status === 'error' && !automations.length && (
            <EmptyState title="Nao foi possivel listar automacoes." description="Verifique a sessao e as permissoes locais." />
          )}
          {status === 'ready' && !automations.length && (
            <EmptyState title="Nenhuma automacao criada." description="Crie uma sequencia para enviar mensagens em um canal ou topico." />
          )}
          {automations.map((automation) => (
            <AutomationCard automation={automation} key={automation.id} onChanged={() => loadAutomations({ quiet: true })} />
          ))}
        </div>
      </div>
    </section>
  );
}
