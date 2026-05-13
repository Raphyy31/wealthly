// frontend/src/components/WealthItemDrawer.jsx
//
// Drawer détail unifié pour un WealthItem. 880px de large, ouvert au clic
// d'une ligne dans la vue Patrimoine. Contenu adaptatif selon le subtype.
//
// Sections (eyebrow § NN cohérent avec le design system Wealthly v3) :
//   § 01 — Positions (PEA/CTO/AV/crypto)
//   § 02 — Transactions (placeholder — branchera Transactions filtré plus tard)
//   § 03 — Insight fiscal (PEA, Livret A — affichage du plafond avec barre)
//   § 04 — Configuration (devise, détenteurs, mode, actions)

import { X, ChevronLeft, Edit3, Cloud, Trash2 } from 'lucide-react';
import { SUBTYPE_LABELS, CATEGORY_LABELS, FISCAL_CAPS } from '../types/wealth.js';

function Section({ label, title, meta, children }) {
  return (
    <div className="drawer-section">
      <div className="drawer-section-head">
        <div>
          <span className="drawer-section-label">{label}</span>
          <h3 className="drawer-section-title">{title}</h3>
        </div>
        {meta && <span className="drawer-section-meta">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

function PositionsSection({ item, fmt }) {
  if (!item.positions || item.positions.length === 0) {
    return (
      <Section label="§ 01" title={<>Vos <em>positions</em></>}>
        <div className="drawer-empty-inline">
          Aucune position renseignée.{' '}
          <button className="link-btn" disabled>Ajouter une position</button>
          {' · '}
          <span className="csv-link-disabled">…ou <em>importer un CSV</em> (à venir)</span>
        </div>
      </Section>
    );
  }
  const total = item.positions.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <Section
      label="§ 01"
      title={<>Vos <em>positions</em></>}
      meta={`${item.positions.length} lignes · ${fmt(total)}`}
    >
      <table className="positions-table">
        <thead>
          <tr>
            <th>Valeur</th>
            <th className="r">Quantité</th>
            <th className="r">Prix de revient</th>
            <th className="r">Cours</th>
            <th className="r">Valeur</th>
            <th className="r">+/− value</th>
          </tr>
        </thead>
        <tbody>
          {item.positions.map(p => {
            const pl = ((p.lastPrice || 0) - (p.costBasis || 0)) * (p.quantity || 0);
            return (
              <tr key={p.id}>
                <td>
                  <div className="pos-name-line">{p.name}</div>
                  <div className="pos-isin">{p.isin || p.ticker || ''}</div>
                </td>
                <td className="r w-num">{p.quantity}</td>
                <td className="r w-num">{p.costBasis ? fmt(p.costBasis) : '—'}</td>
                <td className="r w-num">{p.lastPrice ? fmt(p.lastPrice) : '—'}</td>
                <td className="r w-num">{fmt(p.value)}</td>
                <td className={`r w-num ${pl >= 0 ? 'pl-up' : 'pl-down'}`}>
                  {pl >= 0 ? '+' : ''}{fmt(pl)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

function FiscalInsightSection({ item, fmt }) {
  const cap = FISCAL_CAPS[item.subtype];
  if (!cap) return null;
  const used = item.value || 0;
  const remaining = Math.max(0, cap.cap - used);
  const pct = Math.min(100, (used / cap.cap) * 100);
  return (
    <Section label="§ 03" title={<>Insight <em>fiscal</em></>}>
      <div className="fiscal-insight">
        <div className="fiscal-row">
          <span>{cap.label}</span>
          <span className="w-num">{fmt(used)} / {fmt(cap.cap)}</span>
        </div>
        <div className="fiscal-bar">
          <div className="fiscal-bar-fill" style={{ width: `${pct}%` }}/>
        </div>
        <p className="fiscal-note">
          Il te reste <strong className="w-num">{fmt(remaining)}</strong> de versement avant d'atteindre le plafond.
        </p>
      </div>
    </Section>
  );
}

function ConfigSection({ item, fmt, members = [], onEdit, onDelete }) {
  const memberNames = (item.memberIds || [])
    .map(id => members.find(m => m.id === id)?.name)
    .filter(Boolean)
    .join(' & ') || '—';
  return (
    <Section label="§ 04" title={<>Configuration de <em>l'élément</em></>}>
      <div className="config-list">
        <div className="config-row"><span>Devise</span><span className="w-num">{item.currency}</span></div>
        <div className="config-row"><span>Détenteur·s</span><span>{memberNames}</span></div>
        <div className="config-row">
          <span>Mode</span>
          <span>
            <span className={`badge badge-${item.syncMode}`}>
              {item.syncMode === 'synced' ? 'Synchronisé' : 'Manuel'}
            </span>
          </span>
        </div>
      </div>
      <div className="config-actions">
        <button className="secondary-btn" onClick={() => onEdit && onEdit(item)}>
          <Edit3 size={14}/> Modifier
        </button>
        <button
          className="secondary-btn drawer-danger"
          onClick={() => onDelete && onDelete(item)}
        >
          <Trash2 size={14}/> Supprimer
        </button>
      </div>
    </Section>
  );
}

export function WealthItemDrawer({ item, fmt, members = [], onClose, onEdit, onDelete }) {
  if (!item) return null;

  const positive = (item.plLatente || 0) >= 0;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-shell" onClick={e => e.stopPropagation()}>
        <div className="drawer-head">
          <button className="drawer-back" onClick={onClose} type="button">
            <ChevronLeft size={14}/> Patrimoine · {CATEGORY_LABELS[item.category]}
          </button>
          <button className="drawer-close" onClick={onClose} type="button" aria-label="Fermer">
            <X size={18}/>
          </button>

          <div className="drawer-title-row">
            <div>
              <h2 className="drawer-title">
                {SUBTYPE_LABELS[item.subtype] || ''} <em>{item.name}.</em>
              </h2>
              <div className="drawer-meta">
                <span className={`badge badge-${item.syncMode}`}>
                  {item.syncMode === 'synced'
                    ? <><Cloud size={11} style={{ verticalAlign: 'middle', marginRight: 3 }}/>Synchronisé</>
                    : <><Edit3 size={11} style={{ verticalAlign: 'middle', marginRight: 3 }}/>Manuel</>}
                </span>
                {item.positions && item.positions.length > 0 && (
                  <span className="drawer-meta-muted"> · {item.positions.length} positions</span>
                )}
              </div>
            </div>
            <div className="drawer-total">
              <div className="drawer-total-val w-num">{fmt(item.value)}</div>
              {item.plLatente !== null && item.plLatente !== undefined && (
                <div className={`drawer-total-delta ${positive ? 'up' : 'down'}`}>
                  {positive ? '+' : ''}{fmt(item.plLatente)}
                  {item.plLatentePct !== null && item.plLatentePct !== undefined &&
                    ` · ${positive ? '+' : ''}${item.plLatentePct.toFixed(1)}%`}
                </div>
              )}
            </div>
          </div>

          {(item.costBasis != null || (item.positions && item.positions.length)) && (
            <div className="drawer-kpi-strip">
              {item.costBasis != null && (
                <div className="drawer-kpi">
                  <div className="drawer-kpi-label">Investi</div>
                  <div className="drawer-kpi-val w-num">{fmt(item.costBasis)}</div>
                </div>
              )}
              {item.plLatente != null && (
                <div className="drawer-kpi">
                  <div className="drawer-kpi-label">+/− value</div>
                  <div className={`drawer-kpi-val w-num ${positive ? 'up' : 'down'}`}>
                    {positive ? '+' : ''}{fmt(item.plLatente)}
                  </div>
                </div>
              )}
              <div className="drawer-kpi">
                <div className="drawer-kpi-label">Mode</div>
                <div className="drawer-kpi-val">{item.syncMode === 'synced' ? 'Auto' : 'Manuel'}</div>
              </div>
            </div>
          )}
        </div>

        <div className="drawer-body">
          <PositionsSection item={item} fmt={fmt}/>
          <FiscalInsightSection item={item} fmt={fmt}/>
          <ConfigSection item={item} fmt={fmt} members={members} onEdit={onEdit} onDelete={onDelete}/>
        </div>
      </div>
    </div>
  );
}
