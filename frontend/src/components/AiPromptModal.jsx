import { useState, useMemo } from 'react';
import { Copy, Check, X, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';

// "Catégorisation externe via prompt IA" — modal en 2 étapes :
// 1. Génère un prompt à copier (transactions non catégorisées + catégories valides)
//    L'utilisateur le colle dans Claude / ChatGPT / Mistral / etc.
// 2. L'utilisateur colle la réponse JSON et on l'applique en lot.
//
// Aucune clé API requise — alternative au flow BYOK pour les users qui veulent
// rester sous contrôle de leur quota et de leur LLM préféré.
export function AiPromptModal({ open, transactions = [], categories = [], accounts = [], onApply, onClose }) {
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
  // Filters out test slugs and de-duplicates concept-equivalent pairs so the
  // model sees a single option per concept and doesn't hesitate at random.
  const slugList = useMemo(() => {
    // Drop user-created test/garbage slugs that pollute the picker.
    const isTestSlug = (id) => /^test(-|$)/i.test(id) || /-assurance-scooter$/i.test(id);
    // Concept-equivalent duplicates : keep the canonical (built-in) slug,
    // drop the alias that creates ambiguity for the model.
    const DUP_DROP = new Set(['sport', 'pharmacy', 'streaming', 'childcare']);

    return categories
      .filter(c => c.type !== 'transfer' && c.id !== 'uncategorized')
      .filter(c => !isTestSlug(c.id))
      .filter(c => !DUP_DROP.has(c.id))
      .map(c => {
        const parent = c.parent ? categories.find(p => p.id === c.parent) : null;
        return parent
          ? `  ${c.id} — ${c.name} (sous-catégorie de ${parent.name})`
          : `  ${c.id} — ${c.name}`;
      })
      .join('\n');
  }, [categories]);

  const accountById = useMemo(() => {
    const m = {};
    accounts.forEach(a => { m[a.id] = a; });
    return m;
  }, [accounts]);

  const prompt = useMemo(() => {
    if (candidates.length === 0) return '';
    const txLines = candidates.map((tx, i) => {
      const amount = tx.amount >= 0 ? `+${tx.amount.toFixed(2)}` : tx.amount.toFixed(2);
      const acc = accountById[tx.accountId];
      const accLabel = acc ? `${acc.bank || ''} ${acc.name || ''}`.trim() : '';
      const meta = [tx.date, accLabel].filter(Boolean).join(' · ');
      return `${i + 1}. [${meta}] ${amount} €  ${tx.label}`;
    }).join('\n');
    return `Tu es un assistant qui catégorise des transactions bancaires françaises.

# Catégories disponibles

Utilise EXACTEMENT le slug (premier mot avant le tiret), jamais le nom français.

${slugList}

# Étape 1 — Scan préalable (récurrence)

AVANT de catégoriser ligne par ligne, parcours toute la liste pour repérer les marchands récurrents :
- même nom (insensible à la casse, codes numériques / dates ignorés)
- apparaissant ≥ 2 fois sur ≥ 2 mois différents
- avec un montant similaire (±20 %)

Pour ces marchands récurrents :
- Si abonnement / service → \`subs_*\` (subs_video, subs_music, subs_cloud, subs_gym, subs_press, subs_services)
- Si charge fixe → \`rent\`, \`insurance_*\`, \`electricity_gas\`, \`water\`, \`internet_telecom\`, etc.
- Si salaire / pension → \`salary\` / \`other_income\`

Pour les marchands ponctuels (≤ 1 occurrence) → catégorise selon le type de produit / service du marchand.

# Étape 2 — Web search pour les marchands inconnus (si tu y as accès)

Si tu as accès à une recherche web et qu'un marchand est inconnu :
- Cherche le nom du marchand (sans codes numériques, dates, préfixes bancaires)
- Identifie son secteur d'activité (resto, transport, mode, abonnement…)
- Budget : maximum 1 recherche par marchand inconnu, et seulement si le nom contient ≥ 4 lettres
- Si toujours incertain après recherche → \`uncategorized\`

Si tu n'as PAS accès à une recherche web, ignore cette étape.

# Étape 3 — Règles de catégorisation

**Préfixes bancaires à ignorer** pour identifier le marchand : \`PAIEMENT PAR CARTE X\\d+\`, \`PRELEVEMENT\`, \`VIREMENT EMIS WEB\`, \`RETRAIT AU DISTRIBUTEUR X\\d+\`, \`COTISATION\`, \`CHEQUE EMIS\`, dates en suffixe (\`12/04\`), heures (\`14H30\`).

**Processeurs de paiement** : PAYPAL / STRIPE / SUMUP / LYDIA / SQ * / NYX * précèdent souvent le vrai marchand. Exemple : \`PAYPAL *NESPRESSO\` → catégorise Nespresso, pas Paypal.

**Sous-catégorie la plus spécifique** : si \`subs_video\` colle, préfère-la à \`subscriptions\`.

**Cotisations bancaires** : \`COTISATION Offre Premium\`, \`COTISATION Carte ...\` → \`fees\`.

# Étape 4 — Quand mettre \`uncategorized\`

Mets \`uncategorized\` (avec confiance) dans ces cas :
- Libellé composé uniquement de codes numériques ou identifiants opaques (\`4657-PAR-CHAMPS\`, \`1398858\`, \`MCB-LA-POMPADOUR\`)
- Libellé contenant un nom de personne sans contexte commercial (\`BOKOBZA ETHEL NOA\`, \`DUPONT JEAN\`)
- Chèque émis sans bénéficiaire identifiable (\`CHEQUE EMIS XXXXXX\`)
- Versement d'espèces / virement entre comptes du même titulaire
- Confiance < 70 % après scan + web search

# Étape 5 — Transferts internes (entre tes propres comptes)

Mets \`uncategorized\` (l'utilisateur les marquera comme virement interne via le badge ↔). N'invente PAS de slug \`transfer\` — il n'existe pas dans la liste.

Indices génériques de transfert interne :
- Libellé contient le nom d'une carte/banque secondaire de l'utilisateur (Revolut, N26, Lydia, Wise, Bunq, etc.)
- Montant positif sur une carte de crédit avec libellé \`PRELEVEMENT\`, \`PAIEMENT REÇU\`, \`ENREGISTRE-MERCI\`, \`DÉPENSE ÉCHELONNÉE\` (côté +)
- Paire \`-X / +X\` même jour même libellé (échelonnement de paiement carte de crédit)

# Étape 6 — Exemples (universels)

Quelques cas résolus pour calibrer ton raisonnement :

- \`PAIEMENT PAR CARTE X1234 NETFLIX.COM 12/04\` (récurrent ~11,99 €/mois) → \`subs_video\`
- \`PAIEMENT PAR CARTE X1234 UBER * EATS 22/04\` → \`resto_delivery\`
- \`PAIEMENT PAR CARTE X1234 UBER * TRIP 22/04\` → \`taxi_vtc\`
- \`PRELEVEMENT EDF\` (récurrent mensuel) → \`electricity_gas\`
- \`VIREMENT EN VOTRE FAVEUR SALAIRE\` (récurrent mensuel ≥ 1500 €) → \`salary\`
- \`PAIEMENT PAR CARTE X1234 AMAZON PAYMENTS 03/05\` (montants variables, ponctuel) → \`shop_marketplace\`
- \`PAIEMENT PAR CARTE X1234 CARREFOUR LEVALLOIS 14/05\` → \`groceries_super\`
- \`PRELEVEMENT AUTOMATIQUE ENREGISTRE-MERCI\` (montant positif sur AMEX/CB) → \`uncategorized\` (règlement carte de crédit = transfert)
- \`COTISATION Offre Premium\` (récurrent ~15 €/mois) → \`fees\`
- \`CHEQUE EMIS 1398858\` → \`uncategorized\`

# Transactions à catégoriser

Format : numéro, [date · compte], montant, libellé brut.

${txLines}

# Format de réponse — STRICT

Ta réponse doit être UNIQUEMENT le JSON brut, RIEN d'autre. Pas de texte autour, pas de markdown, pas d'artefact.

INTERDIT :
- ❌ Phrase d'introduction ("Voici la catégorisation…", "D'accord, voici…")
- ❌ Phrase de conclusion ("J'espère que…", commentaires sur ton raisonnement)
- ❌ Bloc markdown avec triples backticks (\\\`\\\`\\\`json ... \\\`\\\`\\\`)
- ❌ Bloc artefact / canvas — pas de \`<artifact>\`, pas d'éditeur de code interactif
- ❌ Toute clé autre que les numéros (1, 2, 3…) en string
- ❌ Toute valeur qui n'est PAS un slug exact de la liste ci-dessus (ou \`uncategorized\`)
- ❌ Nom français au lieu du slug ("Restaurants" → INVALIDE, doit être "restaurants")
- ❌ Slug \`transfer\` (il n'existe pas — utilise \`uncategorized\` pour les virements internes)

EXIGÉ : la première caractère de ta réponse doit être \`{\`, et le dernier \`}\`.

Format exact attendu (clés = numéros de transactions en string, valeurs = slugs) :

{"1":"subs_video","2":"groceries_super","3":"taxi_vtc","4":"uncategorized","5":"resto_meal"}

Tu peux mettre des espaces / sauts de ligne entre les paires pour la lisibilité, mais le tout doit rester un objet JSON valide unique, parsable par \`JSON.parse()\`.

Vérifie avant d'envoyer : ta réponse commence-t-elle par \`{\` et finit-elle par \`}\` ? Si non, recommence.`;
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
      // Extraction tolérante :
      //  1. Strip markdown fences ```json ... ``` ou ```
      //  2. Strip artefact-style wrappers
      //  3. Récupère le {...} le plus large
      let raw = response.trim();
      raw = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
      const match = raw.match(/\{[\s\S]*\}/);
      raw = match ? match[0] : raw;
      parsed = JSON.parse(raw);
    } catch (e) {
      setParseError('JSON invalide. Vérifie que la réponse commence par { et finit par }.');
      return;
    }

    // Map slug exact (case-insensitive) OU nom FR de catégorie → slug canonique.
    // Tolère les variantes que Claude/ChatGPT renvoient parfois.
    const validSlugs = new Set(categories.map(c => c.id));
    const nameToSlug = new Map(
      categories.map(c => [String(c.name || '').toLowerCase().trim(), c.id])
    );

    const updates = [];
    let rejected = 0;
    let rejectedSlugs = [];

    for (const [idx, rawSlug] of Object.entries(parsed)) {
      const i = parseInt(idx, 10) - 1;
      if (Number.isNaN(i) || i < 0 || i >= candidates.length) {
        rejected++; continue;
      }
      let s = String(rawSlug || '').trim();
      // Hallucination commune : 'transfer' → on tombe sur 'uncategorized'
      // (le user le marquera ensuite via le badge ↔).
      if (s.toLowerCase() === 'transfer' || s.toLowerCase() === 'transfert') s = 'uncategorized';
      if (validSlugs.has(s)) {
        updates.push({ txId: candidates[i].id, slug: s });
        continue;
      }
      // Fallback : nom FR (ex: "Restaurants") → slug
      const mapped = nameToSlug.get(s.toLowerCase());
      if (mapped && validSlugs.has(mapped)) {
        updates.push({ txId: candidates[i].id, slug: mapped });
        continue;
      }
      // Fallback : slug en majuscules ou avec espaces ('GROCERIES SUPER')
      const cleaned = s.toLowerCase().replace(/\s+/g, '_');
      if (validSlugs.has(cleaned)) {
        updates.push({ txId: candidates[i].id, slug: cleaned });
        continue;
      }
      rejected++;
      if (rejectedSlugs.length < 5) rejectedSlugs.push(s);
    }

    if (updates.length === 0) {
      setParseError(
        rejected > 0
          ? `Aucun slug valide. ${rejected} entrées rejetées. Exemples : ${rejectedSlugs.join(', ')}`
          : 'Aucune catégorisation valide trouvée dans la réponse.'
      );
      return;
    }
    if (rejected > 0) {
      // On applique quand même mais on prévient
      // eslint-disable-next-line no-console
      console.warn(`[AiPromptModal] ${rejected} entrées rejetées :`, rejectedSlugs);
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
