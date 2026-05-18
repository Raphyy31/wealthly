// ============================================================================
// taxFr.js — Tests vitest (C20, P6 dette technique 2026-05-18).
//
// Moteur fiscal FR critique (barème 2025 déclaré 2026). Avant ce fichier,
// AUCUN test ne couvrait taxFr.js — risque réglementaire majeur si une
// constante était mal saisie ou un calcul cassait silencieusement.
//
// 21 cas représentatifs couvrant : abattement salaire, parts fiscales,
// barème progressif, taux marginal, crédits d'impôt + plafond niches,
// computeTax bout-en-bout (cas single / couple / quotient familial /
// décote / crédits enfants), comparaison PAS.
// ============================================================================
import { describe, test, expect } from 'vitest';
import {
  BAREME_2025,
  PLAFOND_DEMI_PART_2025,
  TAX_CREDITS_2025,
  PLAFOND_NICHES_FISCALES_2025,
  abattementSalaire,
  computeParts,
  applyBareme,
  marginalRate,
  computeTaxCredits,
  computeTax,
  compareWithPAS,
} from './taxFr.js';

// ─── abattementSalaire ──────────────────────────────────────────────────────

describe('abattementSalaire', () => {
  test('plancher à 504 € pour un revenu très faible', () => {
    // 3000 × 10% = 300, mais le min légal est 504
    expect(abattementSalaire(3000)).toBe(504);
  });

  test('10% pour un revenu intermédiaire', () => {
    // 30 000 × 10% = 3000 (entre min 504 et max 14 426)
    expect(abattementSalaire(30000)).toBeCloseTo(3000, 2);
  });

  test('plafond à 14 426 € pour les hauts revenus', () => {
    // 200 000 × 10% = 20 000, mais max légal 14 426
    expect(abattementSalaire(200000)).toBe(14426);
  });
});

// ─── computeParts ──────────────────────────────────────────────────────────

describe('computeParts', () => {
  test('célibataire sans enfant → 1 part', () => {
    expect(computeParts({ household: 'single', children: 0 })).toBe(1);
  });

  test('couple sans enfant → 2 parts', () => {
    expect(computeParts({ household: 'couple', children: 0 })).toBe(2);
  });

  test('couple 2 enfants → 3 parts (0.5 × 2)', () => {
    expect(computeParts({ household: 'couple', children: 2 })).toBe(3);
  });

  test('couple 3 enfants → 4 parts (0.5 × 2 + 1 × 1)', () => {
    expect(computeParts({ household: 'couple', children: 3 })).toBe(4);
  });
});

// ─── applyBareme ────────────────────────────────────────────────────────────

describe('applyBareme', () => {
  test('revenu sous le seuil → 0 €', () => {
    // 11 497 € = limite haute de la tranche 0%
    expect(applyBareme(11000)).toBe(0);
  });

  test('revenu à 25 000 € → seulement tranche 11%', () => {
    // (25000 - 11497) × 0.11 = 1485.33
    expect(applyBareme(25000)).toBeCloseTo((25000 - 11497) * 0.11, 2);
  });

  test('revenu à 100 000 € → multi-tranches', () => {
    // 0% jusqu'à 11497, 11% jusqu'à 29315, 30% jusqu'à 83823, 41% au-delà
    const expected = 0
      + (29315 - 11497) * 0.11
      + (83823 - 29315) * 0.30
      + (100000 - 83823) * 0.41;
    expect(applyBareme(100000)).toBeCloseTo(expected, 2);
  });
});

// ─── marginalRate ───────────────────────────────────────────────────────────

describe('marginalRate', () => {
  test('11% pour 25 000 €', () => {
    expect(marginalRate(25000)).toBe(0.11);
  });

  test('45% pour très hauts revenus', () => {
    expect(marginalRate(500000)).toBe(0.45);
  });
});

// ─── computeTaxCredits ──────────────────────────────────────────────────────

describe('computeTaxCredits', () => {
  test('crédit garde d\'enfant — 1 enfant <6 ans, 2 800 € de frais', () => {
    const r = computeTaxCredits({
      childcareExpenses: 2800,
      youngChildren: 1,
    });
    // 50% × min(2800, 3500) = 1400
    expect(r.childcareCredit).toBe(1400);
    expect(r.cesuCredit).toBe(0);
  });

  test('plafond garde enfant — dépenses > capPerChild', () => {
    const r = computeTaxCredits({
      childcareExpenses: 5000,
      youngChildren: 1,
    });
    // cap à 3500 × 50% = 1750
    expect(r.childcareCredit).toBe(1750);
    expect(r.childcareCappedSpec).toBe(true);
  });

  test('plafond global niches — 10 000 €', () => {
    // Childcare max théorique 1 750 + CESU max théorique 6 000 = 7 750 < 10k → pas cappé
    const r = computeTaxCredits({
      childcareExpenses: 3500,
      youngChildren: 1,
      cesuExpenses: 12000,
      dependents: 0,
    });
    // total raw = 1750 + 6000 = 7750
    expect(r.cappedByGlobal).toBe(false);
    expect(r.total).toBe(7750);
  });

  test('plafond global niches DÉPASSÉ — 3 enfants + gros CESU', () => {
    const r = computeTaxCredits({
      childcareExpenses: 10500,
      youngChildren: 3,
      cesuExpenses: 15000,
      dependents: 3,
    });
    // raw = 5250 + 7500 = 12750 > 10000 → cappé
    expect(r.totalRaw).toBe(12750);
    expect(r.total).toBe(10000);
    expect(r.cappedByGlobal).toBe(true);
  });
});

// ─── computeTax — cas d'usage typiques ──────────────────────────────────────

describe('computeTax', () => {
  test('célibataire 30 000 € net imposable → impôt > 0 sans décote', () => {
    const r = computeTax({
      netTaxableIncome: 30000,
      household: 'single',
      children: 0,
    });
    // 1 part, applyBareme(30000) = (29315-11497)*0.11 + (30000-29315)*0.30
    //                            = 1959.98 + 205.50 = 2165.48
    expect(r.parts).toBe(1);
    expect(r.finalTax).toBeGreaterThan(0);
    // Décote ne s'applique pas (impôt > 1964)
    expect(r.decoteAmount).toBe(0);
  });

  test('célibataire faible revenu → décote applicable', () => {
    const r = computeTax({
      netTaxableIncome: 15000,
      household: 'single',
      children: 0,
    });
    // applyBareme(15000) = (15000-11497) * 0.11 = 385.33 → sous seuil 1964 → décote
    expect(r.taxAfterPlafond).toBeGreaterThan(0);
    expect(r.decoteAmount).toBeGreaterThan(0);
    expect(r.finalTax).toBe(0); // décote efface l'impôt
  });

  test('couple 80 000 € net imposable, 2 enfants → quotient familial 3 parts', () => {
    const r = computeTax({
      netTaxableIncome: 80000,
      household: 'couple',
      children: 2,
    });
    expect(r.parts).toBe(3);
    // 80000/3 = 26666 par part → seulement tranche 11%
    expect(r.taxPerPart).toBeCloseTo((26666.666 - 11497) * 0.11, 1);
  });

  test('plafond du quotient familial — couple très haut revenu, 4 enfants', () => {
    // 4 enfants = 0.5*2 + 1*2 = 3 demi-parts en plus de 2 (couple)
    // Si revenus très hauts, le gain par demi-part peut dépasser 1791 €
    const r = computeTax({
      netTaxableIncome: 200000,
      household: 'couple',
      children: 4,
    });
    expect(r.parts).toBe(5);
    // Avec 200k€ et 5 parts vs 2, le plafond du quotient doit être touché
    expect(r.plafondCapped).toBe(true);
  });

  test('crédit garde d\'enfant intégré → finalTax réduit', () => {
    const sansCredit = computeTax({
      netTaxableIncome: 50000,
      household: 'single',
      children: 1,
      childcareExpenses: 0,
      youngChildren: 0,
    });
    const avecCredit = computeTax({
      netTaxableIncome: 50000,
      household: 'single',
      children: 1,
      childcareExpenses: 3000,
      youngChildren: 1,
    });
    // 3000 × 50% = 1500 € de crédit
    expect(avecCredit.finalTax).toBeCloseTo(sansCredit.finalTax - 1500, 1);
    expect(avecCredit.credits.childcareCredit).toBe(1500);
  });

  test('effectiveRate cohérent avec finalTax / netTaxableIncome', () => {
    const r = computeTax({
      netTaxableIncome: 60000,
      household: 'single',
      children: 0,
    });
    expect(r.effectiveRate).toBeCloseTo(r.finalTax / 60000, 5);
  });
});

// ─── compareWithPAS ─────────────────────────────────────────────────────────

describe('compareWithPAS', () => {
  test('solde positif si PAS insuffisant', () => {
    // L'utilisateur doit encore 1000 € (impôt final - PAS payé)
    expect(compareWithPAS(5000, 4000)).toBe(1000);
  });

  test('solde négatif (refund) si PAS excédentaire', () => {
    // L'État rembourse 1500 €
    expect(compareWithPAS(3000, 4500)).toBe(-1500);
  });
});

// ─── Constantes — garde-fou anti-régression sur les valeurs critiques ──────

describe('Constantes 2025 (revenus déclarés en 2026)', () => {
  test('barème 5 tranches inchangé', () => {
    expect(BAREME_2025.length).toBe(5);
    expect(BAREME_2025[0]).toEqual({ upTo: 11497, rate: 0 });
    expect(BAREME_2025[4].rate).toBe(0.45);
  });

  test('plafond demi-part = 1 791 €', () => {
    expect(PLAFOND_DEMI_PART_2025).toBe(1791);
  });

  test('plafond niches fiscales = 10 000 €', () => {
    expect(PLAFOND_NICHES_FISCALES_2025).toBe(10000);
  });

  test('crédit garde enfant — taux 50% / cap 3 500 € par enfant', () => {
    expect(TAX_CREDITS_2025.childcare.rate).toBe(0.50);
    expect(TAX_CREDITS_2025.childcare.capPerChild).toBe(3500);
  });
});
