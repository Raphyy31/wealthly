// ============================================================================
// gsapSetup — Foundation C10 (P3 Animations)
//
// Initialise GSAP + ScrollTrigger une fois pour toute l'app.
// Respecte prefers-reduced-motion via gsap.matchMedia() :
//   - utilisateurs reduced-motion → toutes les anims neutralisées
//   - autres → easings + durées premium par défaut
//
// Usage type (dans un useGSAP / useEffect React) :
//   import { gsap, ScrollTrigger, mm } from '@/utils/gsapSetup';
//   mm.add('(prefers-reduced-motion: no-preference)', () => {
//     gsap.from(el, { opacity: 0, scale: 0.97, duration: 0.6, ease: 'power2.out' });
//   });
//
// Direction visuelle Wealthly :
//   - jamais translateY (utiliser opacity + scale + filter)
//   - durées 180-600ms (rapide, premium)
//   - eases power2.out / expo.out (sortie nette, pas de rebond)
// ============================================================================
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Defaults app-wide : durée + ease premium.
gsap.defaults({
  duration: 0.6,
  ease: 'power2.out',
});

// matchMedia global — utilisé par chaque composant pour scoper ses anims
// au mode "motion autorisé".
export const mm = gsap.matchMedia();

// Conventions de durées pour cohérence inter-vues.
export const DURATIONS = {
  micro:   0.18,  // hover, press
  short:   0.30,  // toast, chip select
  medium:  0.50,  // modal entry, card reveal
  long:    0.80,  // hero entry, scroll reveal
  hero:    1.20,  // count-up nombres, draw-line charts
};

// Easings premium éprouvés (Linear, Stripe, Pictet).
export const EASES = {
  out:     'power2.out',
  outFast: 'power3.out',
  inOut:   'power2.inOut',
  signature: 'expo.out',   // pour les hero numbers
};

// Helper : reveal opacity + scale subtil au scroll-in.
// Compatible "no translateY" : on n'utilise que opacity + scale.
//
// usage : revealOnScroll(el, { delay: 0.1 })
export function revealOnScroll(target, opts = {}) {
  const {
    delay = 0,
    duration = DURATIONS.medium,
    ease = EASES.out,
    fromScale = 0.98,
    start = 'top 85%',
  } = opts;

  return gsap.from(target, {
    opacity: 0,
    scale: fromScale,
    duration,
    delay,
    ease,
    scrollTrigger: {
      trigger: target,
      start,
      toggleActions: 'play none none reverse',
    },
  });
}

// Helper : reveal stagger pour une liste d'éléments.
export function revealStaggerOnScroll(targets, opts = {}) {
  const {
    stagger = 0.08,
    duration = DURATIONS.medium,
    ease = EASES.out,
    fromScale = 0.97,
    start = 'top 85%',
  } = opts;

  return gsap.from(targets, {
    opacity: 0,
    scale: fromScale,
    duration,
    stagger,
    ease,
    scrollTrigger: {
      trigger: targets[0] || targets,
      start,
      toggleActions: 'play none none reverse',
    },
  });
}

export { gsap, ScrollTrigger };
export default gsap;
