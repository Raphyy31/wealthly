import { describe, expect, test } from 'vitest';
import {
  classifyCashflowTransaction,
  FLOW_KINDS,
  summarizeCashflowFlows,
} from './financeEngine.js';

const principal = { id: 'personal', role: 'principal', memberIds: ['adult-a'] };
const joint = { id: 'joint', role: 'principal', isJoint: true, memberIds: ['adult-a', 'adult-b'] };
const savings = { id: 'savings', role: 'epargne', memberIds: ['adult-a'] };
const secondary = { id: 'secondary', role: 'depenses', memberIds: ['adult-a'] };
const accounts = [principal, joint, savings, secondary];
const settings = { enabled: true, shiftIncome: true, shiftJointContrib: true, pivotDay: 25 };

const classify = (transaction, options = {}) => classifyCashflowTransaction({
  transaction,
  account: options.account || principal,
  category: options.category,
  accounts,
  isTransfer: options.isTransfer || false,
  isJointContribution: options.isJointContribution || false,
  isHouseholdScope: options.isHouseholdScope || false,
  settings,
});

describe('moteur financier canonique', () => {
  test('le salaire reçu après le pivot finance le mois suivant', () => {
    const flow = classify(
      { date: '2026-06-30', amount: 4572.68, categoryId: 'salary' },
      { category: { id: 'salary', type: 'income' } },
    );
    expect(flow).toMatchObject({ kind: FLOW_KINDS.INCOME, amount: 4572.68, month: '2026-07' });
  });

  test('le versement perso au compte commun est une dépense du mois financé', () => {
    const flow = classify(
      { date: '2026-06-30', amount: -3000 },
      { isTransfer: true, isJointContribution: true },
    );
    expect(flow).toMatchObject({ kind: FLOW_KINDS.EXPENSE, amount: 3000, month: '2026-07' });
  });

  test('désactiver le décalage conserve la contribution dans son mois civil', () => {
    const flow = classifyCashflowTransaction({
      transaction: { date: '2026-06-30', amount: -3000 },
      account: principal,
      accounts,
      isTransfer: true,
      isJointContribution: true,
      settings: { ...settings, enabled: false },
    });
    expect(flow).toMatchObject({ kind: FLOW_KINDS.EXPENSE, amount: 3000, month: '2026-06' });
  });

  test('le versement reçu sur le compte commun est un financement, pas un revenu', () => {
    const flow = classify(
      { date: '2026-06-30', amount: 3000, label: 'VIREMENT EN VOTRE FAVEUR DE ADULTE A' },
      { account: joint, category: { id: 'income', type: 'income' }, isHouseholdScope: true },
    );
    expect(flow).toMatchObject({ kind: FLOW_KINDS.FUNDING, amount: 3000, month: '2026-07' });
  });

  test('une sortie du compte courant vers le livret est bien une épargne', () => {
    const flow = classify(
      { date: '2026-07-03', amount: -500, tags: ['transfer-dest:savings'] },
      { isTransfer: true },
    );
    expect(flow).toMatchObject({ kind: FLOW_KINDS.SAVING, amount: 500 });
  });

  test('un retrait depuis le livret ne crée aucune épargne', () => {
    const flow = classify(
      { date: '2026-07-03', amount: -3000, categoryId: 'savings' },
      { account: savings, category: { id: 'savings', type: 'transfer', kind: 'savings' } },
    );
    expect(flow).toMatchObject({ kind: FLOW_KINDS.IGNORED, amount: 0, reason: 'savings-arbitrage' });
  });

  test('la jambe créditrice reçue depuis le livret ne crée aucune épargne', () => {
    const flow = classify(
      { date: '2026-07-03', amount: 3000, tags: ['transfer-dest:savings'] },
      { isTransfer: true },
    );
    expect(flow).toMatchObject({ kind: FLOW_KINDS.IGNORED, amount: 0 });
  });

  test('un remboursement réduit les dépenses sans gonfler les revenus', () => {
    const flow = classify(
      { date: '2026-07-12', amount: 176, categoryId: 'hotel' },
      { category: { id: 'hotel', type: 'expense', kind: 'wants' } },
    );
    expect(flow).toMatchObject({ kind: FLOW_KINDS.EXPENSE, amount: -176, reason: 'expense-refund' });
  });

  test('un top-up reçu sur un compte secondaire n’est pas un revenu', () => {
    const flow = classify(
      { date: '2026-07-03', amount: 250 },
      { account: secondary },
    );
    expect(flow).toMatchObject({ kind: FLOW_KINDS.IGNORED, amount: 0 });
  });

  test('un mois familial complet garde des totaux cohérents sur toutes les vues', () => {
    const flows = [
      { kind: FLOW_KINDS.INCOME, amount: 4572.68 },
      { kind: FLOW_KINDS.FUNDING, amount: 3000 },
      { kind: FLOW_KINDS.EXPENSE, amount: 3514 },
      { kind: FLOW_KINDS.EXPENSE, amount: 478 },
      { kind: FLOW_KINDS.EXPENSE, amount: -176 },
      { kind: FLOW_KINDS.SAVING, amount: 50 },
      { kind: FLOW_KINDS.IGNORED, amount: 3000 },
    ];

    expect(summarizeCashflowFlows(flows)).toEqual({
      income: 4572.68,
      funding: 3000,
      expense: 3816,
      saving: 50,
      resources: 7572.68,
      balance: 3706.68,
    });
  });

  test('les remboursements supérieurs aux achats ne créent pas de dépense négative', () => {
    expect(summarizeCashflowFlows([
      { kind: FLOW_KINDS.EXPENSE, amount: 100 },
      { kind: FLOW_KINDS.EXPENSE, amount: -150 },
    ]).expense).toBe(0);
  });
});
