/**
 * Wealthly — bilan patrimonial PDF via HTML/CSS + impression navigateur.
 *
 * Rapport « banque privée » : couverture institutionnelle, pied de page répété,
 * note de synthèse, courbe d'évolution en aire, score de santé, donut de
 * composition, Sankey des flux, tableaux détaillés. Style papier-chaud + cobalt,
 * SVG natif (texte vectoriel net). Pagination par le navigateur (@page A4).
 *
 * Les CALCULS sont repris à l'identique de l'app (pdfReport.js + HealthScore) —
 * seule la FORME est élevée.
 */
import { computeHealthScore } from './components/HealthScore.jsx';

const PALETTE = ['#2540D9', '#1F8E6E', '#C2733B', '#7B57C6', '#B85D7A', '#4D4D4D', '#E0B23E'];
const C = {
  ink: '#16150F', body: '#38362D', muted: '#56544A', faint: '#8C8979',
  accent: '#2540D9', accent2: '#1A2FA8', sage: '#136D3E', terracotta: '#B0392B', amber: '#8E641A',
  border: '#E4E1D8', strong: '#D2CEC0', sunk: '#EFEDE6', paper: '#F7F6F2',
};

const nf = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur = (v, sign = false) => {
  if (v == null || isNaN(v)) return '—';
  const s = nf.format(Math.abs(v));
  if (v < 0) return `−${s}`;
  if (sign && v > 0) return `+${s}`;
  return s;
};
const pct = (v, d = 1) => (v == null ? '—' : `${v.toFixed(d)} %`);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const todayLong = () => new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const monthLong = (mk) => { if (!mk) return ''; const [y, m] = mk.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); };
const monthShort = (mk) => { if (!mk) return ''; const [y, m] = mk.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }); };

// ── donut ──
function donutSvg(segments) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 54, Circ = 2 * Math.PI * r; let off = 0;
  const arcs = segments.map((s) => {
    const dash = (s.value / total) * Circ;
    const a = `<circle cx="76" cy="76" r="${r}" fill="none" stroke="${s.color}" stroke-width="19" stroke-dasharray="${dash.toFixed(2)} ${(Circ - dash).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
    off += dash; return a;
  }).join('');
  return `<svg width="152" height="152" viewBox="0 0 152 152" style="transform:rotate(-90deg)"><circle cx="76" cy="76" r="${r}" fill="none" stroke="${C.sunk}" stroke-width="19"/>${arcs}</svg>`;
}

// ── Sankey ──
function ribbon(xL, yLt, yLb, xR, yRt, yRb, color, op) {
  const cx = (xL + xR) / 2;
  return `<path d="M${xL},${yLt} C${cx},${yLt} ${cx},${yRt} ${xR},${yRt} L${xR},${yRb} C${cx},${yRb} ${cx},${yLb} ${xL},${yLb} Z" fill="${color}" fill-opacity="${op}"/>`;
}
function sankeySvg(incomes, outflows) {
  const top = 20, span = 260;
  const total = Math.max(incomes.reduce((s, d) => s + d.value, 0), outflows.reduce((s, d) => s + d.value, 0), 1);
  const h = (v) => (v / total) * span;
  const xInBar = 142, inW = 8, xHub = 348, hubW = 12, xOutBar = 556, outW = 8;
  const xLin = xInBar + inW, xRin = xHub, xLout = xHub + hubW, xRout = xOutBar;
  let ribbons = '', cL = top, cH = top;
  incomes.forEach((d) => { const hh = h(d.value); ribbons += ribbon(xLin, cL, cL + hh, xRin, cH, cH + hh, d.color, 0.28); cL += hh; cH += hh; });
  let cHo = top, cR = top;
  outflows.forEach((d) => { const hh = h(d.value); ribbons += ribbon(xLout, cHo, cHo + hh, xRout, cR, cR + hh, d.color, 0.34); cHo += hh; cR += hh; });
  let nodes = ''; cL = top;
  incomes.forEach((d, i) => {
    const hh = h(d.value), yc = cL + hh / 2;
    nodes += `<rect x="${xInBar}" y="${cL.toFixed(1)}" width="${inW}" height="${Math.max(hh, 2).toFixed(1)}" rx="2" fill="${d.color}"/>`;
    nodes += `<text x="${xInBar - 6}" y="${yc.toFixed(1)}" text-anchor="end" dominant-baseline="middle" style="font:500 11px Geist,sans-serif;fill:${C.ink}">${esc(d.name)}</text>`;
    if (i === 0) nodes += `<text x="${xInBar - 6}" y="${(yc + 13).toFixed(1)}" text-anchor="end" dominant-baseline="middle" style="font:400 9.5px monospace;fill:${C.faint}">${eur(d.value)}</text>`;
    cL += hh;
  });
  nodes += `<rect x="${xHub}" y="${top}" width="${hubW}" height="${span}" rx="3" fill="${C.ink}"/>`;
  nodes += `<text x="${xHub + hubW / 2}" y="${top - 7}" text-anchor="middle" style="font:600 9px Geist,sans-serif;fill:${C.faint};letter-spacing:1.2px">DISPONIBLE</text>`;
  cR = top;
  outflows.forEach((d) => {
    const hh = h(d.value), yc = cR + hh / 2;
    nodes += `<rect x="${xOutBar}" y="${cR.toFixed(1)}" width="${outW}" height="${Math.max(hh, 2).toFixed(1)}" rx="2" fill="${d.color}"/>`;
    nodes += `<text x="${xOutBar + outW + 6}" y="${yc.toFixed(1)}" dominant-baseline="middle" style="font:${d.savings ? 600 : 500} 11px Geist,sans-serif;fill:${d.savings ? C.sage : C.ink}">${esc(d.name)}</text>`;
    if (d.savings || hh > 18) nodes += `<text x="${xOutBar + outW + 6}" y="${(yc + 13).toFixed(1)}" dominant-baseline="middle" style="font:400 9.5px monospace;fill:${C.faint}">${eur(d.value)}</text>`;
    cR += hh;
  });
  return `<svg viewBox="0 0 700 300" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block">${ribbons}${nodes}</svg>`;
}

// ── courbe d'évolution (aire) ──
function areaChartSvg(series) {
  if (!series || series.length < 2) return '<p class="empty">Historique insuffisant pour tracer la courbe.</p>';
  const W = 680, H = 168, padL = 4, padR = 4, padT = 16, padB = 26;
  const vals = series.map((s) => s.value);
  const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1;
  const n = series.length;
  const x = (i) => padL + i * (W - padL - padR) / (n - 1);
  const y = (v) => padT + (1 - (v - min) / range) * (H - padT - padB);
  const line = series.map((s, i) => `${x(i).toFixed(1)},${y(s.value).toFixed(1)}`).join(' ');
  const area = `${padL},${(H - padB).toFixed(1)} ${line} ${(W - padR).toFixed(1)},${(H - padB).toFixed(1)}`;
  const last = series[n - 1];
  // étiquettes axe (first/last) + min/max
  const xlabs = `<text x="${padL}" y="${H - 8}" style="font:400 9px monospace;fill:${C.faint}">${esc(series[0].label)}</text>
    <text x="${W - padR}" y="${H - 8}" text-anchor="end" style="font:400 9px monospace;fill:${C.faint}">${esc(last.label)}</text>`;
  const dots = series.map((s, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(s.value).toFixed(1)}" r="1.6" fill="${C.accent}" opacity="0.5"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.16"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></linearGradient></defs>
    <polygon points="${area}" fill="url(#ag)"/>
    <polyline points="${line}" fill="none" stroke="${C.accent}" stroke-width="2" stroke-linejoin="round"/>
    ${dots}
    <circle cx="${x(n - 1).toFixed(1)}" cy="${y(last.value).toFixed(1)}" r="3.6" fill="${C.accent}"/>
    <text x="${(x(n - 1) - 4).toFixed(1)}" y="${(y(last.value) - 8).toFixed(1)}" text-anchor="end" style="font:500 10px Geist,sans-serif;fill:${C.ink}">${eur(last.value)}</text>
    ${xlabs}
  </svg>`;
}

// ── briques ──
const partHead = (no, title, sub = '') => `<div class="part-head"><span class="part-no">${no}</span><h2>${esc(title)}</h2>${sub ? `<span class="part-sub">${esc(sub)}</span>` : ''}</div>`;
const kpi = (k) => `<div class="kpi ${k.tone || 'a'}"><div class="kpi-l">${esc(k.label)}</div><div class="kpi-v"${k.color ? ` style="color:${k.color}"` : ''}>${k.value}</div>${k.hint ? `<div class="kpi-s">${esc(k.hint)}</div>` : ''}</div>`;
function table(headers, rows, aligns = []) {
  if (!rows.length) rows = [headers.map(() => '—')];
  const th = headers.map((hh, i) => `<th${aligns[i] === 'r' ? ' class="r"' : ''}>${esc(hh)}</th>`).join('');
  const trs = rows.map((r) => `<tr>${r.map((c, i) => `<td${aligns[i] === 'r' ? ' class="r"' : ''}>${c}</td>`).join('')}</tr>`).join('');
  return `<table class="tbl"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

function buildSynthesis({ netWorth, nwDeltaPct, savingsRate, debtRatio, immoNet, cashWealth, scoreTotal }) {
  const p = [];
  if (nwDeltaPct != null) p.push(`Sur le dernier mois, votre patrimoine net ${nwDeltaPct >= 0 ? 'progresse' : 'recule'} de <b>${Math.abs(nwDeltaPct).toFixed(1)} %</b> pour s'établir à <b>${eur(netWorth)}</b>`);
  else p.push(`Votre patrimoine net s'établit à <b>${eur(netWorth)}</b>`);
  if (savingsRate != null) p.push(`Votre taux d'épargne ressort à <b>${savingsRate.toFixed(0)} %</b> ce mois-ci${savingsRate >= 20 ? ', au-dessus du repère des 20 %' : ''}`);
  if (debtRatio != null) p.push(`Le ratio d'endettement s'élève à <b>${debtRatio.toFixed(0)} %</b>${debtRatio < 30 ? ' — un niveau sain' : debtRatio < 50 ? ', à surveiller' : ', élevé'}`);
  if (scoreTotal != null) p.push(`La santé patrimoniale globale est notée <b>${scoreTotal}/100</b>`);
  return p.join('. ') + '.';
}

function scoreBlock(score) {
  const col = score.total < 40 ? C.terracotta : score.total < 70 ? C.amber : C.sage;
  const items = (score.items || []).map((it) => {
    const w = it.max > 0 ? Math.round((it.pts / it.max) * 100) : 0;
    return `<div class="sc-row">
      <div class="sc-row-top"><span class="sc-name">${esc(it.label)}</span><span class="sc-val">${esc(it.value)} <em>${Math.round(it.pts)}/${it.max}</em></span></div>
      <div class="sc-track"><i style="width:${w}%;background:${col}"></i></div>
    </div>`;
  }).join('');
  return `<div class="score">
    <div class="score-gauge">
      <div class="score-num serif" style="color:${col}">${score.total}<span>/100</span></div>
      <div class="score-lab">Score de santé patrimoniale</div>
      <div class="score-bar"><i style="width:${score.total}%;background:${col}"></i></div>
      <div class="score-cap">${score.total < 40 ? 'À consolider' : score.total < 70 ? 'Correct' : 'Solide'} · moyenne sur ${score.monthsCovered || 0} mois</div>
    </div>
    <div class="score-items">${items}</div>
  </div>`;
}

// ── document ──
export function generateBilanHtmlReport(data) {
  const {
    netWorth, liquidWealth, assetsValue, liabilitiesValue,
    thisMonthStats, monthlyEvolution = [], wealthHistory = [], budgets = {},
    visibleAccounts = [], accountBalances = {}, visibleAssets = [], visibleLiabilities = [],
    members = [], activeMemberId, recurringGroups = [], categoryAnalysis = {}, categories = [],
    memberShare = () => 1, currentMonth, ASSET_CLASS_MAP = {},
  } = data;

  const activeMember = members.find((m) => m.id === activeMemberId);
  const ownerName = activeMember ? activeMember.name : 'Votre foyer';

  // ── calculs (repris de l'app) ──
  const sorted = [...monthlyEvolution].sort((a, b) => a.month.localeCompare(b.month));
  let perf1m = null;
  if (sorted.length >= 2) { const a = sorted.at(-1).balance, b = sorted.at(-2).balance; if (b !== 0) perf1m = ((a - b) / Math.abs(b)) * 100; }
  const debtRatio = (assetsValue + liquidWealth) > 0 ? (liabilitiesValue / (assetsValue + liquidWealth)) * 100 : null;
  const actifsTotal = liquidWealth + assetsValue;
  const immoAssets = visibleAssets.reduce((s, a) => (ASSET_CLASS_MAP?.[a.type]?.class === 'Immobilier' ? s + (parseFloat(a.currentValue) || 0) * memberShare(a) : s), 0);
  const mortgageDebt = visibleLiabilities.reduce((s, l) => (l.type === 'mortgage' ? s + (parseFloat(l.remainingCapital ?? l.remaining_capital ?? 0) || 0) * memberShare(l) : s), 0);
  const immoNet = immoAssets - mortgageDebt;
  const cashWealth = actifsTotal - immoAssets;

  const wh = [...wealthHistory].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  let nwDelta = null, nwDeltaPct = null;
  if (wh.length >= 2) {
    const a = wh.at(-1).net_worth ?? wh.at(-1).netWorth, b = wh.at(-2).net_worth ?? wh.at(-2).netWorth;
    if (typeof a === 'number' && typeof b === 'number') { nwDelta = a - b; if (b !== 0) nwDeltaPct = (nwDelta / Math.abs(b)) * 100; }
  }
  const nwSeries = (wh.length >= 2
    ? wh.map((s) => ({ label: monthShort(s.month), value: s.net_worth ?? s.netWorth ?? 0 }))
    : sorted.map((m) => ({ label: monthShort(m.month), value: m.balance || 0 }))).slice(-12);

  // allocation
  const allocClasses = {};
  if (liquidWealth > 0) allocClasses['Liquidités'] = liquidWealth;
  visibleAssets.forEach((a) => {
    const cls = ASSET_CLASS_MAP?.[a.type]?.class || 'Divers';
    allocClasses[cls] = (allocClasses[cls] || 0) + (parseFloat(a.currentValue) || 0) * memberShare(a);
  });
  const allocSegments = Object.entries(allocClasses).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }));
  const allocTotal = allocSegments.reduce((s, x) => s + x.value, 0) || 1;

  // score
  const score = computeHealthScore({ monthlyEvolution, liquidWealth, assetsValue, liabilitiesValue, visibleAssets, budgets, categoryAnalysis });

  // trésorerie + sankey
  const savingsRate = thisMonthStats?.income > 0 ? (thisMonthStats.net / thisMonthStats.income) * 100 : null;
  const skIncome = thisMonthStats?.income || 0, skExpenses = thisMonthStats?.expenses || 0, skNet = thisMonthStats?.net || 0;
  let sankey = '', sankeyFoot = '';
  if (skIncome > 0 || skExpenses > 0) {
    const expCats = Object.entries(categoryAnalysis || {}).filter(([, d]) => d.current > 0)
      .map(([id, d]) => ({ name: categories.find((c) => c.id === id)?.name || id, value: d.current })).sort((a, b) => b.value - a.value);
    const expColors = [PALETTE[2], PALETTE[4], PALETTE[3], PALETTE[6], C.amber];
    const top5 = expCats.slice(0, 5).map((c, i) => ({ ...c, color: expColors[i % expColors.length] }));
    const otherExp = Math.max(0, skExpenses - top5.reduce((s, c) => s + c.value, 0));
    const outflows = [...top5];
    if (otherExp > 1) outflows.push({ name: 'Autres dépenses', value: otherExp, color: PALETTE[5] });
    if (skNet > 0) outflows.push({ name: 'Épargne', value: skNet, color: C.sage, savings: true });
    if (!outflows.length) outflows.push({ name: 'Dépenses', value: skExpenses || 1, color: C.terracotta });
    sankey = sankeySvg([{ name: 'Revenus', value: skIncome || skExpenses, color: C.accent }], outflows);
    const rate = skIncome > 0 ? (skNet / skIncome) * 100 : 0;
    sankeyFoot = `<div class="sk-foot"><div>Entrées <b class="pos">${eur(skIncome, true)}</b></div><div>Sorties <b class="neg">${eur(-skExpenses)}</b></div><div>Épargne <b class="${skNet >= 0 ? 'pos' : 'neg'}">${eur(skNet, true)}</b> <span style="color:${C.faint}">(${rate.toFixed(0)} %)</span></div></div>`;
  } else sankey = `<p class="empty">Pas de mouvements ce mois-ci.</p>`;

  // top dépenses
  const topRows = Object.entries(categoryAnalysis || {}).filter(([, d]) => d.current > 0)
    .map(([id, d]) => { const cat = categories.find((c) => c.id === id); const ch = d.avg3m > 0 ? ((d.current - d.avg3m) / d.avg3m) * 100 : 0; return { name: cat?.name || id, current: d.current, avg: d.avg3m, change: ch }; })
    .sort((a, b) => b.current - a.current).slice(0, 8)
    .map((c) => [esc(c.name), eur(c.current), eur(c.avg), Math.abs(c.change) > 5 ? `<span style="color:${c.change > 0 ? C.terracotta : C.sage}">${c.change > 0 ? '+' : ''}${c.change.toFixed(0)} %</span>` : '—']);

  // charges fixes
  const now = new Date();
  const recRows = (recurringGroups || []).filter((rg) => { const ld = new Date(rg.lastDate); return ((now.getFullYear() - ld.getFullYear()) * 12 + (now.getMonth() - ld.getMonth())) <= 2; })
    .map((rg) => { const acc = visibleAccounts.find((a) => a.id === rg.accountId); const sh = acc ? memberShare(acc) : 1; return { ...rg, sharedAmount: rg.avgAmount * sh, accName: acc?.name }; })
    .sort((a, b) => Math.abs(b.sharedAmount) - Math.abs(a.sharedAmount)).slice(0, 12)
    .map((rg) => [`Le ${esc(rg.avgDay)}`, esc(rg.label || '—'), esc(rg.accName || '—'), eur(rg.sharedAmount)]);

  // évolution
  const evRows = sorted.slice(-12).reverse().map((m) => [esc(monthShort(m.month)), `<span style="color:${C.sage}">${eur(m.income)}</span>`, `<span style="color:${C.terracotta}">${eur(m.expenses)}</span>`, `<b>${eur(m.net, true)}</b>`, eur(m.balance)]);

  // détail
  const accRows = visibleAccounts.map((a) => { const bal = (accountBalances?.[a.id] || 0) * memberShare(a); const owners = (a.memberIds || []).map((id) => members.find((m) => m.id === id)?.name).filter(Boolean).join(' & '); return [esc(a.name), esc(a.bank || '—'), esc(owners || '—'), `<b>${eur(bal)}</b>`]; });
  const assetRows = visibleAssets.slice().sort((a, b) => (parseFloat(b.currentValue) || 0) * memberShare(b) - (parseFloat(a.currentValue) || 0) * memberShare(a))
    .map((a) => { const sh = memberShare(a); const cur = (parseFloat(a.currentValue) || 0) * sh; const cost = (parseFloat(a.purchasePrice) || 0) * sh; const pv = cost > 0 ? cur - cost : null; const pvp = cost > 0 ? (pv / cost) * 100 : null; return [esc(a.name || '—'), esc(ASSET_CLASS_MAP?.[a.type]?.class || a.type || 'Divers'), `<b>${eur(cur)}</b>`, cost > 0 ? eur(cost) : '—', pv == null ? '—' : `<span style="color:${pv >= 0 ? C.sage : C.terracotta}">${eur(pv, true)} (${pvp >= 0 ? '+' : ''}${pvp.toFixed(1)} %)</span>`]; });
  const liaRows = visibleLiabilities.map((l) => { const sh = memberShare(l); const rem = (parseFloat(l.remainingCapital ?? l.remaining_capital ?? 0) || 0) * sh; const mon = (parseFloat(l.monthlyPayment ?? l.monthly_payment ?? 0) || 0) * sh; return [esc(l.name || '—'), esc(l.type || '—'), l.interestRate ? `${parseFloat(l.interestRate).toFixed(2)} %` : '—', mon > 0 ? eur(mon) : '—', `<b style="color:${C.terracotta}">${eur(rem)}</b>`]; });

  // delta badge cover
  let coverDelta = '';
  if (nwDelta != null) { const pos = nwDelta >= 0; coverDelta = `<div class="cv-delta" style="background:${pos ? '#E1EFE6' : '#F6E4E1'};color:${pos ? C.sage : C.terracotta}">${eur(nwDelta, true)}${nwDeltaPct != null ? ` · ${pos ? '+' : '−'}${Math.abs(nwDeltaPct).toFixed(1)} %` : ''} sur le mois</div>`; }

  const compRows = allocSegments.map((s) => { const p = (s.value / allocTotal) * 100; return `<div class="comp-row"><div class="comp-top"><span class="comp-name"><span class="dot" style="background:${s.color}"></span>${esc(s.name)}</span><span class="comp-amt"><b>${eur(s.value)}</b><em>${p.toFixed(0)} %</em></span></div><div class="comp-track"><i style="width:${Math.max(3, p).toFixed(1)}%;background:${s.color}"></i></div></div>`; }).join('');

  const synthesis = buildSynthesis({ netWorth, nwDeltaPct, savingsRate, debtRatio, immoNet, cashWealth, scoreTotal: score.total });

  const kpisOverview = [
    { label: 'Patrimoine total', value: eur(actifsTotal), hint: 'liquidités + placements + immo', tone: 'a' },
    { label: 'Net après dettes', value: eur(netWorth), hint: 'actifs − passifs', tone: 'b' },
    { label: 'Cash', value: eur(cashWealth), hint: `liquidités + placements (${visibleAccounts.length} compte${visibleAccounts.length > 1 ? 's' : ''})`, tone: 'a' },
    { label: 'Immobilier net', value: eur(immoNet), hint: 'bien − crédit immo', tone: 'c' },
    { label: 'Performance 1 mois', value: perf1m == null ? '—' : `${perf1m >= 0 ? '+' : ''}${perf1m.toFixed(2)} %`, color: perf1m == null ? C.muted : perf1m >= 0 ? C.sage : C.terracotta, hint: 'sur les liquidités', tone: 'b' },
    { label: "Ratio d'endettement", value: pct(debtRatio), color: debtRatio == null ? C.muted : debtRatio < 30 ? C.sage : debtRatio < 50 ? C.amber : C.terracotta, hint: debtRatio == null ? '' : debtRatio < 30 ? 'sain' : debtRatio < 50 ? 'surveillé' : 'élevé', tone: 'c' },
  ];
  const kpisTreso = [
    { label: 'Revenus', value: eur(skIncome), color: C.sage, tone: 'b' },
    { label: 'Dépenses', value: eur(skExpenses), color: C.terracotta, tone: 'c' },
    { label: 'Épargne nette', value: eur(skNet, true), color: skNet >= 0 ? C.sage : C.terracotta, tone: 'b' },
    { label: "Taux d'épargne", value: pct(savingsRate, 0), color: savingsRate == null ? C.muted : savingsRate >= 20 ? C.sage : savingsRate >= 10 ? C.amber : C.terracotta, hint: 'sur revenus du mois', tone: 'a' },
  ];

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Wealthly — Bilan patrimonial</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Newsreader:ital,wght@1,400;1,500&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; }
  body { font-family:'Geist',-apple-system,Segoe UI,sans-serif; color:${C.ink}; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; font-size:12px; line-height:1.45; }
  .serif { font-family:'Newsreader',Georgia,serif; font-style:italic; }
  .pos { color:${C.sage}; } .neg { color:${C.terracotta}; }
  .empty { font-size:12px; color:${C.faint}; padding:8px 0; }

  /* pied de page répété */
  .run-foot { position:fixed; bottom:6mm; left:14mm; right:14mm; display:flex; justify-content:space-between; align-items:center; font-family:'Geist Mono',monospace; font-size:8px; letter-spacing:.05em; color:${C.faint}; border-top:1px solid ${C.border}; padding-top:4px; }

  /* couverture */
  .cover { min-height:256mm; display:flex; flex-direction:column; justify-content:space-between; page-break-after:always; }
  .cv-top { display:flex; align-items:center; justify-content:space-between; }
  .cv-brand { display:flex; align-items:center; gap:11px; }
  .cv-mark { width:34px; height:34px; border-radius:9px; background:${C.ink}; color:${C.paper}; font-weight:700; font-size:18px; display:flex; align-items:center; justify-content:center; }
  .cv-brand b { font-size:18px; letter-spacing:-.01em; }
  .cv-period { font-family:'Geist Mono',monospace; font-size:11px; letter-spacing:.14em; color:${C.faint}; text-transform:uppercase; }
  .cv-rule { height:2px; background:${C.accent}; width:64px; margin:34px 0 0; }
  .cv-mid { flex:1; display:flex; flex-direction:column; justify-content:center; padding:8px 0; }
  .cv-eyebrow { font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:${C.faint}; font-weight:600; }
  .cv-title { font-size:54px; font-weight:600; letter-spacing:-.03em; line-height:1.02; margin:14px 0 0; }
  .cv-title em { font-weight:500; }
  .cv-owner { font-size:13px; color:${C.muted}; margin-top:20px; }
  .cv-owner b { color:${C.ink}; font-weight:600; }
  .cv-hero { margin-top:44px; padding:26px 30px; background:linear-gradient(135deg,#FBFAF6,#fff); border:1px solid ${C.border}; border-radius:16px; }
  .cv-hero-lab { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:${C.faint}; font-weight:600; }
  .cv-hero-val { font-family:'Newsreader',Georgia,serif; font-style:italic; font-weight:500; font-size:64px; line-height:1; margin:10px 0 14px; }
  .cv-delta { display:inline-block; padding:6px 14px; border-radius:999px; font-size:13px; font-weight:600; }
  .cv-strip { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:30px; }
  .cv-cell { border-top:1px solid ${C.strong}; padding-top:12px; }
  .cv-cell .l { font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:${C.faint}; font-weight:600; }
  .cv-cell .v { font-size:20px; font-weight:600; margin-top:4px; letter-spacing:-.01em; font-variant-numeric:tabular-nums; }

  /* parties */
  .part.brk { page-break-before:always; }
  .part-head { display:flex; align-items:baseline; gap:12px; border-bottom:1.5px solid ${C.ink}; padding-bottom:9px; margin:0 0 18px; break-after:avoid; }
  .part-no { font-family:'Geist Mono',monospace; font-size:11px; color:${C.accent}; font-weight:500; }
  .part-head h2 { font-size:17px; font-weight:600; letter-spacing:-.01em; margin:0; }
  .part-sub { margin-left:auto; font-size:11px; color:${C.faint}; }
  .sub-h { font-size:9px; letter-spacing:.16em; text-transform:uppercase; color:${C.muted}; font-weight:600; margin:22px 0 12px; break-after:avoid; }

  /* synthèse éditoriale */
  .synth { font-size:13.5px; line-height:1.65; color:${C.body}; border-left:3px solid ${C.accent}; padding:4px 0 4px 16px; margin-bottom:22px; }
  .synth b { color:${C.ink}; font-weight:600; }

  /* KPI */
  .kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:11px; }
  .kpis.k4 { grid-template-columns:repeat(4,1fr); }
  .kpi { border:1px solid ${C.border}; border-radius:11px; padding:14px 16px; background:#fff; position:relative; overflow:hidden; break-inside:avoid; }
  .kpi::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; }
  .kpi.a::before{background:${C.accent}} .kpi.b::before{background:${C.sage}} .kpi.c::before{background:${C.amber}}
  .kpi-l { font-size:9.5px; letter-spacing:.07em; text-transform:uppercase; color:${C.faint}; font-weight:600; }
  .kpi-v { font-size:21px; font-weight:600; margin-top:5px; letter-spacing:-.015em; font-variant-numeric:tabular-nums; }
  .kpi-s { font-size:10.5px; color:${C.faint}; margin-top:3px; }

  /* score */
  .score { display:flex; gap:28px; align-items:stretch; break-inside:avoid; }
  .score-gauge { flex:0 0 200px; border:1px solid ${C.border}; border-radius:14px; padding:20px; background:linear-gradient(135deg,#FBFAF6,#fff); text-align:center; }
  .score-num { font-size:52px; line-height:1; font-weight:500; }
  .score-num span { font-size:18px; color:${C.faint}; -webkit-text-fill-color:${C.faint}; }
  .score-lab { font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:${C.faint}; font-weight:600; margin-top:8px; }
  .score-bar { height:7px; border-radius:4px; background:${C.sunk}; overflow:hidden; margin:14px 0 8px; }
  .score-bar > i { display:block; height:100%; border-radius:4px; }
  .score-cap { font-size:10.5px; color:${C.muted}; }
  .score-items { flex:1; display:flex; flex-direction:column; gap:11px; justify-content:center; }
  .sc-row-top { display:flex; justify-content:space-between; align-items:baseline; font-size:12.5px; margin-bottom:5px; }
  .sc-name { font-weight:500; color:${C.ink}; }
  .sc-val { font-variant-numeric:tabular-nums; color:${C.muted}; }
  .sc-val em { font-style:normal; font-family:'Geist Mono',monospace; font-size:10px; color:${C.faint}; margin-left:6px; }
  .sc-track { height:5px; border-radius:3px; background:${C.sunk}; overflow:hidden; }
  .sc-track > i { display:block; height:100%; border-radius:3px; }

  /* composition */
  .comp { display:flex; gap:32px; align-items:center; break-inside:avoid; }
  .comp-donut { position:relative; width:152px; height:152px; flex-shrink:0; }
  .comp-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .comp-center .v { font-family:'Newsreader',Georgia,serif; font-style:italic; font-weight:500; font-size:26px; line-height:1; }
  .comp-center .l { font-size:8.5px; letter-spacing:.14em; text-transform:uppercase; color:${C.faint}; font-weight:600; margin-top:5px; }
  .comp-rows { flex:1; display:flex; flex-direction:column; gap:13px; }
  .comp-top { display:flex; align-items:baseline; justify-content:space-between; font-size:13px; margin-bottom:6px; }
  .comp-name { display:flex; align-items:center; gap:9px; font-weight:500; }
  .dot { width:10px; height:10px; border-radius:3px; }
  .comp-amt { font-variant-numeric:tabular-nums; }
  .comp-amt em { font-style:normal; color:${C.faint}; font-size:11.5px; margin-left:7px; }
  .comp-track { height:6px; border-radius:3px; background:${C.sunk}; overflow:hidden; }
  .comp-track > i { display:block; height:100%; border-radius:3px; }

  /* sankey + chart cards */
  .viz-card { border:1px solid ${C.border}; border-radius:14px; background:#fff; padding:18px 20px 12px; break-inside:avoid; }
  .sk-foot { display:flex; gap:24px; padding:10px 4px 2px; border-top:1px solid ${C.sunk}; margin-top:8px; font-size:11.5px; color:${C.muted}; }
  .sk-foot b { font-variant-numeric:tabular-nums; }

  /* tables */
  .tbl { width:100%; border-collapse:collapse; font-size:11.5px; }
  .tbl th { text-align:left; font-size:9px; letter-spacing:.08em; text-transform:uppercase; color:${C.faint}; font-weight:600; padding:0 8px 7px; border-bottom:1px solid ${C.border}; }
  .tbl td { padding:7px 8px; border-bottom:1px solid ${C.sunk}; color:${C.body}; font-variant-numeric:tabular-nums; }
  .tbl td b { color:${C.ink}; font-weight:600; }
  .tbl .r { text-align:right; }
  tr { break-inside:avoid; }
</style></head>
<body>
  <div class="run-foot"><span>WEALTHLY · BILAN PATRIMONIAL · ${esc(ownerName).toUpperCase()}</span><span>DOCUMENT CONFIDENTIEL · ${todayLong().toUpperCase()}</span></div>

  <!-- COUVERTURE -->
  <section class="cover">
    <div>
      <div class="cv-top">
        <div class="cv-brand"><span class="cv-mark">W</span><b>Wealthly</b></div>
        <div class="cv-period">${esc(monthLong(currentMonth)).toUpperCase()}</div>
      </div>
      <div class="cv-rule"></div>
    </div>
    <div class="cv-mid">
      <div class="cv-eyebrow">Bilan patrimonial privé</div>
      <h1 class="cv-title">Votre <span class="serif">patrimoine.</span></h1>
      <div class="cv-owner">Préparé pour <b>${esc(ownerName)}</b> · ${todayLong()}</div>
      <div class="cv-hero">
        <div class="cv-hero-lab">Patrimoine net consolidé</div>
        <div class="cv-hero-val">${eur(netWorth)}</div>
        ${coverDelta}
      </div>
    </div>
    <div class="cv-strip">
      <div class="cv-cell"><div class="l">Patrimoine total</div><div class="v">${eur(actifsTotal)}</div></div>
      <div class="cv-cell"><div class="l">Immobilier net</div><div class="v">${eur(immoNet)}</div></div>
      <div class="cv-cell"><div class="l">Score de santé</div><div class="v">${score.total}/100</div></div>
    </div>
  </section>

  <!-- 01 SYNTHÈSE -->
  <section class="part">
    ${partHead('01', 'Synthèse', `Au ${todayLong()}`)}
    <div class="synth">${synthesis}</div>
    <div class="kpis">${kpisOverview.map(kpi).join('')}</div>
    <div class="sub-h">Santé patrimoniale</div>
    ${scoreBlock(score)}
    <div class="sub-h">Composition du patrimoine</div>
    ${allocSegments.length ? `<div class="comp"><div class="comp-donut">${donutSvg(allocSegments)}<div class="comp-center"><span class="v">${eur(allocTotal)}</span><span class="l">réparti</span></div></div><div class="comp-rows">${compRows}</div></div>` : '<p class="empty">Aucun actif renseigné.</p>'}
  </section>

  <!-- 02 ÉVOLUTION -->
  <section class="part brk">
    ${partHead('02', 'Évolution du patrimoine', nwSeries.length >= 2 ? `${nwSeries.length} mois` : '')}
    <div class="viz-card">${areaChartSvg(nwSeries)}</div>
    <div class="sub-h">Détail mensuel</div>
    ${table(['Mois', 'Revenus', 'Dépenses', 'Solde net', 'Solde fin'], evRows, ['', 'r', 'r', 'r', 'r'])}
  </section>

  <!-- 03 TRÉSORERIE -->
  <section class="part brk">
    ${partHead('03', 'Trésorerie du mois', esc(monthLong(currentMonth)))}
    <div class="kpis k4" style="margin-bottom:16px">${kpisTreso.map(kpi).join('')}</div>
    <div class="sub-h">Flux du mois — entrées → disponible → sorties</div>
    <div class="viz-card">${sankey}${sankeyFoot}</div>
    <div class="sub-h">Top dépenses du mois</div>
    ${table(['Catégorie', 'Ce mois', 'Moy. 3 mois', 'Δ'], topRows, ['', 'r', 'r', 'r'])}
    ${recRows.length ? `<div class="sub-h">Charges fixes récurrentes</div>${table(['Jour', 'Libellé', 'Compte', 'Montant'], recRows, ['', '', '', 'r'])}` : ''}
  </section>

  <!-- 04 DÉTAIL -->
  <section class="part brk">
    ${partHead('04', 'Détail du patrimoine', 'Comptes · actifs · dettes')}
    <div class="sub-h">Comptes bancaires</div>
    ${table(['Compte', 'Banque', 'Propriétaires', 'Solde'], accRows, ['', '', '', 'r'])}
    <div class="sub-h">Actifs détaillés</div>
    ${assetRows.length ? table(['Libellé', 'Classe', 'Valeur', 'Prix de revient', 'PV latente'], assetRows, ['', '', 'r', 'r', 'r']) : '<p class="empty">Aucun actif renseigné.</p>'}
    ${liaRows.length ? `<div class="sub-h">Dettes en cours</div>${table(['Libellé', 'Type', 'Taux', 'Mensualité', 'Restant dû'], liaRows, ['', '', 'r', 'r', 'r'])}` : ''}
  </section>

  <script>
    window.addEventListener('load', function(){ setTimeout(function(){ window.focus(); window.print(); }, 500); });
    window.addEventListener('afterprint', function(){ setTimeout(function(){ window.close(); }, 200); });
  </script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert("Le navigateur a bloqué l'ouverture du bilan. Autorise les pop-ups pour ce site puis réessaie."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
