// Source: Settings.jsx lines 1042-1094 — DevisesSection
import { useTranslation } from 'react-i18next';
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
        <div className="settings-field-row">
          <div>
            <div className="settings-field-label">{t('settings.currency.refCurrency')}</div>
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
            <div className="settings-field-label">{t('settings.currency.uiLang')}</div>
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
    </section>
  );
}
