// ============================================================================
// FilmHero — landing hero immersif (charte « Forêt »).
//
// Pattern inspiré Linear / Vercel / Apple Product :
//   - Film en FULL-BLEED comme fond de hero (100vh)
//   - Texte (eyebrow / title / sub / CTAs) flotte au-dessus avec un scrim
//     gradient en bas qui assure la lisibilité sans masquer le film
//   - Header (logo + se connecter) en sticky avec backdrop-blur subtil
//
// Sources :
//   - desktop : /film-16x9.html (1920×1080, ~28 s)
//   - mobile  : /film-9x16.html (1080×1920, ~12 s)
// ============================================================================
import { useEffect } from 'react';
import { useIsNarrow } from '../../hooks/useIsNarrow.js';
import Logo from '../../components/Logo.jsx';

export default function FilmHero({ onSignIn, onSignUp, onTryDemo, onShowDetails }) {
  const isNarrow = useIsNarrow(760);
  const src = isNarrow ? '/film-9x16.html' : '/film-16x9.html';

  useEffect(() => {
    document.body.classList.remove('cinematic');
  }, []);

  return (
    <div className="film-hero">
      <style>{FILM_HERO_CSS}</style>

      {/* Film full-bleed — fond de hero */}
      <div className="fh-stage" aria-hidden>
        <iframe
          key={src}
          src={src}
          title="Wealthly — le film"
          loading="eager"
          scrolling="no"
          className="fh-film"
        />
        {/* Vignette + scrim de lisibilité — sans cacher le film */}
        <div className="fh-vignette" />
        <div className="fh-scrim" />
      </div>

      {/* Header flottant */}
      <header className="fh-strip">
        <div className="fh-brand">
          <Logo size={28} wordmark wordmarkSize={16} tone="light" />
        </div>
        <div className="fh-strip-cta">
          {onTryDemo && <button className="fh-link" onClick={onTryDemo}>Voir la démo</button>}
          <button className="fh-signin" onClick={onSignIn}>Se connecter</button>
        </div>
      </header>

      {/* Contenu hero — flotte au-dessus du film */}
      <main className="fh-main">
        <div className="fh-content">
          <div className="fh-eyebrow">WEALTHLY · LE PATRIMOINE EN UN SEUL REGARD</div>
          <h1 className="fh-title">
            Votre patrimoine, <em>en un seul regard.</em>
          </h1>
          <p className="fh-sub">
            Comptes, placements, immobilier, fiscalité — réconciliés et tenus à jour,
            en temps réel.
          </p>

          <div className="fh-cta-row">
            <button className="fh-cta primary" onClick={onSignUp}>
              Créer un compte
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </button>
            <button className="fh-cta ghost" onClick={onShowDetails}>Découvrir Wealthly</button>
          </div>
        </div>
      </main>
    </div>
  );
}

const FILM_HERO_CSS = `
.film-hero {
  position: relative;
  min-height: 100vh;
  width: 100%;
  overflow: hidden;
  color: #F7F9F6;
  font-family: var(--font-sans);
  isolation: isolate;
}

/* ── Film en fond ──────────────────────────────────────────────────────── */
.fh-stage {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: #0c1009;
  pointer-events: none; /* la barre de lecture du film ne bloque pas les clics */
}
.fh-film {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  /* on agrandit légèrement et on remonte pour cacher la barre de lecture
     du film embarqué (qui ferait tâche en bas) */
  transform: scale(1.06) translateY(-2.5%);
  transform-origin: center 40%;
}
/* Vignette douce sur les bords pour donner du focus au centre */
.fh-vignette {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 80% at 50% 30%, transparent 50%, rgba(12,16,9,0.45) 100%);
  z-index: 1;
  pointer-events: none;
}
/* Scrim gradient en bas pour lisibilité du texte */
.fh-scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(12,16,9,0.45) 0%, rgba(12,16,9,0.0) 18%, rgba(12,16,9,0.0) 35%, rgba(12,16,9,0.75) 80%, rgba(12,16,9,0.95) 100%);
  z-index: 2;
  pointer-events: none;
}

/* ── Header sticky avec blur subtil ────────────────────────────────────── */
.fh-strip {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  padding: 22px 32px;
}
.fh-brand { display: inline-flex; align-items: center; gap: 10px; }
.fh-strip-cta { display: inline-flex; align-items: center; gap: 10px; }
.fh-link, .fh-signin {
  font: 500 13px/1 var(--font-sans);
  border-radius: 999px;
  padding: 10px 18px;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
}
.fh-link {
  background: rgba(247,249,246,0.08);
  border: 1px solid rgba(247,249,246,0.18);
  color: #F7F9F6;
}
.fh-link:hover { background: rgba(247,249,246,0.14); border-color: rgba(247,249,246,0.32); }
.fh-signin {
  background: #F7F9F6;
  border: 1px solid transparent;
  color: #0c1009;
  font-weight: 600;
}
.fh-signin:hover { background: #fff; transform: translateY(-1px); }

/* ── Contenu hero ──────────────────────────────────────────────────────── */
.fh-main {
  position: relative;
  z-index: 5;
  min-height: calc(100vh - 84px);
  display: flex;
  align-items: flex-end;        /* texte ancré en bas, le film règne au-dessus */
  justify-content: flex-start;
  padding: 0 32px 72px;
  max-width: 1280px;
  margin: 0 auto;
}
.fh-content { max-width: 720px; }
.fh-eyebrow {
  font: 600 11px/1.4 var(--font-mono, 'Geist Mono', monospace);
  letter-spacing: 0.22em;
  color: #41D49B;
  margin-bottom: 18px;
}
.fh-title {
  margin: 0;
  font: 600 clamp(36px, 6.4vw, 76px)/1.02 var(--font-sans);
  letter-spacing: -0.035em;
  color: #F7F9F6;
  text-shadow: 0 2px 30px rgba(0,0,0,0.35);
}
.fh-title em {
  font-style: italic;
  font-weight: 400;
  font-family: 'Newsreader', 'Geist', serif;
  color: #41D49B;
}
.fh-sub {
  margin: 20px 0 0;
  max-width: 560px;
  font: 400 17px/1.55 var(--font-sans);
  color: rgba(247,249,246,0.82);
  text-shadow: 0 1px 12px rgba(0,0,0,0.4);
}

.fh-cta-row {
  display: flex; flex-wrap: wrap; gap: 12px;
  margin-top: 36px;
}
.fh-cta {
  display: inline-flex; align-items: center; gap: 10px;
  height: 48px; padding: 0 24px; border-radius: 999px;
  font: 600 14px/1 var(--font-sans);
  cursor: pointer;
  transition: transform 160ms ease, background 160ms ease, border-color 160ms ease, filter 160ms ease;
}
.fh-cta.primary {
  background: #41D49B; color: #0c1009;
  border: 1px solid transparent;
  box-shadow: 0 12px 32px -10px rgba(65,212,155,0.55);
}
.fh-cta.primary:hover { background: #54e0a8; transform: translateY(-1px); }
.fh-cta.ghost {
  background: rgba(247,249,246,0.08);
  color: #F7F9F6;
  border: 1px solid rgba(247,249,246,0.22);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
}
.fh-cta.ghost:hover { background: rgba(247,249,246,0.16); border-color: rgba(247,249,246,0.4); }
.fh-cta:active { transform: translateY(0); filter: brightness(0.95); }

/* ── Mobile ────────────────────────────────────────────────────────────── */
@media (max-width: 760px) {
  .fh-strip { padding: 16px 18px; }
  .fh-main { padding: 0 20px 48px; min-height: calc(100vh - 72px); }
  .fh-title { font-size: clamp(32px, 9vw, 48px); }
  .fh-sub { font-size: 15px; }
  .fh-film {
    /* film vertical → on cadre plus serré pour qu'il remplisse bien */
    transform: scale(1.02) translateY(-1%);
  }
  .fh-scrim {
    background:
      linear-gradient(180deg, rgba(12,16,9,0.55) 0%, rgba(12,16,9,0.0) 22%, rgba(12,16,9,0.0) 40%, rgba(12,16,9,0.85) 75%, rgba(12,16,9,0.96) 100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fh-link, .fh-signin, .fh-cta { transition: none; }
}
`;
