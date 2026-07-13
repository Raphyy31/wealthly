// ============================================================================
// SimpleAssetEditor — generic asset editor modal for non-real-estate assets.
// Extracted from Wealth.jsx lines 627-757.
// ============================================================================
import { useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { ASSET_TYPES } from '../../../constants.js';
import { ChipSelect } from '../../../components/ChipSelect.jsx';
import { Combobox } from '../../../components/Combobox.jsx';
import { ResponsiveModal } from '../../../components/ui/ResponsiveModal.jsx';

export function SimpleAssetEditor({ asset, members, onSave, onCancel }) {
  const [draft, setDraft] = useState(asset);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const handleSave = async () => {
    if (!draft.name?.trim()) { setError('Donnez un nom à cet actif.'); return; }
    if (!draft.memberIds || draft.memberIds.length === 0) { setError('Sélectionnez au moins un propriétaire.'); return; }
    if (saving) return;
    setError(null);
    setSaving(true);
    try { await onSave({ ...draft, updatedAt: new Date().toISOString() }); }
    catch (err) { setError(err?.message || "L'enregistrement a échoué."); }
    finally { setSaving(false); }
  };
  const toggleMember = (mid) => {
    const ids = draft.memberIds || [];
    setDraft({ ...draft, memberIds: ids.includes(mid) ? ids.filter(i => i !== mid) : [...ids, mid] });
  };
  const type = ASSET_TYPES.find(t => t.id === draft.type);
  const isPortfolio = ['stocks', 'pea', 'life_insurance', 'per'].includes(draft.type);
  const portfolioLabel = ({ pea: 'PEA', stocks: 'CTO', life_insurance: 'assurance-vie', per: 'PER' })[draft.type] || 'portefeuille';
  const canSave = Boolean(draft.name?.trim() && (draft.memberIds || []).length > 0);
  const namePlaceholder = draft.type === 'crypto'
    ? 'ex : Bitcoin, Ethereum'
    : isPortfolio
      ? `ex : ${portfolioLabel} Boursorama`
      : 'ex : Livret A, Or 50 g, œuvre…';
  return (
    <ResponsiveModal open={true} onClose={onCancel} className="simple-asset-editor-modal" title={asset.id ? 'Modifier un actif' : 'Ajouter un actif'}>
        <div className="modal-header">
          <div className="wealth-editor-heading">
            <span className="wealth-editor-eyebrow">Patrimoine financier</span>
            <h2>{asset.id ? 'Modifier l’actif' : 'Ajouter un actif'}</h2>
          </div>
          <button className="icon-btn-sm" onClick={onCancel} aria-label="Fermer" title="Fermer"><X size={16}/></button>
        </div>
        <div className="modal-body wealth-simple-editor">
          <div className="wizard-pane-intro">
            <strong>Informations essentielles</strong>
            <span>Vous pourrez compléter le suivi détaillé plus tard.</span>
          </div>
          <div className="field-row">
            <label><span>Type</span>
              <Combobox
                value={draft.type}
                onChange={(val) => setDraft({ ...draft, type: val })}
                options={ASSET_TYPES.map(t => ({ value: t.id, label: t.name, meta: t.description }))}
              />
            </label>
            <label><span>Devise</span>
              <ChipSelect
                value={draft.currency || 'EUR'}
                onChange={(val) => setDraft({ ...draft, currency: val })}
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
          {type && <div className="field-help">{type.description}</div>}
          {isPortfolio && (
            <div className="settings-info" style={{ marginBottom: 4 }}>
              <span>Créez d’abord l’enveloppe {portfolioLabel}. Ensuite, vous pourrez importer le portefeuille complet ou ajouter vos positions une par une.</span>
            </div>
          )}
          <label><span>Nom</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={namePlaceholder}/>
          </label>
          <label><span>Valeur actuelle ({draft.currency || 'EUR'})</span>
            <input
              type="number"
              min="0"
              value={draft.currentValue}
              onChange={(e) => setDraft({ ...draft, currentValue: e.target.value })}
              step="any"
              disabled={!!(draft.ticker && draft.quantity)}
              title={draft.ticker && draft.quantity ? 'Valeur calculée automatiquement à partir du cours live' : ''}
            />
            {draft.ticker && draft.quantity ? (
              <div className="field-help" style={{ color: 'var(--success)', fontWeight: 500 }}>
                ⚡ Valeur calculée en live : {draft.quantity} × cours actuel
              </div>
            ) : null}
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

          <details className="wizard-advanced wealth-asset-advanced">
            <summary>Suivi et informations complémentaires <span>optionnel</span></summary>
            <div className="wizard-advanced-body">
              {/* Le ticker décrit un actif unique, jamais une enveloppe PEA/CTO. */}
              {draft.type === 'crypto' && (
                <div className="wealth-live-tracking">
                  <strong>⚡ Suivi automatique du cours</strong>
                  <div className="field-row">
                    <label><span>Ticker / symbole</span>
                      <input
                        value={draft.ticker || ''}
                        onChange={(e) => setDraft({ ...draft, ticker: e.target.value.toUpperCase() })}
                        placeholder="ex : BTC-EUR"
                      />
                    </label>
                    <label><span>Quantité</span>
                      <input type="number" value={draft.quantity ?? ''} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} placeholder="ex : 0,25" step="any"/>
                    </label>
                  </div>
                  <small>Si les deux champs sont renseignés, la valeur est recalculée depuis le cours disponible.</small>
                </div>
              )}
              <div className="field-row">
                <label><span>{isPortfolio ? 'Total versé' : 'Prix de revient'} ({draft.currency || 'EUR'})</span>
                  <input type="number" value={draft.purchasePrice ?? ''} onChange={(e) => setDraft({ ...draft, purchasePrice: e.target.value })} step="any" placeholder="ex : 12 500"/>
                </label>
                <label><span>Date d'acquisition</span>
                  <input type="date" value={draft.purchaseDate || ''} onChange={(e) => setDraft({ ...draft, purchaseDate: e.target.value })}/>
                </label>
              </div>
              <div className="field-help">Ces informations permettent de calculer la plus-value latente.</div>
              <label><span>Notes</span>
                <textarea value={draft.notes || ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows="2" placeholder="Allocation, support, conditions…"/>
              </label>
            </div>
          </details>
        </div>
        <div className="modal-footer">
          {error && <span className="modal-inline-error">{error}</span>}
          <button className="ds-btn" onClick={onCancel} disabled={saving}>Annuler</button>
          <button className="ds-btn primary" onClick={handleSave} disabled={!canSave || saving} title={!canSave ? 'Ajoutez un nom et au moins un propriétaire' : ''}>
            {saving ? <><Loader2 size={14} className="spin"/> Enregistrement…</> : <><Check size={14}/> Enregistrer</>}
          </button>
        </div>
      </ResponsiveModal>
  );
}
