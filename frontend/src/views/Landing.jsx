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
import Cinematic from './landing/Cinematic.jsx';
import Details from './landing/Details.jsx';

export default function Landing({ onSignIn, onSignUp, onTryDemo, onPresent }) {
  // onTryDemo / onPresent : conservés dans la signature pour compat App.jsx,
  // mais la v4 cinematic ne les expose pas explicitement (les CTAs renvoient
  // tous vers Sign-up ou Sign-in). À recâbler si on rajoute un "Mode démo".
  void onTryDemo; void onPresent;

  const [view, setView] = useState('cinematic'); // 'cinematic' | 'details'

  // Force dark theme on landing, restore on unmount (papier-chaud nocturne).
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'dark');
    return () => {
      if (prev) root.setAttribute('data-theme', prev);
      else root.removeAttribute('data-theme');
    };
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
    <Cinematic
      onSignIn={onSignIn}
      onSignUp={onSignUp}
      onShowDetails={() => setView('details')}
    />
  );
}
