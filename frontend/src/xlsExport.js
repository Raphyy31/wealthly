/**
 * Exports Excel (.xlsx) via SheetJS — investissements (positions) + emprunts
 * (échéancier des mensualités).
 *
 * Pur côté client : construit un classeur et déclenche le téléchargement.
 * Réutilise buildAmortization (même calcul que la fiche Prêt) pour l'échéancier.
 */
import * as XLSX from 'xlsx';
import { buildAmortization } from './utils.js';

// ---------- helpers ----------
const ts = () => new Date().toISOString().slice(0, 10);
const r2 = (v, d = 2) => (v == null || isNaN(v) ? '' : Math.round((Number(v) + Number.EPSILON) * 10 ** d) / 10 ** d);
const sum = (arr) => arr.reduce((s, v) => s + (Number(v) || 0), 0);
const slug = (s) => String(s || 'export').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'export';
// Onglet Excel : max 31 car., interdits : \ / ? * [ ] :
const sheetName = (s) => String(s || 'Feuille').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Feuille';

function autofit(aoa) {
  const cols = [];
  aoa.forEach((row) => row.forEach((cell, i) => {
    const len = String(cell ?? '').length;
    cols[i] = Math.max(cols[i] || 8, Math.min(40, len + 2));
  }));
  return cols.map((wch) => ({ wch }));
}

function sheetFromAoa(wb, name, aoa) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = autofit(aoa);
  XLSX.utils.book_append_sheet(wb, ws, sheetName(name));
  return ws;
}

// ---------- Investissements ----------
// rows: [{ name, isin, qty, cours, invested, value, pl, plPct }]
export function exportInvestmentPositionsXlsx(rows, meta = {}) {
  const accountName = meta.accountName || 'Investissements';
  const header = ['Libellé', 'ISIN / Ticker', 'Quantité', 'Cours', 'Prix de revient', 'Investi', 'Valeur actuelle', '+/- value (€)', '+/- value (%)'];
  const body = (rows || []).map((p) => [
    p.name || '—', p.isin || '',
    r2(p.qty, 6), r2(p.cours, 4),
    p.qty > 0 ? r2(p.invested / p.qty, 4) : '',
    r2(p.invested), r2(p.value), r2(p.pl), r2(p.plPct, 2),
  ]);
  const tInv = sum((rows || []).map((p) => p.invested));
  const tVal = sum((rows || []).map((p) => p.value));
  const tPl = tVal - tInv;
  body.push([]);
  body.push(['TOTAL', '', '', '', '', r2(tInv), r2(tVal), r2(tPl), tInv > 0 ? r2((tPl / tInv) * 100, 2) : '']);

  const meta1 = [[`Investissements — ${accountName}`], [`Édité le ${ts()}`], []];
  const wb = XLSX.utils.book_new();
  sheetFromAoa(wb, accountName, [...meta1, header, ...body]);
  XLSX.writeFile(wb, `Wealthly_Investissements_${slug(accountName)}_${ts()}.xlsx`);
}

// ---------- Emprunts ----------
function scheduleOf(l) {
  return buildAmortization({
    principal: l.initialCapital ?? l.initial_capital ?? l.principal,
    annualRate: l.interestRate ?? l.interest_rate,
    durationM: l.durationMonths ?? l.duration_months,
    insuranceRate: l.insuranceRate ?? l.insurance_rate,
    startDate: l.startDate ?? l.start_date,
    paymentOverride: l.monthlyPayment ?? l.monthly_payment,
  });
}

function amortSheet(wb, label, l) {
  const schedule = scheduleOf(l);
  if (!schedule.length) return;
  const header = ['N°', 'Date', 'Mensualité', 'Capital', 'Intérêts', 'Assurance', 'Capital restant'];
  const body = schedule.map((row) => [
    row.idx, row.date, r2(row.payment), r2(row.capital), r2(row.interest), r2(row.insurance), r2(row.remaining),
  ]);
  const totalPaid = sum(schedule.map((row) => row.payment));
  const totalInterest = sum(schedule.map((row) => row.interest));
  const totalIns = sum(schedule.map((row) => row.insurance));
  body.push([]);
  body.push(['', 'TOTAL', r2(totalPaid), '', r2(totalInterest), r2(totalIns), '']);
  sheetFromAoa(wb, label, [[`Échéancier — ${l.name || 'Prêt'}`], [`Édité le ${ts()}`], [], header, ...body]);
}

// Exporte un classeur : synthèse + 1 onglet d'échéancier par prêt.
export function exportLoansXlsx(liabilities) {
  const loans = (liabilities || []).filter(Boolean);
  const wb = XLSX.utils.book_new();

  const sHeader = ['Prêt', 'Type', 'Capital emprunté', 'Taux', 'Assurance', 'Durée (mois)', 'Mensualité', 'Capital restant', 'Coût du crédit'];
  const sRows = loans.map((l) => {
    const schedule = scheduleOf(l);
    const principal = parseFloat(l.initialCapital ?? l.initial_capital ?? l.principal) || 0;
    const monthly = parseFloat(l.monthlyPayment ?? l.monthly_payment) || (schedule[0]?.payment ?? 0);
    const totalPaid = sum(schedule.map((row) => row.payment));
    const remaining = parseFloat(l.remainingCapital ?? l.remaining_capital) || 0;
    const rate = l.interestRate ?? l.interest_rate;
    const ins = l.insuranceRate ?? l.insurance_rate;
    return [
      l.name || '—', l.type || '', r2(principal),
      rate ? `${rate} %` : '', ins ? `${ins} %` : '',
      l.durationMonths ?? l.duration_months ?? schedule.length,
      r2(monthly), r2(remaining), r2(Math.max(0, totalPaid - principal)),
    ];
  });
  sheetFromAoa(wb, 'Synthèse emprunts', [['Emprunts — synthèse'], [`Édité le ${ts()}`], [], sHeader, ...sRows]);

  loans.forEach((l, i) => amortSheet(wb, `${i + 1}. ${l.name || 'Prêt'}`, l));
  XLSX.writeFile(wb, `Wealthly_Emprunts_${ts()}.xlsx`);
}

// Un seul prêt (depuis la fiche détail).
export function exportLoanScheduleXlsx(l) {
  const wb = XLSX.utils.book_new();
  amortSheet(wb, l.name || 'Échéancier', l);
  // Si l'échéancier est vide (params manquants), exporte au moins une synthèse 1 ligne.
  if (!wb.SheetNames.length) {
    sheetFromAoa(wb, 'Prêt', [['Échéancier indisponible'], ['Renseigne capital, taux et durée du prêt pour générer les mensualités.']]);
  }
  XLSX.writeFile(wb, `Wealthly_Emprunt_${slug(l.name)}_${ts()}.xlsx`);
}
