/**
 * Wealthly — bilan patrimonial PDF (HTML/CSS → impression navigateur).
 *
 * Format resserré « banque privée », 2 pages :
 *   Page 1 — Synthèse exécutive : patrimoine net, indicateurs clés, note de
 *            synthèse, composition (donut), évolution (aire), score de santé.
 *   Page 2 — Détail du patrimoine : investissements, immobilier, liquidités,
 *            emprunts (niveau synthèse, SANS échéancier).
 *
 * Parti pris graphique : beaucoup de blanc, gros chiffres en serif (Georgia /
 * Newsreader), filets fins, figures en colonnes alignées — pas de tableaux
 * « tableur ». Calculs repris de l'app (chiffres inchangés).
 */
import { computeHealthScore } from './components/HealthScore.jsx';

const SANS = "'Geist', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const SERIF = "'Newsreader', Georgia, 'Times New Roman', serif";
const PALETTE = ['#2540D9', '#1F8E6E', '#C2733B', '#7B57C6', '#B85D7A', '#4D4D4D', '#E0B23E'];
const C = {
  ink: '#16150F', body: '#403D33', muted: '#56544A', faint: '#94917F',
  accent: '#2540D9', sage: '#1F7A4C', terracotta: '#B0392B', amber: '#8E641A',
  border: '#E7E4DA', hair: '#EFEDE6', paper: '#FBFAF6',
};

const nf = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur = (v, sign = false) => {
  if (v == null || isNaN(v)) return '—';
  const s = nf.format(Math.abs(v));
  if (v < 0) return `−${s}`;
  if (sign && v > 0) return `+${s}`;
  return s;
};
const pctStr = (v, d = 1) => (v == null ? '—' : `${v >= 0 ? '' : '−'}${Math.abs(v).toFixed(d)} %`);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const todayLong = () => new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const monthLong = (mk) => { if (!mk) return ''; const [y, m] = mk.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); };
const monthShort = (mk) => { if (!mk) return ''; const [y, m] = mk.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }); };

// ── donut ──
function donutSvg(segments, sw = 18, r = 58) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const Circ = 2 * Math.PI * r; let off = 0;
  const size = (r + sw / 2 + 2) * 2; const c = size / 2;
  const arcs = segments.map((s) => {
    const dash = (s.value / total) * Circ;
    const a = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-dasharray="${dash.toFixed(2)} ${(Circ - dash).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" stroke-linecap="butt"/>`;
    off += dash; return a;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${C.hair}" stroke-width="${sw}"/>${arcs}</svg>`;
}

// ── courbe d'aire ──
function areaChartSvg(series) {
  if (!series || series.length < 2) return '<p class="muted-note">Historique insuffisant pour tracer la courbe.</p>';
  const W = 700, H = 150, padL = 2, padR = 2, padT = 18, padB = 22;
  const vals = series.map((s) => s.value);
  const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1;
  const n = series.length;
  const x = (i) => padL + i * (W - padL - padR) / (n - 1);
  const y = (v) => padT + (1 - (v - min) / range) * (H - padT - padB);
  const line = series.map((s, i) => `${x(i).toFixed(1)},${y(s.value).toFixed(1)}`).join(' ');
  const area = `${padL},${(H - padB).toFixed(1)} ${line} ${(W - padR).toFixed(1)},${(H - padB).toFixed(1)}`;
  const last = series[n - 1];
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.14"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></linearGradient></defs>
    <polygon points="${area}" fill="url(#ag)"/>
    <polyline points="${line}" fill="none" stroke="${C.accent}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${x(n - 1).toFixed(1)}" cy="${y(last.value).toFixed(1)}" r="3.4" fill="${C.accent}"/>
    <text x="${padL}" y="${H - 6}" style="font:400 9px ${SANS};fill:${C.faint}">${esc(series[0].label)}</text>
    <text x="${W - padR}" y="${H - 6}" text-anchor="end" style="font:400 9px ${SANS};fill:${C.faint}">${esc(last.label)}</text>
    <text x="${(x(n - 1) - 4).toFixed(1)}" y="${(y(last.value) - 8).toFixed(1)}" text-anchor="end" style="font:500 10px ${SANS};fill:${C.ink}">${eur(last.value)}</text>
  </svg>`;
}

// ── briques élégantes ──
// métrique en colonne : label / valeur
const metric = (label, value, sub = '') => `<div class="metric"><div class="m-l">${esc(label)}</div><div class="m-v">${value}</div>${sub ? `<div class="m-s">${esc(sub)}</div>` : ''}</div>`;
// ligne de holding : nom + sous-libellé à gauche, figure + meta à droite, filet fin
const holding = (name, sub, value, meta = '', metaColor = '') => `<div class="hold"><div class="hold-l"><div class="hold-n">${esc(name)}</div>${sub ? `<div class="hold-s">${esc(sub)}</div>` : ''}</div><div class="hold-r"><div class="hold-v">${value}</div>${meta ? `<div class="hold-m"${metaColor ? ` style="color:${metaColor}"` : ''}>${meta}</div>` : ''}</div></div>`;
const groupHead = (title, total) => `<div class="grp-head"><span>${esc(title)}</span>${total != null ? `<span class="grp-tot">${eur(total)}</span>` : ''}</div>`;

export function generateBilanHtmlReport(data) {
  const {
    netWorth, liquidWealth, assetsValue, liabilitiesValue,
    thisMonthStats, monthlyEvolution = [], wealthHistory = [], budgets = {},
    visibleAccounts = [], accountBalances = {}, visibleAssets = [], visibleLiabilities = [],
    members = [], activeMemberId, categoryAnalysis = {},
    memberShare = () => 1, currentMonth, ASSET_CLASS_MAP = {},
  } = data;

  const activeMember = members.find((m) => m.id === activeMemberId);
  const ownerName = activeMember ? activeMember.name : 'Votre foyer';

  // ── calculs ──
  const actifsTotal = liquidWealth + assetsValue;
  const immoAssets = visibleAssets.reduce((s, a) => (ASSET_CLASS_MAP?.[a.type]?.class === 'Immobilier' ? s + (parseFloat(a.currentValue) || 0) * memberShare(a) : s), 0);
  const mortgageDebt = visibleLiabilities.reduce((s, l) => (l.type === 'mortgage' ? s + (parseFloat(l.remainingCapital ?? l.remaining_capital ?? 0) || 0) * memberShare(l) : s), 0);
  const immoNet = immoAssets - mortgageDebt;
  const cashWealth = actifsTotal - immoAssets;
  const debtRatio = actifsTotal > 0 ? (liabilitiesValue / actifsTotal) * 100 : null;
  const savingsRate = thisMonthStats?.income > 0 ? (thisMonthStats.net / thisMonthStats.income) * 100 : null;

  const wh = [...wealthHistory].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  let nwDelta = null, nwDeltaPct = null;
  if (wh.length >= 2) {
    const a = wh.at(-1).net_worth ?? wh.at(-1).netWorth, b = wh.at(-2).net_worth ?? wh.at(-2).netWorth;
    if (typeof a === 'number' && typeof b === 'number') { nwDelta = a - b; if (b !== 0) nwDeltaPct = (nwDelta / Math.abs(b)) * 100; }
  }
  const sorted = [...monthlyEvolution].sort((a, b) => a.month.localeCompare(b.month));
  const nwSeries = (wh.length >= 2
    ? wh.map((s) => ({ label: monthShort(s.month), value: s.net_worth ?? s.netWorth ?? 0 }))
    : sorted.map((m) => ({ label: monthShort(m.month), value: m.balance || 0 }))).slice(-12);

  // allocation
  const allocClasses = {};
  if (liquidWealth > 0) allocClasses['Liquidités'] = liquidWealth;
  visibleAssets.forEach((a) => {
    if (a.parentAssetId || a.parent_asset_id) return; // pas les positions filles
    const cls = ASSET_CLASS_MAP?.[a.type]?.class || 'Divers';
    allocClasses[cls] = (allocClasses[cls] || 0) + (parseFloat(a.currentValue) || 0) * memberShare(a);
  });
  const allocSegments = Object.entries(allocClasses).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }));
  const allocTotal = allocSegments.reduce((s, x) => s + x.value, 0) || 1;

  const score = computeHealthScore({ monthlyEvolution, liquidWealth, assetsValue, liabilitiesValue, visibleAssets, budgets, categoryAnalysis });
  const scoreCol = score.total < 40 ? C.terracotta : score.total < 70 ? C.amber : C.sage;

  // ── détail (page 2) : actifs top-level groupés par classe ──
  const topAssets = visibleAssets.filter((a) => !a.parentAssetId && !a.parent_asset_id);
  const byClass = {};
  topAssets.forEach((a) => {
    const cls = ASSET_CLASS_MAP?.[a.type]?.class || 'Divers';
    (byClass[cls] = byClass[cls] || []).push(a);
  });
  const subtypeLabel = (t) => ({
    pea: 'PEA', life_insurance: 'Assurance-vie', per: 'PER', stocks: 'CTO', crypto: 'Crypto', real_estate: 'Immobilier',
    mortgage: 'Crédit immobilier', auto: 'Crédit auto', consumer: 'Crédit conso', personal: 'Prêt personnel',
    student: 'Prêt étudiant', revolving: 'Crédit renouvelable', loan: 'Prêt',
  })[t] || t || '';
  function assetGroup(cls, list) {
    const rows = list.slice().sort((a, b) => (parseFloat(b.currentValue) || 0) * memberShare(b) - (parseFloat(a.currentValue) || 0) * memberShare(a)).map((a) => {
      const sh = memberShare(a); const cur = (parseFloat(a.currentValue) || 0) * sh; const cost = (parseFloat(a.purchasePrice) || 0) * sh;
      const pv = cost > 0 ? cur - cost : null; const pvp = cost > 0 ? (pv / cost) * 100 : null;
      const meta = pv == null ? '' : `${eur(pv, true)} · ${pvp >= 0 ? '+' : ''}${pvp.toFixed(1)} %`;
      const lab = subtypeLabel(a.type);
      const sub = (lab && lab !== cls) ? lab : ''; // évite la redondance avec le titre de groupe
      return holding(a.name || '—', sub, eur(cur), meta, pv == null ? '' : (pv >= 0 ? C.sage : C.terracotta));
    }).join('');
    const tot = list.reduce((s, a) => s + (parseFloat(a.currentValue) || 0) * memberShare(a), 0);
    return groupHead(cls, tot) + rows;
  }

  // liquidités
  const liqRows = visibleAccounts.map((a) => { const bal = (accountBalances?.[a.id] || 0) * memberShare(a); return { a, bal }; })
    .sort((x, y) => y.bal - x.bal)
    .map(({ a, bal }) => holding(a.name, a.bank || '—', eur(bal))).join('');

  // emprunts (sans échéancier)
  const loanRows = visibleLiabilities.slice().sort((a, b) => (parseFloat(b.remainingCapital ?? b.remaining_capital ?? 0) || 0) - (parseFloat(a.remainingCapital ?? a.remaining_capital ?? 0) || 0)).map((l) => {
    const sh = memberShare(l);
    const rem = (parseFloat(l.remainingCapital ?? l.remaining_capital ?? 0) || 0) * sh;
    const mon = (parseFloat(l.monthlyPayment ?? l.monthly_payment ?? 0) || 0) * sh;
    const rate = l.interestRate ? `${parseFloat(l.interestRate).toFixed(2)} %` : '—';
    const sub = `${subtypeLabel(l.type) || 'Crédit'} · ${rate}`;
    const meta = mon > 0 ? `${eur(mon)} / mois` : '';
    return holding(l.name || '—', sub, eur(rem), meta, C.faint);
  }).join('');
  const loanTotal = visibleLiabilities.reduce((s, l) => s + (parseFloat(l.remainingCapital ?? l.remaining_capital ?? 0) || 0) * memberShare(l), 0);

  // synthèse éditoriale
  const synthParts = [];
  if (nwDeltaPct != null) synthParts.push(`Sur le dernier mois, votre patrimoine net ${nwDeltaPct >= 0 ? 'progresse' : 'recule'} de <b>${pctStr(nwDeltaPct)}</b> pour s'établir à <b>${eur(netWorth)}</b>`);
  else synthParts.push(`Votre patrimoine net s'établit à <b>${eur(netWorth)}</b>`);
  if (savingsRate != null) synthParts.push(`le taux d'épargne ressort à <b>${savingsRate.toFixed(0)} %</b> ce mois`);
  if (debtRatio != null) synthParts.push(`l'endettement représente <b>${debtRatio.toFixed(0)} %</b> des actifs${debtRatio < 30 ? ' — un niveau sain' : debtRatio < 50 ? ', à surveiller' : ', élevé'}`);
  const synthesis = synthParts.join(', ') + `. Santé patrimoniale notée <b>${score.total}/100</b>.`;

  // delta chip
  let deltaChip = '';
  if (nwDelta != null) { const pos = nwDelta >= 0; deltaChip = `<span class="chip" style="background:${pos ? '#E4F0E9' : '#F6E4E1'};color:${pos ? C.sage : C.terracotta}">${eur(nwDelta, true)}${nwDeltaPct != null ? ` · ${pctStr(nwDeltaPct)}` : ''} sur le mois</span>`; }

  const allocLegend = allocSegments.map((s) => { const p = (s.value / allocTotal) * 100; return `<div class="lg"><span class="lg-dot" style="background:${s.color}"></span><span class="lg-name">${esc(s.name)}</span><span class="lg-val">${eur(s.value)}</span><span class="lg-pct">${p.toFixed(0)} %</span></div>`; }).join('');

  const scoreItems = (score.items || []).map((it) => { const w = it.max > 0 ? Math.round((it.pts / it.max) * 100) : 0; return `<div class="sc"><div class="sc-top"><span>${esc(it.label)}</span><span class="sc-v">${esc(it.value)}</span></div><div class="sc-bar"><i style="width:${w}%;background:${scoreCol}"></i></div></div>`; }).join('');

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Wealthly — Bilan patrimonial</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Newsreader:ital,wght@1,400;1,500&display=swap" rel="stylesheet">
<style>
  @page { size:A4; margin:18mm 16mm; }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  body{font-family:${SANS};color:${C.ink};background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:12px;line-height:1.5;}
  .serif{font-family:${SERIF};font-style:italic;}
  .muted-note{color:${C.faint};font-size:12px;}

  .run-foot{position:fixed;bottom:8mm;left:16mm;right:16mm;display:flex;justify-content:space-between;font-size:8px;letter-spacing:.08em;color:${C.faint};text-transform:uppercase;}

  .page1{page-break-after:always;}

  /* masthead */
  .mast{display:flex;align-items:center;justify-content:space-between;}
  .mast-brand{display:flex;align-items:center;gap:10px;}
  .mast-mark{width:30px;height:30px;border-radius:8px;background:${C.ink};color:${C.paper};font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;}
  .mast-brand b{font-size:15px;letter-spacing:-.01em;}
  .mast-r{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:${C.faint};font-weight:600;}

  .lead{margin:30px 0 0;}
  .eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:${C.faint};font-weight:600;}
  .lead h1{font-size:34px;font-weight:600;letter-spacing:-.025em;margin:8px 0 0;}
  .lead-sub{font-size:12px;color:${C.muted};margin-top:10px;}
  .lead-sub b{color:${C.ink};font-weight:600;}

  /* hero net worth */
  .hero{margin:28px 0 0;padding:24px 0 0;border-top:1px solid ${C.border};}
  .h-lab{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${C.faint};font-weight:600;}
  .h-val{font-family:${SERIF};font-style:italic;font-weight:500;font-size:58px;line-height:1;margin:10px 0 14px;letter-spacing:-.01em;}
  .chip{display:inline-block;padding:5px 13px;border-radius:999px;font-size:12px;font-weight:600;}
  .strip{display:grid;grid-template-columns:repeat(4,1fr);margin:24px 0 0;border-top:1px solid ${C.border};border-bottom:1px solid ${C.border};}
  .cell{padding:14px 16px 14px 0;border-right:1px solid ${C.hair};}
  .cell:last-child{border-right:none;padding-right:0;}
  .cell .l{font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:${C.faint};font-weight:600;}
  .cell .v{font-size:19px;font-weight:600;margin-top:5px;letter-spacing:-.01em;font-variant-numeric:tabular-nums;}

  .synth{font-size:13px;line-height:1.7;color:${C.body};margin:22px 0 0;}
  .synth b{color:${C.ink};font-weight:600;}

  /* sections */
  .sec{margin-top:26px;}
  .sec-h{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:${C.muted};font-weight:600;margin:0 0 14px;}
  .cols{display:flex;gap:34px;}
  .col{flex:1;}

  /* composition */
  .comp{display:flex;gap:24px;align-items:center;}
  .lg{display:flex;align-items:center;gap:9px;font-size:12px;padding:6px 0;border-bottom:1px solid ${C.hair};}
  .lg:last-child{border-bottom:none;}
  .lg-dot{width:9px;height:9px;border-radius:2px;flex-shrink:0;}
  .lg-name{flex:1;color:${C.body};}
  .lg-val{font-variant-numeric:tabular-nums;font-weight:600;color:${C.ink};}
  .lg-pct{width:42px;text-align:right;color:${C.faint};font-variant-numeric:tabular-nums;}

  /* score */
  .score-head{display:flex;align-items:baseline;gap:10px;margin-bottom:12px;}
  .score-num{font-family:${SERIF};font-style:italic;font-weight:500;font-size:40px;line-height:1;}
  .score-num span{font-size:15px;color:${C.faint};}
  .score-cap{font-size:11px;color:${C.muted};}
  .sc{margin-bottom:9px;}
  .sc-top{display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px;}
  .sc-top span:first-child{color:${C.body};}
  .sc-v{color:${C.muted};font-variant-numeric:tabular-nums;}
  .sc-bar{height:4px;border-radius:3px;background:${C.hair};overflow:hidden;}
  .sc-bar>i{display:block;height:100%;border-radius:3px;}

  .chart-wrap{border:1px solid ${C.border};border-radius:12px;padding:14px 16px 4px;}

  /* page 2 holdings */
  .p2-title{font-size:22px;font-weight:600;letter-spacing:-.02em;margin:26px 0 4px;}
  .p2-title .serif{font-weight:500;}
  .p2-sub{font-size:11px;letter-spacing:.04em;color:${C.faint};margin-bottom:8px;}
  .grp{margin-top:22px;break-inside:avoid;}
  .grp-head{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1.5px solid ${C.ink};padding-bottom:7px;margin-bottom:4px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${C.ink};font-weight:600;}
  .grp-tot{font-family:${SANS};letter-spacing:0;font-size:13px;font-variant-numeric:tabular-nums;}
  .hold{display:flex;justify-content:space-between;align-items:baseline;padding:11px 0;border-bottom:1px solid ${C.hair};break-inside:avoid;}
  .hold:last-child{border-bottom:none;}
  .hold-n{font-size:13px;font-weight:500;color:${C.ink};}
  .hold-s{font-size:10.5px;color:${C.faint};margin-top:2px;letter-spacing:.02em;}
  .hold-r{text-align:right;}
  .hold-v{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;color:${C.ink};}
  .hold-m{font-size:10.5px;margin-top:2px;font-variant-numeric:tabular-nums;}
  .empty{font-size:12px;color:${C.faint};padding:10px 0;}
</style></head>
<body>
  <div class="run-foot"><span>Wealthly · Bilan patrimonial</span><span>${esc(ownerName)} · ${todayLong()} · Confidentiel</span></div>

  <!-- ══ PAGE 1 — SYNTHÈSE ══ -->
  <div class="page1">
    <div class="mast">
      <div class="mast-brand"><span class="mast-mark">W</span><b>Wealthly</b></div>
      <div class="mast-r">${esc(monthLong(currentMonth))}</div>
    </div>

    <div class="lead">
      <div class="eyebrow">Bilan patrimonial privé</div>
      <h1>Synthèse de <span class="serif">votre patrimoine.</span></h1>
      <div class="lead-sub">Préparé pour <b>${esc(ownerName)}</b> · ${todayLong()}</div>
    </div>

    <div class="hero">
      <div class="h-lab">Patrimoine net consolidé</div>
      <div class="h-val">${eur(netWorth)}</div>
      ${deltaChip}
    </div>
    <div class="strip">
      <div class="cell"><div class="l">Patrimoine total</div><div class="v">${eur(actifsTotal)}</div></div>
      <div class="cell"><div class="l">Immobilier net</div><div class="v">${eur(immoNet)}</div></div>
      <div class="cell"><div class="l">Disponible</div><div class="v">${eur(cashWealth)}</div></div>
      <div class="cell"><div class="l">Endettement</div><div class="v">${pctStr(debtRatio, 0)}</div></div>
    </div>

    <div class="synth">${synthesis}</div>

    <div class="cols" style="margin-top:28px;align-items:flex-start">
      <div class="col">
        <div class="sec-h">Composition du patrimoine</div>
        ${allocSegments.length ? `<div class="comp"><div style="flex-shrink:0">${donutSvg(allocSegments)}</div><div style="flex:1">${allocLegend}</div></div>` : '<p class="empty">Aucun actif renseigné.</p>'}
      </div>
      <div class="col">
        <div class="sec-h">Santé patrimoniale</div>
        <div class="score-head"><span class="score-num" style="color:${scoreCol}">${score.total}<span>/100</span></span><span class="score-cap">${score.total < 40 ? 'À consolider' : score.total < 70 ? 'Correct' : 'Solide'}<br>moyenne sur ${score.monthsCovered || 0} mois</span></div>
        ${scoreItems}
      </div>
    </div>

    <div class="sec">
      <div class="sec-h">Évolution du patrimoine net${nwSeries.length >= 2 ? ` · ${nwSeries.length} mois` : ''}</div>
      <div class="chart-wrap">${areaChartSvg(nwSeries)}</div>
    </div>
  </div>

  <!-- ══ PAGE 2 — DÉTAIL ══ -->
  <div class="page2">
    <div class="mast">
      <div class="mast-brand"><span class="mast-mark">W</span><b>Wealthly</b></div>
      <div class="mast-r">Détail du patrimoine</div>
    </div>
    <h2 class="p2-title">Vos <span class="serif">avoirs & engagements.</span></h2>
    <div class="p2-sub">Au ${todayLong()}</div>

    ${Object.keys(byClass).length
      ? Object.entries(byClass).sort((a, b) => b[1].reduce((s, x) => s + (parseFloat(x.currentValue) || 0) * memberShare(x), 0) - a[1].reduce((s, x) => s + (parseFloat(x.currentValue) || 0) * memberShare(x), 0)).map(([cls, list]) => `<div class="grp">${assetGroup(cls, list)}</div>`).join('')
      : ''}

    ${visibleAccounts.length ? `<div class="grp">${groupHead('Liquidités', liquidWealth)}${liqRows}</div>` : ''}

    ${visibleLiabilities.length ? `<div class="grp">${groupHead('Emprunts · capital restant dû', loanTotal)}${loanRows}</div>` : ''}

    ${(!Object.keys(byClass).length && !visibleAccounts.length && !visibleLiabilities.length) ? '<p class="empty">Aucun avoir ni engagement renseigné.</p>' : ''}
  </div>

  <script>
    window.addEventListener('load', function(){ setTimeout(function(){ window.focus(); window.print(); }, 500); });
    window.addEventListener('afterprint', function(){ setTimeout(function(){ window.close(); }, 200); });
  </script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert("Le navigateur a bloqué l'ouverture du bilan. Autorise les pop-ups pour ce site puis réessaie."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
