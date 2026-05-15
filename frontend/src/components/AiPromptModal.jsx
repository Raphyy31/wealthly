import { useState, useMemo } from 'react';
import { Copy, Check, X, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';

// "Catégorisation externe via prompt IA" — modal en 2 étapes :
// 1. Génère un prompt à copier (transactions non catégorisées + catégories valides)
//    L'utilisateur le colle dans Claude / ChatGPT / Mistral / etc.
// 2. L'utilisateur colle la réponse JSON et on l'applique en lot.
//
// Aucune clé API requise — alternative au flow BYOK pour les users qui veulent
// rester sous contrôle de leur quota et de leur LLM préféré.
export function AiPromptModal({ open, transactions = [], categories = [], onApply, onClose }) {
  const [step, setStep] = useState(1);
  const [response, setResponse] = useState('');
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [parseError, setParseError] = useState(null);

  // Pick up to 100 uncategorized txs with non-empty label.
  const candidates = useMemo(() => {
    return transactions
      .filter(tx => (!tx.categoryId || tx.categoryId === 'uncategorized') && (tx.label || '').trim().length > 0)
      .slice(0, 100);
  }, [transactions]);

  // Slug list for the prompt — only expense + income, skip techniques.
  // Format: "slug — Name (parent name if sub)" so the LLM sees the hierarchy.
  const slugList = useMemo(() => {
    return categories
      .filter(c => c.type !== 'transfer' && c.id !== 'uncategorized')
      .map(c => {
        const parent = c.parent ? categories.find(p => p.id === c.parent) : null;
        return parent
          ? `  ${c.id} — ${c.name} (sous-catégorie de ${parent.name})`
          : `  ${c.id} — ${c.name}`;
      })
      .join('\n');
  }, [categories]);

  const prompt = useMemo(() => {
    if (candidates.length === 0) return '';
    const txLines = candidates.map((tx, i) => {
      const amount = tx.amount >= 0 ? `+${tx.amount.toFixed(2)}` : tx.amount.toFixed(2);
      return `${i + 1}. ${amount} €  ${tx.label}`;
    }).join('\n');
    return `Tu es un assistant qui catégorise des transactions bancaires françaises.

Voici les catégories disponibles (utilise EXACTEMENT le slug entre backticks, jamais le nom français) :

${slugList}

Voici ${candidates.length} transaction${candidates.length > 1 ? 's' : ''} à catégoriser (format : numéro, montant, libellé) :

${txLines}

Réponds UNIQUEMENT avec un objet JSON, sans texte avant ou après, au format :
{"1": "slug_choisi", "2": "slug_choisi", ...}

Règles :
- Si tu n'es pas sûr à au moins 70 %, mets "uncategorized".
- Pour les transferts entre comptes du même propriétaire, mets "transfer".
- Privilégie la sous-catégorie la plus spécifique (ex: "subs_video" plutôt que "subscriptions" pour Netflix).
- Les libellés bancaires français contiennent souvent "PAIEMENT PAR CARTE", "PRELEVEMENT", "VIREMENT" — ignore ces préfixes pour identifier le marchand.
- Les processeurs comme PAYPAL/STRIPE/SUMUP précèdent souvent le vrai marchand (ex: "PAYPAL *NESPRESSO" = Nespresso, donc subs_services ou subscriptions).`;
  }, [candidates, slugList]);

  if (!open) return null;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const apply = async () => {
    setParseError(null);
    let parsed;
    try {
      // Try to find JSON in the response (sometimes the LLM wraps it in ```json ... ```)
      const match = response.match(/\{[\s\S]*\}/);
      const raw = match ? match[0] : response;
      parsed = JSON.parse(raw);
    } catch (e) {
      setParseError('JSON invalide. Vérifie que tu colles bien le bloc { ... } seul.');
      return;
    }
    // Map index → tx id → category slug
    const validSlugs = new Set(categories.map(c => c.id));
    const updates = [];
    for (const [idx, slug] of Object.entries(parsed)) {
      const i = parseInt(idx, 10) - 1;
      if (Number.isNaN(i) || i < 0 || i >= candidates.length) continue;
      if (!validSlugs.has(slug)) continue;
      updates.push({ txId: candidates[i].id, slug });
    }
    if (updates.length === 0) {
      setParseError('Aucune catégorisation valide trouvée dans la réponse.');
      return;
    }
    setApplying(true);
    try {
      await onApply(updates);
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <AiPromptStyles/>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: 'var(--accent)' }}/>
            Catégorisation <em>externe</em> par IA
          </h2>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="modal-body">
          <div className="aip-steps">
            <span className={`aip-step ${step >= 1 ? 'active' : ''}`}>1. Copier le prompt</span>
            <span className={`aip-step ${step >= 2 ? 'active' : ''}`}>2. Coller la réponse</span>
          </div>

          {candidates.length === 0 ? (
            <div className="aip-empty">
              Aucune transaction non catégorisée. Importe d'abord un relevé ou marque des transactions comme "Non catégorisé".
            </div>
          ) : step === 1 ? (
            <>
              <p className="aip-intro">
                <strong>{candidates.length}</strong> transaction{candidates.length > 1 ? 's' : ''} non catégorisée{candidates.length > 1 ? 's' : ''}.
                Copie le prompt ci-dessous, colle-le dans <a href="https://claude.ai" target="_blank" rel="noopener noreferrer">Claude.ai</a>,
                <a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer"> ChatGPT</a> ou
                ton LLM préféré, puis récupère sa réponse JSON.
              </p>
              <div className="aip-prompt-wrap">
                <textarea className="aip-prompt-box" readOnly value={prompt} rows={12}/>
                <button className={`aip-copy-btn ${copied ? 'copied' : ''}`} onClick={copyPrompt}>
                  {copied ? <><Check size={13}/> Copié</> : <><Copy size={13}/> Copier le prompt</>}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="aip-intro">
                Colle ici la réponse JSON renvoyée par le chat. Le format attendu est <code>{'{"1": "slug", "2": "slug", ...}'}</code> — on tolère les blocs <code>```json</code> autour.
              </p>
              <textarea
                className="aip-response-box"
                value={response}
                onChange={e => { setResponse(e.target.value); setParseError(null); }}
                placeholder={'{\n  "1": "subs_video",\n  "2": "groceries_super",\n  ...\n}'}
                rows={12}
                autoFocus
              />
              {parseError && <div className="aip-error">⚠ {parseError}</div>}
            </>
          )}
        </div>
        <div className="modal-footer">
          {step === 1 ? (
            <>
              <button className="secondary-btn" onClick={onClose}>Annuler</button>
              <button className="primary-btn" onClick={() => setStep(2)} disabled={candidates.length === 0}>
                J'ai ma réponse <ChevronRight size={14}/>
              </button>
            </>
          ) : (
            <>
              <button className="secondary-btn" onClick={() => setStep(1)} disabled={applying}>
                <ChevronLeft size={14}/> Retour
              </button>
              <button className="primary-btn" onClick={apply} disabled={!response.trim() || applying}>
                <Check size={14}/> {applying ? 'Application…' : 'Appliquer les catégorisations'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AiPromptStyles() {
  return (
    <style>{`
      .aip-steps { display: flex; gap: 16px; font-size: 11px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 16px; }
      .aip-step.active { color: var(--accent); font-weight: 500; }
      .aip-intro { font-size: 13px; color: var(--ink-2); margin: 0 0 12px; line-height: 1.55; }
      .aip-intro a { color: var(--accent); text-decoration: none; border-bottom: 1px dashed currentColor; }
      .aip-empty { padding: 24px; text-align: center; color: var(--ink-3); font-size: 13px; }
      .aip-prompt-wrap { position: relative; }
      .aip-prompt-box, .aip-response-box {
        width: 100%; box-sizing: border-box;
        background: var(--bg-sunk, var(--bg)); color: var(--ink);
        border: 1px solid var(--border);
        border-radius: 8px; padding: 12px;
        font-family: var(--font-mono, monospace); font-size: 11.5px; line-height: 1.55;
        resize: vertical;
      }
      .aip-response-box:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
      .aip-copy-btn {
        position: absolute; top: 8px; right: 8px;
        background: var(--bg-elev); border: 1px solid var(--border);
        color: var(--ink-2); font-size: 11px;
        padding: 5px 10px; border-radius: 6px; cursor: pointer;
        display: inline-flex; align-items: center; gap: 5px;
        font-family: inherit;
      }
      .aip-copy-btn:hover { border-color: var(--accent); color: var(--accent); }
      .aip-copy-btn.copied { background: var(--positive-soft); color: var(--positive); border-color: var(--positive); }
      .aip-error { margin-top: 10px; padding: 8px 12px; background: var(--negative-soft); color: var(--negative); border-radius: 6px; font-size: 12px; }
      code { font-family: var(--font-mono, monospace); font-size: 11px; background: var(--bg-sunk); padding: 1px 6px; border-radius: 4px; }
    `}</style>
  );
}
