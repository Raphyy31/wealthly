// DemoTour — Mode "Présentation" auto-jouable pour pitch investisseurs.
//
// Lance un tour guidé des 3 écrans clés (Overview / Budget Sankey / Patrimoine)
// avec :
//   - Backdrop semi-transparent qui dim toute l'app
//   - Annotation card flottante au centre-bas avec titre + body + tagline
//   - Spotlight cobalt rectangulaire autour de l'élément clé (computed bbox)
//   - Progress bar fine en haut (4s par scène par défaut, auto-advance)
//   - Nav clavier : ← / → / Esc + clic sur la carte pour next manuel
//   - Anim GSAP : fade-in annotation + scale spotlight + progress bar fill
//
// Trigger : prop `active` controllée par le parent (bouton dans le header).
// Le parent passe aussi `setView(viewId)` pour que le tour navigue lui-meme.
//
// Pourquoi pas un overlay "couvrant" ? On veut que l'investisseur VOIE l'app
// derriere (vrais chiffres, vraies cards), pas un mockup. Le dim est leger
// (-30% opacity) et le spotlight ressort en gardant la pleine opacite +
// halo cobalt + glow GSAP.
import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Pause, Sparkles } from 'lucide-react';
import { gsap } from '../utils/gsapSetup.js';

// Definition des scenes — chaque scene specifie quelle vue afficher, quel
// element spotlight (CSS selector), et le contenu de l'annotation.
const SCENES = [
  {
    view: 'dashboard',
    anchor: '.hero-card',
    eyebrow: 'OVERVIEW',
    title: 'Patrimoine net <em>en un coup d’œil.</em>',
    body: 'Liquidités, placements, immo, dettes — agrégés en temps réel depuis vos banques via DSP2. Une seule source de vérité pour vos finances.',
    tag: 'Net worth temps réel',
    duration: 6000,
  },
  {
    view: 'dashboard',
    anchor: '.mcc-card',
    eyebrow: 'CASHFLOW',
    title: 'Combien il vous <em>reste</em> ce mois-ci.',
    body: 'Entrées, sorties, épargne — comparé à votre mois type. Vous savez immédiatement si vous tenez votre budget.',
    tag: 'Décision en 3 secondes',
    duration: 6000,
  },
  {
    view: 'monthly',
    anchor: '.mon-sankey-duo',
    eyebrow: 'BUDGET MENSUEL',
    title: 'Où va vraiment <em>votre argent.</em>',
    body: 'Sankey diagramme du salaire jusqu’aux sous-catégories. Comparez votre mois type prévu vs le mois réel, repérez les écarts en un regard.',
    tag: 'Visualisation Sankey',
    duration: 7000,
  },
  {
    view: 'wealth',
    anchor: '.wealth-hero',
    eyebrow: 'PATRIMOINE',
    title: 'PEA, immo, crédits — <em>tout aligné.</em>',
    body: 'Patrimoine financier et immobilier net en deux blocs hero. Évolution 12 mois, breakdown par classe d’actifs. Aussi clair qu’un rapport bancaire privé.',
    tag: 'Vision patrimoniale complète',
    duration: 7000,
  },
];

// Calcule le rect d'un element + scrolle dedans si necessaire.
function getAnchorRect(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  // Scrolle dans la viewport avec un padding top pour ne pas coller au bord.
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Wait a tick pour que le scroll prenne effet avant de mesurer.
  return new Promise(resolve => {
    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      resolve({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    }, 350);
  });
}

export function DemoTour({ active, onExit, setView }) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const [paused, setPaused] = useState(false);
  const annotationRef = useRef(null);
  const spotlightRef = useRef(null);
  const progressRef = useRef(null);
  const timerRef = useRef(null);
  const progressTweenRef = useRef(null);

  const scene = SCENES[sceneIdx];

  // Quand active toggles ou scene change, navigate + recompute rect
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      // 1. Navigate to the target view
      setView?.(scene.view);
      // 2. Wait for view transition to settle
      await new Promise(r => setTimeout(r, 450));
      if (cancelled) return;
      // 3. Compute anchor rect
      const r = await getAnchorRect(scene.anchor);
      if (cancelled || !r) return;
      setRect(r);
    })();
    return () => { cancelled = true; };
  }, [active, sceneIdx, scene.view, scene.anchor, setView]);

  // Animation : annotation fade-in + spotlight scale + progress bar fill
  useLayoutEffect(() => {
    if (!active || !rect) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // Annotation entry
    if (annotationRef.current) {
      gsap.fromTo(annotationRef.current,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.55, ease: 'expo.out' }
      );
    }
    // Spotlight entry
    if (spotlightRef.current) {
      gsap.fromTo(spotlightRef.current,
        { opacity: 0, scale: 1.04 },
        { opacity: 1, scale: 1, duration: 0.5, ease: 'expo.out' }
      );
    }
  }, [active, rect, sceneIdx]);

  // Auto-advance + progress bar fill timeline
  useEffect(() => {
    if (!active || paused || !rect) return;
    if (progressTweenRef.current) progressTweenRef.current.kill();
    if (timerRef.current) clearTimeout(timerRef.current);

    // Progress bar fill from 0 to 100% over scene.duration
    if (progressRef.current) {
      gsap.set(progressRef.current, { width: '0%' });
      progressTweenRef.current = gsap.to(progressRef.current, {
        width: '100%',
        duration: scene.duration / 1000,
        ease: 'none',
      });
    }

    timerRef.current = setTimeout(() => {
      next();
    }, scene.duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressTweenRef.current) progressTweenRef.current.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, paused, rect, sceneIdx]);

  const next = useCallback(() => {
    setSceneIdx(i => {
      if (i >= SCENES.length - 1) {
        // Fin du tour -> exit
        setTimeout(() => onExit?.(), 100);
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

  // Reset state on exit
  useEffect(() => {
    if (!active) {
      setSceneIdx(0);
      setRect(null);
      setPaused(false);
    }
  }, [active]);

  // Window resize -> recompute anchor rect
  useEffect(() => {
    if (!active || !rect) return;
    const onResize = async () => {
      const r = await getAnchorRect(scene.anchor);
      if (r) setRect(r);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, rect, scene.anchor]);

  if (!active) return null;

  return (
    <>
      {/* Backdrop dim — leger pour que l'app reste visible derriere */}
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'color-mix(in srgb, var(--bg) 35%, transparent)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          zIndex: 9000,
          pointerEvents: 'none',
          animation: 'demoTourBackdropIn 400ms ease-out',
        }}
        aria-hidden="true"
      />

      {/* Spotlight ring cobalt autour de l'element anchor */}
      {rect && (
        <div
          ref={spotlightRef}
          style={{
            position: 'fixed',
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            border: '2px solid var(--accent)',
            borderRadius: 16,
            boxShadow:
              '0 0 0 9999px color-mix(in srgb, var(--bg) 0%, transparent), ' +
              '0 0 0 4px color-mix(in srgb, var(--accent) 20%, transparent), ' +
              '0 16px 60px -16px color-mix(in srgb, var(--accent) 60%, transparent)',
            pointerEvents: 'none',
            zIndex: 9001,
            transition: 'top 380ms cubic-bezier(0.16, 1, 0.3, 1), left 380ms cubic-bezier(0.16, 1, 0.3, 1), width 380ms cubic-bezier(0.16, 1, 0.3, 1), height 380ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Progress bar tout en haut */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 3,
        background: 'color-mix(in srgb, var(--ink) 8%, transparent)',
        zIndex: 9003,
      }}>
        <div
          ref={progressRef}
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 70%, var(--positive)) 100%)',
            width: '0%',
            boxShadow: '0 0 12px color-mix(in srgb, var(--accent) 60%, transparent)',
          }}
        />
      </div>

      {/* Scene indicators (dots) en haut */}
      <div style={{
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 6, zIndex: 9003,
        padding: '6px 12px', borderRadius: 14,
        background: 'color-mix(in srgb, var(--bg-elev) 80%, transparent)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        {SCENES.map((_, i) => (
          <span key={i} style={{
            width: i === sceneIdx ? 22 : 6, height: 6, borderRadius: 3,
            background: i === sceneIdx ? 'var(--accent)' : 'var(--ink-3)',
            opacity: i === sceneIdx ? 1 : 0.4,
            transition: 'all 280ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}/>
        ))}
      </div>

      {/* Exit button en haut-droite */}
      <button
        onClick={onExit}
        title="Quitter (Esc)"
        style={{
          position: 'fixed', top: 14, right: 18, zIndex: 9003,
          width: 32, height: 32, borderRadius: 16,
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--ink-2)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <X size={14}/>
      </button>

      {/* Annotation card centre-bas */}
      <div
        ref={annotationRef}
        style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: 560,
          width: 'calc(100% - 32px)',
          padding: '20px 24px 18px',
          borderRadius: 16,
          background: 'var(--bg-elev)',
          border: '1px solid color-mix(in srgb, var(--accent) 22%, var(--border))',
          boxShadow:
            '0 24px 60px -20px color-mix(in srgb, var(--accent) 30%, rgba(0,0,0,0.4)), ' +
            '0 8px 24px -8px rgba(0,0,0,0.18)',
          zIndex: 9002,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
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
            {sceneIdx + 1} / {SCENES.length}
          </span>
        </div>

        <h2
          style={{
            margin: 0, fontFamily: 'Newsreader, Georgia, serif',
            fontWeight: 400, fontSize: 26, lineHeight: 1.15,
            letterSpacing: '-0.02em', color: 'var(--ink)',
          }}
          dangerouslySetInnerHTML={{ __html: scene.title }}
        />

        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
          {scene.body}
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 6, paddingTop: 12, borderTop: '1px solid var(--border)',
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
                width: 28, height: 28, borderRadius: 6,
                background: 'transparent', border: '1px solid var(--border)',
                cursor: sceneIdx === 0 ? 'not-allowed' : 'pointer',
                opacity: sceneIdx === 0 ? 0.4 : 1,
                color: 'var(--ink-2)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ChevronLeft size={14}/>
            </button>
            <button
              onClick={() => setPaused(p => !p)}
              title={paused ? 'Reprendre (P)' : 'Pause (P)'}
              style={{
                width: 28, height: 28, borderRadius: 6,
                background: paused ? 'var(--accent-soft)' : 'transparent',
                border: '1px solid ' + (paused ? 'var(--accent)' : 'var(--border)'),
                cursor: 'pointer',
                color: paused ? 'var(--accent)' : 'var(--ink-2)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {paused ? <Play size={12}/> : <Pause size={12}/>}
            </button>
            <button
              onClick={next}
              title="Suivant (→)"
              style={{
                width: 28, height: 28, borderRadius: 6,
                background: 'var(--accent)',
                border: '1px solid var(--accent)',
                cursor: 'pointer',
                color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ChevronRight size={14}/>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes demoTourBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
