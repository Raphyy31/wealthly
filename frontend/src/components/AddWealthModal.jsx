// frontend/src/components/AddWealthModal.jsx
//
// Wizard "+ Ajouter à votre patrimoine" — 2 étapes :
//   1. category   (grille 2×3)
//   2. detail     (sous-catégorie + mode synced/manuel)
//
// À la fin de l'étape 2 :
//   - mode synced → onConnectBank({category, subtype})  (flow PSD2 GoCardless)
//   - mode manuel → onPickType({category, subtype})     (ouvre l'éditeur 5-step
//                                                        existant côté Wealth)
//
// Le step 3 "form" minimaliste a été retiré au profit des éditeurs canoniques
// (LiabilityEditor, RealEstateEditor, SimpleAssetEditor) qui capturent toutes
// les infos d'une asset class d'un coup.

import { useState } from 'react';
import {
  X, ChevronLeft, Wallet, TrendingUp, Home, Bitcoin,
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

export function AddWealthModal({ onClose, onConnectBank, onPickType }) {
  const [step, setStep] = useState('category');
  const [category, setCategory] = useState(null);
  const [subtype, setSubtype] = useState(null);
  const [syncMode, setSyncMode] = useState(null);

  const goCategory = () => { setStep('category'); setCategory(null); setSubtype(null); setSyncMode(null); };

  const pickCategory = (key) => {
    setCategory(key);
    setSubtype(null);
    setSyncMode(null);
    setStep('detail');
  };

  const continueFromDetail = () => {
    if (!subtype) return;
    if (SYNCABLE_SUBTYPES.includes(subtype) && !syncMode) return;
    if (syncMode === 'synced') {
      onConnectBank && onConnectBank({ category, subtype });
      return;
    }
    // Manual flow → ouvre l'éditeur canonique côté Wealth
    onPickType && onPickType({ category, subtype });
  };

  const stepTitle =
    step === 'category' ? <>Ajouter à votre <em>patrimoine.</em></> :
                          <>{CATEGORY_LABELS[category]}</>;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          {step !== 'category' && (
            <button className="icon-btn" onClick={goCategory} title="Retour">
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
                      <div className="mode-sub">Détail complet de l'enveloppe : nom, valeur, caractéristiques, frais.</div>
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
      </div>
    </div>
  );
}
