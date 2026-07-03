import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { auth, subscribeSessionExpired } from './api.js';
import AuthScreen from './AuthScreen.jsx';
import AuthModal from './AuthModal.jsx';
import YotoriApp from './YotoriApp.jsx';
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
  // unauthedView: 'landing' shows Landing+AuthModal, 'auth' shows full AuthScreen (reset-password only)
  const [unauthedView, setUnauthedView] = useState('landing'); // landing | auth
  const [authInitialMode, setAuthInitialMode] = useState('login');
  const [refreshKey, setRefreshKey] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  // Auth modal (popup on top of landing, replaces full-page auth for sign-in/register)
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');

  // Session expirée en cours d'usage : un 401 sur un endpoint authentifié
  // signale que le cookie a expiré. On bascule proprement sur l'écran de
  // connexion (ce qui démonte YotoriApp → purge les données en cache) avec
  // un bandeau explicite, au lieu de laisser l'utilisateur sur des données
  // mortes dont chaque action échoue.
  const authStateRef = useRef(authState);
  useEffect(() => { authStateRef.current = authState; }, [authState]);
  useEffect(() => {
    const unsub = subscribeSessionExpired(() => {
      if (authStateRef.current !== 'authed') return; // déjà déconnecté / en démo
      try { localStorage.removeItem('w2:current_user'); } catch {}
      setSessionExpired(true);
      setAuthModalMode('login');
      setAuthModalOpen(true);
      setAuthState('unauthed');
      setUnauthedView('landing');
    });
    return unsub;
  }, []);

  useEffect(() => {
    (async () => {
      // Demo mode wins over everything else — landing in the demo means we
      // skip all auth wiring and feed YotoriApp a static dataset.
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
      // Utilisateur déjà connu (cache présent) : on confirme via /auth/me, mais
      // on distingue TIMEOUT vs vraie invalidation. Au cold-start Railway (sortie
      // de veille), /auth/me peut dépasser 2,5 s → AVANT on éjectait l'user vers
      // la landing malgré une session valide ("données disparues" / "déconnecté
      // tout seul"). Désormais : sur timeout AVEC cache de session, on reste
      // OPTIMISTE (on entre dans l'app) et on laisse reloadAll (+ son retry
      // cold-start) confirmer/populer. On ne déconnecte QUE sur un vrai 401.
      const TIMEOUT = Symbol('timeout');
      try {
        const mePromise = auth.me();
        // Si le timeout gagne la course, la promesse /auth/me continue et
        // pourrait rejeter (401 tardif) → on avale ici pour éviter un
        // "unhandled promise rejection". Le vrai basculement se fait via les
        // appels de données de reloadAll (non-/auth/*, qui émettent le signal).
        mePromise.catch(() => {});
        const me = await Promise.race([
          mePromise,
          new Promise((resolve) => setTimeout(() => resolve(TIMEOUT), 3500)),
        ]);
        if (me === TIMEOUT) {
          // Backend froid, pas de réponse à temps → optimiste (on a un cache).
          // /auth/me continue en tâche de fond : un 401 réel basculera l'app
          // via le signal subscribeSessionExpired.
          setAuthState('authed');
          return;
        }
        if (me && me.id) {
          setAuthState('authed');
          return;
        }
        // me est null/sans id → session réellement invalide.
      } catch (e) {
        // 401 / réseau → unauthed (vraie invalidation, pas un simple délai).
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
      const raw = localStorage.getItem('yotori:idleTimeoutMin');
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
      // de YotoriApp qui n'est pas exposé ici.
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
        background: 'var(--bg, #F7F9F6)',
        zIndex: 1,
      }}>
        <div style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 28, height: 28,
          border: '2px solid var(--border, #E2E6DF)',
          borderTopColor: 'var(--accent, #0E7C56)',
          borderRadius: '50%',
          animation: 'ws 0.7s linear infinite',
        }}/>
      </div>
    );
  }

  if (authState === 'demo') {
    return <YotoriApp demoMode onExitDemo={exitDemo} />;
  }

  if (authState === 'unauthed') {
    // Full-page AuthScreen uniquement pour les liens de reset-password (URL param)
    if (unauthedView === 'auth') {
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
    // Landing + AuthModal (popup) pour connexion / inscription
    return (
      <>
        <Suspense fallback={<div style={{minHeight:'100vh'}}/>}>
          <Landing
            onSignIn={() => { setAuthModalMode('login'); setAuthModalOpen(true); }}
            onSignUp={() => { setAuthModalMode('register'); setAuthModalOpen(true); }}
            onTryDemo={() => { enableDemoMode(); setAuthState('demo'); }}
            onPresent={() => {
              try { localStorage.setItem('yotori:auto_demo_tour', '1'); } catch {}
              enableDemoMode();
              setAuthState('demo');
            }}
          />
        </Suspense>
        <AuthModal
          open={authModalOpen}
          initialMode={authModalMode}
          notice={sessionExpired ? 'Votre session a expiré. Reconnectez-vous pour continuer.' : null}
          onClose={() => { setAuthModalOpen(false); setSessionExpired(false); }}
          onAuth={() => { setAuthModalOpen(false); setSessionExpired(false); setAuthState('authed'); }}
          onTryDemo={() => { setAuthModalOpen(false); enableDemoMode(); setAuthState('demo'); }}
        />
      </>
    );
  }

  return <YotoriApp onLogout={() => { setAuthState('unauthed'); setUnauthedView('landing'); }} />;
}
