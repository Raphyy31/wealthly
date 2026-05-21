// Source: Settings.jsx lines 284-330 — FoyerSection
import { useTranslation } from 'react-i18next';
import { Users, Plus, Edit3, CalendarClock } from 'lucide-react';
import { BusyButton } from '../../../components/ui/BusyButton.jsx';
import { Trash2 } from 'lucide-react';
import { useIncomeShift } from '../../../hooks/useIncomeShift.js';

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
          <h3><Users size={16}/> {t('settings.household.members')}</h3>
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
      <div className="card">
        <div className="card-header">
          <h3><CalendarClock size={16}/> Décalage salaire fin de mois</h3>
        </div>
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
            En France, le salaire est généralement viré <strong>fin du mois M-1</strong> pour financer le mois M.
            Active cette option pour que les revenus reçus à partir d'un jour pivot soient comptabilisés sur le mois suivant.
          </p>

          {/* Toggle on/off — iOS-style */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderRadius: 8,
            background: incomeShift.enabled ? 'var(--accent-soft)' : 'var(--bg-sunk)',
            border: '1px solid ' + (incomeShift.enabled ? 'color-mix(in srgb, var(--accent) 28%, transparent)' : 'var(--border)'),
            transition: 'all 160ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>Activer le décalage automatique</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                {incomeShift.enabled
                  ? `Revenus reçus le ${incomeShift.pivotDay} du mois ou après → comptés sur le mois suivant`
                  : 'Désactivé — chaque transaction est attribuée à son mois civil'}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={incomeShift.enabled}
              onClick={() => updateIncomeShift({ enabled: !incomeShift.enabled })}
              style={{
                position: 'relative', width: 42, height: 24, borderRadius: 12,
                background: incomeShift.enabled ? 'var(--accent)' : 'var(--ink-3)',
                border: 'none', cursor: 'pointer', flexShrink: 0,
                transition: 'background 180ms ease',
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: incomeShift.enabled ? 20 : 2,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}/>
            </button>
          </div>

          {/* Picker jour pivot — disabled si shift off */}
          <div style={{ opacity: incomeShift.enabled ? 1 : 0.5, pointerEvents: incomeShift.enabled ? 'auto' : 'none', transition: 'opacity 160ms' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>
              Jour pivot
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {[20, 22, 25, 27, 28, 30, 31].map(day => {
                const active = incomeShift.pivotDay === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => updateIncomeShift({ pivotDay: day })}
                    style={{
                      padding: '10px 4px', borderRadius: 6,
                      border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
                      background: active ? 'var(--accent-soft)' : 'var(--bg-elev)',
                      color: active ? 'var(--accent)' : 'var(--ink-2)',
                      fontSize: 12, fontWeight: active ? 600 : 500, cursor: 'pointer',
                      fontVariantNumeric: 'tabular-nums', transition: 'all 140ms',
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8, fontStyle: 'italic' }}>
              Exemple : avec jour pivot {incomeShift.pivotDay}, un salaire viré le 28 avril sera attribué à <strong>mai</strong> dans Budget mensuel et Dashboard.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
