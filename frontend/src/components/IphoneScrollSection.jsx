// ============================================================================
// IphoneScrollSection — Landing scroll-pinned iPhone (pattern Apple ProductPage)
//
// L'iPhone reste fixe au centre pendant que l'user scrolle, les ecrans a
// l'interieur changent en cross-fade. A cote, le texte explique la feature
// active. 4 etapes : Dashboard -> Wealth -> Transactions -> Mois type.
//
// Tech :
//   - ScrollTrigger pin + scrub pour synchroniser anim et scroll
//   - Cross-fade des 4 screens (opacity stagger sur progress 0-1)
//   - Texte qui change a chaque palier (3/4 de la duree par screen)
//   - iPhone tilt subtil (-3deg -> 0deg -> +3deg) au scroll
//   - Respect prefers-reduced-motion via gsap.matchMedia
//
// Le mockup interieur reutilise les memes tokens visuels que DashboardMockup
// dans Landing.jsx (dark #0F0E0C + accent cobalt #7E92FF + ink #F1EEE4) pour
// la coherence visuelle avec le hero.
// ============================================================================
import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger, mm } from '../utils/gsapSetup.js';

const STEPS = [
  {
    key: 'dashboard',
    eyebrow: '01 / DASHBOARD',
    title: 'Vue d\'ensemble',
    titleEm: 'instantanée.',
    body: 'Patrimoine net, allocation, dernières opérations. Le seul écran qui répond à "où en suis-je ?" sans cliquer trois fois.',
  },
  {
    key: 'wealth',
    eyebrow: '02 / PATRIMOINE',
    title: 'Tout votre',
    titleEm: 'patrimoine.',
    body: 'Comptes bancaires, immobilier, placements, cryptos, emprunts. Manuellement ou synchronisé via DSP2.',
  },
  {
    key: 'transactions',
    eyebrow: '03 / TRANSACTIONS',
    title: 'Catégorisé',
    titleEm: 'automatiquement.',
    body: 'Vos opérations regroupées par jour, marchand, catégorie. L\'IA propose, vous confirmez. Une fois suffit.',
  },
  {
    key: 'monthly',
    eyebrow: '04 / MOIS TYPE',
    title: 'Le réel,',
    titleEm: 'vs prévu.',
    body: 'Définissez votre mois type une fois. À chaque clôture, voyez où vous avez tenu, où vous avez dérapé.',
  },
];

export function IphoneScrollSection() {
  const rootRef = useRef(null);
  const phoneRef = useRef(null);
  const stepRefs = useRef([]);
  const screenRefs = useRef([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      mm.add(
        {
          motionOk: '(prefers-reduced-motion: no-preference)',
          reduced: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const { motionOk, reduced } = context.conditions;

          // En reduced-motion, on rend tout visible direct, pas de pin scroll.
          if (reduced) {
            gsap.set(stepRefs.current, { opacity: 1 });
            gsap.set(screenRefs.current, { opacity: 1 });
            return;
          }

          if (!motionOk || !rootRef.current) return;

          const total = STEPS.length;
          const screenDuration = 1 / total;

          // ── State initial explicit via GSAP (l'inline style React peut etre
          // outrepasse par d'autres facteurs). Force opacity 1 sur screen[0]
          // et 0 sur les autres avant que la timeline ne commence.
          screenRefs.current.forEach((screen, i) => {
            if (!screen) return;
            gsap.set(screen, { opacity: i === 0 ? 1 : 0 });
          });

          // ── Timeline scrubable pinnée sur la section ──────────────────
          // Pin range = ~3 viewport heights pour 4 screens — feedback user
          // 2026-05-19 "trop lent + page trop longue". Avant : 4.5 vh, trop
          // lourd. Maintenant chaque screen prend ~0.75 vh de scroll, le
          // sweet spot des pages produit Apple/Linear/Mercury. scrub:0.5
          // pour une sync plus snappy avec le scroll.
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: rootRef.current,
              start: 'top top',
              end: () => `+=${window.innerHeight * (total * 0.75)}`,
              pin: true,
              scrub: 0.5,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });

          // ── Cross-fade des screens (chaque ecran fade-in au moment de son step)
          screenRefs.current.forEach((screen, i) => {
            if (!screen) return;
            // Le 1er ecran est deja visible (opacity 1 par defaut). Pour les
            // autres on les rend visibles a leur moment.
            if (i === 0) return;
            tl.to(screen, { opacity: 1, duration: screenDuration * 0.5 }, i * screenDuration - screenDuration * 0.25);
            tl.to(screenRefs.current[i - 1], { opacity: 0, duration: screenDuration * 0.5 }, i * screenDuration - screenDuration * 0.25);
          });

          // ── Texte qui apparait/disparait au meme rythme ─────────────────
          stepRefs.current.forEach((step, i) => {
            if (!step) return;
            if (i === 0) {
              gsap.set(step, { opacity: 1, y: 0 });
              if (i < total - 1) {
                tl.to(step, { opacity: 0, y: -20, duration: screenDuration * 0.4 }, (i + 1) * screenDuration - screenDuration * 0.2);
              }
              return;
            }
            gsap.set(step, { opacity: 0, y: 20 });
            tl.to(step, { opacity: 1, y: 0, duration: screenDuration * 0.4 }, i * screenDuration - screenDuration * 0.2);
            if (i < total - 1) {
              tl.to(step, { opacity: 0, y: -20, duration: screenDuration * 0.4 }, (i + 1) * screenDuration - screenDuration * 0.2);
            }
          });

          // ── Tilt subtil de l'iPhone sur toute la sequence ─────────────
          // Le phone se redresse legerement (-3deg -> 0 -> +3deg).
          if (phoneRef.current) {
            gsap.fromTo(
              phoneRef.current,
              { rotationY: -6, rotationX: 3, rotationZ: -0.5 },
              {
                rotationY: 6,
                rotationX: -3,
                rotationZ: 0.5,
                ease: 'none',
                scrollTrigger: {
                  trigger: rootRef.current,
                  start: 'top top',
                  end: () => `+=${window.innerHeight * (total * 0.75)}`,
                  scrub: 1,
                },
              }
            );
          }
        }
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <section ref={rootRef} className="lc-iphone-section" aria-label="Présentation produit">
      <IphoneStyles/>
      <div className="lc-iphone-grid">

        {/* ─── COLONNE GAUCHE : eyebrow + texte (4 steps superposes) ─── */}
        <div className="lc-iphone-copy">
          <div className="lc-iphone-copy-eyebrow">— Le produit en 4 écrans</div>
          <div className="lc-iphone-copy-stack">
            {STEPS.map((step, i) => (
              <div
                key={step.key}
                ref={(el) => (stepRefs.current[i] = el)}
                className="lc-iphone-step"
              >
                <div className="lc-iphone-step-eyebrow mono">{step.eyebrow}</div>
                <h3 className="lc-iphone-step-title">
                  {step.title}<br/><em>{step.titleEm}</em>
                </h3>
                <p className="lc-iphone-step-body">{step.body}</p>
              </div>
            ))}
          </div>
          {/* Progress dots */}
          <div className="lc-iphone-dots" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className="lc-iphone-dot"/>
            ))}
          </div>
        </div>

        {/* ─── COLONNE DROITE : iPhone frame avec ecrans qui cyclent ─── */}
        <div className="lc-iphone-stage">
          <div ref={phoneRef} className="lc-iphone-frame">
            {/* Notch */}
            <div className="lc-iphone-notch" aria-hidden/>
            {/* Screen */}
            <div className="lc-iphone-screen">
              {STEPS.map((step, i) => (
                <div
                  key={step.key}
                  ref={(el) => (screenRefs.current[i] = el)}
                  className="lc-iphone-screen-content"
                  style={{ opacity: i === 0 ? 1 : 0 }}
                >
                  <MiniScreen kind={step.key}/>
                </div>
              ))}
              {/* Reflexion subtile */}
              <div className="lc-iphone-shine" aria-hidden/>
            </div>
            {/* Side button + power */}
            <div className="lc-iphone-side-btn" aria-hidden/>
            <div className="lc-iphone-power-btn" aria-hidden/>
          </div>
          {/* Glow */}
          <div className="lc-iphone-glow" aria-hidden/>
        </div>

      </div>
    </section>
  );
}

// ============================================================================
// MiniScreen — Mockup simplifie de chaque ecran de l'app dans le format
// portrait iPhone (env 380x780). Pas trop charge — l'idee est de donner une
// impression du contenu, pas de reproduire l'app pixel-perfect.
// ============================================================================
function MiniScreen({ kind }) {
  if (kind === 'dashboard') {
    return (
      <svg viewBox="0 0 380 780" className="lc-mini-svg" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width="380" height="780" fill="#0F0E0C"/>
        {/* Status bar */}
        <text x="24" y="34" fill="#F1EEE4" fontFamily="Geist, sans-serif" fontSize="11" fontWeight="500">9:41</text>
        <circle cx="340" cy="30" r="3" fill="#F1EEE4"/>
        <circle cx="350" cy="30" r="3" fill="#F1EEE4"/>
        <circle cx="360" cy="30" r="3" fill="#F1EEE4"/>
        {/* Header */}
        <text x="24" y="86" fill="#75716A" fontFamily="Geist, sans-serif" fontSize="10" letterSpacing="1.3">PATRIMOINE NET</text>
        <text x="24" y="138" fill="#F1EEE4" fontFamily="Newsreader, Georgia, serif" fontSize="44" fontWeight="400" letterSpacing="-1.5">184 720 €</text>
        <rect x="24" y="158" width="100" height="22" rx="11" fill="#15301F"/>
        <text x="40" y="173" fill="#4FB57A" fontFamily="Geist, sans-serif" fontSize="10" fontWeight="500">↑ +1,28 %</text>
        {/* Chart */}
        <path d="M24,300 C60,290 90,260 130,250 C180,238 220,268 260,218 C310,176 340,198 356,170" stroke="#7E92FF" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <circle cx="356" cy="170" r="4" fill="#0F0E0C" stroke="#7E92FF" strokeWidth="2"/>
        {/* KPI cards */}
        {['Cash','Immo','Épargne'].map((l, i) => (
          <g key={l}>
            <rect x="24" y={400 + i * 84} width="332" height="68" rx="12" fill="#181714" stroke="#2A2823"/>
            <text x="40" y={426 + i * 84} fill="#75716A" fontFamily="Geist, sans-serif" fontSize="9" letterSpacing="1.1">{l.toUpperCase()}</text>
            <text x="40" y={454 + i * 84} fill="#F1EEE4" fontFamily="Geist, sans-serif" fontSize="20" fontWeight="500">{['41 477 €', '421 421 €', '4 753 €'][i]}</text>
          </g>
        ))}
      </svg>
    );
  }
  if (kind === 'wealth') {
    return (
      <svg viewBox="0 0 380 780" className="lc-mini-svg" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width="380" height="780" fill="#0F0E0C"/>
        <text x="24" y="34" fill="#F1EEE4" fontFamily="Geist, sans-serif" fontSize="11" fontWeight="500">9:41</text>
        <text x="24" y="86" fill="#75716A" fontFamily="Geist, sans-serif" fontSize="10" letterSpacing="1.3">VOTRE PATRIMOINE</text>
        {/* Donut chart placeholder */}
        <g transform="translate(190 220)">
          <circle r="80" fill="none" stroke="#2A2823" strokeWidth="14"/>
          <circle r="80" fill="none" stroke="#7E92FF" strokeWidth="14" strokeDasharray="220 502" transform="rotate(-90)"/>
          <circle r="80" fill="none" stroke="#A29475" strokeWidth="14" strokeDasharray="120 502" strokeDashoffset="-220" transform="rotate(-90)"/>
          <circle r="80" fill="none" stroke="#75A289" strokeWidth="14" strokeDasharray="80 502" strokeDashoffset="-340" transform="rotate(-90)"/>
          <text x="0" y="-4" fill="#F1EEE4" fontFamily="Geist, sans-serif" fontSize="11" textAnchor="middle">Total</text>
          <text x="0" y="20" fill="#F1EEE4" fontFamily="Newsreader, Georgia, serif" fontSize="22" textAnchor="middle">796 k€</text>
        </g>
        {/* Categories */}
        {[
          { label: 'Immobilier', val: '755 k€', pct: '95 %', color: '#7E92FF' },
          { label: 'Épargne', val: '37 k€', pct: '5 %', color: '#A29475' },
          { label: 'Placements', val: '3,7 k€', pct: '0 %', color: '#75A289' },
        ].map((row, i) => (
          <g key={row.label}>
            <rect x="24" y={420 + i * 64} width="332" height="52" rx="10" fill="#181714" stroke="#2A2823"/>
            <circle cx="44" cy={446 + i * 64} r="5" fill={row.color}/>
            <text x="60" y={450 + i * 64} fill="#F1EEE4" fontFamily="Geist, sans-serif" fontSize="13" fontWeight="500">{row.label}</text>
            <text x="340" y={444 + i * 64} fill="#F1EEE4" fontFamily="Geist, sans-serif" fontSize="13" fontWeight="500" textAnchor="end">{row.val}</text>
            <text x="340" y={462 + i * 64} fill="#75716A" fontFamily="Geist, sans-serif" fontSize="10" textAnchor="end">{row.pct}</text>
          </g>
        ))}
      </svg>
    );
  }
  if (kind === 'transactions') {
    const TX = [
      { date: 'Lun 18 mai', label: 'KLARNA', cat: 'Logement', amt: '-120,33 €', col: '#FF8B6B' },
      { date: '', label: 'PREDICA', cat: 'Assurances', amt: '-40,80 €', col: '#A29475' },
      { date: '', label: 'CRÉDIT AGRICOLE', cat: 'Virement', amt: '-50,00 €', col: '#7E92FF' },
      { date: 'Dim 17 mai', label: 'FRANPRIX', cat: 'Courses', amt: '-32,15 €', col: '#75A289' },
      { date: '', label: 'NETFLIX', cat: 'Abonnements', amt: '-13,49 €', col: '#FF8B6B' },
    ];
    return (
      <svg viewBox="0 0 380 780" className="lc-mini-svg" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width="380" height="780" fill="#0F0E0C"/>
        <text x="24" y="34" fill="#F1EEE4" fontFamily="Geist, sans-serif" fontSize="11" fontWeight="500">9:41</text>
        <text x="24" y="86" fill="#75716A" fontFamily="Geist, sans-serif" fontSize="10" letterSpacing="1.3">VOS TRANSACTIONS</text>
        <text x="24" y="130" fill="#F1EEE4" fontFamily="Newsreader, Georgia, serif" fontSize="28" fontWeight="400">114 ce mois</text>
        {/* Filter chips */}
        {['Tout', 'Dépenses', 'Revenus'].map((c, i) => (
          <g key={c}>
            <rect x={24 + i * 80} y="156" width="72" height="28" rx="14" fill={i === 0 ? '#7E92FF' : '#181714'} stroke={i === 0 ? '#7E92FF' : '#2A2823'}/>
            <text x={60 + i * 80} y="174" fill={i === 0 ? '#0F0E0C' : '#F1EEE4'} fontFamily="Geist, sans-serif" fontSize="11" fontWeight="500" textAnchor="middle">{c}</text>
          </g>
        ))}
        {/* Tx list */}
        {TX.map((tx, i) => (
          <g key={i}>
            {tx.date && <text x="24" y={224 + i * 90} fill="#75716A" fontFamily="Geist, sans-serif" fontSize="10" letterSpacing="0.8">{tx.date.toUpperCase()}</text>}
            <rect x="24" y={234 + i * 90} width="332" height="64" rx="12" fill="#181714" stroke="#2A2823"/>
            <circle cx="48" cy={266 + i * 90} r="14" fill={tx.col} opacity="0.18"/>
            <circle cx="48" cy={266 + i * 90} r="4" fill={tx.col}/>
            <text x="72" y={262 + i * 90} fill="#F1EEE4" fontFamily="Geist, sans-serif" fontSize="12" fontWeight="500">{tx.label}</text>
            <text x="72" y={278 + i * 90} fill="#75716A" fontFamily="Geist, sans-serif" fontSize="10">{tx.cat}</text>
            <text x="340" y={272 + i * 90} fill="#F1EEE4" fontFamily="Geist, sans-serif" fontSize="13" fontWeight="500" textAnchor="end">{tx.amt}</text>
          </g>
        ))}
      </svg>
    );
  }
  // monthly
  return (
    <svg viewBox="0 0 380 780" className="lc-mini-svg" preserveAspectRatio="xMidYMid meet">
      <rect x="0" y="0" width="380" height="780" fill="#0F0E0C"/>
      <text x="24" y="34" fill="#F1EEE4" fontFamily="Geist, sans-serif" fontSize="11" fontWeight="500">9:41</text>
      <text x="24" y="86" fill="#75716A" fontFamily="Geist, sans-serif" fontSize="10" letterSpacing="1.3">RÉEL VS MOIS TYPE — MAI</text>
      <text x="24" y="130" fill="#F1EEE4" fontFamily="Newsreader, Georgia, serif" fontSize="28" fontWeight="400">Reste 1 240 €</text>
      <text x="24" y="156" fill="#75716A" fontFamily="Geist, sans-serif" fontSize="11">sur 6 850 € prévus</text>
      {/* Progress bar */}
      <rect x="24" y="180" width="332" height="6" rx="3" fill="#181714"/>
      <rect x="24" y="180" width="272" height="6" rx="3" fill="#7E92FF"/>
      <text x="340" y="206" fill="#F1EEE4" fontFamily="Geist, sans-serif" fontSize="11" fontWeight="500" textAnchor="end">82 %</text>
      {/* Diverging bars */}
      {[
        { label: 'Restaurants', ref: 220, real: 740, bad: true },
        { label: 'Logement', ref: 1850, real: 1850, bad: null },
        { label: 'Courses', ref: 680, real: 420, bad: false },
        { label: 'Transports', ref: 180, real: 310, bad: true },
        { label: 'Loisirs', ref: 320, real: 180, bad: false },
      ].map((row, i) => {
        const max = 1850;
        const refW = (row.ref / max) * 220;
        const realW = (row.real / max) * 220;
        const realColor = row.bad === true ? '#E07A57' : row.bad === false ? '#4FB57A' : '#75716A';
        return (
          <g key={row.label} transform={`translate(24 ${248 + i * 88})`}>
            <text x="0" y="0" fill="#F1EEE4" fontFamily="Geist, sans-serif" fontSize="12" fontWeight="500">{row.label}</text>
            <rect x="0" y="14" width={refW} height="10" rx="2" fill="#181714" stroke="#2A2823"/>
            <rect x="0" y="32" width={realW} height="10" rx="2" fill={realColor}/>
            <text x="332" y="42" fill={realColor} fontFamily="Geist, sans-serif" fontSize="11" fontWeight="500" textAnchor="end">
              {row.real > row.ref ? '+' : ''}{row.real - row.ref} €
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ============================================================================
// Styles dedicated to this section
// ============================================================================
function IphoneStyles() {
  const css = `
.lc-iphone-section {
  position: relative;
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0A0908;
  padding: 80px 0;
  overflow: hidden;
}
.lc-iphone-grid {
  width: 100%;
  max-width: 1320px;
  padding: 0 56px;
  display: grid;
  grid-template-columns: 1fr 460px;
  gap: 80px;
  align-items: center;
}

/* ─── Copy column ─────────────────────────────────────────────────── */
.lc-iphone-copy {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.lc-iphone-copy-eyebrow {
  font: 500 11px/1 'Geist Mono', monospace;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #75716A;
}
.lc-iphone-copy-stack {
  position: relative;
  min-height: 340px;
}
.lc-iphone-step {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  will-change: opacity, transform;
}
.lc-iphone-step-eyebrow {
  font: 500 10.5px/1 'Geist Mono', monospace;
  letter-spacing: 0.22em;
  color: #7E92FF;
}
.mono { font-family: 'Geist Mono', monospace; }
.lc-iphone-step-title {
  font: 500 64px/1.05 'Geist', sans-serif;
  letter-spacing: -0.035em;
  color: #F1EEE4;
  margin: 0;
}
.lc-iphone-step-title em {
  font-family: 'Newsreader', Georgia, serif;
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.04em;
}
.lc-iphone-step-body {
  font: 400 17px/1.55 'Geist', sans-serif;
  color: #A29E91;
  max-width: 480px;
  margin: 0;
}
.lc-iphone-dots {
  display: inline-flex;
  gap: 8px;
  margin-top: 20px;
}
.lc-iphone-dot {
  width: 28px;
  height: 2px;
  border-radius: 2px;
  background: #2A2823;
}

/* ─── iPhone stage ────────────────────────────────────────────────── */
.lc-iphone-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1800px;
  perspective-origin: 50% 40%;
}
.lc-iphone-frame {
  position: relative;
  width: 360px;
  height: 740px;
  background: linear-gradient(150deg, #1F1C16 0%, #0F0E0C 60%, #1A1813 100%);
  border-radius: 52px;
  box-shadow:
    0 1px 0 1px #2A2823,
    0 0 0 6px #0F0E0C,
    0 30px 80px -20px rgba(126, 146, 255, 0.20),
    0 50px 100px -30px rgba(0, 0, 0, 0.7);
  will-change: transform;
  transform-style: preserve-3d;
}
.lc-iphone-notch {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: 110px;
  height: 32px;
  background: #050402;
  border-radius: 18px;
  z-index: 3;
}
.lc-iphone-screen {
  position: absolute;
  inset: 8px;
  border-radius: 44px;
  overflow: hidden;
  background: #0F0E0C;
}
.lc-iphone-screen-content {
  position: absolute;
  inset: 0;
  will-change: opacity;
}
.lc-mini-svg {
  width: 100%;
  height: 100%;
  display: block;
}
.lc-iphone-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 30%, transparent 60%, rgba(126,146,255,0.04) 100%);
  pointer-events: none;
  z-index: 2;
}
.lc-iphone-side-btn {
  position: absolute;
  top: 130px;
  right: -3px;
  width: 4px;
  height: 64px;
  background: #2A2823;
  border-radius: 0 2px 2px 0;
}
.lc-iphone-power-btn {
  position: absolute;
  top: 200px;
  left: -3px;
  width: 4px;
  height: 100px;
  background: #2A2823;
  border-radius: 2px 0 0 2px;
}
.lc-iphone-glow {
  position: absolute;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(126, 146, 255, 0.18) 0%, rgba(126, 146, 255, 0) 60%);
  filter: blur(40px);
  z-index: -1;
}

/* ─── Responsive ──────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .lc-iphone-grid { grid-template-columns: 1fr; gap: 48px; padding: 0 32px; }
  .lc-iphone-stage { order: -1; }
  .lc-iphone-frame { width: 280px; height: 580px; border-radius: 42px; }
  .lc-iphone-notch { width: 88px; height: 26px; }
  .lc-iphone-screen { inset: 6px; border-radius: 36px; }
  .lc-iphone-step-title { font-size: 44px; }
  .lc-iphone-step-body { font-size: 15px; }
  .lc-iphone-copy-stack { min-height: 240px; }
}
@media (max-width: 640px) {
  .lc-iphone-grid { padding: 0 20px; }
  .lc-iphone-frame { width: 240px; height: 500px; }
  .lc-iphone-step-title { font-size: 36px; }
}
@media (prefers-reduced-motion: reduce) {
  .lc-iphone-step { position: relative; opacity: 1 !important; transform: none !important; }
  .lc-iphone-copy-stack { min-height: auto; }
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}
