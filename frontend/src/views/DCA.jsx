// ============================================================================
// DCA — Investissement Programmé
// Plans DCA (Dollar Cost Averaging) : création, suivi, projection compound.
// ============================================================================
import { useState, useMemo, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Plus, TrendingUp, Pause, Play, Trash2, Edit2, X, Check,
  Calendar, Zap, BarChart2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { dcaApi } from '../api.js';
import { useQuotes } from '../hooks/useQuotes.js';
import { Amount } from '../components/ui/Amount.jsx';

// ── helpers ──────────────────────────────────────────────────────────────────

const FREQ_LABEL = { monthly: 'mensuel', quarterly: 'trimestriel', annual: 'annuel' };
const FREQ_MONTHS = { monthly: 1, quarterly: 3, annual: 12 };

const RETURN_PRESETS = [
  { label: 'Prudent 4 %',    value: 4  },
  { label: 'Modéré 7 %',     value: 7  },
  { label: 'Dynamique 10 %', value: 10 },
  { label: 'Agressif 12 %',  value: 12 },
];

/** FV of a recurring PMT over n months at monthly rate r */
function fvPmt(pmt, annualPct, months) {
  const r = annualPct / 100 / 12;
  if (r === 0) return pmt * months;
  return pmt * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
}

/** Build month-by-month projection data for a plan */
function buildProjection(plan, horizonYears) {
  const freqM = FREQ_MONTHS[plan.frequency] || 1;
  const pmt   = plan.amount;
  const r     = plan.expected_return / 100 / 12;
  const years = horizonYears || plan.target_years || 10;
  const totalM = years * 12;

  const data = [];
  let portfolio = 0;
  let invested  = 0;

  for (let m = 1; m <= totalM; m++) {
    if (m % freqM === 0) {
      invested  += pmt;
      portfolio  = r > 0
        ? portfolio * (1 + r) + pmt
        : portfolio + pmt;
    } else if (r > 0) {
      portfolio *= (1 + r);
    }
    if (m % 12 === 0) {
      data.push({
        year: m / 12,
        invested: Math.round(invested),
        portfolio: Math.round(portfolio),
        gains: Math.round(portfolio - invested),
      });
    }
  }
  return data;
}

/** Months elapsed since start_date */
function monthsElapsed(startDate) {
  if (!startDate) return 0;
  const s = new Date(startDate);
  const n = new Date();
  return Math.max(0, (n.getFullYear() - s.getFullYear()) * 12 + (n.getMonth() - s.getMonth()));
}

/** Next payment date given day_of_month */
function nextPaymentDate(dayOfMonth, frequency) {
  const today = new Date();
  const d = dayOfMonth || 1;
  const freqM = FREQ_MONTHS[frequency] || 1;
  let candidate = new Date(today.getFullYear(), today.getMonth(), d);
  if (candidate <= today) candidate = new Date(today.getFullYear(), today.getMonth() + freqM, d);
  return candidate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Amount invested so far based on start_date + frequency */
function capitalInvested(plan) {
  const m = monthsElapsed(plan.start_date);
  const freqM = FREQ_MONTHS[plan.frequency] || 1;
  return Math.floor(m / freqM) * plan.amount;
}

// ── Tooltip personnalisé ─────────────────────────────────────────────────────
function ProjTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const inv = payload.find(p => p.dataKey === 'invested')?.value ?? 0;
  const port = payload.find(p => p.dataKey === 'portfolio')?.value ?? 0;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>An {label}</div>
      <div style={{ color: 'var(--primary)', fontWeight: 700 }}>
        Portefeuille : {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(port)}
      </div>
      <div style={{ color: 'var(--text-secondary)' }}>
        Investi : {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(inv)}
      </div>
      <div style={{ color: 'var(--success)' }}>
        +{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(port - inv)}
      </div>
    </div>
  );
}

// ── Modal création / édition ─────────────────────────────────────────────────
const EMPTY = {
  name: '', ticker: '', asset_name: '', amount: '', currency: 'EUR',
  frequency: 'monthly', day_of_month: 1, account_id: '',
  start_date: new Date().toISOString().slice(0, 10),
  status: 'active', target_years: 10, expected_return: 7, notes: '',
};

function PlanModal({ plan, accounts, members, onSave, onClose }) {
  const [d, setD] = useState(plan ? {
    ...EMPTY, ...plan,
    amount: plan.amount ?? '',
    day_of_month: plan.day_of_month ?? 1,
  } : { ...EMPTY });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setD(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!d.name || !d.amount) return;
    setSaving(true);
    try {
      const payload = { ...d, amount: parseFloat(d.amount) || 0, day_of_month: parseInt(d.day_of_month) || 1 };
      await onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{plan?.id ? 'Modifier le plan' : 'Nouveau plan DCA'}</h2>
          <button className="icon-btn-sm" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">

          <label><span>Nom du plan</span>
            <input value={d.name} onChange={e => set('name', e.target.value)}
              placeholder="ex: DCA ETF Monde mensuel" autoFocus/>
          </label>

          <div className="field-row">
            <label><span>Ticker Bloomberg / Yahoo</span>
              <input value={d.ticker} onChange={e => set('ticker', e.target.value.toUpperCase())}
                placeholder="CW8.PA, SP500, BTC-EUR…"
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}/>
            </label>
            <label><span>Libellé (si pas de ticker)</span>
              <input value={d.asset_name} onChange={e => set('asset_name', e.target.value)}
                placeholder="MSCI World Amundi"/>
            </label>
          </div>

          <div className="field-row">
            <label><span>Montant / versement</span>
              <input type="number" value={d.amount} onChange={e => set('amount', e.target.value)}
                placeholder="300" step="any" min="1"/>
            </label>
            <label><span>Devise</span>
              <select value={d.currency} onChange={e => set('currency', e.target.value)}>
                <option value="EUR">🇪🇺 EUR</option>
                <option value="USD">🇺🇸 USD</option>
                <option value="GBP">🇬🇧 GBP</option>
                <option value="CHF">🇨🇭 CHF</option>
              </select>
            </label>
          </div>

          <div className="field-row">
            <label><span>Fréquence</span>
              <select value={d.frequency} onChange={e => set('frequency', e.target.value)}>
                <option value="monthly">Mensuel</option>
                <option value="quarterly">Trimestriel</option>
                <option value="annual">Annuel</option>
              </select>
            </label>
            <label><span>Jour du mois</span>
              <input type="number" value={d.day_of_month} onChange={e => set('day_of_month', e.target.value)}
                min="1" max="28"/>
            </label>
          </div>

          <div className="field-row">
            <label><span>Compte de débit</span>
              <select value={d.account_id} onChange={e => set('account_id', e.target.value)}>
                <option value="">— Aucun —</option>
                {(accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label><span>Date de démarrage</span>
              <input type="date" value={d.start_date} onChange={e => set('start_date', e.target.value)}/>
            </label>
          </div>

          <div className="field-row">
            <label><span>Horizon de projection (ans)</span>
              <input type="number" value={d.target_years} onChange={e => set('target_years', e.target.value)}
                min="1" max="40"/>
            </label>
            <label>
              <span>Rendement annuel estimé (%)</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {RETURN_PRESETS.map(p => (
                  <button key={p.value} type="button"
                    onClick={() => set('expected_return', p.value)}
                    style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 11, border: '1px solid var(--border)',
                      background: d.expected_return === p.value ? 'var(--primary)' : 'transparent',
                      color: d.expected_return === p.value ? '#0a0b0e' : 'var(--text-secondary)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>{p.label}
                  </button>
                ))}
              </div>
            </label>
          </div>

          <label><span>Notes</span>
            <textarea value={d.notes} onChange={e => set('notes', e.target.value)}
              rows={2} placeholder="Stratégie, règle de rééquilibrage…"/>
          </label>
        </div>
        <div className="modal-footer">
          <button className="secondary-btn" onClick={onClose}>Annuler</button>
          <button className="primary-btn" onClick={submit} disabled={saving || !d.name || !d.amount}>
            <Check size={14}/> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Plan card ────────────────────────────────────────────────────────────────
function PlanCard({ plan, accounts, quotes, onEdit, onToggle, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [horizon, setHorizon] = useState(plan.target_years || 10);

  const acc = accounts?.find(a => a.id === plan.account_id);
  const quote = plan.ticker ? quotes?.[plan.ticker] : null;
  const invested = capitalInvested(plan);
  const projData = useMemo(() => buildProjection(plan, horizon), [plan, horizon]);
  const fv = projData[projData.length - 1]?.portfolio ?? 0;
  const totalInvested = projData[projData.length - 1]?.invested ?? 0;
  const multiplier = totalInvested > 0 ? fv / totalInvested : 1;
  const freqM = FREQ_MONTHS[plan.frequency] || 1;

  const fmt = v => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: plan.currency || 'EUR', maximumFractionDigits: 0 }).format(v);

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden',
      opacity: plan.status === 'paused' ? 0.7 : 1,
      borderLeft: plan.status === 'active' ? '3px solid var(--primary)' : '3px solid var(--border)',
    }}>
      {/* Card header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em',
        }}>
          {plan.ticker || (plan.asset_name?.[0] ?? '?')}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
            {plan.name}
            {plan.status === 'paused' && (
              <span style={{ marginLeft: 8, fontSize: 10, background: 'var(--border)', color: 'var(--text-tertiary)', padding: '2px 6px', borderRadius: 4 }}>PAUSE</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--primary)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(plan.amount)} / {FREQ_LABEL[plan.frequency]}
            </span>
            {acc && <span>· {acc.name}</span>}
            {plan.start_date && <span>· depuis {new Date(plan.start_date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span>}
            {quote && <span style={{ color: 'var(--success)' }}>· {fmt(quote.price)}</span>}
          </div>
        </div>

        {/* KPIs inline */}
        <div style={{ display: 'flex', gap: 20, textAlign: 'right', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>INVESTI</div>
            <div style={{ fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{fmt(invested)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>PROJETÉ {horizon}A</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(fv)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>×</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--success)' }}>×{multiplier.toFixed(1)}</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button className="icon-btn-sm" onClick={() => setExpanded(e => !e)} title="Voir la projection">
            {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
          <button className="icon-btn-sm" onClick={() => onEdit(plan)} title="Modifier"><Edit2 size={13}/></button>
          <button className="icon-btn-sm" onClick={() => onToggle(plan)} title={plan.status === 'active' ? 'Mettre en pause' : 'Reprendre'}>
            {plan.status === 'active' ? <Pause size={13}/> : <Play size={13}/>}
          </button>
          <button className="icon-btn-sm" style={{ color: 'var(--danger)' }} onClick={() => onDelete(plan)} title="Supprimer">
            <Trash2 size={13}/>
          </button>
        </div>
      </div>

      {/* Expanded — projection chart */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px 20px' }}>
          {/* Horizon tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 4 }}>Horizon</span>
            {[5, 10, 20, 30].filter(y => y <= 40).map(y => (
              <button key={y} onClick={() => setHorizon(y)}
                style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 11, border: '1px solid var(--border)',
                  background: horizon === y ? 'var(--primary)' : 'transparent',
                  color: horizon === y ? '#0a0b0e' : 'var(--text-secondary)',
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: horizon === y ? 700 : 400,
                }}>
                {y} ans
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
              Taux : <strong style={{ color: 'var(--text-primary)' }}>{plan.expected_return} %</strong> / an
            </span>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={projData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`gPort${plan.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id={`gInv${plan.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--text-tertiary)" stopOpacity={0.12}/>
                  <stop offset="95%" stopColor="var(--text-tertiary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4}/>
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                tickFormatter={v => `${v}a`} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                axisLine={false} tickLine={false} width={36}/>
              <Tooltip content={<ProjTooltip/>}/>
              <Area type="monotone" dataKey="invested" stroke="var(--text-tertiary)"
                strokeWidth={1} fill={`url(#gInv${plan.id})`} strokeDasharray="4 2"/>
              <Area type="monotone" dataKey="portfolio" stroke="var(--primary)"
                strokeWidth={2} fill={`url(#gPort${plan.id})`}/>
            </AreaChart>
          </ResponsiveContainer>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 14 }}>
            {[
              { label: 'Capital investi', value: fmt(totalInvested) },
              { label: 'Valeur projetée', value: fmt(fv), gold: true },
              { label: 'Gains composés', value: fmt(fv - totalInvested), green: true },
              { label: 'Multiplicateur', value: `×${multiplier.toFixed(2)}`, green: true },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>{s.label.toUpperCase()}</div>
                <div style={{
                  fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums',
                  color: s.gold ? 'var(--primary)' : s.green ? 'var(--success)' : 'var(--text-primary)',
                }}>{s.value}</div>
              </div>
            ))}
          </div>

          {plan.notes && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              {plan.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────
export function DCAView({ accounts = [], members = [], dcaPlans = [], onPlansChange }) {
  const [modal, setModal] = useState(null); // null | 'new' | plan object
  const [toast, setToast] = useState(null);

  const activePlans  = dcaPlans.filter(p => p.status !== 'stopped');
  const tickers = useMemo(() => activePlans.map(p => p.ticker).filter(Boolean), [activePlans]);
  const { quotes } = useQuotes(tickers);

  const notify = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const reload = useCallback(async () => {
    try {
      const list = await dcaApi.list();
      onPlansChange(list);
    } catch (e) {
      notify(e.message, false);
    }
  }, [onPlansChange]);

  const handleSave = async (data) => {
    try {
      if (data.id) await dcaApi.update(data.id, data);
      else await dcaApi.create(data);
      await reload();
      notify(data.id ? 'Plan mis à jour' : 'Plan créé');
    } catch (e) { notify(e.message, false); }
  };

  const handleToggle = async (plan) => {
    const next = plan.status === 'active' ? 'paused' : 'active';
    try {
      await dcaApi.update(plan.id, { ...plan, status: next });
      await reload();
    } catch (e) { notify(e.message, false); }
  };

  const handleDelete = async (plan) => {
    if (!confirm(`Supprimer "${plan.name}" ?`)) return;
    try {
      await dcaApi.remove(plan.id);
      await reload();
      notify('Plan supprimé');
    } catch (e) { notify(e.message, false); }
  };

  // Summary KPIs
  const totalMonthly = activePlans
    .filter(p => p.status === 'active')
    .reduce((s, p) => {
      const m = FREQ_MONTHS[p.frequency] || 1;
      return s + p.amount / m;
    }, 0);

  const totalProjected10 = activePlans
    .filter(p => p.status === 'active')
    .reduce((s, p) => s + (buildProjection(p, 10).at(-1)?.portfolio ?? 0), 0);

  const totalInvestedSoFar = activePlans.reduce((s, p) => s + capitalInvested(p), 0);

  const nextDates = activePlans
    .filter(p => p.status === 'active')
    .map(p => ({ name: p.name, date: nextPaymentDate(p.day_of_month, p.frequency), amount: p.amount, currency: p.currency }))
    .slice(0, 6);

  const fmt0 = v => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="dca-view">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.ok ? 'var(--success)' : 'var(--danger)',
          color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
        }}>{toast.msg}</div>
      )}

      <div className="subview-header">
        <div>
          <h1>Vos <em>plans DCA.</em></h1>
          <p>Versements automatiques et projection par intérêts composés.</p>
        </div>
        <button className="primary-btn" onClick={() => setModal('new')} style={{ flexShrink: 0 }}>
          <Plus size={14}/> Nouveau plan
        </button>
      </div>

      {activePlans.length > 0 && (
        <div className="dca-kpis">
          {[
            { label: 'Versement mensuel équiv.', value: fmt0(totalMonthly), icon: <Calendar size={13}/> },
            { label: 'Capital investi à ce jour', value: fmt0(totalInvestedSoFar), icon: <BarChart2 size={13}/> },
            { label: 'Projection 10 ans (composé)', value: fmt0(totalProjected10), icon: <TrendingUp size={13}/>, accent: true },
            { label: 'Plans actifs', value: activePlans.filter(p => p.status === 'active').length, icon: <Zap size={13}/> },
          ].map(k => (
            <div key={k.label} className="dca-kpi">
              <div className="dca-kpi-label">{k.icon} {k.label}</div>
              <div className={`dca-kpi-value ${k.accent ? 'is-accent' : ''}`}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <section className="card">
        <div className="card-header">
          <h3><TrendingUp size={14}/> Plans actifs</h3>
          <span className="card-meta">{activePlans.length} plan{activePlans.length > 1 ? 's' : ''}</span>
        </div>
        {activePlans.length === 0 ? (
          <div className="empty-mini">
            <TrendingUp size={24}/>
            <p>Aucun plan DCA configuré. Créez votre premier plan pour visualiser la projection de vos versements.</p>
            <button className="primary-btn" style={{ marginTop: 8 }} onClick={() => setModal('new')}>
              <Plus size={14}/> Créer un plan
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activePlans.map(p => (
              <PlanCard key={p.id} plan={p} accounts={accounts} quotes={quotes}
                onEdit={setModal} onToggle={handleToggle} onDelete={handleDelete}/>
            ))}
          </div>
        )}
      </section>

      {nextDates.length > 0 && (
        <section className="card">
          <div className="card-header">
            <h3><Calendar size={14}/> Prochains versements</h3>
            <span className="card-meta">{nextDates.length} à venir</span>
          </div>
          <div className="dca-next-grid">
            {nextDates.map((nd, i) => (
              <div key={i} className="dca-next-card">
                <div className="dca-next-date"><Calendar size={10}/> {nd.date}</div>
                <div className="dca-next-name">{nd.name}</div>
                <div className="dca-next-amount">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: nd.currency || 'EUR' }).format(nd.amount)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modal */}
      {modal && (
        <PlanModal
          plan={modal === 'new' ? null : modal}
          accounts={accounts}
          members={members}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
