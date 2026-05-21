// PremiumToggle — toggle iOS-style premium avec animation GSAP
//
// Pattern utilisé sur toute l'app (Settings, modales DCA, etc.) pour assurer
// une cohérence visuelle. Track avec inner-shadow, handle avec drop-shadow,
// animation timeline en 2 phases (compress -> back.out settle) pour un
// micro-bounce signature.
//
// Usage simple :
//   <PremiumToggle checked={enabled} onChange={setEnabled}/>
//
// Usage card (avec label + description + badge "actif" automatique) :
//   <ToggleCard
//     checked={enabled}
//     onChange={setEnabled}
//     title="Rappel email"
//     description="Envoyé 2j avant chaque versement"
//   />
import { useRef, useEffect } from 'react';
import { gsap } from '../../utils/gsapSetup.js';

export function PremiumToggle({ checked, onChange, size = 'md', disabled }) {
  const handleRef = useRef(null);
  const dims = size === 'sm'
    ? { trackW: 36, trackH: 20, handleSize: 16, slide: 16 }
    : { trackW: 46, trackH: 26, handleSize: 22, slide: 22 };

  useEffect(() => {
    if (!handleRef.current) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(handleRef.current, { x: checked ? dims.slide : 0 });
      return;
    }
    const tl = gsap.timeline();
    tl.to(handleRef.current, {
      x: checked ? dims.slide : 0,
      scale: 0.85,
      duration: 0.18,
      ease: 'power2.in',
    }).to(handleRef.current, {
      scale: 1,
      duration: 0.32,
      ease: 'back.out(2)',
    });
    return () => tl.kill();
  }, [checked, dims.slide]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      style={{
        position: 'relative',
        width: dims.trackW,
        height: dims.trackH,
        borderRadius: dims.trackH / 2,
        background: checked
          ? 'var(--accent)'
          : 'color-mix(in srgb, var(--ink-3) 55%, transparent)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
        transition: 'background 200ms ease',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.18)',
        padding: 0,
      }}
    >
      <span
        ref={handleRef}
        style={{
          position: 'absolute',
          top: (dims.trackH - dims.handleSize) / 2,
          left: (dims.trackH - dims.handleSize) / 2,
          width: dims.handleSize,
          height: dims.handleSize,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.04)',
        }}
      />
    </button>
  );
}

// ToggleCard — toggle inline dans une carte avec titre + description + badge
// "actif" automatique. Style premium : gradient cobalt-soft quand on, halo,
// drop-shadow exterieure.
export function ToggleCard({ checked, onChange, title, description, icon, disabled }) {
  return (
    <div
      onClick={() => !disabled && onChange?.(!checked)}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px', borderRadius: 12,
        background: checked
          ? 'linear-gradient(135deg, var(--accent-soft) 0%, color-mix(in srgb, var(--accent-soft) 60%, transparent) 100%)'
          : 'var(--bg-sunk)',
        border: '1px solid ' + (checked
          ? 'color-mix(in srgb, var(--accent) 32%, transparent)'
          : 'var(--border)'),
        boxShadow: checked
          ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px color-mix(in srgb, var(--accent) 35%, transparent)'
          : '0 1px 0 rgba(255,255,255,0.02) inset',
        transition: 'background 220ms ease, border-color 220ms ease, box-shadow 280ms ease',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: 'var(--ink)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {icon}
          {title}
          {checked && (
            <span style={{
              fontSize: 9.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--accent)', padding: '2px 6px', borderRadius: 4,
              background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
            }}>actif</span>
          )}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.4 }}>
            {description}
          </div>
        )}
      </div>
      <div style={{ marginLeft: 14 }} onClick={e => e.stopPropagation()}>
        <PremiumToggle checked={checked} onChange={onChange} disabled={disabled}/>
      </div>
    </div>
  );
}

// ChoiceGrid — grid de boutons à choix unique (jour pivot, intervalle, etc.)
// Active button : gradient + halo cobalt + scale-pop GSAP au mount/change.
// Inactive : hover bg fade. Font Geist Mono pour les chiffres.
export function ChoiceGrid({ value, onChange, options, columns = 7, disabled, mono = false }) {
  const refs = useRef({});

  useEffect(() => {
    const el = refs.current[value];
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(el,
      { scale: 0.92 },
      { scale: 1, duration: 0.45, ease: 'back.out(2.5)', clearProps: 'transform' }
    );
  }, [value]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: 7,
      opacity: disabled ? 0.45 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
      transition: 'opacity 220ms ease',
    }}>
      {options.map(opt => {
        const optValue = typeof opt === 'object' ? opt.value : opt;
        const optLabel = typeof opt === 'object' ? opt.label : opt;
        const active = value === optValue;
        return (
          <button
            key={optValue}
            type="button"
            ref={el => { refs.current[optValue] = el; }}
            onClick={() => onChange?.(optValue)}
            style={{
              padding: '12px 4px', borderRadius: 8,
              border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
              background: active
                ? 'linear-gradient(180deg, color-mix(in srgb, var(--accent-soft) 80%, transparent) 0%, var(--accent-soft) 100%)'
                : 'var(--bg-elev)',
              color: active ? 'var(--accent)' : 'var(--ink-2)',
              fontSize: 13, fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: mono ? 'Geist Mono, ui-monospace, Menlo, monospace' : 'inherit',
              letterSpacing: mono ? '0.02em' : 'normal',
              transition: 'background 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 200ms ease',
              boxShadow: active
                ? '0 4px 14px -6px color-mix(in srgb, var(--accent) 40%, transparent), 0 1px 0 rgba(255,255,255,0.06) inset'
                : '0 1px 0 rgba(255,255,255,0.02) inset',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'color-mix(in srgb, var(--ink-3) 6%, var(--bg-elev))'; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'var(--bg-elev)'; }}
          >
            {optLabel}
          </button>
        );
      })}
    </div>
  );
}
