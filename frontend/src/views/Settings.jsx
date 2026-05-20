// ============================================================================
// Settings — shell router + rail nav
//
// Each section lives in ./settings/sections/XxxSection.jsx.
// Modals live in ./settings/modals/XxxModal.jsx.
// This file owns only: SETTINGS_SECTIONS, hash-sync, SettingsView shell.
// ============================================================================
import { useState, useEffect } from 'react';
import { User, Users, Wallet, Shield, Sparkles, Globe, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MEMBER_PALETTE } from '../constants.js';

import { ProfilSection }        from './settings/sections/ProfilSection.jsx';
import { FoyerSection }         from './settings/sections/FoyerSection.jsx';
import { ComptesSection }       from './settings/sections/ComptesSection.jsx';
import { SecuriteSection }      from './settings/sections/SecuriteSection.jsx';
import { DevisesSection }       from './settings/sections/DevisesSection.jsx';
import { DonneesSection }       from './settings/sections/DonneesSection.jsx';
import { MyCategoriesSection }  from './settings/sections/MyCategoriesSection.jsx';
import { PayeesSection }        from './settings/sections/PayeesSection.jsx';
import { CustomRulesSection }   from './settings/sections/CustomRulesSection.jsx';
import { TransferRulesSection } from './settings/sections/TransferRulesSection.jsx';
import { LearningToggle }       from './settings/sections/LearningToggle.jsx';
import { MemberEditor }         from './settings/modals/MemberEditor.jsx';

// ============================================================================
// SETTINGS
// ============================================================================
const SETTINGS_SECTIONS = [
  { id: 'profil',     icon: User,     labelKey: 'settings.sections.profile' },
  { id: 'foyer',      icon: Users,    labelKey: 'settings.sections.household' },
  { id: 'comptes',    icon: Wallet,   labelKey: 'settings.sections.accounts' },
  { id: 'securite',   icon: Shield,   labelKey: 'settings.sections.security' },
  { id: 'regles',     icon: Sparkles, labelKey: 'settings.sections.rules' },
  { id: 'devises',    icon: Globe,    labelKey: 'settings.sections.currency' },
  { id: 'donnees',    icon: Database, labelKey: 'settings.sections.data' },
];

function readHashSection() {
  if (typeof window === 'undefined') return null;
  const m = window.location.hash.match(/^#settings\/([a-z]+)/);
  if (m && SETTINGS_SECTIONS.some(s => s.id === m[1])) return m[1];
  return null;
}

export function SettingsView({ members, accounts, accountBalances, saveMember, deleteMember, deleteAccount, updateAccount, mergeAccounts, transactions = [], transferIds, updateTags, setTransferOverride, exportData, importData, resetAllData, categories = [], reloadCategories, onCategoryCreated, onCategoryDeleted, showToast, fmt, baseCurrency = 'EUR', setBaseCurrency, rates, ratesDate, currentUser, onImport, recategorizeUncategorized, recategorizeTransfers }) {
  const { t } = useTranslation();
  const [editingMember, setEditingMember] = useState(null);
  const [activeSection, setActiveSection] = useState(() => readHashSection() || 'profil');
  const COLORS = MEMBER_PALETTE;

  // Two-way sync with URL hash (#settings/securite etc.) — gives copy-pasteable deep links
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHash = () => {
      const s = readHashSection();
      if (s && s !== activeSection) setActiveSection(s);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [activeSection]);

  const goTo = (id) => {
    setActiveSection(id);
    if (typeof window !== 'undefined') {
      try { window.history.replaceState(null, '', `#settings/${id}`); } catch { /* ignore */ }
    }
  };

  return (
    <div className="settings-view">
      <div className="subview-header">
        <div>
          <h1>Vos <em>{t('settings.title').toLowerCase()}.</em></h1>
          <p>{t('settings.subtitle')}</p>
        </div>
      </div>

      <div className="settings-layout">
        <nav className="settings-rail" aria-label={t('settings.sections.aria')}>
          {SETTINGS_SECTIONS.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                className={`settings-rail-item${activeSection === s.id ? ' active' : ''}`}
                onClick={() => goTo(s.id)}
              >
                <Icon size={15}/> <span>{t(s.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        <div className="settings-panel">
          {activeSection === 'profil' && (
            <ProfilSection
              currentUser={currentUser}
              baseCurrency={baseCurrency}
              setBaseCurrency={setBaseCurrency}
            />
          )}

          {activeSection === 'foyer' && (
            <FoyerSection
              members={members}
              setEditingMember={setEditingMember}
              deleteMember={deleteMember}
              COLORS={COLORS}
            />
          )}

          {activeSection === 'comptes' && (
            <ComptesSection
              accounts={accounts}
              accountBalances={accountBalances}
              members={members}
              transactions={transactions}
              updateAccount={updateAccount}
              deleteAccount={deleteAccount}
              mergeAccounts={mergeAccounts}
              fmt={fmt}
              onImport={onImport}
            />
          )}

          {activeSection === 'securite' && (
            <SecuriteSection currentUser={currentUser} />
          )}

          {activeSection === 'regles' && (
            <section className="settings-panel">
              <header>
                <h2>{t('settings.rules.title')} <em>{t('settings.rules.titleAccent')}</em></h2>
                <p className="settings-panel-intro">
                  {t('settings.rules.intro')}
                </p>
              </header>
              {recategorizeUncategorized && (
                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button className="ds-btn" type="button" onClick={recategorizeUncategorized}>
                    Re-catégoriser les transactions non catégorisées
                  </button>
                  <span style={{ color: 'var(--ink-2)', fontSize: 12 }}>
                    Ré-applique les règles aux transactions actuellement en « Non catégorisé ».
                  </span>
                </div>
              )}
              {recategorizeTransfers && (
                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button className="ds-btn" type="button" onClick={recategorizeTransfers}>
                    Rejouer la détection des virements internes
                  </button>
                  <span style={{ color: 'var(--ink-2)', fontSize: 12, maxWidth: 520 }}>
                    Identifie les prélèvements mensuels de carte de crédit (AMEX),
                    les paires DÉPENSE ÉCHELONNÉE et les top-ups Revolut/Lydia/Wise
                    importés avant le moteur de catégorisation v2. Tes overrides
                    manuels ne sont jamais touchés.
                  </span>
                </div>
              )}
              <LearningToggle showToast={showToast} />
              <MyCategoriesSection
                categories={categories}
                reloadCategories={reloadCategories}
                onCategoryCreated={onCategoryCreated}
                onCategoryDeleted={onCategoryDeleted}
                showToast={showToast}
              />
              <PayeesSection categories={categories} showToast={showToast} />
              <CustomRulesSection categories={categories} />
              <TransferRulesSection
                accounts={accounts}
                transactions={transactions}
                transferIds={transferIds}
                updateTags={updateTags}
                setTransferOverride={setTransferOverride}
                showToast={showToast}
              />
            </section>
          )}

          {activeSection === 'devises' && (
            <DevisesSection
              baseCurrency={baseCurrency}
              setBaseCurrency={setBaseCurrency}
              ratesDate={ratesDate}
            />
          )}

          {activeSection === 'donnees' && (
            <DonneesSection
              exportData={exportData}
              importData={importData}
              resetAllData={resetAllData}
            />
          )}
        </div>
      </div>

      {editingMember && <MemberEditor member={editingMember} onSave={(m) => { saveMember(m); setEditingMember(null); }} onCancel={() => setEditingMember(null)}/>}
    </div>
  );
}
