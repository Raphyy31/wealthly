// ============================================================================
// OtherAssetDetail — Or, montres, collectibles, autres actifs tangibles.
// Migré sur DetailShell (châssis unifié des fiches détail).
// ============================================================================
import React from 'react';
import { Sparkles, TrendingUp } from 'lucide-react';
import { formatDate } from '../../../utils.js';
import { ownersList } from '../utils.js';
import { DetailShell, DetailSection, DetailKVList, DetailInsight } from '../components/DetailShell.jsx';

export function OtherAssetDetail({ asset, members = [], fmt, onEdit, onClose }) {
  const currentValue = parseFloat(asset.currentValue) || 0;
  const purchasePrice = parseFloat(asset.purchasePrice) || 0;
  const plLatente = currentValue - purchasePrice;
  const plLatentePct = purchasePrice > 0 ? (plLatente / purchasePrice) * 100 : 0;

  const subtypeLabel = asset.subtype || 'Autre actif';
  const owners = ownersList(asset.memberIds, members);

  const yearsSincePurchase = asset.purchaseDate
    ? (new Date() - new Date(asset.purchaseDate)) / (1000 * 60 * 60 * 24 * 365)
    : 0;
  const cagrPct = purchasePrice > 0 && yearsSincePurchase >= 0.5
    ? (Math.pow(currentValue / purchasePrice, 1 / yearsSincePurchase) - 1) * 100
    : null;
  const pct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')} %`;

  const [first, ...rest] = (asset.name || '').split(' ');

  const kpis = [
    purchasePrice > 0 && { label: "Prix d'achat", value: fmt(purchasePrice) },
    asset.purchaseDate && { label: 'Acquis le', value: formatDate(asset.purchaseDate) },
    cagrPct !== null && { label: 'Perf. annualisée', value: `${pct(cagrPct)} /an` },
  ].filter(Boolean);

  return (
    <DetailShell
      breadcrumb="Patrimoine · Autres actifs"
      onClose={onClose}
      onEdit={onEdit ? () => onEdit() : undefined}
      heroIcon={<Sparkles size={32} strokeWidth={1.8}/>}
      eyebrow={subtypeLabel}
      title={<>{first} {rest.length ? <em>{rest.join(' ')}.</em> : null}</>}
      subtitle={<><span className="dv3-badge">Manuel</span>{owners && <span>· {owners}</span>}</>}
      valueLabel="Valeur estimée"
      value={fmt(currentValue)}
      valueSub={asset.purchaseDate ? `Acquis le ${formatDate(asset.purchaseDate)}` : null}
      delta={purchasePrice > 0 ? { text: `${plLatente >= 0 ? '+' : ''}${fmt(plLatente)} · ${pct(plLatentePct)}`, positive: plLatente >= 0 } : null}
      kpis={kpis}
    >
      {purchasePrice > 0 && (
        <DetailInsight icon={<TrendingUp size={15}/>} tone={plLatente >= 0 ? 'positive' : 'warning'}>
          {plLatente >= 0 ? 'Valorisé' : 'En recul de'} <strong>{plLatente >= 0 ? '+' : ''}{pct(plLatentePct)}</strong> (<strong>{plLatente >= 0 ? '+' : ''}{fmt(plLatente)}</strong>) depuis l'acquisition{yearsSincePurchase >= 1 ? ` il y a ${Math.round(yearsSincePurchase)} ans` : ''}.
        </DetailInsight>
      )}
      <DetailSection title="Détail de l'actif">
        <DetailKVList rows={[
          asset.subtype && { label: 'Catégorie', value: subtypeLabel },
          purchasePrice > 0 && { label: 'Plus-value latente', value: `${plLatente >= 0 ? '+' : ''}${fmt(plLatente)}`, sub: pct(plLatentePct), valueClass: plLatente >= 0 ? 'pos' : 'neg' },
          { label: 'Détenteur·s', value: owners || '—' },
        ].filter(Boolean)}/>
      </DetailSection>

      {asset.notes && (
        <DetailSection title="Notes">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{asset.notes}</div>
        </DetailSection>
      )}
    </DetailShell>
  );
}
