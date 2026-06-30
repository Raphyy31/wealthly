// Details.jsx — Wealthly Landing v4 page détails (port ESM 2026-05-22)
// Bento-style: hero compact + grid de modules + pricing + faq grid + outro
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import './styles.css';
import './details.css';

// Callbacks injected via prop drill from <Details/> root.
const DetailsCtx = React.createContext({});

/* ====================================================================
   STRIP — header sticky
   ==================================================================== */
function Strip() {
  const { onSignIn, onSignUp, onShowCinematic } = React.useContext(DetailsCtx);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={`strip ${scrolled ? 'scrolled' : ''}`}>
      <div className="strip-inner">
        <a className="strip-mark" href="#" onClick={(e) => { e.preventDefault(); onShowCinematic?.(); }}>
          <div className="strip-mark-glyph">w</div>
          <div className="strip-mark-word">wealthly</div>
        </a>
        <div className="strip-actions">
          <button className="strip-link" onClick={onSignIn}>Se connecter</button>
          <button className="strip-cta" onClick={onSignUp}>Essayer</button>
        </div>
      </div>
    </header>
  );
}

/* ====================================================================
   HERO compact — H1 + sub + back to demo link
   ==================================================================== */
function Hero() {
  const h1Ref = useRef(null);
  const subRef = useRef(null);
  const ctaRef = useRef(null);

  useLayoutEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const words = h1Ref.current?.querySelectorAll('.word') || [];
    const sub = subRef.current;
    const ctaBtns = ctaRef.current?.children || [];
    if (reduced) {
      gsap.set([...words, sub, ...ctaBtns].filter(Boolean), { opacity: 1, filter: 'none' });
      return;
    }
    gsap.set(words, { opacity: 0, filter: 'blur(12px)' });
    if (sub) gsap.set(sub, { opacity: 0 });
    if (ctaBtns.length) gsap.set(ctaBtns, { opacity: 0 });

    const tl = gsap.timeline();
    if (words.length) {
      tl.to(words, { opacity: 1, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out', stagger: 0.04 });
    }
    if (sub) tl.to(sub, { opacity: 1, duration: 0.4, ease: 'expo.out' }, '-=0.35');
    if (ctaBtns.length) tl.to(ctaBtns, { opacity: 1, duration: 0.4, ease: 'expo.out', stagger: 0.06 }, '-=0.25');
    return () => tl.kill();
  }, []);

  return (
    <section className="d-hero">
      <div className="d-hero-eye">— Wealthly · vue produit</div>
      <h1 className="d-hero-h1" ref={h1Ref}>
        <span className="word">Votre</span>{' '}
        <span className="word">patrimoine,</span>{' '}
        <em><span className="word">orchestré.</span></em>
      </h1>
      <p className="d-hero-sub" ref={subRef}>
        Comptes, placements, immobilier, fiscalité. Une seule application,
        pensée pour les patrimoines français.
      </p>
      <div className="d-hero-cta" ref={ctaRef}>
        <HeroCta/>
      </div>
    </section>
  );
}

function HeroCta() {
  const { onSignUp, onShowCinematic } = React.useContext(DetailsCtx);
  return (
    <>
      <button className="btn-primary" onClick={onSignUp}>
        Essayer 14 jours
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
      </button>
      <a href="#" className="d-back-link" onClick={(e) => { e.preventDefault(); onShowCinematic?.(); }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Revoir la démo
      </a>
    </>
  );
}

/* ====================================================================
   BENTO — grid de modules tech
   ==================================================================== */
function Bento() {
  const ref = useRef(null);
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !ref.current) return;
    const tiles = ref.current.querySelectorAll('.bento-tile');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const idx = [...tiles].indexOf(e.target);
          gsap.fromTo(e.target,
            { opacity: 0, y: 12, filter: 'blur(8px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'expo.out', delay: (idx % 6) * 0.06 }
          );
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.2 });
    tiles.forEach(t => io.observe(t));
    return () => io.disconnect();
  }, []);

  return (
    <section className="bento" ref={ref}>
      <div className="bento-head">
        <div className="bento-eye">— Modules</div>
        <h2 className="bento-h2">
          Tout votre patrimoine.<br/>
          <em>Dans un seul outil.</em>
        </h2>
      </div>

      <div className="bento-grid">
        {/* ── 1 — Patrimoine consolidé (wide, hero number) ── */}
        <div className="bento-tile tile-net">
          <div className="tile-eye">Patrimoine net</div>
          <div className="tile-hero-num">487 320 €</div>
          <div className="tile-pill pos">↑ +6 240 € · +1,29 %</div>
          <svg className="tile-spark" viewBox="0 0 200 50" preserveAspectRatio="none">
            <defs>
              <linearGradient id="tnSpk" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#0E7C56" stopOpacity="0.4"/>
                <stop offset="100%" stopColor="#0E7C56" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path d="M0,38 C20,34 35,28 55,30 C75,32 90,22 115,20 C140,18 155,14 175,10 C190,8 200,6 200,6"
                  fill="none" stroke="#0E7C56" strokeWidth="2" strokeLinecap="round"/>
            <path d="M0,38 C20,34 35,28 55,30 C75,32 90,22 115,20 C140,18 155,14 175,10 C190,8 200,6 200,6 L200,50 L0,50 Z"
                  fill="url(#tnSpk)"/>
          </svg>
        </div>

        {/* ── 2 — Banques connectées ── */}
        <div className="bento-tile tile-banks">
          <div className="tile-eye">Banques connectées</div>
          <div className="tile-banks-grid">
            {[
              { l: 'BNP', c: '#00915A' },
              { l: 'CA', c: '#0E893E' },
              { l: 'SG', c: '#E60000' },
              { l: 'Bsm', c: '#FF248C' },
              { l: 'Rev', c: '#0666EB' },
              { l: 'N26', c: '#36A18B' },
              { l: 'Frt', c: '#FFA300' },
              { l: 'Lyd', c: '#0066FF' },
              { l: '+15', c: '#75716A', muted: true },
            ].map((b, i) => (
              <div key={i} className={`tile-bank-chip ${b.muted ? 'muted' : ''}`}>
                <span className="tile-bank-dot" style={{ background: b.c }}/>
                <span>{b.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 3 — Fiscal (mini IR / IFI) ── */}
        <div className="bento-tile tile-fiscal">
          <div className="tile-eye">Fiscalité française</div>
          <div className="tile-fiscal-rows">
            <div className="tile-fiscal-row">
              <span className="tile-fiscal-lbl">IR estimé</span>
              <span className="tile-fiscal-val">8 420 €</span>
              <span className="tile-fiscal-bar"><span style={{width:'42%', background:'#0E7C56'}}/></span>
            </div>
            <div className="tile-fiscal-row">
              <span className="tile-fiscal-lbl">IFI</span>
              <span className="tile-fiscal-val">0 €</span>
              <span className="tile-fiscal-bar"><span style={{width:'0%', background:'#4FB57A'}}/></span>
            </div>
            <div className="tile-fiscal-row">
              <span className="tile-fiscal-lbl">Plus-values</span>
              <span className="tile-fiscal-val">2 180 €</span>
              <span className="tile-fiscal-bar"><span style={{width:'18%', background:'#E0975A'}}/></span>
            </div>
          </div>
        </div>

        {/* ── 4 — Tous types d'actifs (wide) ── */}
        <div className="bento-tile tile-assets">
          <div className="tile-eye">Tous vos actifs</div>
          <div className="tile-assets-grid">
            {[
              {l:'Liquidités', v:'42 100', c:'#0E7C56'},
              {l:'PEA / CTO', v:'82 480', c:'#4FB57A'},
              {l:'Crypto', v:'12 410', c:'#E0975A'},
              {l:'SCPI', v:'40 330', c:'#B0392B'},
              {l:'Immobilier', v:'310 000', c:'#0A5E41'},
              {l:'Emprunts', v:'−15 880', c:'#75716A'},
            ].map((a,i)=>(
              <div key={i} className="tile-asset">
                <span className="tile-asset-bullet" style={{ background: a.c }}/>
                <div className="tile-asset-lbl">{a.l}</div>
                <div className="tile-asset-val">{a.v} €</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 5 — Sécurité ── */}
        <div className="bento-tile tile-security">
          <div className="tile-eye">Confidentialité</div>
          <div className="tile-security-content">
            <svg className="tile-shield" viewBox="0 0 32 32" fill="none">
              <path d="M16 3 L28 7 V16 C28 23 22 28 16 30 C10 28 4 23 4 16 V7 Z"
                    fill="none" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M11 16 L14.5 19.5 L22 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <div className="tile-strong">Vos données restent vôtres.</div>
              <div className="tile-sub">Aucune publicité. Aucune revente.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ====================================================================
   PRICING — compact 3 cards
   ==================================================================== */
function Pricing() {
  const { onSignUp } = React.useContext(DetailsCtx);
  return (
    <section className="d-section">
      <div className="d-section-head">
        <div className="d-section-eye">— Tarifs</div>
        <h2 className="d-section-h2">
          Rentabilisé<br/>
          <em>dès la première utilisation.</em>
        </h2>
      </div>

      <p className="d-pricing-roi">
        Un abonnement oublié, un forfait surévalué, une assurance dormante —
        Wealthly les repère pour vous. La première résiliation rembourse
        souvent l'année entière.
      </p>

      <div className="d-pricing-grid d-pricing-grid-2">
        <div className="d-price-card">
          <div className="d-price-head">
            <div className="d-price-name">Solo</div>
            <div className="d-price-val">
              <span className="num">7,99</span>
              <span className="d-price-cur">€</span>
              <span className="d-price-per">/mois</span>
            </div>
          </div>
          <div className="d-price-lines">
            <div>Toutes vos banques connectées</div>
            <div>Patrimoine consolidé en temps réel</div>
            <div>Catégorisation et détection des dépenses</div>
            <div>Simulateur fiscal (IR + plus-values)</div>
            <div>Bilan patrimonial PDF mensuel</div>
          </div>
          <button className="d-price-cta primary" onClick={onSignUp}>
            Essayer 14 jours
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </button>
        </div>

        <div className="d-price-card featured">
          <div className="d-price-badge">Recommandé</div>
          <div className="d-price-head">
            <div className="d-price-name">Famille</div>
            <div className="d-price-val">
              <span className="num">15</span>
              <span className="d-price-cur">€</span>
              <span className="d-price-per">/mois</span>
            </div>
          </div>
          <div className="d-price-lines">
            <div>Tout le plan Solo</div>
            <div>Foyer multi-membres et comptes-joints</div>
            <div>Tous types d'actifs (PEA, SCPI, immo, crypto)</div>
            <div>Simulateur IFI + optimisations avancées</div>
            <div>Coach IA et alertes intelligentes</div>
            <div>Support prioritaire</div>
          </div>
          <button className="d-price-cta primary" onClick={onSignUp}>
            Essayer 14 jours
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    </section>
  );
}

/* ====================================================================
   FAQ grid — 4 modules
   ==================================================================== */
function FaqGrid() {
  const items = [
    {
      q: 'Mes données sont-elles sécurisées ?',
      a: 'Connexion en lecture seule à votre banque. Données chiffrées de bout en bout. Aucun accès à vos identifiants.',
    },
    {
      q: 'Revendez-vous mes données ?',
      a: 'Non. Aucune publicité, aucun partenariat caché, aucun tracker. Vous payez, ou vous ne payez pas. C\'est tout.',
    },
    {
      q: 'En quoi vous différenciez-vous ?',
      a: 'Indépendant, non adossé à une banque. Pensé pour le patrimoine français : PEA, SCPI, IFI, indivisions, comptes-joints.',
    },
    {
      q: 'Combien de temps pour voir mon patrimoine ?',
      a: 'Quelques minutes. Le temps que vos banques renvoient l\'historique — 3 à 5 minutes pour les banques françaises.',
    },
  ];

  return (
    <section className="d-section">
      <div className="d-section-head">
        <div className="d-section-eye">— Questions</div>
        <h2 className="d-section-h2">
          Tout ce qu'on nous demande<br/>
          <em>en premier.</em>
        </h2>
      </div>
      <div className="d-faq-grid">
        {items.map((it, i) => (
          <div key={i} className="d-faq-tile">
            <div className="d-faq-num">0{i+1}</div>
            <h3 className="d-faq-q">{it.q}</h3>
            <p className="d-faq-a">{it.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ====================================================================
   OUTRO — compact CTA strip
   ==================================================================== */
function Outro() {
  const ref = useRef(null);
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !ref.current) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          gsap.fromTo(e.target.querySelectorAll('.word'),
            { opacity: 0, filter: 'blur(12px)' },
            { opacity: 1, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out', stagger: 0.06 });
          gsap.fromTo(e.target.querySelector('.d-outro-cta'),
            { opacity: 0 },
            { opacity: 1, duration: 0.55, ease: 'expo.out', delay: 0.4 });
          io.disconnect();
        }
      }
    }, { threshold: 0.3 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <section className="d-outro" ref={ref}>
      <h2 className="d-outro-line">
        <span className="word">Maintenant,</span>{' '}
        <em><span className="word">à</span> <span className="word">vous.</span></em>
      </h2>
      <OutroCta/>
    </section>
  );
}

function OutroCta() {
  const { onSignUp } = React.useContext(DetailsCtx);
  return (
    <button className="d-outro-cta" onClick={onSignUp}>
      Essayer Wealthly
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
    </button>
  );
}

/* ====================================================================
   COLOPHON
   ==================================================================== */
function Colophon() {
  const { onSignIn } = React.useContext(DetailsCtx);
  return (
    <footer className="colophon">
      <span>© 2026 Wealthly · Paris</span>
      <span className="colophon-links">
        <a href="#">À propos</a>
        <a href="#">Sécurité</a>
        <a href="#">Contact</a>
        <button onClick={onSignIn}>Se connecter</button>
      </span>
    </footer>
  );
}

/* ====================================================================
   ROOT
   ==================================================================== */
export default function Details({ onSignIn, onSignUp, onShowCinematic }) {
  return (
    <DetailsCtx.Provider value={{ onSignIn, onSignUp, onShowCinematic }}>
      <div className="page-grain" aria-hidden/>
      <div className="page-sink" aria-hidden/>
      <Strip/>
      <main className="d-main">
        <Hero/>
        <Bento/>
        <Pricing/>
        <FaqGrid/>
        <Outro/>
        <Colophon/>
      </main>
    </DetailsCtx.Provider>
  );
}
