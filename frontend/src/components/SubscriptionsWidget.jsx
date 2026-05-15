import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';

// "Mes abonnements" — lists all transactions whose category is `subscriptions`
// or has parent_slug = 'subscriptions'. Groups by merchant (label), shows
// monthly cadence + total per month + overall yearly cost.
//
// Detection logic:
//  - Category in subscriptions tree (top or sub) → always included
//  - Recurring detection (recurringIds) on labels that look like services
//    → surfaced as "non-tagged" candidates the user can promote
export function SubscriptionsWidget({ transactions, categories, recurringIds, fmt }) {
  const subscriptionsRoot = 'subscriptions';
  const subSlugs = useMemo(() => {
    const set = new Set([subscriptionsRoot]);
    categories.forEach(c => {
      if (c.parent === subscriptionsRoot || c.parent_slug === subscriptionsRoot) set.add(c.id);
    });
    // Legacy slugs that map to subscriptions
    ['streaming', 'sport', 'subs_video', 'subs_music', 'subs_cloud', 'subs_gym', 'subs_press', 'subs_services'].forEach(s => set.add(s));
    return set;
  }, [categories]);

  const grouped = useMemo(() => {
    // Take last 6 months of transactions
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const byMerchant = new Map();
    transactions.forEach(t => {
      if (t.amount >= 0) return;
      if (t.date < cutoffStr) return;
      if (!subSlugs.has(t.categoryId)) return;
      const key = normalizeMerchant(t.label || 'Sans libellé');
      if (!byMerchant.has(key)) {
        byMerchant.set(key, { merchant: key, txs: [], categoryId: t.categoryId, total: 0 });
      }
      const g = byMerchant.get(key);
      g.txs.push(t);
      g.total += Math.abs(t.amount);
    });

    const results = [];
    byMerchant.forEach(g => {
      if (g.txs.length < 2) return; // need at least 2 occurrences to be recurring
      const monthly = g.total / 6; // averaged over 6 months
      results.push({
        ...g,
        monthly,
        yearly: monthly * 12,
        count: g.txs.length,
        cat: categories.find(c => c.id === g.categoryId),
      });
    });
    return results.sort((a, b) => b.monthly - a.monthly);
  }, [transactions, subSlugs, categories]);

  const totalMonthly = grouped.reduce((s, g) => s + g.monthly, 0);
  const totalYearly = totalMonthly * 12;

  if (grouped.length === 0) {
    return (
      <div className="subs-widget-empty">
        <Sparkles size={16} style={{ color: 'var(--accent)' }}/>
        <span>Aucun abonnement détecté. Catégorise une transaction en <em>Abonnements</em> ou un de ses sous-types pour la voir ici.</span>
      </div>
    );
  }

  return (
    <div className="subs-widget">
      <SubsWidgetStyles/>
      <div className="subs-widget-head">
        <div>
          <div className="subs-widget-title">Mes abonnements <span className="subs-widget-count">{grouped.length}</span></div>
          <div className="subs-widget-sub num">{fmt(totalMonthly)} / mois · {fmt(totalYearly)} / an</div>
        </div>
      </div>
      <div className="subs-widget-list">
        {grouped.map(g => (
          <div key={g.merchant} className="subs-row">
            <div className="subs-row-icon" style={{ background: (g.cat?.color || '#999') + '22', color: g.cat?.color }}>
              {g.cat?.icon || '📱'}
            </div>
            <div className="subs-row-info">
              <div className="subs-row-merchant">{g.merchant}</div>
              <div className="subs-row-meta">{g.cat?.name || 'Abonnements'} · {g.count}× sur 6 mois</div>
            </div>
            <div className="subs-row-amount">
              <div className="subs-row-monthly num">{fmt(g.monthly)} / mois</div>
              <div className="subs-row-yearly num">{fmt(g.yearly)} / an</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Strip FR banking prefixes + payment processors (PayPal, Stripe…) and pick
// the merchant token. Keeps "NESPRESSO" instead of "PAYPAL" for "PAYPAL *NESPRESSO".
function normalizeMerchant(label) {
  const PROCESSORS = ['paypal', 'sumup', 'adyen', 'stripe', 'square', 'payplug', 'lyfpay', 'alma', 'klarna', 'paylib', 'lydia', 'qonto', 'shopify', 'wise', 'apple pay', 'google pay'];
  const procRe = new RegExp(`\\b(${PROCESSORS.join('|')})\\b\\s*\\*+\\s*`, 'gi');
  const stripped = label
    .replace(/^(paiement par carte|prélèvement|prelevement|virement émis|virement emis|paiement|achat cb)\s+/i, '')
    .replace(/PAIEMENT PAR CARTE\s+[Xx]?\d{4,}\**\s*/gi, '')
    .replace(procRe, '')
    .replace(/^[*\s]+/, '')
    .replace(/\s+\d{2}\/\d{2}(\/\d{2,4})?(\s|$).*$/g, '')
    .replace(/\s+(LU|FR|EN|US|GB|DE|ES|IT|BE|CH|NL|IE)\b.*$/i, '')
    .replace(/\s+\d{4,}.*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return stripped.length > 30 ? stripped.slice(0, 30) + '…' : stripped;
}

function SubsWidgetStyles() {
  return (
    <style>{`
      .subs-widget { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; }
      .subs-widget-empty { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 12px; padding: 18px; display: flex; gap: 10px; align-items: flex-start; font-size: 13px; color: var(--ink-2); }
      .subs-widget-empty em { color: var(--accent); font-style: italic; }
      .subs-widget-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
      .subs-widget-title { font-size: 14px; font-weight: 500; color: var(--ink); }
      .subs-widget-count { background: var(--accent-soft); color: var(--accent); border-radius: 8px; padding: 1px 6px; font-size: 11px; margin-left: 4px; font-variant-numeric: tabular-nums; }
      .subs-widget-sub { font-size: 12px; color: var(--ink-3); margin-top: 2px; letter-spacing: 0.02em; }
      .subs-widget-list { display: flex; flex-direction: column; gap: 0; }
      .subs-row { display: grid; grid-template-columns: 32px 1fr auto; gap: 12px; align-items: center; padding: 10px 0; border-top: 1px solid var(--border); }
      .subs-row:first-child { border-top: none; }
      .subs-row-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
      .subs-row-merchant { font-size: 13px; color: var(--ink); font-weight: 500; }
      .subs-row-meta { font-size: 11px; color: var(--ink-3); margin-top: 1px; }
      .subs-row-amount { text-align: right; }
      .subs-row-monthly { font-size: 13px; color: var(--ink); font-variant-numeric: tabular-nums; }
      .subs-row-yearly { font-size: 11px; color: var(--ink-3); margin-top: 1px; font-variant-numeric: tabular-nums; }
    `}</style>
  );
}
