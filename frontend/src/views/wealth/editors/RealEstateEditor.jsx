// ============================================================================
// RealEstateEditor — essential information first, optional details afterwards.
// Extracted from Wealth.jsx lines 762-1025 (RE_SUBTYPES + RE_STEPS consts + component).
// ============================================================================
import { useState } from 'react';
import { X, Check, ChevronLeft, ChevronRight, Home, CreditCard, Loader2 } from 'lucide-react';
import { Combobox } from '../../../components/Combobox.jsx';
import * as api from '../../../api.js';
import { ResponsiveModal } from '../../../components/ui/ResponsiveModal.jsx';

const RE_SUBTYPES = [
  { key: 'rp',         label: 'Résidence principale' },
  { key: 'secondaire', label: 'Résidence secondaire' },
  { key: 'locative',   label: 'Investissement locatif' },
  { key: 'scpi',       label: 'SCPI' },
  { key: 'other',      label: 'Autre' },
];

const RE_STEPS = [
  { key: 'desc',    label: 'L’essentiel', description: 'Identifiez le bien et sa valeur actuelle' },
  { key: 'details', label: 'Acquisition', description: 'Prix, frais et caractéristiques — facultatif' },
  { key: 'loans',   label: 'Financement', description: 'Rattachez un emprunt — facultatif' },
];

export function RealEstateEditor({ asset, members, liabilities, onSave, onCancel }) {
  const [draft, setDraft] = useState({
    ...asset,
    subtype: asset.subtype === 'RP' ? 'rp' : (asset.subtype || 'rp'),
    address: asset.address || '',
    purchasePrice: asset.purchasePrice ?? '',
    surfaceM2: asset.surfaceM2 ?? '',
    notaryFees: asset.notaryFees ?? '',
    agencyFees: asset.agencyFees ?? '',
    worksFees: asset.worksFees ?? '',
    furnitureFees: asset.furnitureFees ?? '',
    purchaseDate: asset.purchaseDate || '',
    constructionYear: asset.constructionYear ?? '',
    ownershipPct: asset.ownershipPct ?? 100,
    currentValue: asset.currentValue ?? '',
  });
  const [stepIdx, setStepIdx] = useState(0);
  // Liens emprunt ↔ bien gérés localement (optimistic) puis persistés à la sauvegarde
  const [loanLinks, setLoanLinks] = useState(() => {
    const linked = new Set((liabilities || []).filter(l => l.linkedAssetId === asset.id).map(l => l.id));
    return linked;
  });
  const step = RE_STEPS[stepIdx].key;
  const set = (k, v) => setDraft({ ...draft, [k]: v });
  const toggleMember = (mid) => {
    const ids = draft.memberIds || [];
    set('memberIds', ids.includes(mid) ? ids.filter(i => i !== mid) : [...ids, mid]);
  };
  const toggleLoanLink = async (loanId) => {
    const willLink = !loanLinks.has(loanId);
    setLoanLinks(prev => {
      const next = new Set(prev);
      willLink ? next.add(loanId) : next.delete(loanId);
      return next;
    });
    // Si le bien existe déjà, persiste immédiatement
    if (asset.id) {
      await api.liabilities.update(loanId, { linked_asset_id: willLink ? asset.id : null }).catch(() => {});
    }
  };
  const linkedLoans = (liabilities || []).filter(l => loanLinks.has(l.id));
  const availableLoans = (liabilities || []).filter(l => !loanLinks.has(l.id));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const canSave = Boolean(draft.name?.trim() && (draft.memberIds || []).length > 0);
  const submit = async () => {
    if (!canSave) { setError('Ajoutez un nom et au moins un propriétaire.'); return; }
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const saved = await onSave({ ...draft, updatedAt: new Date().toISOString() });
      // Pour un nouveau bien, persiste les liens emprunt maintenant qu'on a l'ID
      const newId = saved?.id || asset.id;
      if (newId && loanLinks.size > 0) {
        await Promise.all(
          [...loanLinks].map(lid => api.liabilities.update(lid, { linked_asset_id: newId }).catch(() => {}))
        );
      }
    } catch (err) {
      setError(err?.message || "L'enregistrement a échoué.");
    } finally { setSaving(false); }
  };

  // Auto-suggest current value when not set (purchase + works + furniture)
  const suggestedValue = (() => {
    const p = parseFloat(draft.purchasePrice) || 0;
    const w = parseFloat(draft.worksFees) || 0;
    const f = parseFloat(draft.furnitureFees) || 0;
    return p + w + f;
  })();

  return (
    <ResponsiveModal open={true} onClose={onCancel} className="modal--wizard real-estate-editor-modal" title={asset.id ? 'Modifier mon immobilier' : 'Ajouter mon immobilier'}>
        <div className="modal-header">
          <div className="wealth-editor-heading">
            <span className="wealth-editor-eyebrow">Immobilier · étape {stepIdx + 1} sur {RE_STEPS.length}</span>
            <h2>{asset.id ? 'Modifier mon immobilier' : 'Ajouter mon immobilier'}</h2>
          </div>
          <button className="icon-btn-sm" onClick={onCancel} aria-label="Fermer" title="Fermer"><X size={16}/></button>
        </div>
        <div className="wizard-body">
          <nav className="wizard-steps">
            {RE_STEPS.map((s, i) => (
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
            <div className="wizard-pane-intro">
              <strong>{RE_STEPS[stepIdx].label}</strong>
              <span>{RE_STEPS[stepIdx].description}</span>
            </div>
            {step === 'desc' && (
              <>
                <label><span>Nom du bien</span>
                  <input autoFocus value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Appartement Paris 11e"/>
                </label>
                <label><span>Valeur actuelle (€) <em>optionnel</em></span>
                  <input type="number" min="0" value={draft.currentValue} onChange={(e) => set('currentValue', e.target.value)} step="any" placeholder="ex : 380 000"/>
                </label>
                <label><span>Adresse <em>optionnel</em></span>
                  <input value={draft.address} onChange={(e) => set('address', e.target.value)} placeholder="58bis Cité Durmar, 75011 Paris"/>
                </label>
                <label><span>Catégorie</span>
                  <Combobox
                    value={draft.subtype}
                    onChange={(val) => set('subtype', val)}
                    options={RE_SUBTYPES.map(s => ({ value: s.key, label: s.label }))}
                  />
                </label>
                <label><span>Propriétaires</span>
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

            {step === 'details' && (
              <>
                <label><span>Prix d'achat hors frais (€) <em>optionnel</em></span>
                  <input type="number" min="0" value={draft.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} step="any"/>
                </label>
                {suggestedValue > 0 && (!draft.currentValue || parseFloat(draft.currentValue) === 0) && (
                  <button type="button" className="ds-btn" style={{ alignSelf: 'flex-start' }} onClick={() => set('currentValue', String(suggestedValue))}>
                    Utiliser {Math.round(suggestedValue).toLocaleString('fr-FR')} € comme valeur actuelle
                  </button>
                )}
                <div className="field-row">
                  <label><span>Surface (m²)</span>
                    <input type="number" min="0" value={draft.surfaceM2} onChange={(e) => set('surfaceM2', e.target.value)} step="0.1"/>
                  </label>
                  <label><span>Détention (%)</span>
                    <input type="number" min={0} max={100} value={draft.ownershipPct} onChange={(e) => set('ownershipPct', e.target.value)} step="0.1"/>
                  </label>
                </div>
                <div className="field-row">
                  <label><span>Frais d'agence (€) <em>optionnel</em></span>
                    <input type="number" min="0" value={draft.agencyFees} onChange={(e) => set('agencyFees', e.target.value)} step="any"/>
                  </label>
                  <label><span>Frais de notaire (€) <em>optionnel</em></span>
                    <input type="number" min="0" value={draft.notaryFees} onChange={(e) => set('notaryFees', e.target.value)} step="any"/>
                  </label>
                </div>
                <div className="field-row">
                  <label><span>Frais de travaux (€) <em>optionnel</em></span>
                    <input type="number" min="0" value={draft.worksFees} onChange={(e) => set('worksFees', e.target.value)} step="any"/>
                  </label>
                  <label><span>Frais d'ameublement (€) <em>optionnel</em></span>
                    <input type="number" min="0" value={draft.furnitureFees} onChange={(e) => set('furnitureFees', e.target.value)} step="any"/>
                  </label>
                </div>
                <div className="field-row">
                  <label><span>Date d'achat <em>optionnel</em></span>
                    <input type="date" value={draft.purchaseDate || ''} onChange={(e) => set('purchaseDate', e.target.value)}/>
                  </label>
                  <label><span>Année de construction <em>optionnel</em></span>
                    <input type="number" min="1000" max="2100" value={draft.constructionYear} onChange={(e) => set('constructionYear', e.target.value)} placeholder="1985"/>
                  </label>
                </div>
                <label><span>Notes <em>optionnel</em></span>
                  <textarea rows={3} value={draft.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="DPE, locataire, copro…"/>
                </label>
              </>
            )}

            {step === 'loans' && (
              <>
                {linkedLoans.length > 0 && (
                  <>
                    <p style={{ color: 'var(--ink-3)', fontSize: 12, marginBottom: 8 }}>Emprunts rattachés à ce bien</p>
                    <div className="liability-list" style={{ marginBottom: 16 }}>
                      {linkedLoans.map(l => (
                        <div key={l.id} className="liability-card-v2" style={{ cursor: 'default' }}>
                          <div className="lia-header">
                            <div className="lia-icon" style={{ background: '#7c2d1222', color: '#7c2d12' }}><Home size={14}/></div>
                            <div className="lia-name-block">
                              <span className="lia-name">{l.name}</span>
                              <span className="lia-type">Restant dû : {Math.round(l.remainingCapital || 0).toLocaleString('fr-FR')} €</span>
                            </div>
                            <button
                              type="button"
                              className="loan-unlink-btn"
                              onClick={() => toggleLoanLink(l.id)}
                              title="Détacher cet emprunt"
                            >
                              <X size={14}/>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {availableLoans.length > 0 ? (
                  <>
                    <p style={{ color: 'var(--ink-3)', fontSize: 12, marginBottom: 8 }}>
                      {linkedLoans.length > 0 ? 'Autres emprunts disponibles' : 'Sélectionne les emprunts à rattacher'}
                    </p>
                    <div className="liability-list">
                      {availableLoans.map(l => (
                        <div key={l.id} className="liability-card-v2 loan-available" style={{ cursor: 'pointer' }} onClick={() => toggleLoanLink(l.id)}>
                          <div className="lia-header">
                            <div className="lia-icon" style={{ background: 'var(--bg-sunk)', color: 'var(--ink-3)' }}><CreditCard size={14}/></div>
                            <div className="lia-name-block">
                              <span className="lia-name">{l.name}</span>
                              <span className="lia-type">Restant dû : {Math.round(l.remainingCapital || 0).toLocaleString('fr-FR')} €</span>
                            </div>
                            <span className="loan-link-btn">+ Lier</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : linkedLoans.length === 0 ? (
                  <div className="empty-mini" style={{ padding: '32px 0' }}>
                    <CreditCard size={24}/>
                    <p>Aucun emprunt disponible.<br/>Ajoute un emprunt depuis Patrimoine → Emprunts.</p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
        <div className="modal-footer wizard-footer">
          <button className="ds-btn" onClick={onCancel} disabled={saving}>Annuler</button>
          {error && <span className="modal-inline-error">{error}</span>}
          <div style={{ flex: 1 }}/>
          {stepIdx > 0 && <button className="ds-btn" onClick={() => setStepIdx(stepIdx - 1)} disabled={saving}><ChevronLeft size={14}/> Retour</button>}
          {stepIdx < RE_STEPS.length - 1 ? (
            <button className="ds-btn" onClick={() => setStepIdx(stepIdx + 1)} disabled={stepIdx === 0 && !canSave} title={stepIdx === 0 && !canSave ? 'Ajoutez un nom et au moins un propriétaire' : ''}>
              {stepIdx === 0 ? 'Ajouter des détails' : 'Voir le financement'} <ChevronRight size={14}/>
            </button>
          ) : null}
          <button className="ds-btn primary" onClick={submit} disabled={!canSave || saving}>
            {saving ? <><Loader2 size={14} className="spin"/> Enregistrement…</> : <><Check size={14}/> {asset.id ? 'Enregistrer' : 'Créer le bien'}</>}
          </button>
        </div>
      </ResponsiveModal>
  );
}
