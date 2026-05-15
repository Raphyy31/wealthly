// frontend/src/hooks/useWealthItems.js
//
// Normalise accounts + assets + liabilities en WealthItem[] unifié.
// Memoization stricte — recompute uniquement quand les sources changent.

import { useMemo } from 'react';
import { BACKEND_TO_SUBTYPE, SUBTYPE_TO_CATEGORY } from '../types/wealth.js';

const accountToWealthItem = (a, accountBalances = {}) => {
  // Fall back to role-based subtype when account.type is unspecific
  let subtype = BACKEND_TO_SUBTYPE[a.type];
  if (!subtype) {
    if (a.role === 'epargne') subtype = 'livret';
    else if (a.role === 'investissement') subtype = 'cto';
    else subtype = 'compte_courant';
  }
  const value = parseFloat(accountBalances[a.id] ?? a.balance ?? a.initialBalance ?? 0);

  return {
    id: `account:${a.id}`,
    sourceTable: 'account',
    sourceId: a.id,
    category: SUBTYPE_TO_CATEGORY[subtype] || 'liquidites',
    subtype,
    name: a.name,
    currency: a.currency || 'EUR',
    value,
    syncMode: a.source === 'gocardless' ? 'synced' : 'manual',
    lastSyncedAt: a.lastSyncedAt || null,
    connectionId: a.connectionId || null,
    memberIds: a.memberIds || [],
    meta: { bank: a.bank, role: a.role, externalId: a.externalId },
  };
};

const assetToWealthItem = (a, childAssets = []) => {
  let subtype = BACKEND_TO_SUBTYPE[a.type] || 'autre';
  // Real-estate subtype refinement using Asset.subtype field
  if (a.type === 'real_estate' && a.subtype) {
    const refined = { RP: 'rp', locative: 'locatif', secondaire: 'rp', scpi: 'scpi' };
    subtype = refined[a.subtype] || 'rp';
  }

  // If this asset has imported child positions, derive its value/cost
  // basis from the children. Otherwise fall back to its own fields.
  let value, costBasis, positions = null;
  if (childAssets.length > 0) {
    positions = childAssets.map(c => ({
      id: c.id,
      name: c.name,
      isin: c.isin || '',
      ticker: c.ticker || '',
      quantity: c.quantity,
      costBasis: c.purchasePrice != null ? parseFloat(c.purchasePrice) : null,
      lastPrice: (c.quantity && c.currentValue) ? parseFloat(c.currentValue) / parseFloat(c.quantity) : null,
      value: parseFloat(c.currentValue ?? 0),
    }));
    value = positions.reduce((s, p) => s + (p.value || 0), 0);
    const cbSum = childAssets.reduce((s, c) => s + (c.purchasePrice != null && c.quantity != null
      ? parseFloat(c.purchasePrice) * parseFloat(c.quantity) : 0), 0);
    costBasis = cbSum > 0 ? cbSum : null;
  } else {
    value = parseFloat(a.currentValue ?? 0);
    costBasis = a.purchasePrice != null ? parseFloat(a.purchasePrice) : null;
  }
  const plLatente = costBasis != null ? value - costBasis : null;
  const plLatentePct = costBasis != null && costBasis > 0 ? (plLatente / costBasis) * 100 : null;

  return {
    id: `asset:${a.id}`,
    sourceTable: 'asset',
    sourceId: a.id,
    category: SUBTYPE_TO_CATEGORY[subtype] || 'autres',
    subtype,
    name: a.name,
    currency: a.currency || 'EUR',
    value,
    costBasis,
    plLatente,
    plLatentePct,
    positions,
    syncMode: 'manual',
    memberIds: a.memberIds || [],
    meta: {
      ticker: a.ticker,
      quantity: a.quantity,
      surface_m2: a.surfaceM2 != null && a.surfaceM2 !== '' ? parseFloat(a.surfaceM2) : null,
      address: a.address,
      ownership_pct: a.ownershipPct != null && a.ownershipPct !== '' ? parseFloat(a.ownershipPct) : null,
      purchase_price: a.purchasePrice != null && a.purchasePrice !== '' ? parseFloat(a.purchasePrice) : null,
      construction_year: a.constructionYear != null && a.constructionYear !== '' ? parseInt(a.constructionYear, 10) : null,
      notary_fees: a.notaryFees != null && a.notaryFees !== '' ? parseFloat(a.notaryFees) : 0,
      agency_fees: a.agencyFees != null && a.agencyFees !== '' ? parseFloat(a.agencyFees) : 0,
      works_fees: a.worksFees != null && a.worksFees !== '' ? parseFloat(a.worksFees) : 0,
      furniture_fees: a.furnitureFees != null && a.furnitureFees !== '' ? parseFloat(a.furnitureFees) : 0,
    },
  };
};

const liabilityToWealthItem = (l) => {
  const subtype = BACKEND_TO_SUBTYPE[l.type] || 'other_loan';
  return {
    id: `liability:${l.id}`,
    sourceTable: 'liability',
    sourceId: l.id,
    category: 'emprunts',
    subtype,
    name: l.name,
    currency: l.currency || 'EUR',
    value: parseFloat(l.remainingCapital ?? 0),
    syncMode: 'manual',
    memberIds: l.memberIds || [],
    meta: {
      initialCapital: l.initialCapital,
      monthlyPayment: l.monthlyPayment,
      interestRate: l.interestRate,
      endDate: l.endDate,
      linkedAssetId: l.linkedAssetId,
    },
  };
};

/**
 * @param {{accounts: Array, assets: Array, liabilities: Array, accountBalances?: Object}} sources
 * @returns {WealthItem[]}
 */
export function useWealthItems({ accounts, assets, liabilities, accountBalances }) {
  return useMemo(() => {
    const out = [];
    (accounts || []).forEach(a => out.push(accountToWealthItem(a, accountBalances)));

    // Group child assets by parent_asset_id so the parent can render its
    // imported positions and we skip the children at the top level (no
    // double-counting). Children appear only inside the parent drawer.
    const childrenByParent = {};
    (assets || []).forEach(a => {
      if (a.parentAssetId) {
        (childrenByParent[a.parentAssetId] = childrenByParent[a.parentAssetId] || []).push(a);
      }
    });
    (assets || []).forEach(a => {
      if (a.parentAssetId) return; // skip — surfaced inside the parent
      out.push(assetToWealthItem(a, childrenByParent[a.id] || []));
    });

    (liabilities || []).forEach(l => out.push(liabilityToWealthItem(l)));
    return out;
  }, [accounts, assets, liabilities, accountBalances]);
}
