// ============================================================================
// FiftyThirtyTwentyModal — analyse comparative "Besoins / Envies / Épargne"
// vs cibles 50 / 30 / 20.
//
// Compare le Mois type (théorique) et le mois courant (réel). L'utilisateur
// voit immédiatement où il se situe et reçoit une reco actionnable.
// ============================================================================
import React, { useMemo } from 'react';
import { X, Target } from 'lucide-react';

// Fallback slugs used only when categories[] isn't available (e.g. legacy
// caller). With the categories list passed in, we read cat.kind which is the
// source of truth (incl. user-created categories — they pick needs/wants/
// savings in the create modal).
const NEEDS_CATS_FALLBACK = new Set([
  'housing', 'utilities', 'insurance', 'health', 'groceries', 'food',
  'children', 'transport', 'fuel', 'taxes',
]);
const SAVING_CATS_FALLBACK = new Set(['savings']);

function classify(catId, categories) {
  if (!catId) return 'wants';
  if (categories && categories.length) {
    const cat = categories.find(c => c.id === catId || c.slug === catId);
    if (cat?.kind === 'needs') return 'needs';
    if (cat?.kind === 'savings') return 'savings';
    if (cat?.kind === 'wants') return 'wants';
    // No kind set on the cat — fall back to slug heuristics below.
  }
  const slug = String(catId).toLowerCase();
  if (NEEDS_CATS_FALLBACK.has(slug)) return 'needs';
  if (SAVING_CATS_FALLBACK.has(slug)) return 'savings';
  return 'wants';
}

function bucketRefMonth(refMonth, categories) {
  const buckets = { needs: 0, wants: 0, savings: 0, income: 0 };
  for (const line of (refMonth?.lines || [])) {
    const amt = parseFloat(line.amount) || 0;
    if (line.kind === 'income') { buckets.income += amt; continue; }
    if (line.kind === 'saving') { buckets.savings += amt; continue; }
    // expense
    const b = classify(line.category_id, categories);
    if (b === 'savings') buckets.savings += amt;
    else if (b === 'needs') buckets.needs += amt;
    else buckets.wants += amt;
  }
  return buckets;
}

function bucketReal(fiftyThirtyTwenty) {
  // Reuse existing computation that lives in YotoriApp.
  return {
    needs: fiftyThirtyTwenty?.needs || 0,
    wants: fiftyThirtyTwenty?.wants || 0,
    savings: fiftyThirtyTwenty?.savings || 0,
    income: fiftyThirtyTwenty?.total || 0,
  };
}

function Bar({ label, buckets, fmt }) {
  const total = buckets.needs + buckets.wants + buckets.savings;
  if (!total) {
    return (
      <div className="ftt-bar-wrap">
        <div className="ftt-bar-label">{label}</div>
        <div className="ftt-bar empty"><span className="ds-micro">Pas de données</span></div>
      </div>
    );
  }
  const pct = (v) => Math.round((v / total) * 100);
  const pNeeds = pct(buckets.needs);
  const pWants = pct(buckets.wants);
  const pSavings = 100 - pNeeds - pWants;
  return (
    <div className="ftt-bar-wrap">
      <div className="ftt-bar-label">{label}</div>
      <div className="ftt-bar">
        <div className="ftt-seg needs" style={{ width: pNeeds + '%' }} title={`Besoins ${fmt(buckets.needs)}`}>
          {pNeeds >= 10 && <span>{pNeeds}%</span>}
        </div>
        <div className="ftt-seg wants" style={{ width: pWants + '%' }} title={`Envies ${fmt(buckets.wants)}`}>
          {pWants >= 10 && <span>{pWants}%</span>}
        </div>
        <div className="ftt-seg savings" style={{ width: pSavings + '%' }} title={`Épargne ${fmt(buckets.savings)}`}>
          {pSavings >= 10 && <span>{pSavings}%</span>}
        </div>
      </div>
      <div className="ftt-bar-amounts num ds-micro">
        <span>{fmt(buckets.needs)}</span><span>·</span>
        <span>{fmt(buckets.wants)}</span><span>·</span>
        <span>{fmt(buckets.savings)}</span>
      </div>
    </div>
  );
}

function Recommandation({ buckets, label }) {
  const total = buckets.needs + buckets.wants + buckets.savings;
  if (!total) return null;
  const pNeeds = Math.round((buckets.needs / total) * 100);
  const pWants = Math.round((buckets.wants / total) * 100);
  const pSavings = Math.round((buckets.savings / total) * 100);
  const reco = [];
  if (pNeeds > 55) reco.push(`Besoins essentiels à ${pNeeds}% (cible ≤50%) — voyez si vous pouvez renégocier ou réduire les charges fixes.`);
  if (pWants > 35) reco.push(`Envies à ${pWants}% (cible ≤30%) — restos/loisirs/abonnements sont les leviers les plus rapides.`);
  if (pSavings < 15) reco.push(`Épargne à ${pSavings}% (cible ≥20%) — automatise un virement mensuel le jour du salaire.`);
  if (!reco.length) reco.push(`Vous êtes dans les clous : ${pNeeds}/${pWants}/${pSavings} — proche de la cible 50/30/20.`);
  return (
    <div className="ftt-reco">
      <div className="ftt-reco-head ds-micro">Recommandation · {label}</div>
      <ul>{reco.map((r, i) => <li key={i}>{r}</li>)}</ul>
    </div>
  );
}

export function FiftyThirtyTwentyModal({ refMonth, fiftyThirtyTwenty, categories = [], fmt, onClose }) {
  const refBuckets = useMemo(() => bucketRefMonth(refMonth, categories), [refMonth, categories]);
  const realBuckets = useMemo(() => bucketReal(fiftyThirtyTwenty), [fiftyThirtyTwenty]);
  return (
    <div className="ftt-overlay" onClick={onClose}>
      <div className="ftt-modal" onClick={e => e.stopPropagation()}>
        <div className="ftt-head">
          <div>
            <h2><Target size={18}/> Analyse 50 / 30 / 20</h2>
            <p className="ds-micro">Cible : 50% Besoins essentiels · 30% Envies · 20% Épargne.</p>
          </div>
          <button className="ds-icon-btn" onClick={onClose} aria-label="Fermer"><X size={16}/></button>
        </div>

        <div className="ftt-target">
          <div className="ftt-bar-label">Cible</div>
          <div className="ftt-bar">
            <div className="ftt-seg needs" style={{ width: '50%' }}><span>50%</span></div>
            <div className="ftt-seg wants" style={{ width: '30%' }}><span>30%</span></div>
            <div className="ftt-seg savings" style={{ width: '20%' }}><span>20%</span></div>
          </div>
        </div>

        <Bar label="Mois type" buckets={refBuckets} fmt={fmt}/>
        <Bar label="Mois courant" buckets={realBuckets} fmt={fmt}/>

        <div className="ftt-legend ds-micro">
          <span><span className="dot needs"/> Besoins essentiels</span>
          <span><span className="dot wants"/> Envies</span>
          <span><span className="dot savings"/> Épargne</span>
        </div>

        <Recommandation buckets={realBuckets} label="mois courant"/>
        <Recommandation buckets={refBuckets} label="mois type"/>
      </div>
    </div>
  );
}
