import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import BolaoPage from './components/bolao/BolaoPage.tsx';
import BolaoAdminPage from './components/bolao/BolaoAdminPage.tsx';
import TransparenciaPage from './components/bolao/TransparenciaPage.tsx';
import RadarPage from './components/bolao/RadarPage.tsx';
import './index.css';

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

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
