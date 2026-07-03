/**
 * Yotori Finance — bilan patrimonial PDF (HTML/CSS → impression navigateur).
 *
 * CHARTE = celle de l'app (tokens index.css) : papier chaud #F7F6F2, cobalt
 * #0E7C56, sage/terracotta, dataviz d1–d7, Geist + Newsreader (serif italique
 * cobalt). Cartes blanches, radii 16.
 *
 * LOGIQUE MÉTIER (corrigée 2026-06-08) :
 *   - Comptes d'investissement (PEA/CTO/AV/PER/crypto) : la valeur vit dans les
 *     POSITIONS (assets enfants via parent_asset_id), pas dans le parent. On
 *     somme les positions (+ cash résiduel) et on récupère les COURS LIVE
 *     (api.quotes) pour les valoriser. Les positions sont listées sous le compte.
 *   - Immobilier : prêt lié via liability.linked_asset_id → on affiche
 *     valeur − crédit = NET par bien, + net total de la classe.
 *
 * Fonction ASYNC : ouvre la fenêtre tout de suite (placeholder, anti popup-block),
 * puis fetch des cours, puis écrit le document final.
 */
import { computeHealthScore } from './components/HealthScore.jsx';
import { quotes as quotesApi } from './api.js';
import { cryptoToYahoo } from './utils/marketPrices.js';

const SANS = "'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif";
const SERIF = "'Geist', system-ui, sans-serif";
const MONO = "'Geist Mono', ui-monospace, 'SF Mono', monospace";
const C = {
  bg: '#F7F6F2', surface: '#FFFFFF', sunk: '#EFEDE6',
  border: '#E4E1D8', borderStrong: '#D2CEC0',
  ink: '#16150F', ink2: '#56544A', ink3: '#8C8979',
  accent: '#0E7C56', accentSoft: '#E1F1E9', accentLine: '#BFE0CE',
  pos: '#136D3E', posSoft: '#DBEDE2', neg: '#B0392B', negSoft: '#F4E2DE',
  warn: '#8E641A',
};
const DV = ['#0E7C56', '#1F8E6E', '#C2733B', '#7B57C6', '#B85D7A', '#4D4D4D', '#E0B23E'];

const nf = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur = (v, sign = false) => {
  if (v == null || isNaN(v)) return '—';
  const s = nf.format(Math.abs(v));
  if (v < 0) return `−${s}`;
  if (sign && v > 0) return `+${s}`;
  return s;
};
const qty = (v) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 }).format(v || 0);
const pctStr = (v, d = 1) => (v == null ? '—' : `${v >= 0 ? '' : '−'}${Math.abs(v).toFixed(d)} %`);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const todayLong = () => new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const monthLong = (mk) => { if (!mk) return ''; const [y, m] = mk.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); };
const monthShort = (mk) => { if (!mk) return ''; const [y, m] = mk.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }); };

const yahooSym = (a) => {
  const raw = (a.tickerYahoo || a.ticker_yahoo || a.ticker || '').toString().toUpperCase().trim();
  if (!raw) return null;
  return (a.type === 'crypto') ? cryptoToYahoo(raw) : raw;
};
const livePrice = (prices, sym) => {
  if (!sym) return null;
  const q = prices[sym];
  if (q == null) return null;
  if (typeof q === 'number') return q;
  return (typeof q.price === 'number') ? q.price : null;
};

// ── donut ──
function donutSvg(segments, sw = 17, r = 58) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const Circ = 2 * Math.PI * r; let off = 0;
  const size = (r + sw / 2 + 2) * 2; const c = size / 2;
  const arcs = segments.map((s) => {
    const dash = (s.value / total) * Circ;
    const a = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-dasharray="${dash.toFixed(2)} ${(Circ - dash).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
    off += dash; return a;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${C.sunk}" stroke-width="${sw}"/>${arcs}</svg>`;
}

// ── courbe d'aire ──
function areaChartSvg(series) {
  if (!series || series.length < 2) return '<p class="empty">Historique insuffisant.</p>';
  const W = 700, H = 152, padL = 2, padR = 2, padT = 18, padB = 22;
  const vals = series.map((s) => s.value);
  const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1;
  const n = series.length;
  const x = (i) => padL + i * (W - padL - padR) / (n - 1);
  const y = (v) => padT + (1 - (v - min) / range) * (H - padT - padB);
  const line = series.map((s, i) => `${x(i).toFixed(1)},${y(s.value).toFixed(1)}`).join(' ');
  const area = `${padL},${(H - padB).toFixed(1)} ${line} ${(W - padR).toFixed(1)},${(H - padB).toFixed(1)}`;
  const last = series[n - 1];
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.15"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></linearGradient></defs>
    <polygon points="${area}" fill="url(#ag)"/>
    <polyline points="${line}" fill="none" stroke="${C.accent}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${x(n - 1).toFixed(1)}" cy="${y(last.value).toFixed(1)}" r="3.6" fill="${C.accent}"/>
    <text x="${padL}" y="${H - 6}" style="font:400 9px ${MONO};fill:${C.ink3}">${esc(series[0].label)}</text>
    <text x="${W - padR}" y="${H - 6}" text-anchor="end" style="font:400 9px ${MONO};fill:${C.ink3}">${esc(last.label)}</text>
    <text x="${(x(n - 1) - 5).toFixed(1)}" y="${(y(last.value) - 9).toFixed(1)}" text-anchor="end" style="font:600 10px ${SANS};fill:${C.ink}">${eur(last.value)}</text>
  </svg>`;
}

const _ic = 'width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  Immobilier: `<svg ${_ic}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></svg>`,
  Placements: `<svg ${_ic}><path d="M3 17l5.5-5.5 3.5 3.5L21 6"/><path d="M15 6h6v6"/></svg>`,
  Crypto: `<svg ${_ic}><circle cx="12" cy="12" r="9"/><path d="M9.5 8h4a2.2 2.2 0 0 1 0 4.4h-4zM9.5 12.4h4.6a2.2 2.2 0 0 1 0 4.4H9.5zM9.5 6.5v11"/></svg>`,
  Liquidités: `<svg ${_ic}><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/></svg>`,
  Emprunts: `<svg ${_ic}><rect x="2.5" y="5" width="19" height="14" rx="2.2"/><path d="M2.5 9.5h19"/></svg>`,
  Divers: `<svg ${_ic}><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>`,
};
const iconFor = (cls) => ICONS[cls] || ICONS.Divers;
const plPill = (pv, pvp) => { if (pv == null) return ''; const up = pv >= 0; return `<span class="pill" style="background:${up ? C.posSoft : C.negSoft};color:${up ? C.pos : C.neg}">${eur(pv, true)}${pvp != null ? ` · ${up ? '+' : ''}${pvp.toFixed(1)} %` : ''}</span>`; };
const flatPill = (txt) => `<span class="pill" style="background:${C.sunk};color:${C.ink2}">${txt}</span>`;

function card(title, color, total, metaTop, metaBot, body) {
  return `<div class="card">
    <div class="card-h">
      <span class="card-ic" style="background:${color}">${iconFor(title)}</span>
      <div class="card-tt"><div class="card-t">${esc(title)}</div></div>
      <div class="card-meta"><div class="card-tot">${total}</div>${metaBot ? `<div class="card-pctw">${metaBot}</div>` : ''}</div>
    </div>
    <div class="card-share"><i style="width:${Math.max(2, metaTop || 0).toFixed(1)}%;background:${color}"></i></div>
    <div class="card-body">${body}</div>
  </div>`;
}
// ligne principale + sous-lignes (positions) optionnelles
function cardRow(name, sub, value, pill, weightPct, color, subRows = '') {
  return `<div class="ci">
    <div class="ci-top"><div class="ci-l"><div class="ci-n">${esc(name)}</div>${sub ? `<div class="ci-s">${sub}</div>` : ''}</div><div class="ci-r"><div class="ci-v">${value}</div>${pill || ''}</div></div>
    <div class="ci-w"><i style="width:${Math.max(2, weightPct || 0).toFixed(1)}%;background:${color}"></i></div>
    ${subRows ? `<div class="pos-list">${subRows}</div>` : ''}
  </div>`;
}
function posRow(name, meta, value, pill) {
  return `<div class="pos"><div class="pos-l"><span class="pos-n">${esc(name)}</span>${meta ? `<span class="pos-m">${esc(meta)}</span>` : ''}</div><div class="pos-r"><span class="pos-v">${value}</span>${pill || ''}</div></div>`;
}

// Impression via iframe caché — chemin mobile-safe (les pop-ups `window.open`
// sont bloquées par défaut sur mobile, ce qui rendait le bouton « Bilan PDF »
// inopérant). On écrit le document dans un iframe et on imprime son contenu.
function printViaIframe(html) {
  const cleaned = html.replace(/<script>[\s\S]*?<\/script>/g, ''); // on pilote l'impression nous-mêmes
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(cleaned); doc.close();
  let done = false;
  const fire = () => {
    if (done) return; done = true;
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch { /* noop */ }
    setTimeout(() => { try { iframe.remove(); } catch { /* noop */ } }, 3000);
  };
  // Laisse le temps aux polices/SVG de se peindre.
  setTimeout(fire, 800);
}

export async function generateBilanHtmlReport(data) {
  // Desktop : nouvelle fenêtre (aperçu + impression). Mobile : les pop-ups
  // sont bloquées → window.open renvoie null → on bascule sur l'iframe.
  const w = window.open('', '_blank');
  if (w) {
    w.document.open();
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Bilan…</title><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#F7F6F2;color:#56544A;font:500 14px 'Geist',system-ui,sans-serif"><div>Génération de votre bilan patrimonial…</div></body>`);
    w.document.close();
  }
  let html;
  try {
    html = await buildReportHtml(data);
  } catch (e) {
    if (w) { w.document.open(); w.document.write(`<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:40px;color:#B0392B">Erreur lors de la génération du bilan : ${esc(e?.message || e)}</body>`); w.document.close(); }
    else alert("Erreur lors de la génération du bilan. Réessayez.");
    return;
  }
  if (w) {
    w.document.open(); w.document.write(html); w.document.close();
  } else {
    printViaIframe(html);
  }
}

async function buildReportHtml(data) {
  const {
    netWorth, liquidWealth, assetsValue, liabilitiesValue,
    thisMonthStats, monthlyEvolution = [], wealthHistory = [], budgets = {},
    visibleAccounts = [], accountBalances = {}, visibleAssets = [], visibleLiabilities = [],
    members = [], activeMemberId, categoryAnalysis = {},
    memberShare = () => 1, currentMonth, ASSET_CLASS_MAP = {},
  } = data;

  const activeMember = members.find((m) => m.id === activeMemberId);
  const ownerName = activeMember ? activeMember.name : 'Votre foyer';

  // ── positions (enfants) + cours live ──
  const positionsOf = (id) => visibleAssets.filter((a) => (a.parentAssetId || a.parent_asset_id) === id);
  const positionAssets = visibleAssets.filter((a) => (a.parentAssetId || a.parent_asset_id));
  const tickers = [...new Set(positionAssets.map((p) => yahooSym(p)).filter(Boolean))];
  let prices = {};
  if (tickers.length) {
    try {
      prices = await Promise.race([
        quotesApi.get(tickers),
        new Promise((resolve) => setTimeout(() => resolve({}), 4500)),
      ]) || {};
    } catch { prices = {}; }
  }

  // valorise un compte d'investissement à partir de ses positions (+ cash résiduel)
  function valuateAccount(a) {
    const share = memberShare(a);
    const pos = positionsOf(a.id);
    if (pos.length === 0) {
      const cur = (parseFloat(a.currentValue) || 0) * share;
      const cost = (parseFloat(a.purchasePrice) || 0) * share;
      const pv = cost > 0 ? cur - cost : null;
      return { cur, pv, pvp: cost > 0 ? (pv / cost) * 100 : null, subRows: '', positionsValue: cur, cash: 0 };
    }
    let positionsValue = 0, invested = 0, saisiPositions = 0;
    const rows = pos.map((p) => {
      const q = parseFloat(p.quantity) || 0;
      const buyUnit = parseFloat(p.purchasePrice) || 0;
      const saisi = (parseFloat(p.currentValue) || 0) * share;
      const sym = yahooSym(p);
      const lp = livePrice(prices, sym);
      const isLive = lp != null && q > 0;
      const value = isLive ? q * lp * share : saisi;
      const inv = buyUnit * q * share;
      const pv = inv > 0 ? value - inv : null;
      const pvp = inv > 0 ? (pv / inv) * 100 : null;
      positionsValue += value; invested += inv; saisiPositions += saisi;
      const cours = isLive ? lp : (q > 0 ? (saisi / share) / q : 0);
      const meta = `${qty(q)} × ${eur(cours)}${isLive ? ' · live' : ''}`;
      return posRow(p.name || sym || '—', meta, eur(value), plPill(pv, pvp));
    }).join('');
    const saisiParent = (parseFloat(a.currentValue) || 0) * share;
    const cash = Math.max(0, saisiParent - saisiPositions);
    const cur = positionsValue + cash;
    const pv = invested > 0 ? positionsValue - invested : null;
    const pvp = invested > 0 ? (pv / invested) * 100 : null;
    const subRows = rows + (cash > 1 ? posRow('Liquidités du compte', 'cash disponible', eur(cash), '') : '');
    return { cur, pv, pvp, subRows, positionsValue, cash };
  }

  // ── agrégats (avec valeur réelle des comptes d'investissement) ──
  const topAssets = visibleAssets.filter((a) => !(a.parentAssetId || a.parent_asset_id));
  const valueOf = (a) => valuateAccount(a).cur;
  const loansLinkedTo = (assetId) => visibleLiabilities.filter((l) => (l.linkedAssetId || l.linked_asset_id) === assetId);

  const actifsTotal = topAssets.reduce((s, a) => s + valueOf(a), 0) + 0; // assets only (accounts comptés à part)
  // NB : liquidWealth (comptes bancaires) vient déjà séparément.
  const grandAvoirs = liquidWealth + topAssets.reduce((s, a) => s + valueOf(a), 0);

  const immoAssets = topAssets.reduce((s, a) => (ASSET_CLASS_MAP?.[a.type]?.class === 'Immobilier' ? s + valueOf(a) : s), 0);
  const mortgageDebt = visibleLiabilities.reduce((s, l) => (l.type === 'mortgage' ? s + (parseFloat(l.remainingCapital ?? l.remaining_capital ?? 0) || 0) * memberShare(l) : s), 0);
  const immoNet = immoAssets - mortgageDebt;
  const cashWealth = grandAvoirs - immoAssets;
  const debtRatio = grandAvoirs > 0 ? (liabilitiesValue / grandAvoirs) * 100 : null;
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

  // allocation (valeurs réelles)
  const allocClasses = {};
  if (liquidWealth > 0) allocClasses['Liquidités'] = liquidWealth;
  topAssets.forEach((a) => {
    const cls = ASSET_CLASS_MAP?.[a.type]?.class || 'Divers';
    allocClasses[cls] = (allocClasses[cls] || 0) + valueOf(a);
  });
  const allocSegments = Object.entries(allocClasses).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, color: DV[i % DV.length] }));
  const allocTotal = allocSegments.reduce((s, x) => s + x.value, 0) || 1;
  const classColor = {}; allocSegments.forEach((s) => { classColor[s.name] = s.color; });
  const colorFor = (cls) => classColor[cls] || C.accent;

  const score = computeHealthScore({ monthlyEvolution, liquidWealth, assetsValue, liabilitiesValue, visibleAssets, budgets, categoryAnalysis });

  // ── cartes page 2 ──
  const byClass = {};
  topAssets.forEach((a) => { const cls = ASSET_CLASS_MAP?.[a.type]?.class || 'Divers'; (byClass[cls] = byClass[cls] || []).push(a); });
  const subtypeLabel = (t) => ({
    pea: 'PEA', life_insurance: 'Assurance-vie', per: 'PER', stocks: 'CTO', crypto: 'Crypto', real_estate: 'Immobilier',
    mortgage: 'Crédit immobilier', auto: 'Crédit auto', consumer: 'Crédit conso', personal: 'Prêt personnel',
    student: 'Prêt étudiant', revolving: 'Crédit renouvelable', loan: 'Prêt',
  })[t] || t || '';

  function assetCard(cls, list) {
    const color = colorFor(cls);
    const tot = list.reduce((s, a) => s + valueOf(a), 0);
    const pctW = grandAvoirs > 0 ? (tot / grandAvoirs) * 100 : 0;
    const isImmo = cls === 'Immobilier';
    let linkedLoanSum = 0;
    const body = list.slice().sort((a, b) => valueOf(b) - valueOf(a)).map((a) => {
      const v = valuateAccount(a);
      const lab = subtypeLabel(a.type); const sub = (lab && lab !== cls) ? `<span class="sub-lab">${esc(lab)}</span>` : '';
      const w = tot > 0 ? (v.cur / tot) * 100 : 0;
      if (isImmo) {
        const loans = loansLinkedTo(a.id);
        const rem = loans.reduce((s, l) => s + (parseFloat(l.remainingCapital ?? l.remaining_capital ?? 0) || 0) * memberShare(l), 0);
        linkedLoanSum += rem;
        const net = v.cur - rem;
        const pill = rem > 0
          ? `<span class="pill" style="background:${C.negSoft};color:${C.neg}">crédit −${esc(eur(rem))}</span> <span class="pill" style="background:${C.posSoft};color:${C.pos}">net ${esc(eur(net))}</span>`
          : '';
        return cardRow(a.name || '—', sub, eur(v.cur), pill, w, color, '');
      }
      return cardRow(a.name || '—', sub, eur(v.cur), plPill(v.pv, v.pvp), w, color, v.subRows);
    }).join('');
    const metaBot = isImmo && linkedLoanSum > 0
      ? `net ${esc(eur(tot - linkedLoanSum))} après crédit`
      : `${pctW.toFixed(0)} % du patrimoine`;
    return card(cls, color, eur(tot), pctW, metaBot, body);
  }

  const assetCardsHtml = Object.entries(byClass)
    .sort((a, b) => b[1].reduce((s, x) => s + valueOf(x), 0) - a[1].reduce((s, x) => s + valueOf(x), 0))
    .map(([cls, list]) => assetCard(cls, list)).join('');

  const liqColor = colorFor('Liquidités');
  const liqBody = visibleAccounts.map((a) => ({ a, bal: (accountBalances?.[a.id] || 0) * memberShare(a) })).sort((x, y) => y.bal - x.bal)
    .map(({ a, bal }) => cardRow(a.name, `<span class="sub-lab">${esc(a.bank || '—')}</span>`, eur(bal), '', liquidWealth > 0 ? (bal / liquidWealth) * 100 : 0, liqColor)).join('');
  const liqCardHtml = visibleAccounts.length ? card('Liquidités', liqColor, eur(liquidWealth), grandAvoirs > 0 ? (liquidWealth / grandAvoirs) * 100 : 0, `${grandAvoirs > 0 ? ((liquidWealth / grandAvoirs) * 100).toFixed(0) : 0} % du patrimoine`, liqBody) : '';

  const loanTotal = visibleLiabilities.reduce((s, l) => s + (parseFloat(l.remainingCapital ?? l.remaining_capital ?? 0) || 0) * memberShare(l), 0);
  const loanBody = visibleLiabilities.slice().sort((a, b) => (parseFloat(b.remainingCapital ?? b.remaining_capital ?? 0) || 0) - (parseFloat(a.remainingCapital ?? a.remaining_capital ?? 0) || 0)).map((l) => {
    const sh = memberShare(l);
    const rem = (parseFloat(l.remainingCapital ?? l.remaining_capital ?? 0) || 0) * sh;
    const mon = (parseFloat(l.monthlyPayment ?? l.monthly_payment ?? 0) || 0) * sh;
    const rate = l.interestRate ? `${parseFloat(l.interestRate).toFixed(2)} %` : '—';
    const linkedAssetId = l.linkedAssetId || l.linked_asset_id;
    const linkedAsset = linkedAssetId ? topAssets.find((a) => a.id === linkedAssetId) : null;
    const subTxt = `<span class="sub-lab">${esc(subtypeLabel(l.type) || 'Crédit')} · taux ${rate}</span>${linkedAsset ? ` · adossé à ${esc(linkedAsset.name)}` : ''}`;
    const w = loanTotal > 0 ? (rem / loanTotal) * 100 : 0;
    return cardRow(l.name || '—', subTxt, eur(rem), mon > 0 ? flatPill(`${eur(mon)} / mois`) : '', w, C.neg, '');
  }).join('');
  const loanCardHtml = visibleLiabilities.length ? card('Emprunts', C.neg, eur(loanTotal), null, 'capital restant dû', loanBody) : '';

  // synthèse
  const sp = [];
  if (nwDeltaPct != null) sp.push(`votre patrimoine net ${nwDeltaPct >= 0 ? 'progresse' : 'recule'} de <b>${pctStr(nwDeltaPct)}</b> et s'établit à <b>${eur(netWorth)}</b>`);
  else sp.push(`votre patrimoine net s'établit à <b>${eur(netWorth)}</b>`);
  if (savingsRate != null) sp.push(`le taux d'épargne ressort à <b>${savingsRate.toFixed(0)} %</b>`);
  if (debtRatio != null) sp.push(`l'endettement représente <b>${debtRatio.toFixed(0)} %</b> des actifs${debtRatio < 30 ? ' — un niveau sain' : debtRatio < 50 ? ', à surveiller' : ', élevé'}`);
  const synthesis = `Ce mois-ci, ${sp.join(', ')}. La santé patrimoniale est notée <b>${score.total} sur 100</b>.`;

  let deltaChip = '';
  if (nwDelta != null) { const pos = nwDelta >= 0; deltaChip = `<span class="chip" style="background:${pos ? C.posSoft : C.negSoft};color:${pos ? C.pos : C.neg}">${eur(nwDelta, true)}${nwDeltaPct != null ? ` · ${pctStr(nwDeltaPct)}` : ''} sur le mois</span>`; }

  const allocLegend = allocSegments.map((s) => { const p = (s.value / allocTotal) * 100; return `<div class="lg"><span class="lg-dot" style="background:${s.color}"></span><span class="lg-name">${esc(s.name)}</span><span class="lg-val">${eur(s.value)}</span><span class="lg-pct">${p.toFixed(0)} %</span></div>`; }).join('');
  const scoreItems = (score.items || []).map((it) => { const w = it.max > 0 ? Math.round((it.pts / it.max) * 100) : 0; return `<div class="sc"><div class="sc-top"><span>${esc(it.label)}</span><span class="sc-v">${esc(it.value)}</span></div><div class="sc-bar"><i style="width:${w}%"></i></div></div>`; }).join('');
  const cell = (l, v) => `<div class="cell"><div class="cell-l">${esc(l)}</div><div class="cell-v">${v}</div></div>`;

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Yotori Finance — Bilan patrimonial</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Newsreader:ital,wght@1,400;1,500;1,600&display=swap" rel="stylesheet">
<style>
  @page { size:A4; margin:16mm 15mm; }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  body{font-family:${SANS};color:${C.ink};background:${C.bg};-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:12px;line-height:1.5;}
  .serif{font-family:${SERIF};font-style:italic;}
  .empty{font-size:12px;color:${C.ink3};padding:10px 0;}
  .sub-lab{}
  b{font-weight:600;}
  .run-foot{position:fixed;bottom:7mm;left:15mm;right:15mm;display:flex;justify-content:space-between;font-size:8px;letter-spacing:.1em;color:${C.ink3};text-transform:uppercase;}
  .page1{page-break-after:always;}
  .mast{display:flex;align-items:center;justify-content:space-between;padding-bottom:13px;border-bottom:1px solid ${C.border};}
  .mast-brand{display:flex;align-items:center;gap:10px;}
  .mast-mark{width:30px;height:30px;border-radius:7px;background:${C.ink};color:${C.bg};font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;}
  .mast-brand b{font-size:15px;letter-spacing:-.01em;font-weight:600;}
  .mast-r{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:${C.ink3};font-weight:600;}
  .lead{margin:26px 0 0;}
  .eyebrow{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${C.accent};font-weight:600;}
  .lead h1{font-weight:600;font-size:34px;letter-spacing:-.02em;margin:9px 0 0;color:${C.ink};line-height:1.06;}
  .lead h1 .serif{font-weight:500;color:${C.accent};}
  .lead-sub{font-size:12px;color:${C.ink2};margin-top:10px;}
  .lead-sub b{color:${C.ink};font-weight:600;}
  .hero{margin:24px 0 0;}
  .h-lab{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${C.ink3};font-weight:600;}
  .h-val{font-family:${SERIF};font-style:italic;font-weight:500;font-size:62px;line-height:1;margin:6px 0 14px;color:${C.ink};}
  .chip{display:inline-block;padding:5px 13px;border-radius:999px;font-size:12px;font-weight:600;}
  .strip{display:grid;grid-template-columns:repeat(4,1fr);margin:22px 0 0;background:${C.surface};border:1px solid ${C.border};border-radius:14px;overflow:hidden;}
  .cell{padding:14px 16px;border-right:1px solid ${C.border};}
  .cell:last-child{border-right:none;}
  .cell-l{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:${C.ink3};font-weight:600;}
  .cell-v{font-size:20px;font-weight:600;margin-top:6px;font-variant-numeric:tabular-nums;color:${C.ink};}
  .synth{font-size:13px;line-height:1.75;color:${C.ink2};margin:22px 0 0;}
  .synth b{color:${C.ink};font-weight:600;}
  .cols{display:flex;gap:16px;margin-top:24px;align-items:stretch;}
  .panel{flex:1;background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:18px 20px;}
  .sec-h{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:${C.ink3};font-weight:600;margin:0 0 14px;}
  .comp{display:flex;gap:18px;align-items:center;}
  .donut-wrap{position:relative;display:inline-flex;flex-shrink:0;}
  .donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
  .donut-center .dc-v{font-family:${SERIF};font-style:italic;font-weight:500;font-size:17px;line-height:1;color:${C.ink};}
  .donut-center .dc-l{font-size:7.5px;letter-spacing:.14em;text-transform:uppercase;color:${C.ink3};font-weight:600;margin-top:3px;}
  .lg{display:flex;align-items:center;gap:9px;font-size:12px;padding:6px 0;border-bottom:1px solid ${C.sunk};}
  .lg:last-child{border-bottom:none;}
  .lg-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
  .lg-name{flex:1;color:${C.ink2};}
  .lg-val{font-variant-numeric:tabular-nums;font-weight:600;color:${C.ink};}
  .lg-pct{width:40px;text-align:right;color:${C.ink3};font-variant-numeric:tabular-nums;}
  .score-head{display:flex;align-items:baseline;gap:10px;margin-bottom:14px;}
  .score-num{font-family:${SERIF};font-style:italic;font-weight:500;font-size:44px;line-height:1;color:${C.accent};}
  .score-num span{font-size:15px;color:${C.ink3};font-family:${SANS};font-style:normal;}
  .score-cap{font-size:11px;color:${C.ink2};line-height:1.4;}
  .sc{margin-bottom:10px;}
  .sc-top{display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:5px;}
  .sc-top span:first-child{color:${C.ink2};}
  .sc-v{color:${C.ink3};font-variant-numeric:tabular-nums;}
  .sc-bar{height:4px;border-radius:3px;background:${C.sunk};overflow:hidden;}
  .sc-bar>i{display:block;height:100%;border-radius:3px;background:${C.accent};}
  .sec{margin-top:18px;}
  .chart-panel{background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:16px 20px 6px;}
  .p2-lead{margin:24px 0 6px;}
  .p2-lead h2{font-weight:600;font-size:25px;letter-spacing:-.02em;margin:0;color:${C.ink};}
  .p2-lead h2 .serif{font-weight:500;color:${C.accent};}
  .p2-sub{font-size:11px;letter-spacing:.04em;color:${C.ink3};margin-top:6px;}
  .tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0 4px;}
  .tile{background:${C.surface};border:1px solid ${C.border};border-radius:14px;padding:14px 16px;}
  .tile.hero-tile{background:${C.ink};border-color:${C.ink};}
  .tile .t-l{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:${C.ink3};font-weight:600;}
  .tile .t-v{font-family:${SERIF};font-style:italic;font-weight:500;font-size:24px;margin-top:4px;color:${C.ink};font-variant-numeric:tabular-nums;}
  .tile.hero-tile .t-l{color:${C.accentLine};}
  .tile.hero-tile .t-v{color:#fff;}
  .card{background:${C.surface};border:1px solid ${C.border};border-radius:16px;overflow:hidden;margin-top:14px;break-inside:avoid;}
  .card-h{display:flex;align-items:center;gap:12px;padding:13px 16px 12px;}
  .card-ic{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;}
  .card-tt{flex:1;}
  .card-t{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${C.ink};font-weight:700;}
  .card-meta{text-align:right;}
  .card-tot{font-size:16px;font-weight:600;font-variant-numeric:tabular-nums;color:${C.ink};letter-spacing:-.01em;}
  .card-pctw{font-size:9.5px;color:${C.ink3};margin-top:2px;}
  .card-share{height:4px;background:${C.sunk};}
  .card-share>i{display:block;height:100%;}
  .card-body{padding:2px 16px 8px;}
  .ci{padding:11px 0 8px;border-bottom:1px solid ${C.sunk};}
  .ci:last-child{border-bottom:none;}
  .ci-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px;}
  .ci-n{font-size:13px;font-weight:500;color:${C.ink};}
  .ci-s{font-size:10.5px;color:${C.ink3};margin-top:2px;}
  .ci-r{text-align:right;}
  .ci-v{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;color:${C.ink};}
  .pill{display:inline-block;margin-top:5px;margin-left:5px;padding:2px 9px;border-radius:999px;font-size:10px;font-weight:600;font-variant-numeric:tabular-nums;}
  .ci-w{height:3px;border-radius:2px;background:${C.sunk};overflow:hidden;}
  .ci-w>i{display:block;height:100%;opacity:.55;}
  /* positions (titres d'un compte) */
  .pos-list{margin:9px 0 2px;padding:8px 0 2px 12px;border-left:2px solid ${C.sunk};}
  .pos{display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;}
  .pos-l{display:flex;flex-direction:column;}
  .pos-n{font-size:12px;color:${C.ink};font-weight:500;}
  .pos-m{font-size:10px;color:${C.ink3};font-family:${MONO};margin-top:1px;}
  .pos-r{text-align:right;display:flex;align-items:baseline;gap:0;}
  .pos-v{font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;color:${C.ink};}
</style></head>
<body>
  <div class="run-foot"><span>Yotori Finance — Bilan patrimonial</span><span>${esc(ownerName)} · ${todayLong()} · Confidentiel</span></div>

  <div class="page1">
    <div class="mast"><div class="mast-brand"><span class="mast-mark">Y</span><b>Yotori Finance</b></div><div class="mast-r">Bilan patrimonial · ${esc(monthLong(currentMonth))}</div></div>
    <div class="lead">
      <div class="eyebrow">Gestion privée</div>
      <h1>Synthèse de <span class="serif">votre patrimoine.</span></h1>
      <div class="lead-sub">Préparé pour <b>${esc(ownerName)}</b> · ${todayLong()}</div>
    </div>
    <div class="hero">
      <div class="h-lab">Patrimoine net consolidé</div>
      <div class="h-val">${eur(netWorth)}</div>
      ${deltaChip}
    </div>
    <div class="strip">
      ${cell('Patrimoine total', eur(grandAvoirs))}
      ${cell('Immobilier net', eur(immoNet))}
      ${cell('Disponible', eur(cashWealth))}
      ${cell('Endettement', pctStr(debtRatio, 0))}
    </div>
    <div class="synth">${synthesis}</div>
    <div class="cols">
      <div class="panel">
        <div class="sec-h">Composition du patrimoine</div>
        ${allocSegments.length ? `<div class="comp"><div class="donut-wrap">${donutSvg(allocSegments)}<div class="donut-center"><div class="dc-v">${eur(allocTotal)}</div><div class="dc-l">réparti</div></div></div><div style="flex:1">${allocLegend}</div></div>` : '<p class="empty">Aucun actif renseigné.</p>'}
      </div>
      <div class="panel">
        <div class="sec-h">Santé patrimoniale</div>
        <div class="score-head"><span class="score-num">${score.total}<span> / 100</span></span><span class="score-cap">${score.total < 40 ? 'À consolider' : score.total < 70 ? 'Équilibré' : 'Solide'}<br>moyenne sur ${score.monthsCovered || 0} mois</span></div>
        ${scoreItems}
      </div>
    </div>
    <div class="sec"><div class="chart-panel"><div class="sec-h">Évolution du patrimoine net${nwSeries.length >= 2 ? ` · ${nwSeries.length} mois` : ''}</div>${areaChartSvg(nwSeries)}</div></div>
  </div>

  <div class="page2">
    <div class="mast"><div class="mast-brand"><span class="mast-mark">Y</span><b>Yotori Finance</b></div><div class="mast-r">Détail du patrimoine</div></div>
    <div class="p2-lead"><h2>Vos <span class="serif">avoirs & engagements.</span></h2><div class="p2-sub">Au ${todayLong()}${tickers.length ? ' · positions valorisées en temps réel' : ''}</div></div>
    <div class="tiles">
      <div class="tile"><div class="t-l">Total des avoirs</div><div class="t-v">${eur(grandAvoirs)}</div></div>
      <div class="tile"><div class="t-l">Total des dettes</div><div class="t-v">${eur(liabilitiesValue)}</div></div>
      <div class="tile hero-tile"><div class="t-l">Patrimoine net</div><div class="t-v">${eur(netWorth)}</div></div>
    </div>
    ${assetCardsHtml}
    ${liqCardHtml}
    ${loanCardHtml}
    ${(!assetCardsHtml && !liqCardHtml && !loanCardHtml) ? '<p class="empty">Aucun avoir ni engagement renseigné.</p>' : ''}
  </div>

  <script>
    window.addEventListener('load', function(){ setTimeout(function(){ window.focus(); window.print(); }, 700); });
    window.addEventListener('afterprint', function(){ setTimeout(function(){ window.close(); }, 200); });
  </script>
</body></html>`;
}
