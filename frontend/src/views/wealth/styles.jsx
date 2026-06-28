// ============================================================================
// wealth/styles.js — CSS-in-JS style blocks extracted from Wealth.jsx
// Each component injects its scoped CSS into a <style> tag.
// ============================================================================

export function LiabilityPatchStyles() {
  const css = String.raw`
.loan-cost-band {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 16px;
}
@media (max-width: 720px) { .loan-cost-band { grid-template-columns: 1fr; } }
.loan-cost-item {
  padding: 18px 20px; border-radius: 12px; border: 1px solid var(--border);
  position: relative; overflow: hidden;
}
.loan-cost-item:nth-child(1) { background: linear-gradient(135deg, var(--accent-soft) 0%, rgba(231,235,255,0.3) 100%); }
.loan-cost-item:nth-child(2) { background: linear-gradient(135deg, color-mix(in srgb, var(--positive) 14%, transparent) 0%, color-mix(in srgb, var(--positive) 5%, transparent) 100%); }
.loan-cost-item:nth-child(3) { background: linear-gradient(135deg, var(--bg-sunk) 0%, var(--bg-subtle) 100%); }
.loan-cost-val {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 500;
  font-size: 26px;
  line-height: 1.1;
  color: var(--ink);
  margin-top: 6px;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.loan-cost-meta { color: var(--text-secondary); font-size: 12.5px; margin-top: 8px; line-height: 1.45; }
.loan-cost-meta .w-num, .loan-cost-meta strong { color: var(--ink); font-weight: 600; }
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}

export function RealEstatePatchStyles() {
  const css = String.raw`
.re-finary-page { max-width: 100%; }
.re-finary-page .loan-finary-head { padding: 22px 26px 0; }
.re-finary-page .loan-finary-body { padding: 20px 26px 24px; gap: 16px; }

/* HERO */
.re-finary-page .re-hero {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 28px;
  align-items: end;
  margin-top: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}
@media (max-width: 640px) { .re-finary-page .re-hero { grid-template-columns: 1fr; align-items: start; gap: 14px; } }
.re-finary-page .re-type-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 500;
  padding: 3px 10px;
  background: var(--accent-soft, #E1F1E9);
  color: var(--accent, #0E7C56);
  border-radius: 999px;
  letter-spacing: 0;
  text-transform: none;
}
.re-finary-page .re-name {
  font-family: 'Geist', sans-serif;
  font-weight: 500;
  font-size: 22px;
  line-height: 1.15;
  letter-spacing: -0.02em;
  margin: 8px 0 3px;
  color: var(--ink);
}
.re-finary-page .re-address {
  font-size: 13px;
  color: var(--ink-3);
}
.re-finary-page .re-hero-right { text-align: right; line-height: 1; }
@media (max-width: 640px) { .re-finary-page .re-hero-right { text-align: left; } }
.re-finary-page .re-eyebrow {
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-3);
  font-weight: 500;
}
.re-finary-page .re-hero-value {
  font-family: 'Geist', sans-serif;
  font-weight: 500;
  font-size: 28px;
  line-height: 1.05;
  color: var(--ink);
  margin-top: 6px;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

/* KPI GRID */
.re-finary-page .re-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  margin: 16px 0 4px;
}
@media (max-width: 720px) { .re-finary-page .re-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
.re-finary-page .re-kpi {
  padding: 4px 16px;
  border-left: 1px solid var(--border);
}
.re-finary-page .re-kpi:first-child { padding-left: 0; border-left: none; }
@media (max-width: 720px) {
  .re-finary-page .re-kpi { border-left: none; padding: 8px 0; }
  .re-finary-page .re-kpi:nth-child(2n) { padding-left: 16px; border-left: 1px solid var(--border); }
}
.re-finary-page .re-kpi-label {
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-3);
  font-weight: 500;
}
.re-finary-page .re-kpi-value {
  font-family: 'Geist', sans-serif;
  font-weight: 500;
  font-size: 17px;
  line-height: 1.2;
  color: var(--ink);
  margin-top: 3px;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.re-finary-page .re-kpi-sub {
  font-size: 11.5px;
  color: var(--ink-3);
  margin-top: 2px;
}

/* CARDS — coût d'acquisition + prêt */
.re-finary-page .re-card {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px 22px 16px;
  display: flex; flex-direction: column; gap: 12px;
}
.re-finary-page .re-card-head {
  display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
}
.re-finary-page .re-card-title {
  font-family: 'Geist', sans-serif;
  font-size: 14px; font-weight: 500;
  color: var(--ink); margin: 0;
  letter-spacing: -0.005em;
}
.re-finary-page .re-card-total {
  font-family: 'Geist', sans-serif;
  font-weight: 500;
  font-size: 17px;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.re-finary-page .re-card-link {
  background: none; border: none; padding: 0; cursor: pointer;
  font-size: 12.5px; color: var(--ink-3);
  text-decoration: underline; text-underline-offset: 3px;
  text-decoration-color: var(--border-strong, #D2CEC0);
}
.re-finary-page .re-card-link:hover { color: var(--ink); text-decoration-color: var(--ink-3); }

/* Rows label/valeur */
.re-finary-page .re-rows {
  list-style: none;
  margin: 0;
  padding: 10px 0 0;
  border-top: 1px solid var(--border);
  display: flex; flex-direction: column;
  gap: 8px;
}
.re-finary-page .re-rows li {
  display: flex; justify-content: space-between; align-items: baseline;
  gap: 16px; font-size: 13px; color: var(--ink-2);
}
.re-finary-page .re-rows li .w-num { color: var(--ink); font-weight: 500; font-variant-numeric: tabular-nums; }

/* PRÊT — headline + progress bar */
.re-finary-page .re-loan-headline {
  display: flex; justify-content: space-between; align-items: flex-end; gap: 12px;
  padding-top: 2px;
}
.re-finary-page .re-loan-big {
  font-family: 'Geist', sans-serif;
  font-weight: 500;
  font-size: 24px;
  line-height: 1.05;
  color: var(--ink);
  margin-top: 3px;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.re-finary-page .re-loan-pct {
  font-family: 'Geist', sans-serif;
  font-size: 18px;
  font-weight: 500;
  color: var(--accent, #0E7C56);
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}
.re-finary-page .re-loan-pct span {
  font-size: 11.5px; color: var(--ink-3); font-weight: 400; margin-left: 4px;
}
.re-finary-page .re-progress {
  height: 6px;
  background: var(--bg-sunk, #EFEDE6);
  border-radius: 999px;
  overflow: hidden;
}
.re-finary-page .re-progress-fill {
  height: 100%;
  background: var(--accent, #0E7C56);
  border-radius: 999px;
  transition: width .3s ease;
}
.re-finary-page .re-progress-legend {
  font-size: 11.5px;
  color: var(--ink-3);
  display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap;
}
.re-finary-page .re-progress-legend .w-num { color: var(--ink-2); font-weight: 500; }
.re-finary-page .re-progress-legend .re-sep { color: var(--ink-3); opacity: 0.5; }

.re-finary-page .re-loan-foot {
  display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
  padding-top: 12px; margin-top: 4px;
  border-top: 1px solid var(--border);
}
@media (max-width: 540px) { .re-finary-page .re-loan-foot { grid-template-columns: 1fr; gap: 14px; } }
.re-finary-page .re-loan-foot-val {
  font-family: 'Geist', sans-serif; font-weight: 500;
  font-size: 16px; color: var(--ink);
  margin-top: 3px; font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.re-finary-page .re-loan-foot-sub { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; }

/* Footer */
.re-finary-page .re-footer {
  display: flex; justify-content: space-between; align-items: center;
  gap: 16px; padding-top: 4px;
}
.re-finary-page .re-owners {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12.5px; color: var(--ink-3);
}
@media (max-width: 540px) {
  .re-finary-page .re-footer { flex-direction: column; align-items: flex-start; }
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}

export function InvestmentDetailStyles() {
  const css = `
.inv-v3-page {
  max-width: 1180px; width: 95vw;
  max-height: 92vh;
  display: flex; flex-direction: column;
  padding: 0;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}
.inv-v3-page .num { font-variant-numeric: tabular-nums; }
.inv-v3-page .mono { font-family: var(--font-mono); }
.inv-v3-page .cell-r { text-align: right; }

/* Header */
.inv-v3-head {
  position: relative;
  padding: 18px 28px 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elev);
}
.inv-v3-head .drawer-back {
  background: transparent; border: none; padding: 0;
  display: inline-flex; align-items: center; gap: 6px;
  font: 500 12px/1 var(--font-sans);
  color: var(--ink-3);
  cursor: pointer;
  margin-bottom: 14px;
  transition: color var(--t-fast);
}
.inv-v3-head .drawer-back:hover { color: var(--ink); }
.inv-v3-head .drawer-close {
  position: absolute; top: 16px; right: 18px;
  width: 32px; height: 32px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-elev);
  color: var(--ink-2);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
}
.inv-v3-head .drawer-close:hover { background: var(--bg-hover); color: var(--ink); }

.inv-v3-title-row {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 24px; flex-wrap: wrap;
}
.inv-v3-title-block { min-width: 0; flex: 1; }
.inv-v3-eyebrow {
  font: 500 11px/1.2 var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 4px;
}
.inv-v3-title {
  font: 500 26px/1.15 var(--font-sans);
  letter-spacing: -0.02em;
  color: var(--ink);
  margin: 0 0 6px;
}
.inv-v3-title em {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.03em;
  color: var(--ink-2);
}
.inv-v3-sub {
  display: inline-flex; align-items: center; gap: 6px;
  font: 400 13px/1.4 var(--font-sans);
  color: var(--ink-3);
}
.inv-v3-dot { color: var(--ink-mute); padding: 0 2px; }

.inv-v3-value-block { text-align: right; }
.inv-v3-hero-num {
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: 38px;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--ink);
}
.inv-v3-hero-delta {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  font: 500 13px/1 var(--font-sans);
}
.inv-v3-hero-delta.pos { background: var(--positive-soft); color: var(--positive); }
.inv-v3-hero-delta.neg { background: var(--negative-soft); color: var(--negative); }

/* KPI strip */
.inv-v3-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  margin: 20px -28px 0;
  border-top: 1px solid var(--border);
}
.inv-v3-kpi {
  padding: 14px 20px;
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 4px;
}
.inv-v3-kpi:last-child { border-right: none; }
.inv-v3-kpi-val {
  font: 500 16px/1.1 var(--font-sans);
  color: var(--ink);
}
.inv-v3-kpi-meta {
  font: 400 11px/1 var(--font-sans);
  color: var(--ink-3);
  margin-left: 4px;
}

/* Body */
.inv-v3-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px;
  background: var(--bg);
}
.inv-v3-panel { background: var(--bg-elev); }

.inv-v3-table-wrap { padding: 0; }
.inv-v3-cols {
  display: grid;
  grid-template-columns: 2.2fr 0.9fr 0.9fr 1fr 1.2fr;
  gap: 14px;
  padding: 10px 20px;
  background: var(--bg-sunk);
  border-bottom: 1px solid var(--border);
}
.inv-v3-row {
  display: grid;
  grid-template-columns: 2.2fr 0.9fr 0.9fr 1fr 1.2fr;
  gap: 14px;
  align-items: center;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  transition: background var(--t-fast);
}
.inv-v3-row:first-of-type { border-top: none; }
.inv-v3-row:hover { background: var(--bg-hover); }

.inv-v3-name { display: flex; align-items: center; gap: 12px; min-width: 0; }
.inv-v3-logo {
  width: 32px; height: 32px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  font: 600 12px/1 var(--font-sans);
  letter-spacing: 0.02em;
  flex-shrink: 0;
}
.inv-v3-logo-cash {
  background: var(--bg-sunk);
  color: var(--ink-2);
  border: 1px solid var(--border);
  font-family: var(--font-serif);
  font-size: 16px;
}
.inv-v3-name-block { min-width: 0; }
.inv-v3-name-line {
  font: 500 14px/1.2 var(--font-sans);
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inv-v3-name-meta {
  font: 400 11px/1.2 var(--font-mono);
  color: var(--ink-3);
  margin-top: 2px;
  letter-spacing: 0.02em;
}

.inv-v3-val { font: 500 14px/1.2 var(--font-sans); color: var(--ink); }

/* Cellules éditables inline */
.inv-v3-editable {
  cursor: text;
  border-radius: 4px;
  padding: 4px 6px;
  margin: -4px -6px;
  transition: background var(--t-fast), box-shadow var(--t-fast);
  position: relative;
}
.inv-v3-editable:hover {
  background: var(--bg-hover);
  box-shadow: inset 0 0 0 1px var(--border-strong);
}
.inv-v3-editable:focus-visible {
  outline: none;
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent);
}
.inv-v3-edit-cell {
  padding: 0;
}
.inv-v3-edit-cell input {
  width: 100%;
  height: 32px;
  text-align: right;
  padding: 0 8px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: var(--bg-elev);
  color: var(--ink);
  font: 500 14px/1 var(--font-sans);
  font-variant-numeric: tabular-nums;
  box-shadow: 0 0 0 3px var(--accent-soft);
  outline: none;
}

/* Footer "Cours live via Yahoo Finance" */
.lpf-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  background: linear-gradient(90deg, var(--bg-sunk) 0%, var(--accent-soft) 100%);
  font: 400 12px/1.4 var(--font-sans);
  color: var(--ink-2);
  flex-wrap: wrap;
}
.lpf-left { display: inline-flex; align-items: center; gap: 8px; }
.lpf-bar .lpf-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--positive);
  box-shadow: 0 0 0 0 var(--positive-soft);
  animation: lpf-pulse 2.5s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes lpf-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(19, 109, 62, 0.4); }
  50%      { box-shadow: 0 0 0 6px rgba(19, 109, 62, 0); }
}
.lpf-bar em {
  font-family: var(--font-serif);
  font-style: italic;
  color: var(--accent-2);
  font-weight: 500;
}
.lpf-bar strong { color: var(--ink); font-weight: 500; }
.lpf-bar .lpf-sep { color: var(--ink-mute); padding: 0 6px; }
.lpf-refresh {
  display: inline-flex; align-items: center; gap: 6px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-elev);
  color: var(--ink-2);
  cursor: pointer;
  font: 500 11.5px/1 var(--font-sans);
  letter-spacing: 0.02em;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.lpf-refresh:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--ink);
  border-color: var(--border-strong);
}
.lpf-refresh:disabled { opacity: 0.6; cursor: default; }
.inv-v3-pl { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; font: 500 13px/1.2 var(--font-sans); }
.inv-v3-pl.pos { color: var(--positive); }
.inv-v3-pl.neg { color: var(--negative); }
.inv-v3-pl-pct { font-size: 11px; opacity: 0.8; }

.inv-v3-cash-row {
  display: grid;
  grid-template-columns: 2.2fr 0.9fr 0.9fr 1fr 1.2fr;
  gap: 14px;
  align-items: center;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  background: var(--bg-sunk);
}
.inv-v3-cash-row > .cell-r { grid-column: 5; }

.inv-v3-empty { padding: 0; }
.inv-v3-empty-inner {
  padding: 48px 24px;
  text-align: center;
  color: var(--ink-3);
}
.inv-v3-empty-inner svg { color: var(--ink-3); margin-bottom: 12px; }
.inv-v3-empty-inner h3 {
  margin: 0 0 8px;
  font: 500 16px/1.2 var(--font-sans);
  color: var(--ink);
}
.inv-v3-empty-inner p {
  margin: 0 auto;
  max-width: 520px;
  font: 400 13px/1.55 var(--font-sans);
}
.inv-v3-empty-inner strong { color: var(--ink); font-weight: 500; }

/* Footer */
.inv-v3-foot {
  padding: 14px 28px;
  border-top: 1px solid var(--border);
  background: var(--bg-elev);
  display: flex; justify-content: flex-end; gap: 8px;
}

/* Mobile */
@media (max-width: 720px) {
  .inv-v3-page { width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; }
  .inv-v3-head { padding: 14px 18px 0; }
  .inv-v3-head .drawer-close { top: 12px; right: 12px; }
  .inv-v3-title { font-size: 22px; }
  .inv-v3-hero-num { font-size: 30px; }
  .inv-v3-kpis { margin: 16px -18px 0; grid-template-columns: repeat(2, 1fr); }
  .inv-v3-kpi { padding: 12px 16px; }
  .inv-v3-kpi:nth-child(2n) { border-right: none; }
  .inv-v3-body { padding: 14px; }
  .inv-v3-cols,
  .inv-v3-row,
  .inv-v3-cash-row {
    grid-template-columns: 1.5fr 1fr 1.1fr;
    gap: 10px;
    padding: 12px 14px;
  }
  .inv-v3-cols > div:nth-child(2),
  .inv-v3-cols > div:nth-child(3),
  .inv-v3-row > .cell-r:nth-child(2),
  .inv-v3-row > .cell-r:nth-child(3) { display: none; }
  .inv-v3-cash-row > .cell-r { grid-column: 3; }
  .inv-v3-foot { padding: 12px 18px; }
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}

export function DetailV3Styles() {
  const css = String.raw`
.dv3-page {
  max-width: 1100px; width: 95vw;
  max-height: 92vh;
  display: flex; flex-direction: column;
  padding: 0;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}
.dv3-page-narrow { max-width: 720px; }
.dv3-page .num { font-variant-numeric: tabular-nums; }
.dv3-page .mono { font-family: var(--font-mono); }
.dv3-page .pos { color: var(--positive); }
.dv3-page .neg { color: var(--negative); }

/* Header */
.dv3-head {
  position: relative;
  padding: 18px 28px 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elev);
}
.dv3-back {
  background: transparent; border: none; padding: 0;
  display: inline-flex; align-items: center; gap: 6px;
  font: 500 12px/1 var(--font-sans);
  color: var(--ink-3);
  cursor: pointer;
  margin-bottom: 14px;
  transition: color var(--t-fast);
}
.dv3-back:hover { color: var(--ink); }
.dv3-close {
  position: absolute; top: 16px; right: 18px;
  width: 32px; height: 32px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-elev);
  color: var(--ink-2);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
}
.dv3-close:hover { background: var(--bg-hover); color: var(--ink); }

.dv3-title-row {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 24px; flex-wrap: wrap;
}
.dv3-title-block { min-width: 0; flex: 1; }
.dv3-title-block-with-logo {
  display: flex; align-items: flex-start; gap: 14px;
  min-width: 0; flex: 1;
}
.dv3-eyebrow {
  font: 500 11px/1.2 var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 4px;
}
.dv3-title {
  font: 500 26px/1.15 var(--font-sans);
  letter-spacing: -0.02em;
  color: var(--ink);
  margin: 0 0 6px;
}
.dv3-title em {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.03em;
  color: var(--ink-2);
}
.dv3-sub {
  display: inline-flex; align-items: center; gap: 8px;
  font: 400 13px/1.4 var(--font-sans);
  color: var(--ink-3);
  flex-wrap: wrap;
}
.dv3-dot { color: var(--ink-mute); padding: 0 2px; }
.dv3-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px;
  font: 500 11px/1.4 var(--font-sans);
  letter-spacing: 0.02em;
  background: var(--neutral-soft);
  color: var(--ink-2);
  border-radius: 999px;
}
.dv3-badge.pos { background: var(--positive-soft); color: var(--positive); }
.dv3-badge-live {
  background: var(--positive-soft);
  color: var(--positive);
  position: relative;
}
.dv3-badge-live::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 50%; transform: translateY(-50%);
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--positive);
  animation: dv3-pulse 2s ease-in-out infinite;
}
.dv3-badge-live { padding-left: 20px; }
.dv3-live-tag {
  color: var(--positive);
  font-weight: 600;
  font-size: 10px;
  letter-spacing: 0.04em;
}
@keyframes dv3-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
@keyframes spin { to { transform: rotate(360deg); } }

.dv3-crypto-logo {
  width: 44px; height: 44px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  font: 700 11px/1 var(--font-mono);
  letter-spacing: 0.04em;
  flex-shrink: 0;
}
.dv3-other-logo {
  width: 44px; height: 44px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--accent-soft);
  color: var(--accent-2);
  flex-shrink: 0;
}

.dv3-value-block { text-align: right; }
.dv3-hero-num {
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: 38px;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--ink);
}
.dv3-hero-delta {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  font: 500 13px/1 var(--font-sans);
}
.dv3-hero-delta.pos { background: var(--positive-soft); color: var(--positive); }
.dv3-hero-delta.neg { background: var(--negative-soft); color: var(--negative); }

/* KPI strip */
.dv3-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  margin: 20px -28px 0;
  border-top: 1px solid var(--border);
}
.dv3-kpi {
  padding: 14px 20px;
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 4px;
}
.dv3-kpi:last-child { border-right: none; }
.dv3-kpi-val {
  font: 500 15px/1.2 var(--font-sans);
  color: var(--ink);
}
.dv3-kpi-meta {
  font: 400 11px/1 var(--font-sans);
  color: var(--ink-3);
  margin-left: 2px;
  font-weight: 400;
}
.dv3-kpi-val.pos { color: var(--positive); }
.dv3-kpi-val.neg { color: var(--negative); }

/* Body */
.dv3-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px;
  background: var(--bg);
  display: flex; flex-direction: column; gap: 14px;
}
.dv3-body .ds-panel { background: var(--bg-elev); }
.dv3-chart-pad { padding: 16px 20px 20px; }

/* KV list (clé/valeur) */
.dv3-kv-list { padding: 4px 0 12px; }
.dv3-kv-row {
  display: flex; justify-content: space-between; align-items: baseline;
  gap: 16px;
  padding: 10px 20px;
  border-top: 1px solid var(--border);
  font: 400 13px/1.4 var(--font-sans);
  color: var(--ink-2);
}
.dv3-kv-row:first-child { border-top: none; }
.dv3-kv-row > span:first-child { color: var(--ink-2); }
.dv3-kv-row > span:last-child { color: var(--ink); text-align: right; }
.dv3-kv-row em { font-family: var(--font-serif); font-style: italic; font-size: 12px; color: var(--ink-3); }
.dv3-kv-sep { border-top: 1px solid var(--border-strong); margin-top: 4px; }
.dv3-kv-bold { font: 500 15px/1.2 var(--font-sans); }
.dv3-kv-pct { font-size: 12px; font-weight: 400; opacity: 0.85; }
.dv3-kv-notes { flex-direction: column; align-items: flex-start; gap: 4px; }
.dv3-kv-notes-text {
  font-family: var(--font-serif); font-style: italic; font-size: 14px;
  color: var(--ink-2); text-align: left !important;
  margin-top: 4px;
}

/* Transactions list */
.dv3-tx-list { padding: 0 0 6px; }
.dv3-tx-row {
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  transition: background var(--t-fast);
}
.dv3-tx-row:hover { background: var(--bg-hover); }
.dv3-tx-info { min-width: 0; }
.dv3-tx-label {
  font: 500 13.5px/1.2 var(--font-sans);
  color: var(--ink);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dv3-tx-meta {
  font: 400 11.5px/1.2 var(--font-sans);
  color: var(--ink-3);
  margin-top: 2px;
}
.dv3-tx-amount {
  font: 500 14px/1.2 var(--font-sans);
  color: var(--ink);
  flex-shrink: 0;
}
.dv3-tx-amount.pos { color: var(--positive); }

/* Livret progress */
.dv3-livret-body { padding: 16px 20px 20px; }
.dv3-livret-bar {
  height: 8px;
  background: var(--bg-sunk);
  border-radius: 4px;
  overflow: hidden;
}
.dv3-livret-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
  transition: width var(--t-med);
}
.dv3-livret-labels {
  display: flex; justify-content: space-between;
  margin-top: 10px;
  font: 400 12px/1.3 var(--font-sans);
  color: var(--ink-2);
}
.dv3-livret-margin { color: var(--ink-3); }
.dv3-livret-yield {
  font: 500 14px/1.2 var(--font-sans);
}

/* Notes panel */
.dv3-notes-body {
  padding: 16px 20px 20px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 15px;
  line-height: 1.6;
  color: var(--ink-2);
}

/* Empty state */
.dv3-empty {
  padding: 36px 24px;
  text-align: center;
  color: var(--ink-3);
}
.dv3-empty svg { color: var(--ink-3); margin-bottom: 12px; }
.dv3-empty h3 {
  margin: 0 0 8px;
  font: 500 15px/1.2 var(--font-sans);
  color: var(--ink);
}
.dv3-empty p {
  margin: 0 auto;
  max-width: 460px;
  font: 400 13px/1.55 var(--font-sans);
}

/* Footer */
.dv3-foot {
  padding: 14px 28px;
  border-top: 1px solid var(--border);
  background: var(--bg-elev);
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
}
.dv3-foot-meta {
  font: 400 12px/1.3 var(--font-sans);
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}
.dv3-foot-meta:empty { display: none; }

/* Mobile */
@media (max-width: 720px) {
  .dv3-page { width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; }
  .dv3-head { padding: 14px 18px 0; }
  .dv3-close { top: 12px; right: 12px; }
  .dv3-title { font-size: 22px; }
  .dv3-hero-num { font-size: 30px; }
  .dv3-kpis { margin: 16px -18px 0; grid-template-columns: repeat(2, 1fr); }
  .dv3-kpi { padding: 12px 16px; }
  .dv3-kpi:nth-child(2n) { border-right: none; }
  .dv3-body { padding: 14px; }
  .dv3-foot { padding: 12px 18px; }
  .dv3-kv-row { padding: 10px 14px; }
  .dv3-tx-row { padding: 10px 14px; }
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}
