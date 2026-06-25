// Source: Settings.jsx lines 776-901 — TotpSetupModal
import { useState, useEffect } from 'react';
import * as api from '../../../api.js';
import { ResponsiveModal } from '../../../components/ui/ResponsiveModal.jsx';

export function TotpSetupModal({ onClose }) {
  const [step, setStep] = useState('loading');  // loading → scan → verify → done
  const [secret, setSecret] = useState('');
  const [uri, setUri] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.totp.setup();
        if (cancelled) return;
        setSecret(r.secret);
        setUri(r.otpauth_uri);
        setStep('scan');
      } catch (err) {
        if (cancelled) return;
        setError(err?.detail || err?.message || 'Erreur lors de l\'initialisation 2FA');
        setStep('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
    } catch (err) {
      setError(err?.detail || 'Code incorrect. Vérifiez l\'horloge de votre appareil.');
    } finally {
      setSubmitting(false);
    }
  };

  const qrSrc = uri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(uri)}`
    : '';

  return (
    <ResponsiveModal open={true} onClose={onClose}>
        <div className="modal-header">
          <h3>Activer l'authentification à 2 facteurs</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {step === 'loading' && <p style={{ color: 'var(--ink-3)' }}>Préparation du secret…</p>}

          {step === 'scan' && (
            <>
              <p style={{ marginBottom: 16 }}>
                1. Ouvrez votre application d'authentification (Google Authenticator, Authy, 1Password…).
                <br />2. Scannez le QR ou saisissez le code manuellement.
                <br />3. Entrez le code 6 chiffres ci-dessous pour valider.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <img src={qrSrc} alt="QR code 2FA" width={180} height={180}
                     style={{ borderRadius: 8, border: '1px solid var(--border)' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div className="ds-input-label">Code manuel (si pas de QR)</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--ink-2)',
                  background: 'var(--bg-sunk)', padding: 10, borderRadius: 6,
                  letterSpacing: '0.08em', wordBreak: 'break-all',
                }}>{secret}</div>
              </div>
              <form onSubmit={handleVerify}>
                <label className="ds-input-label">Code 6 chiffres</label>
                <input
                  type="text" inputMode="numeric" autoComplete="one-time-code"
                  maxLength={6} pattern="\d{6}"
                  className="ds-input" placeholder="123456"
                  value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.2em', textAlign: 'center' }}
                />
                {error && <div className="ds-input-help is-error" style={{ marginTop: 8 }}>{error}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                  <button type="button" className="ds-btn" onClick={onClose} disabled={submitting}>
                    Annuler
                  </button>
                  <button type="submit" className="ds-btn primary" disabled={submitting || code.length !== 6}>
                    {submitting ? 'Vérification…' : 'Activer'}
                  </button>
                </div>
              </form>
            </>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <p style={{
                fontFamily: 'Geist, system-ui, sans-serif', fontStyle: 'italic',
                fontSize: 16, color: 'var(--positive)', marginBottom: 16,
              }}>
                2FA activée avec succès.
              </p>
              <p style={{ color: 'var(--ink-2)', fontSize: 13, marginBottom: 20 }}>
                À chaque connexion, votre application d'authentification vous donnera un nouveau code 6 chiffres.
              </p>
              <button className="ds-btn primary" onClick={onClose}>Terminé</button>
            </div>
          )}

          {step === 'error' && (
            <div>
              <p style={{ color: 'var(--negative)' }}>{error}</p>
              <button className="ds-btn" onClick={onClose} style={{ marginTop: 12 }}>Fermer</button>
            </div>
          )}
        </div>
      </ResponsiveModal>
  );
}
