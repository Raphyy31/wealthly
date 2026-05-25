// Source: Settings.jsx lines 1096-1138 — DonneesSection
import { useTranslation } from 'react-i18next';
import { Download, Upload, Trash2, Database } from 'lucide-react';
import { BusyButton } from '../../../components/ui/BusyButton.jsx';
import { isDemoMode } from '../../../demoData.js';

const DEMO_DISABLED_STYLE = { opacity: 0.5, pointerEvents: 'none', cursor: 'not-allowed' };
const DEMO_TOOLTIP = 'Indisponible en mode démo';

export function DonneesSection({ exportData, importData, resetAllData }) {
  const { t } = useTranslation();
  const demo = isDemoMode();
  const onReset = async () => {
    if (demo) return;
    if (!window.confirm(t('confirms.resetSettings1'))) return;
    if (!window.confirm(t('confirms.resetSettings2'))) return;
    if (resetAllData) await resetAllData();
  };
  return (
    <section className="settings-panel">
      <header>
        <h2>{t('settings.data.title')} <em>{t('settings.data.titleAccent')}</em></h2>
        <p className="settings-panel-intro">
          {t('settings.data.intro')}
        </p>
      </header>

      <div className="card">
        <div className="card-header"><h3><Database size={16} style={{ color: 'var(--accent)' }}/> {t('settings.data.backupCard')}</h3></div>
        <div className="settings-buttons">
          <button
            className="ds-btn"
            onClick={demo ? undefined : exportData}
            style={demo ? DEMO_DISABLED_STYLE : undefined}
            title={demo ? DEMO_TOOLTIP : undefined}
          >
            <Download size={14}/> {t('settings.data.export')}
          </button>
          <label
            className="ds-btn"
            style={demo ? { ...DEMO_DISABLED_STYLE, cursor: 'not-allowed' } : { cursor: 'pointer' }}
            title={demo ? DEMO_TOOLTIP : undefined}
          >
            <Upload size={14}/> {t('settings.data.import')}
            <input type="file" accept=".json" onChange={demo ? undefined : importData} disabled={demo} style={{ display: 'none' }}/>
          </label>
        </div>
        <p className="settings-footnote">
          {t('settings.data.footnote')}
        </p>
      </div>

      <div className="settings-danger-zone">
        <h3>{t('settings.data.dangerZone')}</h3>
        <p dangerouslySetInnerHTML={{ __html: t('settings.data.dangerBody') }} />
        <BusyButton
          className="ds-btn danger"
          onClick={onReset}
          style={demo ? DEMO_DISABLED_STYLE : undefined}
          title={demo ? DEMO_TOOLTIP : undefined}
        >
          <Trash2 size={14}/> {t('settings.data.resetAll')}
        </BusyButton>
      </div>
    </section>
  );
}
