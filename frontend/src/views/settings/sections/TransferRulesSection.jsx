// TransferRulesSection — Settings > Categories & regles > Regles virement auto
//
// Permet a l'utilisateur de creer des regles "si le label contient X,
// marquer comme virement vers compte Y". Stockee en localStorage (MVP).
// Bouton "Appliquer aux X tx" qui walk les tx existantes + applique les
// regles. Auto-apply sur nouvelles tx au sync (fait dans WealthlyApp).
import { useState, useMemo } from 'react';
import { Plus, Trash2, Wand2, ArrowRight } from 'lucide-react';
import { ACCOUNT_ROLES, loadTransferRules, saveTransferRules, matchTransferRule, buildTransferDestTag } from '../../../utils.js';
import { Combobox } from '../../../components/Combobox.jsx';

export function TransferRulesSection({ accounts, transactions, transferIds, updateTags, setTransferOverride, showToast }) {
  const [rules, setRules] = useState(() => loadTransferRules());
  const [newPattern, setNewPattern] = useState('');
  const [newDestId, setNewDestId] = useState('');
  const [applying, setApplying] = useState(false);

  const eligibleAccounts = useMemo(
    () => (accounts || []).filter(a => {
      const r = a.role || 'principal';
      return ['epargne', 'investissement', 'depenses', 'principal'].includes(r);
    }),
    [accounts]
  );

  const addRule = () => {
    const pat = newPattern.trim();
    if (!pat || !newDestId) return;
    const rule = {
      id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pattern: pat,
      destAccountId: newDestId,
      createdAt: new Date().toISOString(),
    };
    const next = [...rules, rule];
    setRules(next);
    saveTransferRules(next);
    setNewPattern('');
    setNewDestId('');
    showToast?.('Règle ajoutée', 'success');
  };

  const deleteRule = (id) => {
    const next = rules.filter(r => r.id !== id);
    setRules(next);
    saveTransferRules(next);
  };

  // Tx qui seraient impactees par les regles actuelles (preview avant clic)
  const impactedCount = useMemo(() => {
    if (!transactions || rules.length === 0) return 0;
    let count = 0;
    for (const tx of transactions) {
      // skip if deja marquee comme transfer (manuel ou auto-detect)
      if (transferIds && transferIds.has(tx.id)) continue;
      if (tx.isTransferOverride === true) continue;
      const match = matchTransferRule(tx, rules);
      if (match) count++;
    }
    return count;
  }, [transactions, rules, transferIds]);

  const applyToHistory = async () => {
    if (!transactions || rules.length === 0 || applying) return;
    setApplying(true);
    let applied = 0;
    try {
      for (const tx of transactions) {
        if (transferIds && transferIds.has(tx.id)) continue;
        if (tx.isTransferOverride === true) continue;
        const match = matchTransferRule(tx, rules);
        if (!match) continue;
        const currentTags = (tx.tags || []).filter(t => !(typeof t === 'string' && t.startsWith('transfer-dest:')));
        currentTags.push(buildTransferDestTag(match.destAccountId));
        if (updateTags) await updateTags(tx.id, currentTags);
        if (setTransferOverride) await setTransferOverride(tx.id, true);
        applied++;
      }
      showToast?.(`${applied} transaction${applied > 1 ? 's' : ''} marquée${applied > 1 ? 's' : ''} comme virement`, 'success');
    } catch (err) {
      showToast?.('Erreur pendant l\'application des règles', 'error');
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className="card transfer-rules-section">
      <div className="card-header">
        <h3><Wand2 size={16}/> Règles de marquage automatique</h3>
        <span className="card-meta">Le label contient X → marqué comme virement vers compte Y</span>
      </div>

      <div className="tr-form">
        <div className="tr-form-row">
          <input
            type="text"
            placeholder='ex : "LIVRET A" ou "REVOLUT"'
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            className="tr-input"
          />
          <ArrowRight size={14} className="tr-arrow"/>
          <Combobox
            width={220}
            value={newDestId}
            onChange={setNewDestId}
            placeholder="Compte cible…"
            options={eligibleAccounts.map(a => {
              const r = a.role || 'principal';
              const roleLabel = ACCOUNT_ROLES[r]?.label || r;
              return {
                value: a.id,
                label: a.name || a.bank || '—',
                meta: roleLabel,
              };
            })}
          />
          <button
            className="primary-btn tr-add-btn"
            disabled={!newPattern.trim() || !newDestId}
            onClick={addRule}
          >
            <Plus size={13}/> Ajouter
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="tr-empty">
          <Wand2 size={20}/>
          <p>Aucune règle. Crée-en pour automatiser le marquage des virements récurrents (paie vers livret, transferts Revolut…).</p>
        </div>
      ) : (
        <>
          <ul className="tr-list">
            {rules.map(rule => {
              const destAcc = accounts.find(a => a.id === rule.destAccountId);
              const role = destAcc?.role || 'principal';
              const isSavings = role === 'epargne' || role === 'investissement';
              const isSecondary = role === 'depenses';
              return (
                <li key={rule.id} className="tr-item">
                  <code className="tr-pattern" title={`Pattern : ${rule.pattern}`}>
                    /{rule.pattern}/i
                  </code>
                  <span className="tr-sep"><ArrowRight size={12}/></span>
                  <span
                    className={`tr-dest ${isSavings ? 'savings' : isSecondary ? 'secondary' : ''}`}
                    title={ACCOUNT_ROLES[role]?.desc || ''}
                  >
                    ↔ {destAcc?.name || destAcc?.bank || 'Compte supprimé'}
                    <span className="tr-dest-role">{ACCOUNT_ROLES[role]?.label || role}</span>
                  </span>
                  <button className="icon-btn-sm" onClick={() => deleteRule(rule.id)} title="Supprimer la règle">
                    <Trash2 size={13}/>
                  </button>
                </li>
              );
            })}
          </ul>

          {impactedCount > 0 && (
            <div className="tr-apply-banner">
              <div className="tr-apply-text">
                <strong>{impactedCount}</strong> transaction{impactedCount > 1 ? 's' : ''} de l'historique correspond{impactedCount > 1 ? 'ent' : ''} à tes règles.
              </div>
              <button
                className="primary-btn"
                onClick={applyToHistory}
                disabled={applying}
              >
                {applying ? 'Application…' : 'Appliquer aux tx existantes'}
              </button>
            </div>
          )}
        </>
      )}

      <p className="settings-footnote">
        Les règles s'appliquent <strong>au sync</strong> sur les nouvelles transactions. Pour l'historique, clique sur "Appliquer aux tx existantes". Le type de virement (Épargne / Dépense secondaire) est déduit du rôle du compte cible.
      </p>
    </section>
  );
}
