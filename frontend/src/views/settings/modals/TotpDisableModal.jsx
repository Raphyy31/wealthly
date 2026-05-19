// Source: Settings.jsx lines 903-960 — TotpDisableModal
import { useState } from 'react';
import * as api from '../../../api.js';

export function TotpDisableModal({ onClose }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleDisable = async (e) => {
    e?.preventDefault?.();
    if (!password) { setError('Mot de passe requis.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.totp.disable(password, code || null);
      onClose();
    } catch (err) {
      setError(err?.detail || 'Échec de la désactivation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>Désactiver la 2FA</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleDisable}>
          <div className="modal-body">
            <p style={{ color: 'var(--ink-2)', marginBottom: 16, fontSize: 13 }}>
              Votre compte sera moins sécurisé après désactivation. Confirmez votre mot de passe.
            </p>
            <label className="ds-input-label">Mot de passe</label>
            <input type="password" className="ds-input" autoFocus
                   value={password} onChange={e => setPassword(e.target.value)} />
            <label className="ds-input-label" style={{ marginTop: 12 }}>Code 2FA actuel (optionnel)</label>
            <input
              type="text" inputMode="numeric" maxLength={6}
              className="ds-input" placeholder="123456"
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.2em' }}
            />
            {error && <div className="ds-input-help is-error" style={{ marginTop: 8 }}>{error}</div>}
          </div>
          <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
              Annuler
            </button>
            <button type="submit" className="primary-btn danger" disabled={submitting}>
              {submitting ? 'Désactivation…' : 'Désactiver'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
