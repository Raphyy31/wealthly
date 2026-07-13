// ============================================================================
// MiniCashflowCard — vue cashflow du mois en cours, condensée pour Dashboard
//
// Sprint Dashboard 2026-05-20 — option (b) validée par user.
// 3 barres horizontales animées GSAP (income, expenses, saving) +
// click → Monthly. Replace l'ancien "Insights / Mes finances" générique.
//
// Visuel : palette papier-chaud, barres en flux gauche→droite, label montant
// en tabular nums. Plus dense qu'un Sankey complet, mais transmet la même
// idée (où va l'argent).
// ============================================================================
import { useEffect, useMemo, useRef } from 'react';
import { ArrowRight, ArrowDown, PiggyBank } from 'lucide-react';
import { gsap } from '../../utils/gsapSetup.js';

export function MiniCashflowCard({ thisMonthStats, onOpenMonthly, currentMonth, formatEUR, hidden }) {
  const rootRef = useRef(null);
  const income = Math.max(0, thisMonthStats?.income || 0);
  const funding = Math.max(0, thisMonthStats?.funding || 0);
  const resources = Math.max(0, thisMonthStats?.resources ?? (income + funding));
  const expenses = Math.max(0, thisMonthStats?.expenses || 0);
  // CHANTIER 2 — saving = vraie epargne (virements savings + cat=savings)
  // remontee par YotoriApp.monthlyEvolution. Avant : saving = income -
  // expenses (= reste a vivre), trompeur car comptait les virements savings
  // dans expenses ET produisait un deficit affiche en rouge alors que le
  // user avait justement epargne.
  const saving = thisMonthStats?.savings || 0;
  const maxVal = Math.max(resources, expenses, Math.abs(saving), 1);

  const rows = useMemo(() => [
    { key: 'income',   label: funding > 0 && income === 0 ? 'Financement' : 'Entrées', value: resources, tone: 'positive', icon: ArrowDown },
    { key: 'expenses', label: 'Sorties',  value: expenses, tone: 'negative', icon: ArrowRight },
    { key: 'saving',   label: 'Épargne',  value: saving,   tone: saving >= 0 ? 'accent' : 'negative', icon: PiggyBank },
  ], [income, funding, resources, expenses, saving]);

  // GSAP : entree en stagger des 3 barres, width tween 0 → final
  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.mcc-row',
        { opacity: 0, x: -8 },
        { opacity: 1, x: 0, duration: 0.36, ease: 'expo.out', stagger: 0.06, delay: 0.05 }
      );
      gsap.fromTo('.mcc-bar-fill',
        { width: '0%' },
        { width: (i, el) => el.dataset.target, duration: 0.72, ease: 'expo.out', stagger: 0.06, delay: 0.18 }
      );
    }, rootRef);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources, expenses, saving]);

  // Label mois lisible "Mai 2026"
  const monthLabel = useMemo(() => {
    if (!currentMonth) return '';
    const [y, m] = currentMonth.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1, 1);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }, [currentMonth]);

  return (
    <section className="mcc-card" ref={rootRef}>
      <div className="mcc-head">
        <div>
          <div className="dash-eyebrow">
            <span className="dash-eyebrow-label">Cashflow · {monthLabel}</span>
          </div>
          <h3 className="mcc-title">
            {(() => {
              const deficit = expenses - resources;
              // Pourcentage retire (user feedback 2026-05-21) : avec un income
              // tres faible (refunds only) le ratio donne des chiffres absurdes
              // type "13004 %". L'epargne brute parle deja toute seule.
              if (resources === 0 && expenses === 0 && saving === 0) {
                return <>Pas encore de mouvements ce mois-ci.</>;
              }
              if (saving > 0) {
                return <>Vous épargnez <em>{formatEUR(saving, { abbr: false })}</em>.</>;
              }
              if (deficit > 0) {
                return <>Solde provisoire de <em>−{formatEUR(deficit, { abbr: false })}</em>.</>;
              }
              if (resources - expenses > 0) {
                return <>Excédent de <em>{formatEUR(resources - expenses, { abbr: false })}</em> ce mois-ci.</>;
              }
              return <>Mois équilibré.</>;
            })()}
          </h3>
        </div>
        <button className="link-btn mcc-link" onClick={onOpenMonthly}>
          Voir le détail <ArrowRight size={12}/>
        </button>
      </div>
      <div className="mcc-rows">
        {rows.map(r => {
          const pct = maxVal > 0 ? Math.min(100, (Math.abs(r.value) / maxVal) * 100) : 0;
          const Icon = r.icon;
          return (
            <div key={r.key} className="mcc-row">
              <span className="mcc-row-label">
                <span className={`mcc-row-ic tone-${r.tone}`} aria-hidden="true">
                  <Icon size={11}/>
                </span>
                {r.label}
              </span>
              <span className="mcc-bar-track">
                <span
                  className={`mcc-bar-fill tone-${r.tone}`}
                  data-target={`${pct}%`}
                  style={{ width: 0 }}
                />
              </span>
              <span className={`mcc-row-val num tone-${r.tone}`}>
                {hidden
                  ? '···'
                  : (r.key === 'saving' && r.value < 0
                      ? '−' + formatEUR(Math.abs(r.value), { abbr: false })
                      : formatEUR(Math.abs(r.value), { abbr: false }))}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
