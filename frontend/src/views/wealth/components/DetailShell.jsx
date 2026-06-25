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
import { ChevronLeft, X, Pencil, Sparkles, Download } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ResponsiveModal } from '../../../components/ui/ResponsiveModal.jsx';

export function DetailShell({
  open = true, onClose, breadcrumb, onEdit, editLabel = 'Modifier',
  onExport, exportLabel = 'Excel',
  icon, heroIcon, eyebrow, title, subtitle, value, valueLabel, valueSub, delta,
  heroExtra, kpis = [],
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
            {onExport && (
              <button className="dsh-edit" onClick={onExport} title="Exporter en Excel (.xlsx)">
                <Download size={13}/> {exportLabel}
              </button>
            )}
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

        {/* Hero affirmé : pastille XL + GROS titre + bloc valeur ou visuel libre */}
        <div className="dsh-hero">
          {heroIcon && <div className="dsh-hero-icon">{heroIcon}</div>}
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
          {heroExtra ? heroExtra : (value != null && (
            <div className="dsh-hero-right">
              {valueLabel && <div className="dsh-eyebrow-r">{valueLabel}</div>}
              <div className="dsh-value w-num">{value}</div>
              {valueSub && <div className="dsh-sub" style={{ justifyContent: 'flex-end', marginTop: 6 }}>{valueSub}</div>}
              {delta && (
                <div className={`dsh-delta ${delta.positive ? 'pos' : 'neg'}`}>
                  {delta.text}
                </div>
              )}
            </div>
          ))}
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

// Encart d'insight — UNE phrase contextuelle à valeur ajoutée (vision client).
// tone: 'accent' (défaut) | 'positive' | 'warning'.
export function DetailInsight({ icon, tone = 'accent', children }) {
  return (
    <div className={`dsh-insight ${tone}`}>
      <span className="dsh-insight-icon">{icon || <Sparkles size={15}/>}</span>
      <span>{children}</span>
    </div>
  );
}

// Donut + légende — pour les répartitions qui éclairent vraiment (allocation
// d'un compte-titres, composition du coût d'un crédit…).
export function DetailDonut({ data, fmt, centerLabel, centerValue }) {
  const items = (data || []).filter(d => d && d.value > 0);
  if (items.length === 0) return null;
  return (
    <div className="dsh-donut">
      <div className="dsh-donut-chart">
        <ResponsiveContainer width="100%" height={172}>
          <PieChart>
            <Pie data={items} dataKey="value" innerRadius={54} outerRadius={80} paddingAngle={2} stroke="none">
              {items.map((d, i) => <Cell key={i} fill={d.color}/>)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {centerValue != null && (
          <div className="dsh-donut-center">
            <span className="dsh-donut-center-label">{centerLabel}</span>
            <span className="dsh-donut-center-value w-num">{centerValue}</span>
          </div>
        )}
      </div>
      <div className="dsh-donut-legend">
        {items.map((d, i) => (
          <div key={i} className="dsh-donut-leg">
            <span className="dsh-donut-dot" style={{ background: d.color }}/>
            <span className="dsh-donut-leg-name">{d.name}</span>
            {d.meta && <span className="dsh-donut-leg-meta">{d.meta}</span>}
            <span className="dsh-donut-leg-val w-num">{fmt ? fmt(d.value) : d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Barre "pont" prix d'achat → valeur actuelle (plus-value visualisée).
export function DetailBridge({ base, gain, fmt, baseLabel = "Coût d'acquisition", gainLabel = 'Plus-value' }) {
  const total = base + Math.max(0, gain);
  const basePct = total > 0 ? (base / total) * 100 : 100;
  const positive = gain >= 0;
  return (
    <div className="dsh-bridge">
      <div className="dsh-bridge-bar">
        <div className="dsh-bridge-base" style={{ width: `${positive ? basePct : 100}%` }}/>
        {positive && gain > 0 && <div className="dsh-bridge-gain" style={{ width: `${100 - basePct}%` }}/>}
      </div>
      <div className="dsh-bridge-labels">
        <span><span className="dsh-bridge-dot base"/>{baseLabel} <b className="w-num">{fmt(base)}</b></span>
        <span className={positive ? 'pos' : 'neg'}><span className="dsh-bridge-dot gain"/>{gainLabel} <b className="w-num">{gain >= 0 ? '+' : ''}{fmt(gain)}</b></span>
      </div>
    </div>
  );
}

// ── Styles — rendus avec la fiche (une seule ouverte à la fois, comme les
//    autres injecteurs PatchStyles). Pas de garde module : sinon la 2e fiche
//    ouverte dans la session serait sans style (le <style> est démonté à la
//    fermeture de la 1re). ────────────────────────────────────────────────
function DetailShellStyles() {
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

/* HERO AFFIRMÉ — fond papier-chaud légèrement teinté cobalt, titre 42px */
.dsh-hero {
  position: relative;
  display: grid; grid-template-columns: auto 1fr auto; gap: 24px; align-items: center;
  padding: 32px 32px 28px;
  background:
    radial-gradient(ellipse at top right, rgba(37,64,217,0.06), transparent 50%),
    linear-gradient(180deg, var(--surface-hero) 0%, var(--bg-card) 100%);
  border-bottom: 1px solid var(--border);
}
@media (max-width: 720px) { .dsh-hero { grid-template-columns: 1fr; gap: 16px; padding: 24px 22px 20px; } }
.dsh-hero-left { min-width: 0; }
.dsh-hero-icon {
  width: 64px; height: 64px; border-radius: 16px;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
  color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 24px -8px rgba(37,64,217,0.5), inset 0 1px 0 rgba(255,255,255,0.2);
  flex-shrink: 0;
}
@media (max-width: 720px) { .dsh-hero-icon { width: 48px; height: 48px; border-radius: 12px; } }
.dsh-eyebrow {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600; color: var(--accent);
  background: var(--accent-soft); padding: 4px 11px; border-radius: 999px;
  letter-spacing: 0.02em;
}
.dsh-eyebrow-icon { display: inline-flex; }
.dsh-title {
  margin: 10px 0 4px; font-family: var(--font-sans); font-weight: 600;
  font-size: 42px; line-height: 1.05; letter-spacing: -0.03em; color: var(--ink);
}
@media (max-width: 720px) { .dsh-title { font-size: 30px; } }
.dsh-title em { font-family: 'Newsreader', Georgia, serif; font-style: italic; font-weight: 500; color: var(--ink); }
.dsh-sub { margin-top: 6px; font-size: 13.5px; color: var(--text-secondary); display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.dsh-hero-right { text-align: right; }
@media (max-width: 720px) { .dsh-hero-right { text-align: left; } }
.dsh-eyebrow-r { font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--text-tertiary); font-weight: 600; }
.dsh-value {
  font-family: 'Newsreader', Georgia, serif; font-style: italic; font-weight: 500;
  font-size: 48px; line-height: 1; letter-spacing: -0.02em; color: var(--ink);
  margin-top: 8px; font-variant-numeric: tabular-nums;
}
@media (max-width: 720px) { .dsh-value { font-size: 36px; } }
.dsh-delta {
  display: inline-flex; margin-top: 10px; padding: 5px 12px; border-radius: 999px;
  font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums;
}
.dsh-delta.pos { background: color-mix(in srgb, var(--positive) 14%, transparent); color: var(--positive); }
.dsh-delta.neg { background: color-mix(in srgb, var(--negative) 14%, transparent); color: var(--negative); }

/* BAND DE KPI COLORÉS (cartes avec barre verticale, pas plats) */
.dsh-kpis {
  display: grid; grid-template-columns: repeat(var(--dsh-kpi-count, 4), 1fr); gap: 12px;
  padding: 18px 32px; background: var(--bg-sunk); border-bottom: 1px solid var(--border);
  margin: 0;
}
@media (max-width: 720px) { .dsh-kpis { grid-template-columns: repeat(2, 1fr); padding: 14px 22px; } }
.dsh-kpi {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
  padding: 14px 16px; position: relative; overflow: hidden;
}
.dsh-kpi::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--accent);
}
.dsh-kpi:nth-child(2)::before { background: var(--positive); }
.dsh-kpi:nth-child(3)::before { background: var(--warning); }
.dsh-kpi:nth-child(4)::before { background: var(--ink-2); }
.dsh-kpi:nth-child(5)::before { background: var(--accent); }
.dsh-kpi-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-tertiary); font-weight: 600; }
.dsh-kpi-value { font-size: 22px; font-weight: 600; color: var(--ink); margin-top: 6px; letter-spacing: -0.015em; line-height: 1.1; }
.dsh-kpi-sub { font-size: 11.5px; color: var(--text-tertiary); margin-top: 4px; }

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

/* Insight — encart phrase à valeur ajoutée, icône XL en pastille */
.dsh-insight {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 16px 18px; border-radius: 12px;
  font-size: 14px; line-height: 1.55; color: var(--text-primary);
  border: 1px solid transparent;
}
.dsh-insight-icon {
  width: 34px; height: 34px; flex-shrink: 0; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff;
  box-shadow: 0 4px 12px -4px currentColor;
}
.dsh-insight strong, .dsh-insight b { font-weight: 600; color: var(--ink); }
.dsh-insight.accent {
  background: linear-gradient(135deg, var(--accent-soft) 0%, rgba(231,235,255,0.4) 100%);
  border-color: rgba(37,64,217,0.18);
}
.dsh-insight.accent .dsh-insight-icon { background: var(--accent); }
.dsh-insight.positive {
  background: linear-gradient(135deg, color-mix(in srgb, var(--positive) 13%, transparent) 0%, color-mix(in srgb, var(--positive) 5%, transparent) 100%);
  border-color: color-mix(in srgb, var(--positive) 22%, transparent);
}
.dsh-insight.positive .dsh-insight-icon { background: var(--positive); }
.dsh-insight.warning {
  background: linear-gradient(135deg, color-mix(in srgb, var(--warning) 14%, transparent) 0%, color-mix(in srgb, var(--warning) 5%, transparent) 100%);
  border-color: color-mix(in srgb, var(--warning) 22%, transparent);
}
.dsh-insight.warning .dsh-insight-icon { background: var(--warning); }

/* Donut + légende */
.dsh-donut { display: grid; grid-template-columns: 180px 1fr; gap: 20px; align-items: center; }
@media (max-width: 560px) { .dsh-donut { grid-template-columns: 1fr; } }
.dsh-donut-chart { position: relative; }
.dsh-donut-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
.dsh-donut-center-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-tertiary); }
.dsh-donut-center-value { font-size: 17px; font-weight: 600; color: var(--ink); margin-top: 2px; }
.dsh-donut-legend { display: flex; flex-direction: column; gap: 9px; }
.dsh-donut-leg { display: flex; align-items: center; gap: 9px; font-size: 13px; }
.dsh-donut-dot { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
.dsh-donut-leg-name { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-donut-leg-meta { color: var(--text-tertiary); font-size: 11.5px; }
.dsh-donut-leg-val { margin-left: auto; color: var(--ink); font-weight: 500; flex-shrink: 0; }

/* Bridge — prix d'achat → valeur actuelle */
.dsh-bridge-bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; background: var(--bg-subtle); }
.dsh-bridge-base { background: var(--accent); }
.dsh-bridge-gain { background: var(--positive); }
.dsh-bridge-labels { display: flex; justify-content: space-between; gap: 16px; margin-top: 10px; font-size: 12.5px; color: var(--text-secondary); flex-wrap: wrap; }
.dsh-bridge-labels b { color: var(--ink); }
.dsh-bridge-labels .pos b { color: var(--positive); }
.dsh-bridge-labels .neg b { color: var(--negative); }
.dsh-bridge-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 6px; }
.dsh-bridge-dot.base { background: var(--accent); }
.dsh-bridge-dot.gain { background: var(--positive); }

/* Footer */
.dsh-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 4px; }
.dsh-foot-owners { font-size: 12.5px; color: var(--text-tertiary); display: inline-flex; align-items: center; gap: 6px; }
`;
