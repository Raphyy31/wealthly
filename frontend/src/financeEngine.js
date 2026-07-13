// ============================================================================
// Yotori Finance — moteur de lecture des flux
//
// Une transaction bancaire ne doit être interprétée qu'une seule fois, puis
// réutilisée par Accueil, Budget, Flux et les ratios. Ce module est volontairement
// pur : aucune dépendance React, aucun état local, aucune API.
// ============================================================================

import {
  accountCountsAsExpense,
  accountCountsAsIncome,
  effectiveMonth,
  getTransferType,
  isJointAccountFunding,
  monthKey,
  savingsContributionAmount,
  shiftMonthForDate,
} from './utils.js';

export const FLOW_KINDS = Object.freeze({
  INCOME: 'income',
  EXPENSE: 'expense',
  SAVING: 'saving',
  FUNDING: 'funding',
  TRANSFER: 'transfer',
  IGNORED: 'ignored',
});

const ignored = (month, reason) => ({
  kind: FLOW_KINDS.IGNORED,
  amount: 0,
  month,
  reason,
});

// Retourne une lecture canonique :
//   kind   — income | expense | saving | funding | transfer | ignored
//   amount — montant budgétaire signé (un remboursement réduit les dépenses)
//   month  — mois budgétaire, après règle du jour pivot
//   reason — explication stable utile aux tests et futurs diagnostics UI
export function classifyCashflowTransaction({
  transaction,
  account,
  category,
  accounts = [],
  isTransfer = false,
  isJointContribution = false,
  isHouseholdScope = false,
  settings = {},
}) {
  const rawAmount = Number(transaction?.sharedAmount ?? transaction?.amount ?? 0);
  const civilMonth = monthKey(transaction?.date);
  const role = account?.role || 'principal';
  const pivotDay = settings?.pivotDay ?? 25;

  if (!Number.isFinite(rawAmount) || !transaction?.date) {
    return ignored(civilMonth, 'invalid-transaction');
  }

  // Perso → compte commun : c'est bien une charge du budget personnel, même
  // si les deux jambes ont été reconnues comme virement interne. Après le jour
  // pivot, le versement finance le mois suivant.
  if (!isHouseholdScope && isJointContribution && rawAmount < 0) {
    return {
      kind: FLOW_KINDS.EXPENSE,
      amount: Math.abs(rawAmount),
      month: transaction.effective_month_override
        || (settings?.enabled === false ? civilMonth : shiftMonthForDate(transaction.date, pivotDay)),
      reason: 'joint-account-contribution',
    };
  }

  // Sur la vue Famille, les versements reçus par le compte commun financent
  // le budget mais ne sont jamais des revenus du foyer.
  if (isHouseholdScope && isJointAccountFunding(transaction, account, category, settings?.shiftJointContrib)) {
    return {
      kind: FLOW_KINDS.FUNDING,
      amount: Math.max(0, rawAmount),
      month: transaction.effective_month_override
        || (settings?.enabled === false ? civilMonth : shiftMonthForDate(transaction.date, pivotDay)),
      reason: 'joint-account-funding',
    };
  }

  const transferType = isTransfer ? getTransferType(transaction, accounts) : null;
  const categoryIsSaving = category?.kind === 'savings';

  // Une épargne est uniquement une sortie depuis un compte de budget. Les
  // retraits de Livret et les jambes créditrices restent des arbitrages.
  if (categoryIsSaving || transferType === 'savings') {
    const contribution = savingsContributionAmount({ sharedAmount: rawAmount }, account);
    if (contribution > 0) {
      return {
        kind: FLOW_KINDS.SAVING,
        amount: contribution,
        month: civilMonth,
        reason: transferType === 'savings' ? 'savings-transfer' : 'savings-category',
      };
    }
    return ignored(civilMonth, 'savings-arbitrage');
  }

  // Tout autre virement interne est neutre : la dépense réelle sera portée
  // par le compte destinataire (Revolut, carte secondaire, etc.).
  if (isTransfer) {
    return {
      kind: FLOW_KINDS.TRANSFER,
      amount: 0,
      month: civilMonth,
      reason: transferType === 'secondary' ? 'secondary-account-transfer' : 'internal-transfer',
    };
  }

  const manualExpense = transaction?.isManualCategory && category?.type === 'expense';
  const manualIncome = transaction?.isManualCategory && category?.type === 'income';
  const explicitlyRealIncome = category?.type === 'income' && transaction?.isTransferOverride === false;

  if (rawAmount > 0) {
    // Un remboursement sur une catégorie de dépense réduit la dépense du mois ;
    // il ne gonfle pas les revenus.
    if (category?.type === 'expense') {
      return {
        kind: FLOW_KINDS.EXPENSE,
        amount: -rawAmount,
        month: civilMonth,
        reason: 'expense-refund',
      };
    }
    if (accountCountsAsIncome(role) || manualIncome || explicitlyRealIncome) {
      return {
        kind: FLOW_KINDS.INCOME,
        amount: rawAmount,
        month: effectiveMonth(transaction, settings, category ? [category] : []),
        reason: manualIncome || explicitlyRealIncome ? 'explicit-income' : 'account-income',
      };
    }
    return ignored(civilMonth, 'non-income-account-credit');
  }

  if (rawAmount < 0 && (accountCountsAsExpense(role) || manualExpense)) {
    return {
      kind: FLOW_KINDS.EXPENSE,
      amount: Math.abs(rawAmount),
      month: civilMonth,
      reason: manualExpense ? 'manual-expense' : 'account-expense',
    };
  }

  return ignored(civilMonth, rawAmount === 0 ? 'zero-amount' : 'excluded-account-role');
}

// Agrège des flux déjà classés. Les remboursements portent un montant de
// dépense négatif : ils diminuent les sorties, sans jamais produire une
// « dépense négative » dans les KPI si les remboursements dépassent les achats.
// Budget et Flux utilisent cette même fonction pour garantir les mêmes totaux.
export function summarizeCashflowFlows(flows = []) {
  const totals = { income: 0, funding: 0, expense: 0, saving: 0 };
  const toCents = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

  for (const item of flows) {
    const kind = item?.kind ?? item?.cashflowKind;
    const amount = Number(item?.cashflowAmount ?? item?.amount ?? 0);
    if (!Number.isFinite(amount) || !(kind in totals)) continue;
    totals[kind] += amount;
  }

  totals.income = Math.max(0, toCents(totals.income));
  totals.funding = Math.max(0, toCents(totals.funding));
  totals.expense = Math.max(0, toCents(totals.expense));
  totals.saving = Math.max(0, toCents(totals.saving));

  const resources = toCents(totals.income + totals.funding);
  const balance = toCents(resources - totals.expense - totals.saving);

  return {
    ...totals,
    resources,
    balance,
  };
}
