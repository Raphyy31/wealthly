// ============================================================================
// useMagneticHover — Hook réutilisable pour appliquer un effet magnétique
// sur n'importe quel bouton dans l'app.
//
// Pattern Apple / Stripe : au hover, le bouton se déplace légèrement vers la
// position du curseur dans ses bounds. Sortie en spring physics (back.out
// subtil). Effet d'attirance qui rend l'interaction "vivante".
//
// Usage :
//   const ref = useMagneticHover({ strength: 0.3 });
//   <button ref={ref}>...</button>
//
// Respect prefers-reduced-motion : ne fait rien si l'user le demande.
// Skip touch (pointer:coarse) — pas de hover sur mobile.
// ============================================================================
import { useEffect, useRef } from 'react';
import { gsap } from '../utils/gsapSetup.js';

export function useMagneticHover({ strength = 0.3, scale = 1.02 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Skip si reduced motion ou touch
    const mql = window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)');
    if (mql.matches) return;

    const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
    const scaleTo = gsap.quickTo(el, 'scale', { duration: 0.4, ease: 'power3.out' });

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) * strength;
      const dy = (e.clientY - cy) * strength;
      xTo(dx);
      yTo(dy);
    };
    const onEnter = () => scaleTo(scale);
    const onLeave = () => {
      xTo(0);
      yTo(0);
      scaleTo(1);
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);

    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [strength, scale]);

  return ref;
}
