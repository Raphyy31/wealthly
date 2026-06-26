// ============================================================================
// Mandatory2FAOverlay — Overlay non-dismissable qui force l'activation 2FA.
// Politique sécurité (cyber expert request 2026-05-19) : tout utilisateur
// authentifié sans 2FA doit l'activer avant d'accéder à l'app.
//
// Rendu seulement quand currentUser.totp_enabled === false. Pas de bouton
// de fermeture : l'utilisateur DOIT compléter le setup pour utiliser l'app.
//
// Le flux : setup → QR + secret → input code 6 chiffres → activé → reload
// du currentUser → overlay disparait.
// ============================================================================
import { useState, useEffect } from 'react';
import { Shield, Loader2 } from 'lucide-react';
import * as api from '../api.js';

export function Mandatory2FAOverlay({ onComplete, onSkip, onLogoutEscape }) {
  const [step, setStep] = useState('loading');   // loading | scan | done | error
  const [secret, setSecret] = useState('');
  const [uri, setUri] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Timeout 8 s : si /auth/totp/setup traîne (cold start Railway) on ne
        // reste PAS bloqué sur "Préparation du secret…" → on bascule en 'error'
        // (qui propose "Configurer plus tard" + Réessayer).
        const r = await Promise.race([
          api.totp.setup(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ]);
        if (cancelled) return;
        setSecret(r.secret);
        setUri(r.otpauth_uri);
        setStep('scan');
      } catch (err) {
        if (cancelled) return;
        const msg = err?.detail || err?.message || 'Erreur';
        // Si /setup refuse parce que 2FA déjà active → l'overlay ne devrait
        // pas être affiché. On force un onComplete pour sortir.
        if (/déjà activé|déjà active/i.test(msg)) {
          onComplete?.();
          return;
        }
        setError(msg === 'timeout'
          ? 'La préparation prend trop de temps. Réessaie, ou configure plus tard.'
          : msg);
        setStep('error');
      }
    })();
    return () => { cancelled = true; };
  }, [onComplete]);

  const handleVerify = async (e) => {
    e?.preventDefault?.();
    if (!/^\d{6}$/.test(code)) {
      setError('Le code doit comporter 6 chiffres.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.totp.verify(code);
      setStep('done');
      // Délai pour montrer le message success avant transition
      setTimeout(() => onComplete?.(), 1500);
    } catch (err) {
      setError(err?.detail || err?.message || 'Code incorrect.');
    } finally {
      setSubmitting(false);
    }
  };

  const qrSrc = uri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`
    : '';

  return (
    <div className="mandatory-2fa-overlay">
      <div className="mandatory-2fa-card">
        <div className="mandatory-2fa-header">
          <div className="mandatory-2fa-icon"><Shield size={28}/></div>
          <h2 className="mandatory-2fa-title">
            Sécurisez votre compte en <em>2 minutes</em>
          </h2>
          <p className="mandatory-2fa-lead">
            Pour protéger vos données financières, nous vous recommandons
            vivement d'activer l'<strong>authentification à 2 facteurs</strong>.
            Vous pouvez aussi le faire plus tard depuis Réglages → Sécurité.
          </p>
        </div>

        <div className="mandatory-2fa-body">
          {step === 'loading' && (
            <div className="mandatory-2fa-loading">
              <Loader2 size={20} className="spin"/>
              <span>Préparation du secret…</span>
              {onSkip && (
                <button type="button" className="mandatory-2fa-later" onClick={onSkip} style={{ marginTop: 14 }}>
                  Configurer plus tard
                </button>
              )}
            </div>
          )}

          {step === 'scan' && (
            <>
              <ol className="mandatory-2fa-steps">
                <li>Ouvrez votre application d'authentification — Google Authenticator, Authy, 1Password, etc.</li>
                <li>Scannez le QR code ci-dessous (ou saisissez le code manuellement).</li>
                <li>Entrez le code à 6 chiffres généré pour confirmer.</li>
              </ol>

              <div className="mandatory-2fa-qr-wrap">
                {qrSrc && (
                  <img src={qrSrc} alt="QR code 2FA" width={200} height={200} className="mandatory-2fa-qr"/>
                )}
              </div>

              <div className="mandatory-2fa-secret">
                <div className="mandatory-2fa-secret-label">Code manuel</div>
                <div className="mandatory-2fa-secret-value">{secret}</div>
              </div>

              <form onSubmit={handleVerify} className="mandatory-2fa-form">
                <label className="mandatory-2fa-input-label">Code à 6 chiffres</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="\d{6}"
                  className="mandatory-2fa-input"
                  placeholder="123456"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
                {error && <div className="mandatory-2fa-error">{error}</div>}
                <button
                  type="submit"
                  className="mandatory-2fa-submit"
                  disabled={submitting || code.length !== 6}
                >
                  {submitting ? 'Vérification…' : 'Activer la 2FA'}
                </button>
              </form>

              <div className="mandatory-2fa-escape">
                {onSkip && (
                  <button type="button" className="mandatory-2fa-later" onClick={onSkip}>
                    Configurer plus tard
                  </button>
                )}
                {onLogoutEscape && (
                  <button type="button" className="mandatory-2fa-escape-link" onClick={onLogoutEscape}>
                    Déconnexion
                  </button>
                )}
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="mandatory-2fa-done">
              <p className="mandatory-2fa-done-lead">
                <em>2FA activée avec succès.</em>
              </p>
              <p className="mandatory-2fa-done-hint">
                À chaque connexion, votre application d'authentification vous donnera
                un nouveau code 6 chiffres à saisir.
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="mandatory-2fa-error-block">
              <p>{error}</p>
              <button type="button" className="mandatory-2fa-submit" onClick={() => window.location.reload()}>
                Recharger
              </button>
              {onSkip && (
                <button type="button" className="mandatory-2fa-later" onClick={onSkip} style={{ marginTop: 10 }}>
                  Continuer sans 2FA pour l'instant
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: CSS }}/>
    </div>
  );
}

const CSS = `
.mandatory-2fa-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(15, 13, 9, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow-y: auto;
}
.mandatory-2fa-card {
  background: var(--bg-elev);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  box-shadow: 0 24px 64px -16px rgba(0,0,0,.5);
  max-width: 520px;
  width: 100%;
  max-height: 92vh;
  overflow-y: auto;
  padding: 28px 32px 32px;
  font-family: 'Geist', sans-serif;
}
.mandatory-2fa-header { text-align: center; margin-bottom: 24px; }
.mandatory-2fa-icon {
  width: 56px; height: 56px;
  margin: 0 auto 14px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex; align-items: center; justify-content: center;
}
.mandatory-2fa-title {
  font: 600 22px/1.2 'Geist', sans-serif;
  letter-spacing: -0.01em;
  color: var(--ink);
  margin: 0 0 10px;
}
.mandatory-2fa-title em {
  font-family: 'Geist', system-ui, sans-serif;
  font-style: normal;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ink);
}
.mandatory-2fa-lead {
  font: 400 14px/1.5 'Geist', sans-serif;
  color: var(--ink-2);
  margin: 0;
}
.mandatory-2fa-lead strong { color: var(--ink); font-weight: 500; }

.mandatory-2fa-body { display: flex; flex-direction: column; gap: 20px; }
.mandatory-2fa-loading {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 40px;
  color: var(--ink-3);
}
.mandatory-2fa-loading .spin { animation: m2faSpin 1s linear infinite; }
@keyframes m2faSpin { to { transform: rotate(360deg); } }

.mandatory-2fa-steps {
  font: 400 13.5px/1.6 'Geist', sans-serif;
  color: var(--ink-2);
  padding-left: 22px;
  margin: 0;
}
.mandatory-2fa-steps li { margin-bottom: 6px; }
.mandatory-2fa-steps li:last-child { margin-bottom: 0; }

.mandatory-2fa-qr-wrap {
  display: flex;
  justify-content: center;
  padding: 14px;
  background: var(--bg-sunk);
  border-radius: 12px;
  border: 1px solid var(--border);
}
.mandatory-2fa-qr {
  border-radius: 8px;
  background: #fff;
  padding: 6px;
}

.mandatory-2fa-secret {
  background: var(--bg-sunk);
  border-radius: 8px;
  padding: 10px 14px;
}
.mandatory-2fa-secret-label {
  font: 500 10.5px/1 'Geist Mono', monospace;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-3);
  margin-bottom: 4px;
}
.mandatory-2fa-secret-value {
  font: 600 14px/1.3 'Geist Mono', monospace;
  letter-spacing: 0.08em;
  color: var(--ink);
  word-break: break-all;
}

.mandatory-2fa-form {
  display: flex; flex-direction: column; gap: 10px;
  padding-top: 6px;
  border-top: 1px dotted var(--border);
}
.mandatory-2fa-input-label {
  font: 500 12px/1 'Geist', sans-serif;
  color: var(--ink-2);
}
.mandatory-2fa-input {
  height: 48px;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  background: var(--bg-elev);
  color: var(--ink);
  font: 600 18px/1 'Geist Mono', monospace;
  letter-spacing: 0.3em;
  text-align: center;
  padding: 0 12px;
}
.mandatory-2fa-input:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.mandatory-2fa-submit {
  height: 44px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  font: 500 14px/1 'Geist', sans-serif;
  cursor: pointer;
  transition: background .15s;
  box-shadow: 0 4px 14px -4px rgba(37,64,217,.25);
}
.mandatory-2fa-submit:hover:not(:disabled) { background: var(--accent-2); }
.mandatory-2fa-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.mandatory-2fa-error {
  font: 400 12.5px/1.4 'Geist', sans-serif;
  color: var(--negative);
}

.mandatory-2fa-escape {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font: 400 11.5px/1.4 'Geist', sans-serif;
  color: var(--ink-3);
  padding-top: 14px;
  margin-top: 4px;
  border-top: 1px dotted var(--border);
}
.mandatory-2fa-later {
  width: 100%;
  padding: 11px 16px;
  background: var(--bg-sunk, #EFEDE6);
  color: var(--ink, #16150F);
  border: 1px solid var(--border, #E4E1D8);
  border-radius: 10px;
  font: 600 13px/1 'Geist', sans-serif;
  cursor: pointer;
}
.mandatory-2fa-later:hover { background: var(--bg-hover, #F1EFE8); border-color: var(--border-strong, #D2CEC0); }
.mandatory-2fa-escape-link {
  background: none;
  border: none;
  color: var(--ink-2);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  font: inherit;
}
.mandatory-2fa-escape-link:hover { color: var(--ink); }

.mandatory-2fa-done {
  text-align: center;
  padding: 30px 10px;
}
.mandatory-2fa-done-lead {
  font: 400 18px/1.4 'Geist', system-ui, sans-serif;
  font-style: italic;
  color: var(--positive);
  margin: 0 0 12px;
}
.mandatory-2fa-done-hint {
  font: 400 13.5px/1.5 'Geist', sans-serif;
  color: var(--ink-2);
}

.mandatory-2fa-error-block {
  text-align: center;
  padding: 20px;
}
.mandatory-2fa-error-block p {
  color: var(--negative);
  margin: 0 0 16px;
  font-size: 13.5px;
}
`;
