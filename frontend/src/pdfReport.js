/**
 * Wealthly — bilan PDF generator.
 *
 * Multi-page A4 report:
 *   1. Cover                — wordmark, big title, date, foyer, page count
 *   2. Synthèse             — net worth hero, KPIs, composition donut + breakdown
 *   3. Évolution            — table of monthly snapshots with sparkline
 *   4. Trésorerie du mois   — cashflow KPIs, Sankey des flux, top 5 cat, charges fixes
 *   5. Détail               — comptes, actifs (avec PV latente), dettes
 *
 * Pure function. Pass props in, get a downloaded file out.
 *
 * Style = sober cream-on-ink (dark mode), cobalt lifté accent rules, signature
 * cobalt strip on the left of every KPI block. Mirrors the app's dark theme so
 * a printed/exported copy reads as the same product.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildAmortization } from './utils.js';

// ---------- Palette (RGB tuples for jsPDF) ----------
// Mirrors the app's LIGHT theme — papier chaud + cobalt sobre.
// Identique aux tokens index.css par defaut (data-theme non set), pour qu'une
// page imprimee se sente comme le meme produit que l'app en mode light.
const C = {
  ink:        [22, 21, 15],      // --ink   #16150F (text primary)
  body:       [56, 54, 45],      // body text — entre ink et ink-2
  muted:      [86, 84, 74],      // --ink-2 #56544A
  faint:      [140, 137, 121],   // --ink-3 #8C8979
  rule:       [210, 206, 192],   // --border-strong #D2CEC0
  hairline:   [228, 225, 216],   // --border #E4E1D8
  paper:      [247, 246, 242],   // --bg page #F7F6F2 (papier chaud)
  cream:      [255, 255, 255],   // --bg-elev card #FFFFFF
  cardFill:   [255, 255, 255],   // raised card surface (white on cream)
  cardSunk:   [239, 237, 230],   // --bg-sunk #EFEDE6 (subtle alt panels)
  accent:     [37, 64, 217],     // --accent cobalt sobre #2540D9
  accentDark: [26, 47, 168],     // --accent-2 #1A2FA8
  accentSoft: [231, 235, 255],   // --accent-soft #E7EBFF
  sage:       [19, 109, 62],     // --positive #136D3E
  terracotta: [176, 57, 43],     // --negative #B0392B
  amber:      [142, 100, 26],    // --warning  #8E641A
  // Dataviz v3 (light) — cobalt sobre, sage, terracotta, mauve, pink, grey, ocre
  pieClasses: [
    [37, 64, 217],     // d1 cobalt #2540D9
    [31, 142, 110],    // d2 sage   #1F8E6E
    [194, 115, 59],    // d3 terracotta #C2733B
    [123, 87, 198],    // d4 mauve  #7B57C6
    [184, 93, 122],    // d5 pink   #B85D7A
    [77, 77, 77],      // d6 grey   #4D4D4D
    [224, 178, 62],    // d7 ocre   #E0B23E
  ],
  // Legacy aliases (gold -> cobalt sobre pour rester sur le mapping existant)
  gold:       [37, 64, 217],     // accent cobalt
  goldDark:   [26, 47, 168],
};

const FONT   = 'helvetica'; // body, captions, tables (jsPDF default sans)
const SERIF  = 'times';     // hero numbers + h1 italic (jsPDF default serif, stand-in for Newsreader)
const PAGE_M = 42;          // page horizontal margin (pt)

// ---------- helpers ----------
const fmtEUR = (v, opts = {}) => {
  const { compact = false, sign = false } = opts;
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
    minimumFractionDigits: 0,
  }).format(Math.abs(v || 0));
  if (sign && v > 0) return `+${formatted}`;
  if (v < 0) return `−${formatted}`;
  return formatted;
};
const fmtPct = (v, d = 1) => (v == null ? '—' : `${v.toFixed(d)} %`);
const todayLong = () => new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
function monthLong(monthKey) {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}
function monthShort(monthKey) {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

// ---------- chrome ----------
function paintBackground(doc) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFillColor(...C.paper);
  doc.rect(0, 0, w, h, 'F');
}

function drawHeader(doc, subtitle) {
  const w = doc.internal.pageSize.getWidth();
  const x = PAGE_M;
  const yBase = 50;          // baseline for the wordmark
  const monogramSize = 22;
  const monogramY = yBase - 16;

  // Monogram refondu 2026-05-21 (user "ancien logo" feedback) — aligne sur
  // le composant Logo.jsx de l'app : carre INK filled + lettre W cream
  // centree. Au lieu du W zigzag stroke-only qui faisait "ancien".
  doc.setFillColor(...C.ink);
  doc.roundedRect(x, monogramY, monogramSize, monogramSize, 4, 4, 'F');
  // Lettre W centree, cream sur ink
  doc.setFont(FONT, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.paper);
  doc.text('W', x + monogramSize / 2, monogramY + monogramSize / 2 + 4.5, { align: 'center' });

  // Wordmark — slightly larger + tracked, no italic
  doc.setFont(FONT, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.ink);
  doc.text('Wealthly', x + monogramSize + 12, yBase, { charSpace: 0.4 });

  // Subtitle right-aligned, in muted ink
  if (subtitle) {
    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text(subtitle, w - PAGE_M, yBase, { align: 'right' });
  }

  // Hairline rule, breathing room before content
  doc.setDrawColor(...C.rule);
  doc.setLineWidth(0.35);
  doc.line(PAGE_M, yBase + 18, w - PAGE_M, yBase + 18);
}

// Header takes up 68pt — content should start at HEADER_BOTTOM.
const HEADER_BOTTOM = 96;

function drawFooter(doc, page, total) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...C.hairline);
  doc.setLineWidth(0.3);
  doc.line(PAGE_M, h - 42, w - PAGE_M, h - 42);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.faint);
  doc.text('Document confidentiel · Wealthly', PAGE_M, h - 24, { charSpace: 0.2 });
  doc.text(`${page} / ${total}`, w - PAGE_M, h - 24, { align: 'right' });
}

// roman: optional prefix like 'I', 'II', 'III'
function drawSection(doc, y, title, roman) {
  const w = doc.internal.pageSize.getWidth();
  if (roman) {
    doc.setFont(SERIF, 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...C.gold);
    doc.text(roman, PAGE_M, y, { charSpace: 0.3 });
    const romanW = doc.getTextWidth(roman);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text('—  ' + title.toUpperCase(), PAGE_M + romanW + 6, y, { charSpace: 1.6 });
  } else {
    doc.setFont(FONT, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.gold);
    doc.text(title.toUpperCase(), PAGE_M, y, { charSpace: 1.8 });
  }
  doc.setDrawColor(...C.hairline);
  doc.setLineWidth(0.3);
  doc.line(PAGE_M, y + 7, w - PAGE_M, y + 7);
}

function drawTitle(doc, y, title, sub) {
  doc.setFont(SERIF, 'bolditalic');
  doc.setFontSize(28);
  doc.setTextColor(...C.ink);
  doc.text(title, PAGE_M, y);
  if (sub) {
    doc.setFont(FONT, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...C.muted);
    doc.text(sub, PAGE_M, y + 20);
  }
}

// Hero: a single big number with eyebrow + meta. Returns next y.
function drawHero(doc, y, eyebrow, value, meta, color = C.ink) {
  doc.setFont(FONT, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.gold);
  doc.text(eyebrow.toUpperCase(), PAGE_M, y, { charSpace: 2 });

  doc.setFont(SERIF, 'bold');
  doc.setFontSize(38);
  doc.setTextColor(...color);
  doc.text(value, PAGE_M, y + 38);

  if (meta) {
    doc.setFont(FONT, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...C.muted);
    doc.text(meta, PAGE_M, y + 56);
    return y + 70;
  }
  return y + 50;
}

// 2×N grid of KPI cards: cream fill + gold left strip + label / value / hint.
function drawKpiCards(doc, y, kpis) {
  const w = doc.internal.pageSize.getWidth();
  const colW = (w - PAGE_M * 2 - 12) / 2;
  const rowH = 54;
  kpis.forEach((kpi, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = PAGE_M + col * (colW + 12);
    const yy = y + row * (rowH + 8);

    // Fill
    doc.setFillColor(...C.cardFill);
    doc.roundedRect(x, yy, colW, rowH, 4, 4, 'F');
    // Gold left strip
    doc.setFillColor(...C.gold);
    doc.rect(x, yy, 2, rowH, 'F');

    doc.setFont(FONT, 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(kpi.label.toUpperCase(), x + 12, yy + 14, { charSpace: 1.4 });

    doc.setFont(SERIF, 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...(kpi.color || C.ink));
    doc.text(kpi.value, x + 12, yy + 36);

    if (kpi.hint) {
      doc.setFont(FONT, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.faint);
      doc.text(kpi.hint, x + 12, yy + 48);
    }
  });
  const rows = Math.ceil(kpis.length / 2);
  return y + rows * (rowH + 8) + 4;
}

// Horizontal stacked bar: each segment proportional to its value, colored
// from `pieClasses`. Drawn under the section header. Returns next y.
function drawAllocBar(doc, y, segments) {
  const w = doc.internal.pageSize.getWidth();
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const barW = w - PAGE_M * 2;
  const barH = 14;

  // Fill segments
  let cursor = PAGE_M;
  segments.forEach((seg, i) => {
    const segW = (seg.value / total) * barW;
    doc.setFillColor(...(seg.color || C.pieClasses[i % C.pieClasses.length]));
    doc.rect(cursor, y, segW, barH, 'F');
    cursor += segW;
  });
  // Hairline outline
  doc.setDrawColor(...C.hairline);
  doc.setLineWidth(0.5);
  doc.rect(PAGE_M, y, barW, barH);

  // Legend below: 2-column wrap
  const legendY = y + barH + 14;
  const colW = (w - PAGE_M * 2) / 2;
  segments.forEach((seg, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const lx = PAGE_M + col * colW;
    const ly = legendY + row * 14;

    doc.setFillColor(...(seg.color || C.pieClasses[i % C.pieClasses.length]));
    doc.circle(lx + 3, ly - 3, 3, 'F');

    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.body);
    doc.text(seg.name, lx + 12, ly);

    doc.setFont(FONT, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.ink);
    const pct = ((seg.value / total) * 100).toFixed(1);
    const right = lx + colW - 12;
    doc.text(`${pct} %`, right, ly, { align: 'right' });
  });
  const rows = Math.ceil(segments.length / 2);
  return legendY + rows * 14 + 8;
}

// ---------- donut (triangle-fan + center hole) ----------
// Reliable donut in jsPDF: fill each segment as a fan of thin triangles from
// the center, then punch a paper-colored hole. Mirrors the DetailDonut look.
function drawDonut(doc, cx, cy, rOut, rIn, segments) {
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0) || 1;
  let ang = -Math.PI / 2; // start at top
  segments.forEach((seg, i) => {
    const sweep = (seg.value / total) * Math.PI * 2;
    if (sweep <= 0) return;
    doc.setFillColor(...(seg.color || C.pieClasses[i % C.pieClasses.length]));
    const steps = Math.max(2, Math.ceil(sweep / (Math.PI / 60))); // ~3°
    const step = sweep / steps;
    for (let s = 0; s < steps; s++) {
      const a0 = ang + s * step, a1 = ang + (s + 1) * step;
      doc.triangle(
        cx, cy,
        cx + Math.cos(a0) * rOut, cy + Math.sin(a0) * rOut,
        cx + Math.cos(a1) * rOut, cy + Math.sin(a1) * rOut,
        'F'
      );
    }
    ang += sweep;
  });
  // punch hole (paper) + subtle inner hairline
  doc.setFillColor(...C.paper);
  doc.circle(cx, cy, rIn, 'F');
}

// Composition donut + breakdown rows (replaces the flat stacked bar). Returns y.
function drawAllocDonut(doc, y, segments) {
  const w = doc.internal.pageSize.getWidth();
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0) || 1;
  const rOut = 50, rIn = 31;
  const cx = PAGE_M + rOut, cy = y + rOut;
  drawDonut(doc, cx, cy, rOut, rIn, segments);
  // center text
  doc.setFont(SERIF, 'italic'); doc.setFontSize(19); doc.setTextColor(...C.ink);
  doc.text(fmtEUR(total, { compact: true }), cx, cy + 1, { align: 'center', baseline: 'middle' });
  doc.setFont(FONT, 'bold'); doc.setFontSize(6.5); doc.setTextColor(...C.faint);
  doc.text('RÉPARTI', cx, cy + 14, { align: 'center', baseline: 'middle' });

  // rows
  const rowsX = PAGE_M + rOut * 2 + 30;
  const rowH = 26;
  let ry = y + 8;
  segments.forEach((seg, i) => {
    const color = seg.color || C.pieClasses[i % C.pieClasses.length];
    const pct = (seg.value / total) * 100;
    // color dot
    doc.setFillColor(...color);
    doc.roundedRect(rowsX, ry - 6, 7, 7, 1.5, 1.5, 'F');
    // name
    doc.setFont(FONT, 'normal'); doc.setFontSize(9.5); doc.setTextColor(...C.ink);
    doc.text(seg.name, rowsX + 13, ry, { baseline: 'alphabetic' });
    // amount (right) + pct (left of amount)
    doc.setFont(FONT, 'bold'); doc.setFontSize(9.5); doc.setTextColor(...C.ink);
    const amtStr = fmtEUR(seg.value);
    doc.text(amtStr, w - PAGE_M, ry, { align: 'right' });
    const amtW = doc.getTextWidth(amtStr);
    doc.setFont(FONT, 'normal'); doc.setFontSize(8); doc.setTextColor(...C.faint);
    doc.text(`${pct.toFixed(0)} %`, w - PAGE_M - amtW - 8, ry, { align: 'right' });
    // track + fill
    const trackY = ry + 5, trackW = (w - PAGE_M) - rowsX;
    doc.setFillColor(...C.cardSunk);
    doc.roundedRect(rowsX, trackY, trackW, 5, 2.5, 2.5, 'F');
    doc.setFillColor(...color);
    doc.roundedRect(rowsX, trackY, Math.max(4, (pct / 100) * trackW), 5, 2.5, 2.5, 'F');
    ry += rowH;
  });

  const donutBottom = cy + rOut;
  const rowsBottom = (y + 8) + segments.length * rowH;
  return Math.max(donutBottom, rowsBottom) + 12;
}

// ---------- Sankey (flux du mois) ----------
// Filled bezier "ribbons" via doc.lines (relative cubic curves). Left = income
// node(s) -> central "Disponible" hub -> right = expense categories + savings.
function drawRibbon(doc, xL, yLtop, yLbot, xR, yRtop, yRbot, color, opacity) {
  const cx = (xL + xR) / 2;
  doc.setFillColor(...color);
  let gs = null;
  try { gs = new doc.GState({ opacity }); doc.setGState(gs); } catch { /* opacity unsupported */ }
  doc.lines(
    [
      [cx - xL, 0, cx - xL, yRtop - yLtop, xR - xL, yRtop - yLtop], // top edge L->R (bezier)
      [0, yRbot - yRtop],                                          // right edge down
      [cx - xR, 0, cx - xR, yLbot - yRbot, xL - xR, yLbot - yRbot], // bottom edge R->L (bezier)
    ],
    xL, yLtop, [1, 1], 'F', true
  );
  try { doc.setGState(new doc.GState({ opacity: 1 })); } catch { /* noop */ }
}

// incomes / outflows: [{ name, value, color, savings? }]. Returns next y.
function drawSankey(doc, y, incomes, outflows) {
  const w = doc.internal.pageSize.getWidth();
  const x = PAGE_M, cardW = w - PAGE_M * 2;
  const totalIn = incomes.reduce((s, d) => s + d.value, 0);
  const totalOut = outflows.reduce((s, d) => s + d.value, 0);
  const total = Math.max(totalIn, totalOut, 1);

  // card
  const cardPadX = 20, cardPadY = 18;
  const H = 150; // flow height
  const cardH = H + cardPadY * 2 + 26; // + footer band
  doc.setFillColor(...C.cream);
  doc.setDrawColor(...C.hairline); doc.setLineWidth(0.7);
  doc.roundedRect(x, y, cardW, cardH, 12, 12, 'FD');

  const innerX = x + cardPadX;
  const innerW = cardW - cardPadX * 2;
  const top = y + cardPadY + 8;
  const leftLabelW = 58, rightLabelW = 96;
  const barW = 6, hubW = 9;
  const xInBar = innerX + leftLabelW;
  const xHub = innerX + leftLabelW + 64;
  const xOutBar = innerX + innerW - rightLabelW - barW;
  const bandH = (v) => (v / total) * H;

  // ribbons income -> hub
  let cL = top, cHubIn = top;
  incomes.forEach((d) => {
    const h = bandH(d.value);
    drawRibbon(doc, xInBar + barW, cL, cL + h, xHub, cHubIn, cHubIn + h, d.color || C.accent, 0.22);
    cL += h; cHubIn += h;
  });
  // ribbons hub -> outflows
  let cHubOut = top, cR = top;
  outflows.forEach((d) => {
    const h = bandH(d.value);
    drawRibbon(doc, xHub + hubW, cHubOut, cHubOut + h, xOutBar, cR, cR + h, d.color || C.muted, 0.30);
    cHubOut += h; cR += h;
  });

  // income nodes + labels
  cL = top;
  incomes.forEach((d, i) => {
    const h = bandH(d.value);
    doc.setFillColor(...(d.color || C.accent));
    doc.roundedRect(xInBar, cL, barW, Math.max(h, 1.5), 1.5, 1.5, 'F');
    doc.setFont(FONT, 'normal'); doc.setFontSize(8); doc.setTextColor(...C.ink);
    doc.text(d.name, xInBar - 6, cL + h / 2, { align: 'right', baseline: 'middle' });
    if (i === 0 && h > 14) {
      doc.setFont(FONT, 'normal'); doc.setFontSize(7); doc.setTextColor(...C.faint);
      doc.text(fmtEUR(d.value), xInBar - 6, cL + h / 2 + 9, { align: 'right', baseline: 'middle' });
    }
    cL += h;
  });

  // hub
  doc.setFillColor(...C.ink);
  doc.roundedRect(xHub, top, hubW, H, 3, 3, 'F');
  doc.setFont(FONT, 'bold'); doc.setFontSize(7); doc.setTextColor(...C.faint);
  doc.text('DISPONIBLE', xHub + hubW / 2, top - 7, { align: 'center' });

  // outflow nodes + labels
  cR = top;
  outflows.forEach((d) => {
    const h = bandH(d.value);
    doc.setFillColor(...(d.color || C.muted));
    doc.roundedRect(xOutBar, cR, barW, Math.max(h, 1.5), 1.5, 1.5, 'F');
    doc.setFont(FONT, d.savings ? 'bold' : 'normal'); doc.setFontSize(8);
    doc.setTextColor(...(d.savings ? C.sage : C.ink));
    doc.text(d.name, xOutBar + barW + 6, cR + h / 2, { align: 'left', baseline: 'middle' });
    if ((d.savings || h > 18)) {
      doc.setFont(FONT, 'normal'); doc.setFontSize(7); doc.setTextColor(...C.faint);
      doc.text(fmtEUR(d.value), xOutBar + barW + 6, cR + h / 2 + 9, { align: 'left', baseline: 'middle' });
    }
    cR += h;
  });

  // footer band (totals)
  const fy = top + H + 16;
  doc.setDrawColor(...C.cardSunk); doc.setLineWidth(0.5);
  doc.line(innerX, fy - 8, innerX + innerW, fy - 8);
  const savings = outflows.find((d) => d.savings)?.value || 0;
  const rate = totalIn > 0 ? (savings / totalIn) * 100 : 0;
  doc.setFontSize(9);
  doc.setFont(FONT, 'normal'); doc.setTextColor(...C.body);
  doc.text('Entrées', innerX, fy);
  doc.setFont(FONT, 'bold'); doc.setTextColor(...C.sage);
  doc.text(fmtEUR(totalIn, { sign: true }), innerX + 42, fy);
  doc.setFont(FONT, 'normal'); doc.setTextColor(...C.body);
  doc.text('Sorties', innerX + 150, fy);
  doc.setFont(FONT, 'bold'); doc.setTextColor(...C.terracotta);
  doc.text(fmtEUR(-(totalIn - savings)), innerX + 192, fy);
  doc.setFont(FONT, 'normal'); doc.setTextColor(...C.body);
  doc.text('Épargne', innerX + 300, fy);
  doc.setFont(FONT, 'bold'); doc.setTextColor(...C.sage);
  doc.text(`${fmtEUR(savings, { sign: true })}  (${rate.toFixed(0)} %)`, innerX + 346, fy);

  return y + cardH + 14;
}

// Vertical bars chart: each bar = one row's value, plus an optional horizontal
// reference line drawn at `refValue` (used for the "Mensualité" overlay on
// the loan amortization page).
function drawBarSeries(doc, x, y, w, h, values, opts = {}) {
  if (!values || values.length === 0) {
    doc.setFont(FONT, 'normal'); doc.setFontSize(9); doc.setTextColor(...C.faint);
    doc.text('Pas de données', x, y + h / 2);
    return y + h;
  }
  const min = 0;
  const max = Math.max(...values);
  const range = max - min || 1;

  // Soft baseline grid
  doc.setDrawColor(...C.hairline);
  doc.setLineWidth(0.3);
  doc.line(x, y + h, x + w, y + h);

  // Bars
  const barW = Math.max(0.6, (w / values.length) * 0.85);
  const step = w / values.length;
  values.forEach((v, i) => {
    const bx = x + i * step + (step - barW) / 2;
    const bh = ((v - min) / range) * h;
    doc.setFillColor(...C.gold);
    doc.rect(bx, y + h - bh, barW, bh, 'F');
  });

  // Reference line (e.g. monthly payment)
  if (opts.refValue != null && opts.refMax) {
    const refY = y + h - (opts.refValue / opts.refMax) * h;
    doc.setDrawColor(...C.goldDark);
    doc.setLineWidth(0.6);
    doc.line(x, refY, x + w, refY);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.goldDark);
    if (opts.refLabel) doc.text(opts.refLabel, x + w + 4, refY + 2);
  }
  return y + h;
}

// Sparkline polyline of monthly balances inside a small rect. Returns next y.
function drawSparkline(doc, x, y, w, h, points, label) {
  if (label) {
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text(label, x, y - 4);
  }
  if (!points || points.length < 2) {
    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.faint);
    doc.text('Pas encore assez de données', x, y + h / 2);
    return y + h;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  // Soft baseline grid
  doc.setDrawColor(...C.hairline);
  doc.setLineWidth(0.3);
  doc.line(x, y + h, x + w, y + h);

  // Polyline
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(1.1);
  for (let i = 1; i < points.length; i++) {
    const x1 = x + ((i - 1) / (points.length - 1)) * w;
    const x2 = x + (i / (points.length - 1)) * w;
    const y1 = y + h - ((points[i - 1] - min) / range) * h;
    const y2 = y + h - ((points[i] - min) / range) * h;
    doc.line(x1, y1, x2, y2);
  }
  // Endpoint dot
  doc.setFillColor(...C.gold);
  doc.circle(x + w, y + h - ((points[points.length - 1] - min) / range) * h, 1.6, 'F');
  return y + h;
}

// Wrapper around autoTable for a consistent sober look.
function table(doc, head, body, startY, opts = {}) {
  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'plain',
    styles: {
      font: FONT,
      fontSize: 9,
      textColor: C.body,
      cellPadding: { top: 7, right: 8, bottom: 7, left: 0 },
      lineColor: C.hairline,
      lineWidth: 0,
    },
    headStyles: {
      fontSize: 7,
      fontStyle: 'bold',
      textColor: C.muted,
      fillColor: false,
      lineWidth: { bottom: 0.6 },
      lineColor: C.gold,
      cellPadding: { top: 4, right: 8, bottom: 6, left: 0 },
      ...((opts.headStyles) || {}),
    },
    bodyStyles: {
      lineWidth: { bottom: 0.3 },
      lineColor: C.hairline,
      ...((opts.bodyStyles) || {}),
    },
    margin: { left: PAGE_M, right: PAGE_M, top: HEADER_BOTTOM, bottom: 60 },
    // autoTable creates fresh pages when content overflows. Repaint the dark
    // background + redraw the header on every page, then chain the caller's
    // own hook if any. Skip on the first call (handled by the page setup).
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        paintBackground(doc);
        drawHeader(doc, opts._headerSubtitle || '');
      }
      if (opts.didDrawPage) opts.didDrawPage(data);
    },
    ...Object.fromEntries(Object.entries(opts).filter(([k]) => k !== 'didDrawPage' && k !== '_headerSubtitle')),
  });
  return doc.lastAutoTable.finalY;
}

// ---------- health-score (mirrors HealthScore.jsx — duplicated here so the
// PDF doesn't depend on the React component) ----------
function lerp(value, inMin, inMax, outMin, outMax) {
  if (value <= inMin) return outMin;
  if (value >= inMax) return outMax;
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function computeHealthScore({ monthlyEvolution = [], liquidWealth = 0, assetsValue = 0, liabilitiesValue = 0, visibleAssets = [], ASSET_CLASS_MAP = {} }) {
  const window = monthlyEvolution.slice(-6);
  const avg = (key) => window.length === 0 ? 0 : window.reduce((s, m) => s + (m[key] || 0), 0) / window.length;
  const avgIncome = avg('income');
  const avgExpenses = avg('expenses');
  const avgNet = avg('net');

  const savingsRate = avgIncome > 0 ? avgNet / avgIncome : 0;
  const savingsPts = lerp(savingsRate, 0.05, 0.30, 0, 25);

  const monthsOfRunway = avgExpenses > 0 ? liquidWealth / avgExpenses : (liquidWealth > 0 ? 99 : 0);
  const emergencyPts = lerp(monthsOfRunway, 0, 3, 0, 20);

  const totalWealth = assetsValue + liquidWealth;
  const debtRatio = totalWealth > 0 ? liabilitiesValue / totalWealth : 0;
  const debtPts = liabilitiesValue === 0 ? 20 : lerp(debtRatio, 0.20, 0.80, 20, 0);

  const classes = new Set();
  visibleAssets.forEach((a) => {
    const cls = ASSET_CLASS_MAP?.[a.type]?.class;
    if (cls) classes.add(cls);
  });
  if (liquidWealth > 0) classes.add('Liquidités');
  const divCount = classes.size;
  const divPts = lerp(divCount, 0, 3, 0, 20);

  // We don't have budgets in the PDF call signature — full credit by default.
  const budgetPts = 15;

  return {
    total: Math.round(savingsPts + emergencyPts + debtPts + divPts + budgetPts),
    savingsRate, monthsOfRunway, debtRatio, divCount,
  };
}

// ---------- main ----------
export function generateBilanPdf({
  netWorth,
  liquidWealth,
  assetsValue,
  liabilitiesValue,
  thisMonthStats,
  monthlyEvolution,
  visibleAccounts,
  accountBalances,
  visibleAssets,
  visibleLiabilities,
  members,
  activeMemberId,
  recurringGroups,
  categoryAnalysis,
  categories,
  memberShare,
  currentMonth,
  ASSET_CLASS_MAP,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  // jsPDF's default helvetica is WinAnsi-encoded — Unicode chars outside that
  // table render as garbage glyphs (`/` for U+202F narrow nbsp from
  // Intl.NumberFormat fr-FR, `"` for U+2212 minus, etc.). Sanitize every
  // string at the doc.text seam so the rest of the file can stay readable.
  const sanitize = (s) => typeof s === 'string'
    ? s.replace(/ | /g, ' ').replace(/−/g, '-').replace(/–/g, '-')
    : s;
  const _origText = doc.text.bind(doc);
  doc.text = (text, ...rest) => {
    if (Array.isArray(text)) text = text.map(sanitize);
    else text = sanitize(text);
    return _origText(text, ...rest);
  };

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const activeMember = members.find((m) => m.id === activeMemberId);
  const headerSubtitle = `${activeMember ? activeMember.name + ' · ' : ''}${todayLong()}`;

  // Performance vs previous month
  const sorted = [...monthlyEvolution].sort((a, b) => a.month.localeCompare(b.month));
  let perf1m = null;
  if (sorted.length >= 2) {
    const last = sorted[sorted.length - 1].balance;
    const prev = sorted[sorted.length - 2].balance;
    if (prev !== 0) perf1m = ((last - prev) / Math.abs(prev)) * 100;
  }
  const debtRatio = (assetsValue + liquidWealth) > 0 ? (liabilitiesValue / (assetsValue + liquidWealth)) * 100 : null;
  const score = computeHealthScore({ monthlyEvolution, liquidWealth, assetsValue, liabilitiesValue, visibleAssets, ASSET_CLASS_MAP });
  const scoreColor = score.total < 40 ? C.terracotta : score.total < 70 ? C.amber : C.sage;

  // ----- COVER -----
  // Inspired by Pictet / Lombard Odier / Edmond de Rothschild annual reports:
  // generous white-space (er, black-space), oversized typography, a single
  // hairline gold rule as signature, hero KPI carved in the centre, mini
  // stat grid at the bottom — feels institutional rather than dashboardy.
  paintBackground(doc);

  const ownerName = activeMember ? activeMember.name : 'Foyer';
  const yearMonth = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();

  // === Top band — wordmark left, period right, gold rule beneath ===
  // Monogram refondu 2026-05-21 : aligne sur Logo.jsx (carré ink filled +
  // W cream gros). Au lieu du W zigzag stroke "ancien" feedback user.
  doc.setFillColor(...C.ink);
  doc.roundedRect(PAGE_M, 56, 26, 26, 4, 4, 'F');
  doc.setFont(FONT, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...C.paper);
  doc.text('W', PAGE_M + 13, 75, { align: 'center' });

  doc.setFont(SERIF, 'bolditalic');
  doc.setFontSize(14);
  doc.setTextColor(...C.ink);
  doc.text('Wealthly', PAGE_M + 36, 74, { charSpace: 0.2 });

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.muted);
  doc.text(yearMonth, pageW - PAGE_M, 74, { align: 'right', charSpace: 2.4 });

  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.4);
  doc.line(PAGE_M, 96, pageW - PAGE_M, 96);

  // === Eyebrow — formal classification line ===
  doc.setFont(FONT, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.gold);
  doc.text('BILAN PATRIMONIAL  ·  CONFIDENTIEL', PAGE_M, 200, { charSpace: 2.4 });

  // === Title block — owner name oversized, date a tier below ===
  doc.setFont(SERIF, 'bolditalic');
  doc.setFontSize(58);
  doc.setTextColor(...C.ink);
  doc.text(ownerName, PAGE_M, 256);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(13);
  doc.setTextColor(...C.body);
  doc.text(`Synthèse arrêtée au ${todayLong()}`, PAGE_M, 286);

  // Short signature gold rule below the title (Pictet / EdR signature)
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.8);
  doc.line(PAGE_M, 308, PAGE_M + 56, 308);

  // === Hero — PATRIMOINE TOTAL (= Actifs total), aligne refonte Dashboard
  // 2026-05-21. Avant : netWorth (Actifs - Passifs) -> user "j'ai pas
  // 456k de patrimoine debile". Maintenant : Actifs total comme grand
  // chiffre (impressionnant + semantiquement "ce que vous possedez"),
  // Net souligne en sous-titre comme metric secondaire honnete.
  const actifsTotal = liquidWealth + assetsValue;
  doc.setFont(FONT, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.muted);
  doc.text('PATRIMOINE TOTAL', PAGE_M, 392, { charSpace: 2.4 });

  doc.setFont(SERIF, 'bold');
  doc.setFontSize(72);
  doc.setTextColor(...C.ink);
  doc.text(fmtEUR(actifsTotal), PAGE_M, 462);

  // Sous-titre : Net apres dettes (transparence math)
  doc.setFont(FONT, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...C.body);
  const netLine = liabilitiesValue > 0
    ? `Net après dettes : ${fmtEUR(netWorth)}`
    : 'Aucune dette en cours';
  doc.text(netLine, PAGE_M, 488);

  if (perf1m != null) {
    const perfTxt = `${perf1m >= 0 ? '+' : ''}${perf1m.toFixed(2)} %  sur le mois`;
    const perfColor = perf1m >= 0 ? C.sage : C.terracotta;
    doc.setFont(FONT, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...perfColor);
    doc.text(perfTxt, PAGE_M, 506);
  }

  // === Stat grid — 4 mini-cards alignes sur les KPI du Dashboard pour
  // que la math FERME : Cash + Immo Net − Autres dettes = Net.
  // Calcule la decomposition Immo/Other matchant Dashboard.realEstateNet.
  const immoAssets = visibleAssets.reduce((sum, a) => {
    const cls = ASSET_CLASS_MAP?.[a.type]?.class;
    return cls === 'Immobilier' ? sum + (parseFloat(a.currentValue) || 0) * memberShare(a) : sum;
  }, 0);
  const mortgageDebt = visibleLiabilities.reduce((sum, l) => {
    if (l.type !== 'mortgage') return sum;
    const bal = parseFloat(l.remainingCapital ?? l.remaining_capital ?? 0) || 0;
    return sum + bal * memberShare(l);
  }, 0);
  const immoNet = immoAssets - mortgageDebt;
  const otherDebt = Math.max(0, liabilitiesValue - mortgageDebt);
  // Cash = liquidWealth + placements + epargne (= actifsTotal - immoAssets)
  const cashWealth = actifsTotal - immoAssets;

  const statY = 568;
  const statH = 64;
  const statGap = 10;
  const cardCount = otherDebt > 0.5 ? 4 : 3;
  const statW = (pageW - PAGE_M * 2 - statGap * (cardCount - 1)) / cardCount;
  const statCards = [
    {
      label: 'CASH',
      value: fmtEUR(cashWealth),
      meta: 'Liquidités + Placements + Épargne',
    },
    {
      label: 'IMMO NET',
      value: fmtEUR(immoNet),
      meta: 'Bien − crédit',
    },
    ...(otherDebt > 0.5 ? [{
      label: 'AUTRES DETTES',
      value: `-${fmtEUR(otherDebt)}`,
      valueColor: C.terracotta,
      meta: 'Conso, étudiant, autre',
    }] : []),
    {
      label: 'NET TOTAL',
      value: fmtEUR(netWorth),
      valueColor: scoreColor,
      meta: `Score santé ${score.total}/100`,
    },
  ];
  statCards.forEach((s, i) => {
    const x = PAGE_M + i * (statW + statGap);
    doc.setFillColor(...C.cardFill);
    doc.roundedRect(x, statY, statW, statH, 4, 4, 'F');
    doc.setFillColor(...C.gold);
    doc.rect(x, statY, 2, statH, 'F');
    doc.setFont(FONT, 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(s.label, x + 12, statY + 16, { charSpace: 1.6 });
    doc.setFont(SERIF, 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...(s.valueColor || C.ink));
    doc.text(s.value, x + 12, statY + 40);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.faint);
    doc.text(s.meta, x + 12, statY + 54);
  });

  // === Bottom — "préparé pour" + confidentiality + pagination ===
  // Hairline rule + two info lines + page mark
  doc.setDrawColor(...C.hairline);
  doc.setLineWidth(0.3);
  doc.line(PAGE_M, pageH - 78, pageW - PAGE_M, pageH - 78);

  doc.setFont(FONT, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.gold);
  doc.text('PRÉPARÉ POUR', PAGE_M, pageH - 60, { charSpace: 1.8 });
  doc.setFont(SERIF, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.ink);
  doc.text(ownerName, PAGE_M, pageH - 46);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.faint);
  doc.text('Document strictement confidentiel — usage interne au foyer.', PAGE_M, pageH - 30);

  // Page mark right-aligned, mono-style
  doc.setFont(FONT, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('PAGE', pageW - PAGE_M - 32, pageH - 60, { charSpace: 1.8 });
  doc.setFont(FONT, 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.gold);
  doc.text('01', pageW - PAGE_M, pageH - 42, { align: 'right' });

  // ----- PAGE 2 — Synthèse -----
  doc.addPage(); paintBackground(doc); drawHeader(doc, headerSubtitle);
  let y = 110;
  drawTitle(doc, y, 'Synthèse', `Composition du patrimoine au ${todayLong()}`);
  y += 50;

  drawSection(doc, y, 'Indicateurs clés', 'I'); y += 16;
  // Aligne sur la refonte Dashboard 2026-05-21 :
  //  - Patrimoine total = Actifs (liquidWealth + assetsValue)
  //  - Net affiche en card avec hint "actifs − dettes"
  //  - Decomposition Cash / Immo Net / Autres dettes pour fermer la math
  y = drawKpiCards(doc, y, [
    { label: 'Patrimoine total', value: fmtEUR(actifsTotal), hint: 'liquidités + placements + immo' },
    { label: 'Net après dettes', value: fmtEUR(netWorth), hint: 'actifs − passifs' },
    { label: 'Cash', value: fmtEUR(cashWealth), hint: `liquidités + placements (${visibleAccounts.length} compte${visibleAccounts.length > 1 ? 's' : ''})` },
    { label: 'Immobilier net', value: fmtEUR(immoNet), hint: 'bien − crédit immo' },
    {
      label: 'Performance 1 mois',
      value: perf1m == null ? '—' : `${perf1m >= 0 ? '+' : ''}${perf1m.toFixed(2)} %`,
      color: perf1m == null ? C.muted : perf1m >= 0 ? C.sage : C.terracotta,
      hint: 'sur les liquidités',
    },
    { label: "Ratio d'endettement", value: fmtPct(debtRatio), color: debtRatio == null ? C.muted : debtRatio < 30 ? C.sage : debtRatio < 50 ? C.amber : C.terracotta, hint: debtRatio == null ? '' : debtRatio < 30 ? 'sain' : debtRatio < 50 ? 'surveillé' : 'élevé' },
  ]);

  // Allocation
  y += 6;
  drawSection(doc, y, 'Composition du patrimoine', 'II'); y += 16;
  const allocClasses = {};
  if (liquidWealth > 0) allocClasses['Liquidités'] = liquidWealth;
  visibleAssets.forEach((a) => {
    const cls = ASSET_CLASS_MAP?.[a.type]?.class || 'Divers';
    const val = (parseFloat(a.currentValue) || 0) * memberShare(a);
    allocClasses[cls] = (allocClasses[cls] || 0) + val;
  });
  const allocSegments = Object.entries(allocClasses)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: C.pieClasses[i % C.pieClasses.length] }));
  if (allocSegments.length > 0) {
    y = drawAllocDonut(doc, y, allocSegments);
  } else {
    doc.setFont(FONT, 'normal'); doc.setFontSize(9); doc.setTextColor(...C.faint);
    doc.text('Aucun actif renseigné.', PAGE_M, y + 10); y += 24;
  }

  drawFooter(doc, 2, 5);

  // ----- PAGE 3 — Évolution -----
  doc.addPage(); paintBackground(doc); drawHeader(doc, headerSubtitle);
  y = 110;
  drawTitle(doc, y, 'Évolution', sorted.length >= 2 ? `Sur ${Math.min(sorted.length, 12)} mois` : 'Historique disponible');
  y += 50;

  // Sparkline
  drawSection(doc, y, 'Patrimoine net mensuel', 'I'); y += 16;
  const lastN = sorted.slice(-12);
  drawSparkline(doc, PAGE_M, y + 8, pageW - PAGE_M * 2, 80, lastN.map((m) => m.balance || 0), null);
  y += 100;

  // Table of monthly evolution
  drawSection(doc, y, 'Détail mensuel', 'II'); y += 16;
  if (lastN.length === 0) {
    doc.setFont(FONT, 'normal'); doc.setFontSize(9); doc.setTextColor(...C.faint);
    doc.text('Pas encore de données mensuelles.', PAGE_M, y + 10); y += 24;
  } else {
    const evRows = lastN.slice().reverse().map((m) => [
      monthShort(m.month),
      fmtEUR(m.income),
      fmtEUR(m.expenses),
      fmtEUR(m.net, { sign: true }),
      fmtEUR(m.balance),
    ]);
    y = table(doc, [['Mois', 'Revenus', 'Dépenses', 'Solde net', 'Solde fin de mois']], evRows, y, {
      columnStyles: {
        0: { textColor: C.muted },
        1: { halign: 'right', textColor: C.sage },
        2: { halign: 'right', textColor: C.terracotta },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'right' },
      },
    });
  }

  drawFooter(doc, 3, 5);

  // ----- PAGE 4 — Trésorerie -----
  doc.addPage(); paintBackground(doc); drawHeader(doc, headerSubtitle);
  y = 110;
  drawTitle(doc, y, 'Trésorerie', monthLong(currentMonth));
  y += 50;

  drawSection(doc, y, 'Cashflow du mois', 'I'); y += 16;
  const savingsRate = thisMonthStats?.income > 0 ? (thisMonthStats.net / thisMonthStats.income) * 100 : null;
  y = drawKpiCards(doc, y, [
    { label: 'Revenus', value: fmtEUR(thisMonthStats?.income || 0), color: C.sage },
    { label: 'Dépenses', value: fmtEUR(thisMonthStats?.expenses || 0), color: C.terracotta },
    { label: 'Épargne nette', value: fmtEUR(thisMonthStats?.net || 0, { sign: true }), color: (thisMonthStats?.net || 0) >= 0 ? C.sage : C.terracotta },
    { label: "Taux d'épargne", value: fmtPct(savingsRate, 0), color: savingsRate == null ? C.muted : savingsRate >= 20 ? C.sage : savingsRate >= 10 ? C.amber : C.terracotta, hint: 'sur revenus du mois' },
  ]);

  // Flux du mois — Sankey : Revenus -> Disponible -> Dépenses + Épargne
  y += 6;
  drawSection(doc, y, 'Flux du mois — entrées → disponible → sorties', 'II'); y += 16;
  const skIncome = thisMonthStats?.income || 0;
  const skExpenses = thisMonthStats?.expenses || 0;
  const skNet = thisMonthStats?.net || 0;
  if (skIncome > 0 || skExpenses > 0) {
    // expense categories (top 5 + autres)
    const expCats = Object.entries(categoryAnalysis || {})
      .filter(([, d]) => d.current > 0)
      .map(([catId, data]) => ({ name: categories.find((c) => c.id === catId)?.name || catId, value: data.current }))
      .sort((a, b) => b.value - a.value);
    const expColors = [C.pieClasses[2], C.pieClasses[4], C.pieClasses[3], C.pieClasses[6], C.amber];
    const top5 = expCats.slice(0, 5).map((c, i) => ({ ...c, color: expColors[i % expColors.length] }));
    const otherExp = Math.max(0, skExpenses - top5.reduce((s, c) => s + c.value, 0));
    const outflows = [...top5];
    if (otherExp > 1) outflows.push({ name: 'Autres dépenses', value: otherExp, color: C.pieClasses[5] });
    if (skNet > 0) outflows.push({ name: 'Épargne', value: skNet, color: C.sage, savings: true });
    if (outflows.length === 0) outflows.push({ name: 'Dépenses', value: skExpenses || 1, color: C.terracotta });
    const incomes = [{ name: 'Revenus', value: skIncome || skExpenses, color: C.accent }];
    y = drawSankey(doc, y, incomes, outflows);
  } else {
    doc.setFont(FONT, 'normal'); doc.setFontSize(9); doc.setTextColor(...C.faint);
    doc.text('Pas de mouvements ce mois-ci.', PAGE_M, y + 10); y += 24;
  }

  y += 4;
  drawSection(doc, y, 'Top dépenses du mois', 'III'); y += 16;
  const topCats = Object.entries(categoryAnalysis || {})
    .filter(([, d]) => d.current > 0)
    .map(([catId, data]) => {
      const cat = categories.find((c) => c.id === catId);
      const change = data.avg3m > 0 ? ((data.current - data.avg3m) / data.avg3m) * 100 : 0;
      return { name: cat?.name || catId, current: data.current, avg: data.avg3m, change };
    })
    .sort((a, b) => b.current - a.current)
    .slice(0, 6);
  const topRows = topCats.length === 0
    ? [['—', '—', '—', '—']]
    : topCats.map((c) => [
        c.name,
        fmtEUR(c.current),
        fmtEUR(c.avg),
        Math.abs(c.change) > 5 ? `${c.change > 0 ? '+' : ''}${c.change.toFixed(0)} %` : '—',
      ]);
  y = table(doc, [['Catégorie', 'Ce mois', 'Moy. 3 mois', 'Δ']], topRows, y, {
    columnStyles: {
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'right', textColor: C.muted },
      3: { halign: 'right', textColor: C.muted },
    },
  });

  y += 6;
  drawSection(doc, y, 'Charges fixes récurrentes', 'IV'); y += 16;
  const recurringRows = (recurringGroups || [])
    .filter((rg) => {
      const lastDate = new Date(rg.lastDate);
      const now = new Date();
      const monthsAgo = (now.getFullYear() - lastDate.getFullYear()) * 12 + (now.getMonth() - lastDate.getMonth());
      return monthsAgo <= 2;
    })
    .map((rg) => {
      const acc = visibleAccounts.find((a) => a.id === rg.accountId);
      const share = acc ? memberShare(acc) : 1;
      return { ...rg, sharedAmount: rg.avgAmount * share, accName: acc?.name };
    })
    .sort((a, b) => Math.abs(b.sharedAmount) - Math.abs(a.sharedAmount))
    .slice(0, 12)
    .map((rg) => [
      `Le ${rg.avgDay}`,
      rg.label || '—',
      rg.accName || '—',
      fmtEUR(rg.sharedAmount),
    ]);
  if (recurringRows.length === 0) recurringRows.push(['—', '—', '—', '—']);
  y = table(doc, [['Jour', 'Libellé', 'Compte', 'Montant']], recurringRows, y, {
    columnStyles: {
      0: { textColor: C.muted, cellWidth: 50 },
      3: { halign: 'right', fontStyle: 'bold' },
    },
  });

  drawFooter(doc, 4, 5);

  // ----- PAGE 5 — Détail -----
  doc.addPage(); paintBackground(doc); drawHeader(doc, headerSubtitle);
  y = 110;
  drawTitle(doc, y, 'Détail', 'Comptes, actifs et dettes');
  y += 50;

  // Comptes
  drawSection(doc, y, 'Comptes bancaires', 'I'); y += 16;
  const accRows = visibleAccounts.length === 0
    ? [['—', '—', '—', '—']]
    : visibleAccounts.map((a) => {
        const bal = (accountBalances?.[a.id] || 0) * memberShare(a);
        const owners = (a.memberIds || []).map((id) => members.find((m) => m.id === id)?.name).filter(Boolean).join(' & ');
        return [a.name, a.bank || '—', owners || '—', fmtEUR(bal)];
      });
  y = table(doc, [['Compte', 'Banque', 'Propriétaires', 'Solde']], accRows, y, {
    columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
  });

  // Helper to maybe paginate
  const ensureSpace = (doc, neededY) => {
    if (neededY > pageH - 80) {
      drawFooter(doc, doc.internal.getNumberOfPages(), 5);
      doc.addPage(); paintBackground(doc); drawHeader(doc, headerSubtitle);
      return 90;
    }
    return neededY;
  };

  // Actifs avec PV latente si dispo
  y = ensureSpace(doc, y + 10);
  drawSection(doc, y, 'Actifs détaillés', 'II'); y += 16;
  if (visibleAssets.length === 0) {
    doc.setFont(FONT, 'normal'); doc.setFontSize(9); doc.setTextColor(...C.faint);
    doc.text('Aucun actif renseigné.', PAGE_M, y + 10); y += 24;
  } else {
    const assetRows = visibleAssets
      .slice()
      .sort((a, b) => (parseFloat(b.currentValue) || 0) * memberShare(b) - (parseFloat(a.currentValue) || 0) * memberShare(a))
      .map((a) => {
        const share = memberShare(a);
        const current = (parseFloat(a.currentValue) || 0) * share;
        const cost = (parseFloat(a.purchasePrice) || 0) * share;
        const pv = cost > 0 ? current - cost : null;
        const pvPct = cost > 0 ? (pv / cost) * 100 : null;
        return [
          a.name || '—',
          ASSET_CLASS_MAP?.[a.type]?.class || a.type || 'Divers',
          fmtEUR(current),
          cost > 0 ? fmtEUR(cost) : '—',
          pv == null ? '—' : `${pv >= 0 ? '+' : ''}${fmtEUR(pv, { sign: true })} (${pvPct >= 0 ? '+' : ''}${pvPct.toFixed(1)} %)`,
        ];
      });
    y = table(doc, [['Libellé', 'Classe', 'Valeur', 'Prix de revient', 'PV latente']], assetRows, y, {
      columnStyles: {
        2: { halign: 'right', fontStyle: 'bold' },
        3: { halign: 'right', textColor: C.muted },
        4: { halign: 'right' },
      },
    });
  }

  // Dettes
  if (visibleLiabilities.length > 0) {
    y = ensureSpace(doc, y + 10);
    drawSection(doc, y, 'Dettes en cours', 'III'); y += 16;
    const liaRows = visibleLiabilities.map((l) => {
      const share = memberShare(l);
      const remaining = (parseFloat(l.remainingCapital) || 0) * share;
      const monthly = (parseFloat(l.monthlyPayment) || 0) * share;
      return [
        l.name || '—',
        l.type || '—',
        l.interestRate ? `${parseFloat(l.interestRate).toFixed(2)} %` : '—',
        monthly > 0 ? fmtEUR(monthly) : '—',
        fmtEUR(remaining),
      ];
    });
    y = table(doc, [['Libellé', 'Type', 'Taux', 'Mensualité', 'Restant dû']], liaRows, y, {
      columnStyles: {
        2: { halign: 'right', textColor: C.muted },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold', textColor: C.terracotta },
      },
    });
  }

  drawFooter(doc, doc.internal.getNumberOfPages(), 5);

  // ----- AMORTIZATION PAGES (one per liability) -----
  visibleLiabilities.forEach((l) => {
    // Compute durationMonths from startDate+endDate when not explicitly set
    let durationM = l.durationMonths;
    if (!durationM && l.startDate && l.endDate) {
      const s = new Date(l.startDate), e = new Date(l.endDate);
      durationM = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    }
    const schedule = buildAmortization({
      principal: l.initialCapital,
      annualRate: l.interestRate,
      durationM,
      insuranceRate: l.insuranceRate,
      startDate: l.startDate,
      paymentOverride: l.monthlyPayment,
    });
    if (schedule.length === 0) return; // skip — not enough data to render

    const today = new Date().toISOString().slice(0, 10);
    const paid = schedule.filter((r) => r.date <= today);
    const remainingRows = schedule.filter((r) => r.date > today);
    const totalCost = schedule.reduce((s, r) => s + r.payment, 0) + (parseFloat(l.applicationFees) || 0);
    const totalCapPaid = paid.reduce((s, r) => s + r.capital, 0);
    const totalIntPaid = paid.reduce((s, r) => s + r.interest, 0);
    const totalInsPaid = paid.reduce((s, r) => s + r.insurance, 0);
    const totalPaid = totalCapPaid + totalIntPaid + totalInsPaid;
    const totalRemaining = remainingRows.reduce((s, r) => s + r.payment, 0);
    const principal = parseFloat(l.initialCapital) || 0;
    const remainingCap = parseFloat(l.remainingCapital) > 0
      ? parseFloat(l.remainingCapital)
      : (remainingRows[0] ? remainingRows[0].remaining + remainingRows[0].capital : 0);
    const pctRepaid = principal > 0 ? Math.min(100, ((principal - remainingCap) / principal) * 100) : 0;
    const monthly = parseFloat(l.monthlyPayment) || (schedule[0]?.payment ?? 0);

    doc.addPage(); paintBackground(doc); drawHeader(doc, headerSubtitle);
    let yy = 110;
    drawTitle(doc, yy, l.name || 'Emprunt', `${l.type || 'Crédit'} · taux ${l.interestRate ? parseFloat(l.interestRate).toFixed(2) + ' %' : '—'}`);
    yy += 50;

    drawSection(doc, yy, "Caractéristiques de l'emprunt", 'I'); yy += 16;
    yy = drawKpiCards(doc, yy, [
      { label: 'Capital emprunté', value: fmtEUR(principal) },
      { label: 'Capital restant dû', value: fmtEUR(remainingCap), color: C.terracotta },
      { label: 'Mensualité', value: fmtEUR(monthly) },
      { label: "Taux d'intérêt", value: l.interestRate ? `${parseFloat(l.interestRate).toFixed(2)} %` : '—' },
      { label: 'Coût total', value: fmtEUR(totalCost), hint: 'capital + intérêts + assurance + frais' },
      { label: 'Remboursé', value: `${pctRepaid.toFixed(0)} %`, color: pctRepaid >= 50 ? C.sage : C.amber, hint: `${paid.length} échéance${paid.length > 1 ? 's' : ''} sur ${schedule.length}` },
    ]);

    yy += 4;
    drawSection(doc, yy, "Capital restant mois par mois", 'II'); yy += 16;
    drawBarSeries(doc, PAGE_M, yy + 6, pageW - PAGE_M * 2 - 60, 110, schedule.map((r) => r.remaining), {
      refValue: monthly, refMax: principal, refLabel: 'Mensualité',
    });
    yy += 130;

    drawSection(doc, yy, 'Synthèse financière', 'III'); yy += 16;
    const synthRows = [
      ["Capital remboursé à ce jour", fmtEUR(totalCapPaid)],
      ["Intérêts payés à ce jour", fmtEUR(totalIntPaid)],
      ["Assurance payée à ce jour", fmtEUR(totalInsPaid)],
      ["Total versé à ce jour", fmtEUR(totalPaid)],
      ["Restant à rembourser", fmtEUR(totalRemaining)],
      ["Frais de dossier", l.applicationFees ? fmtEUR(parseFloat(l.applicationFees)) : '—'],
    ];
    yy = table(doc, [['Poste', 'Montant']], synthRows, yy, {
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    });

    drawFooter(doc, doc.internal.getNumberOfPages(), doc.internal.getNumberOfPages());
  });

  // After amortization pages, retroactively rewrite the footer "page X / Y"
  // on every page so the count is final. (jsPDF doesn't auto-update.)
  const finalTotal = doc.internal.getNumberOfPages();
  for (let p = 1; p <= finalTotal; p++) {
    doc.setPage(p);
    // White out the old footer count area (right side) and redraw.
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFillColor(...C.paper);
    doc.rect(w - 90, h - 32, 50, 14, 'F');
    doc.setFont(FONT, 'normal'); doc.setFontSize(8); doc.setTextColor(...C.faint);
    doc.text(`${p} / ${finalTotal}`, w - PAGE_M, h - 22, { align: 'right' });
  }

  // Save with a name like "wealthly-bilan-raphael-2026-05.pdf"
  const monthSuffix = currentMonth || new Date().toISOString().slice(0, 7);
  const memberSlug = activeMember ? `-${activeMember.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}` : '';
  doc.save(`wealthly-bilan${memberSlug}-${monthSuffix}.pdf`);
}
