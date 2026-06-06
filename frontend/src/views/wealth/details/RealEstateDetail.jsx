// ============================================================================
// RealEstateDetail — fiche détail bien immobilier. Migré sur DetailShell.
// ============================================================================
import React from 'react';
import { Home, Users, TrendingUp } from 'lucide-react';
import { ownersList } from '../utils.js';
import { DetailShell, DetailSection, DetailKVList, DetailProgress, DetailInsight, DetailBridge } from '../components/DetailShell.jsx';

export function RealEstateDetail({ asset, liabilities = [], members = [], memberShare, fmt, onEdit, onClose }) {
  const subtypeLabel = {
    rp: 'Résidence principale', RP: 'Résidence principale',
    locative: 'Locatif', secondaire: 'Résidence secondaire', scpi: 'SCPI', other: 'Autre',
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
  const yearsSincePurchase = asset.purchaseDate ? (new Date() - new Date(asset.purchaseDate)) / (1000 * 60 * 60 * 24 * 365) : 0;

  const linkedLoan = liabilities.find(l => l.linkedAssetId === asset.id);
  const remainingCapital = linkedLoan ? parseFloat(linkedLoan.remainingCapital) || 0 : 0;
  const monthlyPayment = linkedLoan ? parseFloat(linkedLoan.monthlyPayment) || 0 : 0;
  const initialCapital = linkedLoan ? parseFloat(linkedLoan.initialCapital) || 0 : 0;
  const netValue = currentValue - remainingCapital;

  const owners = ownersList(asset.memberIds, members);
  const pct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')} %`;

  const kpis = [
    surface > 0 && { label: 'Surface', value: `${surface} m²` },
    pricePerM2 > 0 && { label: 'Prix au m²', value: fmt(pricePerM2), sub: purchasePricePerM2 > 0 ? `vs ${fmt(purchasePricePerM2)} à l'achat` : null },
    asset.purchaseDate && { label: 'Acquis en', value: `${new Date(asset.purchaseDate).getFullYear()}`, sub: yearsSincePurchase >= 1 ? `il y a ${Math.round(yearsSincePurchase)} ans` : null },
    linkedLoan && currentValue > 0 && { label: 'Financé · LTV', value: `${Math.round((remainingCapital / currentValue) * 100)} %`, sub: 'du bien' },
    ownershipPct !== 100 && { label: 'Quote-part', value: `${ownershipPct} %` },
    asset.constructionYear && { label: 'Construction', value: `${asset.constructionYear}` },
  ].filter(Boolean);

  const repaidPct = initialCapital > 0 ? Math.max(0, Math.min(100, ((initialCapital - remainingCapital) / initialCapital) * 100)) : 0;

  return (
    <DetailShell
      breadcrumb="Patrimoine · Immobilier"
      onClose={onClose}
      onEdit={onEdit ? () => onEdit(asset) : undefined}
      icon={<Home size={13}/>}
      eyebrow={subtypeLabel}
      title={asset.name}
      subtitle={<>{asset.address && <span>{asset.address}</span>}{owners && <span>· <Users size={12} style={{ verticalAlign: '-1px' }}/> {owners}</span>}</>}
      value={fmt(currentValue)}
      delta={totalAcquisitionCost > 0 ? { text: `${plLatente >= 0 ? '+' : ''}${fmt(plLatente)} · ${pct(plLatentePct)}`, positive: plLatente >= 0 } : null}
      kpis={kpis}
    >
      {totalAcquisitionCost > 0 && (
        <DetailInsight icon={<TrendingUp size={15}/>} tone={plLatente >= 0 ? 'positive' : 'warning'}>
          {plLatente >= 0 ? 'Valorisé' : 'En recul de'} <strong>{plLatente >= 0 ? '+' : ''}{pct(plLatentePct)}</strong> (<strong>{plLatente >= 0 ? '+' : ''}{fmt(plLatente)}</strong>) depuis l'acquisition{yearsSincePurchase >= 1 ? ` il y a ${Math.round(yearsSincePurchase)} ans` : ''}.
        </DetailInsight>
      )}

      <DetailSection title="Coût d'acquisition" aside={fmt(totalAcquisitionCost)}>
        <DetailKVList rows={[
          { label: "Prix d'achat", value: fmt(purchasePrice) },
          notaryFees > 0 && { label: 'Frais de notaire', value: fmt(notaryFees) },
          agencyFees > 0 && { label: "Frais d'agence", value: fmt(agencyFees) },
          worksFees > 0 && { label: 'Travaux', value: fmt(worksFees) },
          furnitureFees > 0 && { label: 'Mobilier', value: fmt(furnitureFees) },
        ].filter(Boolean)}/>
        {totalAcquisitionCost > 0 && currentValue > 0 && (
          <div style={{ marginTop: 16 }}>
            <DetailBridge base={totalAcquisitionCost} gain={plLatente} fmt={fmt} baseLabel="Investi" gainLabel="Plus-value latente"/>
          </div>
        )}
      </DetailSection>

      {linkedLoan && (
        <DetailSection title="Prêt immobilier" aside={
          <button className="dsh-link-aside" onClick={() => onEdit && onEdit(asset)} title="Voir le prêt lié" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }}>
            {linkedLoan.name || 'Voir le prêt'}
          </button>
        }>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 4 }}>
            <div>
              <div className="dsh-kpi-label">Capital restant dû</div>
              <div className="w-num" style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--ink)', marginTop: 4 }}>{fmt(remainingCapital)}</div>
            </div>
            <div className="w-num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', marginLeft: 'auto' }}>{Math.round(repaidPct)} %<span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> remboursé</span></div>
          </div>
          <DetailProgress pct={repaidPct} label={<><span className="w-num">{fmt(initialCapital - remainingCapital)}</span> remboursés · <span className="w-num">{fmt(initialCapital)}</span> empruntés</>}/>
          <div className="dsh-kpis" style={{ '--dsh-kpi-count': 2, margin: '16px 0 0', borderBottom: 'none' }}>
            <div className="dsh-kpi">
              <div className="dsh-kpi-label">Mensualité</div>
              <div className="dsh-kpi-value w-num">{fmt(monthlyPayment)}</div>
            </div>
            <div className="dsh-kpi">
              <div className="dsh-kpi-label">Patrimoine net du bien</div>
              <div className="dsh-kpi-value w-num">{fmt(netValue)}</div>
              <div className="dsh-kpi-sub w-num">{fmt(currentValue)} − {fmt(remainingCapital)}</div>
            </div>
          </div>
        </DetailSection>
      )}
    </DetailShell>
  );
}
