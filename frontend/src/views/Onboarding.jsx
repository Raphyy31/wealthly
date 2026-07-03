// ============================================================================
// Onboarding — assistant de première installation (5 étapes)
//
//   0. Bienvenue     — pitch + valeur
//   1. Foyer         — membres (adultes / enfants)
//   2. Premier compte— création d'un compte manuel (solde de départ) [skippable]
//   3. Salaire       — décalage salaire fin de mois (jour pivot) — cale la
//                      vue Budget mensuel dès le départ [skippable]
//   4. C'est parti   — import CSV / ajout patrimoine / entrer
//
// Le compte + le réglage salaire sont OPTIONNELS (bouton « Passer ») : on ne
// bloque JAMAIS l'entrée dans l'app. Le réglage salaire est persisté en direct
// (localStorage via useIncomeShift) ; le compte remonte dans le payload de
// onComplete pour création serveur.
// ============================================================================
import { useState } from 'react';
import { ChipSelect } from '../components/ChipSelect.jsx';
import { MagneticButton } from '../components/MagneticButton.jsx';
import {
  Check, Wallet, Repeat, ShieldCheck, X, Plus, Lightbulb,
  ChevronLeft, ChevronRight, Loader2, FileUp, Landmark, ArrowRight,
  CalendarClock, Sparkles,
} from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { MEMBER_PALETTE } from '../constants.js';
import { generateId } from '../utils.js';
import { useIncomeShift } from '../hooks/useIncomeShift.js';

const STEPS = [
  { key: 'welcome', label: 'Bienvenue' },
  { key: 'family',  label: 'Foyer' },
  { key: 'account', label: 'Compte' },
  { key: 'salary',  label: 'Salaire' },
  { key: 'launch',  label: "C'est parti" },
];

// Sous-ensemble des types de compte pertinents pour l'onboarding (le reste se
// gère plus tard via Réglages / Patrimoine). role dérivé pour le cashflow.
const OB_ACCOUNT_TYPES = [
  { value: 'checking',   label: 'Compte courant',   role: 'principal' },
  { value: 'savings',    label: 'Livret / Épargne', role: 'epargne' },
  { value: 'investment', label: 'PEA / CTO / AV',   role: 'investissement' },
  { value: 'joint',      label: 'Compte joint',     role: 'principal' },
];

export function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);

  // ── Foyer ──────────────────────────────────────────────────────────────
  const [members, setMembers] = useState([]);
  const [memberDraft, setMemberDraft] = useState({ name: '', role: 'adult', color: MEMBER_PALETTE[0] });
  const addMember = () => {
    if (!memberDraft.name.trim()) return;
    setMembers([...members, { ...memberDraft, id: generateId(), color: MEMBER_PALETTE[members.length % MEMBER_PALETTE.length] }]);
    setMemberDraft({ name: '', role: 'adult', color: MEMBER_PALETTE[0] });
  };
  const removeMember = (id) => setMembers(members.filter(m => m.id !== id));

  // ── Premier compte ───────────────────────────────────────────────────────
  const [account, setAccount] = useState({ name: '', bank: '', type: 'checking', initialBalance: '', memberIds: [] });
  const setAcc = (patch) => setAccount(a => ({ ...a, ...patch }));
  const toggleAccMember = (id) => setAccount(a => ({
    ...a,
    memberIds: a.memberIds.includes(id) ? a.memberIds.filter(x => x !== id) : [...a.memberIds, id],
  }));
  const accountValid = account.name.trim().length > 0;

  // ── Salaire (décalage fin de mois) — persisté en direct via le hook ──────
  const { settings: incomeShift, update: updateIncomeShift } = useIncomeShift();

  // ── Finalisation ─────────────────────────────────────────────────────────
  const [completing, setCompleting] = useState(null); // null | 'import' | 'wealth' | 'later'
  const finish = async (target) => {
    if (completing) return;
    setCompleting(target || 'later');
    const safeMembers = members.length === 0
      ? [{ id: generateId(), name: 'Moi', role: 'adult', color: MEMBER_PALETTE[0] }]
      : members;
    // Le compte n'est transmis que s'il est valide (nom saisi). Owner par
    // défaut = tous les membres si aucun n'a été coché explicitement.
    const payloadAccount = accountValid ? {
      name: account.name.trim(),
      bank: account.bank.trim(),
      type: account.type,
      role: (OB_ACCOUNT_TYPES.find(t => t.value === account.type) || {}).role || 'principal',
      isJoint: account.type === 'joint',
      initialBalance: parseFloat(String(account.initialBalance).replace(',', '.')) || 0,
      memberIds: account.memberIds.length ? account.memberIds : safeMembers.map(m => m.id),
    } : null;
    try {
      await onComplete({ members: safeMembers, account: payloadAccount }, target);
    } finally {
      setCompleting(null);
    }
  };

  return (
    <div className="onboarding">
      <div className="onboarding-bg-mesh"/>
      <div className="onboarding-card">
        {/* Barre de progression — s'adapte au nombre d'étapes */}
        <div className="onboarding-progress">
          {STEPS.map((s, i) => (
            <div key={s.key} style={{ display: 'contents' }}>
              {i > 0 && <div className="progress-line"/>}
              <div className={`progress-step ${step >= i ? 'active' : ''} ${step > i ? 'done' : ''}`}>
                <div className="progress-dot">{step > i ? <Check size={10}/> : i + 1}</div>
                <span>{s.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Étape 0 : Bienvenue ─────────────────────────────────────── */}
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
            <p className="ob-mini-hint">Configuration en 1 minute — vous pourrez tout modifier ensuite.</p>
          </div>
        )}

        {/* ── Étape 1 : Foyer ─────────────────────────────────────────── */}
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

        {/* ── Étape 2 : Premier compte ────────────────────────────────── */}
        {step === 2 && (
          <div className="onboarding-step-content">
            <h2>Votre <em>premier compte</em>.</h2>
            <p className="onboarding-lead">Créez le compte sur lequel tombe votre salaire — c'est la base de votre budget mensuel. Vous pourrez connecter votre banque (synchro automatique) ou en ajouter d'autres ensuite.</p>

            <div className="ob-account-form">
              <div className="ob-field">
                <label className="form-label">Type de compte</label>
                <ChipSelect
                  value={account.type}
                  onChange={(v) => setAcc({ type: v })}
                  options={OB_ACCOUNT_TYPES.map(t => ({ value: t.value, label: t.label }))}
                />
              </div>

              <div className="ob-field-row">
                <div className="ob-field" style={{ flex: 2 }}>
                  <label className="form-label">Nom du compte *</label>
                  <input
                    className="form-input"
                    placeholder="ex: Compte courant BNP"
                    value={account.name}
                    maxLength={80}
                    onChange={(e) => setAcc({ name: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="ob-field" style={{ flex: 1 }}>
                  <label className="form-label">Solde actuel (€)</label>
                  <input
                    className="form-input num"
                    type="number" step="0.01" inputMode="decimal"
                    placeholder="0,00"
                    value={account.initialBalance}
                    onChange={(e) => setAcc({ initialBalance: e.target.value })}
                  />
                </div>
              </div>

              <div className="ob-field">
                <label className="form-label">Banque <span className="ob-optional">facultatif</span></label>
                <input
                  className="form-input"
                  placeholder="ex: BNP Paribas, Revolut, Boursorama…"
                  value={account.bank}
                  maxLength={80}
                  onChange={(e) => setAcc({ bank: e.target.value })}
                />
              </div>

              {members.length > 1 && (
                <div className="ob-field">
                  <label className="form-label">Titulaire(s)</label>
                  <div className="ob-owner-chips">
                    {members.filter(m => m.role === 'adult').map(m => {
                      const on = account.memberIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={`ob-owner-chip ${on ? 'on' : ''}`}
                          onClick={() => toggleAccMember(m.id)}
                        >
                          <span className="member-avatar sm" style={{ background: m.color }}>{m.name.charAt(0).toUpperCase()}</span>
                          {m.name}
                          {on && <Check size={12}/>}
                        </button>
                      );
                    })}
                  </div>
                  <p className="ob-field-hint">Non coché = compte assigné à tout le foyer.</p>
                </div>
              )}
            </div>

            <div className="onboarding-actions">
              <button className="ds-btn" onClick={() => setStep(1)}><ChevronLeft size={14}/> Retour</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="ob-skip-link" onClick={() => setStep(3)}>Passer</button>
                <button className="ds-btn primary" onClick={() => setStep(3)} disabled={!accountValid}>Suivant <ChevronRight size={14}/></button>
              </div>
            </div>
          </div>
        )}

        {/* ── Étape 3 : Salaire (décalage fin de mois) ────────────────── */}
        {step === 3 && (
          <div className="onboarding-step-content">
            <h2>Quand tombe <em>votre salaire</em> ?</h2>
            <p className="onboarding-lead">
              En France, le salaire est souvent viré <strong>fin du mois</strong> pour financer le mois suivant.
              Yotori Finance peut rattacher ces revenus au bon mois pour que votre budget soit juste dès le départ.
            </p>

            <button
              type="button"
              className={`ob-salary-toggle ${incomeShift.enabled ? 'on' : ''}`}
              onClick={() => updateIncomeShift({ enabled: !incomeShift.enabled })}
            >
              <span className="ob-salary-toggle-ic"><CalendarClock size={18}/></span>
              <span className="ob-salary-toggle-body">
                <span className="ob-salary-toggle-title">
                  Mon salaire tombe en fin de mois
                  {incomeShift.enabled && <span className="ob-salary-badge">activé</span>}
                </span>
                <span className="ob-salary-toggle-sub">
                  {incomeShift.enabled
                    ? <>Revenus reçus le <strong>{incomeShift.pivotDay} du mois</strong> ou après → comptés sur le mois suivant.</>
                    : 'Désactivé — chaque revenu est compté sur son mois civil.'}
                </span>
              </span>
              <span className={`ob-salary-switch ${incomeShift.enabled ? 'on' : ''}`}><span className="ob-salary-knob"/></span>
            </button>

            <div className={`ob-pivot ${incomeShift.enabled ? '' : 'is-off'}`}>
              <div className="ob-pivot-head">
                <span className="ob-pivot-label">À partir de quel jour ?</span>
              </div>
              <div className="ob-pivot-grid">
                {[24, 25, 27, 28, 30, 31].map(day => (
                  <button
                    key={day}
                    type="button"
                    className={`ob-pivot-day ${incomeShift.pivotDay === day ? 'on' : ''}`}
                    onClick={() => updateIncomeShift({ pivotDay: day })}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <p className="ob-pivot-example">
                <Sparkles size={11}/>
                Avec le jour <strong>{incomeShift.pivotDay}</strong>, un salaire viré le 28 avril compte pour <strong>mai</strong>.
              </p>
            </div>

            <div className="onboarding-actions">
              <button className="ds-btn" onClick={() => setStep(2)}><ChevronLeft size={14}/> Retour</button>
              <button className="ds-btn primary" onClick={() => setStep(4)}>Suivant <ChevronRight size={14}/></button>
            </div>
          </div>
        )}

        {/* ── Étape 4 : C'est parti ───────────────────────────────────── */}
        {step === 4 && (
          <div className="onboarding-step-content ob-launch">
            <div className="ready-icon"><Check size={26} strokeWidth={2.4}/></div>
            <h2>Votre espace est <em>prêt</em>.</h2>
            <p className="onboarding-lead">
              {accountValid
                ? <><strong>{account.name.trim()}</strong> est prêt. Remplissez-le avec vos transactions :</>
                : <>Une dernière chose pour voir Yotori Finance prendre vie :</>}
            </p>

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
              <button className="ds-btn" onClick={() => setStep(3)} disabled={!!completing}><ChevronLeft size={14}/> Retour</button>
              <button className="ob-launch-later" onClick={() => finish()} disabled={!!completing}>
                {completing === 'later' ? <><Loader2 size={14} className="spin"/> Entrée…</> : 'Plus tard, entrer dans Yotori Finance'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{ONBOARDING_EXTRA_CSS}</style>
    </div>
  );
}

// CSS additionnel pour les 2 nouvelles étapes (compte + salaire). Reste en
// tokens Forêt — cohérent light/dark, aucune couleur en dur hors alpha.
const ONBOARDING_EXTRA_CSS = `
.ob-mini-hint { margin-top: 14px; font-size: 12px; color: var(--ink-3); text-align: center; }
.ob-optional { font-size: 11px; font-weight: 400; color: var(--ink-3); font-style: italic; margin-left: 4px; }

.ob-account-form { display: flex; flex-direction: column; gap: 14px; margin: 6px 0 4px; text-align: left; }
.ob-field { display: flex; flex-direction: column; gap: 6px; }
.ob-field-row { display: flex; gap: 12px; }
.ob-field-hint { margin: 2px 0 0; font-size: 11.5px; color: var(--ink-3); }

.ob-owner-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.ob-owner-chip {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 6px 12px 6px 6px; border-radius: 999px;
  border: 1px solid var(--border); background: var(--bg-elev);
  font: 500 13px/1 var(--font-sans); color: var(--ink-2); cursor: pointer;
  transition: border-color .15s, color .15s, background .15s;
}
.ob-owner-chip.on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
.ob-owner-chip .member-avatar.sm {
  width: 22px; height: 22px; border-radius: 50%; color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
}

.ob-skip-link {
  background: none; border: none; color: var(--ink-3); cursor: pointer;
  font: 500 13px/1 var(--font-sans); padding: 0 10px; text-decoration: underline;
  text-underline-offset: 3px;
}
.ob-skip-link:hover { color: var(--ink-2); }

/* Toggle salaire */
.ob-salary-toggle {
  display: flex; align-items: center; gap: 14px; width: 100%; text-align: left;
  padding: 16px 18px; border-radius: 14px; cursor: pointer;
  border: 1px solid var(--border); background: var(--bg-sunk);
  transition: background .2s, border-color .2s, box-shadow .28s; margin: 4px 0;
}
.ob-salary-toggle.on {
  border-color: color-mix(in srgb, var(--accent) 32%, transparent);
  background: linear-gradient(135deg, var(--accent-soft) 0%, color-mix(in srgb, var(--accent-soft) 55%, transparent) 100%);
  box-shadow: 0 8px 24px -14px color-mix(in srgb, var(--accent) 40%, transparent);
}
.ob-salary-toggle-ic {
  flex-shrink: 0; width: 38px; height: 38px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: var(--accent-soft); color: var(--accent);
}
.ob-salary-toggle-body { flex: 1; min-width: 0; }
.ob-salary-toggle-title {
  display: flex; align-items: center; gap: 8px;
  font: 600 14px/1.2 var(--font-sans); color: var(--ink);
}
.ob-salary-badge {
  font-size: 9.5px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase;
  color: var(--accent); padding: 2px 6px; border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}
.ob-salary-toggle-sub { display: block; margin-top: 4px; font: 400 12px/1.45 var(--font-sans); color: var(--ink-3); }
.ob-salary-switch {
  flex-shrink: 0; position: relative; width: 46px; height: 26px; border-radius: 13px;
  background: color-mix(in srgb, var(--ink-3) 55%, transparent); transition: background .2s;
}
.ob-salary-switch.on { background: var(--accent); }
.ob-salary-knob {
  position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .2s ease;
}
.ob-salary-switch.on .ob-salary-knob { transform: translateX(20px); }

.ob-pivot { margin-top: 16px; transition: opacity .22s; }
.ob-pivot.is-off { opacity: .45; pointer-events: none; }
.ob-pivot-head { margin-bottom: 10px; }
.ob-pivot-label { font-size: 10px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); }
.ob-pivot-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 7px; }
.ob-pivot-day {
  padding: 12px 4px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--border); background: var(--bg-elev); color: var(--ink-2);
  font: 500 13px/1 'Geist Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums;
  transition: background .16s, border-color .16s, color .16s, box-shadow .2s;
}
.ob-pivot-day.on {
  border-color: var(--accent); color: var(--accent); font-weight: 700;
  background: var(--accent-soft);
  box-shadow: 0 4px 14px -6px color-mix(in srgb, var(--accent) 40%, transparent);
}
.ob-pivot-example {
  margin: 14px 0 0; padding: 10px 12px; border-radius: 8px; font-size: 12px; line-height: 1.5;
  color: var(--ink-3);
  background: color-mix(in srgb, var(--accent-soft) 40%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 16%, transparent);
}
.ob-pivot-example svg { color: var(--accent); vertical-align: -1px; margin-right: 6px; }
`;
