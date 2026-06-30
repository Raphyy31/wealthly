// ============================================================================
// Landing — Wealthly v4 cinematic (refonte 2026-05-22)
//
// Shell qui pilote la bascule entre :
//   - Cinematic : intro + 5 scènes auto-jouées → CTAs fin de loop
//   - Details   : page bento (modules, tarifs, FAQ, outro)
//
// Le CTA "Découvrir Wealthly" / "Passer la démo" passe à Details.
// "Revoir la démo" ou le mark wealthly depuis Details renvoie sur Cinematic.
//
// Force data-theme="dark" sur <html> tout le temps qu'on est sur la landing
// (cf. CLAUDE.md "Landing is dark-only by force").
// ============================================================================
import { useEffect, useState } from 'react';
import FilmHero from './landing/FilmHero.jsx';
import Details from './landing/Details.jsx';

export default function Landing({ onSignIn, onSignUp, onTryDemo, onPresent }) {
  // onPresent : conservé pour compat App.jsx (mode présentation auto-tour),
  // non exposé en v4. onTryDemo est désormais recâblé sur un bouton « Voir la
  // démo » du Cinematic (entrée mode démo interactif, données synthétiques).
  void onPresent;

  const [view, setView] = useState('cinematic'); // 'cinematic' | 'details'

  // Landing « Forêt » SOMBRE pour les DEUX vues (hero film + page Détails),
  // cohérente avec le film. Le hero (FilmHero) utilise les tokens dark
  // d'index.css ; la page Détails est en plus scopée `.landing-dark` (#0a0e08).
  // data-theme="dark" force le body/html en dark → pas de flash clair derrière.
  // Restauré à la préférence réelle de l'utilisateur au unmount.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'dark');
    return () => {
      // Restaure la préférence RÉELLE de l'utilisateur (localStorage), pas un
      // attribut transitoire : sinon le forcé "fuitait" dans la démo / l'app.
      let stored = 'light';
      try { const s = localStorage.getItem('wealthly-theme'); if (s === 'light' || s === 'dark') stored = s; } catch {}
      root.setAttribute('data-theme', stored);
    };
  }, [view]);

  // Scrub le hash router (#/dashboard, #/transactions, ...) au mount de la
  // landing : si l'user vient de se déconnecter, son URL garde l'ancien
  // hash et c'est moche en barre d'adresse. Pas pro de voir "#/dashboard"
  // sur la landing publique.
  useEffect(() => {
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      const url = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', url);
    }
  }, []);

  // Scroll-to-top quand on bascule de vue (sinon Details démarre en bas).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [view]);

  if (view === 'details') {
    return (
      <Details
        onSignIn={onSignIn}
        onSignUp={onSignUp}
        onShowCinematic={() => setView('cinematic')}
      />
    );
  }

  return (
    <FilmHero
      onSignIn={onSignIn}
      onSignUp={onSignUp}
      onShowDetails={() => setView('details')}
      onTryDemo={onTryDemo}
    />
  );
}
