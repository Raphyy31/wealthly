// ============================================================================
// Recurring — vue dédiée à toutes les charges récurrentes du foyer.
//
// Alimentée par recurringGroups (utils.detectRecurring) : marchands matchant
// au moins 2 occurrences sur 2 mois différents, mêmes label+montant ±10€.
//
// Différent de SubscriptionsWidget (Mois type) qui ne montre QUE la branche
// 'subscriptions'. Ici on a TOUT : loyer, mutuelle, assurances, électricité,
// abonnements, prêts… Tout ce qui revient chaque mois.
// ============================================================================
import { useMemo, useState } from 'react';
import { Activity, Search, ArrowUpDown, X } from 'lucide-react';
import { CategoryDropdown } from '../components/CategoryDropdown.jsx';


export function Recurring({ recurringGroups = [], categories = [], accounts = [], fmt, transactions = [], setView, setInitialAccountFilter }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('yearly');  // yearly | monthly | count | last
  const [sortDir, setSortDir] = useState('desc');
  const [filterCat, setFilterCat] = useState('all');

  const enriched = useMemo(() => {
    return recurringGroups.map(g => {
      const cat = categories.find(c => c.id === g.categoryId);
      const topCat = cat?.parent ? categories.find(c => c.id === cat.parent) : cat;
      const acc = accounts.find(a => a.id === g.accountId);
      const monthly = Math.abs(g.avgAmount);
      return {
        ...g,
        cat,
        topCat,
        acc,
        monthly,
        yearly: monthly * 12,
      };
    });
  }, [recurringGroups, categories, accounts]);

  const filtered = useMemo(() => {
    let list = enriched;
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter(g =>
        (g.label || '').toLowerCase().includes(q)
        || (g.cat?.name || '').toLowerCase().includes(q)
        || (g.topCat?.name || '').toLowerCase().includes(q)
      );
    }
    if (filterCat !== 'all') {
      list = list.filter(g => g.cat?.id === filterCat || g.topCat?.id === filterCat);
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'yearly') cmp = a.yearly - b.yearly;
      else if (sortKey === 'monthly') cmp = a.monthly - b.monthly;
      else if (sortKey === 'count') cmp = a.count - b.count;
      else if (sortKey === 'last') cmp = (a.lastDate || '').localeCompare(b.lastDate || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [enriched, search, filterCat, sortKey, sortDir]);

  const totalMonthly = filtered.reduce((s, g) => s + g.monthly, 0);
  const totalYearly = totalMonthly * 12;

  const topLevelCats = useMemo(
    () => categories.filter(c => !c.parent && c.id !== 'uncategorized'),
    [categories]
  );

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const goToTxs = (g) => {
    if (setInitialAccountFilter && g.accountId) setInitialAccountFilter(g.accountId);
    if (setView) setView('transactions');
  };

  return (
    <div className="rec-view">
      <div className="subview-header">
        <div>
          <h1>Vos <em>charges récurrentes.</em></h1>
          <p>Tous les paiements identifiés comme revenant régulièrement — abonnements, loyer, assurances, prêts.</p>
        </div>
      </div>

      {/* Hero summary */}
      <div className="rec-hero">
        <div className="rec-hero-stat">
          <span className="rec-hero-label">Mensuel total</span>
          <span className="rec-hero-value num">{fmt(totalMonthly)}</span>
        </div>
        <div className="rec-hero-divider"/>
        <div className="rec-hero-stat">
          <span className="rec-hero-label">Annuel projeté</span>
          <span className="rec-hero-value num">{fmt(totalYearly)}</span>
        </div>
        <div className="rec-hero-divider"/>
        <div className="rec-hero-stat">
          <span className="rec-hero-label">Marchands suivis</span>
          <span className="rec-hero-value num">{filtered.length}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="rec-toolbar">
        <div className="search-box">
          <Search size={16}/>
          <input
            placeholder="Rechercher un marchand…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="icon-btn-sm" onClick={() => setSearch('')}><X size={13}/></button>}
        </div>
        <div style={{ minWidth: 200 }}>
          <CategoryDropdown
            value={filterCat === 'all' ? '' : filterCat}
            categories={categories.filter(c => c.id !== 'uncategorized')}
            onChange={(v) => setFilterCat(v || 'all')}
            placeholder="Toutes catégories"
            grouped
            emptyLabel="Toutes catégories"
          />
        </div>
        <span className="result-count">{filtered.length} récurrent{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rec-empty">
          <Activity size={32}/>
          <h3>Aucune charge récurrente détectée pour l'instant</h3>
          <p>Importe au moins 2 mois de transactions pour que Wealthly puisse détecter les paiements qui reviennent (loyer, abonnements, prêts…).</p>
        </div>
      ) : (
        <div className="rec-table">
          <div className="rec-header">
            <div className="rec-th">Marchand</div>
            <div className="rec-th">Catégorie</div>
            <div className="rec-th sortable" onClick={() => toggleSort('count')}>
              Fréquence <ArrowUpDown size={11}/>
            </div>
            <div className="rec-th right sortable" onClick={() => toggleSort('monthly')}>
              Moyen / mois <ArrowUpDown size={11}/>
            </div>
            <div className="rec-th right sortable" onClick={() => toggleSort('yearly')}>
              Annuel <ArrowUpDown size={11}/>
            </div>
            <div className="rec-th sortable" onClick={() => toggleSort('last')}>
              Dernier <ArrowUpDown size={11}/>
            </div>
          </div>
          <div className="rec-body">
            {filtered.map(g => {
              const tileBg = (g.topCat?.color || '#9ca3af') + '22';
              const tileFg = g.topCat?.color || '#6b7280';
              return (
                <div key={g.key} className="rec-row" onClick={() => goToTxs(g)}>
                  <div className="rec-merchant">
                    <span className="rec-icon" style={{ background: tileBg, color: tileFg }}>
                      {g.topCat?.icon || '🔁'}
                    </span>
                    <div className="rec-merchant-text">
                      <span className="rec-merchant-name">{g.label || 'Sans libellé'}</span>
                      {g.acc && <span className="rec-merchant-acc">{g.acc.bank || g.acc.name}</span>}
                    </div>
                  </div>
                  <div className="rec-cat">
                    {g.topCat ? (
                      <span className="rec-cat-pill" style={{ background: (g.topCat.color || '#999') + '22', color: g.topCat.color || 'var(--ink-2)' }}>
                        {g.topCat.name}
                      </span>
                    ) : <span className="rec-cat-empty">—</span>}
                    {g.cat?.parent && g.cat?.id !== g.topCat?.id && (
                      <span className="rec-cat-sub">{g.cat.icon} {g.cat.name}</span>
                    )}
                  </div>
                  <div className="rec-freq">
                    {g.count}× <span className="rec-freq-meta">sur {g.months} mois</span>
                  </div>
                  <div className="rec-amount num right">{fmt(-g.monthly)}</div>
                  <div className="rec-amount-year num right">{fmt(-g.yearly)}</div>
                  <div className="rec-last">{g.lastDate?.slice(5) || '—'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
