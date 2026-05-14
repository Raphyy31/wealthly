// ============================================================================
// DCA — Investissement Programmé
// Plans DCA (Dollar Cost Averaging) : création, suivi, projection compound.
// ============================================================================
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Plus, TrendingUp, Pause, Play, Trash2, Edit2, X, Check,
  Calendar, ChevronDown, ChevronUp,
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

/** Format a Date as YYYY-MM (local time, matches user expectations). */
function monthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Is the contribution due in this elapsed month treated as paid?
 *  Missing key = paid (default). Explicit false = skipped. */
function isMonthPaid(executions, key) {
  if (!executions) return true;
  return executions[key] !== false;
}

/** List of month keys (YYYY-MM) where a contribution was due between
 *  start_date and today, given the frequency. The first contribution is at
 *  start_date's month, then every freqM months. */
function dueMonthKeys(plan) {
  if (!plan.start_date) return [];
  const start = new Date(plan.start_date);
  const startY = start.getFullYear();
  const startM = start.getMonth();
  const now = new Date();
  const elapsed = Math.max(0, (now.getFullYear() - startY) * 12 + (now.getMonth() - startM));
  const freqM = FREQ_MONTHS[plan.frequency] || 1;
  const keys = [];
  for (let i = 0; i <= elapsed; i += freqM) {
    const d = new Date(startY, startM + i, 1);
    keys.push(monthKey(d));
  }
  return keys;
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

/** Sum per-plan projections into one aggregated timeline. */
function aggregateProjections(plans, horizonYears) {
  if (!plans.length) return [];
  const series = plans.map(p => buildProjection(p, horizonYears));
  const out = [];
  for (let y = 0; y < horizonYears; y++) {
    let invested = 0, portfolio = 0;
    series.forEach(s => {
      const row = s[y];
      if (row) { invested += row.invested; portfolio += row.portfolio; }
    });
    out.push({ year: y + 1, invested, portfolio, gains: portfolio - invested });
  }
  return out;
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
/** Estimated portfolio value as of today: project from start_date for the
 *  number of months elapsed, applying compound returns each month. Returns
 *  { invested, value, gain } based on what the user has actually paid in. */
function currentState(plan) {
  if (!plan.start_date) return { invested: 0, value: 0, gain: 0 };
  const months = monthsElapsed(plan.start_date);
  const freqM = FREQ_MONTHS[plan.frequency] || 1;
  const r = (plan.expected_return || 0) / 100 / 12;
  const start = new Date(plan.start_date);
  const startY = start.getFullYear();
  const startM = start.getMonth();
  const exec = plan.executions || {};
  let invested = 0;
  let portfolio = 0;
  for (let m = 1; m <= months; m++) {
    if (m % freqM === 0) {
      const d = new Date(startY, startM + m, 1);
      const key = monthKey(d);
      if (isMonthPaid(exec, key)) {
        invested += plan.amount;
        portfolio = r > 0 ? portfolio * (1 + r) + plan.amount : portfolio + plan.amount;
      } else if (r > 0) {
        portfolio *= (1 + r);
      }
    } else if (r > 0) {
      portfolio *= (1 + r);
    }
  }
  return { invested: Math.round(invested), value: Math.round(portfolio), gain: Math.round(portfolio - invested) };
}

function capitalInvested(plan) {
  const m = monthsElapsed(plan.start_date);
  const freqM = FREQ_MONTHS[plan.frequency] || 1;
  return Math.floor(m / freqM) * plan.amount;
}

/** Mark-to-market value when a live quote is available.
 *  We don't track historical purchase prices, so we approximate the share
 *  count by discounting the current price back through time at the plan's
 *  expected return rate. For each past contribution at month m (counted
 *  from start), the estimated unit price was: price_now / (1+r)^(months-m).
 *  shares_added = amount / est_price ; total_value = shares × price_now.
 *  This converges to the theoretical value if real performance matched
 *  expected_return, and diverges to reflect actual market moves otherwise. */
function realCurrentState(plan, price) {
  if (!price || price <= 0) return null;
  if (!plan.start_date) return { invested: 0, value: 0, gain: 0, shares: 0 };
  const months = monthsElapsed(plan.start_date);
  const freqM = FREQ_MONTHS[plan.frequency] || 1;
  const r = (plan.expected_return || 0) / 100 / 12;
  const start = new Date(plan.start_date);
  const startY = start.getFullYear();
  const startM = start.getMonth();
  const exec = plan.executions || {};
  let invested = 0;
  let shares = 0;
  for (let m = 1; m <= months; m++) {
    if (m % freqM === 0) {
      const d = new Date(startY, startM + m, 1);
      const key = monthKey(d);
      if (!isMonthPaid(exec, key)) continue;
      invested += plan.amount;
      // months elapsed since this contribution = months - m
      const estPriceThen = r > 0 ? price / Math.pow(1 + r, months - m) : price;
      shares += plan.amount / estPriceThen;
    }
  }
  const value = shares * price;
  return { invested: Math.round(invested), value: Math.round(value), gain: Math.round(value - invested), shares };
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
  const { t } = useTranslation();
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
          <h2>{plan?.id ? t('dca.editPlan') : t('dca.newPlanTitle')}</h2>
          <button className="icon-btn-sm" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">

          <label><span>{t('dca.planName')}</span>
            <input value={d.name} onChange={e => set('name', e.target.value)}
              placeholder={t('dca.planNamePh')} autoFocus/>
          </label>

          <div className="field-row">
            <label><span>{t('dca.tickerLabel')}</span>
              <input value={d.ticker} onChange={e => set('ticker', e.target.value.toUpperCase())}
                placeholder="CW8.PA, SP500, BTC-EUR…"
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}/>
            </label>
            <label><span>{t('dca.assetLabel')}</span>
              <input value={d.asset_name} onChange={e => set('asset_name', e.target.value)}
                placeholder="MSCI World Amundi"/>
            </label>
          </div>

          <div className="field-row">
            <label><span>{t('dca.amountPer')}</span>
              <input type="number" value={d.amount} onChange={e => set('amount', e.target.value)}
                placeholder="300" step="any" min="1"/>
            </label>
            <label><span>{t('dca.currency')}</span>
              <select value={d.currency} onChange={e => set('currency', e.target.value)}>
                <option value="EUR">🇪🇺 EUR</option>
                <option value="USD">🇺🇸 USD</option>
                <option value="GBP">🇬🇧 GBP</option>
                <option value="CHF">🇨🇭 CHF</option>
              </select>
            </label>
          </div>

          <div className="field-row">
            <label><span>{t('dca.frequency')}</span>
              <select value={d.frequency} onChange={e => set('frequency', e.target.value)}>
                <option value="monthly">{t('dca.frequencyMonthly')}</option>
                <option value="quarterly">{t('dca.frequencyQuarterly')}</option>
                <option value="annual">{t('dca.frequencyAnnual')}</option>
              </select>
            </label>
            <label><span>{t('dca.dayOfMonth')}</span>
              <input type="number" value={d.day_of_month} onChange={e => set('day_of_month', e.target.value)}
                min="1" max="28"/>
            </label>
          </div>

          <div className="field-row">
            <label><span>{t('dca.debitAccount')}</span>
              <select value={d.account_id} onChange={e => set('account_id', e.target.value)}>
                <option value="">{t('dca.noneOption')}</option>
                {(accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label><span>{t('dca.startDate')}</span>
              <input type="date" value={d.start_date} onChange={e => set('start_date', e.target.value)}/>
            </label>
          </div>

          <div className="field-row">
            <label><span>{t('dca.horizonYears')}</span>
              <input type="number" value={d.target_years} onChange={e => set('target_years', e.target.value)}
                min="1" max="40"/>
            </label>
            <label>
              <span>{t('dca.expectedReturn')}</span>
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

          <label><span>{t('dca.notes')}</span>
            <textarea value={d.notes} onChange={e => set('notes', e.target.value)}
              rows={2} placeholder={t('dca.notesPh')}/>
          </label>
        </div>
        <div className="modal-footer">
          <button className="secondary-btn" onClick={onClose}>{t('actions.cancel')}</button>
          <button className="primary-btn" onClick={submit} disabled={saving || !d.name || !d.amount}>
            <Check size={14}/> {saving ? t('actions.saving') : t('actions.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Plan card ────────────────────────────────────────────────────────────────
function PlanCard({ plan, accounts, quotes, onEdit, onToggle, onDelete, onSetExecutions }) {
  const { t } = useTranslation();
  const FREQ_LABEL_LOCAL = { monthly: t('dca.perFrequencyMonthly'), quarterly: t('dca.perFrequencyQuarterly'), annual: t('dca.perFrequencyAnnual') };
  const [expanded, setExpanded] = useState(false);
  const [horizon, setHorizon] = useState(plan.target_years || 10);

  const executions = plan.executions || {};
  const skippedCount = Object.values(executions).filter(v => v === false).length;

  const dueKeys = useMemo(() => dueMonthKeys(plan), [plan.start_date, plan.frequency]);
  // Last 12 due months (or all if shorter), ordered oldest → newest
  const timelineKeys = dueKeys.slice(-12);

  const toggleMonth = (key) => {
    const next = { ...executions };
    // Default = paid (true). Click = mark as skipped. Click again = back to paid.
    if (next[key] === false) delete next[key];
    else next[key] = false;
    onSetExecutions?.(plan, next);
  };

  const acc = accounts?.find(a => a.id === plan.account_id);
  const tickerKey = (plan.ticker || '').trim().toUpperCase();
  const quote = tickerKey ? quotes?.[tickerKey] : null;
  const real = useMemo(() => quote ? realCurrentState(plan, quote.price) : null, [plan, quote]);
  const theoretical = useMemo(() => currentState(plan), [plan]);
  const isReal = !!real;
  const currentValue = isReal ? real.value : theoretical.value;
  const currentInvested = isReal ? real.invested : theoretical.invested;
  const currentGain = isReal ? real.gain : theoretical.gain;

  const projData = useMemo(() => buildProjection(plan, horizon), [plan, horizon]);
  const fv = projData[projData.length - 1]?.portfolio ?? 0;
  const totalInvested = projData[projData.length - 1]?.invested ?? 0;
  const multiplier = totalInvested > 0 ? fv / totalInvested : 1;

  const fmt = v => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: plan.currency || 'EUR', maximumFractionDigits: 0 }).format(v);

  return (
    <section
      className="card"
      style={{ opacity: plan.status === 'paused' ? 0.72 : 1 }}
    >
      {/* Canonical card header */}
      <div className="card-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {tickerKey && (
            <span style={{
              fontFamily: 'Geist Mono, ui-monospace, Menlo, monospace',
              fontSize: 10.5, fontWeight: 700, color: 'var(--accent)',
              letterSpacing: '0.04em', padding: '2px 6px',
              background: 'var(--accent-soft)', borderRadius: 4,
            }}>{tickerKey}</span>
          )}
          <span style={{ color: 'var(--accent)' }}>{plan.name}</span>
          {plan.status === 'paused' && (
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
              background: 'var(--border)', color: 'var(--text-tertiary)',
              padding: '2px 6px', borderRadius: 4,
            }}>{t('dca.paused')}</span>
          )}
        </h3>
        <span className="card-meta">
          {fmt(plan.amount)} / {FREQ_LABEL_LOCAL[plan.frequency]}
          {acc && <> · {acc.name}</>}
          {plan.start_date && <> · {t('dca.since', { date: new Date(plan.start_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) })}</>}
          {quote && <> · {t('dca.price', { price: fmt(quote.price) })}</>}
          {skippedCount > 0 && (
            <> · <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
              {t('dca.monthsSkipped', { count: skippedCount })}
            </span></>
          )}
        </span>
      </div>

      {/* Body — KPI row + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 28, flex: 1, minWidth: 0 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }}>{t('dca.invested')}</div>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{fmt(currentInvested)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }}>
              {isReal ? t('dca.currentValue') : t('dca.theoreticalValue')}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums', color: 'var(--accent)' }}>
              {fmt(currentValue)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }}>{t('dca.plusValue')}</div>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums', color: currentGain >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
              {currentGain >= 0 ? '+' : ''}{fmt(currentGain)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }}>{t('dca.projectedFor', { n: horizon })}</div>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{fmt(fv)} <span style={{ color: 'var(--positive)', fontSize: 13, marginLeft: 4 }}>×{multiplier.toFixed(1)}</span></div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button className="icon-btn-sm" onClick={() => setExpanded(e => !e)} title={t('dca.viewProjection')}>
            {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
          <button className="icon-btn-sm" onClick={() => onEdit(plan)} title={t('actions.edit')}><Edit2 size={13}/></button>
          <button className="icon-btn-sm" onClick={() => onToggle(plan)} title={plan.status === 'active' ? t('dca.pause') : t('dca.resume')}>
            {plan.status === 'active' ? <Pause size={13}/> : <Play size={13}/>}
          </button>
          <button className="icon-btn-sm" style={{ color: 'var(--danger)' }} onClick={() => onDelete(plan)} title={t('actions.delete')}>
            <Trash2 size={13}/>
          </button>
        </div>
      </div>

      {/* Expanded — projection chart */}
      {expanded && (
        <div style={{ borderTop: '1px dotted var(--border)', marginTop: 16, paddingTop: 16 }}>
          {/* Horizon tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 4 }}>{t('dca.horizon')}</span>
            {[5, 10, 20, 30].filter(y => y <= 40).map(y => (
              <button key={y} onClick={() => setHorizon(y)}
                style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 11, border: '1px solid var(--border)',
                  background: horizon === y ? 'var(--primary)' : 'transparent',
                  color: horizon === y ? '#0a0b0e' : 'var(--text-secondary)',
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: horizon === y ? 700 : 400,
                }}>
                {t('dca.years', { n: y })}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
              {t('dca.rate')} : <strong style={{ color: 'var(--text-primary)' }}>{plan.expected_return} %</strong> {t('dca.perYear')}
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
              { label: t('dca.capitalInvestedShort'), value: fmt(totalInvested) },
              { label: t('dca.projectedValue'), value: fmt(fv), gold: true },
              { label: t('dca.compoundGains'), value: fmt(fv - totalInvested), green: true },
              { label: t('dca.multiplier'), value: `×${multiplier.toFixed(2)}`, green: true },
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

          {/* Versements — timeline des derniers 12 mois dus */}
          {timelineKeys.length > 0 && onSetExecutions && (
            <div style={{ marginTop: 18 }}>
              <div style={{
                fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--text-tertiary)',
                marginBottom: 8,
              }}>
                Versements
                {skippedCount > 0 && (
                  <span style={{ color: 'var(--warning)', marginLeft: 8, letterSpacing: '0.02em', textTransform: 'none', fontWeight: 500 }}>
                    · {skippedCount} sauté{skippedCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {timelineKeys.map(key => {
                  const paid = isMonthPaid(executions, key);
                  const [y, m] = key.split('-').map(Number);
                  const label = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleMonth(key)}
                      title={paid ? 'Versement payé — cliquer pour marquer comme sauté' : 'Versement sauté — cliquer pour rétablir'}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 8px', borderRadius: 6, fontSize: 11.5,
                        fontFamily: 'inherit', cursor: 'pointer',
                        border: `1px solid ${paid ? 'var(--border)' : 'var(--negative)'}`,
                        background: paid ? 'var(--bg-elev)' : 'transparent',
                        color: paid ? 'var(--ink)' : 'var(--negative)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {paid
                        ? <Check size={11} style={{ color: 'var(--accent)' }}/>
                        : <X size={11} style={{ color: 'var(--negative)' }}/>}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {plan.notes && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              {plan.notes}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Aggregated projection hero ───────────────────────────────────────────────
function ProjectionHero({ plans, quotes, fmt0 }) {
  const { t } = useTranslation();
  const [horizon, setHorizon] = useState(10);
  // Plan filter: Set of plan IDs to include. null = all plans.
  const [selectedIds, setSelectedIds] = useState(null);

  const includedPlans = useMemo(
    () => selectedIds === null ? plans : plans.filter(p => selectedIds.has(p.id)),
    [plans, selectedIds]
  );

  const data = useMemo(() => aggregateProjections(includedPlans, horizon), [includedPlans, horizon]);
  const last = data[data.length - 1] || { invested: 0, portfolio: 0, gains: 0 };

  // Current state aggregated across included plans — prefer real quote when
  // available, fall back to the theoretical compound projection otherwise.
  const today = useMemo(() => {
    let allReal = includedPlans.length > 0;
    const agg = includedPlans.reduce(
      (acc, p) => {
        const tk = (p.ticker || '').trim().toUpperCase();
        const q = tk ? quotes?.[tk] : null;
        const s = q ? realCurrentState(p, q.price) : currentState(p);
        if (!q) allReal = false;
        return { invested: acc.invested + s.invested, value: acc.value + s.value, gain: acc.gain + s.gain };
      },
      { invested: 0, value: 0, gain: 0 }
    );
    return { ...agg, allReal };
  }, [includedPlans, quotes]);

  // Aggregated monthly equivalent contribution for included plans
  const monthlyEquiv = useMemo(
    () => includedPlans.reduce((s, p) => s + p.amount / (FREQ_MONTHS[p.frequency] || 1), 0),
    [includedPlans]
  );

  const togglePlan = (id) => {
    setSelectedIds(prev => {
      const current = prev === null ? new Set(plans.map(p => p.id)) : new Set(prev);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      // If all selected, collapse back to null (= "Tous")
      if (current.size === plans.length) return null;
      if (current.size === 0) return null; // never end on empty — fall back to all
      return current;
    });
  };

  const isAll = selectedIds === null;

  return (
    <section className="card dca-hero">
      <div className="card-header">
        <h3><TrendingUp size={14}/> {t('dca.globalProjection')}</h3>
        <div className="dca-horizon">
          {[5, 10, 20, 30].map(y => (
            <button
              key={y}
              className={`dca-horizon-tab ${horizon === y ? 'is-active' : ''}`}
              onClick={() => setHorizon(y)}
            >
              {t('dca.years', { n: y })}
            </button>
          ))}
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="empty-mini">
          <TrendingUp size={24}/>
          <p>{t('dca.projectionEmpty')}</p>
        </div>
      ) : (
        <>
          {plans.length > 1 && (
            <div className="dca-filter">
              <span className="dca-filter-label">{t('dca.plansIncluded')}</span>
              <button
                className={`dca-chip ${isAll ? 'is-active' : ''}`}
                onClick={() => setSelectedIds(null)}
              >
                {t('dca.all')}
              </button>
              {plans.map(p => {
                const active = isAll || selectedIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    className={`dca-chip ${active ? 'is-active' : ''}`}
                    onClick={() => togglePlan(p.id)}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Two-column KPI strip: today vs horizon */}
          <div className="dca-state-grid">
            <div className="dca-state-block">
              <div className="dca-state-eyebrow">{t('dca.stateAs', { date: new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) })}</div>
              <div className="dca-state-row">
                <div className="dca-state-kpi">
                  <div className="dca-state-kpi-label">{t('dca.investedToDate')}</div>
                  <div className="dca-state-kpi-value">{fmt0(today.invested)}</div>
                </div>
                <div className="dca-state-kpi">
                  <div className="dca-state-kpi-label">{today.allReal ? t('dca.currentValue') : t('dca.theoreticalValue')}</div>
                  <div className="dca-state-kpi-value is-accent">{fmt0(today.value)}</div>
                </div>
                <div className="dca-state-kpi">
                  <div className="dca-state-kpi-label">{t('dca.unrealizedGain')}</div>
                  <div className={`dca-state-kpi-value ${today.gain >= 0 ? 'is-positive' : 'is-negative'}`}>
                    {today.gain >= 0 ? '+' : ''}{fmt0(today.gain)}
                  </div>
                </div>
              </div>
            </div>
            <div className="dca-state-block">
              <div className="dca-state-eyebrow">{t('dca.projectionIn', { years: horizon })}</div>
              <div className="dca-state-row">
                <div className="dca-state-kpi">
                  <div className="dca-state-kpi-label">{t('dca.monthlyEquiv')}</div>
                  <div className="dca-state-kpi-value">{fmt0(monthlyEquiv)}</div>
                </div>
                <div className="dca-state-kpi">
                  <div className="dca-state-kpi-label">{t('dca.capitalInvested')}</div>
                  <div className="dca-state-kpi-value">{fmt0(last.invested)}</div>
                </div>
                <div className="dca-state-kpi">
                  <div className="dca-state-kpi-label">{t('dca.projectedValue')}</div>
                  <div className="dca-state-kpi-value is-accent">{fmt0(last.portfolio)}</div>
                </div>
                <div className="dca-state-kpi">
                  <div className="dca-state-kpi-label">{t('dca.compoundGains')}</div>
                  <div className="dca-state-kpi-value is-positive">+{fmt0(last.gains)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="dca-chart-wrap">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gAggPort" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28}/>
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" strokeOpacity={0.5} vertical={false}/>
                <XAxis dataKey="year" tick={{ fontSize: 10.5, fill: 'var(--text-tertiary)' }}
                  tickFormatter={v => `${v}a`} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 10.5, fill: 'var(--text-tertiary)' }}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k €` : `${v} €`}
                  axisLine={false} tickLine={false} width={56}/>
                <Tooltip content={<ProjTooltip/>}/>
                <Area type="monotone" dataKey="invested" stroke="var(--text-tertiary)"
                  strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" name="Capital versé"/>
                <Area type="monotone" dataKey="portfolio" stroke="var(--accent)"
                  strokeWidth={2.5} fill="url(#gAggPort)" name="Valeur projetée"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="dca-legend">
            <span className="dca-legend-item">
              <span className="dca-legend-swatch is-accent"/>Valeur projetée
            </span>
            <span className="dca-legend-item">
              <span className="dca-legend-swatch is-dashed"/>Capital versé
            </span>
          </div>
        </>
      )}
    </section>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────
export function DCAView({ accounts = [], members = [], dcaPlans = [], onPlansChange }) {
  const { t } = useTranslation();
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
      notify(data.id ? t('toasts.planUpdated') : t('toasts.planCreated'));
    } catch (e) { notify(e.message, false); }
  };

  const handleToggle = async (plan) => {
    const next = plan.status === 'active' ? 'paused' : 'active';
    try {
      await dcaApi.update(plan.id, { ...plan, status: next });
      await reload();
    } catch (e) { notify(e.message, false); }
  };

  const handleSetExecutions = async (plan, executions) => {
    // Optimistic update so the timeline reacts instantly.
    onPlansChange(dcaPlans.map(p => p.id === plan.id ? { ...p, executions } : p));
    try {
      await dcaApi.setExecutions(plan.id, executions);
    } catch (e) {
      notify(e.message, false);
      await reload();
    }
  };

  const handleDelete = async (plan) => {
    if (!confirm(t('confirms.deletePlan', { name: plan.name }))) return;
    try {
      await dcaApi.remove(plan.id);
      await reload();
      notify(t('toasts.planDeleted'));
    } catch (e) { notify(e.message, false); }
  };

  // KPIs are computed inside ProjectionHero from the (filtered) plan set.

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
          <h1>{t('dca.title')} <em>{t('dca.titleAccent')}</em></h1>
          <p>{t('dca.subtitle')}</p>
        </div>
        <button className="primary-btn" onClick={() => setModal('new')} style={{ flexShrink: 0 }}>
          <Plus size={14}/> {t('dca.newPlan')}
        </button>
      </div>

      <ProjectionHero plans={activePlans.filter(p => p.status === 'active')} quotes={quotes} fmt0={fmt0}/>

      <section className="card">
        <div className="card-header">
          <h3><TrendingUp size={14}/> {t('dca.activePlans')}</h3>
          <span className="card-meta">{t('dca.plans', { count: activePlans.length })}</span>
        </div>
        {activePlans.length === 0 ? (
          <div className="empty-mini">
            <TrendingUp size={24}/>
            <p>{t('dca.noPlan')}</p>
            <button className="primary-btn" style={{ marginTop: 8 }} onClick={() => setModal('new')}>
              <Plus size={14}/> {t('dca.createPlan')}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activePlans.map(p => (
              <PlanCard key={p.id} plan={p} accounts={accounts} quotes={quotes}
                onEdit={setModal} onToggle={handleToggle} onDelete={handleDelete}
                onSetExecutions={handleSetExecutions}/>
            ))}
          </div>
        )}
      </section>

      {nextDates.length > 0 && (
        <section className="card">
          <div className="card-header">
            <h3><Calendar size={14}/> {t('dca.upcomingPayments')}</h3>
            <span className="card-meta">{t('dca.upcomingCount', { count: nextDates.length })}</span>
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
