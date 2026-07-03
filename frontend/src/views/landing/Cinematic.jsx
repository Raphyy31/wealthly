// Cinematic.jsx — Yotori Finance cinematic landing (port ESM 2026-05-22)
// Header minimal + démo fullscreen + 2 CTAs at end of loop
import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import DemoLoopCinematic from './DemoLoopCinematic.jsx';
import './styles.css';
import './cinematic.css';

export default function Cinematic({ onSignIn, onSignUp, onShowDetails, onTryDemo }) {
  const [completed, setCompleted] = useState(false);
  const [replayToken, setReplayToken] = useState(0);
  const ctaLayerRef = useRef(null);
  const ctaTitleRef = useRef(null);
  const ctaRowRef = useRef(null);
  const replayRef = useRef(null);

  // Add class to body for scroll-lock
  useEffect(() => {
    document.body.classList.add('cinematic');
    return () => document.body.classList.remove('cinematic');
  }, []);

  // Handle end-of-loop CTA reveal
  const handleComplete = useCallback(() => {
    setCompleted(true);
  }, []);

  useLayoutEffect(() => {
    if (!completed) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const layer = ctaLayerRef.current;
    const title = ctaTitleRef.current;
    const row = ctaRowRef.current;
    const replay = replayRef.current;
    if (!layer) return;

    if (reduced) {
      gsap.set([layer, title, row, replay].filter(Boolean), { opacity: 1 });
      return;
    }

    const tl = gsap.timeline();
    tl.fromTo(layer,
      { opacity: 0 },
      { opacity: 1, duration: 0.5, ease: 'expo.out' }, 0);

    if (title) {
      const words = title.querySelectorAll('.word');
      if (words.length) {
        tl.fromTo(words,
          { opacity: 0, filter: 'blur(12px)' },
          { opacity: 1, filter: 'blur(0px)', duration: 0.85, ease: 'expo.out', stagger: 0.07 },
          0.15);
      }
    }
    if (row) {
      tl.fromTo(row.children,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.55, ease: 'expo.out', stagger: 0.1 },
        0.55);
    }
    if (replay) {
      tl.fromTo(replay,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: 'expo.out' },
        0.85);
    }
    return () => tl.kill();
  }, [completed]);

  const handleReplay = useCallback(() => {
    // Hide CTAs, restart demo
    const layer = ctaLayerRef.current;
    if (layer) {
      gsap.to(layer, {
        opacity: 0, duration: 0.3, ease: 'power3.in',
        onComplete: () => {
          setCompleted(false);
          setReplayToken(t => t + 1);
        },
      });
    } else {
      setCompleted(false);
      setReplayToken(t => t + 1);
    }
  }, []);

  return (
    <>
      <div className="cin-halo" aria-hidden/>
      <div className="page-grain" aria-hidden/>

      <header className="cin-header">
        <div className="cin-mark">
          <div className="cin-mark-glyph">y</div>
          <div className="cin-mark-word">yotori finance</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onTryDemo && (
            <button
              className="cin-signin"
              onClick={onTryDemo}
              style={{ border: '1px solid rgba(255,255,255,.28)', borderRadius: 999, padding: '7px 16px' }}
            >
              Voir la démo
            </button>
          )}
          <button className="cin-signin" onClick={onSignIn}>Se connecter</button>
        </div>
      </header>

      <button className="cin-skip" onClick={onShowDetails}>
        Passer la démo →
      </button>

      <main className="cin-stage">
        <DemoLoopCinematic onComplete={handleComplete} replayToken={replayToken}/>
      </main>

      <div ref={ctaLayerRef} className={`cin-cta-layer ${completed ? 'visible' : ''}`} style={{ opacity: 0 }}>
        <h2 className="cin-cta-title" ref={ctaTitleRef}>
          <span className="cin-cta-title-line">
            <span className="word">Une</span>{' '}
            <span className="word">seule</span>{' '}
            <span className="word">vue.</span>
          </span>
          <span className="cin-cta-title-line">
            <em>
              <span className="word">Tout</span>{' '}
              <span className="word">votre</span>{' '}
              <span className="word">patrimoine.</span>
            </em>
          </span>
        </h2>

        <div className="cin-cta-row" ref={ctaRowRef}>
          <a className="cin-cta cin-cta-primary" href="#" onClick={(e) => { e.preventDefault(); onSignUp?.(); }}>
            Créer un compte
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </a>
          <a className="cin-cta cin-cta-ghost" href="#" onClick={(e) => { e.preventDefault(); onShowDetails?.(); }}>
            Découvrir Yotori Finance
          </a>
          {onTryDemo && (
            <a className="cin-cta cin-cta-ghost" href="#" onClick={(e) => { e.preventDefault(); onTryDemo(); }}>
              Voir la démo
            </a>
          )}
        </div>

        <button className="cin-replay" onClick={handleReplay} ref={replayRef} style={{ opacity: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          Revoir la démo
        </button>
      </div>
    </>
  );
}

