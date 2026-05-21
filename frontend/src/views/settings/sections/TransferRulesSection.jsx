// TransferRulesSection — Settings > Categories & regles > Regles virement auto
//
// Persisté backend (table categorisation_rules avec rule_type='transfer'
// et transfer_dest_account_id). Retrouvé depuis n'importe quel device.
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Trash2, Wand2, ArrowRight } from 'lucide-react';
import * as api from '../../../api.js';
import { ACCOUNT_ROLES, matchTransferRule, buildTransferDestTag } from '../../../utils.js';
import { Combobox } from '../../../components/Combobox.jsx';

export function TransferRulesSection({ accounts, transactions, transferIds, updateTags, setTransferOverride, showToast }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPattern, setNewPattern] = useState('');
  const [newDestId, setNewDestId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [applying, setApplying] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api.rules.list();
      // Filtre les transfer rules + map en camelCase pour le frontend
      const tr = (Array.isArray(list) ? list : [])
        .filter(r => r.rule_type === 'transfer' && r.transfer_dest_account_id)
        .map(r => ({
          id: r.id,
          pattern: r.pattern,
          transferDestAccountId: r.transfer_dest_account_id,
          createdAt: r.created_at,
        }));
      setRules(tr);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const eligibleAccounts = useMemo(
    () => (accounts || []).filter(a => {
      const r = a.role || 'principal';
      return ['epargne', 'investissement', 'depenses', 'principal'].includes(r);
    }),
    [accounts]
  );

  const addRule = async () => {
    const pat = newPattern.trim();
    if (!pat || !newDestId || submitting) return;
    setSubmitting(true);
    try {
      const created = await api.rules.create({
        pattern: pat,
        rule_type: 'transfer',
        transfer_dest_account_id: newDestId,
        category_slug: null,
        created_by: 'user',
      });
      setRules(prev => [...prev, {
        id: created.id,
        pattern: created.pattern,
        transferDestAccountId: created.transfer_dest_account_id,
        createdAt: created.created_at,
      }]);
      setNewPattern('');
      setNewDestId('');
      showToast?.('Règle ajoutée', 'success');
    } catch (err) {
      showToast?.('Erreur création règle : ' + (err?.message || ''), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteRule = async (id) => {
    try {
      await api.rules.delete(id);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      showToast?.('Erreur suppression règle', 'error');
    }
  };

  const impactedCount = useMemo(() => {
    if (!transactions || rules.length === 0) return 0;
    let count = 0;
    for (const tx of transactions) {
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
            className="ds-btn primary tr-add-btn"
            disabled={!newPattern.trim() || !newDestId || submitting}
            onClick={addRule}
          >
            <Plus size={13}/> {submitting ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="tr-empty">
          <p>Chargement…</p>
        </div>
      ) : rules.length === 0 ? (
        <div className="tr-empty">
          <Wand2 size={20}/>
          <p>Aucune règle. Crée-en pour automatiser le marquage des virements récurrents (paie vers livret, transferts Revolut…).</p>
        </div>
      ) : (
        <>
          <ul className="tr-list">
            {rules.map(rule => {
              const destAcc = accounts.find(a => a.id === rule.transferDestAccountId);
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
                className="ds-btn primary"
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
        Les règles sont stockées dans ton compte (Supabase) — retrouvées sur n'importe quel device. Elles s'appliquent <strong>au sync</strong> sur les nouvelles transactions. Pour l'historique, clique sur "Appliquer aux tx existantes".
      </p>
    </section>
  );
}
