// Source: Settings.jsx lines 682-1040 — SecuriteSection (+ TwoFactorRow, IdleTimeoutRow)
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Shield } from 'lucide-react';
import * as api from '../../../api.js';
import { ChipSelect } from '../../../components/ChipSelect.jsx';
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
  return (
    <div className="settings-field-row">
      <div>
        <div className="settings-field-label">Déconnexion automatique</div>
        <div className="settings-field-hint">
          {value === '0'
            ? 'Désactivée. Vous restez connecté tant que vous ne vous déconnectez pas.'
            : `Au bout de ${options.find(o => o.value === value)?.label} sans activité, vous serez automatiquement déconnecté (avertissement 5 min avant).`}
        </div>
      </div>
      <div className="settings-field-control">
        <ChipSelect options={options} value={value} onChange={onChange} />
      </div>
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
          <div className="settings-field-label">Authentification à 2 facteurs (TOTP)</div>
          <div className="settings-field-hint">
            {status.enabled
              ? 'Active — code 6 chiffres requis à chaque connexion.'
              : 'Renforce la sécurité de votre compte avec Google Authenticator, Authy ou 1Password.'}
          </div>
        </div>
        <div className="settings-field-control">
          {loading ? (
            <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>Chargement…</span>
          ) : status.enabled ? (
            <button className="secondary-btn" onClick={() => setShowDisable(true)}>
              Désactiver
            </button>
          ) : (
            <button className="primary-btn" onClick={() => setShowSetup(true)}>
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
        <div className="settings-field-row">
          <div>
            <div className="settings-field-label">{t('settings.security.password')}</div>
            <div className="settings-field-hint">{t('settings.security.passwordHint')}</div>
          </div>
          <div className="settings-field-control">
            <button className="secondary-btn" onClick={() => setShowPwdModal(true)}>
              {t('settings.security.changePassword')}
            </button>
          </div>
        </div>

        <TwoFactorRow t={t} />
        <IdleTimeoutRow />
      </div>

      <div className="card">
        <div className="card-header">
          <h3><Activity size={16}/> {t('settings.security.recentActivity')}</h3>
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
