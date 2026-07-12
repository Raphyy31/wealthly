import { describe, expect, test } from 'vitest';
import { importedPositionValue, portfolioValueAfterImport } from './positionsImport.js';

describe('mise à jour de portefeuille', () => {
  test('calcule une ligne depuis la valorisation ou quantité × cours', () => {
    expect(importedPositionValue({ amount: '1 250,50' })).toBe(1250.5);
    expect(importedPositionValue({ quantity: 10, lastPrice: 178 })).toBe(1780);
  });

  test('un réimport remplace les lignes et conserve les liquidités', () => {
    expect(portfolioValueAfterImport({
      mode: 'replace',
      parentValue: 3500,
      existingPositions: [{ currentValue: 1000 }, { currentValue: 2000 }],
      importedPositions: [{ amount: 1800 }, { amount: 2200 }],
    })).toBe(4500);
  });

  test('un ajout manuel conserve les anciennes lignes', () => {
    expect(portfolioValueAfterImport({
      mode: 'append',
      parentValue: 3500,
      existingPositions: [{ currentValue: 1000 }, { currentValue: 2000 }],
      importedPositions: [{ quantity: 2, lastPrice: 400 }],
    })).toBe(4300);
  });
});
