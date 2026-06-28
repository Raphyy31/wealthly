// ============================================================================
// AuthModal — overlay d'authentification déclenché depuis la landing
//
// S'ouvre en popup sur la landing (pas de changement de page).
// Modes : login | register | forgot
// Inclut : email/password, Google OAuth, TOTP step 2, démo
// ============================================================================
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { X, Mail, Lock, User, Home, Eye, EyeOff, AlertCircle, Check, Sparkles } from 'lucide-react';
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
  const [googleClientId, setGoogleClientId] = useState(null);
  const googleButtonRef = useRef(null);
  const shellRef = useRef(null);

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

  // Fetch Google OAuth config (once)
  useEffect(() => {
    auth.getConfig().then(cfg => {
      if (cfg?.google_client_id) setGoogleClientId(cfg.google_client_id);
    }).catch(() => {});
  }, []);

  const handleGoogleCredential = async (resp) => {
    setError(null);
    setLoading(true);
    try {
      await auth.googleSignIn(resp.credential);
      onAuth();
    } catch (err) {
      setError(err.message || 'Erreur lors de la connexion Google.');
    } finally {
      setLoading(false);
    }
  };

  // Re-render Google button whenever mode or open state changes
  useEffect(() => {
    if (!open || !googleClientId || !googleButtonRef.current) return;
    const init = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
        ux_mode: 'popup',
      });
      const btn = googleButtonRef.current;
      if (!btn) return;
      btn.innerHTML = ''; // clear previous render
      window.google.accounts.id.renderButton(btn, {
        theme: 'outline',
        size: 'large',
        width: btn.offsetWidth || 340,
        text: mode === 'register' ? 'signup_with' : 'continue_with',
        locale: 'fr',
        shape: 'rectangular',
      });
    };
    if (window.google?.accounts?.id) {
      // Small delay so the ref div is painted with its real width
      const t = setTimeout(init, 50);
      return () => clearTimeout(t);
    } else {
      const iv = setInterval(() => {
        if (window.google?.accounts?.id) { clearInterval(iv); init(); }
      }, 100);
      return () => clearInterval(iv);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, googleClientId, mode]);

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
        await auth.register(email, password, fullName, householdName || 'Mon foyer');
        onAuth();
      } else if (mode === 'forgot') {
        await auth.forgotPassword(email);
        setInfo('Si cet email existe dans notre base, un lien de réinitialisation vient d\'être envoyé.');
      }
    } catch (err) {
      setError(err.message);
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
            <>
              <Field label="Prénom" icon={<User size={13}/>} type="text" value={fullName}
                onChange={setFullName} placeholder="Marie" required autoFocus/>
              <Field
                label={<>Nom du foyer <em className="amod-optional">facultatif</em></>}
                icon={<Home size={13}/>} type="text" value={householdName}
                onChange={setHouseholdName} placeholder="Foyer Dupont"/>
            </>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <Field label="Email" icon={<Mail size={13}/>} type="email" value={email}
              onChange={setEmail} placeholder="vous@exemple.com" required
              autoFocus={mode === 'login' || mode === 'forgot'}/>
          )}

          {(mode === 'login' || mode === 'register') && (
            <Field
              label={mode === 'register' ? 'Mot de passe (≥ 10 caractères)' : 'Mot de passe'}
              icon={<Lock size={13}/>}
              type={showPwd ? 'text' : 'password'}
              value={password} onChange={setPassword}
              placeholder={mode === 'login' ? '••••••••••' : 'Choisissez un mot de passe fort'}
              minLength={mode === 'register' ? 10 : undefined}
              required
              trailing={
                <button type="button" className="amod-eye" onClick={() => setShowPwd(!showPwd)}>
                  {showPwd ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              }
            />
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

          <button type="submit" className="amod-submit" disabled={loading}>
            {loading ? 'Chargement…' :
             mode === 'login'    ? 'Se connecter' :
             mode === 'register' ? 'Créer mon compte' :
                                   'Envoyer le lien'}
          </button>
        </form>

        {/* Google Sign-In */}
        {(mode === 'login' || mode === 'register') && googleClientId && (
          <div className="amod-google-section">
            <div className="amod-sep"><span>ou</span></div>
            <div ref={googleButtonRef} className="amod-google-btn"/>
          </div>
        )}

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
  padding: 24px;
  display: flex; flex-direction: column; gap: 18px;
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
.amod-form { display: flex; flex-direction: column; gap: 12px; }
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
.amod-submit:disabled { opacity: .55; cursor: wait; box-shadow: none; }
.amod-submit:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-soft), 0 0 0 4px var(--accent); }

/* ── Google section ── */
.amod-google-section { display: flex; flex-direction: column; gap: 10px; }
.amod-sep {
  display: flex; align-items: center; gap: 10px;
  font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--ink-3);
}
.amod-sep::before, .amod-sep::after {
  content: ''; flex: 1; height: 1px; background: var(--border);
}
.amod-google-btn {
  width: 100%; min-height: 44px;
  display: flex; justify-content: center; align-items: center;
  border-radius: 10px; overflow: hidden;
}
.amod-google-btn > div { width: 100% !important; }

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
