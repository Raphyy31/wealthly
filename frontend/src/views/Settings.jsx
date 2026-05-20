// ============================================================================
// Settings — shell router + rail nav
//
// Each section lives in ./settings/sections/XxxSection.jsx.
// Modals live in ./settings/modals/XxxModal.jsx.
// This file owns only: SETTINGS_SECTIONS, hash-sync, SettingsView shell.
// ============================================================================
import { useState, useEffect } from 'react';
import { User, Users, Wallet, Shield, Sparkles, Globe, Database, Wand2 } from 'lucide-react';
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
            <section className="settings-panel settings-regles">
              <header>
                <h2>{t('settings.rules.title')} <em>{t('settings.rules.titleAccent')}</em></h2>
                <p className="settings-panel-intro">
                  {t('settings.rules.intro')}
                </p>
              </header>

              {/* Outils de maintenance — utilitaires de re-passe sur l'historique. */}
              {(recategorizeUncategorized || recategorizeTransfers) && (
                <div className="card settings-tools">
                  <div className="card-header">
                    <h3><Wand2 size={16}/> Outils de maintenance</h3>
                    <span className="card-meta">Ré-applique les règles à l'historique en un clic.</span>
                  </div>
                  <div className="settings-tools-list">
                    {recategorizeUncategorized && (
                      <div className="settings-tool-row">
                        <div className="settings-tool-text">
                          <strong>Re-catégoriser les non catégorisées</strong>
                          <span>Ré-applique les règles aux transactions actuellement en « Non catégorisé ».</span>
                        </div>
                        <button className="secondary-btn" type="button" onClick={recategorizeUncategorized}>
                          Lancer
                        </button>
                      </div>
                    )}
                    {recategorizeTransfers && (
                      <div className="settings-tool-row">
                        <div className="settings-tool-text">
                          <strong>Rejouer la détection des virements</strong>
                          <span>Identifie AMEX, DÉPENSES ÉCHELONNÉES, top-ups Revolut/Lydia/Wise pré-v2. Tes overrides manuels sont préservés.</span>
                        </div>
                        <button className="secondary-btn" type="button" onClick={recategorizeTransfers}>
                          Lancer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Groupe : Catégories */}
              <div className="settings-group-divider">
                <span>Tes catégories</span>
              </div>
              <LearningToggle showToast={showToast} />
              <MyCategoriesSection
                categories={categories}
                reloadCategories={reloadCategories}
                onCategoryCreated={onCategoryCreated}
                onCategoryDeleted={onCategoryDeleted}
                showToast={showToast}
              />

              {/* Groupe : Marchands et règles */}
              <div className="settings-group-divider">
                <span>Marchands &amp; règles automatiques</span>
              </div>
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
