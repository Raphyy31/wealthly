// Source: Settings.jsx lines 1096-1138 — DonneesSection
import { useTranslation } from 'react-i18next';
import { Download, Upload, Trash2, Database } from 'lucide-react';
import { BusyButton } from '../../../components/ui/BusyButton.jsx';

export function DonneesSection({ exportData, importData, resetAllData }) {
  const { t } = useTranslation();
  const onReset = async () => {
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
          <button className="ds-btn" onClick={exportData}><Download size={14}/> {t('settings.data.export')}</button>
          <label className="ds-btn" style={{ cursor: 'pointer' }}>
            <Upload size={14}/> {t('settings.data.import')}
            <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }}/>
          </label>
        </div>
        <p className="settings-footnote">
          {t('settings.data.footnote')}
        </p>
      </div>

      <div className="settings-danger-zone">
        <h3>{t('settings.data.dangerZone')}</h3>
        <p dangerouslySetInnerHTML={{ __html: t('settings.data.dangerBody') }} />
        <BusyButton className="ds-btn danger" onClick={onReset}>
          <Trash2 size={14}/> {t('settings.data.resetAll')}
        </BusyButton>
      </div>
    </section>
  );
}
