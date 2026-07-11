/**
 * BankReconnectModal — reconnexion proactive DSP2 (charte « Forêt »)
 *
 * Le consentement GoCardless expire au bout de 90 jours (loi DSP2). Passé ce
 * délai la banque coupe l'accès et la synchro s'arrête silencieusement. Plutôt
 * que de laisser l'utilisateur découvrir des soldes figés puis refaire toute la
 * manip (pays → banque → consentement), on le prévient QUELQUES JOURS AVANT et
 * on relance la connexion de la MÊME banque en un clic : il n'a plus qu'à se
 * ré-authentifier chez elle (le SCA reste obligatoire — c'est la loi).
 *
 * `api.banking.reconnect(id)` crée une nouvelle requisition sur la même banque
 * et renvoie l'URL de redirection. Au retour, /complete recolle les comptes par
 * IBAN et supprime l'ancienne ligne → aucun doublon.
 */
import { useState } from 'react';
import { X, RefreshCw, ShieldCheck, AlertCircle, Loader2, Landmark } from 'lucide-react';
import * as api from '../api.js';
import { ResponsiveModal } from './ui/ResponsiveModal.jsx';

// Fenêtre de reconnexion proactive : on alerte l'utilisateur ce nombre de jours
// avant l'expiration du consentement (90 j DSP2).
export const RECONNECT_WINDOW_DAYS = 10;

/** Statut de reconnexion d'une connexion : 'expired' | 'soon' | 'ok'. */
export function reconnectStatus(c) {
  if (!c) return 'ok';
  const d = c.days_until_expiry;
  if (c.status === 'error' || (d != null && d <= 0)) return 'expired';
  if (d != null && d <= RECONNECT_WINDOW_DAYS) return 'soon';
  return 'ok';
}

/** Les connexions qui méritent une reconnexion (expirées ou proches). */
export function connectionsNeedingReconnect(connections) {
  return (connections || []).filter((c) => reconnectStatus(c) !== 'ok');
}

export function BankReconnectModal({ connections, onClose }) {
  const list = connections || [];
  const [reconnectingId, setReconnectingId] = useState(null);
  const [error, setError] = useState(null);

  const reconnect = async (id) => {
    setReconnectingId(id);
    setError(null);
    try {
      const res = await api.banking.reconnect(id);
      if (res?.redirect_url) {
        window.location.href = res.redirect_url;
      } else {
        setError("Pas d'URL de redirection reçue");
        setReconnectingId(null);
      }
    } catch (err) {
      setError(err.message || 'Reconnexion impossible');
      setReconnectingId(null);
    }
  };

  return (
    <ResponsiveModal open={true} onClose={onClose}>
      <style>{BRM_CSS}</style>
      <div className="brm-head">
        <div className="brm-head-title">
          <span className="brm-head-ic"><RefreshCw size={18}/></span>
          <h2>Reconnecter votre banque</h2>
        </div>
        <button className="brm-close" onClick={onClose} aria-label="Fermer"><X size={18}/></button>
      </div>

      <div className="brm-body">
        <p className="brm-intro">
          Pour votre sécurité, l'accès à vos comptes expire tous les 90 jours
          (réglementation DSP2). Reconnectez-vous en un clic avant la coupure —
          <strong> vos données et votre historique sont conservés</strong>, la
          synchronisation reprend simplement là où elle s'était arrêtée.
        </p>

        <div className="brm-list">
          {list.map((c) => {
            const st = reconnectStatus(c);
            const days = c.days_until_expiry;
            const busy = reconnectingId === c.id;
            return (
              <div key={c.id} className="brm-row">
                <span className="brm-row-ic"><Landmark size={16}/></span>
                <div className="brm-row-info">
                  <div className="brm-row-name">{c.bank_name}</div>
                  <div className={`brm-row-meta ${st}`}>
                    {st === 'expired'
                      ? 'Accès expiré — reconnexion nécessaire'
                      : days != null && days >= 1
                        ? `Expire dans ${Math.round(days)} jour${Math.round(days) > 1 ? 's' : ''}`
                        : 'Expire aujourd’hui'}
                  </div>
                </div>
                <button
                  className="brm-btn primary"
                  onClick={() => reconnect(c.id)}
                  disabled={!!reconnectingId}
                >
                  {busy
                    ? <><Loader2 size={15} className="brm-spin"/> Redirection…</>
                    : 'Reconnecter'}
                </button>
              </div>
            );
          })}
        </div>

        {error && <div className="brm-error"><AlertCircle size={15}/> {error}</div>}

        <div className="brm-secure">
          <ShieldCheck size={16}/>
          <span>Vous serez redirigé vers le site de votre banque. Yotori Finance ne voit jamais vos identifiants.</span>
        </div>

        <div className="brm-foot">
          <button className="brm-btn ghost" onClick={onClose}>Plus tard</button>
        </div>
      </div>
    </ResponsiveModal>
  );
}

const BRM_CSS = `
.brm-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 22px 14px; border-bottom: 1px solid var(--border); }
.brm-head-title { display: flex; align-items: center; gap: 11px; }
.brm-head-ic { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 9px; background: var(--accent-soft); color: var(--accent); }
.brm-head h2 { margin: 0; font: 500 18px var(--font-sans); letter-spacing: -0.015em; color: var(--ink); }
.brm-close { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: none; border-radius: 8px; background: transparent; color: var(--ink-3); cursor: pointer; transition: background .12s, color .12s; }
.brm-close:hover { background: var(--bg-sunk); color: var(--ink); }

.brm-body { padding: 18px 22px 20px; display: flex; flex-direction: column; gap: 16px; }
.brm-intro { margin: 0; font: 400 13.5px/1.55 var(--font-sans); color: var(--ink-2); }
.brm-intro strong { color: var(--ink); font-weight: 600; }

.brm-list { display: flex; flex-direction: column; gap: 8px; }
.brm-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-elev); }
.brm-row-ic { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 10px; background: var(--bg-sunk); border: 1px solid var(--border); color: var(--ink-2); flex-shrink: 0; }
.brm-row-info { flex: 1; min-width: 0; }
.brm-row-name { font: 600 14.5px var(--font-sans); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.brm-row-meta { font: 500 12px var(--font-sans); margin-top: 2px; }
.brm-row-meta.soon { color: var(--warning); }
.brm-row-meta.expired { color: var(--negative); }

.brm-error { display: flex; align-items: center; gap: 8px; padding: 11px 14px; border-radius: 10px; background: var(--negative-soft); color: var(--negative); font: 400 13px var(--font-sans); }
.brm-error svg { flex-shrink: 0; }

.brm-secure { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 12px; background: var(--accent-soft); border: 1px solid color-mix(in oklab, var(--accent) 22%, transparent); font: 400 12.5px/1.5 var(--font-sans); color: var(--ink-2); }
.brm-secure svg { flex-shrink: 0; color: var(--accent); margin-top: 1px; }

.brm-foot { display: flex; justify-content: flex-end; gap: 10px; }
.brm-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 18px; border-radius: 999px; font: 600 13.5px var(--font-sans); cursor: pointer; border: 1px solid transparent; transition: filter .15s, background .15s, border-color .15s, color .15s; white-space: nowrap; }
.brm-btn.ghost { background: transparent; border-color: var(--border-strong); color: var(--ink-2); }
.brm-btn.ghost:hover { color: var(--ink); border-color: var(--ink-3); }
.brm-btn.primary { background: var(--accent); color: var(--on-accent, #fff); box-shadow: 0 6px 18px -8px color-mix(in oklab, var(--accent) 70%, transparent); }
.brm-btn.primary:hover:not(:disabled) { filter: brightness(1.07); }
.brm-btn.primary:disabled { opacity: 0.65; cursor: default; }

.brm-spin { animation: brmSpin 0.8s linear infinite; }
@keyframes brmSpin { to { transform: rotate(360deg); } }
`;
