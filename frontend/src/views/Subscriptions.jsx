// ============================================================================
// Subscriptions — met en scène l'argument de vente : « rentabilisé dès la 1re
// résiliation ». Détecte les abonnements récurrents sur 6 mois, chiffre le
// coût annuel, repère les hausses, et calcule les économies si l'utilisateur
// marque des abos « à résilier ».
//
// Deux variantes :
//   <SubscriptionsView/>     — écran plein (nav)
//   <SubscriptionsSummary/>  — bloc compact (Mensuel)
// ============================================================================
import { useMemo, useState, useEffect, useRef } from 'react';
import { Sparkles, Lightbulb, TrendingUp, ArrowRight, Check } from 'lucide-react';
import { gsap } from '../utils/gsapSetup.js';
import { usePageEnter } from '../hooks/usePageEnter.js';

const SUB_ROOT = 'subscriptions';
const LEGACY_SUB_SLUGS = ['streaming', 'sport', 'subs_video', 'subs_music', 'subs_cloud', 'subs_gym', 'subs_press', 'subs_services'];
const CANCEL_LS = 'yotori:subsCancel';

const EUR0 = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(v || 0));

// Strip FR banking prefixes + payment processors, pick the merchant token.
function normalizeMerchant(label) {
  const PROCESSORS = ['paypal', 'sumup', 'adyen', 'stripe', 'square', 'payplug', 'lyfpay', 'alma', 'klarna', 'paylib', 'lydia', 'qonto', 'shopify', 'wise', 'apple pay', 'google pay'];
  const procRe = new RegExp(`\\b(${PROCESSORS.join('|')})\\b\\s*\\*+\\s*`, 'gi');
  const stripped = (label || 'Sans libellé')
    .replace(/^(paiement par carte|prélèvement|prelevement|virement émis|virement emis|paiement|achat cb)\s+/i, '')
    .replace(/PAIEMENT PAR CARTE\s+[Xx]?\d{4,}\**\s*/gi, '')
    .replace(procRe, '')
    .replace(/^[*\s]+/, '')
    .replace(/\s+\d{2}\/\d{2}(\/\d{2,4})?(\s|$).*$/g, '')
    .replace(/\s+(LU|FR|EN|US|GB|DE|ES|IT|BE|CH|NL|IE)\b.*$/i, '')
    .replace(/\s+\d{4,}.*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const out = stripped.length > 28 ? stripped.slice(0, 28) + '…' : stripped;
  // Title-case pour l'affichage (les libellés bancaires sont souvent en CAPS).
  return out.replace(/\b\w/g, c => c.toUpperCase()).replace(/\B\w/g, c => c.toLowerCase());
}

/** Détecte les abonnements depuis les transactions des 6 derniers mois. */
export function detectSubscriptions(transactions, categories) {
  const subSlugs = new Set([SUB_ROOT, ...LEGACY_SUB_SLUGS]);
  categories.forEach(c => {
    if (c.parent === SUB_ROOT || c.parent_slug === SUB_ROOT) subSlugs.add(c.id);
  });

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const byMerchant = new Map();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    if ((t.date || '') < cutoffStr) continue;
    if (!subSlugs.has(t.categoryId)) continue;
    const key = normalizeMerchant(t.label);
    if (!byMerchant.has(key)) byMerchant.set(key, { merchant: key, txs: [], categoryId: t.categoryId, total: 0 });
    const g = byMerchant.get(key);
    g.txs.push(t);
    g.total += Math.abs(t.amount);
  }

  const results = [];
  byMerchant.forEach(g => {
    if (g.txs.length < 2) return;
    const sorted = [...g.txs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const monthly = g.total / 6;
    // Hausse : dernier prélèvement > moyenne des précédents × 1.08
    const last = Math.abs(sorted[0].amount || 0);
    const priors = sorted.slice(1).map(t => Math.abs(t.amount || 0));
    const priorAvg = priors.length ? priors.reduce((s, v) => s + v, 0) / priors.length : last;
    const hike = priorAvg > 0 && last > priorAvg * 1.08 ? last - priorAvg : 0;
    results.push({
      ...g,
      monthly,
      yearly: monthly * 12,
      count: g.txs.length,
      lastDate: sorted[0].date,
      hike,
      cat: categories.find(c => c.id === g.categoryId),
    });
  });
  return results.sort((a, b) => b.monthly - a.monthly);
}

function readCancelSet() {
  try { return new Set(JSON.parse(localStorage.getItem(CANCEL_LS) || '[]')); } catch { return new Set(); }
}
function writeCancelSet(set) {
  try { localStorage.setItem(CANCEL_LS, JSON.stringify([...set])); } catch { /* ignore */ }
}

// ─── Écran plein ────────────────────────────────────────────────────────────
export function SubscriptionsView({ transactions = [], categories = [], fmt, onGoTransactions }) {
  const subs = useMemo(() => detectSubscriptions(transactions, categories), [transactions, categories]);
  const [cancelled, setCancelled] = useState(() => readCancelSet());
  const rootRef = usePageEnter();
  const listRef = useRef(null);

  const totalMonthly = subs.reduce((s, x) => s + x.monthly, 0);
  const totalYearly = totalMonthly * 12;
  const savedYearly = subs.filter(x => cancelled.has(x.merchant)).reduce((s, x) => s + x.yearly, 0);
  const hikeCount = subs.filter(x => x.hike > 0).length;

  const toggle = (merchant) => {
    setCancelled(prev => {
      const next = new Set(prev);
      if (next.has(merchant)) next.delete(merchant); else next.add(merchant);
      writeCancelSet(next);
      return next;
    });
  };

  // Stagger d'entrée des lignes (GSAP).
  useEffect(() => {
    if (!listRef.current) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const rows = listRef.current.querySelectorAll('.sub-row');
    gsap.fromTo(rows, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'expo.out', stagger: 0.04, clearProps: 'transform' });
  }, [subs.length]);

  return (
    <div className="subs-view" ref={rootRef}>
      <div className="subview-header" data-reveal>
        <div>
          <h1>Vos <em>abonnements.</em></h1>
          <p>Tout ce qui se prélève automatiquement — et ce que vous pouvez récupérer.</p>
        </div>
      </div>

      {subs.length === 0 ? (
        <div className="subs-empty card" data-reveal>
          <Sparkles size={22} style={{ color: 'var(--accent)' }}/>
          <h3>Aucun abonnement détecté pour l'instant.</h3>
          <p>Catégorisez quelques transactions en <em>Abonnements</em> (Netflix, salle de sport, cloud…) et revenez ici : Yotori Finance chiffrera ce qu'ils vous coûtent et ce que vous pouvez économiser.</p>
        </div>
      ) : (
        <>
          {/* Hero — le chiffre qui fait agir */}
          <section className="subs-hero" data-reveal>
            <div className="subs-hero-eyebrow">Tes abonnements te coûtent</div>
            <div className="subs-hero-row">
              <span className="subs-hero-num num">{EUR0(totalYearly)}</span>
              <span className="subs-hero-meta">/ an · soit {EUR0(totalMonthly)}/mois · {subs.length} actifs</span>
            </div>
            <div className="subs-hero-proof">
              <Lightbulb size={20}/>
              <div>
                {savedYearly > 0 ? (
                  <>En résiliant ce que vous avez marqué, vous économisez <strong>{EUR0(savedYearly)}/an</strong>. <span className="subs-hero-proof-soft">Yotori Finance est remboursé en {savedYearly >= 180 ? 'moins d\'un mois' : `${Math.max(1, Math.round(180 / Math.max(1, savedYearly) * 12))} mois`}.</span></>
                ) : (
                  <>Marquez les abonnements dont vous n'avez plus besoin : <strong>une seule résiliation</strong> rembourse souvent l'abonnement Yotori Finance pour l'année.</>
                )}
              </div>
            </div>
          </section>

          {/* Liste */}
          <section className="subs-list" ref={listRef} data-reveal>
            {subs.map(s => {
              const isCancel = cancelled.has(s.merchant);
              return (
                <div key={s.merchant} className={`sub-row ${isCancel ? 'is-cancel' : ''}`}>
                  <span className="sub-row-icon" style={{ background: (s.cat?.color || '#999') + '22', color: s.cat?.color || 'var(--ink-2)' }}>
                    {s.cat?.icon || '📱'}
                  </span>
                  <div className="sub-row-info">
                    <div className="sub-row-merchant">
                      {s.merchant}
                      {s.hike > 0 && <span className="sub-row-hike"><TrendingUp size={11}/> +{EUR0(s.hike)} ce mois</span>}
                    </div>
                    <div className="sub-row-meta">{s.cat?.name || 'Abonnements'} · vu {s.count}× sur 6 mois</div>
                  </div>
                  <div className="sub-row-amount">
                    <div className="sub-row-monthly num">{EUR0(s.monthly)}/mois</div>
                    <div className="sub-row-yearly num">{EUR0(s.yearly)}/an</div>
                  </div>
                  <button
                    className={`sub-row-cta ${isCancel ? 'is-on' : ''}`}
                    onClick={() => toggle(s.merchant)}
                    aria-pressed={isCancel}
                  >
                    {isCancel ? <><Check size={14}/> À résilier</> : 'À résilier ?'}
                  </button>
                </div>
              );
            })}
          </section>

          {onGoTransactions && (
            <button className="subs-candidates" onClick={onGoTransactions} data-reveal>
              <div>
                <strong>Des prélèvements oubliés ?</strong>
                <span>Catégorisez vos transactions récurrentes pour qu'elles apparaissent ici.</span>
              </div>
              <ArrowRight size={16}/>
            </button>
          )}
        </>
      )}
      <SubsStyles/>
    </div>
  );
}

// ─── Bloc résumé (Mensuel) ───────────────────────────────────────────────────
export function SubscriptionsSummary({ transactions = [], categories = [], onOpen }) {
  const subs = useMemo(() => detectSubscriptions(transactions, categories), [transactions, categories]);
  if (subs.length === 0) return null;
  const totalMonthly = subs.reduce((s, x) => s + x.monthly, 0);
  const hikeCount = subs.filter(x => x.hike > 0).length;

  return (
    <section className="subs-summary card" data-reveal>
      <SubsStyles/>
      <div className="subs-summary-row">
        <div>
          <div className="subs-summary-eyebrow">Tes abonnements</div>
          <div className="subs-summary-amount">
            <span className="num">{EUR0(totalMonthly)}</span>
            <span className="subs-summary-meta">/ mois · {subs.length} actifs</span>
          </div>
        </div>
        <button className="subs-summary-cta" onClick={onOpen}>Voir &amp; optimiser <ArrowRight size={14}/></button>
      </div>
      <div className="subs-summary-badges">
        <span className="subs-summary-pill yearly">{EUR0(totalMonthly * 12)}/an au total</span>
        {hikeCount > 0 && <span className="subs-summary-pill hike">{hikeCount} en hausse ce mois</span>}
      </div>
    </section>
  );
}

function SubsStyles() {
  return (
    <style>{`
      .subs-view { display: flex; flex-direction: column; gap: 18px; }
      .subs-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 36px 24px; }
      .subs-empty h3 { margin: 4px 0 0; font: 500 17px var(--font-sans); }
      .subs-empty p { margin: 0; max-width: 460px; color: var(--ink-2); font-size: 13.5px; line-height: 1.55; }
      .subs-empty em { font-style: italic; color: var(--accent); }

      .subs-hero {
        background: linear-gradient(135deg, color-mix(in oklab, var(--accent) 10%, transparent), color-mix(in oklab, var(--accent) 2%, transparent));
        border: 1px solid color-mix(in oklab, var(--accent) 25%, transparent);
        border-radius: 16px; padding: 22px 24px;
      }
      .subs-hero-eyebrow { font: 500 12px var(--font-sans); text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent-2, var(--accent)); }
      .subs-hero-row { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
      .subs-hero-num { font: italic 400 44px/1 var(--font-serif, Newsreader); color: var(--accent-2, var(--accent)); font-variant-numeric: tabular-nums; }
      .subs-hero-meta { font-size: 15px; color: var(--ink-2); }
      .subs-hero-proof { display: flex; align-items: center; gap: 12px; margin-top: 16px; padding: 12px 16px; background: var(--bg-card); border-radius: 12px; font-size: 14px; line-height: 1.5; }
      .subs-hero-proof svg { flex-shrink: 0; color: var(--accent); }
      .subs-hero-proof strong { color: var(--accent-2, var(--accent)); }
      .subs-hero-proof-soft { color: var(--ink-2); }

      .subs-list { display: flex; flex-direction: column; gap: 8px; }
      .sub-row {
        display: flex; align-items: center; gap: 14px;
        padding: 13px 16px; background: var(--bg-elev);
        border: 1px solid var(--border); border-radius: 12px;
        transition: border-color .15s, box-shadow .15s, opacity .15s;
      }
      .sub-row:hover { box-shadow: 0 4px 14px -8px rgba(0,0,0,0.12); }
      .sub-row.is-cancel { border-color: color-mix(in oklab, var(--negative) 40%, transparent); background: color-mix(in oklab, var(--negative) 5%, var(--bg-elev)); }
      .sub-row-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
      .sub-row-info { flex: 1; min-width: 0; }
      .sub-row-merchant { font: 500 15px var(--font-sans); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .sub-row-hike { display: inline-flex; align-items: center; gap: 3px; font: 500 10.5px var(--font-sans); padding: 2px 7px; border-radius: 999px; background: var(--warning-soft); color: var(--warning); }
      .sub-row-meta { font-size: 12px; color: var(--ink-3); margin-top: 2px; }
      .sub-row-amount { text-align: right; flex-shrink: 0; }
      .sub-row-monthly { font: 500 14px var(--font-sans); font-variant-numeric: tabular-nums; }
      .sub-row-yearly { font-size: 12px; color: var(--ink-3); font-variant-numeric: tabular-nums; margin-top: 1px; }
      .sub-row-cta {
        flex-shrink: 0; padding: 8px 14px; border-radius: 999px;
        font: 500 12.5px var(--font-sans); cursor: pointer; white-space: nowrap;
        border: 1.5px solid var(--border-strong); background: transparent; color: var(--ink-2);
        display: inline-flex; align-items: center; gap: 5px;
        transition: all .15s;
      }
      .sub-row-cta:hover { border-color: var(--negative); color: var(--negative); }
      .sub-row-cta.is-on { background: var(--negative); border-color: var(--negative); color: #fff; }

      .subs-candidates {
        display: flex; align-items: center; justify-content: space-between; gap: 14px;
        padding: 16px 18px; border: 1px dashed var(--border-strong); border-radius: 12px;
        background: var(--bg-sunk); cursor: pointer; text-align: left; color: var(--ink);
        font-family: var(--font-sans); transition: border-color .15s;
      }
      .subs-candidates:hover { border-color: var(--accent); }
      .subs-candidates strong { display: block; font-size: 14px; }
      .subs-candidates span { font-size: 12.5px; color: var(--ink-3); }
      .subs-candidates svg { color: var(--accent); flex-shrink: 0; }

      /* Bloc résumé (Mensuel) */
      .subs-summary {
        background: linear-gradient(135deg, color-mix(in oklab, var(--accent) 8%, transparent), color-mix(in oklab, var(--accent) 1%, transparent)) !important;
        border-color: color-mix(in oklab, var(--accent) 22%, transparent) !important;
      }
      .subs-summary-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .subs-summary-eyebrow { font: 500 11px var(--font-sans); text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-2, var(--accent)); }
      .subs-summary-amount { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; }
      .subs-summary-amount .num { font: 500 22px var(--font-sans); font-variant-numeric: tabular-nums; }
      .subs-summary-meta { font-size: 13px; color: var(--ink-2); }
      .subs-summary-cta { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 999px; background: var(--accent); color: var(--on-accent, #fff); border: none; font: 500 13px var(--font-sans); cursor: pointer; white-space: nowrap; transition: filter .15s; }
      .subs-summary-cta:hover { filter: brightness(1.06); }
      .subs-summary-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
      .subs-summary-pill { font: 500 12px var(--font-sans); padding: 4px 10px; border-radius: 999px; }
      .subs-summary-pill.yearly { background: var(--accent-soft); color: var(--accent-2, var(--accent)); }
      .subs-summary-pill.hike { background: var(--warning-soft); color: var(--warning); }
    `}</style>
  );
}
