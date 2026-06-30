// ============================================================================
// Monthly — Budget mensuel v5 (2026-05-14)
//
// Layout :
//   - Header : titre + carrousel mois + boutons [Mois type] [📊 50/30/20] [📈 Évolution]
//   - KPI strip : Revenus / Dépenses / Épargne / Reste à vivre (avec écart vs Mois type)
//   - Sankey du Mois type (3 colonnes : Entrées → Catégories → Sous-catégories)
//   - Table comparaison : Réel vs Mois type, groupée par catégorie, dépliable
//   - Drawer RefMonthEditor (édition du mois type)
//   - Modal FiftyThirtyTwentyModal (analyse 50/30/20)
//   - Modal Évolution (chart 6 mois)
// ============================================================================
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { gsap } from '../utils/gsapSetup.js';
import { usePageEnter } from '../hooks/usePageEnter.js';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  ComposedChart, Bar, Line, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Sankey, Layer, Rectangle,
} from 'recharts';
import {
  Edit3, Target, TrendingUp, TrendingDown, PiggyBank, Wallet,
  ChevronDown, ChevronRight, X, BarChart3, Calendar,
  ChevronLeft, Coins, Sparkles, Maximize2,
} from 'lucide-react';
import { formatCurrency, formatDate, monthKey, effectiveMonth, getTransferType } from '../utils.js';
import { useIncomeShift } from '../hooks/useIncomeShift.js';
import { useIsNarrow } from '../hooks/useIsNarrow.js';
import { RefMonthEditor } from '../components/RefMonthEditor.jsx';
import { FiftyThirtyTwentyModal } from '../components/FiftyThirtyTwentyModal.jsx';
import { SubscriptionsSummary } from './Subscriptions.jsx';

const SAVING_SLUGS = new Set(['savings']);
const SAVING_KEYWORDS = ['saving', 'virement', 'transfer', 'epargne', 'épargne', 'livret'];

// isSavingCategory — détecte si une catégorie représente un mouvement
// d'épargne/transfert interne plutôt qu'une vraie dépense.
//
// Détection en cascade :
//   1. Slug exact dans SAVING_SLUGS (legacy match)
//   2. Slug contient un mot-clé épargne/virement/transfer/livret
//   3. (si categories fourni) cat.kind === 'savings' ou cat.type === 'savings'
//
// Avant 2026-05-21 : ne matchait QUE le slug 'savings' -> les tx
// categorisees "Virements internes" / "Livret A" passaient dans le bucket
// dépenses et écrasaient le Sankey (3900€ qui dwarf le reste).
function isSavingCategory(catId, categories) {
  if (!catId) return false;
  const slug = String(catId).toLowerCase();
  if (SAVING_SLUGS.has(slug)) return true;
  if (SAVING_KEYWORDS.some(kw => slug.includes(kw))) return true;
  if (categories) {
    const cat = categories.find(c => c.id === catId || c.slug === catId);
    if (cat?.kind === 'savings' || cat?.type === 'savings') return true;
    // Match aussi sur le nom affiché (FR/EN) pour les categories user-created
    const name = String(cat?.name || '').toLowerCase();
    if (SAVING_KEYWORDS.some(kw => name.includes(kw))) return true;
  }
  return false;
}

function monthLabel(m) {
  if (!m) return '';
  return formatDate(m + '-01', { format: 'monthYear' });
}

function shortMonth(m) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'short' });
}

export function Monthly({
  transactions, accounts, categories, members,
  recurringIds, recurringGroups,
  monthlyEvolution, thisMonthStats,
  categoryAnalysis,
  fixedCharges, saveFixedCharge, deleteFixedCharge,
  refMonth, saveRefMonth,
  refMonthScope = 'household',
  activeMember = null,
  activeMemberId = 'all',
  fiftyThirtyTwenty,
  transferIds = new Set(),
  memberShare,
  currentMonth, fmt,
  onOpenSubscriptions,
}) {
  // Le scope détermine le libellé affiché et désactive l'édition pour les
  // enfants (qui n'ont pas leur propre Mois type — leurs dépenses sont
  // dans le scope Famille).
  const isChildScope = activeMember?.role === 'child';
  const scopeLabel = isChildScope
    ? `${activeMember.name} (enfant)`
    : refMonthScope === 'household'
      ? 'Famille (compte joint)'
      : (activeMember?.name || 'Personnel');
  const { t } = useTranslation();
  // Réglage décalage salaire fin de mois — backed par localStorage. Default
  // enabled + pivot jour 25 (cas francais standard).
  const { settings: incomeShift } = useIncomeShift();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [showEditor, setShowEditor] = useState(false);
  const [show5030, setShow5030] = useState(false);
  const [expandedRows, setExpandedRows] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('wealthly:monthly_expanded') || '[]')); }
    catch { return new Set(); }
  });
  const isNarrow = useIsNarrow(760);

  useEffect(() => {
    try { localStorage.setItem('wealthly:monthly_expanded', JSON.stringify([...expandedRows])); } catch {}
  }, [expandedRows]);

  // Available months: 12 past + 3 future.
  const availableMonths = useMemo(() => {
    const [cy, cm] = currentMonth.split('-').map(Number);
    const arr = [];
    for (let i = -12; i <= 3; i++) {
      const d = new Date(cy, cm - 1 + i, 1);
      arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return arr;
  }, [currentMonth]);

  const catFor = (id) => categories.find(c => c.id === id || c.slug === id);

  // Mois type, parsed and grouped by (kind, category_id).
  const refLines = refMonth?.lines || [];
  const refByCat = useMemo(() => {
    const map = new Map();
    for (const l of refLines) {
      const k = `${l.kind}::${l.category_id || 'uncategorized'}`;
      if (!map.has(k)) map.set(k, { kind: l.kind, category_id: l.category_id, lines: [], total: 0 });
      const v = map.get(k);
      v.lines.push(l);
      v.total += parseFloat(l.amount) || 0;
    }
    return map;
  }, [refLines]);

  const refTotals = useMemo(() => {
    const t = { income: 0, expense: 0, saving: 0 };
    for (const l of refLines) {
      const v = parseFloat(l.amount) || 0;
      t[l.kind] = (t[l.kind] || 0) + v;
    }
    t.balance = t.income - t.expense - t.saving;
    return t;
  }, [refLines]);

  const hasRefMonth = refLines.length > 0;

  // Real month: aggregate transactions by (kind, categoryId).
  // Utilise effectiveMonth pour gerer les salaires verses fin du mois precedent :
  // un salaire date 28/04 finance le budget de mai -> attribue a "2026-05".
  const monthTx = useMemo(() => {
    return transactions
      .filter(t => effectiveMonth(t, incomeShift, categories) === selectedMonth)
      .filter(t => !transferIds.has(t.id))
      .map(t => {
        const acc = accounts.find(a => a.id === t.accountId);
        const share = acc ? memberShare(acc) : 1;
        return { ...t, sharedAmount: (t.amount || 0) * share };
      });
  }, [transactions, accounts, memberShare, transferIds, selectedMonth, incomeShift, categories]);

  // Virements internes typés 'savings' du mois sélectionné. On les sort du
  // bucket "neutralisé" et on les compte comme epargne (cas Livret A pas
  // synchro : l'utilisateur veut que le 1000 EUR aille en epargne et pas
  // disparaisse silencieusement). Utilise effectiveMonth pour rester
  // coherent avec le filtre principal monthTx.
  const monthSavingsTransfers = useMemo(() => {
    const monthIds = new Set(transactions.filter(t => effectiveMonth(t, incomeShift, categories) === selectedMonth).map(t => t.id));
    return transactions
      .filter(t => transferIds.has(t.id) && monthIds.has(t.id))
      .filter(t => getTransferType(t, accounts) === 'savings')
      .map(t => {
        const acc = accounts.find(a => a.id === t.accountId);
        const share = acc ? memberShare(acc) : 1;
        return { ...t, sharedAmount: (t.amount || 0) * share };
      });
  }, [transactions, accounts, memberShare, transferIds, selectedMonth, incomeShift, categories]);

  // Total savings provenant des virements typés (outflows depuis le compte source).
  const savingsFromTransfers = useMemo(() => {
    return monthSavingsTransfers.reduce((s, t) => s + Math.max(0, -t.sharedAmount), 0);
  }, [monthSavingsTransfers]);

  // Per (kind, categoryId) totals for the selected real month.
  // kind is derived from the category's type field, NOT the sign of the amount.
  // This prevents refunds (positive amounts on expense categories) from appearing under "Entrées".
  // Expense totals are signed: negative tx contributes positively, positive tx (refund) reduces.
  const realByCat = useMemo(() => {
    const map = new Map();
    for (const t of monthTx) {
      const catId = t.categoryId || 'uncategorized';
      const cat = catFor(catId);
      const kind = cat?.type === 'income' ? 'income' : isSavingCategory(catId, categories) ? 'saving' : 'expense';
      const k = `${kind}::${catId}`;
      if (!map.has(k)) map.set(k, { kind, category_id: catId, total: 0, count: 0 });
      const v = map.get(k);
      // income: sum amounts as-is (positive = received). expense/saving: negate so expenses are positive.
      v.total += kind === 'income' ? t.sharedAmount : -t.sharedAmount;
      v.count += 1;
    }
    return map;
  }, [monthTx, categories]);

  const realTotals = useMemo(() => {
    const t = { income: 0, expense: 0, saving: 0 };
    for (const v of realByCat.values()) {
      t[v.kind] = (t[v.kind] || 0) + v.total;
    }
    // Inclut les virements typés 'savings' dans l'épargne totale (cf monthSavingsTransfers).
    t.saving += savingsFromTransfers;
    t.balance = t.income - t.expense - t.saving;
    return t;
  }, [realByCat, savingsFromTransfers]);

  // KPI strip
  const isCurrentMonth = selectedMonth === currentMonth;
  const today = new Date();
  const [sy, sm] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(sy, sm, 0).getDate();
  const daysLeft = isCurrentMonth ? Math.max(0, daysInMonth - today.getDate()) : 0;
  const restToLive = isCurrentMonth ? Math.max(0, realTotals.income - realTotals.expense - realTotals.saving) : 0;
  const dailyBudget = daysLeft > 0 ? restToLive / daysLeft : 0;

  // Sankey data — Mois type only. 3 levels :
  //   Income lines  →  Parent categories  →  Sub-line leaves
  //
  // Niveau 2 = catégorie parente (Finance & épargne, Abonnements…). Si la
  // ligne cible déjà une top-level, on prend cette top-level comme niveau 2.
  // Niveau 3 = la sous-catégorie ou le label de la ligne (Crédit étudiant,
  // Netflix, Loyer…). Toujours affiché pour avoir 3 colonnes lisibles.
  const sankeyData = useMemo(() => {
    if (!hasRefMonth) return { nodes: [], links: [] };
    const incomeLines = refLines.filter(l => l.kind === 'income' && (parseFloat(l.amount) || 0) > 0);
    const spendLines = refLines.filter(l => l.kind !== 'income' && (parseFloat(l.amount) || 0) > 0);
    if (!incomeLines.length || !spendLines.length) return { nodes: [], links: [] };

    const parentSlug = (cat) => (cat?.parent || cat?.parent_slug || null);
    const topLevelFor = (cid) => {
      const cat = catFor(cid);
      const ps = parentSlug(cat);
      return ps ? catFor(ps) : cat;
    };

    const nodes = [];
    const links = [];

    // Level 1 — UN SEUL node 'Entrées' qui agrege tous les revenus.
    // Avant : 1 node par income line -> X2 lignes vers chaque categorie,
    // graph illisible. Maintenant : tout converge en amont.
    const totalIncomeAggregated = incomeLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const incomeNodeSingleIdx = nodes.length;
    nodes.push({
      name: incomeLines.length > 1 ? 'Entrées' : (incomeLines[0]?.label || 'Salaire'),
      level: 0,
      kind: 'income',
      amount: totalIncomeAggregated,
      color: 'var(--positive)',
      // breakdown : composition listee dans le tooltip si plusieurs sources
      breakdown: incomeLines.length > 1 ? incomeLines.map(l => ({ label: l.label || 'Entrée', amount: parseFloat(l.amount) || 0 })) : null,
    });

    // Level 2 — top-level parent categories (one node per unique top-level)
    const topNodeIdx = {};
    const topTotals = {};
    spendLines.forEach(l => {
      const top = topLevelFor(l.category_id || 'uncategorized');
      const topId = top?.id || top?.slug || 'uncategorized';
      if (!(topId in topNodeIdx)) {
        topNodeIdx[topId] = nodes.length;
        nodes.push({
          name: top?.name || topId,
          icon: top?.icon || '',
          level: 1,
          kind: 'cat',
          color: top?.color || 'var(--ink)',
          amount: 0,
        });
        topTotals[topId] = 0;
      }
      topTotals[topId] += parseFloat(l.amount) || 0;
    });
    // Total income for % computation. Tagged on each level-2 node so the
    // renderer can show "Logement · 28% du revenu" without re-summing.
    const totalIncomeForPct = incomeLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    Object.entries(topTotals).forEach(([topId, total]) => {
      const node = nodes[topNodeIdx[topId]];
      node.amount = total;
      node.pctOfIncome = totalIncomeForPct > 0 ? (total / totalIncomeForPct) * 100 : null;
    });

    // Level 3 — leaf per spend line (sub-cat or line label)
    spendLines.forEach(l => {
      const top = topLevelFor(l.category_id || 'uncategorized');
      const topId = top?.id || top?.slug || 'uncategorized';
      const cat = catFor(l.category_id);
      const sameTop = (cat?.id || cat?.slug) === topId;
      // If the line's category IS the top-level, use the line label as leaf
      // ("Loyer", "Frais bancaires"…) — fallback to the cat name otherwise.
      const leafName = sameTop
        ? (l.label || cat?.name || 'Ligne')
        : (cat?.name || l.label || 'Ligne');
      const leafIcon = sameTop ? '' : (cat?.icon || '');
      const leafColor = top?.color || 'var(--ink)';
      const idx = nodes.length;
      nodes.push({
        name: leafName,
        icon: leafIcon,
        level: 2,
        kind: l.kind,
        color: leafColor,
        amount: parseFloat(l.amount) || 0,
      });
      links.push({
        source: topNodeIdx[topId],
        target: idx,
        value: parseFloat(l.amount) || 0,
        color: leafColor,
      });
    });

    // Income unique → top-level links (un lien par categorie depuis le
    // single income node, ce qui rend le Sankey lisible).
    const totalSpend = spendLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    if (totalIncomeAggregated > 0 && totalSpend > 0) {
      Object.entries(topTotals).forEach(([topId, topTotal]) => {
        if (topTotal > 0.5) {
          links.push({
            source: incomeNodeSingleIdx,
            target: topNodeIdx[topId],
            value: topTotal,
            color: nodes[topNodeIdx[topId]].color,
          });
        }
      });
    }

    return { nodes, links };
  }, [refLines, hasRefMonth, categories]);

  // Sankey data — Mois en cours (selectedMonth real transactions). Meme structure
  // 3-niveaux que sankeyData : Income → Parent cats → Leaf subcategories.
  const realSankeyData = useMemo(() => {
    const incomeTx = monthTx.filter(t => {
      const cat = catFor(t.categoryId);
      return cat?.type === 'income' && (t.sharedAmount || 0) > 0;
    });
    // spendTx = vraies dépenses uniquement. Les tx categorisees comme
    // épargne/virement/transfert sont gerees a part par la branche
    // savings (ci-dessous) pour ne pas ecraser le Sankey (3900€ de Livret
    // dwarferaient les autres categories sinon).
    const spendTx = monthTx.filter(t => {
      const cat = catFor(t.categoryId);
      if (isSavingCategory(t.categoryId, categories)) return false;
      const isExpenseTx = cat?.type !== 'income';
      return isExpenseTx && -t.sharedAmount > 0;
    });

    // savingTx = tx classees comme epargne/virement interne par categorie.
    // Distinct de monthSavingsTransfers qui pioche dans transferIds (paires
    // detectees automatiquement). Ici on attrape aussi les tx isolees sans
    // pair detectee mais clairement categorisees comme epargne.
    const savingTx = monthTx.filter(t => isSavingCategory(t.categoryId, categories));
    const savingsFromCategorized = savingTx.reduce(
      (s, t) => s + Math.abs(t.sharedAmount || 0), 0
    );
    const totalSavingsForSankey = savingsFromTransfers + savingsFromCategorized;
    // Bug user 2026-05-21 : avant on retournait vide des qu'UN seul cote
    // manquait (|| au lieu de &&). Cas typique : debut de mois avec
    // depenses mais salaire pas encore arrive, ou seulement des remboursements
    // (categorises 'reimbursements' != 'income') -> Monthly affichait
    // l'empty state "configure ton mois type" alors qu'il y avait 5000€ de
    // tx visibles ailleurs (Dashboard cashflow). Maintenant on retourne vide
    // seulement si les DEUX sont vides — sinon on rend le cote disponible.
    if (!incomeTx.length && !spendTx.length) return { nodes: [], links: [] };

    const parentSlug = (cat) => (cat?.parent || cat?.parent_slug || null);
    const topLevelFor = (cid) => {
      const cat = catFor(cid);
      const ps = parentSlug(cat);
      return ps ? catFor(ps) : cat;
    };

    const nodes = [];
    const links = [];

    // Level 1 — UN SEUL node 'Entrées' qui agrege Salaire + Autres revenus.
    // Sinon 2+ income sources -> double les lignes vers chaque categorie.
    const incomeAgg = new Map();
    incomeTx.forEach(t => {
      const cat = catFor(t.categoryId);
      const key = cat?.id || cat?.slug || 'income';
      if (!incomeAgg.has(key)) incomeAgg.set(key, { name: cat?.name || 'Entrée', amount: 0, icon: cat?.icon });
      incomeAgg.get(key).amount += t.sharedAmount;
    });
    const incomeBreakdown = [...incomeAgg.values()];
    const incomeAggregatedTotal = incomeBreakdown.reduce((s, v) => s + v.amount, 0);

    // Mode "Entrées discrètes" — quand Entrées << Dépenses (début de mois,
    // salaire pas encore arrivé, juste des remboursements...), le node
    // Entrées serait dessiné à la taille des flux sortants (totalSpend) et
    // fausserait le graph (un remboursement 230€ aussi épais qu'un loyer
    // 3514€). On le masque dès que income < 50% spend. Le KPI strip en haut
    // affiche déjà le montant des Entrées, l'info n'est pas perdue.
    const previewSpendTotal = spendTx.reduce((s, t) => s + Math.max(0, -t.sharedAmount), 0);
    // incomeShortfall couvre 2 cas : (1) zero income mais des depenses, (2)
    // income trop petit (< 50% spend). Dans les deux cas on cache le node
    // Entrees pour ne pas fausser la lecture du graph.
    const incomeShortfall = incomeAggregatedTotal === 0 || (incomeAggregatedTotal < previewSpendTotal * 0.5);
    const incomeNodeSingleIdx = incomeShortfall ? -1 : nodes.length;
    if (!incomeShortfall) {
      nodes.push({
        name: incomeBreakdown.length > 1 ? 'Entrées' : (incomeBreakdown[0]?.name || 'Salaire'),
        icon: incomeBreakdown.length > 1 ? '💰' : incomeBreakdown[0]?.icon,
        level: 0,
        kind: 'income',
        amount: incomeAggregatedTotal,
        color: 'var(--positive)',
        breakdown: incomeBreakdown.length > 1 ? incomeBreakdown.map(v => ({ label: v.name, amount: v.amount })) : null,
      });
    }

    // Level 2 — top-level parent cats with aggregated totals
    const topNodeIdx = {};
    const topTotals = {};
    const topTxByLeaf = new Map(); // for level 3
    spendTx.forEach(t => {
      const top = topLevelFor(t.categoryId || 'uncategorized');
      const topId = top?.id || top?.slug || 'uncategorized';
      if (!(topId in topNodeIdx)) {
        topNodeIdx[topId] = nodes.length;
        nodes.push({ name: top?.name || topId, icon: top?.icon || '', level: 1, kind: 'cat', color: top?.color || 'var(--ink)', amount: 0 });
        topTotals[topId] = 0;
      }
      const amt = Math.max(0, -t.sharedAmount); // expense magnitude
      topTotals[topId] += amt;
    });
    const totalIncomeForPct = incomeAggregatedTotal;
    Object.entries(topTotals).forEach(([topId, total]) => {
      const node = nodes[topNodeIdx[topId]];
      node.amount = total;
      node.pctOfIncome = totalIncomeForPct > 0 ? (total / totalIncomeForPct) * 100 : null;
    });

    // Level 3 — leaf per sub-category (group tx by categoryId under their top)
    const leafAgg = new Map(); // `${topId}::${catId}` → { name, icon, color, amount }
    spendTx.forEach(t => {
      const top = topLevelFor(t.categoryId || 'uncategorized');
      const topId = top?.id || top?.slug || 'uncategorized';
      const cat = catFor(t.categoryId);
      const sameTop = (cat?.id || cat?.slug) === topId;
      const leafKey = `${topId}::${cat?.id || cat?.slug || 'uncategorized'}`;
      if (!leafAgg.has(leafKey)) {
        leafAgg.set(leafKey, {
          topId,
          name: sameTop ? (top?.name || 'Ligne') : (cat?.name || 'Ligne'),
          icon: sameTop ? '' : (cat?.icon || ''),
          color: top?.color || 'var(--ink)',
          amount: 0,
        });
      }
      leafAgg.get(leafKey).amount += Math.max(0, -t.sharedAmount);
    });
    [...leafAgg.values()].forEach(leaf => {
      const idx = nodes.length;
      nodes.push({ name: leaf.name, icon: leaf.icon, level: 2, kind: 'expense', color: leaf.color, amount: leaf.amount });
      links.push({ source: topNodeIdx[leaf.topId], target: idx, value: leaf.amount, color: leaf.color });
    });

    // Income unique → top-level links (un seul lien par categorie depuis le
    // node 'Entrées' agrege).
    const totalIncome = totalIncomeForPct;
    const totalSpend = Object.values(topTotals).reduce((s, v) => s + v, 0);
    // Skip income→category links quand on a masqué le node Entrées (shortfall).
    // Les catégories restent dessinées via leurs flux sortants vers les leaves.
    if (totalIncome > 0 && totalSpend > 0 && !incomeShortfall) {
      Object.entries(topTotals).forEach(([topId, topTotal]) => {
        if (topTotal > 0.5) {
          links.push({ source: incomeNodeSingleIdx, target: topNodeIdx[topId], value: topTotal, color: nodes[topNodeIdx[topId]].color });
        }
      });
    }

    // Branche Épargne — toujours affichée s'il y a des mouvements épargne,
    // que ce soit via flagged transfers (savingsFromTransfers) ou via tx
    // categorisees epargne/virement isolees (savingsFromCategorized).
    // Anciennement gatee sur `totalIncome > 0` -> les savings disparaissaient
    // les mois sans revenus, alors qu'on veut justement les voir.
    if (totalSavingsForSankey > 0.5) {
      const savingsNodeIdx = nodes.length;
      nodes.push({
        name: 'Épargne',
        icon: '💰',
        level: 1,
        kind: 'saving',
        color: 'var(--accent)',
        amount: totalSavingsForSankey,
        pctOfIncome: totalIncome > 0 ? (totalSavingsForSankey / totalIncome) * 100 : null,
      });
      // Sous-node (level 2) : "Virement Livret", lien parent -> sous-node
      const savingsLeafIdx = nodes.length;
      nodes.push({
        name: 'Virement Livret',
        icon: '↔',
        level: 2,
        kind: 'saving',
        color: 'var(--accent)',
        amount: totalSavingsForSankey,
      });
      links.push({
        source: savingsNodeIdx,
        target: savingsLeafIdx,
        value: totalSavingsForSankey,
        color: 'var(--accent)',
      });
      // Income unique → savings (uniquement si on a effectivement push le node Entrées)
      if (!incomeShortfall) {
        links.push({ source: incomeNodeSingleIdx, target: savingsNodeIdx, value: totalSavingsForSankey, color: 'var(--accent)' });
      }
    }

    return { nodes, links };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthTx, categories, savingsFromTransfers]);

  // UI state — quelles cartes Sankey sont expanded ? Set ('type' et/ou 'real').
  // Vide = 50/50 teaser. Une seule = 60/40. Les deux = 50/50 expanded.
  const [expandedSankey, setExpandedSankey] = useState(() => new Set());
  // Modal plein ecran d'un Sankey (cliquer Maximize2 du card head)
  const [maximizedSankey, setMaximizedSankey] = useState(null); // 'type' | 'real' | null
  const toggleSankey = (key) => {
    setExpandedSankey(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const sankeyLayoutMode = (() => {
    const t = expandedSankey.has('type');
    const r = expandedSankey.has('real');
    if (t && r) return 'both';
    if (t) return 'type';
    if (r) return 'real';
    return 'none';
  })();

  // Parent-grouped sections : une ligne par categorie parente (Logement,
  // Enfants...), avec sums roll-ups des enfants. Sous-cats visibles a l'expand.
  const parentGroupedSections = useMemo(() => {
    const sections = [
      { kind: 'income',  title: 'Entrées',  parents: new Map() },
      { kind: 'expense', title: 'Dépenses', parents: new Map() },
      { kind: 'saving',  title: 'Épargne',  parents: new Map() },
    ];
    const getSection = (k) => sections.find(s => s.kind === k);

    const ensureGroup = (section, parentCat, parentId) => {
      if (!section.parents.has(parentId)) {
        section.parents.set(parentId, {
          parent_id: parentId,
          parent_cat: parentCat,
          ref_total: 0,
          real_total: 0,
          children: new Map(), // childCatId -> { cat, ref_total, real_total }
        });
      }
      return section.parents.get(parentId);
    };

    const ensureChild = (group, cat) => {
      const childId = cat.id || cat.slug;
      if (!group.children.has(childId)) {
        group.children.set(childId, { cat, child_id: childId, ref_total: 0, real_total: 0 });
      }
      return group.children.get(childId);
    };

    // Walk refByCat (Mois type)
    for (const val of refByCat.values()) {
      const section = getSection(val.kind);
      if (!section) continue;
      const cat = catFor(val.category_id);
      const isChild = !!cat?.parent;
      const parentCat = isChild ? catFor(cat.parent) : cat;
      const parentId = parentCat?.id || parentCat?.slug || val.category_id || 'uncategorized';

      const group = ensureGroup(section, parentCat, parentId);
      group.ref_total += val.total;
      if (isChild && cat) {
        ensureChild(group, cat).ref_total += val.total;
      }
    }

    // Walk realByCat (Mois en cours)
    for (const val of realByCat.values()) {
      const section = getSection(val.kind);
      if (!section) continue;
      const cat = catFor(val.category_id);
      const isChild = !!cat?.parent;
      const parentCat = isChild ? catFor(cat.parent) : cat;
      const parentId = parentCat?.id || parentCat?.slug || val.category_id || 'uncategorized';
      const realAmount = Math.max(0, val.total); // clamp refunds

      const group = ensureGroup(section, parentCat, parentId);
      group.real_total += realAmount;
      if (isChild && cat) {
        ensureChild(group, cat).real_total += realAmount;
      }
    }

    return sections
      .map(s => ({
        kind: s.kind,
        title: s.title,
        parents: [...s.parents.values()]
          .map(p => ({
            ...p,
            children: [...p.children.values()].sort((a, b) => (b.ref_total + b.real_total) - (a.ref_total + a.real_total)),
            is_unexpected: p.ref_total === 0 && p.real_total > 0,
          }))
          .sort((a, b) => (b.ref_total + b.real_total) - (a.ref_total + a.real_total)),
      }))
      .filter(s => s.parents.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refByCat, realByCat, categories]);

  // Comparison table — sections: income / expense / saving.
  const tableSections = useMemo(() => {
    const sections = [
      { kind: 'income', title: 'Entrées', items: [] },
      { kind: 'expense', title: 'Dépenses', items: [] },
      { kind: 'saving', title: 'Épargne', items: [] },
    ];

    // Roll up real entries: if a category has no direct mois type entry but its parent does,
    // merge into the parent key. This handles cases like "supermarche" → "courses",
    // or sub-insurance categories rolling up into the parent insurance line.
    const realMerged = new Map();
    for (const [key, val] of realByCat.entries()) {
      const [kind, catId] = key.split('::');
      const cat = catFor(catId);
      const parentKey = cat?.parent ? `${kind}::${cat.parent}` : null;
      const targetKey = (!refByCat.has(key) && parentKey && refByCat.has(parentKey)) ? parentKey : key;
      if (!realMerged.has(targetKey)) {
        const tCatId = targetKey.split('::')[1];
        realMerged.set(targetKey, { kind, category_id: tCatId, total: 0, count: 0 });
      }
      const v = realMerged.get(targetKey);
      v.total += val.total;
      v.count += val.count;
    }

    const allKeys = new Set([...refByCat.keys(), ...realMerged.keys()]);

    for (const key of allKeys) {
      const [kind, catId] = key.split('::');
      const ref = refByCat.get(key);
      const real = realMerged.get(key);
      const cat = catFor(catId);
      const refTotal = ref?.total || 0;
      const realTotal = Math.max(0, real?.total || 0); // clamp: net refund > expense shows as 0
      const item = {
        key,
        kind,
        category_id: catId,
        cat_name: cat?.name || catId,
        ref_total: refTotal,
        real_total: realTotal,
        lines: ref?.lines || [],
        is_unexpected: !ref && (real?.total || 0) > 0,
      };
      const target = sections.find(s => s.kind === kind);
      if (target) target.items.push(item);
    }

    // Sort items inside each section by ref desc, then real desc.
    sections.forEach(s => s.items.sort((a, b) => (b.ref_total || b.real_total) - (a.ref_total || a.real_total)));
    return sections;
  }, [refByCat, realByCat, categories]);

  const toggleRow = (key) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const rootRef = usePageEnter(); // motion d'entrée standard (charte Forêt)

  return (
    <div className="monthly-v5" ref={rootRef}>
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="subview-header" data-reveal>
        <div>
          <h1>{t('views.monthly.title')} <em>{t('views.monthly.titleAccent')}</em></h1>
          <p>
            {t('views.monthly.subtitle')}
            <span className="mon-scope-chip" title={refMonthScope === 'household' ? 'Mois type partagé du foyer (compte joint)' : 'Mois type personnel'}>
              {refMonthScope === 'household' ? '👪' : '👤'} {scopeLabel}
            </span>
          </p>
        </div>
        <div className="mon-actions">
          <button className="ds-btn" onClick={() => setShow5030(true)}>
            <Target size={14}/> {isNarrow ? '' : '50 / 30 / 20'}
          </button>
          {!isChildScope && (
            <button className="ds-btn primary" onClick={() => setShowEditor(true)}>
              <Edit3 size={14}/> {isNarrow ? 'Mois type' : 'Générer mois type'}
            </button>
          )}
        </div>
      </div>

      {/* ── Child scope empty state — pas de Mois type perso pour les enfants ── */}
      {isChildScope && (
        <section className="card mon-empty-state">
          <div className="mon-empty-illu">
            <Target size={32}/>
          </div>
          <h3>Pas de <em>mois type</em> pour {activeMember.name}.</h3>
          <p>Les dépenses des enfants apparaissent dans le Mois type de la <strong>Famille</strong> (compte joint). Bascule sur l'onglet Famille en haut pour l'éditer.</p>
        </section>
      )}

      {/* ── Month picker ────────────────────────────────────────────── */}
      {!isChildScope && (
        <MonthPicker
          selectedMonth={selectedMonth}
          currentMonth={currentMonth}
          availableMonths={availableMonths}
          onChange={setSelectedMonth}
        />
      )}

      {/* ── 50/30/20 strip inline ───────────────────────────────────
           Surfacé en haut pour que la lecture besoins/envies/épargne soit
           immédiate. Le détail (recos + comparaison mois type) reste dans
           la modale via le bouton du header. */}
      {!isChildScope && fiftyThirtyTwenty && (fiftyThirtyTwenty.needs || fiftyThirtyTwenty.wants || fiftyThirtyTwenty.savings) > 0 && (
        <FiftyThirtyTwentyStrip ftt={fiftyThirtyTwenty} onOpenDetails={() => setShow5030(true)} fmt={fmt}/>
      )}

      {/* Bloc abonnements — argument de vente mis en scène dans le budget mensuel */}
      {!isChildScope && (
        <SubscriptionsSummary transactions={transactions} categories={categories} onOpen={onOpenSubscriptions}/>
      )}


      {/* ── Empty state : pas de Mois type ET pas de tx reelles ─────── */}
      {!isChildScope && !hasRefMonth && realSankeyData.nodes.length === 0 && (
        <section className="card mon-empty-state">
          <div className="mon-empty-illu">
            <Sparkles size={20} className="mon-empty-spark mon-empty-spark-1"/>
            <Target size={32}/>
            <Sparkles size={14} className="mon-empty-spark mon-empty-spark-2"/>
          </div>
          <h3>Configure ton <em>mois type.</em></h3>
          <p>Définis ton salaire et tes dépenses habituelles — l'app comparera chaque mois pour t'aider à rester sur la bonne trajectoire.</p>
          <button className="ds-btn primary lg" onClick={() => setShowEditor(true)}>
            <Edit3 size={14}/> Générer mon mois type
          </button>
        </section>
      )}

      {/* Banner CTA quand on a des tx reelles mais pas de Mois type perso —
          aide l'user a configurer son template sans bloquer la visualisation
          de ses depenses reelles */}
      {!isChildScope && !hasRefMonth && realSankeyData.nodes.length > 0 && (
        <section className="card mon-cta-banner">
          <div className="mon-cta-banner-icon"><Target size={18}/></div>
          <div className="mon-cta-banner-body">
            <strong>Configure ton mois type personnel</strong>
            <span>Tu vois tes dépenses réelles ci-dessous. Définis ton plan habituel pour comparer chaque mois.</span>
          </div>
          <button className="ds-btn primary" onClick={() => setShowEditor(true)}>
            <Edit3 size={13}/> Configurer
          </button>
        </section>
      )}

      {/* ── Sankey duo : Mois type + Mois en cours ───────────────────
           Affiche si AU MOINS un des deux a des donnees (avant gardait
           uniquement si hasRefMonth -> bug user avec compte perso pas
           de mois type configure ne voyait rien). */}
      {!isChildScope && (sankeyData.nodes.length > 0 || realSankeyData.nodes.length > 0) && (
        <section className="mon-sankey-duo" data-reveal data-expanded={sankeyLayoutMode}>
          <SankeyCard
            kind="type"
            eyebrow="Prévu"
            label="Mois type"
            subtitle="Ta projection mensuelle habituelle"
            data={sankeyData}
            totals={refTotals}
            isExpanded={expandedSankey.has('type')}
            isTeaser={!expandedSankey.has('type')}
            isCompact={sankeyLayoutMode === 'both'}
            onClick={() => toggleSankey('type')}
            onMaximize={() => setMaximizedSankey('type')}
            fmt={fmt}
            isNarrow={isNarrow}
            empty={sankeyData.nodes.length === 0}
          />
          <SankeyCard
            kind="real"
            eyebrow="Réel"
            label={monthHumanLabel(selectedMonth)}
            subtitle={isCurrentMonth ? 'Ce que tu as dépensé ce mois-ci' : 'Ce que tu as dépensé sur ce mois'}
            data={realSankeyData}
            totals={realTotals}
            isExpanded={expandedSankey.has('real')}
            isTeaser={!expandedSankey.has('real')}
            isCompact={sankeyLayoutMode === 'both'}
            onClick={() => toggleSankey('real')}
            onMaximize={() => setMaximizedSankey('real')}
            fmt={fmt}
            isNarrow={isNarrow}
            empty={realSankeyData.nodes.length === 0}
            deltaVs={refTotals.expense > 0 ? realTotals.expense - refTotals.expense : null}
          />
        </section>
      )}

      {/* Modal plein écran Sankey — quand maximizedSankey set */}
      {maximizedSankey && (
        <SankeyFullscreenModal
          kind={maximizedSankey}
          data={maximizedSankey === 'type' ? sankeyData : realSankeyData}
          totals={maximizedSankey === 'type' ? refTotals : realTotals}
          label={maximizedSankey === 'type' ? 'Mois type' : monthHumanLabel(selectedMonth)}
          eyebrow={maximizedSankey === 'type' ? 'Prévu' : 'Réel'}
          fmt={fmt}
          onClose={() => setMaximizedSankey(null)}
        />
      )}

      {/* ── Comparaison par categorie — accordeon ─────────────────────
           Une ligne par categorie : Mois type vs Mois en cours + delta.
           Clic = deplie les transactions du mois pour cette categorie. */}
      {!isChildScope && hasRefMonth && (
        <MonthlyCompareTable
          sections={parentGroupedSections}
          monthTx={monthTx}
          fmt={fmt}
          catFor={catFor}
          expandedRows={expandedRows}
          toggleRow={toggleRow}
          selectedMonthLabel={monthHumanLabel(selectedMonth)}
        />
      )}

      {/* ── Drawer / Modals ─────────────────────────────────────────── */}
      {showEditor && (
        <RefMonthEditor
          refMonth={refMonth}
          saveRefMonth={saveRefMonth}
          categories={categories}
          transactions={transactions}
          accounts={accounts}
          memberShare={memberShare}
          transferIds={transferIds}
          currentMonth={currentMonth}
          fmt={fmt}
          scopeLabel={scopeLabel}
          isHouseholdScope={refMonthScope === 'household'}
          onClose={() => setShowEditor(false)}
        />
      )}

      {show5030 && (
        <FiftyThirtyTwentyModal
          refMonth={refMonth}
          fiftyThirtyTwenty={fiftyThirtyTwenty}
          categories={categories}
          fmt={fmt}
          onClose={() => setShow5030(false)}
        />
      )}

    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Strip 50/30/20 inline — résumé compact sous le picker. Pour le détail
// (cibles, recommandations, comparaison mois type vs courant) → modale.
function FiftyThirtyTwentyStrip({ ftt, onOpenDetails, fmt }) {
  const total = (ftt?.needs || 0) + (ftt?.wants || 0) + (ftt?.savings || 0);
  if (!total) return null;
  const pct = (v) => Math.round((v / total) * 100);
  const pN = pct(ftt.needs || 0);
  const pW = pct(ftt.wants || 0);
  const pS = 100 - pN - pW;
  const onTarget = pN <= 55 && pW <= 35 && pS >= 15;
  return (
    <section
      className="mon-5030-strip"
      data-reveal
      onClick={onOpenDetails}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenDetails(); }}
      title="Voir l'analyse détaillée"
    >
      <div className="mon-5030-head">
        <span className="ds-micro">50 / 30 / 20 · {onTarget ? 'dans la cible' : 'à ajuster'}</span>
        <span className="mon-5030-detail-link">détails →</span>
      </div>
      <div className="mon-5030-bar" aria-hidden>
        <div className="mon-5030-seg needs" style={{ width: pN + '%' }}>{pN >= 8 && <span>{pN}%</span>}</div>
        <div className="mon-5030-seg wants" style={{ width: pW + '%' }}>{pW >= 8 && <span>{pW}%</span>}</div>
        <div className="mon-5030-seg savings" style={{ width: pS + '%' }}>{pS >= 8 && <span>{pS}%</span>}</div>
      </div>
      <div className="mon-5030-legend ds-micro">
        <span><i className="dot needs"/> Besoins {fmt(ftt.needs || 0)}</span>
        <span><i className="dot wants"/> Envies {fmt(ftt.wants || 0)}</span>
        <span><i className="dot savings"/> Épargne {fmt(ftt.savings || 0)}</span>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────
function Kpi({ realTotals, refTotals, hasRefMonth, restToLive, dailyBudget, daysLeft, isCurrentMonth, fmt }) {
  const renderDelta = (real, ref, invert = false) => {
    if (!hasRefMonth || !ref) return null;
    const d = real - ref;
    if (Math.abs(d) < 1) return <span className="ds-micro">vs {fmt(ref)}</span>;
    const positive = invert ? d > 0 : d < 0;
    return (
      <span className={`mon-kpi-delta ds-micro num ${positive ? 'pos' : 'neg'}`}>
        {d > 0 ? '+' : ''}{fmt(d)} vs type
      </span>
    );
  };
  return (
    <section className="mon-kpi-strip">
      <div className="mon-kpi mon-kpi-income">
        <div className="mon-kpi-head">
          <span className="mon-kpi-icon"><TrendingUp size={14}/></span>
          <span className="ds-micro">Revenus</span>
        </div>
        <span className="num mon-kpi-value">{fmt(realTotals.income)}</span>
        {renderDelta(realTotals.income, refTotals.income, true)}
      </div>
      <div className="mon-kpi mon-kpi-expense">
        <div className="mon-kpi-head">
          <span className="mon-kpi-icon"><TrendingDown size={14}/></span>
          <span className="ds-micro">Dépenses</span>
        </div>
        <span className="num mon-kpi-value">{fmt(realTotals.expense)}</span>
        {renderDelta(realTotals.expense, refTotals.expense, false)}
      </div>
      <div className="mon-kpi mon-kpi-saving">
        <div className="mon-kpi-head">
          <span className="mon-kpi-icon"><PiggyBank size={14}/></span>
          <span className="ds-micro">Épargne</span>
        </div>
        <span className="num mon-kpi-value">{fmt(realTotals.saving)}</span>
        {renderDelta(realTotals.saving, refTotals.saving, true)}
      </div>
      <div className="mon-kpi mon-kpi-rest">
        <div className="mon-kpi-head">
          <span className="mon-kpi-icon"><Wallet size={14}/></span>
          <span className="ds-micro">{isCurrentMonth ? 'Reste à vivre' : 'Balance mois'}</span>
        </div>
        <span className="num mon-kpi-value">{fmt(isCurrentMonth ? restToLive : realTotals.balance)}</span>
        {isCurrentMonth && daysLeft > 0
          ? <span className="ds-micro num">{fmt(dailyBudget)}/jour · {daysLeft}j restants</span>
          : null}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────
function MonthPicker({ selectedMonth, currentMonth, availableMonths, onChange }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => parseInt(selectedMonth.split('-')[0], 10));
  useEffect(() => {
    if (open) setYear(parseInt(selectedMonth.split('-')[0], 10));
  }, [open, selectedMonth]);

  const close = () => setOpen(false);

  // Available months grouped by year for navigation.
  const minYear = Math.min(...availableMonths.map(m => parseInt(m.split('-')[0], 10)));
  const maxYear = Math.max(...availableMonths.map(m => parseInt(m.split('-')[0], 10)));
  const monthsForYear = useMemo(() => {
    const arr = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      const enabled = availableMonths.includes(key);
      arr.push({ key, month: m, enabled });
    }
    return arr;
  }, [year, availableMonths]);

  const label = formatDate(selectedMonth + '-01', { format: 'monthYear' });
  const monthLabels = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

  return (
    <div className="mon-picker-wrap">
      <button
        className="mon-picker-toggle"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Calendar size={14}/>
        <span>{label}</span>
        <ChevronDown size={14} className={open ? 'rot' : ''}/>
      </button>
      {open && (
        <>
          <div className="mon-picker-backdrop" onClick={close}/>
          <div className="mon-picker-pop" role="dialog">
            <div className="mon-picker-head">
              <button
                className="ds-icon-btn"
                disabled={year <= minYear}
                onClick={() => setYear(y => y - 1)}
                aria-label="Année précédente"
              ><ChevronLeft size={14}/></button>
              <strong>{year}</strong>
              <button
                className="ds-icon-btn"
                disabled={year >= maxYear}
                onClick={() => setYear(y => y + 1)}
                aria-label="Année suivante"
              ><ChevronRight size={14}/></button>
            </div>
            <div className="mon-picker-grid">
              {monthsForYear.map(({ key, month, enabled }) => {
                const isActive = key === selectedMonth;
                const isCurrent = key === currentMonth;
                return (
                  <button
                    key={key}
                    className={`mon-picker-cell ${isActive ? 'is-active' : ''} ${isCurrent ? 'is-current' : ''}`}
                    disabled={!enabled}
                    onClick={() => { onChange(key); close(); }}
                  >
                    {monthLabels[month - 1]}
                  </button>
                );
              })}
            </div>
            <button
              className="mon-picker-today"
              onClick={() => { onChange(currentMonth); close(); }}
            >
              Aujourd'hui
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Halo effect — white outline behind text so labels stay readable over colored flows.
// Halo derrière les labels SVG du Sankey — utilise --bg pour s'adapter au theme
// (sinon bloc blanc criard sur dark mode, bug repéré 2026-05-19).
const HALO = { stroke: 'var(--bg)', strokeWidth: 2.5, strokeLinejoin: 'round', paintOrder: 'stroke' };

// Formatter compact pour les labels du Sankey — pas de décimales, espace
// insécable fine pour les milliers. "6 000 €" au lieu de "6 000,00 €" pour
// rester lisible à 10-13px avec halo.
const sankeyFmt = new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR',
  maximumFractionDigits: 0, minimumFractionDigits: 0,
});

function SankeyNode({ x, y, width, height, index, payload, fmt, teaser, compact }) {
  if (!payload) return null;
  const isLeft   = payload.level === 0;
  const isMiddle = payload.level === 1;
  // Teaser mode : on garde les bandes/nodes mais on masque tous les labels
  // texte pour donner cet effet "vignette previu" volontairement illisible.
  if (teaser) {
    const rx = Math.min(5, Math.floor(width / 2));
    const fill = payload.color || '#94a3b8';
    return (
      <Layer key={`sn-teaser-${index}`}>
        <rect x={x} y={y} width={width} height={height} rx={rx} ry={rx} fill={fill} fillOpacity={0.85}/>
      </Layer>
    );
  }
  const fill = payload.color || '#94a3b8';

  // Node bar — cap rx so tall nodes stay rectangular, not pill-shaped.
  const rx = Math.min(5, Math.floor(width / 2));

  // Label positioning. En compact, le niveau 1 (parent) ancre a GAUCHE du
  // node pour eviter le chevauchement avec les leaves a droite.
  const labelLeftSide = isLeft || (compact && isMiddle);
  const labelX = labelLeftSide ? x - 14 : x + width + 12;
  const anchor  = labelLeftSide ? 'end' : 'start';
  const midY    = y + height / 2;

  const hasAmount = typeof payload.amount === 'number' && payload.amount > 0;
  // En compact, on droppe le pourcentage (% du revenu) pour reduire le bruit
  // dans le label deja contraint.
  const hasPct    = !compact && isMiddle && typeof payload.pctOfIncome === 'number' && payload.pctOfIncome > 0;
  const amtStr    = hasAmount ? sankeyFmt.format(Math.round(payload.amount)) : '';
  const pctStr    = hasPct
    ? ` · ${payload.pctOfIncome >= 10 ? payload.pctOfIncome.toFixed(0) : payload.pctOfIncome.toFixed(1)}%`
    : '';

  // Always show name + amount on ONE line (avoids height constraints entirely).
  // When the node is tall enough, split into two lines for breathing room.
  const twoLines   = height >= (compact ? 32 : 28) && hasAmount;
  const nameLine   = (payload.icon ? `${payload.icon} ` : '') + (payload.name || '');
  const singleLine = hasAmount ? `${nameLine}  ${amtStr}` : nameLine;
  const nameY      = twoLines ? midY - 8 : midY;
  // Fonts ~1px plus petites en mode compact pour gagner de la place.
  const fontSize   = compact
    ? (isLeft ? 12 : height < 18 ? 10 : 11)
    : (isLeft ? 13 : height < 18 ? 10.5 : 12);

  return (
    <Layer key={`sn-${index}`}>
      {/* Subtle outer glow */}
      <rect x={x - 2} y={y} width={width + 4} height={height} rx={rx + 2} ry={rx + 2}
        fill={fill} fillOpacity={0.18}/>
      {/* Main node bar */}
      <rect x={x} y={y} width={width} height={height} rx={rx} ry={rx}
        fill={fill} fillOpacity={0.97}/>
      {/* Top shine */}
      <rect x={x} y={y} width={width} height={Math.min(height * 0.35, 4)} rx={rx} ry={rx}
        fill="#fff" fillOpacity={0.22}/>

      {/* Single-line label: "🍽️ Restaurant  250€" — always visible */}
      {!twoLines && (
        <text x={labelX} y={midY} textAnchor={anchor} fontSize={fontSize}
          fontWeight={isLeft || isMiddle ? 600 : 500} fill="var(--ink)"
          dominantBaseline="middle" style={{ fontVariantNumeric: 'tabular-nums' }} {...HALO}>
          {singleLine}
        </text>
      )}

      {/* Two-line layout for taller nodes: name on top, amount + % below */}
      {twoLines && (
        <>
          <text x={labelX} y={nameY} textAnchor={anchor} fontSize={fontSize}
            fontWeight={isLeft || isMiddle ? 600 : 500} fill="var(--ink)"
            dominantBaseline="middle" {...HALO}>
            {nameLine}
          </text>
          <text x={labelX} y={midY + 10} textAnchor={anchor} fontSize={10.5}
            fill={hasPct ? (payload.color || 'var(--ink-3)') : 'var(--ink-3)'}
            dominantBaseline="middle" style={{ fontVariantNumeric: 'tabular-nums' }} {...HALO}>
            {amtStr}{pctStr}
          </text>
        </>
      )}
    </Layer>
  );
}

// Links: gradient from income green → category colour, with fill instead of stroke
// so the flow shape is solid (not just an outline).
// ──────────────────────────────────────────────────────────────────────
// MonthlyCompareTable — accordeon Mois type vs Mois en cours.
// Une ligne par categorie (parente), tri par ref desc puis real desc.
// Clic = deplie les transactions du mois pour cette categorie.
// ──────────────────────────────────────────────────────────────────────
function MonthlyCompareTable({ sections, monthTx, fmt, catFor, expandedRows, toggleRow, selectedMonthLabel }) {
  // Groupe les tx du mois par categoryId une fois (O(1) au deplie).
  const txByCategoryId = useMemo(() => {
    const m = new Map();
    for (const t of monthTx) {
      const cid = t.categoryId || 'uncategorized';
      if (!m.has(cid)) m.set(cid, []);
      m.get(cid).push(t);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
    return m;
  }, [monthTx]);

  // Recupere les tx d'une categorie parente : direct + enfants.
  const txForParent = (parentId) => {
    const acc = [];
    if (txByCategoryId.has(parentId)) acc.push(...txByCategoryId.get(parentId));
    for (const [otherCid, txs] of txByCategoryId.entries()) {
      const cat = catFor(otherCid);
      if (cat?.parent === parentId) acc.push(...txs);
    }
    return acc.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  };

  if (sections.length === 0) return null;

  return (
    <section className="card mon-compare">
      <div className="mon-compare-head">
        <div>
          <h3>Comparaison par catégorie</h3>
          <p className="mon-compare-sub">Clique sur une catégorie pour voir le détail des sous-catégories et transactions.</p>
        </div>
      </div>

      {/* Column headers — clarifie quelle colonne est Mois type vs reel */}
      <div className="mon-compare-cols">
        <span className="mon-compare-cols-cat">Catégorie</span>
        <span className="mon-compare-cols-amounts">
          <span className="mon-compare-cols-ref">Mois type</span>
          <span className="mon-compare-cols-arrow">→</span>
          <span className="mon-compare-cols-real">{selectedMonthLabel}</span>
        </span>
        <span className="mon-compare-cols-delta">Écart</span>
      </div>

      {sections.map(section => (
        <div key={section.kind} className={`mon-compare-section mon-compare-section--${section.kind}`}>
          <div className="mon-compare-section-head">
            <span className="mon-compare-section-title">{section.title}</span>
            <span className="mon-compare-section-count">{section.parents.length} {section.parents.length > 1 ? 'catégories' : 'catégorie'}</span>
          </div>

          <ul className="mon-compare-rows">
            {section.parents.map((group, gi) => {
              const cat = group.parent_cat;
              const rowKey = `${section.kind}::${group.parent_id}`;
              const isExpanded = expandedRows.has(rowKey);
              const delta = group.real_total - group.ref_total;
              const hasDelta = Math.abs(delta) > 0.5;
              const isOver = section.kind === 'expense' ? delta > 0 : delta < 0;
              const txs = isExpanded ? txForParent(group.parent_id) : [];

              // Jauge : le réel se remplit contre la cible (mois type). Trait =
              // cible. Couleur = vert si dans le budget, rose si dépassé.
              const target = group.ref_total || 0;
              const actual = group.real_total || 0;
              const scale = Math.max(target, actual, 1);
              const fillPct = Math.min(100, (actual / scale) * 100);
              const targetPct = target > 0 ? Math.min(100, (target / scale) * 100) : null;
              const noTarget = target <= 0;
              const barColor = noTarget ? 'var(--d6)' : (hasDelta && isOver ? 'var(--negative)' : 'var(--positive)');
              const statusText = noTarget
                ? `${fmt(actual)} dépensé · pas dans ton mois type`
                : !hasDelta
                  ? '✓ pile dans le budget'
                  : section.kind === 'expense'
                    ? (isOver ? `↑ +${fmt(Math.abs(delta))} au-dessus` : `↓ ${fmt(Math.abs(delta))} sous le budget`)
                    : (isOver ? `↓ ${fmt(Math.abs(delta))} sous l'objectif` : `↑ +${fmt(Math.abs(delta))} au-dessus de l'objectif`);

              return (
                <li key={rowKey} className={`mon-compare-row ${isExpanded ? 'is-expanded' : ''}`}>
                  <button
                    className="mon-compare-row-head mcr"
                    onClick={() => toggleRow(rowKey)}
                    aria-expanded={isExpanded}
                  >
                    <div className="mcr-top">
                      <span className="mon-compare-row-chevron" aria-hidden="true">
                        <ChevronRight size={14}/>
                      </span>
                      <span className="mon-compare-row-cat">
                        <span className="mon-compare-row-icon" style={{ background: cat?.color || 'var(--ink-3)' }}>
                          {cat?.icon || '•'}
                        </span>
                        <span className="mon-compare-row-name">{cat?.name || group.parent_id}</span>
                        {group.children.length > 0 && (
                          <span className="mon-compare-row-childcount" title={`${group.children.length} sous-catégorie(s)`}>
                            {group.children.length}
                          </span>
                        )}
                        {group.is_unexpected && <span className="mon-compare-badge">Nouveau</span>}
                      </span>
                      <span className="mcr-amounts num">
                        <span style={{ color: barColor, fontWeight: 600 }}>{fmt(actual)}</span>
                        {!noTarget && <span className="mcr-amounts-target"> / {fmt(target)}</span>}
                      </span>
                    </div>

                    <div className="mcr-bar" role="img" aria-label={statusText}>
                      <span className="mcr-bar-fill" style={{ width: `${fillPct}%`, background: barColor, animationDelay: `${gi * 0.04}s` }}/>
                      {targetPct != null && <span className="mcr-bar-target" style={{ left: `${targetPct}%` }}/>}
                    </div>

                    <div className="mcr-status" style={{ color: barColor }}>{statusText}</div>
                  </button>

                  {isExpanded && (
                    <div className="mon-compare-row-body">
                      {/* Breakdown sous-categories */}
                      {group.children.length > 0 && (
                        <div className="mon-compare-children">
                          <div className="mon-compare-children-title">Sous-catégories</div>
                          <ul className="mon-compare-children-list">
                            {group.children.map(child => {
                              const cdelta = child.real_total - child.ref_total;
                              const chasDelta = Math.abs(cdelta) > 0.5;
                              const cIsOver = section.kind === 'expense' ? cdelta > 0 : cdelta < 0;
                              return (
                                <li key={child.child_id} className="mon-compare-child">
                                  <span className="mon-compare-child-name">
                                    <span className="mon-compare-child-icon">{child.cat?.icon || '•'}</span>
                                    {child.cat?.name || child.child_id}
                                  </span>
                                  <span className="mon-compare-child-amounts">
                                    <span className="mon-compare-row-ref num">{child.ref_total > 0 ? fmt(child.ref_total) : '—'}</span>
                                    <span className="mon-compare-row-arrow">→</span>
                                    <span className="mon-compare-row-real num">{child.real_total > 0 ? fmt(child.real_total) : '—'}</span>
                                  </span>
                                  <span className={`mon-compare-child-delta num ${chasDelta ? (cIsOver ? 'neg' : 'pos') : 'zero'}`}>
                                    {chasDelta ? (
                                      <>{cdelta > 0 ? '+' : ''}{fmt(cdelta)}</>
                                    ) : '±0'}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {/* Transactions du mois */}
                      <div className="mon-compare-tx-title">Transactions ({txs.length})</div>
                      {txs.length === 0 ? (
                        <div className="mon-compare-row-empty">
                          <em>Aucune transaction sur ce mois.</em>
                        </div>
                      ) : (
                        <ul className="mon-compare-tx-list">
                          {txs.map(t => {
                            const txCat = catFor(t.categoryId);
                            const isSubCat = txCat?.parent === group.parent_id;
                            return (
                              <li key={t.id} className="mon-compare-tx">
                                <span className="mon-compare-tx-date">
                                  {(t.date || '').slice(8, 10)}/{(t.date || '').slice(5, 7)}
                                </span>
                                <span className="mon-compare-tx-label" title={t.label}>{t.label || t.merchant || '—'}</span>
                                {isSubCat && txCat && (
                                  <span className="mon-compare-tx-subtag" title={txCat.name}>
                                    {txCat.icon} {txCat.name}
                                  </span>
                                )}
                                <span className={`mon-compare-tx-amount num ${(t.amount || 0) >= 0 ? 'pos' : 'neg'}`}>
                                  {fmt(Math.abs(t.amount || 0))}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

// Petit helper pour afficher le mois en humain ("mai 2026"), en fr-FR.
function monthHumanLabel(monthKey) {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const raw = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  // Capitalise la 1re lettre : "mai 2026" -> "Mai 2026"
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// SankeyCard — encapsule un Sankey + son header (label, KPI strip).
// En mode teaser : Sankey dimme et flouté, overlay invitant a cliquer.
// En mode expanded : tout est visible normalement.
function SankeyCard({ kind, eyebrow, label, subtitle, data, totals, isExpanded, isTeaser, isCompact, onClick, onMaximize, fmt, isNarrow, empty, deltaVs }) {
  const hasData = !empty && data.nodes.length > 0;

  // GSAP crossfade : quand isExpanded toggle, on cache puis re-fade-in
  // le body. Masque le redraw brutal du Sankey Recharts (pas de morphing
  // natif). Sprint GSAP avance 2026-05-20.
  const bodyRef = useRef(null);
  useEffect(() => {
    if (!bodyRef.current) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      bodyRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.42, ease: 'power2.out', delay: 0.06 }
    );
  }, [isExpanded, isCompact]);

  // Hauteur dynamique du Sankey selon le nombre de feuilles. Teaser garde
  // une hauteur compacte pour laisser respirer le layout 50/50.
  const leafCount = data.nodes.filter(n => n.level === 2).length;
  const fullHeight = isNarrow ? 440 : Math.max(440, leafCount * 32 + 80);
  const teaserHeight = 280;
  const sankeyHeight = isExpanded ? fullHeight : teaserHeight;

  // Marges : reduites en compact (50/50 both expanded) ou teaser pour
  // economiser l'espace horizontal — la carte ne fait que ~50% de la largeur.
  const margin = !isExpanded
    ? { top: 16, right: 24, bottom: 16, left: 24 }
    : isCompact
      ? { top: 20, right: isNarrow ? 100 : 130, bottom: 20, left: isNarrow ? 70 : 90 }
      : { top: 24, right: isNarrow ? 130 : 220, bottom: 24, left: isNarrow ? 100 : 160 };

  return (
    <div
      className={`mon-sankey-card ${isExpanded ? 'is-expanded' : 'is-teaser'} mon-sankey-card--${kind}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${label} — ${isExpanded ? 'Réduire' : 'Agrandir'}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      <div className="mon-sankey-card-head">
        <div className="mon-sankey-card-titles">
          {eyebrow && <span className={`mon-sankey-card-eyebrow mon-sankey-card-eyebrow--${kind}`}>{eyebrow}</span>}
          <h3>{label}</h3>
          <span className="mon-sankey-card-subtitle">{subtitle}</span>
        </div>
        {isExpanded && hasData && onMaximize && (
          <button
            type="button"
            className="mon-sankey-card-maximize"
            onClick={(e) => { e.stopPropagation(); onMaximize(); }}
            title="Voir en grand"
            aria-label="Voir en grand"
          >
            <Maximize2 size={14}/>
          </button>
        )}
        {isExpanded && hasData && (
          <div className="mon-sankey-card-stats">
            <div className="mon-sankey-stat">
              <span className="mon-sankey-stat-dot" style={{ background: 'var(--positive)' }}/>
              <span className="mon-sankey-stat-label">Entrées</span>
              <span className="mon-sankey-stat-val">{fmt(totals.income)}</span>
            </div>
            <span className="mon-sankey-stat-arrow">→</span>
            <div className="mon-sankey-stat">
              <span className="mon-sankey-stat-dot" style={{ background: 'var(--negative)' }}/>
              <span className="mon-sankey-stat-label">Dépenses</span>
              <span className="mon-sankey-stat-val">{fmt(totals.expense)}</span>
            </div>
            {totals.saving > 0 && <>
              <span className="mon-sankey-stat-arrow">·</span>
              <div className="mon-sankey-stat">
                <span className="mon-sankey-stat-dot" style={{ background: 'var(--accent)' }}/>
                <span className="mon-sankey-stat-label">Épargne</span>
                <span className="mon-sankey-stat-val">{fmt(totals.saving)}</span>
              </div>
            </>}
          </div>
        )}
        {!isExpanded && hasData && (
          <div className="mon-sankey-card-kpis">
            <span className="mon-sankey-card-kpi">
              <span className="mon-sankey-card-kpi-val num">{fmt(totals.expense)}</span>
              <span className="mon-sankey-card-kpi-label">de dépenses</span>
            </span>
            {typeof deltaVs === 'number' && Math.abs(deltaVs) > 1 && (
              <span className={`mon-sankey-card-delta num ${deltaVs > 0 ? 'neg' : 'pos'}`}>
                {deltaVs > 0 ? '+' : ''}{fmt(deltaVs)} vs habitude
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mon-sankey-card-body" ref={bodyRef} style={{ height: sankeyHeight }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={data}
              nodePadding={!isExpanded ? 10 : isCompact ? (isNarrow ? 12 : 18) : (isNarrow ? 16 : 26)}
              nodeWidth={isExpanded ? (isCompact ? 10 : 14) : 8}
              iterations={64}
              margin={margin}
              node={<SankeyNode fmt={fmt} teaser={isTeaser} compact={isCompact}/>}
              link={<SankeyLink/>}
            >
              {isExpanded && (
                <Tooltip
                  formatter={(v) => fmt(v)}
                  contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, boxShadow: '0 8px 24px -8px rgba(0,0,0,.18)' }}
                />
              )}
            </Sankey>
          </ResponsiveContainer>
        ) : (
          <div className="mon-sankey-card-empty">
            <span>Pas encore de données sur ce mois.</span>
          </div>
        )}

        {/* Overlay teaser : invite a cliquer */}
        {isTeaser && hasData && (
          <div className="mon-sankey-card-overlay">
            <span className="mon-sankey-card-cta">Cliquer pour agrandir →</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SankeyFullscreenModal ─────────────────────────────────────────
// Affiche un Sankey en plein ecran quand l'user clique sur le bouton
// Maximize2 du SankeyCard. Marges genereuses + nodes plus epais pour
// que les labels respirent. ESC + click overlay pour fermer.
function SankeyFullscreenModal({ kind, data, totals, label, eyebrow, fmt, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // Lock body scroll while modal open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Garde anti-crash : si data malformé, on ferme proprement plutôt que de
  // planter le rendu (Recharts <Sankey> jette si nodes/links absents).
  const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
  const links = Array.isArray(data?.links) ? data.links : [];
  const hasData = nodes.length > 0 && links.length > 0;
  const leafCount = nodes.filter(n => n.level === 2).length;
  const sankeyHeight = Math.max(560, leafCount * 38 + 120);
  // Marges responsives : les marges fixes (240/180) rendaient la zone de
  // dessin NÉGATIVE sur mobile → Sankey vide / cassé. On adapte à la largeur.
  const vw = (typeof window !== 'undefined' && window.innerWidth) || 1024;
  const skMargin = vw < 700
    ? { top: 20, right: 96, bottom: 20, left: 70 }
    : { top: 30, right: 240, bottom: 30, left: 180 };

  const content = (
    <div className="sankey-fullscreen-overlay" onClick={onClose}>
      <div className="sankey-fullscreen-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${label} — plein écran`}>
        <header className="sankey-fullscreen-head">
          <div className="sankey-fullscreen-titles">
            {eyebrow && <span className={`mon-sankey-card-eyebrow mon-sankey-card-eyebrow--${kind}`}>{eyebrow}</span>}
            <h2>{label}</h2>
            <div className="sankey-fullscreen-stats">
              <div className="mon-sankey-stat">
                <span className="mon-sankey-stat-dot" style={{ background: 'var(--positive)' }}/>
                <span className="mon-sankey-stat-label">Entrées</span>
                <span className="mon-sankey-stat-val">{fmt(totals.income)}</span>
              </div>
              <span className="mon-sankey-stat-arrow">→</span>
              <div className="mon-sankey-stat">
                <span className="mon-sankey-stat-dot" style={{ background: 'var(--negative)' }}/>
                <span className="mon-sankey-stat-label">Dépenses</span>
                <span className="mon-sankey-stat-val">{fmt(totals.expense)}</span>
              </div>
              {totals.saving > 0 && <>
                <span className="mon-sankey-stat-arrow">·</span>
                <div className="mon-sankey-stat">
                  <span className="mon-sankey-stat-dot" style={{ background: 'var(--accent)' }}/>
                  <span className="mon-sankey-stat-label">Épargne</span>
                  <span className="mon-sankey-stat-val">{fmt(totals.saving)}</span>
                </div>
              </>}
            </div>
          </div>
          <button className="sankey-fullscreen-close" onClick={onClose} aria-label="Fermer">
            <X size={20}/>
          </button>
        </header>
        <div className="sankey-fullscreen-body" style={{ height: hasData ? sankeyHeight : 'auto' }}>
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={data}
                nodePadding={32}
                nodeWidth={18}
                iterations={64}
                margin={skMargin}
                node={<SankeyNode fmt={fmt} teaser={false} compact={false}/>}
                link={<SankeyLink/>}
              >
                <Tooltip
                  formatter={(v) => fmt(v)}
                  contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, boxShadow: '0 8px 24px -8px rgba(0,0,0,.18)' }}
                />
              </Sankey>
            </ResponsiveContainer>
          ) : (
            <p style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-3)' }}>Aucun flux à afficher pour cette période.</p>
          )}
        </div>
      </div>
    </div>
  );

  // Portal au body pour bypasser tout parent avec transform/filter qui
  // casserait position: fixed.
  return createPortal(content, document.body);
}

function SankeyLink({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload, index }) {
  const color  = payload?.color || '#94a3b8';
  const gradId = `sk-g-${index}`;
  const sw     = Math.max(1, linkWidth);
  // Build a thick band path using two offset curves (top edge + bottom edge).
  const half = sw / 2;
  const band =
    `M${sourceX},${sourceY - half}` +
    `C${sourceControlX},${sourceY - half} ${targetControlX},${targetY - half} ${targetX},${targetY - half}` +
    `L${targetX},${targetY + half}` +
    `C${targetControlX},${targetY + half} ${sourceControlX},${sourceY + half} ${sourceX},${sourceY + half}Z`;
  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#22c55e" stopOpacity="0.22"/>
          <stop offset="60%"  stopColor={color}   stopOpacity="0.30"/>
          <stop offset="100%" stopColor={color}   stopOpacity="0.42"/>
        </linearGradient>
      </defs>
      <path d={band} fill={`url(#${gradId})`} stroke="none"/>
    </g>
  );
}

