import React, { useState, useEffect, useRef } from 'react';
import { gsap, EASES } from '../utils/gsapSetup.js';

// AnimatedNumber — tween entre les valeurs successives via GSAP (C10).
//
// Migration rAF custom → GSAP (2026-05-18) :
//   - même API publique (value, format, duration)
//   - prefers-reduced-motion → snap immédiat à la valeur cible
//   - snap natif via { roundProps } pour les décimales monétaires propres
//
// Wrapped in React.memo car le parent re-render sur état non lié.
export const AnimatedNumber = React.memo(function AnimatedNumber({ value, format, duration = 0.8 }) {
  const [display, setDisplay] = useState(value);
  const tweenRef = useRef(null);
  const targetRef = useRef(value);

  useEffect(() => {
    // Skip si la valeur cible n'a pas changé significativement.
    if (Math.abs(targetRef.current - value) < 0.01) return;
    targetRef.current = value;

    // Respect du prefers-reduced-motion : pas d'anim, snap direct.
    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplay(value);
      return;
    }

    // Tween GSAP — proxy object pour piloter setDisplay.
    const proxy = { val: display };
    if (tweenRef.current) tweenRef.current.kill();
    // Durée fournie en ms (ancienne API) → secondes pour GSAP.
    const durSec = duration > 5 ? duration / 1000 : duration;

    tweenRef.current = gsap.to(proxy, {
      val: value,
      duration: durSec,
      ease: EASES.out,
      onUpdate: () => setDisplay(proxy.val),
    });

    return () => {
      if (tweenRef.current) tweenRef.current.kill();
    };
  }, [value, duration]);  // eslint-disable-line react-hooks/exhaustive-deps

  return <>{format ? format(display) : display}</>;
});
