// ============================================================================
// DCA — Investissement Programmé
// Plans DCA (Dollar Cost Averaging) : création, suivi, projection compound.
// ============================================================================
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { gsap } from '../utils/gsapSetup.js';
import { ChipSelect } from '../components/ChipSelect.jsx';
import { Combobox } from '../components/Combobox.jsx';
import { useTranslation } from 'react-i18next';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Plus, TrendingUp, Pause, Play, Trash2, Edit2, X, Check,
  Calendar, ChevronDown, ChevronUp, Bell, BellOff, Mail,
} from 'lucide-react';
import { dcaApi } from '../api.js';
import { useQuotes } from '../hooks/useQuotes.js';
import { Amount } from '../components/ui/Amount.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ResponsiveModal } from '../components/ui/ResponsiveModal.jsx';
import { AnimatedNumber } from '../components/AnimatedNumber.jsx';

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

/** Next payment date given day_of_month — version "rich" : retourne Date + label + relatif */
function nextPaymentInfo(dayOfMonth, frequency) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = dayOfMonth || 1;
  const freqM = FREQ_MONTHS[frequency] || 1;
  let candidate = new Date(today.getFullYear(), today.getMonth(), d);
  if (candidate <= today) candidate = new Date(today.getFullYear(), today.getMonth() + freqM, d);
  const diffMs = candidate.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  const label = candidate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  let relative;
  if (diffDays === 0) relative = 'aujourd\'hui';
  else if (diffDays === 1) relative = 'demain';
  else if (diffDays <= 30) relative = `dans ${diffDays}j`;
  else relative = `dans ${Math.round(diffDays / 30)} mois`;
  return { date: candidate, label, relative, diffDays };
}

/** Legacy wrapper — gardé pour ne pas casser les appels existants. */
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
  // DÉSACTIVÉ (2026-06-25). On ne stocke pas le prix d'achat / le nombre de
  // parts par exécution → impossible de calculer une VRAIE valeur de marché.
  // L'ancienne version actualisait le prix courant par le rendement ESPÉRÉ pour
  // inventer un nombre de parts : la « valeur actuelle » et la « +/- value »
  // devenaient une fonction de l'hypothèse de rendement (plus-value fantôme
  // quasi toujours positive), contredisant le courtier de l'utilisateur.
  // En renvoyant null, tout retombe sur currentState() — la projection
  // théorique, explicitement libellée « Valeur théorique ». Pour un vrai
  // mark-to-market, il faudra tracer parts + prix d'achat par exécution.
  return null;
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

// ── DcaReminderModal ─────────────────────────────────────────────────────────
// Modale dédiée pour configurer le rappel email d'un plan DCA.
// Permet de toggler ON/OFF + choisir le délai d'anticipation (1/2/3/5/7j).
// Backend exposé : reminder_email_enabled + reminder_lead_days. L'email est
// envoyé à l'adresse du compte (pas d'override per-plan en DB actuellement).
function DcaReminderModal({ plan, currentUserEmail, onSave, onClose }) {
  const [enabled, setEnabled] = useState(!!plan.reminder_email_enabled);
  const [leadDays, setLeadDays] = useState(plan.reminder_lead_days ?? 2);
  const [saving, setSaving] = useState(false);

  const LEAD_OPTIONS = [
    { value: 1, label: '1 jour' },
    { value: 2, label: '2 jours' },
    { value: 3, label: '3 jours' },
    { value: 5, label: '5 jours' },
    { value: 7, label: '7 jours' },
  ];

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ reminder_email_enabled: enabled, reminder_lead_days: leadDays });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModal open={true} onClose={onClose} className="dca-reminder-modal">
      <div className="modal-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={16}/> Rappel email
        </h2>
        <button className="icon-btn-sm" onClick={onClose}><X size={16}/></button>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Plan ciblé */}
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', padding: '4px 0' }}>
          Pour le plan <strong style={{ color: 'var(--ink)' }}>{plan.name}</strong>
          {plan.ticker && <span style={{ fontFamily: 'var(--font-mono)', marginLeft: 6, color: 'var(--accent)' }}>{plan.ticker}</span>}
        </div>

        {/* Toggle principal */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderRadius: 8,
            background: enabled ? 'var(--accent-soft)' : 'var(--bg-sunk)',
            border: '1px solid ' + (enabled ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--border)'),
            transition: 'all 160ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>
              Recevoir un email avant chaque versement
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Mail size={11}/> Envoyé à {currentUserEmail || 'ton compte'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(e => !e)}
            style={{
              position: 'relative',
              width: 42, height: 24, borderRadius: 12,
              background: enabled ? 'var(--accent)' : 'var(--ink-3)',
              border: 'none', cursor: 'pointer', flexShrink: 0,
              transition: 'background 180ms ease',
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: enabled ? 20 : 2,
              width: 20, height: 20, borderRadius: '50%',
              background: '#fff',
              transition: 'left 180ms cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}/>
          </button>
        </div>

        {/* Délai d'anticipation — caché si rappel off */}
        <div style={{ opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none', transition: 'opacity 160ms' }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>
            Quand prévenir
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {LEAD_OPTIONS.map(opt => {
              const active = leadDays === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLeadDays(opt.value)}
                  style={{
                    padding: '10px 6px', borderRadius: 6,
                    border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
                    background: active ? 'var(--accent-soft)' : 'var(--bg-elev)',
                    color: active ? 'var(--accent)' : 'var(--ink-2)',
                    fontSize: 12, fontWeight: active ? 600 : 500, cursor: 'pointer',
                    transition: 'all 140ms ease',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8, fontStyle: 'italic' }}>
            Tu recevras un email {leadDays} jour{leadDays > 1 ? 's' : ''} avant chaque exécution prévue.
          </p>
        </div>

        {/* Footer info — fréquence d'envoi */}
        {enabled && (
          <div style={{
            padding: '10px 12px', borderRadius: 6,
            background: 'color-mix(in srgb, var(--positive) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--positive) 18%, transparent)',
            fontSize: 11.5, color: 'var(--positive)',
            display: 'flex', alignItems: 'flex-start', gap: 6,
          }}>
            <Bell size={12} style={{ flexShrink: 0, marginTop: 2 }}/>
            <span>
              Un cron quotidien vérifie chaque jour les versements à venir. L'email part automatiquement quand un plan tombe dans la fenêtre.
            </span>
          </div>
        )}
      </div>

      <div className="modal-actions">
        <button className="ds-btn ghost" onClick={onClose} disabled={saving}>Annuler</button>
        <button className="ds-btn primary" onClick={submit} disabled={saving}>
          <Check size={14}/> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </ResponsiveModal>
  );
}

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
    <ResponsiveModal open={true} onClose={onClose} className="dca-plan-editor-modal">
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
              <Combobox
                value={d.currency}
                onChange={val => set('currency', val)}
                options={[
                  { value: 'EUR', label: 'EUR', icon: '🇪🇺' },
                  { value: 'USD', label: 'USD', icon: '🇺🇸' },
                  { value: 'GBP', label: 'GBP', icon: '🇬🇧' },
                  { value: 'CHF', label: 'CHF', icon: '🇨🇭' },
                ]}
              />
            </label>
          </div>

          <div className="field-row">
            <label><span>{t('dca.frequency')}</span>
              <ChipSelect
                value={d.frequency}
                onChange={val => set('frequency', val)}
                options={[
                  { value: 'monthly',   label: t('dca.frequencyMonthly') },
                  { value: 'quarterly', label: t('dca.frequencyQuarterly') },
                  { value: 'annual',    label: t('dca.frequencyAnnual') },
                ]}
              />
            </label>
            <label><span>{t('dca.dayOfMonth')}</span>
              <input type="number" value={d.day_of_month} onChange={e => set('day_of_month', e.target.value)}
                min="1" max="28"/>
            </label>
          </div>

          <div className="field-row">
            <label><span>{t('dca.debitAccount')}</span>
              <Combobox
                value={d.account_id}
                onChange={val => set('account_id', val)}
                placeholder={t('dca.noneOption')}
                options={[
                  { value: '', label: t('dca.noneOption') },
                  ...(accounts || []).map(a => ({ value: a.id, label: a.name, icon: '🏦' })),
                ]}
              />
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
        <button className="ds-btn" onClick={onClose}>{t('actions.cancel')}</button>
        <button className="ds-btn primary" onClick={submit} disabled={saving || !d.name || !d.amount}>
          <Check size={14}/> {saving ? t('actions.saving') : t('actions.save')}
        </button>
      </div>
    </ResponsiveModal>
  );
}

// ── Plan card ────────────────────────────────────────────────────────────────
function PlanCard({ plan, accounts, quotes, onEdit, onToggle, onDelete, onSetExecutions, onOpenReminder }) {
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

      {/* Body — KPIs en haut, mini-sparkline en dessous, actions à droite */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
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
          {/* Mini-sparkline trajectoire projetée — cliquer expand pour vrai graph */}
          {!expanded && <PlanMiniSparkline plan={plan} horizon={horizon}/>}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button className="icon-btn-sm" onClick={() => setExpanded(e => !e)} title={t('dca.viewProjection')}>
            {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
          <button className="icon-btn-sm" onClick={() => onEdit(plan)} title={t('actions.edit')}><Edit2 size={13}/></button>
          {onOpenReminder && (
            <button
              type="button"
              className={`dca-reminder-chip ${plan.reminder_email_enabled ? 'is-on' : ''}`}
              onClick={() => onOpenReminder(plan)}
              title={plan.reminder_email_enabled
                ? `Rappel email actif · ${plan.reminder_lead_days ?? 2}j avant exécution — cliquer pour modifier`
                : 'Configurer un rappel email'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 9px', borderRadius: 12,
                border: '1px solid ' + (plan.reminder_email_enabled ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--border)'),
                background: plan.reminder_email_enabled ? 'var(--accent-soft)' : 'transparent',
                color: plan.reminder_email_enabled ? 'var(--accent)' : 'var(--ink-3)',
                fontSize: 11, fontWeight: 500, cursor: 'pointer',
                whiteSpace: 'nowrap', height: 26, flexShrink: 0,
                transition: 'all 140ms ease',
              }}
            >
              {plan.reminder_email_enabled ? <Bell size={11}/> : <BellOff size={11}/>}
              <span>{plan.reminder_email_enabled ? `${plan.reminder_lead_days ?? 2}j` : 'Rappel'}</span>
            </button>
          )}
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
    // allReal toujours false : sans prix d'achat par exécution on ne peut pas
    // mark-to-market → on agrège la projection théorique (currentState), et le
    // libellé bascule sur « Valeur théorique » au lieu de « Valeur actuelle ».
    const allReal = false;
    const agg = includedPlans.reduce(
      (acc, p) => {
        const s = currentState(p);
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
// ── UpcomingPayments ─────────────────────────────────────────────────────────
// Banner en haut de la vue DCA listant les prochains versements (jusqu'à 4),
// chronologiques. Inclut le statut "rappel email" par plan, avec relative
// date ("dans 4j", "demain", "aujourd'hui"). Cliquer une ligne → ouvre la
// modale rappel pour ce plan (raccourci).
//
// GSAP : stagger fade-in des lignes au mount + pulse infini doux sur les
// lignes urgentes (diffDays <= 3) pour attirer l'attention.
function UpcomingPayments({ plans, onOpenReminder, fmt0 }) {
  const upcoming = useMemo(() => {
    const list = (plans || [])
      .filter(p => p.status === 'active')
      .map(p => {
        const info = nextPaymentInfo(p.day_of_month, p.frequency);
        return { plan: p, ...info };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 4);
    return list;
  }, [plans]);

  const rowsRef = useRef(null);
  useEffect(() => {
    if (!rowsRef.current) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      // Stagger fade-in des lignes
      gsap.fromTo(
        '[data-upcoming-row]',
        { opacity: 0, x: -8 },
        { opacity: 1, x: 0, duration: 0.35, ease: 'expo.out', stagger: 0.06, clearProps: 'transform' }
      );
      // Pulse subtil sur les lignes urgentes (≤ 3j) — box-shadow + scale léger
      gsap.to('[data-upcoming-urgent]', {
        boxShadow: '0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent)',
        duration: 1.4,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }, rowsRef);
    return () => ctx.revert();
  }, [upcoming.length]);

  if (upcoming.length === 0) return null;

  return (
    <section
      className="card"
      style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={13} style={{ color: 'var(--accent)' }}/>
          <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
            Prochains versements
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
            · {upcoming.length} à venir
          </span>
        </div>
      </div>

      <div ref={rowsRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {upcoming.map(({ plan, label, relative, diffDays }) => {
          const urgent = diffDays <= 3;
          return (
            <div
              key={plan.id}
              data-upcoming-row
              data-upcoming-urgent={urgent ? '' : null}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 10px', borderRadius: 6,
                background: urgent ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'transparent',
                border: '1px solid ' + (urgent ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'transparent'),
                transition: 'background 140ms',
              }}
            >
              {/* Ticker / icone */}
              {plan.ticker ? (
                <span style={{
                  fontFamily: 'Geist Mono, ui-monospace, Menlo, monospace',
                  fontSize: 10, fontWeight: 700, color: 'var(--accent)',
                  letterSpacing: '0.04em', padding: '2px 6px',
                  background: 'var(--accent-soft)', borderRadius: 4, flexShrink: 0,
                }}>{plan.ticker.toUpperCase()}</span>
              ) : (
                <span style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--accent-soft)', color: 'var(--accent)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}>●</span>
              )}

              {/* Nom plan */}
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                {plan.name}
              </span>

              {/* Montant */}
              <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)', flexShrink: 0 }}>
                {fmt0(plan.amount)}
              </span>

              {/* Date + relatif */}
              <span style={{ fontSize: 11.5, color: 'var(--ink-2)', textAlign: 'right', minWidth: 100, flexShrink: 0 }}>
                <span style={{ color: 'var(--ink-3)' }}>{label} · </span>
                <strong style={{ color: urgent ? 'var(--accent)' : 'var(--ink-2)', fontWeight: 600 }}>{relative}</strong>
              </span>

              {/* Chip rappel */}
              {onOpenReminder && (
                <button
                  type="button"
                  onClick={() => onOpenReminder(plan)}
                  title={plan.reminder_email_enabled ? `Rappel ${plan.reminder_lead_days ?? 2}j avant — modifier` : 'Activer un rappel'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 10,
                    border: '1px solid ' + (plan.reminder_email_enabled ? 'color-mix(in srgb, var(--accent) 28%, transparent)' : 'var(--border)'),
                    background: plan.reminder_email_enabled ? 'var(--accent-soft)' : 'transparent',
                    color: plan.reminder_email_enabled ? 'var(--accent)' : 'var(--ink-3)',
                    fontSize: 10.5, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                    flexShrink: 0, transition: 'all 140ms',
                  }}
                >
                  {plan.reminder_email_enabled ? <Bell size={10}/> : <BellOff size={10}/>}
                  <span>{plan.reminder_email_enabled ? `${plan.reminder_lead_days ?? 2}j` : 'Rappel'}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── DcaKpiStrip ──────────────────────────────────────────────────────────────
// Bandeau 4 KPI cumulés sur tous les plans actifs : nb plans / mensuel
// équivalent / total versé / +/- value cumulée. Aucun toggle horizon —
// l'info plan-spécifique vit dans les PlanCards en dessous.
function DcaKpiStrip({ plans, quotes, fmt0 }) {
  const activePlans = useMemo(() => plans.filter(p => p.status === 'active'), [plans]);

  const monthlyEquiv = useMemo(() => activePlans.reduce((s, p) => {
    const div = FREQ_MONTHS[p.frequency] || 1;
    return s + (Number(p.amount) || 0) / div;
  }, 0), [activePlans]);

  const totals = useMemo(() => {
    let invested = 0, value = 0;
    for (const p of activePlans) {
      const state = currentState(p);
      if (state) {
        invested += state.invested || 0;
        value += state.value || 0;
      }
    }
    return { invested, value, gain: value - invested };
  }, [activePlans, quotes]);

  const fmtSigned = (n) => (n >= 0 ? '+' : '') + fmt0(n);
  // Chaque KPI fournit valeur numerique + fonction de format pour AnimatedNumber
  // (count-up GSAP au mount, pas de pulse a chaque rerender).
  const KPIS = [
    { label: 'Plans actifs', value: activePlans.length, format: (n) => String(Math.round(n)), color: 'var(--ink)' },
    { label: 'Mensuel équiv.', value: monthlyEquiv, format: fmt0, color: 'var(--ink)' },
    { label: 'Total versé', value: totals.invested, format: fmt0, color: 'var(--ink)' },
    {
      label: '+/- value',
      value: totals.gain,
      format: fmtSigned,
      color: totals.gain >= 0 ? 'var(--positive)' : 'var(--negative)',
    },
  ];

  return (
    <section
      className="card"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      {KPIS.map((kpi, i) => (
        <div
          key={kpi.label}
          style={{
            padding: '14px 18px',
            borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
          }}
        >
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 4,
          }}>
            {kpi.label}
          </div>
          <div style={{
            fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em',
            fontVariantNumeric: 'tabular-nums', color: kpi.color,
          }}>
            <AnimatedNumber
              value={kpi.value}
              format={kpi.format}
              duration={0.9}
              pulseOnChange={false}
            />
          </div>
        </div>
      ))}
    </section>
  );
}

// ── PlanMiniSparkline ────────────────────────────────────────────────────────
// Sparkline inline 56px de haut affichée dans chaque PlanCard. Montre
// rapidement la trajectoire de croissance projetée du plan (invested vs
// portfolio) sans axes ni tooltip — c'est un teaser. Le user clique
// "ChevronDown" pour expand et voir le vrai graph détaillé.
function PlanMiniSparkline({ plan, horizon = 25 }) {
  const data = useMemo(() => buildProjection(plan, horizon), [plan, horizon]);
  if (!data.length) return null;
  return (
    <div style={{ width: '100%', height: 56, opacity: plan.status === 'paused' ? 0.5 : 1 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`gMini${plan.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28}/>
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="invested"
            stroke="var(--ink-3)"
            strokeWidth={1}
            strokeDasharray="3 3"
            fill="transparent"
            isAnimationActive={false}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="portfolio"
            stroke="var(--accent)"
            strokeWidth={1.6}
            fill={`url(#gMini${plan.id})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DCAView({ accounts = [], members = [], dcaPlans = [], onPlansChange, currentUserEmail }) {
  const { t } = useTranslation();
  const [modal, setModal] = useState(null); // null | 'new' | plan object
  const [reminderPlan, setReminderPlan] = useState(null); // null | plan object — plan en cours de config rappel
  const [toast, setToast] = useState(null);

  // GSAP page-enter — stagger fade-in du header + projection hero + cards DCA
  const dcaRef = useRef(null);
  useEffect(() => {
    if (!dcaRef.current) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ['.dca-view > .subview-header', '.dca-view > .card', '.dca-view section.card'],
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.38, ease: 'expo.out', stagger: 0.06, clearProps: 'transform' }
      );
    }, dcaRef);
    return () => ctx.revert();
  }, []);

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
      if (data.id) {
        const updated = await dcaApi.update(data.id, data);
        // Optimistic : remplace dans la liste immediatement
        if (updated && updated.id) {
          onPlansChange(dcaPlans.map(p => p.id === updated.id ? updated : p));
        }
        notify(t('toasts.planUpdated'));
      } else {
        const created = await dcaApi.create(data);
        // Optimistic : ajoute en bout de liste immediatement (l'user voit
        // son plan apparaitre sans attendre le GET list)
        if (created && created.id) {
          onPlansChange([...dcaPlans, created]);
        }
        notify(t('toasts.planCreated'));
      }
      // Resync background (safety net, ne bloque pas l'UI)
      reload().catch(() => {});
    } catch (e) { notify(e.message, false); }
  };

  const handleToggle = async (plan) => {
    const next = plan.status === 'active' ? 'paused' : 'active';
    try {
      await dcaApi.update(plan.id, { ...plan, status: next });
      await reload();
    } catch (e) { notify(e.message, false); }
  };

  // Ouverture de la modale Rappel pour un plan donné. La modale gère
  // toggle + délai d'anticipation, puis appelle handleSaveReminder au submit.
  const handleOpenReminder = (plan) => setReminderPlan(plan);

  const handleSaveReminder = async ({ reminder_email_enabled, reminder_lead_days }) => {
    if (!reminderPlan) return;
    try {
      await dcaApi.update(reminderPlan.id, {
        ...reminderPlan,
        reminder_email_enabled,
        reminder_lead_days,
      });
      await reload();
      notify(reminder_email_enabled
        ? `Rappel email activé · ${reminder_lead_days}j avant exécution`
        : 'Rappel email désactivé'
      );
    } catch (e) {
      notify(e.message, false);
      throw e; // rethrow pour que la modale ne se ferme pas en cas d'echec
    }
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
    // Optimistic : retire de la liste immediatement
    onPlansChange(dcaPlans.filter(p => p.id !== plan.id));
    try {
      await dcaApi.remove(plan.id);
      notify(t('toasts.planDeleted'));
      reload().catch(() => {});
    } catch (e) {
      notify(e.message, false);
      // Rollback : re-fetch pour restaurer si la suppression a echoue
      reload().catch(() => {});
    }
  };

  // KPIs cumulés affichés par DcaKpiStrip. Prochains versements par UpcomingPayments.

  const fmt0 = v => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="dca-view" ref={dcaRef}>
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
        <button className="ds-btn primary" onClick={() => setModal('new')} style={{ flexShrink: 0 }}>
          <Plus size={14}/> {t('dca.newPlan')}
        </button>
      </div>

      {/* 1. Prochains versements en haut (banner alerte avec rappels par plan) */}
      <UpcomingPayments plans={activePlans} onOpenReminder={handleOpenReminder} fmt0={fmt0}/>

      {/* 2. KPI strip cumulés tous plans actifs */}
      {activePlans.some(p => p.status === 'active') && (
        <DcaKpiStrip plans={activePlans} quotes={quotes} fmt0={fmt0}/>
      )}

      {/* 3. Plans actifs — coeur de la vue, chaque card = unite d'interet */}
      <section className="card">
        <div className="card-header">
          <h3><TrendingUp size={14}/> Vos plans</h3>
          <span className="card-meta">{t('dca.plans', { count: activePlans.length })}</span>
        </div>
        {activePlans.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title={<>Investis <em>régulièrement.</em></>}
            description="Le DCA (Dollar Cost Averaging) lisse les variations du marché. Crée ton premier plan : ETF Monde, livret A, crypto… Wealthly suit tout."
            cta={{ label: 'Créer un plan DCA', icon: Plus, onClick: () => setModal('new') }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activePlans.map(p => (
              <PlanCard key={p.id} plan={p} accounts={accounts} quotes={quotes}
                onEdit={setModal} onToggle={handleToggle} onDelete={handleDelete}
                onSetExecutions={handleSetExecutions}
                onOpenReminder={handleOpenReminder}/>
            ))}
          </div>
        )}
      </section>

      {/* "Prochains versements" remonté tout en haut via UpcomingPayments —
          ancienne section grid retirée (faisait doublon avec le banner). */}

      {/* Modal édition / création plan */}
      {modal && (
        <PlanModal
          plan={modal === 'new' ? null : modal}
          accounts={accounts}
          members={members}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* Modal configuration rappel email */}
      {reminderPlan && (
        <DcaReminderModal
          plan={reminderPlan}
          currentUserEmail={currentUserEmail}
          onSave={handleSaveReminder}
          onClose={() => setReminderPlan(null)}
        />
      )}
    </div>
  );
}
