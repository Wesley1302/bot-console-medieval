import { useEffect, useState } from 'react';
import { getCurrentOperator, login } from './api/auth.api.js';
import { AppShell } from './components/layout/AppShell.jsx';
import { LoginScreen } from './components/auth/LoginScreen.jsx';
import { Loading } from './components/ui/Loading.jsx';

export default function App() {
  const [authStatus, setAuthStatus] = useState('checking');
  const [operator, setOperator] = useState(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const payload = await getCurrentOperator();
        if (payload.authenticated) {
          setOperator(payload.operator);
          setAuthStatus('authenticated');
          return;
        }
      } catch {
        setOperator(null);
      }
      setAuthStatus('anonymous');
    }

    loadSession();
  }, []);

  async function handleLogin(password) {
    const payload = await login(password);
    setOperator(payload.operator);
    setAuthStatus('authenticated');
  }

  if (authStatus === 'checking') {
    return (
      <div className="boot-screen">
        <Loading label="Verificando sessao" />
      </div>
    );
  }

  if (authStatus === 'anonymous') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <AppShell operator={operator} />;
}
