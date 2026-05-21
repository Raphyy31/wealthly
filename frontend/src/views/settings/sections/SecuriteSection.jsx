// Source: Settings.jsx lines 682-1040 — SecuriteSection (+ TwoFactorRow, IdleTimeoutRow)
//
// Refondu 2026-05-21 : cobalt accents sur les icones header, premium toggle
// 2FA et idle-timeout via ToggleCard + ChoiceGrid, headers de cards explicites.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Shield, Lock, KeyRound, Clock, Smartphone } from 'lucide-react';
import * as api from '../../../api.js';
import { ChoiceGrid } from '../../../components/ui/PremiumToggle.jsx';
import { ChangePasswordModal } from '../modals/ChangePasswordModal.jsx';
import { TotpSetupModal } from '../modals/TotpSetupModal.jsx';
import { TotpDisableModal } from '../modals/TotpDisableModal.jsx';

function IdleTimeoutRow() {
  const STORAGE_KEY = 'wealthly:idleTimeoutMin';
  const options = [
    { value: '15', label: '15 min' },
    { value: '30', label: '30 min' },
    { value: '60', label: '1 h' },
    { value: '0',  label: 'Jamais' },
  ];
  const [value, setValue] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) ?? '30'; } catch { return '30'; }
  });
  const onChange = (v) => {
    setValue(v);
    try { localStorage.setItem(STORAGE_KEY, v); } catch {}
  };
  const labelFor = (v) => options.find(o => o.value === v)?.label;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={14} style={{ color: 'var(--accent)' }}/>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
            Déconnexion automatique
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>
          {value === '0' ? 'jamais' : `après ${labelFor(value)} sans activité`}
        </span>
      </div>
      <ChoiceGrid
        value={value}
        onChange={onChange}
        options={options}
        columns={4}
      />
      <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>
        {value === '0'
          ? 'Vous restez connecté tant que vous ne vous déconnectez pas manuellement.'
          : `Un avertissement s'affiche 5 minutes avant la déconnexion automatique.`}
      </p>
    </div>
  );
}

function TwoFactorRow({ t }) {
  const [status, setStatus] = useState({ enabled: false, setup_in_progress: false });
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);

  const reload = async () => {
    try {
      const s = await api.totp.status();
      setStatus(s);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); }, []);

  return (
    <>
      <div className="settings-field-row">
        <div>
          <div className="settings-field-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={14} style={{ color: 'var(--ink-3)' }}/>
            Authentification à 2 facteurs (TOTP)
            {status.enabled && (
              <span style={{
                fontSize: 9.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--positive)', padding: '2px 6px', borderRadius: 4,
                background: 'color-mix(in srgb, var(--positive) 14%, transparent)',
              }}>actif</span>
            )}
          </div>
          <div className="settings-field-hint">
            {status.enabled
              ? 'Code 6 chiffres requis à chaque connexion.'
              : 'Renforce la sécurité de votre compte avec Google Authenticator, Authy ou 1Password.'}
          </div>
        </div>
        <div className="settings-field-control">
          {loading ? (
            <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>Chargement…</span>
          ) : status.enabled ? (
            <button className="ds-btn" onClick={() => setShowDisable(true)}>
              Désactiver
            </button>
          ) : (
            <button className="ds-btn primary" onClick={() => setShowSetup(true)}>
              Activer
            </button>
          )}
        </div>
      </div>

      {showSetup && (
        <TotpSetupModal onClose={() => { setShowSetup(false); reload(); }} />
      )}
      {showDisable && (
        <TotpDisableModal onClose={() => { setShowDisable(false); reload(); }} />
      )}
    </>
  );
}

export function SecuriteSection({ currentUser }) {
  const { t } = useTranslation();
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [events, setEvents] = useState(null);  // null = not loaded, [] = loaded empty, [...] = data
  const [eventsError, setEventsError] = useState(false);

  useEffect(() => {
    if (!currentUser?.is_admin) return;  // admin-only endpoint; skip otherwise
    let cancelled = false;
    (async () => {
      try {
        const data = await api.admin.authEvents(20);
        if (cancelled) return;
        // Filter to current user's events only if email matches
        const mine = Array.isArray(data)
          ? data.filter(e => !currentUser?.email || e.email === currentUser.email).slice(0, 5)
          : [];
        setEvents(mine);
      } catch {
        if (!cancelled) setEventsError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  return (
    <section className="settings-panel">
      <header>
        <h2>{t('settings.security.title')} <em>{t('settings.security.titleAccent')}</em></h2>
        <p className="settings-panel-intro">
          {t('settings.security.intro')}
        </p>
      </header>

      <div className="card">
        <div className="card-header">
          <h3>
            <Shield size={16} style={{ color: 'var(--accent)' }}/>
            Authentification
          </h3>
          <span className="card-meta">Mot de passe · 2FA · session</span>
        </div>
        <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="settings-field-row">
            <div>
              <div className="settings-field-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={14} style={{ color: 'var(--ink-3)' }}/>
                {t('settings.security.password')}
              </div>
              <div className="settings-field-hint">{t('settings.security.passwordHint')}</div>
            </div>
            <div className="settings-field-control">
              <button className="ds-btn" onClick={() => setShowPwdModal(true)}>
                {t('settings.security.changePassword')}
              </button>
            </div>
          </div>

          <TwoFactorRow t={t} />
          <IdleTimeoutRow />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>
            <Activity size={16} style={{ color: 'var(--accent)' }}/>
            {t('settings.security.recentActivity')}
          </h3>
        </div>
        {!currentUser?.is_admin || eventsError ? (
          <p className="settings-panel-intro" style={{ margin: 0 }}>{t('settings.security.activityComingSoon')}</p>
        ) : events === null ? (
          <p className="settings-panel-intro" style={{ margin: 0 }}>{t('settings.security.loading')}</p>
        ) : events.length === 0 ? (
          <p className="settings-panel-intro" style={{ margin: 0 }}>{t('settings.security.noActivity')}</p>
        ) : (
          <div className="settings-auth-events">
            {events.map(ev => (
              <div key={ev.id} className="settings-auth-event-row">
                <span className="settings-auth-event-kind">{ev.kind || '—'} {ev.ip ? `· ${ev.ip}` : ''}</span>
                <span className="settings-auth-event-time">
                  {ev.created_at ? new Date(ev.created_at).toLocaleString('fr-FR') : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPwdModal && <ChangePasswordModal onClose={() => setShowPwdModal(false)}/>}
    </section>
  );
}
