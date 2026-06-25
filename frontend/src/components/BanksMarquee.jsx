// ============================================================================
// BanksMarquee — Marquee infinie horizontale avec logos de banques compatibles
//
// Pattern Studio Namma / Lemonsqueezy / Revolut : 2 rangées de logos qui
// defilent en sens inverse, boucle infinie sans cut. GSAP animation pure
// (xPercent -100 -> 0 sur seamless tile + duplicate).
//
// Logos en SVG inline (pas d'image externe a charger) — typo brand simplifiee
// + dot couleur signature. Pas pixel-perfect mais reconnaissables.
// ============================================================================
import { useEffect, useRef } from 'react';
import { gsap, mm } from '../utils/gsapSetup.js';

const BANKS_TOP = [
  { name: 'BNP Paribas', color: '#00915A' },
  { name: 'Crédit Agricole', color: '#0E893E' },
  { name: 'Société Générale', color: '#E60000' },
  { name: 'Boursorama', color: '#FF248C' },
  { name: 'Revolut', color: '#0666EB' },
  { name: 'N26', color: '#36A18B' },
  { name: 'Crédit Mutuel', color: '#005A8C' },
  { name: 'LCL', color: '#FFD500' },
  { name: 'Hello bank!', color: '#FF008C' },
];
const BANKS_BOTTOM = [
  { name: 'Lydia', color: '#0066FF' },
  { name: 'Fortuneo', color: '#FFA300' },
  { name: 'AMEX', color: '#006FCF' },
  { name: 'ING', color: '#FF6200' },
  { name: 'Monabanq', color: '#5B2E91' },
  { name: 'La Banque Postale', color: '#FECC00' },
  { name: 'Caisse d\'Épargne', color: '#E60028' },
  { name: 'BPCE', color: '#003C7E' },
  { name: 'Qonto', color: '#1A1F39' },
];

function BankLogo({ bank }) {
  return (
    <div className="bm-logo">
      <span className="bm-dot" style={{ background: bank.color }}/>
      <span className="bm-name">{bank.name}</span>
    </div>
  );
}

export function BanksMarquee() {
  const topRef = useRef(null);
  const botRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Each marquee : DOM contient le tableau duplique 2x. On anime
        // xPercent de 0 a -50% en boucle → seamless car a -50% on retombe
        // visuellement sur l'etat initial. Rangee 2 en sens inverse pour
        // un effet stereo plus dynamique.
        if (topRef.current) {
          gsap.fromTo(topRef.current,
            { xPercent: 0 },
            { xPercent: -50, ease: 'none', duration: 36, repeat: -1 }
          );
        }
        if (botRef.current) {
          gsap.fromTo(botRef.current,
            { xPercent: -50 },
            { xPercent: 0, ease: 'none', duration: 42, repeat: -1 }
          );
        }
      });
    });
    return () => ctx.revert();
  }, []);

  // Duplicate chaque liste pour seamless loop
  const topItems = [...BANKS_TOP, ...BANKS_TOP];
  const botItems = [...BANKS_BOTTOM, ...BANKS_BOTTOM];

  return (
    <section className="bm-section" aria-label="Banques compatibles">
      <BMStyles/>
      <div className="bm-heading">
        <span className="bm-eyebrow">— Compatible avec</span>
        <h2 className="bm-title">Votre <em>banque.</em></h2>
        <p className="bm-sub">Connexion DSP2 via GoCardless — agréé Banque de France.</p>
      </div>

      <div className="bm-track-mask">
        <div ref={topRef} className="bm-track">
          {topItems.map((b, i) => <BankLogo key={`t-${i}`} bank={b}/>)}
        </div>
      </div>
      <div className="bm-track-mask">
        <div ref={botRef} className="bm-track">
          {botItems.map((b, i) => <BankLogo key={`b-${i}`} bank={b}/>)}
        </div>
      </div>
    </section>
  );
}

function BMStyles() {
  const css = `
.bm-section {
  position: relative;
  padding: 100px 0;
  background: #0F0E0C;
  overflow: hidden;
}
.bm-heading {
  max-width: 1320px;
  padding: 0 56px;
  margin: 0 auto 48px;
  text-align: center;
}
.bm-eyebrow {
  display: inline-block;
  font: 500 11px/1 'Geist Mono', monospace;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #7E92FF;
  margin-bottom: 14px;
}
.bm-title {
  font: 500 64px/1.05 'Geist', sans-serif;
  letter-spacing: -0.035em;
  color: #F1EEE4;
  margin: 0 0 12px;
}
.bm-title em {
  font-family: 'Geist', system-ui, sans-serif;
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.04em;
}
.bm-sub {
  font: 400 16px/1.5 'Geist', sans-serif;
  color: #A29E91;
  max-width: 540px;
  margin: 0 auto;
}

/* Track mask = fade-out lateral + clip horizontal */
.bm-track-mask {
  position: relative;
  overflow: hidden;
  padding: 18px 0;
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
}
.bm-track {
  display: flex;
  gap: 56px;
  white-space: nowrap;
  will-change: transform;
  /* La largeur depend du contenu — on laisse flex grandir */
  width: max-content;
}

/* Each logo block */
.bm-logo {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 18px 28px;
  background: #181714;
  border: 1px solid #2A2823;
  border-radius: 999px;
  flex-shrink: 0;
  transition: border-color 0.2s, background 0.2s;
}
.bm-logo:hover {
  border-color: #7E92FF;
  background: #1F1D17;
}
.bm-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.bm-name {
  font: 500 16px/1 'Geist', sans-serif;
  color: #F1EEE4;
  letter-spacing: -0.005em;
}

@media (max-width: 768px) {
  .bm-section { padding: 64px 0; }
  .bm-heading { padding: 0 24px; margin-bottom: 32px; }
  .bm-title { font-size: 40px; }
  .bm-sub { font-size: 14px; }
  .bm-logo { padding: 14px 22px; gap: 10px; }
  .bm-name { font-size: 14px; }
  .bm-track { gap: 36px; }
}

@media (prefers-reduced-motion: reduce) {
  .bm-track { animation: none !important; transform: none !important; }
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}
