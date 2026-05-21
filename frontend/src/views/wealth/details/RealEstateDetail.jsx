// ============================================================================
// RealEstateDetail — Finary-style rich detail view for real-estate assets.
// Extracted from Wealth.jsx lines 1711-1897.
// ============================================================================
import { ChevronLeft, Home, Users, Edit3, X } from 'lucide-react';
import { ownersList } from '../utils.js';
import { RealEstatePatchStyles } from '../styles.jsx';
import { ResponsiveModal } from '../../../components/ui/ResponsiveModal.jsx';

export function RealEstateDetail({ asset, liabilities = [], members = [], memberShare, fmt, onEdit, onClose }) {
  const subtypeLabel = {
    rp: 'Résidence principale',
    RP: 'Résidence principale',
    locative: 'Locatif',
    secondaire: 'Résidence secondaire',
    scpi: 'SCPI',
    other: 'Autre',
  }[asset.subtype] || 'Bien immobilier';

  const purchasePrice = parseFloat(asset.purchasePrice) || 0;
  const notaryFees = parseFloat(asset.notaryFees) || 0;
  const agencyFees = parseFloat(asset.agencyFees) || 0;
  const worksFees = parseFloat(asset.worksFees) || 0;
  const furnitureFees = parseFloat(asset.furnitureFees) || 0;
  const totalAcquisitionCost = purchasePrice + notaryFees + agencyFees + worksFees + furnitureFees;

  const currentValue = parseFloat(asset.currentValue) || 0;
  const plLatente = currentValue - totalAcquisitionCost;
  const plLatentePct = totalAcquisitionCost > 0 ? (plLatente / totalAcquisitionCost) * 100 : 0;

  const surface = parseFloat(asset.surfaceM2) || 0;
  const pricePerM2 = surface > 0 ? currentValue / surface : 0;
  const purchasePricePerM2 = surface > 0 && purchasePrice > 0 ? purchasePrice / surface : 0;

  const ownershipPct = parseFloat(asset.ownershipPct) || 100;
  const yearsSincePurchase = asset.purchaseDate
    ? (new Date() - new Date(asset.purchaseDate)) / (1000 * 60 * 60 * 24 * 365)
    : 0;
  const yieldAnnual = totalAcquisitionCost > 0 && yearsSincePurchase > 0
    ? (plLatente / totalAcquisitionCost / yearsSincePurchase) * 100
    : 0;

  const linkedLoan = liabilities.find(l => l.linkedAssetId === asset.id);
  const remainingCapital = linkedLoan ? parseFloat(linkedLoan.remainingCapital) || 0 : 0;
  const monthlyPayment = linkedLoan ? parseFloat(linkedLoan.monthlyPayment) || 0 : 0;
  const initialCapital = linkedLoan ? parseFloat(linkedLoan.initialCapital) || 0 : 0;
  const netValue = currentValue - remainingCapital;

  const owners = ownersList(asset.memberIds, members);

  return (
    <ResponsiveModal open={true} onClose={onClose}> e.stopPropagation()}>
        <div className="loan-finary-head">
          <button className="drawer-back" onClick={onClose}>
            <ChevronLeft size={14}/> Patrimoine · Immobilier
          </button>
          <button className="drawer-close" onClick={onClose} aria-label="Fermer">
            <X size={18}/>
          </button>

          {/* HERO — chip type + nom + adresse + valeur */}
          <div className="re-hero">
            <div className="re-hero-left">
              <div className="re-type-pill"><Home size={12}/> {subtypeLabel}</div>
              <h2 className="re-name">{asset.name}</h2>
              {asset.address && <div className="re-address">{asset.address}</div>}
            </div>
            <div className="re-hero-right">
              <div className="re-eyebrow">Valeur estimée</div>
              <div className="re-hero-value w-num">{fmt(currentValue)}</div>
            </div>
          </div>

          {/* KPI grid — chiffres clés */}
          <div className="re-kpi-grid">
            {surface > 0 && (
              <div className="re-kpi">
                <div className="re-kpi-label">Surface</div>
                <div className="re-kpi-value w-num">{surface} m²</div>
              </div>
            )}
            {pricePerM2 > 0 && (
              <div className="re-kpi">
                <div className="re-kpi-label">Prix au m²</div>
                <div className="re-kpi-value w-num">{fmt(pricePerM2)}</div>
                {purchasePricePerM2 > 0 && (
                  <div className="re-kpi-sub w-num">vs. {fmt(purchasePricePerM2)} à l'achat</div>
                )}
              </div>
            )}
            {asset.purchaseDate && (
              <div className="re-kpi">
                <div className="re-kpi-label">Acquis en</div>
                <div className="re-kpi-value w-num">{new Date(asset.purchaseDate).getFullYear()}</div>
                {yearsSincePurchase >= 1 && (
                  <div className="re-kpi-sub">il y a <span className="w-num">{Math.round(yearsSincePurchase)}</span> ans</div>
                )}
              </div>
            )}
            {ownershipPct !== 100 && (
              <div className="re-kpi">
                <div className="re-kpi-label">Quote-part</div>
                <div className="re-kpi-value w-num">{ownershipPct} %</div>
              </div>
            )}
            {asset.constructionYear && (
              <div className="re-kpi">
                <div className="re-kpi-label">Construction</div>
                <div className="re-kpi-value w-num">{asset.constructionYear}</div>
              </div>
            )}
          </div>
        </div>

        <div className="loan-finary-body">
          {/* Coût d'acquisition */}
          <section className="re-card">
            <div className="re-card-head">
              <h3 className="re-card-title">Coût d'acquisition</h3>
              <div className="re-card-total w-num">{fmt(totalAcquisitionCost)}</div>
            </div>
            <ul className="re-rows">
              <li><span>Prix d'achat</span><span className="w-num">{fmt(purchasePrice)}</span></li>
              {notaryFees > 0    && <li><span>Frais de notaire</span><span className="w-num">{fmt(notaryFees)}</span></li>}
              {agencyFees > 0    && <li><span>Frais d'agence</span><span className="w-num">{fmt(agencyFees)}</span></li>}
              {worksFees > 0     && <li><span>Travaux</span><span className="w-num">{fmt(worksFees)}</span></li>}
              {furnitureFees > 0 && <li><span>Mobilier</span><span className="w-num">{fmt(furnitureFees)}</span></li>}
            </ul>
          </section>

          {/* Prêt immobilier — avec barre de progression */}
          {linkedLoan && (() => {
            const repaidPct = initialCapital > 0
              ? Math.max(0, Math.min(100, ((initialCapital - remainingCapital) / initialCapital) * 100))
              : 0;
            return (
              <section className="re-card">
                <div className="re-card-head">
                  <h3 className="re-card-title">Prêt immobilier</h3>
                  <button className="re-card-link" onClick={() => onEdit && onEdit(asset)} title="Voir le prêt lié">
                    {linkedLoan.name || 'Voir le prêt'}
                  </button>
                </div>

                <div className="re-loan-headline">
                  <div>
                    <div className="re-kpi-label">Capital restant dû</div>
                    <div className="re-loan-big w-num">{fmt(remainingCapital)}</div>
                  </div>
                  <div className="re-loan-pct w-num">{Math.round(repaidPct)} %<span> remboursé</span></div>
                </div>

                <div className="re-progress">
                  <div className="re-progress-fill" style={{ width: `${repaidPct}%` }}/>
                </div>
                <div className="re-progress-legend">
                  <span className="w-num">{fmt(initialCapital - remainingCapital)}</span> remboursés
                  <span className="re-sep">·</span>
                  <span className="w-num">{fmt(initialCapital)}</span> empruntés
                </div>

                <div className="re-loan-foot">
                  <div className="re-loan-foot-cell">
                    <div className="re-kpi-label">Mensualité</div>
                    <div className="re-loan-foot-val w-num">{fmt(monthlyPayment)}</div>
                  </div>
                  <div className="re-loan-foot-cell">
                    <div className="re-kpi-label">Patrimoine net du bien</div>
                    <div className="re-loan-foot-val w-num">{fmt(netValue)}</div>
                    <div className="re-loan-foot-sub">
                      <span className="w-num">{fmt(currentValue)}</span> − <span className="w-num">{fmt(remainingCapital)}</span>
                    </div>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* Détenteurs */}
          <div className="re-footer">
            <div className="re-owners"><Users size={13}/> Détenu par {owners}</div>
            <button className="ds-btn" onClick={() => onEdit && onEdit(asset)}>
              <Edit3 size={14}/> Modifier
            </button>
          </div>
        </div>
        <RealEstatePatchStyles/>
      </ResponsiveModal>
  );
}
