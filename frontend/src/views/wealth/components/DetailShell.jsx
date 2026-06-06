// ============================================================================
// DetailShell — châssis unifié de TOUTES les fiches détail patrimoine.
//
// Pattern premium (cf Finary/Kubera) : barre fine sticky (retour + actions) →
// hero (eyebrow + nom + GROSSE valeur + badge delta coloré) → bande de KPI →
// corps en sections. Une seule couleur d'accent, chiffres tabulaires, beaucoup
// d'air. Chaque fiche garde ses KPIs et ses sections spécifiques via les props.
//
// Usage :
//   <DetailShell breadcrumb="Patrimoine · Immobilier" onClose={...} onEdit={...}
//     eyebrow="Résidence principale" title={<>Appartement <em>RP.</em></>}
//     subtitle="Levallois · Détenu par Raphaël"
//     value={fmt(v)} delta={{ text: '+12 340 € · +5,2 %', positive: true }}
//     kpis={[{label:'Surface', value:'73 m²'}, ...]}>
//     <DetailSection title="Coût d'acquisition" aside={fmt(total)}>…</DetailSection>
//   </DetailShell>
// ============================================================================
import React from 'react';
import { ChevronLeft, X, Pencil } from 'lucide-react';
import { ResponsiveModal } from '../../../components/ui/ResponsiveModal.jsx';

export function DetailShell({
  open = true, onClose, breadcrumb, onEdit, editLabel = 'Modifier',
  icon, eyebrow, title, subtitle, value, delta, kpis = [],
  headerExtra, footer, children,
}) {
  return (
    <ResponsiveModal open={open} onClose={onClose} className="modal--detail">
      <DetailShellStyles/>
      <div className="dsh">
        {/* Barre fine sticky */}
        <div className="dsh-bar">
          <button className="dsh-back" onClick={onClose}>
            <ChevronLeft size={15}/> <span>{breadcrumb}</span>
          </button>
          <div className="dsh-bar-actions">
            {onEdit && (
              <button className="dsh-edit" onClick={onEdit}>
                <Pencil size={13}/> {editLabel}
              </button>
            )}
            <button className="dsh-close" onClick={onClose} aria-label="Fermer">
              <X size={17}/>
            </button>
          </div>
        </div>

        {/* Hero */}
        <div className="dsh-hero">
          <div className="dsh-hero-left">
            {(icon || eyebrow) && (
              <div className="dsh-eyebrow">
                {icon && <span className="dsh-eyebrow-icon">{icon}</span>}
                {eyebrow}
              </div>
            )}
            <h2 className="dsh-title">{title}</h2>
            {subtitle && <div className="dsh-sub">{subtitle}</div>}
          </div>
          {(value != null) && (
            <div className="dsh-hero-right">
              <div className="dsh-value w-num">{value}</div>
              {delta && (
                <div className={`dsh-delta ${delta.positive ? 'pos' : 'neg'}`}>
                  {delta.text}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bande de KPI */}
        {kpis.length > 0 && (
          <div className="dsh-kpis" style={{ '--dsh-kpi-count': kpis.length }}>
            {kpis.map((k, i) => (
              <div key={i} className="dsh-kpi">
                <div className="dsh-kpi-label">{k.label}</div>
                <div className="dsh-kpi-value w-num">{k.value}</div>
                {k.sub && <div className="dsh-kpi-sub">{k.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {headerExtra}

        {/* Corps */}
        <div className="dsh-body">
          {children}
          {footer && <div className="dsh-foot">{footer}</div>}
        </div>
      </div>
    </ResponsiveModal>
  );
}

// Section de corps : carte avec titre + valeur optionnelle à droite.
export function DetailSection({ title, aside, asideClass = '', children, className = '' }) {
  return (
    <section className={`dsh-section ${className}`}>
      {(title || aside) && (
        <div className="dsh-section-head">
          {title && <h3 className="dsh-section-title">{title}</h3>}
          {aside != null && <div className={`dsh-section-aside w-num ${asideClass}`}>{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// Liste clé→valeur (lignes label gauche / valeur droite).
export function DetailKVList({ rows }) {
  return (
    <ul className="dsh-kv">
      {rows.filter(Boolean).map((r, i) => (
        <li key={i} className={r.strong ? 'strong' : ''}>
          <span className="dsh-kv-k">{r.label}</span>
          <span className={`dsh-kv-v w-num ${r.valueClass || ''}`}>{r.value}{r.sub && <em className="dsh-kv-sub">{r.sub}</em>}</span>
        </li>
      ))}
    </ul>
  );
}

// Barre de progression (remboursement prêt, plafond livret…).
export function DetailProgress({ pct, label, accent = 'var(--accent)' }) {
  const v = Math.max(0, Math.min(100, pct || 0));
  return (
    <div className="dsh-progress-wrap">
      <div className="dsh-progress"><div className="dsh-progress-fill" style={{ width: `${v}%`, background: accent }}/></div>
      {label && <div className="dsh-progress-legend">{label}</div>}
    </div>
  );
}

// ── Styles (injectés une fois ; une seule fiche ouverte à la fois) ──────────
let _dshInjected = false;
function DetailShellStyles() {
  if (_dshInjected) return null;
  _dshInjected = true;
  return <style dangerouslySetInnerHTML={{ __html: DSH_CSS }}/>;
}

const DSH_CSS = String.raw`
.dsh { display: flex; flex-direction: column; }
.dsh .w-num { font-variant-numeric: tabular-nums; }

/* Barre fine sticky */
.dsh-bar {
  position: sticky; top: 0; z-index: 12;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 22px; gap: 12px;
  background: var(--bg-card); border-bottom: 1px solid var(--border);
}
.dsh-back {
  display: inline-flex; align-items: center; gap: 6px;
  background: none; border: none; cursor: pointer; padding: 4px 6px; margin: -4px -6px;
  color: var(--text-tertiary); font: 500 13px var(--font-sans); border-radius: 6px;
  transition: color .15s, background .15s;
}
.dsh-back:hover { color: var(--text-primary); background: var(--bg-subtle); }
.dsh-bar-actions { display: inline-flex; align-items: center; gap: 6px; }
.dsh-edit {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 12px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--bg-elev);
  color: var(--text-primary); font: 500 12.5px var(--font-sans); cursor: pointer;
  transition: background .15s, border-color .15s;
}
.dsh-edit:hover { background: var(--bg-subtle); border-color: var(--border-strong); }
.dsh-close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--bg-elev);
  color: var(--text-secondary); cursor: pointer; transition: background .15s, color .15s;
}
.dsh-close:hover { background: var(--bg-subtle); color: var(--text-primary); }

/* Hero */
.dsh-hero {
  display: grid; grid-template-columns: 1fr auto; gap: 28px; align-items: end;
  padding: 26px 28px 22px;
}
@media (max-width: 640px) { .dsh-hero { grid-template-columns: 1fr; gap: 14px; align-items: start; } }
.dsh-hero-left { min-width: 0; }
.dsh-eyebrow {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 500; color: var(--accent);
  background: var(--accent-soft); padding: 3px 10px; border-radius: 999px;
}
.dsh-eyebrow-icon { display: inline-flex; }
.dsh-title {
  margin: 12px 0 0; font-family: var(--font-sans); font-weight: 500;
  font-size: 26px; line-height: 1.12; letter-spacing: -0.02em; color: var(--ink);
}
.dsh-title em { font-family: 'Newsreader', Georgia, serif; font-style: italic; font-weight: 400; }
.dsh-sub { margin-top: 6px; font-size: 13px; color: var(--text-tertiary); display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
.dsh-hero-right { text-align: right; }
@media (max-width: 640px) { .dsh-hero-right { text-align: left; } }
.dsh-value {
  font-family: var(--font-sans); font-weight: 500; font-size: 34px; line-height: 1.05;
  letter-spacing: -0.025em; color: var(--ink); word-spacing: 0.05em;
}
.dsh-delta {
  display: inline-flex; margin-top: 8px; padding: 4px 10px; border-radius: 999px;
  font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums;
}
.dsh-delta.pos { background: color-mix(in srgb, var(--positive) 14%, transparent); color: var(--positive); }
.dsh-delta.neg { background: color-mix(in srgb, var(--negative) 14%, transparent); color: var(--negative); }

/* Bande de KPI */
.dsh-kpis {
  display: grid; grid-template-columns: repeat(var(--dsh-kpi-count, 4), 1fr);
  border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
  margin: 0 28px;
}
@media (max-width: 720px) { .dsh-kpis { grid-template-columns: repeat(2, 1fr); } }
.dsh-kpi { padding: 14px 18px; border-left: 1px solid var(--border); }
.dsh-kpi:first-child { padding-left: 0; border-left: none; }
@media (max-width: 720px) {
  .dsh-kpi { border-left: none; padding: 12px 0; border-top: 1px solid var(--border); }
  .dsh-kpi:first-child, .dsh-kpi:nth-child(2) { border-top: none; }
}
.dsh-kpi-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-tertiary); font-weight: 500; }
.dsh-kpi-value { font-size: 18px; font-weight: 500; color: var(--ink); margin-top: 6px; letter-spacing: -0.01em; }
.dsh-kpi-sub { font-size: 11.5px; color: var(--text-tertiary); margin-top: 3px; }

/* Corps */
.dsh-body { padding: 22px 28px 26px; display: flex; flex-direction: column; gap: 16px; }
.dsh-section { border: 1px solid var(--border); border-radius: var(--radius-lg, 12px); padding: 18px 20px; background: var(--bg-elev); }
.dsh-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.dsh-section-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.01em; }
.dsh-section-aside { font-size: 18px; font-weight: 600; color: var(--ink); }

/* KV list */
.dsh-kv { list-style: none; margin: 0; padding: 0; }
.dsh-kv li { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 9px 0; border-bottom: 1px solid var(--border-light, var(--border)); font-size: 13px; }
.dsh-kv li:last-child { border-bottom: none; }
.dsh-kv li.strong { font-weight: 600; }
.dsh-kv-k { color: var(--text-secondary); }
.dsh-kv-v { color: var(--ink); font-weight: 500; }
.dsh-kv-v.pos { color: var(--positive); }
.dsh-kv-v.neg { color: var(--negative); }
.dsh-kv-sub { font-style: normal; color: var(--text-tertiary); font-weight: 400; margin-left: 6px; font-size: 12px; }

/* Progress */
.dsh-progress-wrap { margin: 8px 0 2px; }
.dsh-progress { height: 7px; background: var(--bg-subtle); border-radius: 4px; overflow: hidden; }
.dsh-progress-fill { height: 100%; border-radius: 4px; transition: width .4s ease; }
.dsh-progress-legend { margin-top: 8px; font-size: 12px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }

/* Liste générique (transactions, lignes) */
.dsh-list { display: flex; flex-direction: column; }
.dsh-list-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-light, var(--border)); }
.dsh-list-row:last-child { border-bottom: none; }
.dsh-list-main { min-width: 0; }
.dsh-list-label { font-size: 13px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-list-meta { font-size: 11.5px; color: var(--text-tertiary); margin-top: 1px; }
.dsh-list-amount { font-size: 13px; font-weight: 500; color: var(--text-secondary); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.dsh-list-amount.pos { color: var(--positive); }
.dsh-list-amount.neg { color: var(--negative); }
.dsh-chart-pad { margin: 0 -4px; }

/* Footer */
.dsh-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 4px; }
.dsh-foot-owners { font-size: 12.5px; color: var(--text-tertiary); display: inline-flex; align-items: center; gap: 6px; }
`;
