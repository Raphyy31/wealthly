// ============================================================================
// Landing — Yotori Finance v4 cinematic (refonte 2026-05-22)
//
// Shell qui pilote la bascule entre :
//   - Cinematic : intro + 5 scènes auto-jouées → CTAs fin de loop
//   - Details   : page bento (modules, tarifs, FAQ, outro)
//
// Le CTA "Découvrir Yotori Finance" / "Passer la démo" passe à Details.
// "Revoir la démo" ou le mark yotori finance depuis Details renvoie sur Cinematic.
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

  // Landing « Forêt » CLAIRE (2026-07-03, demande user) : plus AUCUN forçage
  // de thème ici. La landing suit la préférence réelle (localStorage via le
  // script no-flash d'index.html) — défaut clair, dark uniquement si
  // l'utilisateur l'a explicitement choisi via le toggle de l'app. L'ancien
  // forçage dark fuyait dans les préférences au moment du login (useTheme
  // lisait l'attribut DOM transitoire) → des users se retrouvaient en dark
  // permanent sans l'avoir demandé.

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
