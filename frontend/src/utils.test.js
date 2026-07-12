import { describe, expect, test } from 'vitest';
import { formatBankName } from './utils.js';

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
