// ============================================================================
// Settings — shell router + rail nav
//
// Each section lives in ./settings/sections/XxxSection.jsx.
// Modals live in ./settings/modals/XxxModal.jsx.
// This file owns only: SETTINGS_SECTIONS, hash-sync, SettingsView shell.
// ============================================================================
import { useState, useEffect, useRef } from 'react';
import { User, Users, Wallet, Shield, Sparkles, Globe, Database, Wand2, ArrowLeftRight, Tag, Store, Settings2 } from 'lucide-react';
import { gsap } from '../utils/gsapSetup.js';
import { usePageEnter } from '../hooks/usePageEnter.js';
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
import { MonthlyReportToggle }  from './settings/sections/MonthlyReportToggle.jsx';
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

  const rootRef = usePageEnter(); // motion d'entrée standard (charte Forêt)

  return (
    <div className="settings-view" ref={rootRef}>
      <div className="subview-header" data-reveal>
        <div>
          <h1>Vos <em>{t('settings.title').toLowerCase()}.</em></h1>
          <p>{t('settings.subtitle')}</p>
        </div>
      </div>

      <div className="settings-layout" data-reveal>
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
            <>
              <ProfilSection
                currentUser={currentUser}
                baseCurrency={baseCurrency}
                setBaseCurrency={setBaseCurrency}
              />
              <MonthlyReportToggle showToast={showToast} />
            </>
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
            <RegLesPanel
              t={t}
              categories={categories}
              accounts={accounts}
              transactions={transactions}
              transferIds={transferIds}
              updateTags={updateTags}
              setTransferOverride={setTransferOverride}
              reloadCategories={reloadCategories}
              onCategoryCreated={onCategoryCreated}
              onCategoryDeleted={onCategoryDeleted}
              showToast={showToast}
              recategorizeUncategorized={recategorizeUncategorized}
              recategorizeTransfers={recategorizeTransfers}
            />
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

// ─── RegLesPanel : tab navigation horizontale pour Catégories & règles ───
// Au lieu d'un long scroll, l'utilisateur clique sur la tab du module qu'il
// veut voir. Crossfade GSAP entre tabs. Compteurs en chip sur chaque tab.
function RegLesPanel({
  t, categories, accounts, transactions, transferIds, updateTags, setTransferOverride,
  reloadCategories, onCategoryCreated, onCategoryDeleted, showToast,
  recategorizeUncategorized, recategorizeTransfers,
}) {
  const [activeTab, setActiveTab] = useState('payees');
  const [showAdvancedRules, setShowAdvancedRules] = useState(false);
  const contentRef = useRef(null);
  const tabsRef = useRef(null);
  const indicatorRef = useRef(null);

  // Anime le crossfade au changement de tab
  useEffect(() => {
    if (!contentRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(contentRef.current,
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.32, ease: 'power3.out' }
    );
  }, [activeTab]);

  // GSAP magic-line — l'indicateur cobalt slide entre les boutons de tab
  // (sprint GSAP avance 2026-05-20). Mesure le rect du bouton actif et
  // anime left/width avec spring physics pour un feel naturel.
  useEffect(() => {
    if (!tabsRef.current || !indicatorRef.current) return;
    const activeBtn = tabsRef.current.querySelector('.reg-tab.is-active');
    if (!activeBtn) return;
    const containerRect = tabsRef.current.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const left = btnRect.left - containerRect.left + tabsRef.current.scrollLeft;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.to(indicatorRef.current, {
      x: left,
      width: btnRect.width,
      duration: reduce ? 0 : 0.42,
      ease: 'expo.out',
    });
  }, [activeTab]);

  const tabs = [
    {
      id: 'payees',
      icon: Store,
      label: 'Marchands',
      desc: 'La méthode recommandée. Assigne une catégorie à un marchand : toutes ses variantes futures (Picard, PICARD #234, PIC.PARIS) en héritent automatiquement.',
      example: 'Picard → Courses',
    },
    {
      id: 'categories',
      icon: Tag,
      label: 'Catégories',
      desc: 'Les boîtes dans lesquelles tes dépenses sont rangées (Logement, Courses, Restos…).',
      example: '',
    },
    {
      id: 'rules-vir',
      icon: ArrowLeftRight,
      label: 'Virements internes',
      desc: 'Évite que tes mouvements entre comptes soient comptés comme des dépenses.',
      example: 'LIVRET A → virement vers ton Livret',
    },
  ];

  const activeTabConfig = tabs.find(t => t.id === activeTab) || tabs[0];

  return (
    <section className="settings-panel settings-regles">
      <header>
        <h2>{t('settings.rules.title')} <em>{t('settings.rules.titleAccent')}</em></h2>
        <p className="settings-panel-intro">{t('settings.rules.intro')}</p>
      </header>

      {/* Tabs horizontales — icone + label, design ATM avec actif coloré
          + indicateur cobalt magic-line qui slide entre tabs via GSAP */}
      <div className="reg-tabs" role="tablist" aria-label="Sections règles & catégories" ref={tabsRef}>
        <span className="reg-tab-indicator" ref={indicatorRef} aria-hidden="true"/>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`reg-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
            >
              <Icon size={16} className="reg-tab-icon"/>
              <span className="reg-tab-label">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Description de la section active — pédagogique, exemple inline */}
      <div className="reg-section-desc">
        <p>{activeTabConfig.desc}</p>
        {activeTabConfig.example && (
          <p className="reg-section-example">Exemple : <code>{activeTabConfig.example}</code></p>
        )}
      </div>

      <div ref={contentRef} className="reg-content" role="tabpanel">
        {activeTab === 'payees' && (
          <>
            <PayeesSection categories={categories} showToast={showToast} />

            {/* Mots-clés bruts — repli "Avancé". Pour les libellés qu'aucun
                marchand ne couvre (ex. "VIR LBP 0345"). */}
            <section className="card" style={{ marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowAdvancedRules(v => !v)}
                className="reg-advanced-toggle"
                aria-expanded={showAdvancedRules}
              >
                <Wand2 size={15}/>
                <span>Règles par mot-clé (avancé)</span>
                <span className="reg-advanced-caret" data-open={showAdvancedRules}>›</span>
              </button>
              {showAdvancedRules && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px 18px' }}>
                  <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 12px', lineHeight: 1.5 }}>
                    Si la transaction contient un mot-clé brut, elle reçoit la catégorie choisie. À utiliser
                    quand le marchand n'est pas détectable. Exemple : <code>VIR LBP 0345 → Virement</code>.
                  </p>
                  <CustomRulesSection categories={categories} />
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'categories' && (
          <>
            <LearningToggle showToast={showToast} />
            <MyCategoriesSection
              categories={categories}
              reloadCategories={reloadCategories}
              onCategoryCreated={onCategoryCreated}
              onCategoryDeleted={onCategoryDeleted}
              showToast={showToast}
            />
          </>
        )}

        {activeTab === 'rules-vir' && (
          <TransferRulesSection
            accounts={accounts}
            transactions={transactions}
            transferIds={transferIds}
            updateTags={updateTags}
            setTransferOverride={setTransferOverride}
            showToast={showToast}
          />
        )}
      </div>

      {/* Outils — footer toujours visible (le plus utilisé : « re-catégoriser »
          ne devrait pas être enterré dans un onglet à part). */}
      {(recategorizeUncategorized || recategorizeTransfers) && (
        <div className="card settings-tools" style={{ marginTop: 20 }}>
          <div className="card-header">
            <h3><Settings2 size={16}/> Outils</h3>
            <span className="card-meta">Ré-applique les règles à l'historique.</span>
          </div>
          <div className="settings-tools-list">
            {recategorizeUncategorized && (
              <div className="settings-tool-row">
                <div className="settings-tool-text">
                  <strong>Re-catégoriser les non catégorisées</strong>
                  <span>Applique tes règles aux transactions en « Non catégorisé ».</span>
                </div>
                <button className="ds-btn ds-btn--primary" type="button" onClick={recategorizeUncategorized}>Lancer</button>
              </div>
            )}
            {recategorizeTransfers && (
              <div className="settings-tool-row">
                <div className="settings-tool-text">
                  <strong>Rejouer la détection des virements</strong>
                  <span>AMEX, échelonnés, top-ups Revolut/Lydia/Wise. Tes overrides sont préservés.</span>
                </div>
                <button className="ds-btn" type="button" onClick={recategorizeTransfers}>Lancer</button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
