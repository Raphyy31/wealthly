// ============================================================================
// OtherAssetDetail — Or, montres, collectibles, autres actifs tangibles.
// Extracted from Wealth.jsx lines 3350-3485.
// ============================================================================
import { ChevronLeft, X, Edit3, Sparkles } from 'lucide-react';
import { formatDate } from '../../../utils.js';
import { ownersList } from '../utils.js';
import { DetailV3Styles } from '../styles.jsx';
import { ResponsiveModal } from '../../../components/ui/ResponsiveModal.jsx';

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

  return (
    <ResponsiveModal open={true} onClose={onClose} className="modal--detail">
        <DetailV3Styles/>

        <div className="dv3-head">
          <button className="dv3-back" onClick={onClose}>
            <ChevronLeft size={14}/> Patrimoine · Autres actifs
          </button>
          <button className="dv3-close" onClick={onClose} aria-label="Fermer">
            <X size={18}/>
          </button>

          <div className="dv3-title-row">
            <div className="dv3-title-block-with-logo">
              <span className="dv3-other-logo"><Sparkles size={18}/></span>
              <div>
                <div className="dv3-eyebrow">{subtypeLabel}</div>
                <h2 className="dv3-title">
                  {asset.name.split(' ')[0]} <em>{asset.name.split(' ').slice(1).join(' ') || ''}.</em>
                </h2>
                <div className="dv3-sub">
                  <span className="dv3-badge">Manuel</span>
                  {owners && <><span className="dv3-dot">·</span><span>{owners}</span></>}
                </div>
              </div>
            </div>
            <div className="dv3-value-block">
              <div className="dv3-hero-num num">{fmt(currentValue)}</div>
              {purchasePrice > 0 && (
                <div className={`dv3-hero-delta ${plLatente >= 0 ? 'pos' : 'neg'}`}>
                  <span className="num">{plLatente >= 0 ? '+' : ''}{fmt(plLatente)}</span>
                  <span className="dv3-dot">·</span>
                  <span className="num">{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1).replace('.', ',')} %</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="dv3-body">
          <section className="ds-panel">
            <div className="ds-panel-head">
              <div>
                <div className="ds-panel-title">Détail de l'actif</div>
                {asset.purchaseDate && yearsSincePurchase >= 0.5 && (
                  <div className="ds-panel-sub">
                    Détenu depuis {yearsSincePurchase < 1 ? `${Math.round(yearsSincePurchase * 12)} mois` : `${yearsSincePurchase.toFixed(1)} ans`}
                  </div>
                )}
              </div>
            </div>
            <div className="dv3-kv-list">
              {asset.subtype && (
                <div className="dv3-kv-row">
                  <span>Catégorie</span>
                  <span>{subtypeLabel}</span>
                </div>
              )}
              <div className="dv3-kv-row">
                <span>Prix d'achat</span>
                <span className="num">{fmt(purchasePrice)}</span>
              </div>
              {asset.purchaseDate && (
                <div className="dv3-kv-row">
                  <span>Date d'acquisition</span>
                  <span>{formatDate(asset.purchaseDate)}</span>
                </div>
              )}
              <div className="dv3-kv-row dv3-kv-sep">
                <span>Valeur actuelle estimée</span>
                <span className="num dv3-kv-bold">{fmt(currentValue)}</span>
              </div>
              {purchasePrice > 0 && (
                <div className="dv3-kv-row">
                  <span>Plus-value latente</span>
                  <span className={`num dv3-kv-bold ${plLatente >= 0 ? 'pos' : 'neg'}`}>
                    {plLatente >= 0 ? '+' : ''}{fmt(plLatente)}
                    <span className="dv3-kv-pct"> · {plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1).replace('.', ',')} %</span>
                  </span>
                </div>
              )}
              {cagrPct !== null && (
                <div className="dv3-kv-row">
                  <span>Performance annualisée</span>
                  <span className={`num ${cagrPct >= 0 ? 'pos' : 'neg'}`}>
                    {cagrPct >= 0 ? '+' : ''}{cagrPct.toFixed(1).replace('.', ',')} % /an
                  </span>
                </div>
              )}
              <div className="dv3-kv-row">
                <span>Détenteur·s</span>
                <span>{owners}</span>
              </div>
            </div>
          </section>

          {asset.notes && (
            <section className="ds-panel">
              <div className="ds-panel-head">
                <div>
                  <div className="ds-panel-title">Notes</div>
                </div>
              </div>
              <div className="dv3-notes-body">
                {asset.notes}
              </div>
            </section>
          )}
        </div>

        <div className="dv3-foot">
          <button className="ds-btn" onClick={() => onEdit && onEdit()}>
            <Edit3 size={14}/> Modifier
          </button>
        </div>
      </ResponsiveModal>
  );
}
