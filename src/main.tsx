import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import BolaoPage from './components/bolao/BolaoPage.tsx';
import BolaoAdminPage from './components/bolao/BolaoAdminPage.tsx';
import TransparenciaPage from './components/bolao/TransparenciaPage.tsx';
import RadarPage from './components/bolao/RadarPage.tsx';
import VendasRapidasPage from './components/vendas/VendasRapidasPage.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { initAttribution } from './lib/attribution.ts';
import './index.css';

// Lê utm/gclid/fbclid/ttclid e o referrer antes de qualquer render, para toda
// captura de lead — inclusive as parciais — sair com a origem do anúncio junto.
initAttribution();

function Router() {
  const path = window.location.pathname;

  if (path === '/bolao') {
    return <BolaoPage />;
  }

  if (path === '/bolao-admin-manos') {
    return <BolaoAdminPage />;
  }

  if (path === '/bolao-transparencia') {
    return <TransparenciaPage />;
  }

  if (path === '/radar-manos') {
    return <RadarPage />;
  }

  if (path === '/vendasrapidas') {
    return <VendasRapidasPage />;
  }

  return <App />;
}

const container = document.getElementById('root')!;
// Remove o bloco de emergência do index.html (telefone/WhatsApp/endereço) antes
// de montar. Explícito de propósito: o fallback só deve aparecer quando o React
// nunca chega a rodar.
container.innerHTML = '';

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <Router />
    </ErrorBoundary>
  </StrictMode>,
);
