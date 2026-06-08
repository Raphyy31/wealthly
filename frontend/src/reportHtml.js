/**
 * Wealthly — bilan patrimonial PDF (HTML/CSS → impression navigateur).
 *
 * Direction graphique « banque privée » (ui-ux-pro-max : Banking/Luxury) :
 *   - Palette  : navy profond #0F172A + OR #A16207 sur blanc, accents sobres.
 *   - Typo     : Playfair Display (titres + chiffres hero) / Inter (corps).
 *   - Signature: filet OR sous le bandeau, petites capitales espacées, donut
 *                en dégradé navy→or→bronze (pas d'arc-en-ciel).
 *
 * 2 pages : p1 = synthèse exécutive, p2 = détail des avoirs & emprunts
 * (niveau synthèse, sans échéancier). Calculs repris de l'app (inchangés).
 */
import { computeHealthScore } from './components/HealthScore.jsx';

const DISPLAY = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const C = {
  ink: '#0F172A', body: '#334155', muted: '#64748B', faint: '#94A3B8',
  gold: '#A16207', goldDeep: '#854D0E', goldSoft: '#F6EFE0',
  navy: '#1E3A8A', pos: '#15803D', neg: '#B91C1C',
  border: '#E2E5EA', hair: '#EEF0F3', panel: '#FBFAF7',
};
// Donut / dataviz — luxe sobre : navy, or, bleu profond, bronze, ardoise…
const DV = ['#0F172A', '#A16207', '#1E3A8A', '#B08D57', '#5B6675', '#475569', '#CA8A04'];

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
function donutSvg(segments, sw = 16, r = 60) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const Circ = 2 * Math.PI * r; let off = 0;
  const size = (r + sw / 2 + 2) * 2; const c = size / 2;
  const arcs = segments.map((s) => {
    const dash = (s.value / total) * Circ;
    const a = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-dasharray="${dash.toFixed(2)} ${(Circ - dash).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
    off += dash; return a;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${C.hair}" stroke-width="${sw}"/>${arcs}</svg>`;
}

// ── courbe d'aire ──
function areaChartSvg(series) {
  if (!series || series.length < 2) return '<p class="muted-note">Historique insuffisant.</p>';
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
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.navy}" stop-opacity="0.13"/><stop offset="1" stop-color="${C.navy}" stop-opacity="0"/></linearGradient></defs>
    <polygon points="${area}" fill="url(#ag)"/>
    <polyline points="${line}" fill="none" stroke="${C.navy}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${x(n - 1).toFixed(1)}" cy="${y(last.value).toFixed(1)}" r="3.6" fill="${C.gold}"/>
    <text x="${padL}" y="${H - 6}" style="font:400 9px ${SANS};fill:${C.faint};letter-spacing:.04em">${esc(series[0].label)}</text>
    <text x="${W - padR}" y="${H - 6}" text-anchor="end" style="font:400 9px ${SANS};fill:${C.faint};letter-spacing:.04em">${esc(last.label)}</text>
    <text x="${(x(n - 1) - 5).toFixed(1)}" y="${(y(last.value) - 9).toFixed(1)}" text-anchor="end" style="font:600 10px ${SANS};fill:${C.ink}">${eur(last.value)}</text>
  </svg>`;
}

// ── briques ──
const holding = (name, sub, value, meta = '', metaColor = '') => `<div class="hold"><div class="hold-l"><div class="hold-n">${esc(name)}</div>${sub ? `<div class="hold-s">${esc(sub)}</div>` : ''}</div><div class="hold-r"><div class="hold-v">${value}</div>${meta ? `<div class="hold-m"${metaColor ? ` style="color:${metaColor}"` : ''}>${meta}</div>` : ''}</div></div>`;
const groupHead = (title, total) => `<div class="grp-head"><span class="grp-t">${esc(title)}</span>${total != null ? `<span class="grp-tot">${eur(total)}</span>` : ''}</div>`;

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

  const allocClasses = {};
  if (liquidWealth > 0) allocClasses['Liquidités'] = liquidWealth;
  visibleAssets.forEach((a) => {
    if (a.parentAssetId || a.parent_asset_id) return;
    const cls = ASSET_CLASS_MAP?.[a.type]?.class || 'Divers';
    allocClasses[cls] = (allocClasses[cls] || 0) + (parseFloat(a.currentValue) || 0) * memberShare(a);
  });
  const allocSegments = Object.entries(allocClasses).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, color: DV[i % DV.length] }));
  const allocTotal = allocSegments.reduce((s, x) => s + x.value, 0) || 1;

  const score = computeHealthScore({ monthlyEvolution, liquidWealth, assetsValue, liabilitiesValue, visibleAssets, budgets, categoryAnalysis });

  // détail page 2
  const topAssets = visibleAssets.filter((a) => !a.parentAssetId && !a.parent_asset_id);
  const byClass = {};
  topAssets.forEach((a) => { const cls = ASSET_CLASS_MAP?.[a.type]?.class || 'Divers'; (byClass[cls] = byClass[cls] || []).push(a); });
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
      const lab = subtypeLabel(a.type); const sub = (lab && lab !== cls) ? lab : '';
      return holding(a.name || '—', sub, eur(cur), meta, pv == null ? '' : (pv >= 0 ? C.pos : C.neg));
    }).join('');
    const tot = list.reduce((s, a) => s + (parseFloat(a.currentValue) || 0) * memberShare(a), 0);
    return groupHead(cls, tot) + rows;
  }
  const liqRows = visibleAccounts.map((a) => ({ a, bal: (accountBalances?.[a.id] || 0) * memberShare(a) })).sort((x, y) => y.bal - x.bal).map(({ a, bal }) => holding(a.name, a.bank || '—', eur(bal))).join('');
  const loanRows = visibleLiabilities.slice().sort((a, b) => (parseFloat(b.remainingCapital ?? b.remaining_capital ?? 0) || 0) - (parseFloat(a.remainingCapital ?? a.remaining_capital ?? 0) || 0)).map((l) => {
    const sh = memberShare(l);
    const rem = (parseFloat(l.remainingCapital ?? l.remaining_capital ?? 0) || 0) * sh;
    const mon = (parseFloat(l.monthlyPayment ?? l.monthly_payment ?? 0) || 0) * sh;
    const rate = l.interestRate ? `${parseFloat(l.interestRate).toFixed(2)} %` : '—';
    return holding(l.name || '—', `${subtypeLabel(l.type) || 'Crédit'} · taux ${rate}`, eur(rem), mon > 0 ? `${eur(mon)} / mois` : '', C.muted);
  }).join('');
  const loanTotal = visibleLiabilities.reduce((s, l) => s + (parseFloat(l.remainingCapital ?? l.remaining_capital ?? 0) || 0) * memberShare(l), 0);

  // synthèse
  const sp = [];
  if (nwDeltaPct != null) sp.push(`votre patrimoine net ${nwDeltaPct >= 0 ? 'progresse' : 'recule'} de <b>${pctStr(nwDeltaPct)}</b> et s'établit à <b>${eur(netWorth)}</b>`);
  else sp.push(`votre patrimoine net s'établit à <b>${eur(netWorth)}</b>`);
  if (savingsRate != null) sp.push(`le taux d'épargne ressort à <b>${savingsRate.toFixed(0)} %</b>`);
  if (debtRatio != null) sp.push(`l'endettement représente <b>${debtRatio.toFixed(0)} %</b> des actifs${debtRatio < 30 ? ' — un niveau sain' : debtRatio < 50 ? ', à surveiller' : ', élevé'}`);
  const synthesis = `Ce mois-ci, ${sp.join(', ')}. La santé patrimoniale est notée <b>${score.total} sur 100</b>.`;

  let deltaChip = '';
  if (nwDelta != null) { const pos = nwDelta >= 0; deltaChip = `<span class="chip" style="color:${pos ? C.pos : C.neg};border-color:${pos ? C.pos : C.neg}">${eur(nwDelta, true)}${nwDeltaPct != null ? ` · ${pctStr(nwDeltaPct)}` : ''} sur le mois</span>`; }

  const allocLegend = allocSegments.map((s) => { const p = (s.value / allocTotal) * 100; return `<div class="lg"><span class="lg-dot" style="background:${s.color}"></span><span class="lg-name">${esc(s.name)}</span><span class="lg-val">${eur(s.value)}</span><span class="lg-pct">${p.toFixed(0)} %</span></div>`; }).join('');
  const scoreItems = (score.items || []).map((it) => { const w = it.max > 0 ? Math.round((it.pts / it.max) * 100) : 0; return `<div class="sc"><div class="sc-top"><span>${esc(it.label)}</span><span class="sc-v">${esc(it.value)}</span></div><div class="sc-bar"><i style="width:${w}%"></i></div></div>`; }).join('');

  const cell = (l, v) => `<div class="cell"><div class="cell-l">${esc(l)}</div><div class="cell-v">${v}</div></div>`;

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Wealthly — Bilan patrimonial</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&display=swap" rel="stylesheet">
<style>
  @page { size:A4; margin:17mm 16mm; }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  body{font-family:${SANS};color:${C.ink};background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:12px;line-height:1.5;}
  .disp{font-family:${DISPLAY};}
  .muted-note{color:${C.faint};font-size:12px;}
  b{font-weight:600;}

  .run-foot{position:fixed;bottom:8mm;left:16mm;right:16mm;display:flex;justify-content:space-between;font-size:8px;letter-spacing:.14em;color:${C.faint};text-transform:uppercase;}

  .page1{page-break-after:always;}

  /* bandeau + filet or */
  .mast{display:flex;align-items:center;justify-content:space-between;padding-bottom:13px;border-bottom:2px solid ${C.gold};}
  .mast-brand{display:flex;align-items:center;gap:11px;}
  .mast-mark{width:32px;height:32px;border-radius:7px;background:${C.ink};color:#fff;font-family:${DISPLAY};font-weight:700;font-size:18px;display:flex;align-items:center;justify-content:center;}
  .mast-brand b{font-size:16px;letter-spacing:.01em;font-weight:600;}
  .mast-r{font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:${C.gold};font-weight:600;}

  .lead{margin:26px 0 0;}
  .eyebrow{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:${C.gold};font-weight:600;}
  .lead h1{font-family:${DISPLAY};font-weight:600;font-size:36px;letter-spacing:-.01em;margin:10px 0 0;color:${C.ink};line-height:1.05;}
  .lead h1 .it{font-style:italic;font-weight:500;}
  .lead-sub{font-size:12px;color:${C.muted};margin-top:11px;}
  .lead-sub b{color:${C.body};}

  /* hero */
  .hero{margin:26px 0 0;}
  .h-lab{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${C.gold};font-weight:600;}
  .h-val{font-family:${DISPLAY};font-weight:600;font-size:62px;line-height:1;margin:8px 0 14px;color:${C.ink};letter-spacing:-.01em;}
  .chip{display:inline-block;padding:4px 13px;border:1px solid;border-radius:999px;font-size:11.5px;font-weight:600;letter-spacing:.01em;}

  .strip{display:grid;grid-template-columns:repeat(4,1fr);margin:22px 0 0;border-top:1px solid ${C.border};border-bottom:1px solid ${C.border};}
  .cell{padding:14px 16px 14px 0;border-right:1px solid ${C.hair};}
  .cell:last-child{border-right:none;padding-right:0;}
  .cell-l{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:${C.muted};font-weight:600;}
  .cell-v{font-size:20px;font-weight:600;margin-top:6px;letter-spacing:-.01em;font-variant-numeric:tabular-nums;color:${C.ink};}

  .synth{font-size:13px;line-height:1.75;color:${C.body};margin:22px 0 0;}
  .synth b{color:${C.ink};font-weight:600;}

  .cols{display:flex;gap:38px;margin-top:28px;align-items:flex-start;}
  .col{flex:1;}
  .sec-h{font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:${C.gold};font-weight:600;margin:0 0 14px;padding-bottom:8px;border-bottom:1px solid ${C.hair};}

  /* composition */
  .comp{display:flex;gap:22px;align-items:center;}
  .lg{display:flex;align-items:center;gap:9px;font-size:12px;padding:7px 0;border-bottom:1px solid ${C.hair};}
  .lg:last-child{border-bottom:none;}
  .lg-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
  .lg-name{flex:1;color:${C.body};}
  .lg-val{font-variant-numeric:tabular-nums;font-weight:600;color:${C.ink};}
  .lg-pct{width:42px;text-align:right;color:${C.muted};font-variant-numeric:tabular-nums;}

  /* score */
  .score-head{display:flex;align-items:baseline;gap:11px;margin-bottom:14px;}
  .score-num{font-family:${DISPLAY};font-weight:600;font-size:44px;line-height:1;color:${C.ink};}
  .score-num span{font-size:15px;color:${C.faint};font-family:${SANS};}
  .score-cap{font-size:11px;color:${C.muted};line-height:1.4;}
  .sc{margin-bottom:10px;}
  .sc-top{display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:5px;}
  .sc-top span:first-child{color:${C.body};}
  .sc-v{color:${C.muted};font-variant-numeric:tabular-nums;}
  .sc-bar{height:4px;border-radius:3px;background:${C.hair};overflow:hidden;}
  .sc-bar>i{display:block;height:100%;border-radius:3px;background:${C.gold};}

  .chart-wrap{border:1px solid ${C.border};border-radius:10px;padding:14px 18px 4px;background:${C.panel};}
  .sec{margin-top:26px;}

  /* page 2 */
  .p2-lead{margin:24px 0 0;}
  .p2-lead h2{font-family:${DISPLAY};font-weight:600;font-size:26px;letter-spacing:-.01em;margin:0;color:${C.ink};}
  .p2-lead h2 .it{font-style:italic;font-weight:500;}
  .p2-sub{font-size:11px;letter-spacing:.04em;color:${C.muted};margin-top:6px;}
  .grp{margin-top:24px;break-inside:avoid;}
  .grp-head{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid ${C.ink};padding-bottom:7px;margin-bottom:2px;}
  .grp-t{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${C.ink};font-weight:700;}
  .grp-tot{font-family:${DISPLAY};font-weight:600;font-size:15px;font-variant-numeric:tabular-nums;color:${C.ink};}
  .hold{display:flex;justify-content:space-between;align-items:baseline;padding:12px 0;border-bottom:1px solid ${C.hair};break-inside:avoid;}
  .hold:last-child{border-bottom:none;}
  .hold-n{font-size:13px;font-weight:500;color:${C.ink};}
  .hold-s{font-size:10.5px;color:${C.muted};margin-top:3px;letter-spacing:.02em;}
  .hold-r{text-align:right;}
  .hold-v{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;color:${C.ink};}
  .hold-m{font-size:10.5px;margin-top:3px;font-variant-numeric:tabular-nums;}
  .empty{font-size:12px;color:${C.faint};padding:10px 0;}
</style></head>
<body>
  <div class="run-foot"><span>Wealthly — Bilan patrimonial</span><span>${esc(ownerName)} · ${todayLong()} · Confidentiel</span></div>

  <!-- ══ PAGE 1 ══ -->
  <div class="page1">
    <div class="mast">
      <div class="mast-brand"><span class="mast-mark">W</span><b>Wealthly</b></div>
      <div class="mast-r">Bilan patrimonial · ${esc(monthLong(currentMonth))}</div>
    </div>

    <div class="lead">
      <div class="eyebrow">Gestion privée</div>
      <h1>Synthèse de <span class="it">votre patrimoine</span></h1>
      <div class="lead-sub">Préparé pour <b>${esc(ownerName)}</b> · ${todayLong()}</div>
    </div>

    <div class="hero">
      <div class="h-lab">Patrimoine net consolidé</div>
      <div class="h-val disp">${eur(netWorth)}</div>
      ${deltaChip}
    </div>
    <div class="strip">
      ${cell('Patrimoine total', eur(actifsTotal))}
      ${cell('Immobilier net', eur(immoNet))}
      ${cell('Disponible', eur(cashWealth))}
      ${cell('Endettement', pctStr(debtRatio, 0))}
    </div>

    <div class="synth">${synthesis}</div>

    <div class="cols">
      <div class="col">
        <div class="sec-h">Composition du patrimoine</div>
        ${allocSegments.length ? `<div class="comp"><div style="flex-shrink:0">${donutSvg(allocSegments)}</div><div style="flex:1">${allocLegend}</div></div>` : '<p class="empty">Aucun actif renseigné.</p>'}
      </div>
      <div class="col">
        <div class="sec-h">Santé patrimoniale</div>
        <div class="score-head"><span class="score-num disp">${score.total}<span> / 100</span></span><span class="score-cap">${score.total < 40 ? 'À consolider' : score.total < 70 ? 'Équilibré' : 'Solide'}<br>moyenne sur ${score.monthsCovered || 0} mois</span></div>
        ${scoreItems}
      </div>
    </div>

    <div class="sec">
      <div class="sec-h">Évolution du patrimoine net${nwSeries.length >= 2 ? ` · ${nwSeries.length} mois` : ''}</div>
      <div class="chart-wrap">${areaChartSvg(nwSeries)}</div>
    </div>
  </div>

  <!-- ══ PAGE 2 ══ -->
  <div class="page2">
    <div class="mast">
      <div class="mast-brand"><span class="mast-mark">W</span><b>Wealthly</b></div>
      <div class="mast-r">Détail du patrimoine</div>
    </div>
    <div class="p2-lead">
      <h2>Vos <span class="it">avoirs & engagements</span></h2>
      <div class="p2-sub">Au ${todayLong()}</div>
    </div>

    ${Object.keys(byClass).length
      ? Object.entries(byClass).sort((a, b) => b[1].reduce((s, x) => s + (parseFloat(x.currentValue) || 0) * memberShare(x), 0) - a[1].reduce((s, x) => s + (parseFloat(x.currentValue) || 0) * memberShare(x), 0)).map(([cls, list]) => `<div class="grp">${assetGroup(cls, list)}</div>`).join('')
      : ''}
    ${visibleAccounts.length ? `<div class="grp">${groupHead('Liquidités', liquidWealth)}${liqRows}</div>` : ''}
    ${visibleLiabilities.length ? `<div class="grp">${groupHead('Emprunts · capital restant dû', loanTotal)}${loanRows}</div>` : ''}
    ${(!Object.keys(byClass).length && !visibleAccounts.length && !visibleLiabilities.length) ? '<p class="empty">Aucun avoir ni engagement renseigné.</p>' : ''}
  </div>

  <script>
    window.addEventListener('load', function(){ setTimeout(function(){ window.focus(); window.print(); }, 600); });
    window.addEventListener('afterprint', function(){ setTimeout(function(){ window.close(); }, 200); });
  </script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert("Le navigateur a bloqué l'ouverture du bilan. Autorise les pop-ups pour ce site puis réessaie."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
