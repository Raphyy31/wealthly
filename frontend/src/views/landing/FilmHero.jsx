// ============================================================================
// FilmHero — hero de la landing (charte « Forêt » claire).
//
// Embarque le FILM Wealthly autonome (moteur + scènes + polices inlinés, ~250 Ko,
// zéro dépendance) livré dans le paquet charte et copié dans /public :
//   - desktop : /film-16x9.html (film complet ~28 s, 1920×1080)
//   - mobile  : /film-9x16.html (coupe courte ~12 s, 1080×1920)
// Le film est sur fond clair (#faf9f5) → cohérent avec la landing claire.
//
// Remplace l'ancienne cinématique SVG (DemoLoopCinematic) comme « vidéo » de
// la landing. CTAs câblés à l'identique (onSignIn/onSignUp/onTryDemo/onShowDetails).
// ============================================================================
import { useEffect } from 'react';
import { useIsNarrow } from '../../hooks/useIsNarrow.js';

export default function FilmHero({ onSignIn, onSignUp, onTryDemo, onShowDetails }) {
  const isNarrow = useIsNarrow(760);
  const src = isNarrow ? '/film-9x16.html' : '/film-16x9.html';

  // Page de marketing : on rétablit le scroll (l'ancienne cinématique le bloquait).
  useEffect(() => {
    document.body.classList.remove('cinematic');
  }, []);

  return (
    <div className="film-hero">
      <style>{FILM_HERO_CSS}</style>

      <header className="fh-strip">
        <div className="fh-brand">
          <span className="fh-glyph">w</span>
          <span className="fh-word">wealthly</span>
        </div>
        <div className="fh-strip-cta">
          {onTryDemo && <button className="fh-link" onClick={onTryDemo}>Voir la démo</button>}
          <button className="fh-signin" onClick={onSignIn}>Se connecter</button>
        </div>
      </header>

      <main className="fh-main">
        <div className="fh-eyebrow">WEALTHLY · LE FILM</div>
        <h1 className="fh-title">
          Votre patrimoine, <em>en un seul regard.</em>
        </h1>
        <p className="fh-sub">
          Comptes, placements, immobilier, fiscalité — réconciliés et tenus à jour,
          en temps réel.
        </p>

        <div className={`fh-film-frame ${isNarrow ? 'is-vertical' : ''}`}>
          <iframe
            key={src}
            src={src}
            title="Wealthly — le film"
            loading="lazy"
            scrolling="no"
            className="fh-film"
          />
        </div>

        <div className="fh-cta-row">
          <button className="fh-cta primary" onClick={onSignUp}>
            Créer un compte
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </button>
          <button className="fh-cta ghost" onClick={onShowDetails}>Découvrir Wealthly</button>
        </div>
      </main>
    </div>
  );
}

const FILM_HERO_CSS = `
.film-hero {
  min-height: 100vh;
  background:
    radial-gradient(900px 480px at 50% -8%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 70%),
    var(--bg);
  color: var(--ink);
  font-family: var(--font-sans);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.fh-strip {
  width: 100%;
  max-width: 1180px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px;
}
.fh-brand { display: inline-flex; align-items: center; gap: 10px; }
.fh-glyph {
  width: 30px; height: 30px; border-radius: 8px;
  background: var(--ink); color: var(--bg);
  display: inline-flex; align-items: center; justify-content: center;
  font: 700 16px/1 var(--font-sans);
}
.fh-word { font: 600 16px/1 var(--font-sans); letter-spacing: -0.02em; color: var(--ink); }
.fh-strip-cta { display: inline-flex; align-items: center; gap: 8px; }
.fh-link, .fh-signin {
  font: 500 13px/1 var(--font-sans);
  border-radius: 999px; padding: 8px 16px; cursor: pointer;
  transition: background var(--t-fast, 120ms), border-color var(--t-fast, 120ms), color var(--t-fast, 120ms), filter 120ms;
}
.fh-link { background: transparent; border: 1px solid var(--border); color: var(--ink-2); }
.fh-link:hover { border-color: var(--accent-line); color: var(--accent-2); background: var(--accent-soft); }
.fh-signin { background: var(--ink); border: 1px solid transparent; color: var(--bg); }
.fh-signin:hover { filter: brightness(1.08); }
.fh-link:active, .fh-signin:active { filter: var(--press-feedback, brightness(0.97)); }

.fh-main {
  width: 100%; max-width: 1180px;
  padding: 18px 24px 80px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
}
.fh-eyebrow {
  font: 600 11px/1 var(--font-mono); letter-spacing: 0.22em;
  color: var(--accent-2); margin-top: 8px;
}
.fh-title {
  margin: 16px 0 0; max-width: 760px;
  font: 600 clamp(30px, 5vw, 52px)/1.05 var(--font-sans);
  letter-spacing: -0.035em; color: var(--ink);
}
.fh-title em {
  font-style: normal; font-weight: 600; color: var(--accent-2);
}
.fh-sub {
  margin: 14px auto 0; max-width: 560px;
  font: 400 15px/1.6 var(--font-sans); color: var(--ink-2);
}

.fh-film-frame {
  width: 100%; max-width: 960px; margin: 32px auto 0;
  aspect-ratio: 16 / 9;
  border-radius: 16px; overflow: hidden;
  background: #faf9f5;
  border: 1px solid var(--border);
  box-shadow:
    0 1px 0 rgba(255,255,255,0.5) inset,
    0 30px 70px -28px color-mix(in srgb, var(--accent) 28%, rgba(20,40,28,0.4));
}
.fh-film-frame.is-vertical { max-width: 340px; aspect-ratio: 9 / 16; }
.fh-film { width: 100%; height: 100%; border: 0; display: block; }

.fh-cta-row {
  display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;
  margin-top: 32px;
}
.fh-cta {
  display: inline-flex; align-items: center; gap: 8px;
  height: 46px; padding: 0 22px; border-radius: 999px;
  font: 600 14px/1 var(--font-sans); cursor: pointer;
  transition: filter 120ms, background 120ms, border-color 120ms, color 120ms;
}
.fh-cta.primary {
  background: var(--accent); color: var(--on-accent); border: 1px solid transparent;
  box-shadow: 0 8px 22px -8px color-mix(in srgb, var(--accent) 60%, transparent);
}
.fh-cta.primary:hover { background: var(--accent-2); }
.fh-cta.ghost { background: transparent; color: var(--ink); border: 1px solid var(--border-strong); }
.fh-cta.ghost:hover { background: var(--bg-hover, var(--bg-sunk)); border-color: var(--ink-3); }
.fh-cta:active { filter: var(--press-feedback, brightness(0.97)); }

@media (max-width: 760px) {
  .fh-strip { padding: 16px; }
  .fh-main { padding: 12px 16px 64px; }
  .fh-film-frame { margin-top: 24px; }
}

@media (prefers-reduced-motion: reduce) {
  .fh-link, .fh-signin, .fh-cta { transition: none; }
}
`;
