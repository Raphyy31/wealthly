import './migrateBranding.js'; // ⚠️ premier import — migre les clés localStorage legacy Wealthly → yotori:*
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './i18n.js';            // initialise i18next before the first render
import './index.css';

// Register the PWA service worker (production only — Vite dev server doesn't
// serve /sw.js the way browsers expect, and HMR conflicts with SW caching).
//
// Auto-update (2026-06-26) : sans ça, un nouveau déploiement ne parvenait JAMAIS
// aux utilisateurs PWA — ils restaient coincés sur l'ancien build en cache et il
// fallait vider le cache à la main. Désormais, dès qu'une nouvelle version du SW
// prend le contrôle, on recharge automatiquement vers la dernière version.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let refreshing = false;
  // S'il y avait déjà un SW actif au chargement, un futur changement de
  // contrôleur = nouvelle version déployée → on recharge UNE fois. Au tout
  // premier install (pas de contrôleur), on ne recharge pas inutilement.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      try { reg.update(); } catch { /* noop */ }
      // Une nouvelle version trouvée → on la fait s'activer tout de suite.
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            try { nw.postMessage('SKIP_WAITING'); } catch { /* noop */ }
          }
        });
      });
    }).catch((err) => {
      console.warn('[yotori] SW registration failed:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
