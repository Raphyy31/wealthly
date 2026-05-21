// Source: Settings.jsx lines 284-330 — FoyerSection
import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus, Edit3, CalendarClock, Sparkles } from 'lucide-react';
import { BusyButton } from '../../../components/ui/BusyButton.jsx';
import { Trash2 } from 'lucide-react';
import { useIncomeShift } from '../../../hooks/useIncomeShift.js';
import { gsap } from '../../../utils/gsapSetup.js';

export function FoyerSection({ members, setEditingMember, deleteMember, COLORS }) {
  const { t } = useTranslation();
  const { settings: incomeShift, update: updateIncomeShift } = useIncomeShift();
  return (
    <section className="settings-panel">
      <header>
        <h2>{t('settings.household.title')} <em>{t('settings.household.titleAccent')}</em></h2>
        <p className="settings-panel-intro">
          {t('settings.household.intro')}
        </p>
      </header>

      <div className="card">
        <div className="card-header">
          <h3>
            <Users size={16} style={{ color: 'var(--accent)' }}/>
            {t('settings.household.members')}
          </h3>
          <button
            className="ds-btn"
            onClick={() => setEditingMember({ id: null, name: '', role: 'adult', color: COLORS[members.length % COLORS.length] })}
          >
            <Plus size={14}/> {t('actions.add')}
          </button>
        </div>
        <div className="member-list">
          {members.length === 0 && (
            <div className="empty-mini">
              <Users size={24}/>
              <p>{t('settings.household.emptyMembers')}</p>
            </div>
          )}
          {members.map(m => (
            <div key={m.id} className="member-card">
              <span className="member-avatar large" style={{ background: m.color }}>{m.name.charAt(0).toUpperCase()}</span>
              <div className="member-card-info">
                <div className="member-card-name">{m.name}</div>
                <div className="member-card-role">{m.role === 'adult' ? t('settings.household.adult') : t('settings.household.child')}</div>
              </div>
              <button className="icon-btn-sm" onClick={() => setEditingMember(m)}><Edit3 size={13}/></button>
              <BusyButton className="icon-btn-sm" iconOnly spinnerSize={13} onClick={() => deleteMember(m.id)} title="Supprimer ce membre"><Trash2 size={13}/></BusyButton>
            </div>
          ))}
        </div>
      </div>

      {/* Réglage décalage salaire — cas français standard : virement du 28-30
          avril finance le budget de mai. Sans shift, Monthly mai = 0 entrées. */}
      <IncomeShiftCard incomeShift={incomeShift} updateIncomeShift={updateIncomeShift}/>
    </section>
  );
}

// ── IncomeShiftCard ──────────────────────────────────────────────────────────
// Réglage "décalage salaire fin de mois" extrait en composant dedie pour
// pouvoir y attacher des refs GSAP propres (handle toggle + pop on pivot
// day select). Premium feel : drop shadows, gradients soft, GSAP timing.
function IncomeShiftCard({ incomeShift, updateIncomeShift }) {
  const handleRef = useRef(null);
  const trackRef = useRef(null);
  const dayBtnRefs = useRef({});
  const exampleRef = useRef(null);

  // Animation du toggle : handle slide + scale-pulse pendant la transition.
  // Plus naturel qu'une CSS transition lineaire — GSAP avec back.out donne
  // un micro "settle" au handle, signe d'une interface premium.
  useEffect(() => {
    if (!handleRef.current || !trackRef.current) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(handleRef.current, { x: incomeShift.enabled ? 22 : 0 });
      return;
    }
    const tl = gsap.timeline();
    tl.to(handleRef.current, {
      x: incomeShift.enabled ? 22 : 0,
      scale: 0.85,
      duration: 0.18,
      ease: 'power2.in',
    }).to(handleRef.current, {
      scale: 1,
      duration: 0.32,
      ease: 'back.out(2)',
    });
    return () => tl.kill();
  }, [incomeShift.enabled]);

  // Pop animation sur le bouton jour pivot selectionne (scale 1 -> 1.08 -> 1).
  // Animation declenchee a chaque changement de pivotDay.
  useEffect(() => {
    const el = dayBtnRefs.current[incomeShift.pivotDay];
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(el,
      { scale: 0.92 },
      { scale: 1, duration: 0.45, ease: 'back.out(2.5)', clearProps: 'transform' }
    );
  }, [incomeShift.pivotDay]);

  // Fade subtil sur la phrase d'exemple quand le pivot change.
  useEffect(() => {
    if (!exampleRef.current) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(exampleRef.current,
      { opacity: 0.4 },
      { opacity: 1, duration: 0.45, ease: 'expo.out' }
    );
  }, [incomeShift.pivotDay]);

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-header">
        <h3>
          <CalendarClock size={16} style={{ color: 'var(--accent)' }}/>
          Décalage salaire fin de mois
        </h3>
        <span className="card-meta">
          <Sparkles size={11} style={{ display: 'inline-block', marginRight: 4, verticalAlign: '-1px' }}/>
          Cas standard FR
        </span>
      </div>

      <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, margin: 0 }}>
          En France, le salaire est généralement viré <strong style={{ color: 'var(--ink)' }}>fin du mois M-1</strong> pour
          financer le mois M. Active cette option pour que les revenus reçus à partir d'un jour pivot soient
          comptabilisés sur le mois suivant.
        </p>

        {/* ── Toggle premium ──────────────────────────────────────── */}
        <div
          onClick={() => updateIncomeShift({ enabled: !incomeShift.enabled })}
          style={{
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 18px',
            borderRadius: 12,
            background: incomeShift.enabled
              ? 'linear-gradient(135deg, var(--accent-soft) 0%, color-mix(in srgb, var(--accent-soft) 60%, transparent) 100%)'
              : 'var(--bg-sunk)',
            border: '1px solid ' + (incomeShift.enabled
              ? 'color-mix(in srgb, var(--accent) 32%, transparent)'
              : 'var(--border)'),
            boxShadow: incomeShift.enabled
              ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px color-mix(in srgb, var(--accent) 35%, transparent)'
              : '0 1px 0 rgba(255,255,255,0.02) inset',
            transition: 'background 220ms ease, border-color 220ms ease, box-shadow 280ms ease',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13.5, fontWeight: 600, color: 'var(--ink)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              Décalage automatique
              {incomeShift.enabled && (
                <span style={{
                  fontSize: 9.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: 'var(--accent)', padding: '2px 6px', borderRadius: 4,
                  background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
                }}>actif</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.4 }}>
              {incomeShift.enabled
                ? <>Revenus reçus le <strong style={{ color: 'var(--ink-2)' }}>{incomeShift.pivotDay} du mois</strong> ou après <span style={{ color: 'var(--accent)' }}>→</span> mois suivant</>
                : 'Désactivé — chaque transaction est attribuée à son mois civil'}
            </div>
          </div>

          {/* Toggle iOS-style — GSAP-animated handle */}
          <div
            ref={trackRef}
            role="switch"
            aria-checked={incomeShift.enabled}
            style={{
              position: 'relative', width: 46, height: 26, borderRadius: 13,
              background: incomeShift.enabled
                ? 'var(--accent)'
                : 'color-mix(in srgb, var(--ink-3) 55%, transparent)',
              border: 'none', flexShrink: 0,
              transition: 'background 200ms ease',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.18)',
              marginLeft: 14,
            }}
          >
            <span
              ref={handleRef}
              style={{
                position: 'absolute', top: 2, left: 2,
                width: 22, height: 22, borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.04)',
              }}
            />
          </div>
        </div>

        {/* ── Picker jour pivot ─────────────────────────────────── */}
        <div style={{
          opacity: incomeShift.enabled ? 1 : 0.45,
          pointerEvents: incomeShift.enabled ? 'auto' : 'none',
          transition: 'opacity 220ms ease',
        }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'var(--ink-3)',
            }}>
              Jour pivot
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>
              à partir de ce jour, le revenu glisse au mois suivant
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 7 }}>
            {[20, 22, 25, 27, 28, 30, 31].map(day => {
              const active = incomeShift.pivotDay === day;
              return (
                <button
                  key={day}
                  type="button"
                  ref={el => { dayBtnRefs.current[day] = el; }}
                  onClick={() => updateIncomeShift({ pivotDay: day })}
                  style={{
                    padding: '12px 4px', borderRadius: 8,
                    border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
                    background: active
                      ? 'linear-gradient(180deg, color-mix(in srgb, var(--accent-soft) 80%, transparent) 0%, var(--accent-soft) 100%)'
                      : 'var(--bg-elev)',
                    color: active ? 'var(--accent)' : 'var(--ink-2)',
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    cursor: 'pointer', fontVariantNumeric: 'tabular-nums',
                    fontFamily: 'Geist Mono, ui-monospace, Menlo, monospace',
                    letterSpacing: '0.02em',
                    transition: 'background 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 200ms ease',
                    boxShadow: active
                      ? '0 4px 14px -6px color-mix(in srgb, var(--accent) 40%, transparent), 0 1px 0 rgba(255,255,255,0.06) inset'
                      : '0 1px 0 rgba(255,255,255,0.02) inset',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover, color-mix(in srgb, var(--ink-3) 6%, var(--bg-elev)))'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'var(--bg-elev)'; }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Exemple dynamique — fade GSAP a chaque changement de pivot */}
          <p
            ref={exampleRef}
            style={{
              fontSize: 12, color: 'var(--ink-3)', marginTop: 14, marginBottom: 0,
              padding: '10px 12px', borderRadius: 8,
              background: 'color-mix(in srgb, var(--accent-soft) 40%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent) 16%, transparent)',
              lineHeight: 1.5,
            }}
          >
            <Sparkles size={11} style={{
              display: 'inline-block', marginRight: 6, verticalAlign: '-1px',
              color: 'var(--accent)',
            }}/>
            Avec pivot <strong style={{ color: 'var(--accent)' }}>{incomeShift.pivotDay}</strong>,
            un salaire viré le 28 avril sera attribué à <strong style={{ color: 'var(--ink-2)' }}>mai</strong> dans
            Budget mensuel et Dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
