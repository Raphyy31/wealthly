// Source: Settings.jsx lines 1042-1094 — DevisesSection
// Refondu 2026-05-21 : card header cobalt + micro-icons sur les labels.
import { useTranslation } from 'react-i18next';
import { Coins, Globe } from 'lucide-react';
import { Combobox } from '../../../components/Combobox.jsx';
import { ChipSelect } from '../../../components/ChipSelect.jsx';
import { SUPPORTED_CURRENCIES } from '../../../utils.js';

const CURRENCY_FLAGS = { EUR: '🇪🇺', USD: '🇺🇸', GBP: '🇬🇧', CHF: '🇨🇭' };
const CURRENCY_NAMES = { EUR: 'Euro', USD: 'Dollar US', GBP: 'Livre sterling', CHF: 'Franc suisse' };

export function DevisesSection({ baseCurrency, setBaseCurrency, ratesDate }) {
  const { t, i18n: i18nHook } = useTranslation();
  const currentLang = (i18nHook.resolvedLanguage || i18nHook.language || 'fr').slice(0, 2);
  return (
    <section className="settings-panel">
      <header>
        <h2>{t('settings.currency.title')} <em>{t('settings.currency.titleAccent')}</em></h2>
        <p className="settings-panel-intro">
          {t('settings.currency.intro')}
        </p>
      </header>

      <div className="card">
        <div className="card-header">
          <h3>
            <Coins size={16} style={{ color: 'var(--accent)' }}/>
            Devise & langue
          </h3>
          {ratesDate && (
            <span className="card-meta">
              Taux du {new Date(ratesDate).toLocaleDateString()}
            </span>
          )}
        </div>
        <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="settings-field-row">
            <div>
              <div className="settings-field-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Coins size={14} style={{ color: 'var(--ink-3)' }}/>
                {t('settings.currency.refCurrency')}
              </div>
              <div className="settings-field-hint">
                {ratesDate ? t('settings.currency.refRates', { date: new Date(ratesDate).toLocaleDateString() }) : t('settings.currency.refConvert')}
              </div>
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

          <div className="settings-field-row">
            <div>
              <div className="settings-field-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Globe size={14} style={{ color: 'var(--ink-3)' }}/>
                {t('settings.currency.uiLang')}
              </div>
              <div className="settings-field-hint">{t('settings.currency.uiLangHint')}</div>
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
        </div>
      </div>
    </section>
  );
}
