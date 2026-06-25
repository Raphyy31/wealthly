import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { auth, subscribeSessionExpired } from './api.js';
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
  const [sessionExpired, setSessionExpired] = useState(false);

  // Session expirée en cours d'usage : un 401 sur un endpoint authentifié
  // signale que le cookie a expiré. On bascule proprement sur l'écran de
  // connexion (ce qui démonte WealthlyApp → purge les données en cache) avec
  // un bandeau explicite, au lieu de laisser l'utilisateur sur des données
  // mortes dont chaque action échoue.
  const authStateRef = useRef(authState);
  useEffect(() => { authStateRef.current = authState; }, [authState]);
  useEffect(() => {
    const unsub = subscribeSessionExpired(() => {
      if (authStateRef.current !== 'authed') return; // déjà déconnecté / en démo
      try { localStorage.removeItem('w2:current_user'); } catch {}
      setSessionExpired(true);
      setAuthInitialMode('login');
      setUnauthedView('auth');
      setAuthState('unauthed');
    });
    return unsub;
  }, []);

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

      // Cookie-based auth (HttpOnly → illisible en JS) : on confirme la session
      // via /auth/me. Optimisation perçue (2026-06-25) : un visiteur SANS user
      // en cache (`w2:current_user`) est quasi certainement déconnecté → on
      // affiche le landing/auth IMMÉDIATEMENT au lieu d'un spinner aveugle qui
      // pouvait durer jusqu'à 5 s (cold start Railway). On vérifie quand même en
      // tâche de fond pour le cas rare « cookie valide mais cache vidé ».
      let hadSession = false;
      try { hadSession = !!localStorage.getItem('w2:current_user'); } catch {}
      if (!hadSession) {
        setAuthState('unauthed');
        auth.me().then((me) => { if (me && me.id) setAuthState('authed'); }).catch(() => {});
        return;
      }
      // Utilisateur déjà connu : on confirme, course courte (2,5 s) pour ne pas
      // rester bloqué si le backend redémarre.
      try {
        const me = await Promise.race([
          auth.me(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)),
        ]);
        if (me && me.id) {
          setAuthState('authed');
          return;
        }
      } catch (e) {
        // 401 / réseau / timeout → unauthed
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
            onPresent={() => {
              // Mode Presentation depuis Landing : on enable la demo (donnees
              // synthetiques) + on pose un flag pour que WealthlyApp lance
              // automatiquement le DemoTour au mount.
              try { localStorage.setItem('wealthly:auto_demo_tour', '1'); } catch {}
              enableDemoMode();
              setAuthState('demo');
            }}
          />
        </Suspense>
      );
    }
    return (
      <AuthScreen
        initialMode={authInitialMode}
        notice={sessionExpired ? 'Votre session a expiré. Reconnectez-vous pour continuer.' : null}
        onBackToLanding={() => { setSessionExpired(false); setUnauthedView('landing'); }}
        onAuth={() => { setSessionExpired(false); setAuthState('authed'); }}
        onTryDemo={() => setAuthState('demo')}
      />
    );
  }

  return <WealthlyApp onLogout={() => { setAuthState('unauthed'); setUnauthedView('landing'); }} />;
}
