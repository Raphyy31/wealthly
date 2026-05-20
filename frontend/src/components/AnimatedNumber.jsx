import React, { useState, useEffect, useRef } from 'react';
import { gsap, EASES } from '../utils/gsapSetup.js';

// AnimatedNumber — tween entre les valeurs successives via GSAP.
//
// Animations :
//   - Count-up smooth entre old et new value (snap final)
//   - Pulse cobalt + scale 1.04 -> 1 quand la valeur change (sauf au mount)
//   - prefers-reduced-motion -> snap direct sans anim
//
// Props :
//   - value     : nombre cible
//   - format    : (n) => string (e.g. fmtAmount)
//   - duration  : secondes (ou ms si > 5)
//   - pulseOnChange : true par defaut, false desactive le flash visuel
export const AnimatedNumber = React.memo(function AnimatedNumber({
  value,
  format,
  duration = 0.8,
  pulseOnChange = true,
}) {
  const [display, setDisplay] = useState(value);
  const tweenRef = useRef(null);
  const targetRef = useRef(value);
  const spanRef = useRef(null);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    // Skip si la valeur cible n'a pas changé significativement.
    if (Math.abs(targetRef.current - value) < 0.01) {
      isFirstRenderRef.current = false;
      return;
    }
    targetRef.current = value;
    const wasFirstRender = isFirstRenderRef.current;
    isFirstRenderRef.current = false;

    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplay(value);
      return;
    }

    // Tween de la valeur numerique
    const proxy = { val: display };
    if (tweenRef.current) tweenRef.current.kill();
    const durSec = duration > 5 ? duration / 1000 : duration;

    tweenRef.current = gsap.to(proxy, {
      val: value,
      duration: durSec,
      ease: EASES.out,
      onUpdate: () => setDisplay(proxy.val),
    });

    // Pulse visuel : flash cobalt + scale, retour au color/transform parent.
    // Seulement sur les MAJ post-mount (pas au premier rendu).
    if (pulseOnChange && !wasFirstRender && spanRef.current) {
      gsap.fromTo(spanRef.current,
        { color: 'var(--accent)', scale: 1.04 },
        {
          color: 'inherit',
          scale: 1,
          duration: 0.7,
          ease: 'power2.out',
          clearProps: 'color,transform',
        }
      );
    }

    return () => {
      if (tweenRef.current) tweenRef.current.kill();
    };
  }, [value, duration, pulseOnChange]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span
      ref={spanRef}
      style={{ display: 'inline-block', transformOrigin: 'center' }}
    >
      {format ? format(display) : display}
    </span>
  );
});
