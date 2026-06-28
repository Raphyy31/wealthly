// ============================================================================
// FilmHero — landing hero (charte « Forêt »).
//
// Split layout desktop (Linear / Stripe) :
//   - Gauche : texte (eyebrow, gros titre, sub, CTAs)
//   - Droite : film visible IMMÉDIATEMENT, dès l'arrivée, pas besoin de scroll
//   - Le tout tient en 100vh
// Mobile : stack en colonne, film en dessous du texte.
// ============================================================================
import { useEffect } from 'react';
import { useIsNarrow } from '../../hooks/useIsNarrow.js';
import Logo from '../../components/Logo.jsx';

export default function FilmHero({ onSignIn, onSignUp, onTryDemo, onShowDetails }) {
  const isNarrow = useIsNarrow(960);
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
        <div className="fh-text">
          <div className="fh-eyebrow">WEALTHLY · PATRIMOINE FAMILIAL</div>
          <h1 className="fh-title">
            Votre patrimoine,
            <span className="fh-title-accent"> en un seul regard.</span>
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
  display: flex;
  flex-direction: column;
}

/* ── Fond ──────────────────────────────────────────────────────────────── */
.fh-bg {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
}
.fh-halo {
  position: absolute; inset: 0;
  background:
    radial-gradient(900px 540px at 80% 30%, rgba(65,212,155,0.18), transparent 70%),
    radial-gradient(700px 400px at 15% 70%, rgba(65,212,155,0.08), transparent 70%);
}
.fh-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(241,238,228,0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(241,238,228,0.035) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 80%);
}

/* ── Header ──────────────────────────────────────────────────────────── */
.fh-strip {
  position: relative; z-index: 10;
  width: 100%; max-width: 1440px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 32px;
  flex-shrink: 0;
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

/* ── Layout split desktop ────────────────────────────────────────────── */
.fh-main {
  position: relative; z-index: 5;
  flex: 1;
  width: 100%; max-width: 1440px;
  margin: 0 auto;
  padding: 16px 32px 48px;
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  gap: 56px;
  align-items: center;
}

.fh-text { max-width: 560px; }
.fh-eyebrow {
  font: 600 11px/1.4 var(--font-mono, 'Geist Mono', monospace);
  letter-spacing: 0.24em;
  color: #41D49B;
  margin-bottom: 22px;
  display: inline-block;
  padding: 6px 14px;
  border: 1px solid rgba(65,212,155,0.30);
  border-radius: 999px;
  background: rgba(65,212,155,0.06);
}
/* Sélecteur ultra spécifique pour battre :root h1 em de index.css */
.film-hero h1.fh-title {
  margin: 0;
  font: 600 clamp(36px, 5vw, 62px)/1.05 var(--font-sans);
  letter-spacing: -0.034em;
  color: #F7F9F6;
  font-style: normal;
}
.film-hero h1.fh-title .fh-title-accent {
  font-style: italic;
  font-weight: 400;
  font-family: 'Newsreader', 'Geist', serif;
  color: #41D49B;
  white-space: normal;
}
.fh-sub {
  margin: 20px 0 0;
  font: 400 16px/1.55 var(--font-sans);
  color: rgba(241,238,228,0.72);
}

.fh-cta-row {
  display: flex; flex-wrap: wrap; gap: 10px;
  margin-top: 30px;
}
.fh-cta {
  display: inline-flex; align-items: center; gap: 10px;
  height: 46px; padding: 0 22px; border-radius: 999px;
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

/* ── Film flottant (bords fondus, UI player cachée) ──────────────────── */
.fh-film-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  max-height: calc(100vh - 180px);
  overflow: hidden;
  border-radius: 22px;
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 5%, #000 95%, transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0%, #000 5%, #000 95%, transparent 100%);
}
.fh-film-stage.is-vertical {
  max-width: 380px;
  margin: 0 auto;
  aspect-ratio: 9 / 16;
  -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 5%, #000 95%, transparent 100%);
          mask-image: linear-gradient(180deg, transparent 0%, #000 5%, #000 95%, transparent 100%);
}
.fh-film-glow {
  position: absolute; inset: -60px;
  background:
    radial-gradient(55% 50% at 50% 40%, rgba(65,212,155,0.22), transparent 70%),
    radial-gradient(40% 40% at 50% 100%, rgba(65,212,155,0.12), transparent 70%);
  filter: blur(20px);
  z-index: -1;
  pointer-events: none;
}
.fh-film {
  position: absolute;
  /* Iframe agrandi vers le bas pour pousser le bandeau de lecture
     (play / scrubber / download) hors du cadre visible. */
  top: 0; left: 0;
  width: 100%;
  height: 124%;
  border: 0;
  display: block;
  pointer-events: none;
}

/* ── Mobile / tablette : stack vertical ──────────────────────────────── */
@media (max-width: 960px) {
  .fh-strip { padding: 16px 18px; }
  .fh-main {
    grid-template-columns: 1fr;
    gap: 32px;
    padding: 12px 20px 48px;
    align-items: start;
    text-align: center;
  }
  .fh-text { max-width: 600px; margin: 0 auto; }
  .fh-eyebrow { margin-left: auto; margin-right: auto; }
  .fh-cta-row { justify-content: center; }
  .film-hero h1.fh-title { font-size: clamp(30px, 7.5vw, 44px); }
  .fh-sub { font-size: 15px; }
  .fh-film-stage { max-height: 60vh; }
  .fh-grid { background-size: 36px 36px; }
}

@media (prefers-reduced-motion: reduce) {
  .fh-link, .fh-signin, .fh-cta { transition: none; }
}
`;
