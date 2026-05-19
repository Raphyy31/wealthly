// Source: Settings.jsx lines 284-330 — FoyerSection
import { useTranslation } from 'react-i18next';
import { Users, Plus, Edit3 } from 'lucide-react';
import { BusyButton } from '../../../components/ui/BusyButton.jsx';
import { Trash2 } from 'lucide-react';

export function FoyerSection({ members, setEditingMember, deleteMember, COLORS }) {
  const { t } = useTranslation();
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
            className="secondary-btn"
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
    </section>
  );
}
