// ============================================================================
// FilmHero — hero de la landing en mode « Forêt nocturne ».
//
// Direction visuelle (validée 2026-06-30) : dark Linear/Vercel-grade.
//   - Base near-black à pointe verte
//   - Grille de points subtile en arrière-plan
//   - Live pill "patrimoines suivis" qui pulse (signal tech)
//   - Hero film conservé (iframe /film-16x9.html ou /film-9x16.html)
//   - Halo émeraude radial derrière le film (effet premium)
//   - Marquee horizontal des banques DSP2 (trust signal)
//   - Microinteractions : hover/active sur les CTA, pas de translateY
//
// Le thème dark est forcé par Landing.jsx selon view === 'cinematic'.
// ============================================================================
import { useEffect } from 'react';
import { useIsNarrow } from '../../hooks/useIsNarrow.js';
import Logo from '../../components/Logo.jsx';

const TRUST_BANKS = [
  'BNP Paribas', 'Crédit Agricole', 'Société Générale', 'Boursorama',
  'Revolut', 'N26', 'Lydia', 'Fortuneo', 'LCL', 'HSBC', 'Crédit Mutuel',
];

export default function FilmHero({ onSignIn, onSignUp, onTryDemo, onShowDetails }) {
  const isNarrow = useIsNarrow(760);
  const src = isNarrow ? '/film-9x16.html' : '/film-16x9.html';

  useEffect(() => {
    document.body.classList.remove('cinematic');
  }, []);

  return (
    <div className="film-hero">
      <style>{FILM_HERO_CSS}</style>

      {/* Texture de fond : grille de points subtile (Linear-grade) */}
      <div className="fh-grid" aria-hidden/>
      {/* Halo radial émeraude — donne le glow tech */}
      <div className="fh-halo" aria-hidden/>

      <header className="fh-strip">
        <div className="fh-brand">
          <Logo size={26} wordmark wordmarkSize={15} />
        </div>
        <div className="fh-strip-cta">
          {onTryDemo && <button className="fh-link" onClick={onTryDemo}>Voir la démo</button>}
          <button className="fh-signin" onClick={onSignIn}>Se connecter</button>
        </div>
      </header>

      <main className="fh-main">
        <div className="fh-live">
          <span className="fh-live-dot" aria-hidden/>
          <span className="fh-live-text">1 248 patrimoines suivis · MAJ en temps réel</span>
        </div>

        <h1 className="fh-title">
          Votre patrimoine, <em>en un seul regard.</em>
        </h1>
        <p className="fh-sub">
          Comptes, placements, immobilier, fiscalité — réconciliés et tenus à jour,
          en temps réel.
        </p>

        <div className="fh-cta-row">
          <button className="fh-cta primary" onClick={onSignUp}>
            Essayer 14 jours
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </button>
          <button className="fh-cta ghost" onClick={onShowDetails}>Découvrir Wealthly</button>
        </div>

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

        <div className="fh-trust">
          <div className="fh-trust-label">Compatible avec vos banques</div>
          <div className="fh-marquee" aria-hidden>
            <div className="fh-marquee-track">
              {[...TRUST_BANKS, ...TRUST_BANKS].map((b, i) => (
                <span key={i} className="fh-bank-chip">{b}</span>
              ))}
            </div>
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
  background:
    radial-gradient(1200px 600px at 50% -10%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 65%),
    var(--bg);
  color: var(--ink);
  font-family: var(--font-sans);
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  isolation: isolate;
}

/* Grille de points subtile — texture Linear/Vercel */
.fh-grid {
  position: absolute; inset: 0;
  background-image: radial-gradient(
    circle at 1px 1px,
    color-mix(in srgb, var(--ink) 12%, transparent) 1px,
    transparent 0
  );
  background-size: 22px 22px;
  mask-image: linear-gradient(180deg, black 0%, black 60%, transparent 100%);
  -webkit-mask-image: linear-gradient(180deg, black 0%, black 60%, transparent 100%);
  pointer-events: none;
  z-index: 0;
}
.fh-halo {
  position: absolute;
  top: 30%; left: 50%;
  width: min(1100px, 90vw); height: 700px;
  transform: translate(-50%, -50%);
  background: radial-gradient(ellipse 50% 50% at 50% 50%,
    color-mix(in srgb, var(--accent) 28%, transparent) 0%,
    color-mix(in srgb, var(--accent) 8%, transparent) 40%,
    transparent 70%);
  filter: blur(60px);
  pointer-events: none;
  z-index: 0;
}

.fh-strip {
  position: relative; z-index: 2;
  width: 100%; max-width: 1180px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px;
}
.fh-brand { display: inline-flex; align-items: center; gap: 10px; }
.fh-strip-cta { display: inline-flex; align-items: center; gap: 8px; }
.fh-link, .fh-signin {
  font: 500 13px/1 var(--font-sans);
  border-radius: 999px; padding: 9px 18px; cursor: pointer;
  transition: background 140ms, border-color 140ms, color 140ms, filter 140ms;
}
.fh-link {
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
  color: var(--ink-2);
}
.fh-link:hover { border-color: var(--accent); color: var(--accent); }
.fh-signin {
  background: var(--accent); border: 1px solid transparent;
  color: var(--on-accent, #0B0F0D);
  box-shadow: 0 4px 16px -6px color-mix(in srgb, var(--accent) 60%, transparent);
}
.fh-signin:hover {
  filter: brightness(1.08);
  box-shadow: 0 6px 22px -6px color-mix(in srgb, var(--accent) 80%, transparent);
}

.fh-main {
  position: relative; z-index: 2;
  width: 100%; max-width: 1180px;
  padding: 36px 24px 80px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
}

/* Live pill — signal tech "système en marche" */
.fh-live {
  display: inline-flex; align-items: center; gap: 9px;
  padding: 7px 14px 7px 11px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
  color: var(--ink);
  font: 500 12px/1 var(--font-mono);
  letter-spacing: 0.02em;
}
.fh-live-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent);
  animation: fhLivePulse 2.2s ease-in-out infinite;
}
@keyframes fhLivePulse {
  0%, 100% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 28%, transparent); }
  50%      { box-shadow: 0 0 0 7px color-mix(in srgb, var(--accent) 6%, transparent); }
}
.fh-live-text { color: var(--ink-2); }

.fh-title {
  margin: 24px 0 0; max-width: 880px;
  font: 500 clamp(40px, 7.2vw, 86px)/1.02 var(--font-sans);
  letter-spacing: -0.04em; color: var(--ink);
}
.fh-title em {
  font-style: italic; font-weight: 400;
  font-family: var(--font-serif, 'Newsreader', Georgia, serif);
  background: linear-gradient(110deg,
    var(--accent) 0%,
    color-mix(in srgb, var(--accent) 70%, white) 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
  letter-spacing: -0.045em;
}
.fh-sub {
  margin: 18px auto 0; max-width: 560px;
  font: 400 16px/1.6 var(--font-sans); color: var(--ink-2);
}

.fh-cta-row {
  display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;
  margin-top: 32px;
}
.fh-cta {
  display: inline-flex; align-items: center; gap: 8px;
  height: 48px; padding: 0 24px; border-radius: 999px;
  font: 600 14px/1 var(--font-sans); cursor: pointer;
  transition: filter 140ms, background 140ms, border-color 140ms, color 140ms, box-shadow 200ms;
}
.fh-cta.primary {
  background: var(--accent);
  color: var(--on-accent, #0B0F0D);
  border: 1px solid transparent;
  box-shadow:
    0 1px 0 color-mix(in srgb, white 14%, transparent) inset,
    0 10px 28px -6px color-mix(in srgb, var(--accent) 55%, transparent);
}
.fh-cta.primary:hover {
  filter: brightness(1.08);
  box-shadow:
    0 1px 0 color-mix(in srgb, white 20%, transparent) inset,
    0 14px 38px -6px color-mix(in srgb, var(--accent) 75%, transparent);
}
.fh-cta.ghost {
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  color: var(--ink);
  border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
}
.fh-cta.ghost:hover { border-color: var(--accent); color: var(--accent); }
.fh-cta:active { filter: brightness(0.95); }

/* Cadre film — halo + bord subtil. La taille reste raisonnable pour ne pas
   écraser le titre/CTA qui sont au-dessus. */
.fh-film-frame {
  position: relative;
  width: 100%; max-width: 920px; margin: 48px auto 0;
  aspect-ratio: 16 / 9;
  border-radius: 18px; overflow: hidden;
  background: #0B0F0D;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
  box-shadow:
    0 1px 0 color-mix(in srgb, white 5%, transparent) inset,
    0 30px 80px -28px color-mix(in srgb, var(--accent) 50%, rgba(0,0,0,0.7)),
    0 0 0 6px color-mix(in srgb, var(--accent) 6%, transparent);
}
.fh-film-frame.is-vertical { max-width: 320px; aspect-ratio: 9 / 16; }
.fh-film { width: 100%; height: 100%; border: 0; display: block; }

/* Trust marquee — banques compatibles */
.fh-trust {
  width: 100%;
  margin: 56px auto 0;
  padding-top: 28px;
  border-top: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
}
.fh-trust-label {
  font: 600 11px/1 var(--font-mono);
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--ink-3);
  margin-bottom: 18px;
}
.fh-marquee {
  width: 100%; overflow: hidden;
  mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
}
.fh-marquee-track {
  display: inline-flex; align-items: center; gap: 12px;
  animation: fhMarquee 36s linear infinite;
  white-space: nowrap;
}
@keyframes fhMarquee {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.fh-bank-chip {
  display: inline-flex; align-items: center;
  padding: 8px 16px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  color: var(--ink-2);
  font: 500 12.5px/1 var(--font-sans);
  letter-spacing: -0.005em;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .fh-strip { padding: 16px; }
  .fh-main { padding: 24px 16px 64px; }
  .fh-title { font-size: clamp(36px, 11vw, 56px); }
  .fh-film-frame { margin-top: 32px; }
}

@media (prefers-reduced-motion: reduce) {
  .fh-link, .fh-signin, .fh-cta { transition: none; }
  .fh-live-dot { animation: none; }
  .fh-marquee-track { animation: none; }
}
`;
