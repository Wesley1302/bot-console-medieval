import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import App from './App.jsx';
import './styles/tokens.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/medieval-theme.css';
import './styles/animations.css';

window.__BCM_BOOT_MARKER__ = `boot-${Date.now()}`;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
