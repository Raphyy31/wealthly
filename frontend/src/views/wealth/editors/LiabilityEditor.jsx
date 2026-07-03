// ============================================================================
// LiabilityEditor — 5-step wizard for liabilities (loans).
// Extracted from Wealth.jsx lines 1031-1234 (LIABILITY_STEPS const + component).
// ============================================================================
import { useState } from 'react';
import { X, Check, ChevronLeft, ChevronRight, Lightbulb, Loader2 } from 'lucide-react';
import { LIABILITY_TYPES } from '../../../constants.js';
import { ChipSelect } from '../../../components/ChipSelect.jsx';
import { Combobox } from '../../../components/Combobox.jsx';
import { ResponsiveModal } from '../../../components/ui/ResponsiveModal.jsx';

const LIABILITY_STEPS = [
  { key: 'main',     label: 'Infos principales' },
  { key: 'specs',    label: 'Caractéristiques' },
  { key: 'duration', label: 'Durée' },
  { key: 'fees',     label: 'Frais & détention' },
  { key: 'linked',   label: 'Actifs liés' },
];

export function LiabilityEditor({ liability, members, assets = [], onSave, onCancel }) {
  const [draft, setDraft] = useState({
    ...liability,
    initialCapital: liability.initialCapital ?? '',
    remainingCapital: liability.remainingCapital ?? '',
    monthlyPayment: liability.monthlyPayment ?? '',
    interestRate: liability.interestRate ?? '',
    downPayment: liability.downPayment ?? '',
    insuranceRate: liability.insuranceRate ?? '',
    applicationFees: liability.applicationFees ?? '',
    ownershipPct: liability.ownershipPct ?? 100,
    durationMonths: liability.durationMonths ?? '',
    startDate: liability.startDate || '',
    linkedAssetId: liability.linkedAssetId || '',
  });
  const [stepIdx, setStepIdx] = useState(0);
  const step = LIABILITY_STEPS[stepIdx].key;

  const set = (k, v) => setDraft({ ...draft, [k]: v });
  const toggleMember = (mid) => {
    const ids = draft.memberIds || [];
    set('memberIds', ids.includes(mid) ? ids.filter(i => i !== mid) : [...ids, mid]);
  };

  const [saving, setSaving] = useState(false);
  const canSave = draft.name && (draft.memberIds || []).length > 0;
  const submit = async () => {
    if (!canSave) { alert('Renseigne au moins un nom et un emprunteur.'); return; }
    if (saving) return;
    setSaving(true);
    try { await onSave(draft); }
    finally { setSaving(false); }
  };

  return (
    <ResponsiveModal open={true} onClose={onCancel}>
        <div className="modal-header">
          <h2>{liability.id ? 'Modifier l\'emprunt' : 'Ajouter un emprunt'}</h2>
          <button className="icon-btn-sm" onClick={onCancel}><X size={16}/></button>
        </div>
        <div className="wizard-body">
          <nav className="wizard-steps">
            {LIABILITY_STEPS.map((s, i) => (
              <button
                key={s.key}
                className={`wizard-step ${i === stepIdx ? 'active' : ''} ${i < stepIdx ? 'done' : ''}`}
                onClick={() => setStepIdx(i)}
              >
                <span className="wizard-step-num">{i + 1}</span>
                <span className="wizard-step-label">{s.label}</span>
              </button>
            ))}
          </nav>
          <div className="wizard-pane">
            {step === 'main' && (
              <>
                <label><span>Nom</span>
                  <input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Emprunt RP, Auto, …" autoFocus/>
                </label>
                <div className="field-row">
                  <label><span>Type</span>
                    <Combobox
                      value={draft.type}
                      onChange={(val) => set('type', val)}
                      options={LIABILITY_TYPES.map(t => ({ value: t.id, label: t.name }))}
                    />
                  </label>
                  <label><span>Devise</span>
                    <ChipSelect
                      value={draft.currency || 'EUR'}
                      onChange={(val) => set('currency', val)}
                      small
                      options={[
                        { value: 'EUR', label: '🇪🇺 EUR' },
                        { value: 'USD', label: '🇺🇸 USD' },
                        { value: 'GBP', label: '🇬🇧 GBP' },
                        { value: 'CHF', label: '🇨🇭 CHF' },
                      ]}
                    />
                  </label>
                </div>
                <div className="field-row">
                  <label><span>Montant emprunté ({draft.currency || 'EUR'})</span>
                    <input type="number" value={draft.initialCapital} onChange={(e) => set('initialCapital', e.target.value)} step="any"/>
                  </label>
                  <label><span>Apport ({draft.currency || 'EUR'}) <em>optionnel</em></span>
                    <input type="number" value={draft.downPayment} onChange={(e) => set('downPayment', e.target.value)} step="any"/>
                  </label>
                </div>
                <label><span>Emprunteurs</span>
                  <div className="member-checks">
                    {members.map(m => (
                      <label key={m.id} className={`member-check ${(draft.memberIds || []).includes(m.id) ? 'active' : ''}`} style={{ borderColor: (draft.memberIds || []).includes(m.id) ? m.color : undefined }}>
                        <input type="checkbox" checked={(draft.memberIds || []).includes(m.id)} onChange={() => toggleMember(m.id)}/>
                        <span className="member-avatar" style={{ background: m.color }}>{m.name.charAt(0).toUpperCase()}</span>
                        <span>{m.name}</span>
                      </label>
                    ))}
                  </div>
                </label>
              </>
            )}

            {step === 'specs' && (
              <>
                <div className="field-row">
                  <label><span>Mensualité totale ({draft.currency || 'EUR'})</span>
                    <input type="number" value={draft.monthlyPayment} onChange={(e) => set('monthlyPayment', e.target.value)} step="any"/>
                  </label>
                  <label><span>Taux d'intérêt (%)</span>
                    <input type="number" value={draft.interestRate} onChange={(e) => set('interestRate', e.target.value)} step="0.01"/>
                  </label>
                </div>
                <label><span>Taux d'assurance (%) <em>optionnel</em></span>
                  <input type="number" value={draft.insuranceRate} onChange={(e) => set('insuranceRate', e.target.value)} step="0.01"/>
                </label>
                <label><span>Capital restant dû ({draft.currency || 'EUR'})</span>
                  <input type="number" value={draft.remainingCapital} onChange={(e) => set('remainingCapital', e.target.value)} step="any"/>
                </label>
              </>
            )}

            {step === 'duration' && (
              <>
                <div className="field-row">
                  <label><span>Date de première échéance</span>
                    <input type="date" value={draft.startDate || ''} onChange={(e) => set('startDate', e.target.value)}/>
                  </label>
                  <label><span>Durée totale (mois)</span>
                    <input type="number" value={draft.durationMonths} onChange={(e) => set('durationMonths', e.target.value)} placeholder="240"/>
                  </label>
                </div>
                <label><span>Date de fin</span>
                  <input type="date" value={draft.endDate || ''} onChange={(e) => set('endDate', e.target.value)}/>
                </label>
                <div className="settings-info">
                  <Lightbulb size={14}/>
                  <span>Vous pouvez soit saisir la durée totale, soit la date de fin. Yotori Finance utilise les deux pour calculer le calendrier d'amortissement.</span>
                </div>
              </>
            )}

            {step === 'fees' && (
              <>
                <div className="field-row">
                  <label><span>Frais de dossier (€) <em>optionnel</em></span>
                    <input type="number" value={draft.applicationFees} onChange={(e) => set('applicationFees', e.target.value)} step="any"/>
                  </label>
                  <label><span>Détention de l'emprunt (%) <em>optionnel</em></span>
                    <input type="number" value={draft.ownershipPct} onChange={(e) => set('ownershipPct', e.target.value)} min="0" max="100" step="0.1"/>
                  </label>
                </div>
                <label><span>Notes</span>
                  <textarea rows={3} value={draft.notes || ''} onChange={(e) => set('notes', e.target.value)}/>
                </label>
              </>
            )}

            {step === 'linked' && (
              <>
                <label><span>Actif lié <em>optionnel</em></span>
                  <Combobox
                    value={draft.linkedAssetId || ''}
                    onChange={(val) => set('linkedAssetId', val)}
                    placeholder="— Aucun —"
                    options={[
                      { value: '', label: '— Aucun —' },
                      ...assets.map(a => ({ value: a.id, label: a.name })),
                    ]}
                  />
                </label>
                <div className="settings-info">
                  <Lightbulb size={14}/>
                  <span>Lier un emprunt à un actif (ex: votre crédit immobilier à votre résidence principale) permet à Yotori Finance de croiser les deux dans vos vues Patrimoine.</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="modal-footer wizard-footer">
          <button className="ds-btn" onClick={onCancel} disabled={saving}>Annuler</button>
          <div style={{ flex: 1 }}/>
          {stepIdx > 0 && <button className="ds-btn" onClick={() => setStepIdx(stepIdx - 1)} disabled={saving}><ChevronLeft size={14}/> Retour</button>}
          {stepIdx < LIABILITY_STEPS.length - 1 ? (
            <button className="ds-btn primary" onClick={() => setStepIdx(stepIdx + 1)}>Suivant <ChevronRight size={14}/></button>
          ) : (
            <button className="ds-btn primary" onClick={submit} disabled={!canSave || saving}>
              {saving ? <><Loader2 size={14} className="spin"/> Enregistrement…</> : <><Check size={14}/> Enregistrer</>}
            </button>
          )}
        </div>
      </ResponsiveModal>
  );
}
