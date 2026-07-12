// ============================================================================
// ImportPositionsModal — import universel de portefeuille (CSV / XLSX)
//
// Flux :
//   1. upload  : drop zone, accepte CSV / XLS / XLSX
//   2. mapping : si l'auto-détection est incomplète, l'utilisateur associe
//                les colonnes du fichier aux champs Yotori Finance (Nom, ISIN,
//                Quantité, Prix de revient, Cours, Valeur). Possibilité de
//                mémoriser le mapping pour la prochaine importation depuis
//                la même banque (signature des headers en localStorage).
//   3. preview : aperçu de N positions reconstituées + bouton "Importer"
//   4. done    : confirmation
// ============================================================================
import { useState, useMemo } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Plus, RefreshCw } from 'lucide-react';
import {
  parsePositionsFile,
  applyPositionsMapping,
  isMappingComplete,
  saveLearnedMapping,
  POSITION_FIELDS,
} from '../utils/positionsImport.js';
import { ResponsiveModal } from './ui/ResponsiveModal.jsx';

export function ImportPositionsModal({ parentAsset, fmt, onConfirm, onClose, initialMode = 'choice' }) {
  const [step, setStep] = useState(initialMode === 'manual' ? 'manual' : initialMode === 'replace' ? 'upload' : 'choice');
  const [importMode, setImportMode] = useState(initialMode === 'manual' ? 'append' : 'replace');
  const [headers, setHeaders] = useState([]);
  const [dataRows, setDataRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [positions, setPositions] = useState([]);
  const [autoDetected, setAutoDetected] = useState(false);
  const [fromLearned, setFromLearned] = useState(false);
  const [rememberMapping, setRememberMapping] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [manual, setManual] = useState({ name: '', isin: '', ticker: '', quantity: '', buyingPrice: '', lastPrice: '', amount: '' });

  const handleFile = async (file) => {
    setError(null);
    const result = await parsePositionsFile(file);
    if (result.error) {
      setError(result.error);
      return;
    }
    setHeaders(result.headers);
    setDataRows(result.dataRows);
    setMapping(result.mapping || {});
    setAutoDetected(result.autoDetected);
    setFromLearned(result.fromLearned);

    if (result.autoDetected) {
      // On peut sauter direct à la preview
      const pos = applyPositionsMapping(result.headers, result.dataRows, result.mapping);
      setPositions(pos);
      setStep('preview');
    } else {
      // Wizard manuel
      setStep('mapping');
    }
  };

  const confirmMapping = () => {
    if (!isMappingComplete(mapping)) {
      setError('Mappe au moins le Nom, la Quantité et le Cours (ou la Valeur).');
      return;
    }
    setError(null);
    const pos = applyPositionsMapping(headers, dataRows, mapping);
    setPositions(pos);
    if (rememberMapping) saveLearnedMapping(headers, mapping);
    setStep('preview');
  };

  const confirm = async () => {
    if (positions.length === 0) {
      setError('Aucune position exploitable : vérifiez les colonnes et les quantités avant de remplacer le portefeuille.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(positions, { mode: importMode });
      setStep('done');
    } catch (err) {
      setError(err?.message || 'La mise à jour a échoué. Votre ancien portefeuille a été conservé.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmManual = async () => {
    const quantity = parseFloat(manual.quantity) || 0;
    const lastPrice = parseFloat(manual.lastPrice) || 0;
    const amount = parseFloat(manual.amount) || quantity * lastPrice;
    if (!manual.name.trim() || amount <= 0) {
      setError('Renseignez au moins un nom et une valorisation (ou quantité × cours).');
      return;
    }
    setPositions([{
      name: manual.name.trim(), isin: manual.isin.trim(), ticker: manual.ticker.trim(),
      tickerYahoo: manual.ticker.trim(), quantity, buyingPrice: parseFloat(manual.buyingPrice) || 0,
      lastPrice, amount,
    }]);
    setImportMode('append');
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm([{
        name: manual.name.trim(), isin: manual.isin.trim(), ticker: manual.ticker.trim(),
        tickerYahoo: manual.ticker.trim(), quantity, buyingPrice: parseFloat(manual.buyingPrice) || 0,
        lastPrice, amount,
      }], { mode: 'append' });
      setStep('done');
    } catch (err) {
      setError(err?.message || "L'ajout a échoué. Réessayez dans un instant.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveModal open={true} onClose={onClose} className="import-positions-v3" title="Gérer le portefeuille">
        <ImportPositionsStyles/>

        <div className="ipv3-head">
          <div>
            <h2 className="ipv3-title">
              {step === 'manual' ? <>Ajouter une <em>position.</em></> : step === 'choice' ? <>Gérer le <em>portefeuille.</em></> : <>Mettre à jour le <em>portefeuille.</em></>}
            </h2>
            <div className="ipv3-sub">
              {parentAsset?.name && <><strong>{parentAsset.name}</strong> · </>}
              {step === 'manual' ? 'ajout manuel' : step === 'choice' ? 'choisissez la méthode la plus simple' : 'relevé complet CSV ou XLSX'}
            </div>
          </div>
          <button className="ipv3-close" onClick={onClose} aria-label="Fermer"><X size={18}/></button>
        </div>

        {/* Stepper — inutile sur le choix initial et l'ajout manuel. */}
        {!['choice', 'manual'].includes(step) && <div className="ipv3-stepper">
          {[
            { id: 'upload', label: 'Fichier' },
            { id: 'mapping', label: 'Colonnes' },
            { id: 'preview', label: 'Aperçu' },
          ].map((s, i) => {
            const active = s.id === step;
            const done = stepIndex(step) > i;
            return (
              <div key={s.id} className={`ipv3-step ${active ? 'on' : ''} ${done ? 'done' : ''}`}>
                <span className="ipv3-step-dot">{done ? <CheckCircle2 size={12}/> : i + 1}</span>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>}

        {step === 'choice' && (
          <div className="ipv3-body">
            <p className="ipv3-choice-intro">Que souhaitez-vous faire sur <strong>{parentAsset?.name || 'ce portefeuille'}</strong> ?</p>
            <div className="ipv3-choice-grid">
              <button type="button" className="ipv3-choice" onClick={() => { setImportMode('replace'); setStep('upload'); }}>
                <span className="ipv3-choice-icon"><RefreshCw size={22}/></span>
                <strong>Mettre à jour tout le portefeuille</strong>
                <span>Réimportez le relevé complet. Les anciennes lignes seront remplacées après votre confirmation.</span>
                <em>Recommandé après un achat ou une vente</em>
              </button>
              <button type="button" className="ipv3-choice" onClick={() => { setImportMode('append'); setStep('manual'); }}>
                <span className="ipv3-choice-icon"><Plus size={22}/></span>
                <strong>Ajouter une position</strong>
                <span>Saisissez une nouvelle ligne manuellement sans toucher aux positions existantes.</span>
                <em>Rapide pour un achat isolé</em>
              </button>
            </div>
          </div>
        )}

        {step === 'manual' && (
          <div className="ipv3-body">
            <p className="ipv3-banner">Ajoutez uniquement la nouvelle position. Les lignes déjà présentes restent inchangées.</p>
            <div className="ipv3-manual-grid">
              <label className="ipv3-manual-wide"><span>Nom de la position *</span><input autoFocus value={manual.name} onChange={e => setManual({ ...manual, name: e.target.value })} placeholder="Ex. Air Liquide"/></label>
              <label><span>ISIN <em>optionnel</em></span><input value={manual.isin} onChange={e => setManual({ ...manual, isin: e.target.value })} placeholder="FR0000120073"/></label>
              <label><span>Ticker <em>optionnel</em></span><input value={manual.ticker} onChange={e => setManual({ ...manual, ticker: e.target.value })} placeholder="AI.PA"/></label>
              <label><span>Quantité</span><input type="number" step="any" value={manual.quantity} onChange={e => setManual({ ...manual, quantity: e.target.value })} placeholder="10"/></label>
              <label><span>Prix de revient unitaire</span><input type="number" step="any" value={manual.buyingPrice} onChange={e => setManual({ ...manual, buyingPrice: e.target.value })} placeholder="145"/></label>
              <label><span>Cours actuel</span><input type="number" step="any" value={manual.lastPrice} onChange={e => setManual({ ...manual, lastPrice: e.target.value })} placeholder="178"/></label>
              <label><span>Valorisation totale</span><input type="number" step="any" value={manual.amount} onChange={e => setManual({ ...manual, amount: e.target.value })} placeholder="Calculée si vide"/></label>
            </div>
            {error && <div className="ipv3-error"><AlertCircle size={14}/> {error}</div>}
            <div className="ipv3-foot">
              <button className="ds-btn" onClick={() => setStep('choice')}>Retour</button>
              <button className="ds-btn primary" disabled={submitting} onClick={confirmManual}>{submitting ? 'Ajout…' : 'Ajouter la position'}</button>
            </div>
          </div>
        )}

        {step === 'upload' && (
          <div className="ipv3-body">
            <label className="ipv3-drop">
              <input
                type="file"
                accept=".csv,.xls,.xlsx,.xlsm,text/csv"
                style={{ display: 'none' }}
                onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
              />
              <Upload size={32}/>
              <p className="ipv3-drop-title">Sélectionnez votre fichier</p>
              <p className="ipv3-drop-sub">CSV (séparateur <code>;</code> ou <code>,</code>) · XLSX · XLS</p>
            </label>

            <div className="ipv3-info">
              <strong>Banques détectées automatiquement :</strong> Boursorama, Bourse Direct, BNP, Crédit Agricole, Société Générale, Trade Republic, Saxo, IBKR et toutes celles dont les colonnes contiennent <code>ISIN</code>, <code>Quantité</code>, <code>Cours</code> ou <code>Valeur</code>.
              <br/><br/>
              Pour les autres formats, vous pourrez associer les colonnes manuellement à l'étape suivante. Le mapping est mémorisé pour les imports futurs.
            </div>

            {error && (
              <div className="ipv3-error"><AlertCircle size={14}/> {error}</div>
            )}
          </div>
        )}

        {step === 'mapping' && (
          <div className="ipv3-body">
            <p className="ipv3-banner">
              {fromLearned
                ? "Mapping appris lors d'un import précédent. Vous pouvez ajuster si besoin."
                : "Format non reconnu automatiquement. Associez chaque champ Yotori Finance à la colonne correspondante de votre fichier."}
            </p>

            <div className="ipv3-map-grid">
              {POSITION_FIELDS.map(f => (
                <div key={f.key} className="ipv3-map-row">
                  <label className="ipv3-map-label">
                    {f.label}
                    {f.required && <span className="ipv3-map-req"> *</span>}
                  </label>
                  <select
                    className="ipv3-map-select"
                    value={mapping[f.key] || ''}
                    onChange={e => setMapping({ ...mapping, [f.key]: e.target.value || undefined })}
                  >
                    <option value="">— Aucune —</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <label className="ipv3-remember">
              <input
                type="checkbox"
                checked={rememberMapping}
                onChange={e => setRememberMapping(e.target.checked)}
              />
              <span>Mémoriser ce mapping pour la prochaine importation depuis la même banque</span>
            </label>

            {/* Preview des 3 premières lignes (raw) pour aider au mapping */}
            <details className="ipv3-raw">
              <summary>Aperçu brut du fichier (3 premières lignes)</summary>
              <div className="ipv3-raw-table">
                <table>
                  <thead>
                    <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {dataRows.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        {headers.map((h, j) => <td key={j}>{String(row[j] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            {error && <div className="ipv3-error"><AlertCircle size={14}/> {error}</div>}

            <div className="ipv3-foot">
              <button className="ds-btn" onClick={() => setStep('upload')}>Retour</button>
              <button className="ds-btn primary" onClick={confirmMapping}>
                Continuer
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="ipv3-body">
            <p className="ipv3-banner">
              <strong>{positions.length}</strong> position{positions.length > 1 ? 's' : ''} reconstituée{positions.length > 1 ? 's' : ''}
              {autoDetected && <span className="ipv3-tag-ok"> · format reconnu automatiquement</span>}
              {fromLearned && <span className="ipv3-tag-ok"> · mapping appris</span>}
              <span style={{ display: 'block', marginTop: 5 }}>Après confirmation, ces lignes remplaceront les anciennes. Les liquidités déjà présentes sur l’enveloppe seront conservées.</span>
            </p>

            <div className="ipv3-preview-table-wrap">
              <table className="ipv3-preview-table">
                <thead>
                  <tr>
                    <th>Valeur</th>
                    <th className="r">Quantité</th>
                    <th className="r">Prix revient</th>
                    <th className="r">Cours</th>
                    <th className="r">Valorisation</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p, i) => (
                    <tr key={i}>
                      <td>
                        <div className="ipv3-pos-name">{p.name}</div>
                        <div className="ipv3-pos-meta">
                          {p.isin && <span className="mono">{p.isin}</span>}
                          {p.tickerYahoo && <span className="ipv3-tag-live"> ● live {p.tickerYahoo}</span>}
                        </div>
                      </td>
                      <td className="r num">{formatQty(p.quantity)}</td>
                      <td className="r num">{p.buyingPrice ? fmt(p.buyingPrice) : '—'}</td>
                      <td className="r num">{p.lastPrice ? fmt(p.lastPrice) : '—'}</td>
                      <td className="r num">{fmt(p.amount || p.quantity * p.lastPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ipv3-foot">
              <button className="ds-btn" onClick={() => setStep(autoDetected ? 'upload' : 'mapping')}>
                Retour
              </button>
              <button className="ds-btn primary" disabled={submitting || positions.length === 0} onClick={confirm}>
                {submitting ? 'Mise à jour…' : `Remplacer par ces ${positions.length} positions`}
              </button>
            </div>
            {error && <div className="ipv3-error"><AlertCircle size={14}/> {error}</div>}
          </div>
        )}

        {step === 'done' && (
          <div className="ipv3-body ipv3-done">
            <CheckCircle2 size={36}/>
            <p className="ipv3-done-title">
              {positions.length} position{positions.length > 1 ? 's' : ''} {importMode === 'replace' ? 'mise' : 'ajoutée'}{positions.length > 1 ? 's' : ''} {importMode === 'replace' ? 'à jour' : ''}
            </p>
            <p className="ipv3-done-sub">
              Les cours live seront récupérés automatiquement pour les positions reconnues.
            </p>
            <button className="ds-btn primary" onClick={onClose}>Fermer</button>
          </div>
        )}
      </ResponsiveModal>
  );
}

function stepIndex(step) {
  return ['upload', 'mapping', 'preview', 'done'].indexOf(step);
}

function formatQty(q) {
  if (q === 0) return '0';
  if (Math.abs(q) >= 100) return q.toFixed(0);
  if (Math.abs(q) >= 1) return q.toFixed(2);
  return q.toFixed(4).replace(/\.?0+$/, '');
}

function ImportPositionsStyles() {
  const css = String.raw`
.import-positions-v3 {
  max-width: 880px;
  width: 95vw;
  max-height: 90vh;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.import-positions-v3 .num { font-variant-numeric: tabular-nums; }
.import-positions-v3 .mono { font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); letter-spacing: 0.02em; }
.import-positions-v3 .r { text-align: right; }

.ipv3-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--border);
}
.ipv3-title {
  font: 500 22px/1.15 var(--font-sans);
  margin: 0 0 4px;
  color: var(--ink);
}
.ipv3-title em {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  color: var(--ink-2);
}
.ipv3-sub { font: 400 13px/1.4 var(--font-sans); color: var(--ink-3); }
.ipv3-close {
  width: 32px; height: 32px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-elev);
  color: var(--ink-2);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background var(--t-fast);
}
.ipv3-close:hover { background: var(--bg-hover); color: var(--ink); }

/* Stepper */
.ipv3-stepper {
  display: flex;
  gap: 24px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-sunk);
}
.ipv3-step {
  display: flex; align-items: center; gap: 8px;
  font: 500 12px/1 var(--font-sans);
  color: var(--ink-3);
  letter-spacing: 0.02em;
}
.ipv3-step-dot {
  width: 22px; height: 22px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px;
  font-weight: 600;
  background: var(--bg-elev);
  color: var(--ink-3);
}
.ipv3-step.on { color: var(--ink); }
.ipv3-step.on .ipv3-step-dot {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.ipv3-step.done { color: var(--ink-2); }
.ipv3-step.done .ipv3-step-dot {
  background: var(--positive);
  border-color: var(--positive);
  color: #fff;
}

.ipv3-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
.ipv3-choice-intro { margin: 2px 0 16px; color: var(--ink-2); font-size: 14px; }
.ipv3-choice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ipv3-choice {
  min-height: 210px; padding: 22px; border: 1px solid var(--border); border-radius: var(--radius-lg);
  background: var(--bg-sunk); color: var(--ink); text-align: left; cursor: pointer;
  display: flex; flex-direction: column; align-items: flex-start; gap: 10px; font-family: inherit;
  transition: border-color var(--t-fast), background var(--t-fast), transform var(--t-fast);
}
.ipv3-choice:hover { border-color: var(--accent); background: var(--accent-soft); transform: translateY(-1px); }
.ipv3-choice-icon { width: 42px; height: 42px; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; background: var(--bg-elev); color: var(--accent); border: 1px solid var(--border); }
.ipv3-choice strong { font-size: 15px; }
.ipv3-choice > span:not(.ipv3-choice-icon) { color: var(--ink-2); font-size: 12.5px; line-height: 1.5; }
.ipv3-choice em { margin-top: auto; color: var(--accent); font-size: 11px; font-style: normal; font-weight: 600; }
.ipv3-manual-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ipv3-manual-grid label { display: flex; flex-direction: column; gap: 6px; color: var(--ink-2); font-size: 12px; font-weight: 600; }
.ipv3-manual-grid label span em { color: var(--ink-3); font-size: 10.5px; font-style: normal; font-weight: 400; }
.ipv3-manual-grid input { width: 100%; padding: 11px 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-elev); color: var(--ink); font: inherit; }
.ipv3-manual-grid input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.ipv3-manual-wide { grid-column: 1 / -1; }
.ipv3-banner {
  background: var(--accent-soft);
  color: var(--accent-2);
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font: 400 13px/1.5 var(--font-sans);
  margin: 0 0 16px;
}
.ipv3-tag-ok {
  color: var(--positive);
  font-weight: 500;
}
.ipv3-tag-live {
  color: var(--positive);
  font-weight: 500;
  font-size: 10.5px;
  margin-left: 6px;
}

/* Drop zone */
.ipv3-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 24px;
  border: 2px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--bg-sunk);
  color: var(--ink-2);
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast);
}
.ipv3-drop:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
}
.ipv3-drop svg { color: var(--ink-3); }
.ipv3-drop-title { font: 500 15px/1.2 var(--font-sans); color: var(--ink); margin: 0; }
.ipv3-drop-sub { font: 400 12px/1.4 var(--font-sans); color: var(--ink-3); margin: 0; }
.ipv3-drop-sub code {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 5px;
  font: 500 11px/1 var(--font-mono);
}
@media (max-width: 640px) {
  .ipv3-choice-grid, .ipv3-manual-grid { grid-template-columns: 1fr; }
  .ipv3-choice { min-height: 0; }
  .ipv3-manual-wide { grid-column: auto; }
  .ipv3-head { padding-left: 16px; padding-right: 16px; }
  .ipv3-body { padding: 16px; }
  .ipv3-stepper { gap: 10px; padding-left: 16px; padding-right: 16px; }
}

.ipv3-info {
  margin-top: 14px;
  padding: 14px 16px;
  background: var(--bg-sunk);
  border-radius: var(--radius-md);
  font: 400 12.5px/1.55 var(--font-sans);
  color: var(--ink-2);
}
.ipv3-info code {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 4px;
  font: 500 11px/1 var(--font-mono);
}

.ipv3-error {
  display: flex; align-items: center; gap: 8px;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--negative-soft);
  color: var(--negative);
  font: 400 13px/1.4 var(--font-sans);
}

/* Mapping */
.ipv3-map-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
  margin-bottom: 14px;
}
@media (max-width: 640px) { .ipv3-map-grid { grid-template-columns: 1fr; } }
.ipv3-map-row { display: flex; flex-direction: column; gap: 6px; }
.ipv3-map-label {
  font: 500 12px/1.2 var(--font-sans);
  color: var(--ink-2);
}
.ipv3-map-req { color: var(--negative); }
.ipv3-map-select {
  height: 34px;
  padding: 0 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg-elev);
  color: var(--ink);
  font: 400 13px/1 var(--font-sans);
  cursor: pointer;
}
.ipv3-map-select:hover { border-color: var(--border-strong); }
.ipv3-map-select:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.ipv3-remember {
  display: flex; align-items: center; gap: 8px;
  margin: 8px 0 16px;
  font: 400 13px/1.4 var(--font-sans);
  color: var(--ink-2);
  cursor: pointer;
}
.ipv3-remember input { cursor: pointer; }

.ipv3-raw {
  margin-top: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-sunk);
}
.ipv3-raw summary {
  padding: 10px 14px;
  font: 500 12px/1 var(--font-sans);
  color: var(--ink-2);
  cursor: pointer;
  user-select: none;
}
.ipv3-raw[open] summary { border-bottom: 1px solid var(--border); }
.ipv3-raw-table { overflow-x: auto; max-height: 200px; overflow-y: auto; }
.ipv3-raw-table table { border-collapse: collapse; font: 400 11px/1.4 var(--font-sans); width: 100%; }
.ipv3-raw-table th, .ipv3-raw-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  text-align: left;
}
.ipv3-raw-table th {
  background: var(--bg-elev);
  font-weight: 600;
  color: var(--ink-2);
  position: sticky;
  top: 0;
}

/* Preview */
.ipv3-preview-table-wrap {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  max-height: 380px;
  overflow-y: auto;
}
.ipv3-preview-table {
  width: 100%;
  border-collapse: collapse;
  font: 400 13px/1.4 var(--font-sans);
}
.ipv3-preview-table th,
.ipv3-preview-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  font-variant-numeric: tabular-nums;
}
.ipv3-preview-table th {
  background: var(--bg-sunk);
  text-align: left;
  font: 500 11px/1 var(--font-sans);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-3);
  position: sticky;
  top: 0;
}
.ipv3-preview-table .r { text-align: right; }
.ipv3-preview-table tbody tr:hover { background: var(--bg-hover); }
.ipv3-pos-name { font-weight: 500; color: var(--ink); }
.ipv3-pos-meta { margin-top: 2px; display: flex; gap: 8px; align-items: center; }

.ipv3-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.ipv3-done {
  display: flex; flex-direction: column; align-items: center;
  text-align: center;
  padding: 40px 24px;
  gap: 12px;
}
.ipv3-done > svg { color: var(--positive); }
.ipv3-done-title {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 22px;
  color: var(--positive);
  margin: 0;
}
.ipv3-done-sub {
  font: 400 13px/1.5 var(--font-sans);
  color: var(--ink-2);
  margin: 0;
  max-width: 420px;
}
.ipv3-done .ds-btn { margin-top: 8px; }
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}
