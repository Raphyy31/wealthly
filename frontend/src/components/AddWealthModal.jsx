// frontend/src/components/AddWealthModal.jsx
//
// Wizard "+ Ajouter à votre patrimoine" — 3 étapes :
//   1. category   (grille 2×3)
//   2. detail     (sous-catégorie + mode synced/manuel)
//   3. form       (formulaire manuel) OU onConnectBank (synced path)
//
// L'API consommée est api.wealth.create(payload) — voir api.js.

import { useState } from 'react';
import {
  X, ChevronLeft, Plus, Wallet, TrendingUp, Home, Bitcoin,
  Sparkles, CreditCard, Cloud, Edit3,
} from 'lucide-react';
import { CATEGORY_LABELS } from '../types/wealth.js';

const CATEGORIES = [
  { key: 'liquidites',      label: CATEGORY_LABELS.liquidites,      desc: 'Compte courant, Livret A, LDDS, cash',  icon: Wallet },
  { key: 'investissements', label: CATEGORY_LABELS.investissements, desc: 'PEA, CTO, Assurance-vie, PER',          icon: TrendingUp },
  { key: 'immobilier',      label: CATEGORY_LABELS.immobilier,      desc: 'Résidence, locatif, SCPI',              icon: Home },
  { key: 'cryptos',         label: CATEGORY_LABELS.cryptos,         desc: 'BTC, ETH, exchanges',                   icon: Bitcoin },
  { key: 'autres',          label: CATEGORY_LABELS.autres,          desc: 'Or, montres, collectibles',             icon: Sparkles },
  { key: 'emprunts',        label: CATEGORY_LABELS.emprunts,        desc: 'Prêt immo, conso, auto',                icon: CreditCard },
];

const SUBTYPES_BY_CATEGORY = {
  liquidites: [
    { key: 'compte_courant', label: 'Compte courant' },
    { key: 'livret',         label: 'Livret (A, LDDS, LEP)' },
    { key: 'cash',           label: 'Espèces' },
  ],
  investissements: [
    { key: 'pea', label: 'PEA' },
    { key: 'cto', label: 'Compte-titres' },
    { key: 'av',  label: 'Assurance-vie' },
    { key: 'per', label: 'PER' },
  ],
  immobilier: [
    { key: 'rp',      label: 'Résidence principale' },
    { key: 'locatif', label: 'Locatif' },
    { key: 'scpi',    label: 'SCPI' },
  ],
  cryptos: [
    { key: 'crypto', label: 'Crypto-monnaie' },
  ],
  autres: [
    { key: 'or',    label: 'Or / Métaux' },
    { key: 'autre', label: 'Autre actif' },
  ],
  emprunts: [
    { key: 'mortgage',      label: 'Prêt immobilier' },
    { key: 'consumer_loan', label: 'Crédit conso' },
    { key: 'auto_loan',     label: 'Prêt auto' },
    { key: 'other_loan',    label: 'Autre' },
  ],
};

// Subtypes qui supportent la synchronisation bancaire via GoCardless
const SYNCABLE_SUBTYPES = ['compte_courant', 'pea', 'cto', 'av'];

export function AddWealthModal({ members = [], assets = [], onSave, onClose, onConnectBank }) {
  const [step, setStep] = useState('category');
  const [category, setCategory] = useState(null);
  const [subtype, setSubtype] = useState(null);
  const [syncMode, setSyncMode] = useState(null);
  const [form, setForm] = useState({
    name: '',
    currency: 'EUR',
    memberIds: [],
    value: '',
    // Loan-specific fields (only used when category === 'emprunts')
    initialCapital: '',
    remainingCapital: '',
    monthlyPayment: '',
    interestRate: '',
    durationMonths: '',
    startDate: '',
    downPayment: '',
    insuranceRate: '',
    applicationFees: '',
    ownershipPct: 100,
    linkedAssetId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const goCategory = () => { setStep('category'); setCategory(null); setSubtype(null); setSyncMode(null); };
  const goDetail   = () => { setStep('detail');   setSubtype(null); setSyncMode(null); };

  const pickCategory = (key) => {
    setCategory(key);
    setSubtype(null);
    setSyncMode(null);
    // If only one subtype OR not syncable, skip mode choice prepopulation
    setStep('detail');
  };

  const continueFromDetail = () => {
    if (!subtype) return;
    if (SYNCABLE_SUBTYPES.includes(subtype) && !syncMode) return;
    if (syncMode === 'synced') {
      onConnectBank && onConnectBank({ category, subtype });
      return;
    }
    setStep('form');
  };

  const isLoan = category === 'emprunts';

  const submit = async () => {
    setSubmitError(null);
    if (!form.name.trim()) {
      setSubmitError('Donne un nom à cet élément.');
      return;
    }
    if (!form.memberIds.length) {
      setSubmitError('Sélectionne au moins un détenteur.');
      return;
    }
    if (isLoan && !form.initialCapital) {
      setSubmitError('Renseigne le capital initial emprunté.');
      return;
    }
    setSubmitting(true);
    try {
      const basePayload = {
        category,
        subtype,
        syncMode: 'manual',
        name: form.name.trim(),
        currency: form.currency,
        memberIds: form.memberIds,
      };
      const payload = isLoan
        ? {
            ...basePayload,
            // value sert de fallback pour le capital restant si non précisé
            value: parseFloat(form.remainingCapital) || parseFloat(form.initialCapital) || 0,
            initialCapital: parseFloat(form.initialCapital) || 0,
            remainingCapital: parseFloat(form.remainingCapital) || parseFloat(form.initialCapital) || 0,
            monthlyPayment: parseFloat(form.monthlyPayment) || 0,
            interestRate: parseFloat(form.interestRate) || 0,
            durationMonths: form.durationMonths ? parseInt(form.durationMonths, 10) : null,
            startDate: form.startDate || null,
            downPayment: form.downPayment ? parseFloat(form.downPayment) : null,
            insuranceRate: form.insuranceRate ? parseFloat(form.insuranceRate) : null,
            applicationFees: form.applicationFees ? parseFloat(form.applicationFees) : null,
            ownershipPct: parseFloat(form.ownershipPct) || 100,
            linkedAssetId: form.linkedAssetId || null,
          }
        : {
            ...basePayload,
            value: parseFloat(form.value) || 0,
          };
      await onSave(payload);
    } catch (err) {
      // Si l'erreur n'est pas attrapée plus haut, on la montre ici plutôt
      // que de laisser l'utilisateur cliquer dans le vide.
      setSubmitError(err?.message || 'Création impossible. Réessaie.');
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitle =
    step === 'category' ? <>Ajouter à votre <em>patrimoine.</em></> :
    step === 'detail'   ? <>{CATEGORY_LABELS[category]}</> :
                          <>Mon <em>{subtype ? subtype.toUpperCase() : 'élément'}.</em></>;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          {step !== 'category' && (
            <button className="icon-btn" onClick={step === 'form' ? goDetail : goCategory} title="Retour">
              <ChevronLeft size={18}/>
            </button>
          )}
          <h2 style={{ flex: 1, margin: 0, fontSize: 15, fontWeight: 600 }}>{stepTitle}</h2>
          <button className="icon-btn" onClick={onClose} title="Fermer"><X size={18}/></button>
        </div>

        {step === 'category' && (
          <div className="modal-body">
            <p className="modal-eyebrow">Quel type d'élément ?</p>
            <div className="cat-grid">
              {CATEGORIES.map(c => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.key}
                    className={`cat-card ${category === c.key ? 'selected' : ''}`}
                    onClick={() => pickCategory(c.key)}
                    type="button"
                  >
                    <span className="cat-card-ic"><Icon size={16}/></span>
                    <span className="cat-card-name">{c.label}</span>
                    <span className="cat-card-desc">{c.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 'detail' && (
          <div className="modal-body">
            <p className="modal-eyebrow">Quelle enveloppe ?</p>
            <div className="subcat-list">
              {(SUBTYPES_BY_CATEGORY[category] || []).map(s => (
                <button
                  key={s.key}
                  className={`subcat-chip ${subtype === s.key ? 'selected' : ''}`}
                  onClick={() => { setSubtype(s.key); setSyncMode(null); }}
                  type="button"
                >
                  {s.label}
                </button>
              ))}
            </div>

            {subtype && SYNCABLE_SUBTYPES.includes(subtype) && (
              <>
                <p className="modal-eyebrow" style={{ marginTop: 18 }}>Comment l'ajouter ?</p>
                <div className="mode-pick">
                  <button
                    className={`mode-row ${syncMode === 'synced' ? 'selected' : ''}`}
                    onClick={() => setSyncMode('synced')}
                    type="button"
                  >
                    <span className="mode-ic"><Cloud size={18}/></span>
                    <div>
                      <div className="mode-title">Synchroniser via ma banque</div>
                      <div className="mode-sub">Connexion PSD2 sécurisée — solde, positions et transactions automatiques.</div>
                    </div>
                  </button>
                  <button
                    className={`mode-row ${syncMode === 'manual' ? 'selected' : ''}`}
                    onClick={() => setSyncMode('manual')}
                    type="button"
                  >
                    <span className="mode-ic"><Edit3 size={18}/></span>
                    <div>
                      <div className="mode-title">Saisir manuellement</div>
                      <div className="mode-sub">Nom de l'enveloppe + valeur, puis positions à la main.</div>
                    </div>
                  </button>
                </div>
              </>
            )}

            <div className="modal-foot">
              <button className="secondary-btn" onClick={goCategory} type="button">Retour</button>
              <button
                className="primary-btn"
                disabled={!subtype || (SYNCABLE_SUBTYPES.includes(subtype) && !syncMode)}
                onClick={continueFromDetail}
                type="button"
              >
                Continuer
              </button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="modal-body">
            <div className="form-row">
              <label className="form-label">Nom de l'élément</label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder={
                  subtype === 'pea' ? 'PEA Boursorama' :
                  subtype === 'av'  ? 'AV Linxea Spirit' :
                  subtype === 'rp'  ? 'Résidence principale Paris' :
                  'Nom'
                }
                autoFocus
              />
            </div>

            <div className="form-row">
              <label className="form-label">Devise</label>
              <select className="form-input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
              </select>
            </div>

            {!isLoan && (
              <div className="form-row">
                <label className="form-label">Valeur actuelle</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  value={form.value}
                  onChange={e => setForm({ ...form, value: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            )}

            {isLoan && (
              <>
                <div className="form-row-2col">
                  <div className="form-row">
                    <label className="form-label">Capital initial emprunté</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={form.initialCapital}
                      onChange={e => setForm({ ...form, initialCapital: e.target.value })}
                      placeholder="150 000"
                    />
                  </div>
                  <div className="form-row">
                    <label className="form-label">Capital restant dû</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={form.remainingCapital}
                      onChange={e => setForm({ ...form, remainingCapital: e.target.value })}
                      placeholder="par défaut = capital initial"
                    />
                  </div>
                </div>

                <div className="form-row-2col">
                  <div className="form-row">
                    <label className="form-label">Mensualité (hors assurance)</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={form.monthlyPayment}
                      onChange={e => setForm({ ...form, monthlyPayment: e.target.value })}
                      placeholder="850"
                    />
                  </div>
                  <div className="form-row">
                    <label className="form-label">Taux d'intérêt (%)</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={form.interestRate}
                      onChange={e => setForm({ ...form, interestRate: e.target.value })}
                      placeholder="1.65"
                    />
                  </div>
                </div>

                <div className="form-row-2col">
                  <div className="form-row">
                    <label className="form-label">Durée totale (mois)</label>
                    <input
                      className="form-input"
                      type="number"
                      step="1"
                      value={form.durationMonths}
                      onChange={e => setForm({ ...form, durationMonths: e.target.value })}
                      placeholder="240 (= 20 ans)"
                    />
                  </div>
                  <div className="form-row">
                    <label className="form-label">Date de début</label>
                    <input
                      className="form-input"
                      type="date"
                      value={form.startDate}
                      onChange={e => setForm({ ...form, startDate: e.target.value })}
                    />
                  </div>
                </div>

                {subtype === 'mortgage' && (
                  <div className="form-row">
                    <label className="form-label">Bien immobilier financé <span className="form-hint">· optionnel</span></label>
                    <select
                      className="form-input"
                      value={form.linkedAssetId}
                      onChange={e => setForm({ ...form, linkedAssetId: e.target.value })}
                    >
                      <option value="">— Pas de bien rattaché —</option>
                      {assets.filter(a => a.type === 'real_estate').map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="button"
                  className="secondary-btn"
                  style={{ alignSelf: 'flex-start', padding: '6px 10px', fontSize: 12 }}
                  onClick={() => setShowAdvanced(s => !s)}
                >
                  {showAdvanced ? '− Masquer les options avancées' : '+ Options avancées (apport, assurance, frais)'}
                </button>

                {showAdvanced && (
                  <>
                    <div className="form-row-2col">
                      <div className="form-row">
                        <label className="form-label">Apport personnel</label>
                        <input
                          className="form-input"
                          type="number"
                          step="0.01"
                          value={form.downPayment}
                          onChange={e => setForm({ ...form, downPayment: e.target.value })}
                          placeholder="30 000"
                        />
                      </div>
                      <div className="form-row">
                        <label className="form-label">Taux d'assurance (%)</label>
                        <input
                          className="form-input"
                          type="number"
                          step="0.01"
                          value={form.insuranceRate}
                          onChange={e => setForm({ ...form, insuranceRate: e.target.value })}
                          placeholder="0.36"
                        />
                      </div>
                    </div>
                    <div className="form-row-2col">
                      <div className="form-row">
                        <label className="form-label">Frais de dossier</label>
                        <input
                          className="form-input"
                          type="number"
                          step="0.01"
                          value={form.applicationFees}
                          onChange={e => setForm({ ...form, applicationFees: e.target.value })}
                          placeholder="1 000"
                        />
                      </div>
                      <div className="form-row">
                        <label className="form-label">Ma quote-part (%)</label>
                        <input
                          className="form-input"
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={form.ownershipPct}
                          onChange={e => setForm({ ...form, ownershipPct: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="form-row">
              <label className="form-label">
                Détenteur{members.length > 1 ? '·s' : ''}
                <span className="form-hint"> · Sélectionne un ou plusieurs membres</span>
              </label>
              <div className="member-checks">
                {members.map(m => {
                  const active = form.memberIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`member-check ${active ? 'active' : ''}`}
                      style={{ borderColor: active ? m.color : undefined }}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => setForm({
                          ...form,
                          memberIds: active
                            ? form.memberIds.filter(id => id !== m.id)
                            : [...form.memberIds, m.id],
                        })}
                      />
                      <span className="member-avatar" style={{ background: m.color }}>
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                      <span>{m.name}</span>
                    </label>
                  );
                })}
              </div>
              {members.length === 0 && (
                <div className="form-hint" style={{ marginTop: 6 }}>
                  Aucun membre — ajoute-en un dans Réglages → Membres.
                </div>
              )}
            </div>

            {/* Hint pour les enveloppes financières : on pourra importer les
                positions juste après la création depuis le détail de l'actif. */}
            {['pea', 'cto', 'av', 'per'].includes(subtype) && (
              <div className="form-hint-banner">
                <strong>Étape suivante :</strong> une fois le compte créé, ouvre-le depuis Patrimoine pour <em>importer tes positions</em> (CSV/XLSX Boursorama, BNP, Trade Republic, IBKR…) ou les saisir manuellement.
              </div>
            )}

            {submitError && (
              <div className="form-error">
                ⚠︎ {submitError}
              </div>
            )}

            <div className="modal-foot">
              <button className="secondary-btn" onClick={goDetail} type="button">Retour</button>
              <button
                className="primary-btn"
                disabled={submitting}
                onClick={submit}
                type="button"
              >
                {submitting ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
