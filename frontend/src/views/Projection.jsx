// ============================================================================
// Projection — forward cash-flow anticipator for liquid wealth.
//
// Unlike Cashflow.jsx (retrospective Sankey of past flows), this view looks
// FORWARD: it starts from the current balance of the selected liquid accounts
// and rolls it day-by-day applying recurring charges/income (FixedCharge),
// loan échéances (Liability), DCA buys (cash leaving the liquid pool) and
// one-off PlannedEvents (rattrapage d'impôts, prime…). It surfaces the
// projected balance curve, the date/amount of the lowest point ("le creux")
// and lets the user add planned events inline.
// ============================================================================
import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceDot,
} from 'recharts';
import { LineChart as LineChartIcon, AlertTriangle, Plus, Trash2, Pencil, X, Check, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { ResponsiveModal } from '../components/ui/ResponsiveModal.jsx';
import { AnimatedNumber } from '../components/AnimatedNumber.jsx';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Liquid roles that contribute to the cash anticipation. We deliberately
// exclude 'investissement' (broker) and 'professionnel' (out of personal
// cashflow), per the product direction: anticipate cash + Livret A + salary.
const LIQUID_ROLES = ['principal', 'depenses', 'epargne'];

const HORIZONS = [
  { key: '3M', months: 3 },
  { key: '6M', months: 6 },
  { key: '1A', months: 12 },
];

// --- date helpers -----------------------------------------------------------
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate(); // m: 0-based
const addDays = (d, n) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };

// Is a YYYY-MM month within [start, end] (end optional, inclusive)?
const monthActive = (mk, start, end) => {
  if (start && mk < start) return false;
  if (end && mk > end) return false;
  return true;
};

// ============================================================================
// Projection engine — pure function, daily resolution.
// Returns { series: [{date, balance, events:[]}], trough, totalsIn, totalsOut }
// ============================================================================
function buildProjection({
  startBalance, horizonMonths, today,
  fixedCharges, dcaPlans, liabilities, plannedEvents, selectedAccountIds,
}) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start);
  end.setMonth(end.getMonth() + horizonMonths);

  // Index planned events by ISO date (only those affecting the selected pool).
  const eventsByDate = {};
  let totalsIn = 0, totalsOut = 0;
  (plannedEvents || []).forEach(ev => {
    // An event tied to a non-selected account doesn't move the selected pool.
    if (ev.account_id && !selectedAccountIds.has(ev.account_id)) return;
    const key = ev.date; // already YYYY-MM-DD
    (eventsByDate[key] = eventsByDate[key] || []).push(ev);
    if (ev.direction === 'in') totalsIn += Math.abs(ev.amount || 0);
    else totalsOut += Math.abs(ev.amount || 0);
  });

  const series = [];
  let balance = startBalance;
  let trough = { date: iso(start), balance: startBalance };

  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const dim = daysInMonth(d.getFullYear(), d.getMonth());
    const dom = d.getDate();
    const mk = monthKeyOf(d);
    const dayEvents = [];

    // Skip the very first day's recurring application if it's "today" and the
    // charge day already passed — we start from the real current balance, so
    // for the current month only apply charges whose day is strictly after
    // today. For all future months, apply normally.
    const isFirstMonth = mk === monthKeyOf(start);
    const passedToday = isFirstMonth && dom <= start.getDate();

    // --- Recurring fixed charges / income ---
    (fixedCharges || []).forEach(fc => {
      if (!monthActive(mk, fc.start_month, fc.end_month)) return;
      // day_of_month clamped to month length; null → 1st.
      const chargeDay = Math.min(fc.day_of_month || 1, dim);
      if (chargeDay !== dom) return;
      if (passedToday) return;
      const amt = Math.abs(fc.amount || 0);
      if (fc.kind === 'income') { balance += amt; dayEvents.push({ label: fc.name, amount: amt, kind: 'income', source: 'fixed' }); }
      else { balance -= amt; dayEvents.push({ label: fc.name, amount: -amt, kind: 'expense', source: 'fixed' }); }
    });

    // --- DCA buys: cash leaves the liquid pool ---
    (dcaPlans || []).forEach(p => {
      if (p.status && p.status !== 'active') return;
      if (p.account_id && !selectedAccountIds.has(p.account_id)) return;
      const buyDay = Math.min(p.day_of_month || 1, dim);
      if (buyDay !== dom) return;
      if (passedToday) return;
      // frequency gating
      const freq = p.frequency || 'monthly';
      if (freq !== 'monthly') {
        const sd = p.start_date ? new Date(p.start_date) : start;
        const monthsDiff = (d.getFullYear() - sd.getFullYear()) * 12 + (d.getMonth() - sd.getMonth());
        if (freq === 'quarterly' && monthsDiff % 3 !== 0) return;
        if (freq === 'annual' && monthsDiff % 12 !== 0) return;
      }
      const amt = Math.abs(p.amount || 0);
      balance -= amt;
      dayEvents.push({ label: `DCA ${p.name || p.ticker || ''}`.trim(), amount: -amt, kind: 'dca', source: 'dca' });
    });

    // --- Loan échéances: applied on the 1st of each month until end_date ---
    if (dom === 1 && !passedToday) {
      (liabilities || []).forEach(l => {
        const pay = Math.abs(l.monthlyPayment || 0);
        if (!pay) return;
        if (l.endDate && mk > monthKeyOf(new Date(l.endDate))) return;
        balance -= pay;
        dayEvents.push({ label: l.name || 'Prêt', amount: -pay, kind: 'loan', source: 'loan' });
      });
    }

    // --- One-off planned events ---
    const evs = eventsByDate[iso(d)] || [];
    evs.forEach(ev => {
      const amt = Math.abs(ev.amount || 0);
      if (ev.direction === 'in') { balance += amt; dayEvents.push({ label: ev.label, amount: amt, kind: 'planned-in', source: 'planned' }); }
      else { balance -= amt; dayEvents.push({ label: ev.label, amount: -amt, kind: 'planned-out', source: 'planned' }); }
    });

    series.push({ date: iso(d), ts: d.getTime(), balance: Math.round(balance), events: dayEvents });
    if (balance < trough.balance) trough = { date: iso(d), balance: Math.round(balance) };
  }

  return { series, trough, totalsIn, totalsOut, endBalance: Math.round(balance) };
}

// ============================================================================
export function Projection({
  accounts, accountBalances, liabilities, fixedCharges, dcaPlans,
  plannedEvents, savePlannedEvent, deletePlannedEvent,
  categories, members, fmt, currentMonth,
}) {
  const [horizon, setHorizon] = useState('6M');
  const today = useMemo(() => new Date(), []);

  // Liquid accounts available for the projection.
  const liquidAccounts = useMemo(
    () => (accounts || []).filter(a => LIQUID_ROLES.includes(a.role)),
    [accounts]
  );

  // Selected account ids — default to all liquid accounts.
  const [selectedIds, setSelectedIds] = useState(null); // null = "not initialised"
  const effectiveSelected = useMemo(() => {
    if (selectedIds) return selectedIds;
    return new Set(liquidAccounts.map(a => a.id));
  }, [selectedIds, liquidAccounts]);

  const toggleAccount = (id) => {
    const next = new Set(effectiveSelected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const startBalance = useMemo(
    () => liquidAccounts
      .filter(a => effectiveSelected.has(a.id))
      .reduce((s, a) => s + (accountBalances?.[a.id] || 0), 0),
    [liquidAccounts, effectiveSelected, accountBalances]
  );

  const horizonMonths = HORIZONS.find(h => h.key === horizon)?.months || 6;

  const projection = useMemo(() => buildProjection({
    startBalance, horizonMonths, today,
    fixedCharges, dcaPlans, liabilities, plannedEvents,
    selectedAccountIds: effectiveSelected,
  }), [startBalance, horizonMonths, today, fixedCharges, dcaPlans, liabilities, plannedEvents, effectiveSelected]);

  const { series, trough, totalsIn, totalsOut, endBalance } = projection;
  const willGoNegative = trough.balance < 0;

  // Upcoming planned events (sorted, future only relative to today).
  const todayIso = iso(today);
  const upcoming = useMemo(
    () => (plannedEvents || [])
      .filter(e => e.date >= todayIso)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [plannedEvents, todayIso]
  );

  // --- Planned event editor state ---
  const [editor, setEditor] = useState(null); // null | {} (new) | {...event} (edit)

  const fmtShort = (v) => {
    try { return fmt(v); } catch { return `${Math.round(v)} €`; }
  };
  const fmtDate = (isoStr) => {
    const [y, m, d] = isoStr.split('-');
    return new Date(+y, +m - 1, +d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="projection-view">
      <div className="subview-header">
        <div>
          <h1>Votre <em>projection.</em></h1>
          <p>Anticipez votre trésorerie liquide — soldes futurs, échéances et coups durs.</p>
        </div>
        <button className="ds-btn primary" onClick={() => setEditor({})}>
          <Plus size={16}/> Événement
        </button>
      </div>

      {/* Controls */}
      <div className="cashflow-period">
        <div className="projection-accounts">
          {liquidAccounts.length === 0 ? (
            <span className="card-meta">Aucun compte liquide. Ajoutez un compte courant ou une épargne.</span>
          ) : liquidAccounts.map(a => {
            const on = effectiveSelected.has(a.id);
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                className={`projection-acc-pill ${on ? 'on' : ''}`}
                onClick={() => toggleAccount(a.id)}
                title={`${a.name}${a.bank ? ' · ' + a.bank : ''} — ${on ? 'inclus' : 'exclu'} de la projection`}
              >
                {a.name}
              </button>
            );
          })}
        </div>
        <div className="nw-toggle-group">
          {HORIZONS.map(h => (
            <button key={h.key} className={horizon === h.key ? 'active' : ''} onClick={() => setHorizon(h.key)}>{h.key}</button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="cashflow-kpi-row" style={{ marginBottom: 16 }}>
        <div className="cashflow-kpi">
          <div className="cashflow-kpi-label">Solde actuel</div>
          <div className="cashflow-kpi-value"><AnimatedNumber value={startBalance} format={fmtShort}/></div>
        </div>
        <div className="cashflow-kpi">
          <div className="cashflow-kpi-label">Projeté à {horizon}</div>
          <div className={`cashflow-kpi-value ${endBalance >= startBalance ? 'positive' : 'negative'}`}>
            <AnimatedNumber value={endBalance} format={fmtShort}/>
          </div>
        </div>
        <div className="cashflow-kpi">
          <div className="cashflow-kpi-label">Point bas (creux)</div>
          <div className={`cashflow-kpi-value ${willGoNegative ? 'negative' : ''}`}>
            <AnimatedNumber value={trough.balance} format={fmtShort}/>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{fmtDate(trough.date)}</div>
        </div>
      </div>

      {willGoNegative && (
        <div className="projection-warning" role="alert">
          <AlertTriangle size={18} aria-hidden="true"/>
          <span>
            Sur cet horizon, votre solde liquide passe sous zéro le <strong>{fmtDate(trough.date)}</strong>
            {' '}({fmtShort(trough.balance)}). Anticipez un transfert ou décalez une dépense.
          </span>
        </div>
      )}

      {/* Forecast chart */}
      <section className="card">
        <div className="card-header">
          <h3>Solde liquide projeté</h3>
          <span className="card-meta">{HORIZONS.find(h => h.key === horizon)?.months} mois · {upcoming.length} événement{upcoming.length > 1 ? 's' : ''} planifié{upcoming.length > 1 ? 's' : ''}</span>
        </div>
        <p className="sr-only">
          Solde liquide actuel {fmtShort(startBalance)}, projeté à {fmtShort(endBalance)} dans {horizonMonths} mois.
          Point bas estimé : {fmtShort(trough.balance)} le {fmtDate(trough.date)}.
        </p>
        {series.length > 1 ? (
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={series} margin={{ top: 10, right: 12, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="projFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28}/>
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false}/>
              <XAxis
                dataKey="date" tickFormatter={fmtDate} minTickGap={48}
                tick={{ fontSize: 11, fill: 'var(--ink-3)' }} stroke="var(--border)"
              />
              <YAxis
                tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={44}
                tick={{ fontSize: 11, fill: 'var(--ink-3)' }} stroke="var(--border)"
              />
              <Tooltip content={<ProjTooltip fmt={fmtShort} fmtDate={fmtDate}/>}/>
              <ReferenceLine y={0} stroke="var(--negative)" strokeDasharray="4 4" strokeOpacity={0.7}/>
              <Area
                type="monotone" dataKey="balance" stroke="var(--accent)" strokeWidth={2}
                fill="url(#projFill)" dot={false}
                isAnimationActive={!prefersReducedMotion()} animationDuration={700} animationEasing="ease-out"
              />
              <ReferenceDot
                x={trough.date} y={trough.balance} r={5}
                fill={willGoNegative ? 'var(--negative)' : 'var(--accent)'} stroke="var(--bg-elev)" strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-mini" style={{ padding: '50px 0' }}>
            <LineChartIcon size={28}/>
            <p>Sélectionnez au moins un compte liquide pour projeter votre trésorerie.</p>
          </div>
        )}
      </section>

      {/* Planned events list */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h3>Événements planifiés</h3>
          <button className="ds-btn sm" onClick={() => setEditor({})}><Plus size={14}/> Ajouter</button>
        </div>
        {upcoming.length === 0 ? (
          <div className="empty-mini"><p>Aucun événement à venir. Ajoutez un impôt, une prime, un gros achat…</p></div>
        ) : (
          <div className="projection-event-list">
            {upcoming.map(ev => {
              const acc = (accounts || []).find(a => a.id === ev.account_id);
              return (
                <div key={ev.id} className="projection-event-row">
                  <span className={`projection-event-icon ${ev.direction === 'in' ? 'in' : 'out'}`}>
                    {ev.direction === 'in' ? <ArrowUpCircle size={18}/> : <ArrowDownCircle size={18}/>}
                  </span>
                  <div className="projection-event-info">
                    <div className="projection-event-label">{ev.label}</div>
                    <div className="projection-event-meta">
                      {fmtDate(ev.date)}{acc ? ` · ${acc.name}` : ''}
                    </div>
                  </div>
                  <div className={`projection-event-amount ${ev.direction === 'in' ? 'positive' : 'negative'}`}>
                    {ev.direction === 'in' ? '+' : '−'}{fmtShort(Math.abs(ev.amount))}
                  </div>
                  <div className="projection-event-actions">
                    <button className="ds-icon-btn" onClick={() => setEditor(ev)} title="Modifier"><Pencil size={14}/></button>
                    <button className="ds-icon-btn" onClick={() => deletePlannedEvent(ev.id)} title="Supprimer"><Trash2 size={14}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {editor && (
        <PlannedEventEditor
          event={editor}
          accounts={liquidAccounts}
          onClose={() => setEditor(null)}
          onSave={async (payload) => { await savePlannedEvent(payload); setEditor(null); }}
        />
      )}
    </div>
  );
}

// --- Tooltip ----------------------------------------------------------------
function ProjTooltip({ active, payload, label, fmt, fmtDate }) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload;
  return (
    <div style={{ background: 'var(--bg-card, var(--bg-elev))', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 12, maxWidth: 240 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{fmtDate(label)}</div>
      <div style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmt(point.balance)}</div>
      {point.events && point.events.length > 0 && (
        <div style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
          {point.events.slice(0, 5).map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--ink-2)' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
              <span style={{ color: e.amount >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                {e.amount >= 0 ? '+' : '−'}{fmt(Math.abs(e.amount))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Planned event editor (modal) ------------------------------------------
function PlannedEventEditor({ event, accounts, onClose, onSave }) {
  const isEdit = !!event.id;
  const [form, setForm] = useState({
    label: event.label || '',
    amount: event.amount != null ? String(event.amount) : '',
    direction: event.direction || 'out',
    date: event.date || new Date().toISOString().slice(0, 10),
    account_id: event.account_id || '',
    notes: event.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const valid = form.label.trim() && parseFloat(form.amount) > 0 && form.date;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSave({
        id: event.id,
        label: form.label.trim(),
        amount: Math.abs(parseFloat(form.amount) || 0),
        direction: form.direction,
        date: form.date,
        account_id: form.account_id || null,
        notes: form.notes,
      });
    } catch { setSaving(false); }
  };

  return (
    <ResponsiveModal open={true} onClose={onClose} className="projection-event-modal">
      <div className="modal-header">
        <h2>{isEdit ? 'Modifier l’événement' : 'Nouvel événement'}</h2>
        <button className="icon-btn-sm" onClick={onClose}><X size={16}/></button>
      </div>
      <div className="modal-body">
        <label><span>Libellé</span>
          <input value={form.label} onChange={e => set('label', e.target.value)} placeholder="Impôts sur le revenu" autoFocus/>
        </label>
        <div className="field-row">
          <label><span>Montant</span>
            <input type="number" inputMode="decimal" step="any" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="4200"/>
          </label>
          <label><span>Sens</span>
            <div className="nw-toggle-group" style={{ width: '100%' }}>
              <button type="button" className={form.direction === 'out' ? 'active' : ''} onClick={() => set('direction', 'out')}>Sortie</button>
              <button type="button" className={form.direction === 'in' ? 'active' : ''} onClick={() => set('direction', 'in')}>Entrée</button>
            </div>
          </label>
        </div>
        <div className="field-row">
          <label><span>Date</span>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}/>
          </label>
          <label><span>Compte (optionnel)</span>
            <select value={form.account_id} onChange={e => set('account_id', e.target.value)}>
              <option value="">Tous (pool liquide)</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        </div>
        <label><span>Note (optionnel)</span>
          <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Solde 3e tiers"/>
        </label>
      </div>
      <div className="modal-footer">
        <button className="ds-btn" onClick={onClose}>Annuler</button>
        <button className="ds-btn primary" disabled={!valid || saving} onClick={submit}>
          <Check size={14}/> {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </ResponsiveModal>
  );
}
