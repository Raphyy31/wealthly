// ============================================================================
// Landing — Wealthly (design figé 2026-05-12)
//
// Dark cover, Newsreader italic masthead, accent cobalt, eyebrow pulsant,
// mockup dashboard en hero, trust badges icons, sticky CTA mobile,
// backdrop-blur nav au scroll, micro-interactions (border + bg, pas translateY).
// Texte minimal style fintech (Finary/Lydia/Qonto).
// ============================================================================
import { useEffect, useState } from 'react';
import Logo from '../components/Logo.jsx';

export default function Landing({ onSignIn, onSignUp, onTryDemo }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const prev = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'dark');
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (prev) document.documentElement.setAttribute('data-theme', prev);
    };
  }, []);

  return (
    <>
      <Styles />
      <div className="lc-page">

        {/* ============ STICKY TOP STRIP ============ */}
        <div className={`lc-strip ${scrolled ? 'is-scrolled' : ''}`}>
          <div className="lc-strip-inner">
            <div className="lc-mark">
              <Logo size={22} wordmark wordmarkSize={13} tone="cream" />
            </div>
            <div className="lc-strip-actions">
              <button className="lc-strip-link" onClick={onSignIn}>Se connecter</button>
              <button className="lc-strip-cta" onClick={onSignUp}>Essayer</button>
            </div>
          </div>
        </div>

        <div className="lc-main">

          {/* ============ MASTHEAD ============ */}
          <div className="lc-masthead">
            <div>
              <h1 className="lc-title">Votre patrimoine,<br/><em>enfin clair.</em></h1>
            </div>
            <div className="lc-deck">
              Connectez vos comptes, suivez vos placements, votre immobilier et vos crypto.
              <strong> Une seule app, zéro tableur.</strong>
            </div>
          </div>

          {/* ============ CTAs + TRUST BADGES ============ */}
          <div className="lc-cta-row">
            <button className="lc-btn-primary" onClick={onSignUp}>
              Commencer gratuitement
              <ArrowRight />
            </button>
            <button className="lc-btn-ghost" onClick={onTryDemo}>
              Voir la démo →
            </button>
          </div>
          <div className="lc-trust">
            <TrustItem icon={<ShieldIcon />} label="DSP2 · lecture seule" />
            <TrustItem icon={<LockIcon />} label="Chiffré bout-en-bout" />
            <TrustItem icon={<NoCardIcon />} label="Sans carte bancaire" />
          </div>

          {/* ============ HERO MOCKUP (le produit, gros, tout de suite) ============ */}
          <div className="lc-mockup-wrap">
            <div className="lc-mockup-frame">
              <DashboardMockup />
            </div>
            <div className="lc-mockup-glow" aria-hidden />
          </div>

          {/* ============ TEASER GRID — fonctionnalités produit ============ */}
          <div className="lc-section-head">
            <h2 className="lc-h2">Tout ce qu'il faut.<br/><em>Rien de plus.</em></h2>
          </div>

          <div className="lc-teasers">
            <div className="lc-tile lc-t-hero">
              <div className="lc-label-row">
                <div className="lc-tag">Patrimoine net</div>
                <div className="lc-range">
                  <span>1M</span><span>3M</span><span className="on">6M</span><span>1A</span><span>5A</span>
                </div>
              </div>
              <div className="lc-big num">184&nbsp;720<span className="lc-cents">,40&nbsp;€</span></div>
              <div className="lc-delta">
                <span className="lc-pill num">↑ +2&nbsp;340,12&nbsp;€&nbsp;·&nbsp;+1,28&nbsp;%</span>
                <span className="lc-vs">vs. mois dernier</span>
              </div>
              <div className="lc-chart">
                <svg viewBox="0 0 600 160" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="lc-grad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#7E92FF" stopOpacity="0.22"/>
                      <stop offset="100%" stopColor="#7E92FF" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="40"  x2="600" y2="40"  stroke="#2A2823" strokeDasharray="2 4"/>
                  <line x1="0" y1="80"  x2="600" y2="80"  stroke="#2A2823" strokeDasharray="2 4"/>
                  <line x1="0" y1="120" x2="600" y2="120" stroke="#2A2823" strokeDasharray="2 4"/>
                  <path d="M0,120 C40,115 80,100 130,95 C190,90 230,110 290,80 C340,55 380,72 430,55 C470,42 510,48 600,30 L600,160 L0,160 Z"
                        fill="url(#lc-grad)"/>
                  <path d="M0,120 C40,115 80,100 130,95 C190,90 230,110 290,80 C340,55 380,72 430,55 C470,42 510,48 600,30"
                        fill="none" stroke="#7E92FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="600" cy="30" r="4" fill="#181714" stroke="#7E92FF" strokeWidth="2"/>
                </svg>
              </div>
              <span className="lc-read">Découvrir le dashboard</span>
            </div>

            <div className="lc-tile lc-t-alloc">
              <div className="lc-tag">Allocation</div>
              <div className="lc-ttl">Tous vos actifs, par classe.</div>
              <div className="lc-alloc-row">
                <svg className="lc-donut" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#0A0908" strokeWidth="14"/>
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#4FB57A" strokeWidth="14" strokeDasharray="113 301.6" transform="rotate(-90 60 60)"/>
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#7E92FF" strokeWidth="14" strokeDasharray="75 301.6" strokeDashoffset="-113" transform="rotate(-90 60 60)"/>
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#E0975A" strokeWidth="14" strokeDasharray="48 301.6" strokeDashoffset="-188" transform="rotate(-90 60 60)"/>
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#DA8AA1" strokeWidth="14" strokeDasharray="35 301.6" strokeDashoffset="-236" transform="rotate(-90 60 60)"/>
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#B69BF2" strokeWidth="14" strokeDasharray="20 301.6" strokeDashoffset="-271" transform="rotate(-90 60 60)"/>
                </svg>
                <div className="lc-legend">
                  <div><span className="lc-sw" style={{ background: '#4FB57A' }}/>Immobilier</div>
                  <div><span className="lc-sw" style={{ background: '#7E92FF' }}/>PEA &amp; CTO</div>
                  <div><span className="lc-sw" style={{ background: '#E0975A' }}/>Ass.-vie</div>
                  <div><span className="lc-sw" style={{ background: '#DA8AA1' }}/>Livrets</div>
                  <div><span className="lc-sw" style={{ background: '#B69BF2' }}/>Crypto</div>
                </div>
              </div>
              <span className="lc-read">Voir le détail</span>
            </div>

            <div className="lc-tile lc-t-tx">
              <div className="lc-tag">Transactions</div>
              <div className="lc-ttl">Catégorisées automatiquement.</div>
              <div className="lc-tx-row">
                <div className="lc-tx-ic lc-tx-p">CB</div>
                <div>
                  <div className="lc-tx-nm">Carrefour Market</div>
                  <div className="lc-tx-mt">Alimentation · 14h22</div>
                </div>
                <div className="lc-tx-amt num">−47,30&nbsp;€</div>
              </div>
              <div className="lc-tx-row">
                <div className="lc-tx-ic">SN</div>
                <div>
                  <div className="lc-tx-nm">SNCF Connect</div>
                  <div className="lc-tx-mt">Transport · 09h08</div>
                </div>
                <div className="lc-tx-amt num">−84,00&nbsp;€</div>
              </div>
              <div className="lc-tx-row">
                <div className="lc-tx-ic lc-tx-p">SA</div>
                <div>
                  <div className="lc-tx-nm">Salaire — Manuf.</div>
                  <div className="lc-tx-mt">Revenu · 01 mai</div>
                </div>
                <div className="lc-tx-amt lc-tx-in num">+3&nbsp;280,00&nbsp;€</div>
              </div>
              <div className="lc-tx-fade"/>
              <span className="lc-read">Plus loin</span>
            </div>

            <div className="lc-tile lc-t-range">
              <div className="lc-tag">Indicateurs</div>
              <div className="lc-ttl">Les chiffres qui comptent.</div>
              <div className="lc-kpis">
                <div className="lc-kpi"><div className="lc-kpi-lbl">Liquidités</div><div className="lc-kpi-val num">12&nbsp;480&nbsp;€</div><div className="lc-kpi-dt num">+3,2&nbsp;%</div></div>
                <div className="lc-kpi"><div className="lc-kpi-lbl">Investi</div><div className="lc-kpi-val num">84&nbsp;200&nbsp;€</div><div className="lc-kpi-dt num">+1,8&nbsp;%</div></div>
                <div className="lc-kpi"><div className="lc-kpi-lbl">Immobilier</div><div className="lc-kpi-val num">88&nbsp;040&nbsp;€</div><div className="lc-kpi-dt num">+0,4&nbsp;%</div></div>
                <div className="lc-kpi"><div className="lc-kpi-lbl">Dettes</div><div className="lc-kpi-val num">42&nbsp;100&nbsp;€</div><div className="lc-kpi-dt lc-kpi-dt-n num">−0,9&nbsp;%</div></div>
              </div>
              <span className="lc-read">Lire la grille</span>
            </div>

            <button className="lc-tile lc-t-insights" onClick={onTryDemo}>
              <div className="lc-tag">Démo</div>
              <div className="lc-quote">Essayez Wealthly sans créer de compte.</div>
              <div className="lc-quote-src">Données factices — 30 secondes</div>
              <span className="lc-read">Lancer la démo</span>
            </button>
          </div>

          {/* ============ FINAL CTA ============ */}
          <div className="lc-final-cta">
            <h2 className="lc-h2">Prêt à commencer&nbsp;?</h2>
            <p className="lc-final-sub">Gratuit. Sans carte bancaire. Sans engagement.</p>
            <div className="lc-cta-row" style={{ justifyContent: 'center' }}>
              <button className="lc-btn-primary" onClick={onSignUp}>Créer mon compte<ArrowRight /></button>
              <button className="lc-btn-ghost" onClick={onTryDemo}>Voir la démo</button>
            </div>
          </div>

          {/* ============ COLOPHON ============ */}
          <div className="lc-colophon">
            <span>© {new Date().getFullYear()} Wealthly</span>
            <span><button onClick={onSignIn} className="lc-link">Se connecter</button></span>
          </div>
        </div>

        {/* ============ STICKY MOBILE CTA ============ */}
        <div className="lc-sticky-cta">
          <button className="lc-btn-primary" onClick={onSignUp}>
            Commencer gratuitement
            <ArrowRight />
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function TrustItem({ icon, label }) {
  return (
    <div className="lc-trust-item">
      <span className="lc-trust-icon">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function DashboardMockup() {
  return (
    <svg viewBox="0 0 1200 720" className="lc-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="lcHeroArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7E92FF" stopOpacity="0.28"/>
          <stop offset="100%" stopColor="#7E92FF" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1200" height="720" rx="18" fill="#0F0E0C"/>
      <rect x="0" y="0" width="1200" height="720" rx="18" fill="none" stroke="#2A2823" strokeWidth="1"/>
      {/* Top bar */}
      <rect x="24" y="24" width="180" height="28" rx="6" fill="#181714"/>
      <text x="34" y="44" fill="#F1EEE4" fontFamily="Geist, sans-serif" fontSize="13" fontWeight="500">Wealthly</text>
      {/* Sidebar */}
      <rect x="24" y="72" width="200" height="624" rx="14" fill="#181714" stroke="#2A2823"/>
      {Array.from({length:7}).map((_,i)=>(
        <g key={i}>
          <rect x="40" y={96+i*48} width="14" height="14" rx="3" fill={i===0?"#7E92FF":"#4D4A45"}/>
          <rect x="62" y={98+i*48} width={[110,80,95,75,90,65,85][i]} height="10" rx="3" fill={i===0?"#F1EEE4":"#75716A"}/>
        </g>
      ))}
      {/* Main */}
      <rect x="248" y="72" width="928" height="624" rx="14" fill="#181714" stroke="#2A2823"/>
      <text x="272" y="108" fill="#75716A" fontFamily="Geist, sans-serif" fontSize="11" letterSpacing="1.5">PATRIMOINE NET TOTAL</text>
      <text x="272" y="172" fill="#F1EEE4" fontFamily="Newsreader, Georgia, serif" fontSize="56" fontWeight="400" letterSpacing="-2">184 720,40 €</text>
      <rect x="272" y="196" width="156" height="28" rx="14" fill="#15301F"/>
      <text x="292" y="216" fill="#4FB57A" fontFamily="Geist, sans-serif" fontSize="12" fontWeight="500">↑ +2 340 € · +1,28 %</text>
      {/* Period chips */}
      {['1M','3M','6M','1A','5A'].map((p,i)=>(
        <g key={p}>
          <rect x={848+i*52} y="112" width="44" height="26" rx="6" fill={i===2?"#0A0908":"transparent"} stroke={i===2?"#2A2823":"transparent"}/>
          <text x={870+i*52} y="129" fill={i===2?"#F1EEE4":"#75716A"} fontFamily="Geist, sans-serif" fontSize="11" textAnchor="middle">{p}</text>
        </g>
      ))}
      {/* Chart */}
      <line x1="272" y1="300" x2="1144" y2="300" stroke="#2A2823" strokeDasharray="2 4"/>
      <line x1="272" y1="370" x2="1144" y2="370" stroke="#2A2823" strokeDasharray="2 4"/>
      <line x1="272" y1="440" x2="1144" y2="440" stroke="#2A2823" strokeDasharray="2 4"/>
      <path d="M272,440 C340,430 410,400 480,390 C560,378 620,408 700,358 C770,316 840,338 920,310 C990,288 1060,300 1144,260 L1144,500 L272,500 Z" fill="url(#lcHeroArea)"/>
      <path d="M272,440 C340,430 410,400 480,390 C560,378 620,408 700,358 C770,316 840,338 920,310 C990,288 1060,300 1144,260" fill="none" stroke="#7E92FF" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="1144" cy="260" r="5" fill="#181714" stroke="#7E92FF" strokeWidth="2.5"/>
      {/* Bottom cards */}
      {['Actifs','Passifs','Liquidités','Épargne · mois'].map((l,i)=>(
        <g key={l}>
          <rect x={272+i*228} y="540" width="208" height="140" rx="12" fill="#0F0E0C" stroke="#2A2823"/>
          <text x={288+i*228} y="568" fill="#75716A" fontFamily="Geist, sans-serif" fontSize="10" letterSpacing="1.5">{l.toUpperCase()}</text>
          <text x={288+i*228} y="612" fill="#F1EEE4" fontFamily="Newsreader, Georgia, serif" fontSize="26" fontWeight="400" letterSpacing="-1">{['226 820','42 100','12 480','+1 280'][i]} €</text>
          <text x={288+i*228} y="648" fill={i===1?"#E07A6E":"#4FB57A"} fontFamily="Geist, sans-serif" fontSize="11" fontWeight="500">{['+1.8 %','−0.9 %','+3.2 %','22 % rev.'][i]}</text>
        </g>
      ))}
    </svg>
  );
}

// ─── Inline icons ──────────────────────────────────────────────────────────

const ArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 5l7 7-7 7"/>
  </svg>
);
const ShieldIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const LockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>
  </svg>
);
const FrIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/>
  </svg>
);
const NoCardIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 11h20M5 17l14-14"/>
  </svg>
);

function Styles() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

const css = `
.lc-page { background: #0F0E0C; color: #F1EEE4; min-height: 100vh; font-family: 'Geist', system-ui, sans-serif; font-feature-settings: 'ss01','cv11'; -webkit-font-smoothing: antialiased; padding-bottom: 88px; }
.lc-page * { box-sizing: border-box; margin: 0; padding: 0; }
.lc-page button { font-family: inherit; cursor: pointer; }
.lc-page .num { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; }

/* STICKY TOP STRIP */
.lc-strip { position: sticky; top: 0; z-index: 50; padding: 14px 0; transition: background .2s, backdrop-filter .2s, border-color .2s; border-bottom: 1px solid transparent; }
.lc-strip.is-scrolled { background: rgba(15,14,12,0.75); backdrop-filter: blur(12px) saturate(150%); border-bottom-color: #2A2823; }
.lc-strip-inner { max-width: 1320px; margin: 0 auto; padding: 0 56px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #75716A; font-weight: 500; }
.lc-mark { display: flex; align-items: center; gap: 10px; color: #F1EEE4; }
.lc-logo { width: 22px; height: 22px; background: #F1EEE4; border-radius: 5px; display: grid; place-items: center; color: #0F0E0C; font-weight: 700; font-size: 11px; letter-spacing: 0; }
.lc-strip-actions { display: flex; align-items: center; gap: 18px; }
.lc-strip-link { background: transparent; border: none; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 500; color: #A29E91; transition: color .15s; }
.lc-strip-link:hover { color: #F1EEE4; }
.lc-strip-cta { background: #F1EEE4; color: #0F0E0C; border: none; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 500; padding: 8px 14px; border-radius: 6px; transition: background .15s; }
.lc-strip-cta:hover { background: #E5E2D8; }

.lc-main { max-width: 1320px; margin: 0 auto; padding: 0 56px 80px; }

/* MASTHEAD */
.lc-masthead { padding: 64px 0 40px; display: grid; grid-template-columns: 1.6fr 1fr; gap: 64px; align-items: end; }
.lc-eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: #1B214A; color: #A6B4FF; font-size: 11.5px; font-weight: 500; letter-spacing: -0.005em; margin-bottom: 24px; border: 1px solid #2E3A7A; }
.lc-dot { width: 6px; height: 6px; border-radius: 50%; background: #7E92FF; box-shadow: 0 0 0 4px rgba(126,146,255,0.18); animation: lcPulse 2.2s ease-in-out infinite; }
@keyframes lcPulse { 0%,100% { box-shadow: 0 0 0 4px rgba(126,146,255,0.18); } 50% { box-shadow: 0 0 0 8px rgba(126,146,255,0.04); } }
.lc-num-issue { font-family: 'Newsreader', Georgia, serif; font-style: italic; font-size: 16px; color: #75716A; font-weight: 400; margin-bottom: 12px; letter-spacing: -0.01em; }
.lc-num-issue::before { content: "№ "; color: #4D4A45; }
.lc-title { font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(60px, 8.5vw, 120px); line-height: 0.92; letter-spacing: -0.045em; color: #F1EEE4; }
.lc-title em { font-style: italic; color: #A29E91; }
.lc-deck { font-size: 17px; line-height: 1.5; color: #A29E91; max-width: 38ch; letter-spacing: -0.005em; padding-bottom: 8px; }
.lc-deck strong { color: #F1EEE4; font-weight: 500; }

/* CTA + TRUST */
.lc-cta-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 8px; margin-bottom: 20px; }
.lc-btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #F1EEE4; color: #0F0E0C; border: none; font-size: 14px; font-weight: 500; letter-spacing: -0.005em; padding: 13px 22px; border-radius: 8px; transition: background .15s, box-shadow .2s; box-shadow: 0 1px 0 rgba(0,0,0,.3), 0 4px 14px -4px rgba(126,146,255,.25); }
.lc-btn-primary:hover { background: #E5E2D8; box-shadow: 0 1px 0 rgba(0,0,0,.3), 0 8px 22px -6px rgba(126,146,255,.4); }
.lc-btn-ghost { background: transparent; border: 1px solid #3A382F; color: #F1EEE4; font-size: 14px; font-weight: 500; letter-spacing: -0.005em; padding: 12px 22px; border-radius: 8px; transition: background .15s, border-color .15s; }
.lc-btn-ghost:hover { background: #1F1D19; border-color: #A29E91; }
.lc-trust { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; padding-bottom: 8px; }
.lc-trust-item { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: #A29E91; font-weight: 500; letter-spacing: -0.005em; }
.lc-trust-icon { color: #75716A; display: grid; place-items: center; }

/* MOCKUP — gros, dès le hero */
.lc-mockup-wrap { position: relative; margin-top: 56px; }
.lc-mockup-glow { position: absolute; inset: 10% -5% -10% -5%; background: radial-gradient(50% 60% at 50% 30%, rgba(126,146,255,0.16) 0%, transparent 70%); pointer-events: none; z-index: 0; }
.lc-mockup-frame { position: relative; z-index: 1; background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0)); border-radius: 22px; padding: 10px; border: 1px solid #2A2823; box-shadow: 0 1px 0 rgba(0,0,0,.5), 0 40px 100px -32px rgba(0,0,0,.7), 0 12px 32px -8px rgba(126,146,255,.15); }
.lc-svg { width: 100%; height: auto; display: block; border-radius: 14px; }

/* BYLINE */
.lc-byline { margin-top: 72px; padding-top: 24px; border-top: 1px solid #2A2823; display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; }
.lc-byline-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: #75716A; margin-bottom: 8px; }
.lc-byline-v { font-size: 14px; color: #F1EEE4; letter-spacing: -0.005em; }
.lc-byline-v em { font-family: 'Newsreader', Georgia, serif; font-style: italic; font-weight: 400; }

/* SECTION HEAD */
.lc-section-head { margin-top: 96px; margin-bottom: 24px; }
.lc-section-eyebrow { font-family: 'Geist Mono', monospace; font-size: 11px; color: #75716A; letter-spacing: 0.05em; margin-bottom: 12px; }
.lc-h2 { font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(34px, 4.5vw, 54px); line-height: 1.05; letter-spacing: -0.035em; color: #F1EEE4; max-width: 18ch; }
.lc-h2 em { font-style: italic; color: #A29E91; }

/* TEASERS */
.lc-teasers { margin-top: 24px; display: grid; grid-template-columns: 1.4fr 1fr 1fr; grid-template-rows: auto auto; gap: 20px; grid-template-areas: "hero alloc tx" "hero range insights"; }
.lc-tile { background: #181714; border: 1px solid #2A2823; border-radius: 16px; padding: 22px 22px 18px; overflow: hidden; position: relative; transition: border-color .18s, background .18s; text-align: left; display: flex; flex-direction: column; font-family: inherit; color: inherit; }
.lc-tile:hover { border-color: #3A382F; background: #1A1916; }
.lc-tag { font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: #75716A; font-weight: 500; margin-bottom: 10px; }
.lc-ttl { font-size: 14px; font-weight: 500; letter-spacing: -0.005em; color: #F1EEE4; margin-bottom: 14px; }
.lc-read { position: absolute; bottom: 14px; right: 18px; font-family: 'Newsreader', Georgia, serif; font-style: italic; font-size: 13px; color: #75716A; }
.lc-read::after { content: " →"; font-style: normal; font-family: 'Geist', system-ui, sans-serif; }

.lc-t-hero { grid-area: hero; padding: 26px 26px 22px; min-height: 380px; }
.lc-label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.lc-range { display: flex; background: #0A0908; border-radius: 8px; padding: 3px; font-size: 11px; }
.lc-range span { padding: 4px 10px; border-radius: 6px; color: #75716A; }
.lc-range .on { background: #181714; color: #F1EEE4; font-weight: 500; }
.lc-big { font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: 78px; line-height: 1; letter-spacing: -0.04em; margin-top: 18px; color: #F1EEE4; }
.lc-cents { color: #75716A; font-size: 40px; }
.lc-delta { margin-top: 14px; display: flex; align-items: center; gap: 12px; }
.lc-pill { display: inline-flex; align-items: center; gap: 6px; background: #15301F; color: #4FB57A; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; }
.lc-vs { font-size: 13px; color: #A29E91; }
.lc-chart { margin-top: auto; height: 140px; position: relative; }
.lc-chart svg { width: 100%; height: 100%; }
.lc-chart::after { content: ""; position: absolute; inset: 0 -26px 0 60%; background: linear-gradient(90deg, transparent, #181714 70%); pointer-events: none; }

.lc-t-alloc { grid-area: alloc; min-height: 200px; }
.lc-donut { width: 100px; height: 100px; margin: 8px 0; }
.lc-legend { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; color: #A29E91; }
.lc-legend div { display: flex; align-items: center; gap: 8px; }
.lc-sw { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.lc-alloc-row { display: flex; align-items: center; gap: 18px; }

.lc-t-tx { grid-area: tx; min-height: 200px; }
.lc-tx-row { display: grid; grid-template-columns: 26px 1fr auto; gap: 10px; padding: 7px 0; align-items: center; border-top: 1px solid #2A2823; }
.lc-tx-row:first-of-type { border-top: 0; }
.lc-tx-ic { width: 26px; height: 26px; border-radius: 6px; display: grid; place-items: center; font-size: 10px; font-weight: 600; background: #1B214A; color: #7E92FF; }
.lc-tx-ic.lc-tx-p { background: #15301F; color: #4FB57A; }
.lc-tx-nm { font-size: 12.5px; font-weight: 500; }
.lc-tx-mt { font-size: 11px; color: #75716A; margin-top: 1px; }
.lc-tx-amt { font-size: 12.5px; font-weight: 500; }
.lc-tx-amt.lc-tx-in { color: #4FB57A; }
.lc-tx-fade { height: 30px; margin-top: 6px; background: linear-gradient(180deg, transparent, #181714); margin-left: -22px; margin-right: -22px; pointer-events: none; }

.lc-t-range { grid-area: range; min-height: 180px; }
.lc-kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 12px; margin-top: 4px; }
.lc-kpi-lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #75716A; margin-bottom: 4px; }
.lc-kpi-val { font-size: 17px; font-weight: 500; letter-spacing: -0.01em; }
.lc-kpi-dt { font-size: 11px; margin-top: 2px; color: #4FB57A; }
.lc-kpi-dt-n { color: #E07A6E; }

.lc-t-insights { grid-area: insights; min-height: 180px; background: #F1EEE4; color: #0F0E0C; border-color: #F1EEE4; cursor: pointer; text-align: left; }
.lc-t-insights .lc-tag { color: rgba(15,14,12,.55); }
.lc-quote { font-family: 'Newsreader', Georgia, serif; font-style: italic; font-size: 19px; line-height: 1.35; letter-spacing: -0.015em; color: #0F0E0C; margin-top: 4px; }
.lc-quote-src { margin-top: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: rgba(15,14,12,.55); }
.lc-t-insights .lc-read { color: rgba(15,14,12,.6); }
.lc-t-insights:hover { background: #E5E2D8; border-color: #E5E2D8; }

/* TOC */
.lc-toc { margin-top: 96px; padding-top: 28px; border-top: 1px solid #2A2823; display: grid; grid-template-columns: 1fr 3fr; gap: 56px; }
.lc-toc-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #75716A; font-weight: 500; }
.lc-toc ol { list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 40px; counter-reset: section; }
.lc-toc li { counter-increment: section; display: grid; grid-template-columns: 28px 1fr auto; gap: 12px; align-items: baseline; font-size: 15px; letter-spacing: -0.005em; padding-bottom: 6px; border-bottom: 1px dashed #2A2823; }
.lc-toc li::before { content: counter(section, decimal-leading-zero); font-family: 'Geist Mono', monospace; font-size: 11px; color: #75716A; }
.lc-toc-nm em { font-family: 'Newsreader', Georgia, serif; font-style: italic; color: #A29E91; font-weight: 400; }
.lc-toc-pg { font-family: 'Geist Mono', monospace; font-size: 11px; color: #75716A; }

/* FINAL CTA */
.lc-final-cta { margin-top: 112px; padding: 56px 0; text-align: center; border-top: 1px solid #2A2823; }
.lc-final-eyebrow { font-family: 'Geist Mono', monospace; font-size: 11px; color: #75716A; letter-spacing: 0.05em; margin-bottom: 16px; }
.lc-final-cta .lc-h2 { margin: 0 auto 18px; }
.lc-final-sub { font-size: 16px; color: #A29E91; max-width: 52ch; margin: 0 auto 28px; line-height: 1.55; }

/* COLOPHON */
.lc-colophon { margin-top: 56px; padding-top: 18px; border-top: 1px solid #2A2823; display: flex; justify-content: space-between; align-items: center; font-size: 11px; letter-spacing: 0.06em; color: #75716A; }
.lc-star { font-size: 16px; color: #4D4A45; letter-spacing: 0.8em; }
.lc-link { background: transparent; border: none; font-size: 11px; letter-spacing: 0.06em; color: #75716A; text-decoration: underline; text-underline-offset: 3px; transition: color .15s; }
.lc-link:hover { color: #F1EEE4; }

/* STICKY MOBILE CTA */
.lc-sticky-cta { display: none; }

/* RESPONSIVE */
@media (max-width: 1080px) {
  .lc-strip-inner { padding: 0 32px; }
  .lc-main { padding: 0 32px 48px; }
  .lc-masthead { grid-template-columns: 1fr; gap: 32px; }
  .lc-teasers { grid-template-columns: 1fr 1fr; grid-template-areas: "hero hero" "alloc tx" "range insights"; }
  .lc-byline { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 680px) {
  .lc-strip { padding: 12px 0; }
  .lc-strip-inner { padding: 0 20px; }
  .lc-strip-link { display: none; }
  .lc-main { padding: 0 20px 40px; }
  .lc-masthead { padding: 32px 0 28px; }
  .lc-mockup-wrap { margin-top: 36px; }
  .lc-mockup-frame { padding: 5px; border-radius: 14px; }
  .lc-svg { border-radius: 10px; }
  .lc-byline { grid-template-columns: 1fr; }
  .lc-section-head { margin-top: 72px; }
  .lc-teasers { grid-template-columns: 1fr; grid-template-areas: "hero" "alloc" "tx" "range" "insights"; }
  .lc-big { font-size: 56px; }
  .lc-cents { font-size: 28px; }
  .lc-toc { grid-template-columns: 1fr; gap: 18px; margin-top: 72px; }
  .lc-toc ol { grid-template-columns: 1fr; }
  .lc-final-cta { margin-top: 72px; padding: 40px 0; }
  .lc-trust { gap: 14px; }
  .lc-trust-item { font-size: 12px; }
  .lc-sticky-cta { display: block; position: fixed; bottom: 0; left: 0; right: 0; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: rgba(15,14,12,0.92); backdrop-filter: blur(12px) saturate(150%); border-top: 1px solid #2A2823; z-index: 40; }
  .lc-sticky-cta .lc-btn-primary { width: 100%; justify-content: center; }
  .lc-page { padding-bottom: 80px; }
}
`;
