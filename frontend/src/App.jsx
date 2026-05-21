import React, { useState, useEffect, lazy, Suspense } from 'react';
import { auth } from './api.js';
import AuthScreen from './AuthScreen.jsx';
import WealthlyApp from './WealthlyApp.jsx';
import { isDemoMode, disableDemoMode, enableDemoMode } from './demoData.js';
import { useIdleLogout } from './hooks/useIdleLogout.js';

// Auto-logout après inactivité (C19 bis 2026-05-18) — paramétrable depuis
// Réglages → Sécurité. Lit la valeur dans localStorage si l'utilisateur l'a
// personnalisée, sinon 30 min par défaut.
const DEFAULT_IDLE_TIMEOUT_MIN = 30;
const DEFAULT_IDLE_WARN_MIN = 25;

const Landing = lazy(() => import('./views/Landing.jsx'));

export default function App() {
  const [authState, setAuthState] = useState('checking'); // checking | authed | unauthed | demo
  // When unauthed, decide whether to show the public marketing landing or
  // jump straight to the auth form. Default to the landing — auth is one
  // click away via the nav.
  const [unauthedView, setUnauthedView] = useState('landing'); // landing | auth
  const [authInitialMode, setAuthInitialMode] = useState('login');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      // Demo mode wins over everything else — landing in the demo means we
      // skip all auth wiring and feed WealthlyApp a static dataset.
      if (isDemoMode()) {
        setAuthState('demo');
        return;
      }

      // If the URL has a password-reset token, jump straight to the auth
      // screen so the user can set a new password — even if they're
      // already logged in (could be a different account they're recovering).
      const params = new URLSearchParams(window.location.search);
      if (params.get('reset_token')) {
        setAuthState('unauthed');
        setUnauthedView('auth');
        return;
      }

      // Cookie-based auth: we can't read the cookie from JS (HttpOnly), so the
      // only way to know if the user is logged in is to ask /auth/me. We do
      // a fast best-effort check; if it succeeds we're authed, otherwise
      // we land on the landing/auth flow.
      try {
        // Race auth.me() against a 5s timeout — if backend is slow/redeploying
        // we still land on the landing page rather than spinning forever.
        const me = await Promise.race([
          auth.me(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]);
        if (me && me.id) {
          setAuthState('authed');
          return;
        }
      } catch (e) {
        // 401 / network error / timeout → unauthed
      }
      setAuthState('unauthed');
    })();
  }, [refreshKey]);

  const exitDemo = () => {
    disableDemoMode();
    setAuthState('unauthed');
    setRefreshKey((k) => k + 1);
  };

  // Lecture de la préférence utilisateur (en minutes) — 0 / null = désactivé.
  const idleTimeoutMin = (() => {
    try {
      const raw = localStorage.getItem('wealthly:idleTimeoutMin');
      if (raw === null) return DEFAULT_IDLE_TIMEOUT_MIN;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : DEFAULT_IDLE_TIMEOUT_MIN;
    } catch {
      return DEFAULT_IDLE_TIMEOUT_MIN;
    }
  })();

  useIdleLogout({
    enabled: authState === 'authed' && idleTimeoutMin > 0,
    timeoutMinutes: idleTimeoutMin,
    warnAtMinutes: Math.max(1, idleTimeoutMin - 5),
    onWarn: (remainingMin) => {
      // Toast léger directement via DOM — évite de dépendre du toast pipeline
      // de WealthlyApp qui n'est pas exposé ici.
      try {
        const el = document.createElement('div');
        el.textContent = `Déconnexion automatique dans ${remainingMin} min`;
        el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;padding:10px 16px;border-radius:8px;font:500 13px/1.2 Geist,sans-serif;z-index:10000;box-shadow:0 8px 24px -8px rgba(0,0,0,.25);';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 6000);
      } catch {}
    },
    onLogout: async () => {
      try { await auth.logout(); } catch {}
      setAuthState('unauthed');
      setUnauthedView('auth');
    },
  });

  if (authState === 'checking') {
    // Loader explicite — anciennement `return <div/>` qui CASSAIT le selecteur
    // `#root:empty` de index.html (root n'est plus vide -> pas de spinner) ->
    // ecran noir pendant jusqu'a 5s sur mobile (fix 2026-05-21 demo investors).
    // On reproduit la meme position fixed + transform centering que le
    // pre-paint pour que l'animation 'ws' (qui inclut translate(-50%,-50%))
    // marche sans decalage visuel.
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg, #F7F6F2)',
        zIndex: 1,
      }}>
        <div style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 28, height: 28,
          border: '2px solid var(--border, #E4E1D8)',
          borderTopColor: 'var(--accent, #2540D9)',
          borderRadius: '50%',
          animation: 'ws 0.7s linear infinite',
        }}/>
      </div>
    );
  }

  if (authState === 'demo') {
    return <WealthlyApp demoMode onExitDemo={exitDemo} />;
  }

  if (authState === 'unauthed') {
    if (unauthedView === 'landing') {
      return (
        <Suspense fallback={<div style={{minHeight:'100vh'}}/>}>
          <Landing
            onSignIn={() => { setAuthInitialMode('login'); setUnauthedView('auth'); }}
            onSignUp={() => { setAuthInitialMode('register'); setUnauthedView('auth'); }}
            onTryDemo={() => { enableDemoMode(); setAuthState('demo'); }}
          />
        </Suspense>
      );
    }
    return (
      <AuthScreen
        initialMode={authInitialMode}
        onBackToLanding={() => setUnauthedView('landing')}
        onAuth={() => setAuthState('authed')}
        onTryDemo={() => setAuthState('demo')}
      />
    );
  }

  return <WealthlyApp onLogout={() => { setAuthState('unauthed'); setUnauthedView('landing'); }} />;
}
