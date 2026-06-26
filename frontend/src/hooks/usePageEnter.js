// ============================================================================
// usePageEnter — motion d'entrée standard (charte « Forêt »).
//
// Applique la même grammaire d'entrée que le Dashboard à n'importe quel écran :
//   - header + hero immédiats (à marquer data-reveal en premier),
//   - puis cascade (stagger 70 ms) des blocs marqués [data-reveal],
//   - les jauges marquées [data-bar-fill] poussent de 0 → data-target.
//
// Respecte prefers-reduced-motion : on NE lance rien (l'état final, opacité 1 /
// largeur cible, est l'état par défaut du DOM) → contenu jamais masqué.
//
// Usage :
//   const rootRef = usePageEnter();
//   return <div ref={rootRef}> <header data-reveal/> <section data-reveal/> …
//
// Pour ré-jouer quand des données async arrivent, passer une dépendance :
//   const rootRef = usePageEnter([loading]);
// ============================================================================
import { useEffect, useRef } from 'react';
import { gsap } from '../utils/gsapSetup.js';

export function usePageEnter(deps = []) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      const blocks = gsap.utils.toArray('[data-reveal]');
      if (blocks.length) {
        gsap.fromTo(blocks,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out', stagger: 0.07, delay: 0.04, clearProps: 'transform' }
        );
      }
      const bars = gsap.utils.toArray('[data-bar-fill]');
      if (bars.length) {
        gsap.fromTo(bars,
          { width: '0%' },
          { width: (i, el) => el.dataset.target || '0%', duration: 0.9, ease: 'expo.out', delay: 0.2 }
        );
      }
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

export default usePageEnter;
