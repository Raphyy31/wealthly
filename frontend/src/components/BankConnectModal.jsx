/**
 * BankConnectModal — GoCardless Bank Account Data flow (open banking, DSP2)
 *
 * 1. User picks a country
 * 2. Component fetches the list of banks from /banking/banks (with logos)
 * 3. User picks a bank → POST /banking/connect → redirected to bank login
 * 4. After bank consent, the app URL gets ?ref={state} and YotoriApp
 *    detects it + polls /banking/complete to finalise.
 *
 * Design « Forêt » — pas d'emoji structurel, logos de banque, états clairs.
 */
import { useState } from 'react';
import { X, ChevronRight, Search, ShieldCheck, Landmark, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import * as api from '../api.js';
import { ResponsiveModal } from './ui/ResponsiveModal.jsx';

const COUNTRIES = [
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'ES', name: 'Espagne' },
  { code: 'IT', name: 'Italie' },
  { code: 'BE', name: 'Belgique' },
  { code: 'NL', name: 'Pays-Bas' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GB', name: 'Royaume-Uni' },
];

export function BankConnectModal({ onClose }) {
  const [step, setStep] = useState('country');
  const [country, setCountry] = useState('FR');
  const [banks, setBanks] = useState([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [connecting, setConnecting] = useState(null); // bankId being connected
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const loadBanks = async () => {
    setLoadingBanks(true);
    setError(null);
    try {
      const data = await api.banking.listBanks(country);
      const list = data.banks || data || [];
      setBanks(Array.isArray(list) ? list : []);
      setStep('list');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingBanks(false);
    }
  };

  const connectBank = async (bankId) => {
    setConnecting(bankId);
    setError(null);
    try {
      const result = await api.banking.connect(bankId, country);
      if (result.redirect_url) {
        window.location.href = result.redirect_url;
      } else {
        setError("Pas d'URL de redirection reçue");
        setConnecting(null);
      }
    } catch (err) {
      setError(err.message);
      setConnecting(null);
    }
  };

  const filteredBanks = banks.filter(b =>
    (b.name || b.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ResponsiveModal open={true} onClose={onClose}>
      <style>{BCM_CSS}</style>
      <div className="bcm-head">
        <div className="bcm-head-title">
          <span className="bcm-head-ic"><Landmark size={18}/></span>
          <h2>Connecter ma banque</h2>
        </div>
        <button className="bcm-close" onClick={onClose} aria-label="Fermer"><X size={18}/></button>
      </div>

      {step === 'country' && (
        <div className="bcm-body">
          <div className="bcm-secure">
            <ShieldCheck size={18}/>
            <span>Connexion sécurisée via <strong>GoCardless</strong> (DSP2). Vos identifiants restent sur le site de votre banque — Yotori Finance ne les voit jamais.</span>
          </div>

          <label className="bcm-field">
            <span className="bcm-label">Pays de votre banque</span>
            <select className="bcm-select" value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>

          {error && <div className="bcm-error"><AlertCircle size={15}/> {error}</div>}

          <div className="bcm-foot">
            <button className="bcm-btn ghost" onClick={onClose}>Annuler</button>
            <button className="bcm-btn primary" onClick={loadBanks} disabled={loadingBanks}>
              {loadingBanks ? <><Loader2 size={15} className="bcm-spin"/> Chargement…</> : <>Voir les banques <ArrowRight size={15}/></>}
            </button>
          </div>
        </div>
      )}

      {step === 'list' && (
        <div className="bcm-body">
          <div className="bcm-search">
            <Search size={15}/>
            <input
              placeholder="Chercher votre banque…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {connecting && (
            <div className="bcm-connecting" role="status" aria-live="polite">
              <Loader2 size={16} className="bcm-spin"/>
              <span>
                <strong>Préparation de la connexion sécurisée…</strong><br/>
                Vous allez être redirigé vers votre banque — cela peut prendre
                une dizaine de secondes, ne fermez pas cette fenêtre.
              </span>
            </div>
          )}

          <div className="bcm-list">
            {filteredBanks.length === 0 && (
              <div className="bcm-empty">
                {banks.length === 0 ? 'Aucune banque disponible pour ce pays.' : 'Aucun résultat.'}
              </div>
            )}
            {filteredBanks.map((bank, idx) => {
              const bankLabel = bank.name || bank.full_name || `Banque ${idx}`;
              const bankId = bank.id || bank.institution_id || bankLabel;
              const isConnecting = connecting === bankId;
              return (
                <button
                  key={bankId || idx}
                  className="bcm-bank"
                  onClick={() => connectBank(bankId)}
                  disabled={!!connecting}
                >
                  <span className="bcm-bank-logo">
                    {bank.logo
                      ? <img src={bank.logo} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.textContent = bankLabel.charAt(0); }}/>
                      : bankLabel.charAt(0)}
                  </span>
                  <span className="bcm-bank-name">{bankLabel}</span>
                  {isConnecting ? <Loader2 size={16} className="bcm-spin"/> : <ChevronRight size={16} className="bcm-bank-chev"/>}
                </button>
              );
            })}
          </div>

          {error && <div className="bcm-error"><AlertCircle size={15}/> {error}</div>}

          <button className="bcm-btn ghost bcm-back" onClick={() => setStep('country')}>
            ← Changer de pays
          </button>
        </div>
      )}
    </ResponsiveModal>
  );
}

const BCM_CSS = `
.bcm-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 22px 14px; border-bottom: 1px solid var(--border); }
.bcm-head-title { display: flex; align-items: center; gap: 11px; }
.bcm-head-ic { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 9px; background: var(--accent-soft); color: var(--accent); }
.bcm-head h2 { margin: 0; font: 500 18px var(--font-sans); letter-spacing: -0.015em; color: var(--ink); }
.bcm-close { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: none; border-radius: 8px; background: transparent; color: var(--ink-3); cursor: pointer; transition: background .12s, color .12s; }
.bcm-close:hover { background: var(--bg-sunk); color: var(--ink); }

.bcm-body { padding: 18px 22px 20px; display: flex; flex-direction: column; gap: 16px; }
.bcm-secure { display: flex; gap: 11px; padding: 13px 15px; border-radius: 12px; background: var(--accent-soft); border: 1px solid color-mix(in oklab, var(--accent) 22%, transparent); font: 400 13px/1.5 var(--font-sans); color: var(--ink-2); }
.bcm-secure svg { flex-shrink: 0; color: var(--accent); margin-top: 1px; }
.bcm-secure strong { color: var(--ink); font-weight: 600; }

.bcm-field { display: flex; flex-direction: column; gap: 7px; }
.bcm-label { font: 500 12.5px var(--font-sans); color: var(--ink-2); }
.bcm-select { height: 46px; padding: 0 14px; border-radius: 11px; border: 1.5px solid var(--border-strong); background: var(--bg-card); color: var(--ink); font: 500 15px var(--font-sans); cursor: pointer; transition: border-color .15s, box-shadow .15s; }
.bcm-select:hover { border-color: var(--ink-3); }
.bcm-select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }

.bcm-search { display: flex; align-items: center; gap: 9px; height: 46px; padding: 0 14px; border-radius: 11px; border: 1.5px solid var(--border-strong); background: var(--bg-card); transition: border-color .15s, box-shadow .15s; }
.bcm-search:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.bcm-search svg { color: var(--ink-3); flex-shrink: 0; }
.bcm-search input { flex: 1; min-width: 0; border: none; background: transparent; font: 400 15px var(--font-sans); color: var(--ink); }
.bcm-search input:focus { outline: none; }

.bcm-list { display: flex; flex-direction: column; gap: 6px; max-height: 340px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; margin: 0 -4px; padding: 0 4px; }
.bcm-list::-webkit-scrollbar { width: 8px; }
.bcm-list::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 999px; }
.bcm-empty { padding: 26px; text-align: center; color: var(--ink-3); font-size: 13.5px; }

.bcm-bank { display: flex; align-items: center; gap: 13px; width: 100%; padding: 11px 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-elev); cursor: pointer; text-align: left; font-family: inherit; transition: border-color .15s, background .15s, box-shadow .15s; }
.bcm-bank:hover:not(:disabled) { border-color: var(--accent-line, color-mix(in oklab, var(--accent) 40%, transparent)); background: var(--bg-card); box-shadow: 0 4px 14px -8px rgba(0,0,0,0.12); }
.bcm-bank:disabled { opacity: 0.55; cursor: default; }
.bcm-bank-logo { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 10px; background: var(--bg-sunk); border: 1px solid var(--border); flex-shrink: 0; overflow: hidden; font: 600 15px var(--font-sans); color: var(--ink-2); }
.bcm-bank-logo img { width: 100%; height: 100%; object-fit: contain; padding: 5px; }
.bcm-bank-name { flex: 1; min-width: 0; font: 500 14.5px var(--font-sans); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bcm-bank-chev { color: var(--ink-3); flex-shrink: 0; }
.bcm-bank:hover:not(:disabled) .bcm-bank-chev { color: var(--accent); }

.bcm-error { display: flex; align-items: center; gap: 8px; padding: 11px 14px; border-radius: 10px; background: var(--negative-soft); color: var(--negative); font: 400 13px var(--font-sans); }
.bcm-error svg { flex-shrink: 0; }

.bcm-connecting { display: flex; gap: 11px; align-items: flex-start; padding: 13px 15px; border-radius: 12px; background: var(--accent-soft); border: 1px solid color-mix(in oklab, var(--accent) 24%, transparent); font: 400 13px/1.5 var(--font-sans); color: var(--ink-2); }
.bcm-connecting svg { flex-shrink: 0; color: var(--accent); margin-top: 2px; }
.bcm-connecting strong { color: var(--ink); font-weight: 600; }

.bcm-foot { display: flex; justify-content: flex-end; gap: 10px; }
.bcm-btn { display: inline-flex; align-items: center; gap: 7px; padding: 11px 20px; border-radius: 999px; font: 600 14px var(--font-sans); cursor: pointer; border: 1px solid transparent; transition: filter .15s, background .15s, border-color .15s, color .15s; }
.bcm-btn.ghost { background: transparent; border-color: var(--border-strong); color: var(--ink-2); }
.bcm-btn.ghost:hover { color: var(--ink); border-color: var(--ink-3); }
.bcm-btn.primary { background: var(--accent); color: var(--on-accent, #fff); box-shadow: 0 6px 18px -8px color-mix(in oklab, var(--accent) 70%, transparent); }
.bcm-btn.primary:hover:not(:disabled) { filter: brightness(1.07); }
.bcm-btn.primary:disabled { opacity: 0.65; cursor: default; }
.bcm-back { width: 100%; justify-content: center; }

.bcm-spin { animation: bcmSpin 0.8s linear infinite; }
@keyframes bcmSpin { to { transform: rotate(360deg); } }
`;
