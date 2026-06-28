// ============================================================================
// FilmHero — landing hero (charte « Forêt »).
//
// Pattern Linear / Vercel / Apple Product :
//   - Fond hero sombre (vert-noir Forêt) avec halo émeraude radial
//   - Texte centré en haut (eyebrow, gros titre Newsreader italic émeraude,
//     subtitle, CTAs)
//   - Film en grande carte centrée en dessous, avec halo et perspective
//     subtile, taille généreuse (max 1100 px)
//   - Aucun overlap texte/film → lisible, premium, calme
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

      <div className="fh-bg" aria-hidden>
        <div className="fh-halo" />
        <div className="fh-grid" />
      </div>

      <header className="fh-strip">
        <div className="fh-brand">
          <Logo size={28} wordmark wordmarkSize={16} tone="light" />
        </div>
        <div className="fh-strip-cta">
          {onTryDemo && <button className="fh-link" onClick={onTryDemo}>Voir la démo</button>}
          <button className="fh-signin" onClick={onSignIn}>Se connecter</button>
        </div>
      </header>

      <main className="fh-main">
        <div className="fh-eyebrow">WEALTHLY · PATRIMOINE FAMILIAL</div>
        <h1 className="fh-title">
          Votre patrimoine,<br/>
          <em>en un seul regard.</em>
        </h1>
        <p className="fh-sub">
          Comptes, placements, immobilier, fiscalité —
          réconciliés et tenus à jour, en temps réel.
        </p>

        <div className="fh-cta-row">
          <button className="fh-cta primary" onClick={onSignUp}>
            Créer un compte
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </button>
          <button className="fh-cta ghost" onClick={onShowDetails}>Découvrir Wealthly</button>
        </div>

        <div className={`fh-film-stage ${isNarrow ? 'is-vertical' : ''}`}>
          <div className="fh-film-glow" aria-hidden/>
          <iframe
            key={src}
            src={src}
            title="Wealthly — le film"
            loading="eager"
            scrolling="no"
            className="fh-film"
          />
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
  background: #0a0e08;
  color: #F1EEE4;
  font-family: var(--font-sans);
  isolation: isolate;
}

/* ── Fond : halo radial émeraude + grid subtile ───────────────────────── */
.fh-bg {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
}
.fh-halo {
  position: absolute; inset: 0;
  background:
    radial-gradient(900px 540px at 50% 8%, rgba(65,212,155,0.20), transparent 70%),
    radial-gradient(700px 400px at 50% 60%, rgba(65,212,155,0.10), transparent 70%);
}
.fh-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(241,238,228,0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(241,238,228,0.035) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, #000 30%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, #000 30%, transparent 80%);
}

/* ── Header ──────────────────────────────────────────────────────────── */
.fh-strip {
  position: relative; z-index: 10;
  width: 100%; max-width: 1280px; margin: 0 auto;
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
}
.fh-link {
  background: rgba(241,238,228,0.04);
  border: 1px solid rgba(241,238,228,0.14);
  color: #F1EEE4;
}
.fh-link:hover { background: rgba(241,238,228,0.10); border-color: rgba(241,238,228,0.26); }
.fh-signin {
  background: #F1EEE4;
  border: 1px solid transparent;
  color: #0a0e08;
  font-weight: 600;
}
.fh-signin:hover { background: #fff; }

/* ── Contenu hero ────────────────────────────────────────────────────── */
.fh-main {
  position: relative; z-index: 5;
  max-width: 1180px; margin: 0 auto;
  padding: 56px 32px 80px;
  text-align: center;
}
.fh-eyebrow {
  font: 600 11px/1.4 var(--font-mono, 'Geist Mono', monospace);
  letter-spacing: 0.24em;
  color: #41D49B;
  margin-bottom: 24px;
  display: inline-block;
  padding: 6px 14px;
  border: 1px solid rgba(65,212,155,0.30);
  border-radius: 999px;
  background: rgba(65,212,155,0.06);
}
.fh-title {
  margin: 0 auto;
  max-width: 880px;
  font: 600 clamp(40px, 6.4vw, 78px)/1.04 var(--font-sans);
  letter-spacing: -0.038em;
  color: #F7F9F6;
}
.fh-title em {
  font-style: italic;
  font-weight: 400;
  font-family: 'Newsreader', 'Geist', serif;
  color: #41D49B;
}
.fh-sub {
  margin: 22px auto 0;
  max-width: 600px;
  font: 400 17px/1.6 var(--font-sans);
  color: rgba(241,238,228,0.72);
}

.fh-cta-row {
  display: flex; flex-wrap: wrap; gap: 12px;
  margin-top: 36px;
  justify-content: center;
}
.fh-cta {
  display: inline-flex; align-items: center; gap: 10px;
  height: 48px; padding: 0 24px; border-radius: 999px;
  font: 600 14px/1 var(--font-sans);
  cursor: pointer;
  transition: transform 160ms ease, background 160ms ease, border-color 160ms ease, filter 160ms ease;
}
.fh-cta.primary {
  background: #41D49B; color: #0a0e08;
  border: 1px solid transparent;
  box-shadow: 0 12px 32px -10px rgba(65,212,155,0.55);
}
.fh-cta.primary:hover { background: #54e0a8; transform: translateY(-1px); }
.fh-cta.ghost {
  background: rgba(241,238,228,0.05);
  color: #F1EEE4;
  border: 1px solid rgba(241,238,228,0.20);
}
.fh-cta.ghost:hover { background: rgba(241,238,228,0.10); border-color: rgba(241,238,228,0.36); }
.fh-cta:active { transform: translateY(0); filter: brightness(0.95); }

/* ── Film qui flotte (pas de cadre, bords fondus) ─────────────────────── */
.fh-film-stage {
  position: relative;
  width: 100%;
  max-width: 1240px;
  margin: 72px auto 0;
  aspect-ratio: 16 / 9;
  /* Bords du film fondus dans le noir via un mask radial → l'iframe semble
     se diffuser dans la page, plus de bordure / d'encadré visible. */
  -webkit-mask-image: radial-gradient(ellipse 70% 78% at 50% 46%, #000 50%, rgba(0,0,0,0.6) 75%, transparent 100%);
          mask-image: radial-gradient(ellipse 70% 78% at 50% 46%, #000 50%, rgba(0,0,0,0.6) 75%, transparent 100%);
}
.fh-film-stage.is-vertical {
  max-width: 380px;
  aspect-ratio: 9 / 16;
  -webkit-mask-image: radial-gradient(ellipse 75% 70% at 50% 46%, #000 55%, rgba(0,0,0,0.6) 78%, transparent 100%);
          mask-image: radial-gradient(ellipse 75% 70% at 50% 46%, #000 55%, rgba(0,0,0,0.6) 78%, transparent 100%);
}
.fh-film-glow {
  position: absolute; inset: -80px;
  background:
    radial-gradient(60% 50% at 50% 40%, rgba(65,212,155,0.18), transparent 70%),
    radial-gradient(40% 40% at 50% 100%, rgba(65,212,155,0.10), transparent 70%);
  filter: blur(20px);
  z-index: -1;
  pointer-events: none;
}
.fh-film {
  width: 100%; height: 100%;
  border: 0; display: block;
}

/* ── Mobile ──────────────────────────────────────────────────────────── */
@media (max-width: 760px) {
  .fh-strip { padding: 16px 18px; }
  .fh-main { padding: 32px 20px 56px; }
  .fh-title { font-size: clamp(32px, 9vw, 48px); }
  .fh-sub { font-size: 15px; margin-top: 18px; }
  .fh-cta-row { margin-top: 28px; }
  .fh-film-stage { margin-top: 40px; }
  .fh-grid { background-size: 36px 36px; }
}

@media (prefers-reduced-motion: reduce) {
  .fh-link, .fh-signin, .fh-cta { transition: none; }
}
`;
