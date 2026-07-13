import { describe, expect, test } from 'vitest';
import {
  formatBankName, shiftMonthForDate, effectiveMonth,
  isExplicitBankTransfer, extractTransferContributor,
  buildBudgetAllocation, detectInternalTransfers, isJointAccount, isJointAccountFunding,
  savingsContributionAmount,
} from './utils.js';

describe('shiftMonthForDate (décalage fin de mois)', () => {
  test('un flux au jour pivot ou après bascule au mois suivant', () => {
    expect(shiftMonthForDate('2026-05-28', 25)).toBe('2026-06');
    expect(shiftMonthForDate('2026-05-25', 25)).toBe('2026-06');
  });
  test('un flux avant le jour pivot reste sur son mois civil', () => {
    expect(shiftMonthForDate('2026-05-24', 25)).toBe('2026-05');
    expect(shiftMonthForDate('2026-05-03', 25)).toBe('2026-05');
  });
  test('gère le passage décembre → janvier', () => {
    expect(shiftMonthForDate('2026-12-30', 25)).toBe('2027-01');
  });
});

describe('ventilation budget du mois affiché', () => {
  const categories = [
    { id: 'loan', kind: 'needs' },
    { id: 'restaurant', kind: 'wants' },
    { id: 'saving', kind: 'savings' },
    { id: 'uncategorized', kind: 'wants' },
  ];

  test('réconcilie les montants préparés par la vue mensuelle', () => {
    const result = buildBudgetAllocation([
      { sharedAmount: -3814.37, categoryId: 'loan' },
      { sharedAmount: -124, categoryId: 'restaurant' },
      { sharedAmount: -50, categoryId: 'saving' },
      { sharedAmount: 3000, categoryId: 'loan' },
    ], categories);
    expect(result).toEqual({ needs: 3814.37, wants: 124, savings: 50, unclassified: 0, total: 3988.37 });
  });

  test('n’invente pas une envie pour une transaction non catégorisée', () => {
    const result = buildBudgetAllocation([{ sharedAmount: -42, categoryId: 'uncategorized' }], categories);
    expect(result.unclassified).toBe(42);
    expect(result.wants).toBe(0);
  });
});

describe('épargne mensuelle', () => {
  test('compte seulement une sortie depuis le compte courant', () => {
    expect(savingsContributionAmount({ amount: -3000 }, { role: 'principal' })).toBe(3000);
  });

  test('un retrait depuis un livret ne devient pas une nouvelle épargne', () => {
    expect(savingsContributionAmount({ amount: -3000 }, { role: 'epargne' })).toBe(0);
  });

  test('la jambe créditrice reçue depuis le livret ne compte pas non plus', () => {
    expect(savingsContributionAmount({ amount: 3000 }, { role: 'principal' })).toBe(0);
  });
});

describe('effectiveMonth — les dépenses ne shiftent pas (sauf logique compte commun ailleurs)', () => {
  test('un revenu de fin de mois glisse au mois suivant', () => {
    expect(effectiveMonth({ date: '2026-05-28', amount: 2000 }, { enabled: true, pivotDay: 25 })).toBe('2026-06');
  });
  test('une dépense de fin de mois reste sur son mois civil', () => {
    expect(effectiveMonth({ date: '2026-05-28', amount: -800 }, { enabled: true, pivotDay: 25 })).toBe('2026-05');
  });
});

describe('formatBankName', () => {
  test('remplace les identifiants GoCardless courants par un nom lisible', () => {
    expect(formatBankName('BNP_PARIBAS_BNPAFRPP')).toBe('BNP Paribas');
    expect(formatBankName('CREDIT_AGRICOLE_AGRIFRPP')).toBe('Crédit Agricole');
    expect(formatBankName('LCL_CRLYFRPP')).toBe('LCL');
  });

  test('préfère le nom officiel fourni par l’institution', () => {
    expect(formatBankName('SOME_TECHNICAL_ID', 'Ma Banque')).toBe('Ma Banque');
  });

  test('nettoie les identifiants inconnus sans exposer leur BIC', () => {
    expect(formatBankName('BANQUE_EXEMPLE_ABCDEFGH')).toBe('Banque Exemple');
  });
});

describe('financement du compte commun', () => {
  test('reconnaît un virement bancaire mais pas un remboursement carte', () => {
    expect(isExplicitBankTransfer({ label: 'VIREMENT EN VOTRE FAVEUR DE MONSIEUR MARTIN LEO' })).toBe(true);
    expect(isExplicitBankTransfer({ label: 'AVOIR CARTE 10/07 SUPERMARCHE' })).toBe(false);
  });

  test('attribue le versement à un membre connu', () => {
    const tx = { label: 'VIREMENT EN VOTRE FAVEUR DE MONSIEUR MARTIN LEO' };
    expect(extractTransferContributor(tx, [{ name: 'Léo' }, { name: 'Anna' }])).toBe('Léo');
  });

  test('reconnaît un prénom tronqué par la banque', () => {
    const tx = { label: 'VIREMENT RECU PARTOUCHE MARTIN CAR' };
    expect(extractTransferContributor(tx, [{ name: 'Carla' }])).toBe('Carla');
  });

  test('conserve une source bancaire lisible quand le compte source est absent', () => {
    const tx = { label: 'VIREMENT EN VOTRE FAVEUR DE MADAME DUPONT ANNA' };
    expect(extractTransferContributor(tx, [])).toBe('Dupont Anna');
  });

  test('un virement entrant joint reste un financement même classé en revenu', () => {
    const tx = { amount: 3000, label: 'VIREMENT EN VOTRE FAVEUR DE MADAME MARTIN CAR', isManualCategory: true };
    expect(isJointAccountFunding(tx, { isJoint: true }, { type: 'income' })).toBe(true);
  });

  test('un ancien compte à plusieurs titulaires est reconnu comme compte commun', () => {
    const account = { isJoint: false, memberIds: ['raphael', 'carla'] };
    const tx = { amount: 3000, label: 'VIREMENT EN VOTRE FAVEUR DE MADAME MARTIN CAR' };
    expect(isJointAccount(account)).toBe(true);
    expect(isJointAccountFunding(tx, account, { type: 'income' })).toBe(true);
  });

  test('un choix explicite « pas un virement » autorise un vrai revenu', () => {
    const tx = { amount: 3000, label: 'VIREMENT EN VOTRE FAVEUR DE SOCIETE X', isTransferOverride: false };
    expect(isJointAccountFunding(tx, { isJoint: true }, { type: 'income' })).toBe(false);
  });
});

describe('détection prudente des virements internes', () => {
  test('apparie deux jambes portant un libellé de virement', () => {
    const detected = detectInternalTransfers([
      { id: 'out', accountId: 'personal', date: '2026-07-01', amount: -500, label: 'VIREMENT EMIS WEB COMPTE COMMUN' },
      { id: 'in', accountId: 'joint', date: '2026-07-01', amount: 500, label: 'VIREMENT EN VOTRE FAVEUR' },
    ]);
    expect([...detected].sort()).toEqual(['in', 'out']);
  });

  test('ne neutralise pas deux opérations sans indice de virement', () => {
    const detected = detectInternalTransfers([
      { id: 'card', accountId: 'secondary', date: '2026-07-01', amount: -42, label: 'CARTE RESTAURANT' },
      { id: 'refund', accountId: 'joint', date: '2026-07-01', amount: 42, label: 'AVOIR CARTE SUPERMARCHE' },
    ]);
    expect([...detected]).toEqual([]);
  });
});
