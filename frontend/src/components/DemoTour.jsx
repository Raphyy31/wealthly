// DemoTour v2 — Mode "Présentation" cinematic pour pitch investisseurs.
//
// Refonte 2026-05-21 (user feedback : "j'aimerais que ca fasse vraiment
// video qui donne envie rapide et propre") :
//
// 1. INTRO scene full-screen — logo + masthead Newsreader italic + tagline,
//    fade-in en GSAP SplitText word-by-word. 2.6s. Plante le decor.
// 2. SCENES app (Overview / Cashflow / Sankey / Patrimoine) — spotlight
//    cobalt + annotation card. Ken-burns subtil sur le spotlight (zoom
//    lent 1 → 1.02 sur la duree). Title SplitText fade-up.
// 3. OUTRO scene full-screen — wordmark + "Voila." + CTA. 2.4s. Termine.
// 4. Vignette cinematique (radial gradient dark sur les bords) pour focus.
// 5. Progress bar gradient cobalt -> sage en haut, plus marquante.
// 6. Backdrop blur 3px + dim 50% pour le mode app scenes.
//
// Trigger : prop `active` controllée par le parent. Le parent passe
// `setView(viewId)` pour que le tour navigue lui-meme.
//
// Nav clavier : Esc / ← / → / Espace / P (pause)
import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Pause, Sparkles, ArrowRight } from 'lucide-react';
import { gsap, SplitText } from '../utils/gsapSetup.js';
import Logo from './Logo.jsx';

// SCENE TYPES :
//   - intro/outro : pleine fenêtre, pas d'anchor
//   - app : spotlight + annotation, navigue vers view + anchor
const SCENES = [
  {
    type: 'intro',
    duration: 2600,
  },
  {
    type: 'app',
    view: 'dashboard',
    anchor: '.hero-card',
    eyebrow: 'OVERVIEW',
    title: 'Patrimoine net <em>en un coup d’œil.</em>',
    body: 'Liquidités, placements, immo, dettes — agrégés en temps réel depuis vos banques via DSP2. Une seule source de vérité.',
    tag: 'Net worth temps réel',
    duration: 5500,
  },
  {
    type: 'app',
    view: 'dashboard',
    anchor: '.mcc-card',
    eyebrow: 'CASHFLOW',
    title: 'Combien il vous <em>reste</em> ce mois-ci.',
    body: 'Entrées, sorties, épargne — comparé à votre mois type. Décision prise en 3 secondes.',
    tag: 'Pilotage budgétaire',
    duration: 5500,
  },
  {
    type: 'app',
    view: 'monthly',
    anchor: '.mon-sankey-duo',
    eyebrow: 'BUDGET MENSUEL',
    title: 'Où va vraiment <em>votre argent.</em>',
    body: 'Sankey diagramme du salaire jusqu’aux sous-catégories. Mois type vs réel — écarts visibles d’un regard.',
    tag: 'Visualisation Sankey',
    duration: 6000,
  },
  {
    type: 'app',
    view: 'wealth',
    anchor: '.wealth-hero',
    eyebrow: 'PATRIMOINE',
    title: 'PEA, immo, crédits — <em>tout aligné.</em>',
    body: 'Financier et immobilier net en deux blocs hero. Évolution 12 mois, breakdown par classe d’actifs. Aussi clair qu’un rapport de banque privée.',
    tag: 'Vision patrimoniale',
    duration: 6000,
  },
  {
    type: 'outro',
    duration: 2400,
  },
];

function getAnchorRect(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return new Promise(resolve => {
    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      resolve({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    }, 380);
  });
}

export function DemoTour({ active, onExit, setView }) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const [paused, setPaused] = useState(false);
  const annotationRef = useRef(null);
  const titleRef = useRef(null);
  const introRef = useRef(null);
  const outroRef = useRef(null);
  const spotlightRef = useRef(null);
  const progressRef = useRef(null);
  const timerRef = useRef(null);
  const progressTweenRef = useRef(null);
  const kenBurnsTweenRef = useRef(null);

  const scene = SCENES[sceneIdx];
  const isApp = scene.type === 'app';
  const isIntro = scene.type === 'intro';
  const isOutro = scene.type === 'outro';

  // App scenes : navigate + recompute rect. Intro/outro : skip.
  useEffect(() => {
    if (!active) return;
    if (!isApp) {
      setRect(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setView?.(scene.view);
      await new Promise(r => setTimeout(r, 480));
      if (cancelled) return;
      const r = await getAnchorRect(scene.anchor);
      if (cancelled || !r) return;
      setRect(r);
    })();
    return () => { cancelled = true; };
  }, [active, sceneIdx, isApp, scene.view, scene.anchor, setView]);

  // Animations entry pour app scenes : annotation fade-up + title SplitText
  // word-by-word + spotlight ken-burns zoom subtil.
  useLayoutEffect(() => {
    if (!active || !isApp || !rect) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    // Annotation card slide-up + fade
    if (annotationRef.current) {
      gsap.fromTo(annotationRef.current,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.65, ease: 'expo.out' }
      );
    }

    // Title SplitText words stagger
    let splitInst = null;
    if (titleRef.current) {
      try {
        splitInst = SplitText.create(titleRef.current, { type: 'words', wordsClass: 'dt-word' });
        gsap.fromTo(splitInst.words,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: 0.045, delay: 0.15 }
        );
      } catch { /* SplitText non chargé en dev — fallback silent */ }
    }

    // Spotlight ken-burns (zoom 1 → 1.025 sur la durée de scène)
    if (spotlightRef.current) {
      gsap.fromTo(spotlightRef.current,
        { opacity: 0, scale: 1.05 },
        { opacity: 1, scale: 1, duration: 0.55, ease: 'expo.out' }
      );
      kenBurnsTweenRef.current?.kill();
      kenBurnsTweenRef.current = gsap.to(spotlightRef.current, {
        scale: 1.025,
        duration: scene.duration / 1000,
        ease: 'sine.inOut',
      });
    }

    return () => {
      kenBurnsTweenRef.current?.kill();
      if (splitInst?.revert) splitInst.revert();
    };
  }, [active, isApp, rect, sceneIdx, scene.duration]);

  // Intro/outro takeover animations
  useLayoutEffect(() => {
    if (!active) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    if (isIntro && introRef.current) {
      const wordmark = introRef.current.querySelector('.dt-intro-wordmark');
      const tagline = introRef.current.querySelector('.dt-intro-tagline');
      const pulse = introRef.current.querySelector('.dt-intro-pulse');
      const tl = gsap.timeline();
      tl.fromTo(introRef.current, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
      if (pulse) {
        tl.fromTo(pulse, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(1.6)' }, '-=0.2');
      }
      if (wordmark) {
        tl.fromTo(wordmark, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, ease: 'expo.out' }, '-=0.3');
      }
      if (tagline) {
        // SplitText word-by-word
        let splitInst = null;
        try {
          splitInst = SplitText.create(tagline, { type: 'words', wordsClass: 'dt-intro-word' });
          tl.fromTo(splitInst.words,
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: 0.06 },
            '-=0.2'
          );
        } catch {
          tl.fromTo(tagline, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' }, '-=0.2');
        }
      }
      return () => { tl.kill(); };
    }

    if (isOutro && outroRef.current) {
      const wordmark = outroRef.current.querySelector('.dt-outro-wordmark');
      const msg = outroRef.current.querySelector('.dt-outro-msg');
      const cta = outroRef.current.querySelector('.dt-outro-cta');
      const tl = gsap.timeline();
      tl.fromTo(outroRef.current, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' });
      if (wordmark) {
        tl.fromTo(wordmark, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.4)' }, '-=0.15');
      }
      if (msg) {
        tl.fromTo(msg, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }, '-=0.25');
      }
      if (cta) {
        tl.fromTo(cta, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }, '-=0.25');
      }
      return () => { tl.kill(); };
    }
  }, [active, isIntro, isOutro, sceneIdx]);

  // Auto-advance + progress bar
  useEffect(() => {
    if (!active || paused) return;
    if (isApp && !rect) return; // wait until anchor is ready before starting timer
    if (progressTweenRef.current) progressTweenRef.current.kill();
    if (timerRef.current) clearTimeout(timerRef.current);

    if (progressRef.current) {
      gsap.set(progressRef.current, { width: '0%' });
      progressTweenRef.current = gsap.to(progressRef.current, {
        width: '100%',
        duration: scene.duration / 1000,
        ease: 'none',
      });
    }

    timerRef.current = setTimeout(() => { next(); }, scene.duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressTweenRef.current) progressTweenRef.current.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, paused, rect, sceneIdx, isApp, scene.duration]);

  const next = useCallback(() => {
    setSceneIdx(i => {
      if (i >= SCENES.length - 1) {
        setTimeout(() => onExit?.(), 200);
        return i;
      }
      setRect(null);
      return i + 1;
    });
  }, [onExit]);

  const prev = useCallback(() => {
    setSceneIdx(i => {
      if (i <= 0) return i;
      setRect(null);
      return i - 1;
    });
  }, []);

  // Keyboard nav
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onExit?.();
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === 'p' || e.key === 'P') setPaused(p => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, next, prev, onExit]);

  useEffect(() => {
    if (!active) {
      setSceneIdx(0);
      setRect(null);
      setPaused(false);
    }
  }, [active]);

  useEffect(() => {
    if (!active || !isApp || !rect) return;
    const onResize = async () => {
      const r = await getAnchorRect(scene.anchor);
      if (r) setRect(r);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, isApp, rect, scene.anchor]);

  if (!active) return null;

  // App scene visible indicator counter — count only app scenes (ignore intro/outro)
  const appScenes = SCENES.filter(s => s.type === 'app');
  const appIdx = SCENES.slice(0, sceneIdx + 1).filter(s => s.type === 'app').length;

  return (
    <>
      {/* === INTRO scene takeover === */}
      {isIntro && (
        <div
          ref={introRef}
          style={{
            position: 'fixed', inset: 0, zIndex: 9100,
            background: 'radial-gradient(ellipse at center, var(--bg-elev) 0%, var(--bg) 70%, var(--bg-sunk) 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            opacity: 0,
          }}
        >
          {/* Pulse halo derriere le logo */}
          <div
            className="dt-intro-pulse"
            style={{
              position: 'absolute',
              width: 320, height: 320, borderRadius: '50%',
              background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 30%, transparent) 0%, transparent 65%)',
              filter: 'blur(20px)', opacity: 0,
              animation: 'dt-pulse 2.4s ease-in-out infinite',
            }}
            aria-hidden="true"
          />
          {/* Logo + wordmark */}
          <div className="dt-intro-wordmark" style={{
            display: 'flex', alignItems: 'center', gap: 14,
            marginBottom: 28, opacity: 0, position: 'relative', zIndex: 1,
          }}>
            <Logo size={48} wordmark wordmarkSize={28}/>
          </div>
          {/* Tagline */}
          <div className="dt-intro-tagline" style={{
            fontFamily: 'Geist, system-ui, sans-serif',
            fontStyle: 'italic',
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 400,
            letterSpacing: '-0.03em',
            color: 'var(--ink-2)',
            textAlign: 'center',
            maxWidth: 600,
            lineHeight: 1.15,
            position: 'relative', zIndex: 1,
            padding: '0 24px',
          }}>
            Votre patrimoine, piloté avec rigueur.
          </div>
          {/* Skip hint */}
          <div style={{
            position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase',
            fontWeight: 500,
          }}>
            Présentation · ⇧⌘P pour relancer · Esc pour quitter
          </div>
        </div>
      )}

      {/* === OUTRO scene takeover === */}
      {isOutro && (
        <div
          ref={outroRef}
          style={{
            position: 'fixed', inset: 0, zIndex: 9100,
            background: 'radial-gradient(ellipse at center, var(--bg-elev) 0%, var(--bg) 70%, var(--bg-sunk) 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            opacity: 0,
          }}
        >
          <div className="dt-outro-wordmark" style={{
            marginBottom: 24, opacity: 0,
          }}>
            <Logo size={56} wordmark wordmarkSize={32}/>
          </div>
          <div className="dt-outro-msg" style={{
            fontFamily: 'Geist, system-ui, sans-serif',
            fontStyle: 'italic',
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 400,
            letterSpacing: '-0.03em',
            color: 'var(--ink)',
            opacity: 0,
            marginBottom: 18,
          }}>
            Voilà.
          </div>
          <div className="dt-outro-cta" style={{
            opacity: 0,
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 22px', borderRadius: 999,
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 13, fontWeight: 600, letterSpacing: '-0.005em',
            boxShadow: '0 8px 28px -10px color-mix(in srgb, var(--accent) 70%, transparent)',
          }}>
            Essayer Wealthly
            <ArrowRight size={14}/>
          </div>
        </div>
      )}

      {/* === APP scene : backdrop blur + dim + vignette === */}
      {isApp && (
        <>
          <div
            style={{
              position: 'fixed', inset: 0,
              background: 'color-mix(in srgb, var(--bg) 50%, transparent)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
              zIndex: 9000,
              pointerEvents: 'none',
              animation: 'demoTourBackdropIn 400ms ease-out',
            }}
            aria-hidden="true"
          />
          {/* Vignette cinematique — radial gradient sombre sur les bords */}
          <div
            style={{
              position: 'fixed', inset: 0,
              background: 'radial-gradient(ellipse at center, transparent 50%, color-mix(in srgb, #000 30%, transparent) 100%)',
              zIndex: 9000,
              pointerEvents: 'none',
              animation: 'demoTourBackdropIn 600ms ease-out',
            }}
            aria-hidden="true"
          />

          {rect && (
            <div
              ref={spotlightRef}
              style={{
                position: 'fixed',
                top: rect.top - 10,
                left: rect.left - 10,
                width: rect.width + 20,
                height: rect.height + 20,
                border: '2px solid var(--accent)',
                borderRadius: 16,
                boxShadow:
                  '0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent), ' +
                  '0 24px 80px -16px color-mix(in srgb, var(--accent) 70%, transparent)',
                pointerEvents: 'none',
                zIndex: 9001,
                transition: 'top 420ms cubic-bezier(0.16, 1, 0.3, 1), left 420ms cubic-bezier(0.16, 1, 0.3, 1), width 420ms cubic-bezier(0.16, 1, 0.3, 1), height 420ms cubic-bezier(0.16, 1, 0.3, 1)',
                transformOrigin: 'center center',
              }}
              aria-hidden="true"
            />
          )}
        </>
      )}

      {/* === Progress bar (always visible during tour) === */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 3,
        background: 'color-mix(in srgb, var(--ink) 6%, transparent)',
        zIndex: 9103,
      }}>
        <div
          ref={progressRef}
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, var(--positive)) 100%)',
            width: '0%',
            boxShadow: '0 0 14px color-mix(in srgb, var(--accent) 70%, transparent)',
          }}
        />
      </div>

      {/* === Scene dots indicator + counter === */}
      {isApp && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 6, zIndex: 9103,
          padding: '6px 14px', borderRadius: 14,
          background: 'color-mix(in srgb, var(--bg-elev) 80%, transparent)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          alignItems: 'center',
        }}>
          {appScenes.map((_, i) => (
            <span key={i} style={{
              width: i === appIdx - 1 ? 24 : 6, height: 6, borderRadius: 3,
              background: i === appIdx - 1 ? 'var(--accent)' : 'var(--ink-3)',
              opacity: i === appIdx - 1 ? 1 : 0.35,
              transition: 'all 320ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}/>
          ))}
        </div>
      )}

      {/* === Exit button === */}
      <button
        onClick={onExit}
        title="Quitter (Esc)"
        style={{
          position: 'fixed', top: 14, right: 18, zIndex: 9103,
          width: 34, height: 34, borderRadius: 17,
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--ink-2)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <X size={15}/>
      </button>

      {/* === Annotation card (only during app scenes) === */}
      {isApp && (
        <div
          ref={annotationRef}
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: 620,
            width: 'calc(100% - 32px)',
            padding: '22px 26px 20px',
            borderRadius: 18,
            background: 'var(--bg-elev)',
            border: '1px solid color-mix(in srgb, var(--accent) 22%, var(--border))',
            boxShadow:
              '0 32px 80px -24px color-mix(in srgb, var(--accent) 30%, rgba(0,0,0,0.5)), ' +
              '0 10px 30px -8px rgba(0,0,0,0.22)',
            zIndex: 9102,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--accent)',
          }}>
            <Sparkles size={12}/>
            <span>{scene.eyebrow}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--ink-3)', fontWeight: 500 }}>
              {appIdx} / {appScenes.length}
            </span>
          </div>

          <h2
            ref={titleRef}
            style={{
              margin: 0, fontFamily: 'Geist, system-ui, sans-serif',
              fontWeight: 400, fontSize: 30, lineHeight: 1.14,
              letterSpacing: '-0.025em', color: 'var(--ink)',
            }}
            dangerouslySetInnerHTML={{ __html: scene.title }}
          />

          <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55 }}>
            {scene.body}
          </p>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)',
          }}>
            <span style={{
              fontSize: 11, fontWeight: 500, color: 'var(--ink-3)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }}/>
              {scene.tag}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={prev}
                disabled={sceneIdx === 0}
                title="Précédent (←)"
                style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: 'transparent', border: '1px solid var(--border)',
                  cursor: sceneIdx === 0 ? 'not-allowed' : 'pointer',
                  opacity: sceneIdx === 0 ? 0.4 : 1,
                  color: 'var(--ink-2)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ChevronLeft size={15}/>
              </button>
              <button
                onClick={() => setPaused(p => !p)}
                title={paused ? 'Reprendre (P)' : 'Pause (P)'}
                style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: paused ? 'var(--accent-soft)' : 'transparent',
                  border: '1px solid ' + (paused ? 'var(--accent)' : 'var(--border)'),
                  cursor: 'pointer',
                  color: paused ? 'var(--accent)' : 'var(--ink-2)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {paused ? <Play size={13}/> : <Pause size={13}/>}
              </button>
              <button
                onClick={next}
                title="Suivant (→)"
                style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  cursor: 'pointer',
                  color: '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ChevronRight size={15}/>
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes demoTourBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dt-pulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.06); opacity: 1; }
        }
      `}</style>
    </>
  );
}
