import { useEffect, useState } from 'react';
import { Activity, Bot, Download, Hash, RefreshCw, ShieldCheck, Zap } from 'lucide-react';
import { getHealth } from '../../api/client.js';
import { getDiscordStatus } from '../../api/status.api.js';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';
import { Loading } from '../ui/Loading.jsx';
import { Toast } from '../ui/Toast.jsx';

function formatTimestamp(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : 'sem leitura';
}

export function DashboardHome({ onChangeView }) {
  const [health, setHealth] = useState(null);
  const [status, setStatus] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');

  async function loadStatus() {
    setPhase('loading');
    setError('');
    try {
      const [healthPayload, discordPayload] = await Promise.all([
        getHealth(),
        getDiscordStatus(),
      ]);
      setHealth(healthPayload);
      setStatus(discordPayload);
      setPhase('ready');
    } catch (requestError) {
      setPhase('error');
      setError(requestError.message);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  return (
    <section className="dashboard-home">
      <div className="dashboard-hero">
        <div className="crest-mark crest-mark--small" aria-hidden="true">
          <ShieldCheck size={25} />
        </div>
        <div>
          <h1>Mesa de Comando</h1>
          <p>Controle operacional do bot Discord, canais, downloads e automacoes da V1.</p>
        </div>
        <Button className="button--ghost" onClick={loadStatus} disabled={phase === 'loading'}>
          <RefreshCw size={16} />
          Atualizar
        </Button>
      </div>

      {phase === 'loading' && <Loading label="Consultando estado do console" />}
      {phase === 'error' && <Toast tone="error">{error}</Toast>}

      <div className="dashboard-grid">
        <Card className="dashboard-card dashboard-card--status">
          <div className="dashboard-card__header">
            <Activity size={20} />
            <div>
              <h2>Backend</h2>
              <p>API local e sessao do operador</p>
            </div>
          </div>
          <div className="status-row">
            <Badge tone={health?.ok ? 'running' : 'queued'}>{health?.ok ? 'Online' : 'Aguardando'}</Badge>
            <span>{formatTimestamp(health?.timestamp)}</span>
          </div>
        </Card>

        <Card className="dashboard-card dashboard-card--status">
          <div className="dashboard-card__header">
            <Bot size={20} />
            <div>
              <h2>Discord</h2>
              <p>{status?.guild?.name || 'Servidor configurado no ambiente'}</p>
            </div>
          </div>
          <div className="status-row">
            <Badge tone={status?.ok ? 'running' : 'queued'}>{status?.ok ? 'Bot conectado' : 'Nao lido'}</Badge>
            <span>{status?.bot?.username || 'bot oculto'}</span>
          </div>
        </Card>

        <Card className="dashboard-card dashboard-action-card">
          <Hash size={21} />
          <h2>Console</h2>
          <p>Navegue por categorias, canais, foruns, topicos e mensagens.</p>
          <Button onClick={() => onChangeView?.('console')}>Abrir console</Button>
        </Card>

        <Card className="dashboard-card dashboard-action-card">
          <Download size={21} />
          <h2>Downloads</h2>
          <p>Consulte exportacoes locais e baixe JSON, Markdown, TXT ou ZIP.</p>
          <Button onClick={() => onChangeView?.('downloads')}>Abrir downloads</Button>
        </Card>

        <Card className="dashboard-card dashboard-action-card">
          <Zap size={21} />
          <h2>Automacoes</h2>
          <p>Crie e acompanhe sequencias de mensagens com intervalo fixo.</p>
          <Button onClick={() => onChangeView?.('automations')}>Abrir automacoes</Button>
        </Card>
      </div>
    </section>
  );
}
