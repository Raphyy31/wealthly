// ============================================================================
// Landing — Wealthly (design figé 2026-05-12)
//
// Dark cover, Newsreader italic masthead, accent cobalt, eyebrow pulsant,
// mockup dashboard en hero, trust badges icons, sticky CTA mobile,
// backdrop-blur nav au scroll, micro-interactions (border + bg, pas translateY).
// Texte minimal style fintech (Finary/Lydia/Qonto).
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import {
  motion, useInView, useMotionValue, useReducedMotion, animate as fmAnimate,
  useScroll, useTransform, useSpring,
} from 'framer-motion';
import Logo from '../components/Logo.jsx';

// ─── Premium ease ─────────────────────────────────────────────────────────
const ease = [0.22, 1, 0.36, 1];
const easeOut = [0.16, 1, 0.3, 1];

// ─── Digit roll — odometer/airport-board feel ─────────────────────────────
function RollingDigit({ digit, delay = 0, duration = 1.2 }) {
  const reduced = useReducedMotion();
  if (reduced) return <span>{digit}</span>;
  const cycle = [9, 4, 7, 2, 8, 1, 5, 3, 6, 0, digit];
  const lastIdx = cycle.length - 1;
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', height: '1em', lineHeight: 1 }}>
      <motion.span
        style={{ display: 'inline-block', lineHeight: 1 }}
        initial={{ y: 0 }}
        animate={{ y: `-${lastIdx}em` }}
        transition={{ duration, delay, ease }}
      >
        {cycle.map((d, i) => (
          <span key={i} style={{ display: 'block', height: '1em', lineHeight: 1 }}>{d}</span>
        ))}
      </motion.span>
    </span>
  );
}

function ScrambleNumber({ to, suffix = '', className, delay = 0, locale = 'fr-FR' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();
  const formatted = Math.round(to).toLocaleString(locale).replace(/,/g, ' ');
  const chars = formatted.split('');

  if (reduced || !inView) {
    return (
      <span ref={ref} className={className}>
        {inView ? <>{formatted}{suffix}</> : <span style={{ opacity: 0 }}>{formatted}{suffix}</span>}
      </span>
    );
  }
  return (
    <span ref={ref} className={className} style={{ display: 'inline-flex', alignItems: 'flex-end' }}>
      {chars.map((c, i) => {
        if (/\d/.test(c)) {
          return <RollingDigit key={i} digit={parseInt(c, 10)} delay={delay + i * 0.06} />;
        }
        return <motion.span key={i} style={{ display: 'inline-block' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + i * 0.06 + 0.6, duration: 0.3 }}>{c}</motion.span>;
      })}
      <motion.span style={{ display: 'inline-block' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + chars.length * 0.06 + 0.6, duration: 0.4 }}>{suffix}</motion.span>
    </span>
  );
}

// Linear count-up kept for small KPIs
function CountUp({ to, duration = 1.4, delay = 0, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!inView) return;
    if (reduced) { setDisplay(to); return; }
    const controls = fmAnimate(mv, to, {
      duration, delay, ease,
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, to, duration, delay, reduced, mv]);

  return <span ref={ref} className={className}>{Math.round(display).toLocaleString('fr-FR')}</span>;
}

function DrawPath({ d, stroke, strokeWidth = 2, duration = 1.6, delay = 0.2, area, areaFill, dotCx, dotCy }) {
  const reduced = useReducedMotion();
  return (
    <>
      {area && (
        <motion.path
          d={area}
          fill={areaFill}
          initial={reduced ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: delay + duration * 0.6 }}
        />
      )}
      <motion.path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      />
      {dotCx != null && (
        <>
          {!reduced && (
            <motion.circle
              cx={dotCx}
              cy={dotCy}
              r={5}
              fill={stroke}
              initial={{ scale: 1, opacity: 0 }}
              animate={{ scale: [1, 3.2, 1], opacity: [0, 0.5, 0] }}
              transition={{ duration: 2.4, delay: delay + duration, repeat: Infinity, ease: 'easeOut' }}
              style={{ transformOrigin: `${dotCx}px ${dotCy}px` }}
            />
          )}
          <motion.circle
            cx={dotCx}
            cy={dotCy}
            r={5}
            fill="#181714"
            stroke={stroke}
            strokeWidth={2.5}
            initial={reduced ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: delay + duration }}
            style={{ transformOrigin: `${dotCx}px ${dotCy}px` }}
          />
        </>
      )}
    </>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease } },
};

// ─── Mouse-tracked 3D parallax wrapper ────────────────────────────────────
function ParallaxFrame({ children, intensity = 6, className }) {
  const ref = useRef(null);
  const rx = useSpring(0, { stiffness: 80, damping: 18, mass: 0.6 });
  const ry = useSpring(0, { stiffness: 80, damping: 18, mass: 0.6 });
  const reduced = useReducedMotion();

  const onMove = (e) => {
    if (reduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    ry.set(((e.clientX - cx) / (r.width / 2)) * intensity);
    rx.set(-((e.clientY - cy) / (r.height / 2)) * (intensity * 0.5));
  };
  const onLeave = () => { rx.set(0); ry.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{ perspective: 1400, transformStyle: 'preserve-3d' }}
    >
      <motion.div
        style={{
          rotateX: rx,
          rotateY: ry,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ─── Magnetic 3D tilt for tiles ───────────────────────────────────────────
function TiltTile({ children, className, intensity = 4, ...rest }) {
  const ref = useRef(null);
  const rx = useSpring(0, { stiffness: 120, damping: 16 });
  const ry = useSpring(0, { stiffness: 120, damping: 16 });
  const reduced = useReducedMotion();
  const onMove = (e) => {
    if (reduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    ry.set(((e.clientX - cx) / (r.width / 2)) * intensity);
    rx.set(-((e.clientY - cy) / (r.height / 2)) * intensity);
  };
  const onLeave = () => { rx.set(0); ry.set(0); };
  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      variants={fadeUp}
      style={{ perspective: 1200, rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d', willChange: 'transform' }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// ─── Aurora blob — slow drifting cobalt glow ──────────────────────────────
function Aurora() {
  const reduced = useReducedMotion();
  return (
    <div className="lc-aurora" aria-hidden>
      <motion.div
        className="lc-aurora-blob lc-aurora-1"
        animate={reduced ? {} : { x: [0, 60, -40, 0], y: [0, -30, 40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="lc-aurora-blob lc-aurora-2"
        animate={reduced ? {} : { x: [0, -80, 40, 0], y: [0, 50, -20, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

export default function Landing({ onSignIn, onSignUp, onTryDemo }) {
  const [scrolled, setScrolled] = useState(false);
  const mockupRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: mockupRef, offset: ['start end', 'end start'] });
  const mockupScale = useTransform(scrollYProgress, [0, 0.4, 1], [0.94, 1, 1.02]);
  const mockupRotateX = useTransform(scrollYProgress, [0, 0.5, 1], [10, 0, -3]);
  const mockupY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const mockupOpacity = useTransform(scrollYProgress, [0, 0.2, 0.85, 1], [0, 1, 1, 0.85]);

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
        <Aurora />
        <div className="lc-grain" aria-hidden />

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
              <h1 className="lc-title">
                <motion.span
                  style={{ display: 'inline-block' }}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease }}
                >
                  Votre patrimoine,
                </motion.span>
                <br/>
                <motion.em
                  style={{ display: 'inline-block' }}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.35, ease }}
                >
                  enfin clair.
                </motion.em>
              </h1>
            </div>
            <motion.div
              className="lc-deck"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.6, ease }}
            >
              Connectez vos comptes, suivez vos placements, votre immobilier et vos crypto.
              <strong> Une seule app, zéro tableur.</strong>
            </motion.div>
          </div>

          {/* ============ CTAs + TRUST BADGES ============ */}
          <motion.div
            className="lc-cta-row"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.75, ease }}
          >
            <button className="lc-btn-primary lc-btn-primary--pulse" onClick={onSignUp}>
              Commencer gratuitement
              <ArrowRight />
            </button>
            <button className="lc-btn-ghost" onClick={onTryDemo}>
              Voir la démo →
            </button>
          </motion.div>
          <motion.div
            className="lc-trust"
            initial="hidden"
            animate="show"
            transition={{ staggerChildren: 0.08, delayChildren: 0.9 }}
          >
            <TrustItem icon={<ShieldIcon />} label="DSP2 · lecture seule" />
            <TrustItem icon={<LockIcon />} label="Chiffré bout-en-bout" />
            <TrustItem icon={<NoCardIcon />} label="Sans carte bancaire" />
          </motion.div>

          {/* ============ HERO MOCKUP (le produit, gros, tout de suite) ============ */}
          <motion.div
            ref={mockupRef}
            className="lc-mockup-wrap"
            style={{ scale: mockupScale, rotateX: mockupRotateX, y: mockupY, opacity: mockupOpacity, transformPerspective: 1600, transformOrigin: '50% 0%' }}
          >
            <ParallaxFrame className="lc-mockup-parallax" intensity={4}>
              <div className="lc-mockup-frame">
                <DashboardMockup />
                <div className="lc-mockup-shine" aria-hidden />
              </div>
            </ParallaxFrame>
            <div className="lc-mockup-glow" aria-hidden />
          </motion.div>

          {/* ============ TEASER GRID — fonctionnalités produit ============ */}
          <motion.div
            className="lc-section-head"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7, ease }}
          >
            <h2 className="lc-h2">Tout ce qu'il faut.<br/><em>Rien de plus.</em></h2>
          </motion.div>

          <motion.div
            className="lc-teasers"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          >
            <TiltTile className="lc-tile lc-t-hero" intensity={3}>
              <div className="lc-label-row">
                <div className="lc-tag">Patrimoine net</div>
                <div className="lc-range">
                  <span>1M</span><span>3M</span><span className="on">6M</span><span>1A</span><span>5A</span>
                </div>
              </div>
              <div className="lc-big num"><ScrambleNumber to={184720} delay={0.1} /><span className="lc-cents">,40&nbsp;€</span></div>
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
            </TiltTile>

            <TiltTile className="lc-tile lc-t-alloc">
              <div className="lc-tag">Allocation</div>
              <div className="lc-ttl">Tous vos actifs, par classe.</div>
              <div className="lc-alloc-row">
                <AnimatedDonut />
                <div className="lc-legend">
                  <div><span className="lc-sw" style={{ background: '#4FB57A' }}/>Immobilier</div>
                  <div><span className="lc-sw" style={{ background: '#7E92FF' }}/>PEA &amp; CTO</div>
                  <div><span className="lc-sw" style={{ background: '#E0975A' }}/>Ass.-vie</div>
                  <div><span className="lc-sw" style={{ background: '#DA8AA1' }}/>Livrets</div>
                  <div><span className="lc-sw" style={{ background: '#B69BF2' }}/>Crypto</div>
                </div>
              </div>
              <span className="lc-read">Voir le détail</span>
            </TiltTile>

            <TiltTile className="lc-tile lc-t-tx">
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
            </TiltTile>

            <TiltTile className="lc-tile lc-t-range">
              <div className="lc-tag">Indicateurs</div>
              <div className="lc-ttl">Les chiffres qui comptent.</div>
              <div className="lc-kpis">
                <div className="lc-kpi"><div className="lc-kpi-lbl">Liquidités</div><div className="lc-kpi-val num"><CountUp to={12480} delay={0.2} />&nbsp;€</div><div className="lc-kpi-dt num">+3,2&nbsp;%</div></div>
                <div className="lc-kpi"><div className="lc-kpi-lbl">Investi</div><div className="lc-kpi-val num"><CountUp to={84200} delay={0.3} />&nbsp;€</div><div className="lc-kpi-dt num">+1,8&nbsp;%</div></div>
                <div className="lc-kpi"><div className="lc-kpi-lbl">Immobilier</div><div className="lc-kpi-val num"><CountUp to={88040} delay={0.4} />&nbsp;€</div><div className="lc-kpi-dt num">+0,4&nbsp;%</div></div>
                <div className="lc-kpi"><div className="lc-kpi-lbl">Dettes</div><div className="lc-kpi-val num"><CountUp to={42100} delay={0.5} />&nbsp;€</div><div className="lc-kpi-dt lc-kpi-dt-n num">−0,9&nbsp;%</div></div>
              </div>
              <span className="lc-read">Lire la grille</span>
            </TiltTile>

            <TiltTile className="lc-tile lc-t-insights" onClick={onTryDemo} role="button" tabIndex={0}>
              <div className="lc-tag">Démo</div>
              <div className="lc-quote">Essayez Wealthly sans créer de compte.</div>
              <div className="lc-quote-src">Données factices — 30 secondes</div>
              <span className="lc-read">Lancer la démo</span>
            </TiltTile>
          </motion.div>

          {/* ============ FINAL CTA ============ */}
          <motion.div
            className="lc-final-cta"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, ease }}
          >
            <h2 className="lc-h2">Prêt à commencer&nbsp;?</h2>
            <p className="lc-final-sub">Gratuit. Sans carte bancaire. Sans engagement.</p>
            <div className="lc-cta-row" style={{ justifyContent: 'center' }}>
              <button className="lc-btn-primary lc-btn-primary--pulse" onClick={onSignUp}>Créer mon compte<ArrowRight /></button>
              <button className="lc-btn-ghost" onClick={onTryDemo}>Voir la démo</button>
            </div>
          </motion.div>

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

function AnimatedDonut() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduced = useReducedMotion();
  const segments = [
    { color: '#4FB57A', length: 113, offset: 0 },
    { color: '#7E92FF', length: 75,  offset: -113 },
    { color: '#E0975A', length: 48,  offset: -188 },
    { color: '#DA8AA1', length: 35,  offset: -236 },
    { color: '#B69BF2', length: 20,  offset: -271 },
  ];
  return (
    <svg ref={ref} className="lc-donut" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="48" fill="none" stroke="#0A0908" strokeWidth="14"/>
      {segments.map((s, i) => (
        <motion.circle
          key={i}
          cx="60" cy="60" r="48" fill="none"
          stroke={s.color} strokeWidth="14"
          strokeDasharray={`${s.length} 301.6`}
          strokeDashoffset={s.offset}
          transform="rotate(-90 60 60)"
          initial={reduced ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          animate={inView ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.15 + i * 0.12, ease }}
        />
      ))}
    </svg>
  );
}

function TrustItem({ icon, label }) {
  return (
    <motion.div
      className="lc-trust-item"
      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }}
    >
      <span className="lc-trust-icon">{icon}</span>
      <span>{label}</span>
    </motion.div>
  );
}

function AnimatedSvgNumber({ to, x, y, fill, fontFamily, fontSize, fontWeight = 400, letterSpacing = 0, suffix = ' €', delay = 0.4, duration = 1.4 }) {
  const [val, setVal] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) { setVal(to); return; }
    const mv = { current: 0 };
    const controls = fmAnimate(0, to, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { mv.current = v; setVal(v); },
    });
    return () => controls.stop();
  }, [to, delay, duration, reduced]);
  return (
    <text x={x} y={y} fill={fill} fontFamily={fontFamily} fontSize={fontSize} fontWeight={fontWeight} letterSpacing={letterSpacing}>
      {Math.round(val).toLocaleString('fr-FR')}{suffix}
    </text>
  );
}

function DashboardMockup() {
  const reduced = useReducedMotion();
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
      <AnimatedSvgNumber to={184720} x={272} y={172} fill="#F1EEE4" fontFamily="Newsreader, Georgia, serif" fontSize={56} fontWeight={400} letterSpacing={-2} delay={0.4} duration={1.6} suffix=",40 €" />
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
      <DrawPath
        d="M272,440 C340,430 410,400 480,390 C560,378 620,408 700,358 C770,316 840,338 920,310 C990,288 1060,300 1144,260"
        area="M272,440 C340,430 410,400 480,390 C560,378 620,408 700,358 C770,316 840,338 920,310 C990,288 1060,300 1144,260 L1144,500 L272,500 Z"
        areaFill="url(#lcHeroArea)"
        stroke="#7E92FF"
        strokeWidth={2.5}
        duration={1.8}
        delay={0.6}
        dotCx={1144}
        dotCy={260}
      />
      {/* Bottom cards */}
      {['Actifs','Passifs','Liquidités','Épargne · mois'].map((l,i)=>(
        <motion.g
          key={l}
          initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 1.4 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <rect x={272+i*228} y="540" width="208" height="140" rx="12" fill="#0F0E0C" stroke="#2A2823"/>
          <text x={288+i*228} y="568" fill="#75716A" fontFamily="Geist, sans-serif" fontSize="10" letterSpacing="1.5">{l.toUpperCase()}</text>
          <text x={288+i*228} y="612" fill="#F1EEE4" fontFamily="Newsreader, Georgia, serif" fontSize="26" fontWeight="400" letterSpacing="-1">{['226 820','42 100','12 480','+1 280'][i]} €</text>
          <text x={288+i*228} y="648" fill={i===1?"#E07A6E":"#4FB57A"} fontFamily="Geist, sans-serif" fontSize="11" fontWeight="500">{['+1.8 %','−0.9 %','+3.2 %','22 % rev.'][i]}</text>
        </motion.g>
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
.lc-page { background: #0F0E0C; color: #F1EEE4; min-height: 100vh; font-family: 'Geist', system-ui, sans-serif; font-feature-settings: 'ss01','cv11'; -webkit-font-smoothing: antialiased; padding-bottom: 88px; position: relative; overflow-x: hidden; }
.lc-page * { box-sizing: border-box; margin: 0; padding: 0; }

/* AURORA — slow drifting cobalt glow */
.lc-aurora { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.lc-aurora-blob { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.32; will-change: transform; mix-blend-mode: screen; }
.lc-aurora-1 { width: 720px; height: 720px; top: -200px; left: -140px; background: radial-gradient(circle at center, rgba(126,146,255,0.40), rgba(126,146,255,0) 70%); }
.lc-aurora-2 { width: 620px; height: 620px; top: 320px; right: -180px; background: radial-gradient(circle at center, rgba(168,140,255,0.26), rgba(168,140,255,0) 70%); }

/* GRAIN overlay — subtle warmth */
.lc-grain { position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0.06; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  background-size: 160px 160px; }

.lc-page > *:not(.lc-aurora):not(.lc-grain) { position: relative; z-index: 2; }
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
.lc-btn-primary--pulse { animation: lcGlowPulse 3.2s ease-in-out infinite; }
@keyframes lcGlowPulse {
  0%, 100% { box-shadow: 0 1px 0 rgba(0,0,0,.3), 0 4px 14px -4px rgba(126,146,255,.25); }
  50%      { box-shadow: 0 1px 0 rgba(0,0,0,.3), 0 10px 32px -6px rgba(126,146,255,.55); }
}
@media (prefers-reduced-motion: reduce) {
  .lc-btn-primary--pulse { animation: none; }
  .lc-dot { animation: none; }
}
.lc-btn-ghost { background: transparent; border: 1px solid #3A382F; color: #F1EEE4; font-size: 14px; font-weight: 500; letter-spacing: -0.005em; padding: 12px 22px; border-radius: 8px; transition: background .15s, border-color .15s; }
.lc-btn-ghost:hover { background: #1F1D19; border-color: #A29E91; }
.lc-trust { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; padding-bottom: 8px; }
.lc-trust-item { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: #A29E91; font-weight: 500; letter-spacing: -0.005em; }
.lc-trust-icon { color: #75716A; display: grid; place-items: center; }

/* MOCKUP — gros, dès le hero */
.lc-mockup-wrap { position: relative; margin-top: 56px; will-change: transform; }
.lc-mockup-parallax { position: relative; z-index: 1; }
.lc-mockup-shine { position: absolute; inset: 0; pointer-events: none; border-radius: 14px; background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.06) 50%, transparent 65%); mix-blend-mode: screen; }
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
.lc-big > span:first-child { display: inline-flex; align-items: flex-end; }
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
