// ============================================================================
// MagneticCursor — Custom cursor signature (Landing only)
//
// Deux éléments qui suivent la souris :
//   - dot (8px, cobalt) → suit la position exacte
//   - ring (32px outline) → suit avec un lag elastique
//
// Magnetic effect : sur les elements avec [data-magnetic], le ring s'aimante
// vers le centre de l'element et grossit (scale 1 → 1.6). Le dot reste sur la
// position de la souris pour donner un effet d'echelle/zoom intentionnel.
//
// Le curseur natif est cache uniquement sur (pointer: fine) (desktop), pas
// sur touch. prefers-reduced-motion : composant ne se mount pas du tout.
// ============================================================================
import { useEffect, useRef } from 'react';
import { gsap } from '../utils/gsapSetup.js';

export function MagneticCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    // Skip si reduced motion ou device touch
    const mql = window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)');
    if (mql.matches) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    // Initial offscreen
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50, opacity: 0 });

    // QuickTo pour position : super performant, evite la creation de tweens
    // a chaque mousemove.
    const xDot = gsap.quickTo(dot, 'x', { duration: 0.1, ease: 'power2.out' });
    const yDot = gsap.quickTo(dot, 'y', { duration: 0.1, ease: 'power2.out' });
    const xRing = gsap.quickTo(ring, 'x', { duration: 0.4, ease: 'power3.out' });
    const yRing = gsap.quickTo(ring, 'y', { duration: 0.4, ease: 'power3.out' });

    let isMagnet = null;

    const onMove = (e) => {
      const { clientX: x, clientY: y } = e;
      xDot(x);
      yDot(y);
      // Si on est sur un magnet, le ring s'aimante vers le centre du target.
      if (isMagnet) {
        const r = isMagnet.getBoundingClientRect();
        xRing(r.left + r.width / 2);
        yRing(r.top + r.height / 2);
      } else {
        xRing(x);
        yRing(y);
      }
    };

    const onEnter = () => gsap.to([dot, ring], { opacity: 1, duration: 0.3 });
    const onLeave = () => gsap.to([dot, ring], { opacity: 0, duration: 0.2 });

    const onMagnetEnter = (e) => {
      isMagnet = e.currentTarget;
      gsap.to(ring, {
        scale: 1.7,
        backgroundColor: 'rgba(126, 146, 255, 0.18)',
        borderColor: 'rgba(126, 146, 255, 0.7)',
        duration: 0.35,
        ease: 'power3.out',
      });
    };
    const onMagnetLeave = () => {
      isMagnet = null;
      gsap.to(ring, {
        scale: 1,
        backgroundColor: 'rgba(126, 146, 255, 0)',
        borderColor: 'rgba(241, 238, 228, 0.4)',
        duration: 0.35,
        ease: 'power3.out',
      });
    };

    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseenter', onEnter);
    document.addEventListener('mouseleave', onLeave);

    // Bind sur tous les [data-magnetic] presents au moment du mount.
    // (Suffit pour Landing — pas d'ajout dynamique de CTAs apres mount.)
    const magnets = document.querySelectorAll('[data-magnetic]');
    magnets.forEach((m) => {
      m.addEventListener('mouseenter', onMagnetEnter);
      m.addEventListener('mouseleave', onMagnetLeave);
    });

    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseenter', onEnter);
      document.removeEventListener('mouseleave', onLeave);
      magnets.forEach((m) => {
        m.removeEventListener('mouseenter', onMagnetEnter);
        m.removeEventListener('mouseleave', onMagnetLeave);
      });
    };
  }, []);

  return (
    <>
      <CursorStyles/>
      <div ref={dotRef} className="mc-dot" aria-hidden/>
      <div ref={ringRef} className="mc-ring" aria-hidden/>
    </>
  );
}

function CursorStyles() {
  const css = `
.mc-dot, .mc-ring {
  position: fixed;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 9999;
  will-change: transform, opacity;
}
.mc-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #F1EEE4; /* cream pur — toujours visible sur le bg #0F0E0C de la Landing */
  box-shadow: 0 0 0 1px rgba(126,146,255,.45), 0 0 12px rgba(126,146,255,.35);
}
.mc-ring {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1.5px solid rgba(241, 238, 228, 0.85); /* cream tres visible (avant 0.4 -> invisible sur dark) */
  background: rgba(126, 146, 255, 0);
  box-shadow: 0 0 0 1px rgba(15, 14, 12, .2);
  transition: backdrop-filter 0.2s;
}
/* Hide native cursor on Landing (only on fine pointer = desktop) */
@media (hover: hover) and (pointer: fine) {
  body:has(.mc-dot) {
    cursor: none;
  }
  body:has(.mc-dot) * {
    cursor: none !important;
  }
}
@media (prefers-reduced-motion: reduce), (pointer: coarse) {
  .mc-dot, .mc-ring { display: none; }
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}
