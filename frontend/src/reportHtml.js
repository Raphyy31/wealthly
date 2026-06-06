/**
 * Wealthly — bilan PDF via HTML/CSS + impression navigateur (WYSIWYG).
 *
 * Remplace l'ancien dessin jsPDF (fragile, chevauchements). On construit un
 * vrai document HTML stylé comme les maquettes validées (papier-chaud + cobalt,
 * SVG donut & Sankey rendus nativement par le navigateur → texte vectoriel net),
 * puis on déclenche l'impression. L'utilisateur choisit « Enregistrer en PDF ».
 *
 * Les CALCULS sont repris à l'identique de l'ancien pdfReport.js (les chiffres
 * étaient corrects) — seule la FORME change. Pagination gérée par le navigateur
 * via @page A4 + break-inside:avoid sur les cartes/tableaux.
 */

const PALETTE = ['#2540D9', '#1F8E6E', '#C2733B', '#7B57C6', '#B85D7A', '#4D4D4D', '#E0B23E'];
const C = {
  ink: '#16150F', body: '#38362D', muted: '#56544A', faint: '#8C8979',
  accent: '#2540D9', sage: '#136D3E', terracotta: '#B0392B', amber: '#8E641A',
  border: '#E4E1D8', sunk: '#EFEDE6', paper: '#F7F6F2', amberv: '#8E641A',
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
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const todayLong = () => new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
function monthLong(mk) {
  if (!mk) return '';
  const [y, m] = mk.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}
function monthShort(mk) {
  if (!mk) return '';
  const [y, m] = mk.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

// ── donut SVG (segments proportionnels) ───────────────────────────────────
function donutSvg(segments) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 54, Circ = 2 * Math.PI * r;
  let off = 0;
  const arcs = segments.map((s) => {
    const dash = (s.value / total) * Circ;
    const arc = `<circle cx="76" cy="76" r="${r}" fill="none" stroke="${s.color}" stroke-width="19" stroke-dasharray="${dash.toFixed(2)} ${(Circ - dash).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
    off += dash;
    return arc;
  }).join('');
  return `<svg width="152" height="152" viewBox="0 0 152 152" style="transform:rotate(-90deg)">
    <circle cx="76" cy="76" r="${r}" fill="none" stroke="${C.sunk}" stroke-width="19"/>${arcs}</svg>`;
}

// ── Sankey SVG (rubans bézier proportionnels) ──────────────────────────────
function ribbon(xL, yLt, yLb, xR, yRt, yRb, color, op) {
  const cx = (xL + xR) / 2;
  return `<path d="M${xL},${yLt} C${cx},${yLt} ${cx},${yRt} ${xR},${yRt} L${xR},${yRb} C${cx},${yRb} ${cx},${yLb} ${xL},${yLb} Z" fill="${color}" fill-opacity="${op}"/>`;
}
function sankeySvg(incomes, outflows) {
  const W = 700, top = 20, span = 260;
  const inTot = incomes.reduce((s, d) => s + d.value, 0);
  const outTot = outflows.reduce((s, d) => s + d.value, 0);
  const total = Math.max(inTot, outTot, 1);
  const h = (v) => (v / total) * span;
  const xInBar = 142, inW = 8, xHub = 348, hubW = 12, xOutBar = 556, outW = 8;
  const xLin = xInBar + inW, xRin = xHub, xLout = xHub + hubW, xRout = xOutBar;

  let ribbons = '', cL = top, cH = top;
  incomes.forEach((d) => { const hh = h(d.value); ribbons += ribbon(xLin, cL, cL + hh, xRin, cH, cH + hh, d.color, 0.28); cL += hh; cH += hh; });
  let cHo = top, cR = top;
  outflows.forEach((d) => { const hh = h(d.value); ribbons += ribbon(xLout, cHo, cHo + hh, xRout, cR, cR + hh, d.color, 0.34); cHo += hh; cR += hh; });

  let nodes = '';
  cL = top;
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
  return `<svg viewBox="0 0 ${W} 300" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block">${ribbons}${nodes}</svg>`;
}

// ── briques HTML ───────────────────────────────────────────────────────────
function section(roman, title, aside = '') {
  return `<div class="sect-h"><span class="sect-roman">${roman}</span><span class="sect-t">${esc(title)}</span>${aside ? `<span class="sect-aside">${esc(aside)}</span>` : ''}</div>`;
}
function kpi(k) {
  const cls = k.tone || 'a';
  return `<div class="kpi ${cls}"><div class="kpi-l">${esc(k.label)}</div>
    <div class="kpi-v"${k.color ? ` style="color:${k.color}"` : ''}>${k.value}</div>
    ${k.hint ? `<div class="kpi-s">${esc(k.hint)}</div>` : ''}</div>`;
}
function table(headers, rows, aligns = []) {
  if (!rows.length) rows = [headers.map(() => '—')];
  const th = headers.map((hh, i) => `<th${aligns[i] === 'r' ? ' class="r"' : ''}>${esc(hh)}</th>`).join('');
  const trs = rows.map((r) => `<tr>${r.map((cell, i) => `<td${aligns[i] === 'r' ? ' class="r"' : ''}>${cell}</td>`).join('')}</tr>`).join('');
  return `<table class="tbl"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

// ── document complet ────────────────────────────────────────────────────────
export function generateBilanHtmlReport(data) {
  const {
    netWorth, liquidWealth, assetsValue, liabilitiesValue,
    thisMonthStats, monthlyEvolution = [], wealthHistory = [],
    visibleAccounts = [], accountBalances = {}, visibleAssets = [], visibleLiabilities = [],
    members = [], activeMemberId, recurringGroups = [], categoryAnalysis = {}, categories = [],
    memberShare = () => 1, currentMonth, ASSET_CLASS_MAP = {},
  } = data;

  const activeMember = members.find((m) => m.id === activeMemberId);
  const ownerLine = `${activeMember ? activeMember.name + ' · ' : ''}Foyer`;

  // ── calculs (repris de l'ancien pdfReport.js) ──
  const sorted = [...monthlyEvolution].sort((a, b) => a.month.localeCompare(b.month));
  let perf1m = null;
  if (sorted.length >= 2) {
    const last = sorted[sorted.length - 1].balance, prev = sorted[sorted.length - 2].balance;
    if (prev !== 0) perf1m = ((last - prev) / Math.abs(prev)) * 100;
  }
  const debtRatio = (assetsValue + liquidWealth) > 0 ? (liabilitiesValue / (assetsValue + liquidWealth)) * 100 : null;
  const actifsTotal = liquidWealth + assetsValue;
  const immoAssets = visibleAssets.reduce((s, a) => {
    const cls = ASSET_CLASS_MAP?.[a.type]?.class;
    return cls === 'Immobilier' ? s + (parseFloat(a.currentValue) || 0) * memberShare(a) : s;
  }, 0);
  const mortgageDebt = visibleLiabilities.reduce((s, l) => {
    if (l.type !== 'mortgage') return s;
    const bal = parseFloat(l.remainingCapital ?? l.remaining_capital ?? 0) || 0;
    return s + bal * memberShare(l);
  }, 0);
  const immoNet = immoAssets - mortgageDebt;
  const cashWealth = actifsTotal - immoAssets;

  // delta patrimoine net depuis wealthHistory (net worth réel), sinon null
  const wh = [...wealthHistory].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  let nwDelta = null, nwDeltaPct = null;
  if (wh.length >= 2) {
    const a = wh[wh.length - 1].net_worth ?? wh[wh.length - 1].netWorth;
    const b = wh[wh.length - 2].net_worth ?? wh[wh.length - 2].netWorth;
    if (typeof a === 'number' && typeof b === 'number') {
      nwDelta = a - b;
      if (b !== 0) nwDeltaPct = (nwDelta / Math.abs(b)) * 100;
    }
  }

  // allocation
  const allocClasses = {};
  if (liquidWealth > 0) allocClasses['Liquidités'] = liquidWealth;
  visibleAssets.forEach((a) => {
    const cls = ASSET_CLASS_MAP?.[a.type]?.class || 'Divers';
    allocClasses[cls] = (allocClasses[cls] || 0) + (parseFloat(a.currentValue) || 0) * memberShare(a);
  });
  const allocSegments = Object.entries(allocClasses)
    .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }));
  const allocTotal = allocSegments.reduce((s, x) => s + x.value, 0) || 1;

  // trésorerie
  const savingsRate = thisMonthStats?.income > 0 ? (thisMonthStats.net / thisMonthStats.income) * 100 : null;
  const skIncome = thisMonthStats?.income || 0, skExpenses = thisMonthStats?.expenses || 0, skNet = thisMonthStats?.net || 0;

  // sankey
  let sankey = '';
  let sankeyFoot = '';
  if (skIncome > 0 || skExpenses > 0) {
    const expCats = Object.entries(categoryAnalysis || {})
      .filter(([, d]) => d.current > 0)
      .map(([catId, d]) => ({ name: categories.find((c) => c.id === catId)?.name || catId, value: d.current }))
      .sort((a, b) => b.value - a.value);
    const expColors = [PALETTE[2], PALETTE[4], PALETTE[3], PALETTE[6], C.amber];
    const top5 = expCats.slice(0, 5).map((c, i) => ({ ...c, color: expColors[i % expColors.length] }));
    const otherExp = Math.max(0, skExpenses - top5.reduce((s, c) => s + c.value, 0));
    const outflows = [...top5];
    if (otherExp > 1) outflows.push({ name: 'Autres dépenses', value: otherExp, color: PALETTE[5] });
    if (skNet > 0) outflows.push({ name: 'Épargne', value: skNet, color: C.sage, savings: true });
    if (!outflows.length) outflows.push({ name: 'Dépenses', value: skExpenses || 1, color: C.terracotta });
    const incomes = [{ name: 'Revenus', value: skIncome || skExpenses, color: C.accent }];
    sankey = sankeySvg(incomes, outflows);
    const rate = skIncome > 0 ? (skNet / skIncome) * 100 : 0;
    sankeyFoot = `<div class="sk-foot">
      <div>Entrées <b class="pos">${eur(skIncome, true)}</b></div>
      <div>Sorties <b class="neg">${eur(-skExpenses)}</b></div>
      <div>Épargne <b class="${skNet >= 0 ? 'pos' : 'neg'}">${eur(skNet, true)}</b> <span style="color:${C.faint}">(${rate.toFixed(0)} %)</span></div>
    </div>`;
  } else {
    sankey = `<p class="empty">Pas de mouvements ce mois-ci.</p>`;
  }

  // top dépenses
  const topCats = Object.entries(categoryAnalysis || {})
    .filter(([, d]) => d.current > 0)
    .map(([catId, d]) => {
      const cat = categories.find((c) => c.id === catId);
      const change = d.avg3m > 0 ? ((d.current - d.avg3m) / d.avg3m) * 100 : 0;
      return { name: cat?.name || catId, current: d.current, avg: d.avg3m, change };
    }).sort((a, b) => b.current - a.current).slice(0, 8);
  const topRows = topCats.map((c) => [
    esc(c.name), eur(c.current), eur(c.avg),
    Math.abs(c.change) > 5 ? `<span style="color:${c.change > 0 ? C.terracotta : C.sage}">${c.change > 0 ? '+' : ''}${c.change.toFixed(0)} %</span>` : '—',
  ]);

  // charges fixes
  const now = new Date();
  const recRows = (recurringGroups || [])
    .filter((rg) => {
      const ld = new Date(rg.lastDate);
      const ma = (now.getFullYear() - ld.getFullYear()) * 12 + (now.getMonth() - ld.getMonth());
      return ma <= 2;
    })
    .map((rg) => {
      const acc = visibleAccounts.find((a) => a.id === rg.accountId);
      const share = acc ? memberShare(acc) : 1;
      return { ...rg, sharedAmount: rg.avgAmount * share, accName: acc?.name };
    })
    .sort((a, b) => Math.abs(b.sharedAmount) - Math.abs(a.sharedAmount)).slice(0, 12)
    .map((rg) => [`Le ${esc(rg.avgDay)}`, esc(rg.label || '—'), esc(rg.accName || '—'), eur(rg.sharedAmount)]);

  // évolution
  const lastN = sorted.slice(-12).reverse();
  const evRows = lastN.map((m) => [
    esc(monthShort(m.month)),
    `<span style="color:${C.sage}">${eur(m.income)}</span>`,
    `<span style="color:${C.terracotta}">${eur(m.expenses)}</span>`,
    `<b>${eur(m.net, true)}</b>`, eur(m.balance),
  ]);

  // comptes / actifs / dettes
  const accRows = visibleAccounts.map((a) => {
    const bal = (accountBalances?.[a.id] || 0) * memberShare(a);
    const owners = (a.memberIds || []).map((id) => members.find((m) => m.id === id)?.name).filter(Boolean).join(' & ');
    return [esc(a.name), esc(a.bank || '—'), esc(owners || '—'), `<b>${eur(bal)}</b>`];
  });
  const assetRows = visibleAssets.slice()
    .sort((a, b) => (parseFloat(b.currentValue) || 0) * memberShare(b) - (parseFloat(a.currentValue) || 0) * memberShare(a))
    .map((a) => {
      const share = memberShare(a);
      const current = (parseFloat(a.currentValue) || 0) * share;
      const cost = (parseFloat(a.purchasePrice) || 0) * share;
      const pv = cost > 0 ? current - cost : null;
      const pvPct = cost > 0 ? (pv / cost) * 100 : null;
      return [
        esc(a.name || '—'), esc(ASSET_CLASS_MAP?.[a.type]?.class || a.type || 'Divers'),
        `<b>${eur(current)}</b>`, cost > 0 ? eur(cost) : '—',
        pv == null ? '—' : `<span style="color:${pv >= 0 ? C.sage : C.terracotta}">${eur(pv, true)} (${pvPct >= 0 ? '+' : ''}${pvPct.toFixed(1)} %)</span>`,
      ];
    });
  const liaRows = visibleLiabilities.map((l) => {
    const share = memberShare(l);
    const remaining = (parseFloat(l.remainingCapital ?? l.remaining_capital ?? 0) || 0) * share;
    const monthly = (parseFloat(l.monthlyPayment ?? l.monthly_payment ?? 0) || 0) * share;
    return [
      esc(l.name || '—'), esc(l.type || '—'),
      l.interestRate ? `${parseFloat(l.interestRate).toFixed(2)} %` : '—',
      monthly > 0 ? eur(monthly) : '—', `<b style="color:${C.terracotta}">${eur(remaining)}</b>`,
    ];
  });

  // delta badge (band)
  let deltaBadge = '';
  if (nwDelta != null) {
    const pos = nwDelta >= 0;
    deltaBadge = `<div class="nw-delta" style="background:${pos ? '#E1EFE6' : '#F6E4E1'};color:${pos ? C.sage : C.terracotta}">${eur(nwDelta, true)}${nwDeltaPct != null ? ` · ${pos ? '+' : '−'}${Math.abs(nwDeltaPct).toFixed(1)} %` : ''} ce mois</div>`;
  }

  // composition rows
  const compRows = allocSegments.map((s) => {
    const p = (s.value / allocTotal) * 100;
    return `<div class="comp-row">
      <div class="comp-top">
        <span class="comp-name"><span class="dot" style="background:${s.color}"></span>${esc(s.name)}</span>
        <span class="comp-amt"><b>${eur(s.value)}</b><em>${p.toFixed(0)} %</em></span>
      </div>
      <div class="comp-track"><i style="width:${Math.max(3, p).toFixed(1)}%;background:${s.color}"></i></div>
    </div>`;
  }).join('');

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

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Wealthly — Bilan patrimonial</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Newsreader:ital,wght@1,400;1,500&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:'Geist',-apple-system,Segoe UI,sans-serif; color:${C.ink}; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .serif { font-family:'Newsreader',Georgia,serif; font-style:italic; }
  .mono { font-family:'Geist Mono',monospace; }
  .head { display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid ${C.border}; padding-bottom:14px; }
  .brand { display:flex; align-items:center; gap:10px; }
  .brand-mark { width:30px; height:30px; border-radius:8px; background:${C.ink}; color:${C.paper}; font-weight:700; font-size:16px; display:flex; align-items:center; justify-content:center; }
  .brand b { font-size:16px; letter-spacing:-.01em; }
  .head-r { text-align:right; font-size:10px; color:${C.faint}; font-family:'Geist Mono',monospace; letter-spacing:.04em; }
  .doc-title { margin:24px 0 6px; }
  .eyebrow { font-size:10px; letter-spacing:.18em; text-transform:uppercase; color:${C.faint}; font-weight:600; }
  h1.title { font-size:30px; font-weight:600; letter-spacing:-.02em; margin:6px 0 0; }
  h1.title em { font-weight:500; }
  .nw { display:flex; align-items:flex-end; justify-content:space-between; margin:20px 0 4px; padding:20px 24px; background:linear-gradient(135deg,#FBFAF6,#fff); border:1px solid ${C.border}; border-radius:14px; break-inside:avoid; }
  .nw-lab { font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:${C.faint}; font-weight:600; }
  .nw-val { font-family:'Newsreader',Georgia,serif; font-style:italic; font-weight:500; font-size:42px; line-height:1; margin-top:6px; }
  .nw-delta { display:inline-block; padding:5px 12px; border-radius:999px; font-size:12.5px; font-weight:600; }
  .sect { margin-top:26px; break-inside:avoid; }
  .sect-h { display:flex; align-items:baseline; gap:8px; border-bottom:1px solid ${C.border}; padding-bottom:7px; margin-bottom:14px; }
  .sect-roman { font-family:'Geist Mono',monospace; font-size:10px; color:${C.accent}; font-weight:500; }
  .sect-t { font-size:9px; letter-spacing:.18em; text-transform:uppercase; color:${C.muted}; font-weight:600; }
  .sect-aside { margin-left:auto; font-size:11px; color:${C.faint}; }
  .kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .kpi { border:1px solid ${C.border}; border-radius:10px; padding:13px 15px; background:#fff; position:relative; overflow:hidden; break-inside:avoid; }
  .kpi::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; }
  .kpi.a::before{background:${C.accent}} .kpi.b::before{background:${C.sage}} .kpi.c::before{background:${C.amber}}
  .kpi-l { font-size:9.5px; letter-spacing:.07em; text-transform:uppercase; color:${C.faint}; font-weight:600; }
  .kpi-v { font-size:19px; font-weight:600; margin-top:5px; letter-spacing:-.015em; font-variant-numeric:tabular-nums; }
  .kpi-s { font-size:10.5px; color:${C.faint}; margin-top:2px; }
  .comp { display:flex; gap:30px; align-items:center; break-inside:avoid; }
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
  .sankey-card { border:1px solid ${C.border}; border-radius:14px; background:#fff; padding:18px 20px 12px; break-inside:avoid; }
  .sk-foot { display:flex; gap:24px; padding:10px 4px 2px; border-top:1px solid ${C.sunk}; margin-top:8px; font-size:11.5px; color:${C.muted}; }
  .sk-foot b { font-variant-numeric:tabular-nums; }
  .pos { color:${C.sage}; } .neg { color:${C.terracotta}; }
  .tbl { width:100%; border-collapse:collapse; font-size:11.5px; }
  .tbl th { text-align:left; font-size:9px; letter-spacing:.08em; text-transform:uppercase; color:${C.faint}; font-weight:600; padding:0 8px 7px; border-bottom:1px solid ${C.border}; }
  .tbl td { padding:7px 8px; border-bottom:1px solid ${C.sunk}; color:${C.body}; font-variant-numeric:tabular-nums; }
  .tbl td b { color:${C.ink}; font-weight:600; }
  .tbl .r { text-align:right; }
  .empty { font-size:12px; color:${C.faint}; padding:6px 0; }
  .foot { margin-top:30px; border-top:1px solid ${C.border}; padding-top:10px; display:flex; justify-content:space-between; font-size:9px; color:${C.faint}; font-family:'Geist Mono',monospace; letter-spacing:.04em; }
</style></head>
<body>
  <div class="head">
    <div class="brand"><span class="brand-mark">W</span><b>Wealthly</b></div>
    <div class="head-r">Bilan patrimonial<br>Édité le ${todayLong()} · ${esc(ownerLine)}</div>
  </div>

  <div class="doc-title">
    <div class="eyebrow">Bilan ${esc(monthLong(currentMonth))}</div>
    <h1 class="title">Votre <em class="serif">patrimoine.</em></h1>
  </div>

  <div class="nw">
    <div><div class="nw-lab">Patrimoine net</div><div class="nw-val">${eur(netWorth)}</div></div>
    <div style="text-align:right">${deltaBadge}</div>
  </div>

  <div class="sect">${section('01', "Vue d'ensemble")}<div class="kpis">${kpisOverview.map(kpi).join('')}</div></div>

  <div class="sect">${section('02', 'Composition du patrimoine', allocSegments.length ? `${allocSegments.length} classes d'actifs` : '')}
    ${allocSegments.length ? `<div class="comp">
      <div class="comp-donut">${donutSvg(allocSegments)}<div class="comp-center"><span class="v">${eur(allocTotal)}</span><span class="l">réparti</span></div></div>
      <div class="comp-rows">${compRows}</div>
    </div>` : `<p class="empty">Aucun actif renseigné.</p>`}
  </div>

  <div class="sect">${section('03', 'Trésorerie du mois', esc(monthLong(currentMonth)))}
    <div class="kpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">${kpisTreso.map(kpi).join('')}</div>
    <div class="sankey-card">${sankey}${sankeyFoot}</div>
  </div>

  <div class="sect">${section('04', 'Top dépenses du mois')}${table(['Catégorie', 'Ce mois', 'Moy. 3 mois', 'Δ'], topRows, ['', 'r', 'r', 'r'])}</div>

  ${recRows.length ? `<div class="sect">${section('05', 'Charges fixes récurrentes')}${table(['Jour', 'Libellé', 'Compte', 'Montant'], recRows, ['', '', '', 'r'])}</div>` : ''}

  ${evRows.length ? `<div class="sect">${section('06', 'Évolution mensuelle')}${table(['Mois', 'Revenus', 'Dépenses', 'Solde net', 'Solde fin'], evRows, ['', 'r', 'r', 'r', 'r'])}</div>` : ''}

  <div class="sect">${section('07', 'Comptes bancaires')}${table(['Compte', 'Banque', 'Propriétaires', 'Solde'], accRows, ['', '', '', 'r'])}</div>

  <div class="sect">${section('08', 'Actifs détaillés')}${assetRows.length ? table(['Libellé', 'Classe', 'Valeur', 'Prix de revient', 'PV latente'], assetRows, ['', '', 'r', 'r', 'r']) : '<p class="empty">Aucun actif renseigné.</p>'}</div>

  ${liaRows.length ? `<div class="sect">${section('09', 'Dettes en cours')}${table(['Libellé', 'Type', 'Taux', 'Mensualité', 'Restant dû'], liaRows, ['', '', 'r', 'r', 'r'])}</div>` : ''}

  <div class="foot"><span>Document confidentiel · Wealthly</span><span>${todayLong()}</span></div>

  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 450);
    });
    window.addEventListener('afterprint', function () { setTimeout(function(){ window.close(); }, 200); });
  </script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert("Le navigateur a bloqué l'ouverture du bilan. Autorise les pop-ups pour ce site puis réessaie.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
