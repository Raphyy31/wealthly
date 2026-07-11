import { useMemo } from 'react';
import { CheckCircle2, ChevronRight, Landmark, Tags, WalletCards } from 'lucide-react';

const isRateLimited = (message) => /(?:^|\s)429(?:\s|:)|temporairement.*d[ée]bord|limite de rafra[iî]chissement|quota.*banque/i.test(String(message || ''));

export function needsTransactionReview(tx, transferIds = new Set()) {
  if (!tx || transferIds.has(tx.id)) return false;
  if (tx.reviewStatus === 'reviewed') return false;
  return tx.reviewStatus === 'pending'
    || !tx.categoryId
    || tx.categoryId === 'uncategorized'
    || tx.catSource === 'unknown';
}

export function ActionCenter({
  transactions = [],
  transferIds = new Set(),
  bankConnections = [],
  budgets = {},
  categoryAnalysis = {},
  onReview,
  onBanks,
  onBudget,
}) {
  const actions = useMemo(() => {
    const reviewCount = transactions.filter(tx => needsTransactionReview(tx, transferIds)).length;
    const neverSynced = bankConnections.filter(c => c.status === 'authorized' && !c.last_synced_at).length;
    const brokenBanks = bankConnections.filter(c => ['error', 'expired', 'suspended'].includes(c.status)).length;
    const limitedBanks = bankConnections.filter(c => isRateLimited(c.error_message)).length;
    const overBudget = Object.entries(budgets).filter(([id, amount]) => (categoryAnalysis[id]?.current || 0) > Number(amount || 0)).length;

    const result = [];
    if (reviewCount > 0) {
      result.push({
        id: 'review', icon: Tags, tone: 'warning',
        title: `${reviewCount} transaction${reviewCount > 1 ? 's' : ''} à vérifier`,
        detail: 'Validez les propositions pour améliorer les prochains classements.',
        cta: 'Vérifier', onClick: onReview,
      });
    }
    if (brokenBanks > 0 || neverSynced > 0) {
      const count = brokenBanks + neverSynced;
      result.push({
        id: 'banks', icon: Landmark, tone: brokenBanks ? 'danger' : 'warning',
        title: `${count} connexion${count > 1 ? 's' : ''} bancaire${count > 1 ? 's' : ''} demande${count > 1 ? 'nt' : ''} ton attention`,
        detail: brokenBanks ? 'Une reconnexion peut être nécessaire.' : 'La première récupération des opérations n’est pas terminée.',
        cta: 'Voir les banques', onClick: onBanks,
      });
    } else if (limitedBanks > 0) {
      result.push({
        id: 'limited', icon: Landmark, tone: 'neutral',
        title: 'Mises à jour bancaires temporairement en pause',
        detail: 'Tes dernières données sont conservées. Yotori Finance réessaiera automatiquement.',
        cta: 'Voir l’état', onClick: onBanks,
      });
    }
    if (overBudget > 0) {
      result.push({
        id: 'budget', icon: WalletCards, tone: 'danger',
        title: `${overBudget} budget${overBudget > 1 ? 's' : ''} dépassé${overBudget > 1 ? 's' : ''}`,
        detail: 'Consulte les catégories concernées et ajuste la fin du mois.',
        cta: 'Voir le budget', onClick: onBudget,
      });
    }
    return result;
  }, [transactions, transferIds, bankConnections, budgets, categoryAnalysis, onReview, onBanks, onBudget]);

  return (
    <section className={`action-center ${actions.length === 0 ? 'is-clear' : ''}`} aria-label="Actions à effectuer">
      <div className="action-center-head">
        <div>
          <span className="action-center-kicker">À faire maintenant</span>
          <h2>{actions.length > 0 ? `${actions.length} point${actions.length > 1 ? 's' : ''} à traiter` : 'Tout est en ordre'}</h2>
        </div>
        {actions.length === 0 && <CheckCircle2 size={20}/>} 
      </div>
      {actions.length === 0 ? (
        <p className="action-center-clear">Comptes à jour, transactions classées et aucun budget dépassé.</p>
      ) : (
        <div className="action-center-list">
          {actions.map(action => {
            const Icon = action.icon;
            return (
              <button key={action.id} type="button" className={`action-center-row tone-${action.tone}`} onClick={action.onClick}>
                <span className="action-center-icon"><Icon size={16}/></span>
                <span className="action-center-copy">
                  <strong>{action.title}</strong>
                  <small>{action.detail}</small>
                </span>
                <span className="action-center-cta">{action.cta}<ChevronRight size={14}/></span>
              </button>
            );
          })}
        </div>
      )}
      <style>{`
        .action-center{border:1px solid var(--border);background:var(--bg-elev);border-radius:12px;padding:18px;margin:18px 0;box-shadow:var(--shadow-sm)}
        .action-center.is-clear{background:color-mix(in srgb,var(--positive) 5%,var(--bg-elev));border-color:color-mix(in srgb,var(--positive) 22%,var(--border))}
        .action-center-head{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--positive)}
        .action-center-kicker{display:block;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--ink-3);font-weight:600;margin-bottom:3px}
        .action-center h2{font-size:17px;line-height:1.2;color:var(--ink);margin:0;font-weight:600}
        .action-center-clear{margin:10px 0 0;color:var(--ink-2);font-size:12.5px}
        .action-center-list{display:grid;gap:7px;margin-top:14px}
        .action-center-row{width:100%;border:1px solid var(--border);background:var(--bg);border-radius:9px;padding:11px 12px;display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:10px;text-align:left;color:var(--ink);cursor:pointer;transition:transform .16s ease,border-color .16s ease,background .16s ease}
        .action-center-row:hover{transform:translateY(-1px);border-color:var(--border-strong);background:var(--bg-elev)}
        .action-center-icon{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:var(--bg-sunk);color:var(--ink-2)}
        .tone-warning .action-center-icon{color:var(--warning);background:color-mix(in srgb,var(--warning) 11%,transparent)}
        .tone-danger .action-center-icon{color:var(--negative);background:color-mix(in srgb,var(--negative) 10%,transparent)}
        .action-center-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
        .action-center-copy strong{font-size:13px;font-weight:600}
        .action-center-copy small{font-size:11.5px;color:var(--ink-3);white-space:normal}
        .action-center-cta{display:flex;align-items:center;gap:3px;font-size:11.5px;color:var(--accent);white-space:nowrap;font-weight:600}
        @media(max-width:640px){.action-center{margin:12px 0;padding:14px}.action-center-row{grid-template-columns:30px minmax(0,1fr)}.action-center-cta{grid-column:2}.action-center-copy small{line-height:1.35}}
      `}</style>
    </section>
  );
}
