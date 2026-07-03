// ============================================================================
// Onboarding — 3-step wizard shown on first launch (Bienvenue / Famille / Done)
// ============================================================================
import { useState } from 'react';
import { ChipSelect } from '../components/ChipSelect.jsx';
import { MagneticButton } from '../components/MagneticButton.jsx';
import {
  Check, Users, Wallet, Repeat, ShieldCheck, Play, X, Plus, Lightbulb,
  ChevronLeft, ChevronRight, Loader2, FileUp, Landmark, ArrowRight,
} from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { MEMBER_PALETTE } from '../constants.js';
import { generateId } from '../utils.js';

export function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [members, setMembers] = useState([]);
  const [memberDraft, setMemberDraft] = useState({ name: '', role: 'adult', color: MEMBER_PALETTE[0] });

  const addMember = () => {
    if (!memberDraft.name.trim()) return;
    setMembers([...members, { ...memberDraft, id: generateId(), color: MEMBER_PALETTE[members.length % MEMBER_PALETTE.length] }]);
    setMemberDraft({ name: '', role: 'adult', color: MEMBER_PALETTE[0] });
  };
  const removeMember = (id) => setMembers(members.filter(m => m.id !== id));

  const [completing, setCompleting] = useState(null); // null | 'import' | 'wealth' | 'later'
  const finish = async (target) => {
    if (completing) return;
    setCompleting(target || 'later');
    const payload = members.length === 0
      ? { members: [{ id: generateId(), name: 'Moi', role: 'adult', color: MEMBER_PALETTE[0] }] }
      : { members };
    try {
      // target = vue où atterrir après création du foyer (le « moment wow »).
      await onComplete(payload, target);
    } finally {
      setCompleting(null);
    }
  };

  return (
    <div className="onboarding">
      <div className="onboarding-bg-mesh"/>
      <div className="onboarding-card">
        <div className="onboarding-progress">
          <div className={`progress-step ${step >= 0 ? 'active' : ''} ${step > 0 ? 'done' : ''}`}>
            <div className="progress-dot">{step > 0 ? <Check size={10}/> : '1'}</div>
            <span>Bienvenue</span>
          </div>
          <div className="progress-line"/>
          <div className={`progress-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
            <div className="progress-dot">{step > 1 ? <Check size={10}/> : '2'}</div>
            <span>Famille</span>
          </div>
          <div className="progress-line"/>
          <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
            <div className="progress-dot">3</div>
            <span>C'est parti</span>
          </div>
        </div>

        {step === 0 && (
          <div className="onboarding-step-content ob-welcome">
            <div className="ob-welcome-logo"><Logo size={48}/></div>
            <h1>Tout votre argent, <em>au même endroit.</em></h1>
            <p className="onboarding-lead">
              Comptes, placements, immobilier, dépenses — consolidés.
              Et Yotori Finance vous montre <strong>où vous pouvez économiser</strong>.
            </p>
            <div className="ob-value-list">
              <div className="ob-value-row">
                <span className="ob-value-ic"><Wallet size={18}/></span>
                <span>Toutes vos banques en une vue famille</span>
              </div>
              <div className="ob-value-row">
                <span className="ob-value-ic"><Repeat size={18}/></span>
                <span>Vos abonnements traqués, les économies chiffrées</span>
              </div>
              <div className="ob-value-row">
                <span className="ob-value-ic"><ShieldCheck size={18}/></span>
                <span>Privé et sécurisé — vos données restent les vôtres</span>
              </div>
            </div>
            <MagneticButton className="ds-btn primary lg" onClick={() => setStep(1)}>
              Commencer <ArrowRight size={16}/>
            </MagneticButton>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-step-content">
            <h2>Qui compose <em>votre foyer</em> ?</h2>
            <p className="onboarding-lead">Ajoutez chaque personne. Les adultes auront leur propre espace privé, les enfants seront associés à un parent (utile pour leur PEA jeune par exemple).</p>

            {members.length > 0 && (
              <div className="member-preview-list">
                {members.map(m => (
                  <div key={m.id} className="member-preview" style={{ '--member-color': m.color }}>
                    <span className="member-avatar large" style={{ background: m.color }}>{m.name.charAt(0).toUpperCase()}</span>
                    <div className="member-preview-info">
                      <span className="member-preview-name">{m.name}</span>
                      <span className="member-preview-role">{m.role === 'adult' ? 'Adulte' : 'Enfant'}</span>
                    </div>
                    <button className="icon-btn-sm" onClick={() => removeMember(m.id)} aria-label={`Retirer ${m.name}`} title="Retirer"><X size={14}/></button>
                  </div>
                ))}
              </div>
            )}

            <div className="add-member-form">
              <input placeholder="Prénom" value={memberDraft.name} onChange={(e) => setMemberDraft({ ...memberDraft, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addMember()} autoFocus/>
              <ChipSelect
                value={memberDraft.role}
                onChange={(val) => setMemberDraft({ ...memberDraft, role: val })}
                small
                options={[
                  { value: 'adult', label: 'Adulte' },
                  { value: 'child', label: 'Enfant' },
                ]}
              />
              <button className="ds-btn primary" onClick={addMember} aria-label="Ajouter ce membre" title="Ajouter ce membre"><Plus size={14}/></button>
            </div>

            <div className="ob-tip">
              <Lightbulb size={16}/>
              <span><strong>Conseil :</strong> commencez par vous, puis votre conjoint·e si applicable, puis les enfants. Vous pourrez modifier plus tard.</span>
            </div>

            <div className="onboarding-actions">
              <button className="ds-btn" onClick={() => setStep(0)}><ChevronLeft size={14}/> Retour</button>
              <button className="ds-btn primary" onClick={() => setStep(2)} disabled={members.length === 0}>Suivant <ChevronRight size={14}/></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step-content ob-launch">
            <div className="ready-icon"><Check size={26} strokeWidth={2.4}/></div>
            <h2>Votre foyer est <em>prêt</em>.</h2>
            <p className="onboarding-lead">Une dernière chose pour voir Yotori Finance prendre vie :</p>

            <div className="ob-launch-cards">
              <button
                className="ob-launch-card is-primary"
                onClick={() => finish('import')}
                disabled={!!completing}
              >
                <span className="ob-launch-ic primary"><FileUp size={22}/></span>
                <span className="ob-launch-body">
                  <span className="ob-launch-title">
                    Importer un relevé bancaire
                    <span className="ob-launch-badge">recommandé</span>
                  </span>
                  <span className="ob-launch-sub">CSV Revolut, Crédit Agricole, Boursorama… → votre tableau de bord se remplit d'un coup</span>
                </span>
                {completing === 'import' ? <Loader2 size={18} className="spin"/> : <ArrowRight size={18} className="ob-launch-arrow"/>}
              </button>

              <button
                className="ob-launch-card"
                onClick={() => finish('wealth')}
                disabled={!!completing}
              >
                <span className="ob-launch-ic"><Landmark size={22}/></span>
                <span className="ob-launch-body">
                  <span className="ob-launch-title">Ajouter un bien ou un compte</span>
                  <span className="ob-launch-sub">PEA, assurance-vie, immobilier, crypto, prêt…</span>
                </span>
                {completing === 'wealth' ? <Loader2 size={18} className="spin"/> : <ArrowRight size={18} className="ob-launch-arrow"/>}
              </button>
            </div>

            <div className="ob-launch-foot">
              <button className="ds-btn" onClick={() => setStep(1)} disabled={!!completing}><ChevronLeft size={14}/> Retour</button>
              <button className="ob-launch-later" onClick={() => finish()} disabled={!!completing}>
                {completing === 'later' ? <><Loader2 size={14} className="spin"/> Entrée…</> : 'Plus tard, entrer dans Yotori Finance'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
