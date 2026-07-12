import { useState } from 'react';
import { ArrowRight, Check, Loader2, Plus, Sparkles, X } from 'lucide-react';
import * as api from '../api.js';

const EXAMPLES = {
  events: 'Ex. : « Prime de 1 500 € le 20 mars, puis 800 € d’impôts en septembre »',
  loan: 'Ex. : « Prêt auto de 15 000 € sur 48 mois à 3,5 % »',
};

export function AiPlannerChat({ mode = 'events', accounts = [], onConfirmEvents, onConfirmLoan }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(null);
  const [events, setEvents] = useState(null);
  const [loan, setLoan] = useState(null);

  const clearResults = () => { setEvents(null); setLoan(null); setNote(null); };

  const analyse = async () => {
    if (!text.trim() || loading || saving) return;
    setLoading(true);
    clearResults();
    try {
      if (mode === 'loan') {
        const result = await api.aiPlanner.parseLoan(text.trim());
        if (!result?.available) {
          setNote(result?.note || 'Assistant IA non configuré.');
          return;
        }
        setLoan(result.loan || null);
        setNote(result.note || null);
      } else {
        const refs = accounts.map((account) => ({ id: account.id, name: account.name || '' }));
        const today = new Date().toISOString().slice(0, 10);
        const result = await api.aiPlanner.parseEvents(text.trim(), refs, today);
        if (!result?.available) {
          setNote(result?.note || 'Assistant IA non configuré.');
          return;
        }
        setEvents((result.events || []).map((event, index) => ({ ...event, _id: index, _include: true })));
        setNote(result.note || null);
      }
    } catch (error) {
      setNote(error?.message || 'Analyse impossible pour le moment.');
    } finally {
      setLoading(false);
    }
  };

  const patchEvent = (id, patch) => {
    setEvents((current) => current.map((event) => event._id === id ? { ...event, ...patch } : event));
  };

  const confirmEvents = async () => {
    const chosen = (events || []).filter((event) => event._include && event.label.trim() && Number(event.amount) > 0 && event.date);
    if (!chosen.length || saving) return;
    setSaving(true);
    setNote(null);
    try {
      const payload = chosen.map(({ _id, _include, ...event }) => ({
        ...event,
        amount: Math.abs(Number(event.amount) || 0),
        direction: event.direction === 'in' ? 'in' : 'out',
        account_id: event.account_id || null,
      }));
      const result = await onConfirmEvents?.(payload);
      if (result?.failed?.length) {
        setEvents(result.failed.map((event, index) => ({ ...event, _id: index, _include: true })));
        setNote(`${result.created || 0} ajouté(s), ${result.failed.length} à réessayer.`);
      } else {
        setText('');
        clearResults();
      }
    } catch (error) {
      setNote(error?.message || 'Enregistrement impossible. Vos propositions sont conservées.');
    } finally {
      setSaving(false);
    }
  };

  const confirmLoan = () => {
    onConfirmLoan?.(loan);
    setText('');
    clearResults();
  };

  const includedCount = (events || []).filter((event) => event._include).length;

  return (
    <section className="ai-planner">
      <style>{AI_PLANNER_CSS}</style>
      <div className="ai-planner-title"><Sparkles size={16}/> Décrivez, Yotori prépare</div>
      <div className="ai-planner-input-row">
        <textarea
          rows={2}
          placeholder={EXAMPLES[mode]}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) analyse();
          }}
          aria-label={mode === 'loan' ? 'Décrire un emprunt' : 'Décrire des événements futurs'}
        />
        <button className="ds-btn primary" onClick={analyse} disabled={loading || saving || !text.trim()}>
          {loading ? <><Loader2 size={14} className="spin"/> Analyse…</> : <>Analyser <ArrowRight size={14}/></>}
        </button>
      </div>
      <p className="ai-planner-hint">L’IA remplit un brouillon. Vérifiez les montants et les dates : rien n’est créé sans votre validation.</p>

      {note && <div className="ai-planner-note" role="status">{note}</div>}

      {events?.length > 0 && (
        <div className="ai-planner-results">
          {events.map((event) => (
            <div key={event._id} className={`ai-planner-event ${event._include ? '' : 'is-off'}`}>
              <button
                type="button"
                className="ai-planner-toggle"
                onClick={() => patchEvent(event._id, { _include: !event._include })}
                aria-label={event._include ? 'Ignorer cette proposition' : 'Inclure cette proposition'}
              >
                {event._include ? <Check size={14}/> : <X size={14}/>}
              </button>
              <input className="ai-planner-label" value={event.label} onChange={(e) => patchEvent(event._id, { label: e.target.value })} placeholder="Libellé"/>
              <div className="ai-planner-direction">
                <button type="button" className={event.direction !== 'in' ? 'on' : ''} onClick={() => patchEvent(event._id, { direction: 'out' })}>Sortie</button>
                <button type="button" className={event.direction === 'in' ? 'on' : ''} onClick={() => patchEvent(event._id, { direction: 'in' })}>Entrée</button>
              </div>
              <label><span>Montant</span><input type="number" min="0" value={event.amount} onChange={(e) => patchEvent(event._id, { amount: e.target.value })}/></label>
              <label><span>Date</span><input type="date" value={event.date || ''} onChange={(e) => patchEvent(event._id, { date: e.target.value })}/></label>
              {accounts.length > 0 && (
                <label><span>Compte</span><select value={event.account_id || ''} onChange={(e) => patchEvent(event._id, { account_id: e.target.value || null })}>
                  <option value="">Tous les comptes</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select></label>
              )}
            </div>
          ))}
          <button className="ds-btn primary ai-planner-confirm" onClick={confirmEvents} disabled={saving || includedCount === 0}>
            {saving ? <><Loader2 size={14} className="spin"/> Ajout…</> : <><Plus size={14}/> Ajouter {includedCount} événement{includedCount > 1 ? 's' : ''}</>}
          </button>
        </div>
      )}

      {loan && (
        <div className="ai-planner-results">
          <div className="ai-planner-loan">
            <label>Nom<input value={loan.name || ''} onChange={(e) => setLoan({ ...loan, name: e.target.value })}/></label>
            <label>Capital emprunté (€)<input type="number" min="0" value={loan.initial_capital ?? ''} onChange={(e) => setLoan({ ...loan, initial_capital: e.target.value })}/></label>
            <label>Taux annuel (%)<input type="number" min="0" step="0.01" value={loan.interest_rate ?? ''} onChange={(e) => setLoan({ ...loan, interest_rate: e.target.value })}/></label>
            <label>Durée (mois)<input type="number" min="1" value={loan.duration_months ?? ''} onChange={(e) => setLoan({ ...loan, duration_months: e.target.value })}/></label>
            <label>Mensualité (€)<input type="number" min="0" value={loan.monthly_payment ?? ''} onChange={(e) => setLoan({ ...loan, monthly_payment: e.target.value })}/></label>
          </div>
          <button className="ds-btn primary ai-planner-confirm" onClick={confirmLoan} disabled={!loan.name?.trim()}>
            Utiliser ce brouillon <ArrowRight size={14}/>
          </button>
        </div>
      )}
    </section>
  );
}

const AI_PLANNER_CSS = `
.ai-planner { margin: 14px 0 18px; padding: 15px; border: 1px solid var(--border); border-radius: 14px; background: linear-gradient(145deg, var(--accent-soft), var(--bg-elev) 62%); }
.ai-planner-title { display:flex; align-items:center; gap:7px; margin-bottom:10px; color:var(--accent); font-size:13px; font-weight:650; }
.ai-planner-input-row { display:flex; align-items:flex-start; gap:9px; }
.ai-planner-input-row textarea { flex:1; min-width:0; resize:vertical; padding:9px 11px; border:1px solid var(--border-strong); border-radius:10px; background:var(--bg-elev); color:var(--ink); font:400 14px var(--font-sans); }
.ai-planner-input-row textarea:focus, .ai-planner-event input:focus, .ai-planner-event select:focus, .ai-planner-loan input:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
.ai-planner-hint { margin:7px 0 0; color:var(--ink-3); font-size:11.5px; }
.ai-planner-note { margin-top:10px; padding:9px 11px; border-radius:9px; background:var(--bg-elev); color:var(--ink-2); font-size:12.5px; }
.ai-planner-results { display:flex; flex-direction:column; gap:8px; margin-top:12px; }
.ai-planner-event { display:flex; align-items:end; gap:8px; flex-wrap:wrap; padding:10px; border:1px solid var(--border); border-radius:11px; background:var(--bg-elev); }
.ai-planner-event.is-off { opacity:.5; }
.ai-planner-toggle { align-self:center; display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border:1px solid var(--border-strong); border-radius:8px; background:var(--bg); color:var(--accent); cursor:pointer; }
.ai-planner-event label { display:flex; flex-direction:column; gap:3px; color:var(--ink-3); font-size:10.5px; }
.ai-planner-event input, .ai-planner-event select, .ai-planner-loan input { min-height:34px; padding:6px 8px; border:1px solid var(--border-strong); border-radius:8px; background:var(--bg); color:var(--ink); font:400 13px var(--font-sans); }
.ai-planner-label { flex:1; min-width:150px; }
.ai-planner-direction { display:inline-flex; overflow:hidden; align-self:end; border:1px solid var(--border-strong); border-radius:8px; }
.ai-planner-direction button { min-height:34px; padding:6px 9px; border:0; background:var(--bg); color:var(--ink-3); cursor:pointer; }
.ai-planner-direction button.on { background:var(--accent-soft); color:var(--accent); }
.ai-planner-confirm { align-self:flex-start; }
.ai-planner-loan { display:grid; grid-template-columns:repeat(auto-fit,minmax(145px,1fr)); gap:10px; padding:11px; border:1px solid var(--border); border-radius:11px; background:var(--bg-elev); }
.ai-planner-loan label { display:flex; flex-direction:column; gap:4px; color:var(--ink-2); font-size:11.5px; }
@media (max-width: 680px) { .ai-planner-input-row { flex-direction:column; } .ai-planner-input-row .ds-btn { width:100%; justify-content:center; } .ai-planner-event > label { flex:1; min-width:130px; } }
`;
