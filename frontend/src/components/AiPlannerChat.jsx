/**
 * AiPlannerChat — saisie en langage naturel → propositions structurées à VALIDER.
 *
 * Deux modes :
 *  - mode="events" : « je touche 1500 € le 20 mars et je paie 800 € d'impôts en
 *    septembre » → cartes d'événements (Projection). onConfirmEvents(events[]).
 *  - mode="loan"   : « prêt auto 15 000 € sur 48 mois à 3,5 % » → une fiche prêt
 *    pré-remplie. onConfirmLoan(loan).
 *
 * L'IA ne crée RIEN : elle propose, l'utilisateur corrige et valide. Chaque
 * champ reste éditable avant validation (l'IA peut se tromper d'un montant/date).
 */
import { useState } from 'react';
import { Sparkles, Loader2, Check, X, Plus, ArrowRight } from 'lucide-react';
import * as api from '../api.js';

const EXAMPLES = {
  events: 'Ex : « prime de 1500 € le 20 mars, puis 800 € d\'impôts en septembre »',
  loan: 'Ex : « prêt auto de 15 000 € sur 48 mois à 3,5 % »',
};

export function AiPlannerChat({ mode = 'events', accounts = [], onConfirmEvents, onConfirmLoan }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState(null);
  const [events, setEvents] = useState(null);   // null | [] | [{...}]
  const [loan, setLoan] = useState(null);       // null | {...}

  const reset = () => { setEvents(null); setLoan(null); setNote(null); };

  const analyse = async () => {
    if (!text.trim() || loading) return;
    setLoading(true); reset();
    try {
      if (mode === 'loan') {
        const res = await api.aiPlanner.parseLoan(text.trim());
        if (!res?.available) { setNote(res?.note || 'Assistant IA non configuré.'); return; }
        setLoan(res.loan || null);
        setNote(res.note || null);
      } else {
        const accs = accounts.map(a => ({ id: a.id, name: a.name || '' }));
        const today = new Date().toISOString().slice(0, 10);
        const res = await api.aiPlanner.parseEvents(text.trim(), accs, today);
        if (!res?.available) { setNote(res?.note || 'Assistant IA non configuré.'); return; }
        setEvents((res.events || []).map((e, i) => ({ ...e, _id: i, _include: true })));
        setNote(res.note || null);
      }
    } catch (err) {
      setNote(err.message || 'Analyse impossible.');
    } finally {
      setLoading(false);
    }
  };

  const patchEvent = (id, patch) => setEvents(prev => prev.map(e => e._id === id ? { ...e, ...patch } : e));

  const confirmEvents = () => {
    const chosen = (events || []).filter(e => e._include && e.label && Number(e.amount) > 0);
    if (!chosen.length) return;
    const todayIso = new Date().toISOString().slice(0, 10);
    onConfirmEvents?.(chosen.map(({ _id, _include, ...e }) => ({
      ...e,
      amount: Math.abs(Number(e.amount) || 0),
      direction: e.direction === 'in' ? 'in' : 'out',
      date: e.date || todayIso,   // la date est requise côté API ; défaut = aujourd'hui
      account_id: e.account_id || null,
    })));
    setText(''); reset();
  };

  return (
    <section className="apc">
      <style>{APC_CSS}</style>
      <div className="apc-inputrow">
        <span className="apc-ic"><Sparkles size={15}/></span>
        <textarea
          className="apc-input"
          rows={2}
          placeholder={EXAMPLES[mode]}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) analyse(); }}
        />
        <button className="apc-btn primary" onClick={analyse} disabled={loading || !text.trim()}>
          {loading ? <><Loader2 size={14} className="apc-spin"/> Analyse…</> : <>Analyser <ArrowRight size={14}/></>}
        </button>
      </div>
      <div className="apc-hint">L'assistant propose — vous validez. Rien n'est créé sans votre confirmation. <kbd>⌘/Ctrl</kbd> + <kbd>Entrée</kbd> pour analyser.</div>

      {note && <div className="apc-note">{note}</div>}

      {/* ── Propositions : événements ── */}
      {events && events.length > 0 && (
        <div className="apc-results">
          {events.map((e) => (
            <div key={e._id} className={`apc-card ${e._include ? '' : 'is-off'}`}>
              <button className="apc-toggle" onClick={() => patchEvent(e._id, { _include: !e._include })} title={e._include ? 'Ignorer' : 'Inclure'}>
                {e._include ? <Check size={14}/> : <X size={14}/>}
              </button>
              <input className="apc-f apc-f-label" value={e.label} onChange={(ev) => patchEvent(e._id, { label: ev.target.value })} placeholder="Libellé"/>
              <div className="apc-dir">
                <button className={e.direction !== 'in' ? 'on' : ''} onClick={() => patchEvent(e._id, { direction: 'out' })}>Sortie</button>
                <button className={e.direction === 'in' ? 'on' : ''} onClick={() => patchEvent(e._id, { direction: 'in' })}>Entrée</button>
              </div>
              <input className="apc-f apc-f-amount" type="number" value={e.amount} onChange={(ev) => patchEvent(e._id, { amount: ev.target.value })} placeholder="Montant"/>
              <input className="apc-f apc-f-date" type="date" value={e.date || ''} onChange={(ev) => patchEvent(e._id, { date: ev.target.value })}/>
              {accounts.length > 0 && (
                <select className="apc-f apc-f-acc" value={e.account_id || ''} onChange={(ev) => patchEvent(e._id, { account_id: ev.target.value || null })}>
                  <option value="">Global</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
            </div>
          ))}
          <button className="apc-btn primary apc-confirm" onClick={confirmEvents}>
            <Plus size={14}/> Ajouter {events.filter(e => e._include).length} événement{events.filter(e => e._include).length > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* ── Proposition : prêt ── */}
      {loan && (
        <div className="apc-results">
          <div className="apc-loan">
            <label>Nom<input value={loan.name || ''} onChange={(e) => setLoan({ ...loan, name: e.target.value })}/></label>
            <label>Capital emprunté (€)<input type="number" value={loan.initial_capital ?? ''} onChange={(e) => setLoan({ ...loan, initial_capital: e.target.value })}/></label>
            <label>Taux annuel (%)<input type="number" step="0.01" value={loan.interest_rate ?? ''} onChange={(e) => setLoan({ ...loan, interest_rate: e.target.value })}/></label>
            <label>Durée (mois)<input type="number" value={loan.duration_months ?? ''} onChange={(e) => setLoan({ ...loan, duration_months: e.target.value })}/></label>
            <label>Mensualité (€, optionnel)<input type="number" value={loan.monthly_payment ?? ''} onChange={(e) => setLoan({ ...loan, monthly_payment: e.target.value })}/></label>
          </div>
          <button className="apc-btn primary apc-confirm" onClick={() => { onConfirmLoan?.(loan); setText(''); reset(); }}>
            Continuer avec ce prêt <ArrowRight size={14}/>
          </button>
        </div>
      )}
    </section>
  );
}

const APC_CSS = `
.apc { border: 1px solid var(--border); background: var(--bg-elev); border-radius: 12px; padding: 14px; margin: 14px 0; }
.apc-inputrow { display: flex; gap: 9px; align-items: flex-start; }
.apc-ic { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 8px; background: var(--accent-soft); color: var(--accent); flex-shrink: 0; margin-top: 2px; }
.apc-input { flex: 1; min-width: 0; resize: vertical; border: 1.5px solid var(--border-strong); border-radius: 10px; background: var(--bg-card, var(--bg)); color: var(--ink); font: 400 14px var(--font-sans); padding: 8px 11px; }
.apc-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.apc-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 15px; border-radius: 999px; font: 600 13px var(--font-sans); cursor: pointer; border: 1px solid transparent; white-space: nowrap; }
.apc-btn.primary { background: var(--accent); color: var(--on-accent, #fff); }
.apc-btn.primary:hover:not(:disabled) { filter: brightness(1.07); }
.apc-btn:disabled { opacity: .6; cursor: default; }
.apc-hint { margin-top: 8px; font-size: 11px; color: var(--ink-3); }
.apc-hint kbd { font-family: var(--font-mono); background: var(--bg-sunk); border: 1px solid var(--border); border-radius: 4px; padding: 0 4px; font-size: 10px; }
.apc-note { margin-top: 10px; padding: 9px 12px; border-radius: 8px; background: var(--bg-sunk); color: var(--ink-2); font-size: 12.5px; }
.apc-results { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.apc-card { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 9px 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); }
.apc-card.is-off { opacity: .5; }
.apc-toggle { width: 26px; height: 26px; border-radius: 7px; border: 1px solid var(--border-strong); background: var(--bg-elev); color: var(--accent); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.apc-f { border: 1px solid var(--border-strong); border-radius: 8px; background: var(--bg-elev); color: var(--ink); font: 400 13px var(--font-sans); padding: 6px 8px; }
.apc-f:focus { outline: none; border-color: var(--accent); }
.apc-f-label { flex: 1; min-width: 110px; }
.apc-f-amount { width: 92px; text-align: right; font-variant-numeric: tabular-nums; }
.apc-f-date { width: 140px; }
.apc-f-acc { max-width: 130px; }
.apc-dir { display: inline-flex; border: 1px solid var(--border-strong); border-radius: 8px; overflow: hidden; }
.apc-dir button { border: none; background: var(--bg-elev); color: var(--ink-3); font: 500 12px var(--font-sans); padding: 6px 9px; cursor: pointer; }
.apc-dir button.on { background: var(--accent-soft); color: var(--accent); }
.apc-loan { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); }
.apc-loan label { display: flex; flex-direction: column; gap: 4px; font: 500 11.5px var(--font-sans); color: var(--ink-2); }
.apc-loan input { border: 1px solid var(--border-strong); border-radius: 8px; background: var(--bg-elev); color: var(--ink); font: 400 13.5px var(--font-sans); padding: 7px 9px; }
.apc-loan input:focus { outline: none; border-color: var(--accent); }
.apc-confirm { align-self: flex-start; }
.apc-spin { animation: apcSpin .8s linear infinite; }
@keyframes apcSpin { to { transform: rotate(360deg); } }
@media (max-width: 640px) { .apc-f-date { width: 128px; } .apc-f-acc { max-width: 110px; } }
`;
