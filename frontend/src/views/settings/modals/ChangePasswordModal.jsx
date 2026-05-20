// Source: Settings.jsx lines 606-680 — ChangePasswordModal
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import * as api from '../../../api.js';
import { ResponsiveModal } from '../../../components/ui/ResponsiveModal.jsx';

export function ChangePasswordModal({ onClose }) {
  const { t } = useTranslation();
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    if (!currentPwd) return setError(t('settings.security.errCurrent'));
    if (newPwd.length < 10) return setError(t('settings.security.errLength'));
    if (!/[a-zA-Z]/.test(newPwd) || !/\d/.test(newPwd)) return setError(t('settings.security.errChars'));
    if (newPwd !== confirmPwd) return setError(t('settings.security.errMismatch'));
    if (newPwd === currentPwd) return setError(t('settings.security.errSame'));
    setSubmitting(true);
    try {
      await api.auth.changePassword(currentPwd, newPwd);
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err?.message || t('settings.security.errGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveModal open={true} onClose={onClose}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
            {t('settings.security.changeTitle')} <em style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontWeight: 400 }}>{t('settings.security.changeTitleAccent')}</em>
          </h2>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>
        {success ? (
          <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
            <p style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 22, color: 'var(--positive)', margin: '0 0 12px' }}>
              {t('settings.security.updated')}
            </p>
          </div>
        ) : (
          <div className="modal-body">
            <div className="form-row">
              <label className="form-label">{t('settings.security.currentPwd')}</label>
              <input className="form-input" type="password" value={currentPwd}
                     onChange={e => setCurrentPwd(e.target.value)} autoFocus autoComplete="current-password"/>
            </div>
            <div className="form-row">
              <label className="form-label">{t('settings.security.newPwd')}</label>
              <input className="form-input" type="password" value={newPwd}
                     onChange={e => setNewPwd(e.target.value)} autoComplete="new-password"
                     placeholder={t('settings.security.newPwdPh')}/>
            </div>
            <div className="form-row">
              <label className="form-label">{t('settings.security.confirmPwd')}</label>
              <input className="form-input" type="password" value={confirmPwd}
                     onChange={e => setConfirmPwd(e.target.value)} autoComplete="new-password"
                     onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}/>
            </div>
            {error && <div className="form-error">⚠︎ {error}</div>}
            <div className="modal-foot">
              <button className="secondary-btn" onClick={onClose} type="button">{t('actions.cancel')}</button>
              <button className="primary-btn" disabled={submitting} onClick={submit} type="button">
                {submitting ? t('settings.security.updating') : t('settings.security.update')}
              </button>
            </div>
          </div>
        )}
      </ResponsiveModal>
  );
}
