import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';
import { Loading } from '../ui/Loading.jsx';
import { Toast } from '../ui/Toast.jsx';

export function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  async function submitLogin(event) {
    event.preventDefault();
    if (!password || status === 'loading') return;

    setStatus('loading');
    setError('');
    try {
      await onLogin(password);
      setPassword('');
      setStatus('idle');
    } catch (loginError) {
      setError(loginError.message);
      setStatus('error');
    }
  }

  return (
    <main className="login-screen">
      <section className="login-copy">
        <div className="crest-mark" aria-hidden="true">
          <ShieldCheck size={30} />
        </div>
        <h1>Bot Console Medieval</h1>
        <p>Acesse a mesa de comando</p>
      </section>

      <Card className="login-card">
        <form className="login-form" onSubmit={submitLogin}>
          <div className="login-card__header">
            <KeyRound size={23} />
            <div>
              <h2>Entrada do operador</h2>
              <p>Use a senha administrativa configurada no servidor.</p>
            </div>
          </div>

          <label className="field">
            <span>Senha</span>
            <input
              autoComplete="current-password"
              autoFocus
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Senha do conselho"
              type="password"
              value={password}
            />
          </label>

          <Button type="submit" disabled={!password || status === 'loading'}>
            {status === 'loading' ? <Loading label="Abrindo portao" /> : 'Entrar no Conselho'}
          </Button>

          {error && <Toast tone="error">{error}</Toast>}
        </form>
      </Card>
    </main>
  );
}
