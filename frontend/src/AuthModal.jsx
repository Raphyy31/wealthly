// ============================================================================
// AuthModal — overlay d'authentification déclenché depuis la landing
//
// S'ouvre en popup sur la landing (pas de changement de page).
// Modes : login | register | forgot
// Inclut : email/password, TOTP step 2, démo
// ============================================================================
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { X, Mail, Lock, User, Home, Eye, EyeOff, AlertCircle, Check, Sparkles, ShieldCheck, Clock3 } from 'lucide-react';
import { auth } from './api.js';
import { enableDemoMode } from './demoData.js';
import Logo from './components/Logo.jsx';

export default function AuthModal({ open, initialMode = 'login', onClose, onAuth, onTryDemo, notice = null }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [totpStep, setTotpStep] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const shellRef = useRef(null);
  const passwordChecks = {
    length: password.length >= 10,
    mixed: /[A-Za-zÀ-ÿ]/.test(password) && /\d/.test(password),
  };
  const registerReady = fullName.trim().length > 0
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    && passwordChecks.length
    && passwordChecks.mixed;

  // Sync mode when parent changes it (sign-in vs create account)
  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setError(null);
    setInfo(null);
    setTotpStep(false);
    setTotpCode('');
  }, [initialMode, open]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setPassword('');
    setTotpStep(false);
    setTotpCode('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        try {
          await auth.login(email, password, totpStep ? totpCode : null);
          onAuth();
        } catch (err) {
          const detail = err?.detail || err?.message || '';
          if (detail === 'totp_required' || /totp.required/i.test(detail)) {
            setTotpStep(true);
          } else {
            throw err;
          }
        }
      } else if (mode === 'register') {
        if (!registerReady) {
          setError('Complétez les trois champs et choisissez un mot de passe contenant des lettres et des chiffres.');
          return;
        }
        await auth.register(email.trim().toLowerCase(), password, fullName.trim(), householdName.trim() || 'Mon foyer');
        onAuth();
      } else if (mode === 'forgot') {
        await auth.forgotPassword(email);
        setInfo('Si cet email existe dans notre base, un lien de réinitialisation vient d\'être envoyé.');
      }
    } catch (err) {
      setError(err?.message || 'Cette action n’a pas pu aboutir. Réessayez dans un instant.');
    } finally {
      setLoading(false);
    }
  };

  // Click outside the shell to close
  const onScrimClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className="amod-overlay" onClick={onScrimClick} aria-label="Fermer" role="presentation">
      <style>{MODAL_CSS}</style>
      <div className="amod-shell" ref={shellRef} role="dialog" aria-modal="true">

        {/* Header */}
        <div className="amod-header">
          <Logo size={20} wordmark wordmarkSize={12}/>
          <button className="amod-close" onClick={onClose} aria-label="Fermer">
            <X size={16}/>
          </button>
        </div>

        {/* Session-expired or custom notice */}
        {notice && mode === 'login' && (
          <div className="amod-notice">
            <AlertCircle size={14}/> {notice}
          </div>
        )}

        {/* Tabs (login / register) */}
        {(mode === 'login' || mode === 'register') && (
          <div className="amod-tabs">
            <button className={mode === 'login' ? 'on' : ''} onClick={() => switchMode('login')}>Connexion</button>
            <button className={mode === 'register' ? 'on' : ''} onClick={() => switchMode('register')}>Inscription</button>
          </div>
        )}

        {mode === 'register' && (
          <div className="amod-intro">
            <span className="amod-intro-icon"><ShieldCheck size={18}/></span>
            <div>
              <strong>Votre espace financier en moins d’une minute</strong>
              <span>Créez votre accès maintenant. Le foyer et les banques se configurent ensuite, pas à pas.</span>
            </div>
          </div>
        )}

        {/* Forgot password back link */}
        {mode === 'forgot' && (
          <div className="amod-forgot-head">
            <button className="amod-back" onClick={() => switchMode('login')}>← Retour</button>
            <p>Entrez votre email pour recevoir un lien de réinitialisation.</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={submit} className="amod-form">
          {mode === 'register' && (
            <Field label="Prénom" icon={<User size={13}/>} type="text" value={fullName}
              onChange={setFullName} placeholder="Marie" required autoFocus autoComplete="given-name"/>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <Field label="Email" icon={<Mail size={13}/>} type="email" value={email}
              onChange={setEmail} placeholder="vous@exemple.com" required
              autoFocus={mode === 'login' || mode === 'forgot'} autoComplete="email"/>
          )}

          {(mode === 'login' || mode === 'register') && (
            <Field
              label={mode === 'register' ? 'Mot de passe (≥ 10 caractères)' : 'Mot de passe'}
              icon={<Lock size={13}/>}
              type={showPwd ? 'text' : 'password'}
              value={password} onChange={setPassword}
              placeholder={mode === 'login' ? '••••••••••' : 'Choisissez un mot de passe fort'}
              minLength={mode === 'register' ? 10 : undefined}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required
              trailing={
                <button type="button" className="amod-eye" onClick={() => setShowPwd(!showPwd)}>
                  {showPwd ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              }
            />
          )}

          {mode === 'register' && (
            <>
              <div className="amod-password-checks" aria-live="polite">
                <span className={passwordChecks.length ? 'ok' : ''}><Check size={11}/> 10 caractères minimum</span>
                <span className={passwordChecks.mixed ? 'ok' : ''}><Check size={11}/> Lettres et chiffres</span>
              </div>
              <details className="amod-household">
                <summary><Home size={13}/> Personnaliser le nom du foyer <em>facultatif</em></summary>
                <Field label="Nom du foyer" icon={<Home size={13}/>} type="text" value={householdName}
                  onChange={setHouseholdName} placeholder="Foyer Dupont" autoComplete="organization"/>
              </details>
              <div className="amod-trust">
                <Clock3 size={13}/><span>Vous pourrez essayer Yotori Finance avant de connecter une banque.</span>
              </div>
            </>
          )}

          {mode === 'login' && totpStep && (
            <div className="amod-totp">
              <div className="amod-totp-label">Authentification à deux facteurs</div>
              <Field
                label="Code à 6 chiffres"
                icon={<Lock size={13}/>}
                type="text" inputMode="numeric"
                maxLength={6} pattern="\d{6}"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={v => setTotpCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456" required autoFocus/>
              <p className="amod-totp-hint">Ouvrez votre application d'authentification (Google Authenticator, Authy…)</p>
            </div>
          )}

          {error && <div className="amod-error"><AlertCircle size={14}/> {error}</div>}
          {info  && <div className="amod-info"><Check size={14}/> {info}</div>}

          <button type="submit" className="amod-submit" disabled={loading || (mode === 'register' && !registerReady)}>
            {loading ? 'Chargement…' :
             mode === 'login'    ? 'Se connecter' :
             mode === 'register' ? 'Créer mon compte' :
                                   'Envoyer le lien'}
          </button>
        </form>

        {/* Footer links */}
        <div className="amod-footer">
          {mode === 'login' && (
            <button type="button" onClick={() => switchMode('forgot')} className="amod-link">
              Mot de passe oublié ?
            </button>
          )}
          {mode === 'register' && (
            <span className="amod-note">
              Déjà inscrit ?{' '}
              <button type="button" onClick={() => switchMode('login')} className="amod-link">Se connecter</button>
            </span>
          )}
          {mode === 'forgot' && (
            <span className="amod-note">
              Vous vous souvenez ?{' '}
              <button type="button" onClick={() => switchMode('login')} className="amod-link">Se connecter</button>
            </span>
          )}
        </div>

        {/* Demo */}
        {(mode === 'login' || mode === 'register') && onTryDemo && (
          <button
            type="button"
            className="amod-demo"
            onClick={() => { onClose(); enableDemoMode(); onTryDemo(); }}
          >
            <Sparkles size={13}/> Essayer la démo sans s'inscrire
          </button>
        )}

      </div>
    </div>,
    document.body
  );
}

function Field({ label, icon, type, value, onChange, placeholder, required, autoFocus,
  minLength, maxLength, pattern, inputMode, autoComplete, trailing }) {
  return (
    <label className="amod-field">
      <span className="amod-field-label">{icon}{label}</span>
      <span className="amod-field-input">
        <input
          type={type} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          autoFocus={autoFocus} minLength={minLength}
          maxLength={maxLength} pattern={pattern}
          inputMode={inputMode} autoComplete={autoComplete}
        />
        {trailing}
      </span>
    </label>
  );
}

const MODAL_CSS = `
/* ── Overlay / scrim ── */
.amod-overlay {
  position: fixed; inset: 0; z-index: 8000;
  display: flex; align-items: center; justify-content: center;
  padding: 24px 16px;
  background: color-mix(in srgb, var(--ink) 52%, transparent);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: amod-fade-in 180ms ease both;
}
@keyframes amod-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Modal shell ── */
.amod-shell {
  position: relative;
  width: 100%; max-width: 420px;
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 20px;
  display: flex; flex-direction: column; gap: 14px;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--ink) 6%, transparent),
    0 24px 64px -12px color-mix(in srgb, var(--ink) 35%, transparent),
    0 8px 24px -4px color-mix(in srgb, var(--ink) 18%, transparent);
  animation: amod-slide-up 240ms cubic-bezier(0.22,1,0.36,1) both;
}
@keyframes amod-slide-up {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.amod-shell * { box-sizing: border-box; margin: 0; padding: 0; }
.amod-shell button { font-family: 'Geist', system-ui, sans-serif; cursor: pointer; }

/* ── Header ── */
.amod-header {
  display: flex; align-items: center; justify-content: space-between;
}
.amod-close {
  width: 30px; height: 30px;
  background: var(--bg-sunk); border: 1px solid var(--border);
  border-radius: 8px;
  display: grid; place-items: center;
  color: var(--ink-3);
  transition: background 120ms, color 120ms;
}
.amod-close:hover { background: var(--border); color: var(--ink); }

/* ── Notice (session expirée) ── */
.amod-notice {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 12px;
  background: var(--warning-soft); color: var(--warning);
  border-radius: 8px;
  font-size: 13px; line-height: 1.4;
}

/* ── Tabs ── */
.amod-tabs {
  display: flex;
  background: var(--bg-sunk);
  border-radius: 10px;
  padding: 3px; gap: 2px;
}
.amod-tabs button {
  flex: 1; height: 34px;
  background: transparent; border: none;
  border-radius: 8px;
  font-size: 13px; font-weight: 500; letter-spacing: -0.005em;
  color: var(--ink-2);
  transition: background 120ms, color 120ms;
}
.amod-tabs button:hover { color: var(--ink); }
.amod-tabs button.on {
  background: var(--bg-elev); color: var(--ink);
  box-shadow: 0 1px 0 rgba(20,20,15,.04), 0 1px 3px rgba(20,20,15,.06);
}

/* ── Register intro ── */
.amod-intro {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent-soft) 48%, var(--bg-elev));
}
.amod-intro-icon {
  width: 30px; height: 30px; flex: 0 0 30px;
  display: grid; place-items: center; border-radius: 8px;
  color: var(--accent); background: var(--bg-elev);
  border: 1px solid color-mix(in srgb, var(--accent) 16%, var(--border));
}
.amod-intro div { display: flex; flex-direction: column; gap: 3px; }
.amod-intro strong { font-size: 13px; color: var(--ink); line-height: 1.3; }
.amod-intro div span { font-size: 11.5px; color: var(--ink-2); line-height: 1.45; }

/* ── Forgot head ── */
.amod-forgot-head { display: flex; flex-direction: column; gap: 6px; }
.amod-back {
  background: transparent; border: none;
  font-size: 13px; color: var(--ink-2);
  align-self: flex-start; letter-spacing: -0.005em;
  transition: color 120ms;
}
.amod-back:hover { color: var(--ink); }
.amod-forgot-head p { font-size: 13px; color: var(--ink-2); line-height: 1.45; }

/* ── Form ── */
.amod-form { display: flex; flex-direction: column; gap: 10px; }
.amod-field { display: flex; flex-direction: column; gap: 5px; }
.amod-field-label {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 500; color: var(--ink-2);
  letter-spacing: -0.005em;
}
.amod-field-label svg { color: var(--ink-3); }
.amod-optional {
  font-style: italic; font-weight: 400; color: var(--ink-3);
}
.amod-field-input { position: relative; display: flex; }
.amod-field-input input {
  flex: 1; height: 40px;
  padding: 0 14px; padding-right: 38px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg); color: var(--ink);
  font: 400 14px/1.4 'Geist', system-ui, sans-serif;
  letter-spacing: -0.005em;
  transition: border-color 120ms, box-shadow 120ms;
  width: 100%;
}
.amod-field-input input::placeholder { color: var(--ink-mute, var(--ink-3)); }
.amod-field-input input:hover { border-color: var(--border-strong); }
.amod-field-input input:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.amod-eye {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: transparent; border: none;
  color: var(--ink-3); width: 24px; height: 24px;
  display: grid; place-items: center;
  border-radius: 4px; transition: color 120ms, background 120ms;
}
.amod-eye:hover { color: var(--ink); background: var(--bg-elev); }

.amod-password-checks {
  display: flex; gap: 8px; flex-wrap: wrap;
  margin-top: -4px;
}
.amod-password-checks span {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10.5px; color: var(--ink-3);
  padding: 4px 7px; border-radius: 999px;
  background: var(--bg-sunk); border: 1px solid var(--border);
}
.amod-password-checks span svg { opacity: .35; }
.amod-password-checks span.ok {
  color: var(--positive); border-color: color-mix(in srgb, var(--positive) 22%, var(--border));
  background: color-mix(in srgb, var(--positive-soft) 55%, transparent);
}
.amod-password-checks span.ok svg { opacity: 1; }
.amod-household {
  border: 1px solid var(--border); border-radius: 9px;
  background: var(--bg-sunk); overflow: hidden;
}
.amod-household summary {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 11px; cursor: pointer; list-style: none;
  font-size: 11.5px; font-weight: 500; color: var(--ink-2);
}
.amod-household summary::-webkit-details-marker { display: none; }
.amod-household summary em { margin-left: auto; font-size: 10px; font-weight: 400; color: var(--ink-3); }
.amod-household[open] .amod-field { padding: 2px 11px 11px; }
.amod-trust {
  display: flex; align-items: center; gap: 6px;
  font-size: 10.5px; color: var(--ink-3); line-height: 1.35;
}
.amod-trust svg { flex: 0 0 auto; color: var(--accent); }

/* ── TOTP ── */
.amod-totp {
  padding: 12px 14px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
  border-radius: 10px;
  display: flex; flex-direction: column; gap: 8px;
}
.amod-totp-label {
  font: 600 10.5px/1 'Geist Mono', monospace;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--accent-2, var(--accent));
}
.amod-totp input { font-family: 'Geist Mono', monospace !important; letter-spacing: 0.2em !important; text-align: center; }
.amod-totp-hint { font-size: 12px; color: var(--ink-2); line-height: 1.4; }

/* ── Feedback banners ── */
.amod-error, .amod-info {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 12px; border-radius: 8px;
  font-size: 13px; line-height: 1.4;
}
.amod-error { background: var(--negative-soft); color: var(--negative); }
.amod-info  { background: var(--positive-soft); color: var(--positive); }

/* ── Submit ── */
.amod-submit {
  height: 44px; width: 100%;
  background: var(--accent); color: var(--on-accent, #fff);
  border: none; border-radius: 10px;
  font: 500 14px/1 'Geist', system-ui, sans-serif;
  letter-spacing: -0.005em;
  transition: background .15s, box-shadow .2s;
  box-shadow: 0 1px 0 rgba(0,0,0,.06), 0 6px 18px -6px color-mix(in srgb, var(--accent) 55%, transparent);
}
.amod-submit:hover:not(:disabled) {
  background: var(--accent-2, var(--accent));
  box-shadow: 0 1px 0 rgba(0,0,0,.06), 0 10px 26px -6px color-mix(in srgb, var(--accent) 65%, transparent);
}
.amod-submit:disabled { opacity: .55; cursor: not-allowed; box-shadow: none; }
.amod-submit:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-soft), 0 0 0 4px var(--accent); }

/* ── Footer links ── */
.amod-footer {
  display: flex; justify-content: center;
  font-size: 13px; color: var(--ink-2);
}
.amod-note { color: var(--ink-2); }
.amod-link {
  background: transparent; border: none; padding: 0;
  font: 500 13px/1 'Geist', system-ui, sans-serif;
  color: var(--accent);
  text-decoration: underline; text-underline-offset: 3px;
  transition: color 120ms;
}
.amod-link:hover { color: var(--accent-2, var(--accent)); }

/* ── Demo button ── */
.amod-demo {
  background: transparent;
  border: 1px dashed var(--border-strong);
  border-radius: 8px; padding: 11px;
  font-size: 13px; color: var(--ink-2);
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  letter-spacing: -0.005em;
  transition: border-color 120ms, color 120ms, background 120ms;
}
.amod-demo:hover { border-color: var(--ink-2); color: var(--ink); background: var(--bg-elev); }

/* ── Responsive ── */
@media (max-width: 480px) {
  .amod-overlay { padding: 0; align-items: flex-end; }
  .amod-shell {
    max-width: 100%; border-radius: 20px 20px 0 0;
    max-height: 94dvh;
  }
}
`;
