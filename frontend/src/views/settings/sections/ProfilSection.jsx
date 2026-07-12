// Source: Settings.jsx lines 201-282 — ProfilSection
//
// Refondu 2026-05-21 : card header avec icone cobalt + meta, micro-icons
// dans les labels de champs, badge currency a cote du label.
import { useTranslation } from 'react-i18next';
import { UserCircle, Globe, Coins } from 'lucide-react';
import { ChipSelect } from '../../../components/ChipSelect.jsx';
import { Combobox } from '../../../components/Combobox.jsx';
import { SUPPORTED_CURRENCIES } from '../../../utils.js';

const CURRENCY_FLAGS = { EUR: '🇪🇺', USD: '🇺🇸', GBP: '🇬🇧', CHF: '🇨🇭' };
const CURRENCY_NAMES = { EUR: 'Euro', USD: 'Dollar US', GBP: 'Livre sterling', CHF: 'Franc suisse' };

export function ProfilSection({ currentUser, baseCurrency, setBaseCurrency }) {
  const { t, i18n: i18nHook } = useTranslation();
  // Avatar fallback chain: full_name initials → email first char → "U" (User).
  // Never show "?" — confusing and unfriendly.
  const initials = (() => {
    if (currentUser?.full_name) {
      const parts = currentUser.full_name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('');
      if (parts) return parts.toUpperCase();
    }
    if (currentUser?.email) return currentUser.email[0].toUpperCase();
    return 'U';
  })();
  const currentLang = (i18nHook.resolvedLanguage || i18nHook.language || 'fr').slice(0, 2);

  return (
    <section className="settings-panel">
      <header>
        <h2>{t('settings.profile.title')} <em>{t('settings.profile.titleAccent')}</em></h2>
        <p className="settings-panel-intro">{t('settings.profile.intro')}</p>
      </header>

      <div className="card">
        <div className="card-header">
          <h3>
            <UserCircle size={16} style={{ color: 'var(--accent)' }}/>
            Identité
          </h3>
          <span className="card-meta">Nom · email · langue</span>
        </div>
        <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="settings-profile-card">
            <span className="settings-profile-avatar">{initials}</span>
            <div className="settings-profile-meta">
              <div className="settings-profile-name">
                {currentUser?.full_name || (currentUser?.email ? currentUser.email.split('@')[0] : t('settings.profile.userFallback'))}
              </div>
              <div className="settings-profile-email">{currentUser?.email || t('settings.profile.demoMode')}</div>
            </div>
          </div>

          <div className="settings-field-row">
            <div>
              <div className="settings-field-label">{t('settings.profile.fullName')}</div>
              <div className="settings-field-hint">{t('settings.profile.fullNameHint')}</div>
            </div>
            <div className="settings-field-control">
              <span className="settings-managed-badge">Géré depuis votre compte</span>
            </div>
          </div>

          <div className="settings-field-row">
            <div>
              <div className="settings-field-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Globe size={14} style={{ color: 'var(--ink-3)' }}/>
                {t('settings.profile.uiLanguage')}
              </div>
              <div className="settings-field-hint">{t('settings.profile.uiLanguageHint')}</div>
            </div>
            <div className="settings-field-control">
              <ChipSelect
                value={currentLang}
                onChange={(val) => i18nHook.changeLanguage(val)}
                options={[
                  { value: 'fr', label: 'Français' },
                  { value: 'en', label: 'English' },
                ]}
              />
            </div>
          </div>

          <div className="settings-field-row">
            <div>
              <div className="settings-field-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Coins size={14} style={{ color: 'var(--ink-3)' }}/>
                {t('settings.profile.refCurrency')}
              </div>
              <div className="settings-field-hint">{t('settings.profile.refCurrencyHint')}</div>
            </div>
            <div className="settings-field-control">
              <Combobox
                value={baseCurrency}
                onChange={(val) => setBaseCurrency && setBaseCurrency(val)}
                disabled={!setBaseCurrency}
                options={SUPPORTED_CURRENCIES.map(c => ({ value: c, label: `${c} — ${CURRENCY_NAMES[c]}`, icon: CURRENCY_FLAGS[c] }))}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
