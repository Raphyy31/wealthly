import { describe, expect, test } from 'vitest';
import { formatBankName, shiftMonthForDate, effectiveMonth } from './utils.js';

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
