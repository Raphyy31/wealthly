// DemoLoopCinematic.jsx — plays ONCE then fires onComplete (port ESM 2026-05-22)
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { SCENES } from './Scenes.jsx';

function SplitWords({ html }) {
  const parts = String(html).split(/(<em>|<\/em>)/);
  let inEm = false;
  const out = [];
  let key = 0;
  for (const p of parts) {
    if (p === '<em>') { inEm = true; continue; }
    if (p === '</em>') { inEm = false; continue; }
    if (!p) continue;
    const words = p.split(/(\s+)/);
    for (const w of words) {
      if (!w) continue;
      if (/^\s+$/.test(w)) {
        out.push(<React.Fragment key={key++}>{w}</React.Fragment>);
        continue;
      }
      const decoded = w.replace(/&rsquo;/g, '\u2019').replace(/&amp;/g, '&');
      if (inEm) {
        out.push(<em key={key++}><span className="word">{decoded}</span></em>);
      } else {
        out.push(<span key={key++} className="word">{decoded}</span>);
      }
    }
  }
  return <>{out}</>;
}

function computeAnnotationLayout(spotRect, side, canvasW, canvasH) {
  const W = 320;
  const GAP = 28;
  const EDGE = 24;
  const H = 188;
  if (side === 'footer' || spotRect.width > canvasW * 0.72) {
    return { mode: 'footer', x: 0, y: 0 };
  }
  if (side === 'right' && spotRect.x + spotRect.width + GAP + W + EDGE < canvasW) {
    return {
      mode: 'floating',
      x: spotRect.x + spotRect.width + GAP,
      y: Math.max(EDGE, Math.min(spotRect.y + spotRect.height/2 - H/2, canvasH - H - EDGE)),
      side: 'right',
    };
  }
  if (side === 'left' && spotRect.x - GAP - W > EDGE) {
    return {
      mode: 'floating',
      x: spotRect.x - GAP - W,
      y: Math.max(EDGE, Math.min(spotRect.y + spotRect.height/2 - H/2, canvasH - H - EDGE)),
      side: 'left',
    };
  }
  return { mode: 'footer', x: 0, y: 0 };
}

function DemoLoopCinematic({ onComplete, replayToken = 0 }) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [spotRect, setSpotRect] = useState(null);
  const [annoPos, setAnnoPos] = useState({ mode: 'footer' });
  const [countValue, setCountValue] = useState(0);
  const [countActive, setCountActive] = useState(false);

  const canvasRef = useRef(null);
  const sceneRefs = useRef([]);
  const spotlightRef = useRef(null);
  const annotationRef = useRef(null);
  const annoTitleRef = useRef(null);
  const barRef = useRef(null);
  const countLayerRef = useRef(null);
  const wipeEdgeRef = useRef(null);
  const flashRef = useRef(null);
  const timerRef = useRef(null);
  const barTweenRef = useRef(null);
  const kenBurnsRef = useRef(null);
  const prevIdxRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const completedRef = useRef(false);

  const scene = SCENES[sceneIdx];

  // Reset when replayToken changes
  useEffect(() => {
    if (replayToken > 0) {
      completedRef.current = false;
      prevIdxRef.current = sceneIdx;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (barTweenRef.current) barTweenRef.current.kill();
      setSpotRect(null);
      setSceneIdx(0);
    }
  }, [replayToken]);

  // Initial scene visibility
  useLayoutEffect(() => {
    sceneRefs.current.forEach((el, i) => {
      if (!el) return;
      gsap.set(el, {
        opacity: i === 0 ? 1 : 0,
        scale: 1,
        filter: 'blur(0px)',
        clipPath: 'inset(0% 0% 0% 0%)',
      });
    });
  }, []);

  // Transitions
  useLayoutEffect(() => {
    const prev = prevIdxRef.current;
    if (prev === sceneIdx) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const outEl = sceneRefs.current[prev];
    const inEl = sceneRefs.current[sceneIdx];
    const wipeEdge = wipeEdgeRef.current;
    const flash = flashRef.current;
    if (!outEl || !inEl) return;
    isAnimatingRef.current = true;
    if (reduced) {
      gsap.set(outEl, { opacity: 0 });
      gsap.set(inEl, { opacity: 1, scale: 1, clipPath: 'inset(0% 0% 0% 0%)' });
      isAnimatingRef.current = false;
      prevIdxRef.current = sceneIdx;
      return;
    }
    const prevScene = SCENES[prev];
    const nextScene = SCENES[sceneIdx];
    const isIntroExit = prevScene.isIntro;
    const isIntroEnter = nextScene.isIntro;
    if (isIntroExit || isIntroEnter) {
      gsap.set(outEl, { zIndex: 1 });
      gsap.set(inEl, { zIndex: 2, opacity: 0, scale: 1, clipPath: 'inset(0% 0% 0% 0%)', filter: 'blur(0px)' });
      const tlSimple = gsap.timeline({
        onComplete: () => {
          prevIdxRef.current = sceneIdx;
          isAnimatingRef.current = false;
          gsap.set(outEl, { opacity: 0, scale: 1, filter: 'none', zIndex: 0 });
          gsap.set(inEl, { zIndex: 1 });
        },
      });
      tlSimple.to(outEl, { opacity: 0, scale: 0.99, filter: 'blur(4px)', duration: 0.28, ease: 'power3.in' }, 0);
      tlSimple.to(inEl, { opacity: 1, duration: 0.32, ease: 'expo.out' }, 0.12);
      return () => tlSimple.kill();
    }
    const wipeDir = nextScene.wipeDir || 'right';
    const fromClip = wipeDir === 'right' ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)';
    gsap.set(outEl, { zIndex: 1 });
    gsap.set(inEl, { zIndex: 2, opacity: 1, scale: 1.02, clipPath: fromClip, filter: 'blur(0px)' });
    if (wipeEdge) gsap.set(wipeEdge, { left: wipeDir === 'right' ? '0%' : '100%', opacity: 1 });
    if (flash) gsap.set(flash, { opacity: 0 });
    const TRANS = 0.40;
    const tl = gsap.timeline({
      onComplete: () => {
        prevIdxRef.current = sceneIdx;
        isAnimatingRef.current = false;
        gsap.set(outEl, { opacity: 0, scale: 1, filter: 'none', zIndex: 0 });
        gsap.set(inEl, { zIndex: 1 });
      },
    });
    tl.to(outEl, { scale: 0.99, filter: 'blur(4px) brightness(1.08)', opacity: 0, duration: TRANS * 0.5, ease: 'power4.in' }, 0);
    if (flash) {
      tl.to(flash, { opacity: 0.45, duration: TRANS * 0.2, ease: 'power2.out' }, 0)
        .to(flash, { opacity: 0, duration: TRANS * 0.45, ease: 'power2.in' }, TRANS * 0.2);
    }
    tl.to(inEl, { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: TRANS * 0.95, ease: 'expo.out' }, 0.02);
    if (wipeEdge) {
      tl.to(wipeEdge, { left: wipeDir === 'right' ? '100%' : '0%', duration: TRANS * 0.95, ease: 'expo.out' }, 0.02)
        .to(wipeEdge, { opacity: 0, duration: 0.14, ease: 'power2.out' }, TRANS * 0.75);
    }
    return () => tl.kill();
  }, [sceneIdx]);

  // Measure — skip for intro and focused scenes (no spotlight needed)
  useLayoutEffect(() => {
    if (scene.isIntro || scene.focused) { setSpotRect(null); return; }
    let cancelled = false;
    const measure = () => {
      if (cancelled || !canvasRef.current) return;
      const target = canvasRef.current.querySelector(`[data-spot="${scene.spotSel}"]`);
      if (!target) return;
      const sceneEl = target.closest('.scene');
      if (sceneEl && sceneRefs.current[sceneIdx] !== sceneEl) return;
      const tRect = target.getBoundingClientRect();
      const cRect = canvasRef.current.getBoundingClientRect();
      if (tRect.width === 0 || cRect.width === 0) return;
      const pad = 8;
      const rect = {
        x: tRect.left - cRect.left - pad,
        y: tRect.top - cRect.top - pad,
        width: tRect.width + pad * 2,
        height: tRect.height + pad * 2,
      };
      setSpotRect(rect);
      setAnnoPos(computeAnnotationLayout(rect, scene.annoSide, cRect.width, cRect.height));
    };
    const t1 = setTimeout(measure, 60);
    const t2 = setTimeout(measure, 480);
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => { cancelled = true; clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', onResize); };
  }, [sceneIdx, scene.spotSel, scene.annoSide, scene.isIntro, scene.focused]);

  useEffect(() => {
    setCountValue(scene.countUp ? scene.countUp.from : 0);
    setCountActive(false);
  }, [sceneIdx, scene.countUp]);

  // Spotlight + annotation enter
  useLayoutEffect(() => {
    if (!spotRect) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const spot = spotlightRef.current;
    const card = annotationRef.current;
    const title = annoTitleRef.current;
    if (kenBurnsRef.current) kenBurnsRef.current.kill();
    if (reduced) {
      gsap.set([spot, card].filter(Boolean), { opacity: 1, scale: 1, filter: 'none' });
      return;
    }
    const tl = gsap.timeline({ delay: 0.28 });
    if (spot) {
      tl.fromTo(spot, { opacity: 0, scale: 1.06, filter: 'blur(6px)' },
        { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.42, ease: 'expo.out' }, 0);
      kenBurnsRef.current = gsap.to(spot, { scale: 1.018, duration: scene.duration / 1000, ease: 'sine.inOut', delay: 0.7 });
    }
    if (card) {
      tl.fromTo(card, { opacity: 0, y: 6, filter: 'blur(4px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.4, ease: 'expo.out' }, 0.08);
    }
    if (title) {
      const words = title.querySelectorAll('.word');
      if (words.length) {
        tl.fromTo(words, { opacity: 0, filter: 'blur(6px)' },
          { opacity: 1, filter: 'blur(0px)', duration: 0.42, ease: 'expo.out', stagger: 0.035 }, 0.16);
      }
    }
    return () => { tl.kill(); if (kenBurnsRef.current) kenBurnsRef.current.kill(); };
  }, [spotRect, scene.duration]);

  // ─── Auto-advance + bar ────────────────────────────────────────────
  useEffect(() => {
    if (paused) return;
    if (completedRef.current) return;
    // Focused/intro scenes don't need spotRect — advance on duration directly
    if (!scene.isIntro && !scene.focused && !spotRect) return;
    if (barTweenRef.current) barTweenRef.current.kill();
    if (timerRef.current) clearTimeout(timerRef.current);

    if (barRef.current) {
      gsap.set(barRef.current, { width: '0%' });
      barTweenRef.current = gsap.to(barRef.current, {
        width: '100%',
        duration: scene.duration / 1000,
        ease: 'none',
      });
    }

    timerRef.current = setTimeout(() => {
      const isLastScene = sceneIdx === SCENES.length - 1;
      if (isLastScene) {
        // End of playthrough — fire onComplete instead of looping
        completedRef.current = true;
        onComplete?.();
        return;
      }
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const els = [spotlightRef.current, annotationRef.current].filter(Boolean);
      if (reduced || els.length === 0) {
        setSpotRect(null);
        setSceneIdx(i => i + 1);
        return;
      }
      gsap.to(els, {
        opacity: 0, scale: 0.985, filter: 'blur(5px)',
        duration: 0.22, ease: 'power4.in',
        onComplete: () => { setSpotRect(null); setSceneIdx(i => i + 1); },
      });
    }, scene.duration);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); if (barTweenRef.current) barTweenRef.current.kill(); };
  }, [sceneIdx, paused, spotRect, scene.duration, scene.isIntro, onComplete]);

  // Count-up — needs canvas measured for PEA scene (no spotRect there)
  useEffect(() => {
    if (!scene.countUp || paused) return;
    if (!scene.isIntro && !scene.focused && !spotRect) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const cu = scene.countUp;
    const startTimer = setTimeout(() => {
      if (reduced) { setCountValue(cu.to); return; }
      setCountActive(true);
      const layer = countLayerRef.current;
      if (layer) gsap.fromTo(layer, { opacity: 0, scale: 0.92, filter: 'blur(10px)' },
        { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.55, ease: 'expo.out' });
      const obj = { v: cu.from };
      gsap.to(obj, { v: cu.to, duration: cu.duration / 1000, ease: 'expo.out',
        onUpdate: () => setCountValue(Math.round(obj.v)) });
      const exitTimer = setTimeout(() => {
        if (countLayerRef.current) {
          gsap.to(countLayerRef.current, { opacity: 0, scale: 1.06, filter: 'blur(8px)',
            duration: 0.45, ease: 'power2.in', onComplete: () => setCountActive(false) });
        }
      }, cu.duration + 1300);
      return () => clearTimeout(exitTimer);
    }, scene.countUp.at);
    return () => clearTimeout(startTimer);
  }, [sceneIdx, paused, spotRect, scene.countUp]);

  return (
    <div className="demo-stage">
      {/* statusbar (dots + pause + "Démo en direct") retirée 2026-05-22 —
          jugée pas pro. La progression reste visible via .demo-bar en bas. */}

      <div className="demo-canvas" ref={canvasRef}>
        {SCENES.map((s, i) => {
          const isActive = i === sceneIdx;
          if (s.isIntro) {
            return (
              <div key={s.id} className="scene scene-intro" ref={el => sceneRefs.current[i] = el}>
                <div className="intro-wordmark">
                  <div className="intro-glyph">w</div>
                  <div className="intro-name">wealthly</div>
                </div>
                <div className="intro-tagline">
                  Votre patrimoine, <em>groupé en une vue.</em>
                </div>
              </div>
            );
          }
          const SceneComp = s.Component;
          return (
            <div key={s.id} className="scene" ref={el => sceneRefs.current[i] = el}>
              {s.id === 'pea'
                ? <SceneComp countValue={isActive && countActive ? countValue : (s.countUp?.to ?? 0)}/>
                : <SceneComp/>}
            </div>
          );
        })}

        <div ref={wipeEdgeRef} className="wipe-edge" aria-hidden style={{ opacity: 0 }}/>
        <div ref={flashRef} className="wipe-flash" aria-hidden style={{ opacity: 0 }}/>

        {spotRect && (
          <div ref={spotlightRef} className="spotlight" style={{
            left: spotRect.x, top: spotRect.y, width: spotRect.width, height: spotRect.height,
          }} aria-hidden/>
        )}

        {spotRect && annoPos.mode === 'floating' && annoPos.side === 'right' && (
          <svg className="connector" style={{ position: 'absolute', inset: 0 }} aria-hidden>
            <line x1={spotRect.x + spotRect.width} y1={spotRect.y + spotRect.height/2}
              x2={annoPos.x} y2={annoPos.y + 28}
              stroke="#2B8FB0" strokeWidth="1" strokeDasharray="2 4" opacity="0.55"/>
            <circle cx={spotRect.x + spotRect.width} cy={spotRect.y + spotRect.height/2} r="3" fill="#2B8FB0"/>
          </svg>
        )}

        {spotRect && (
          <div ref={annotationRef}
            className={`annotation ${annoPos.mode === 'footer' ? 'is-footer' : ''}`}
            style={annoPos.mode === 'floating' ? { left: annoPos.x, top: annoPos.y } : undefined}
            key={`anno-${sceneIdx}`}>
            <div className="annotation-eye">
              <span>{scene.eyebrow}</span>
            </div>
            <h3 className="annotation-title" ref={annoTitleRef}>
              <SplitWords html={scene.title}/>
            </h3>
            <p className="annotation-body">{scene.body}</p>
            <div className="annotation-foot">
              <span className="tag-dot"/>
              <span>{scene.tag}</span>
            </div>
          </div>
        )}

        {/* focused-index pill (3/5 bottom-right) retiré 2026-05-22 */}

        {countActive && scene.countUp && (
          <div ref={countLayerRef} className="countup-layer" style={{ opacity: 0 }}>
            <div className="countup-num">{countValue.toLocaleString('fr-FR')} €</div>
            <div className="countup-label">{scene.countUp.label}</div>
            <div className="countup-sublabel">{scene.countUp.sublabel}</div>
          </div>
        )}
      </div>

      <div className="demo-bar">
        <div className="demo-bar-fill" ref={barRef}/>
      </div>
    </div>
  );
}

export default DemoLoopCinematic;
