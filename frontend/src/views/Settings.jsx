// ============================================================================
// Settings — shell router + rail nav
//
// Each section lives in ./settings/sections/XxxSection.jsx.
// Modals live in ./settings/modals/XxxModal.jsx.
// This file owns only: SETTINGS_SECTIONS, hash-sync, SettingsView shell.
// ============================================================================
import { useState, useEffect, useRef } from 'react';
import { User, Users, Wallet, Shield, Sparkles, Globe, Database, Wand2, ArrowLeftRight, Tag, Store, Settings2, CheckCircle2, Circle, ChevronRight, Landmark, BrainCircuit, KeyRound, AlertTriangle } from 'lucide-react';
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
  { id: 'overview',   icon: Settings2, label: 'Vue d’ensemble', group: 'Mon espace' },
  { id: 'profil',     icon: User,      labelKey: 'settings.sections.profile', group: 'Mon espace' },
  { id: 'foyer',      icon: Users,     labelKey: 'settings.sections.household', group: 'Mon espace' },
  { id: 'comptes',    icon: Wallet,    labelKey: 'settings.sections.accounts', group: 'Mes finances' },
  { id: 'regles',     icon: Sparkles,  labelKey: 'settings.sections.rules', group: 'Mes finances' },
  { id: 'securite',   icon: Shield,    labelKey: 'settings.sections.security', group: 'Sécurité & données' },
  { id: 'devises',    icon: Globe,     labelKey: 'settings.sections.currency', group: 'Sécurité & données' },
  { id: 'donnees',    icon: Database,  labelKey: 'settings.sections.data', group: 'Sécurité & données' },
];
const SETTINGS_GROUPS = ['Mon espace', 'Mes finances', 'Sécurité & données'];

function readHashSection() {
  if (typeof window === 'undefined') return null;
  const m = window.location.hash.match(/^#settings\/([a-z]+)/);
  if (m && SETTINGS_SECTIONS.some(s => s.id === m[1])) return m[1];
  return null;
}

export function SettingsView({ members, accounts, accountBalances, saveMember, deleteMember, deleteAccount, updateAccount, mergeAccounts, transactions = [], transferIds, updateTags, setTransferOverride, exportData, importData, resetAllData, categories = [], reloadCategories, onCategoryCreated, onCategoryUpdated, onCategoryDeleted, showToast, fmt, baseCurrency = 'EUR', setBaseCurrency, rates, ratesDate, currentUser, onImport, recategorizeUncategorized, recategorizeTransfers, bankConnections = [], initialFocus, onConsumeInitialFocus }) {
  const { t } = useTranslation();
  const [editingMember, setEditingMember] = useState(null);
  const [activeSection, setActiveSection] = useState(() => readHashSection() || 'overview');
  const [accountsInitialTab, setAccountsInitialTab] = useState(null);
  const COLORS = MEMBER_PALETTE;

  useEffect(() => {
    if (!initialFocus) return;
    if (initialFocus === 'banks') {
      setActiveSection('comptes');
      setAccountsInitialTab('connexions');
    }
    onConsumeInitialFocus?.();
  }, [initialFocus, onConsumeInitialFocus]);

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
          {SETTINGS_GROUPS.map(group => (
            <div className="settings-rail-group" key={group}>
              <span className="settings-rail-group-label">{group}</span>
              {SETTINGS_SECTIONS.filter(s => s.group === group).map(s => {
                const Icon = s.icon;
                return (
                  <button key={s.id} type="button" className={`settings-rail-item${activeSection === s.id ? ' active' : ''}`} onClick={() => goTo(s.id)}>
                    <Icon size={15}/> <span>{s.label || t(s.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="settings-content">
          {activeSection === 'overview' && (
            <SettingsOverview
              currentUser={currentUser}
              members={members}
              accounts={accounts}
              bankConnections={bankConnections}
              categories={categories}
              transactions={transactions}
              goTo={goTo}
            />
          )}
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
              initialTab={accountsInitialTab}
              onConsumeInitialTab={() => setAccountsInitialTab(null)}
            />
          )}

          {activeSection === 'securite' && (
            <SecuriteSection currentUser={currentUser} bankConnections={bankConnections} />
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
              onCategoryUpdated={onCategoryUpdated}
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

function SettingsOverview({ currentUser, members = [], accounts = [], bankConnections = [], categories = [], transactions = [], goTo }) {
  const jointCount = accounts.filter(a => a.isJoint).length;
  const connectedCount = bankConnections.filter(c => c.status === 'authorized').length;
  const bankIssues = bankConnections.filter(c => ['error', 'expired', 'suspended', 'pending'].includes(c.status)).length;
  const uncategorized = transactions.filter(tx => !tx.categoryId).length;
  const checks = [
    { label: 'Profil identifié', done: !!currentUser?.email, section: 'profil' },
    { label: 'Foyer renseigné', done: members.length > 0, section: 'foyer' },
    { label: 'Au moins un compte', done: accounts.length > 0, section: 'comptes' },
    { label: 'Compte commun identifié', done: jointCount > 0 || members.length < 2, section: 'comptes' },
    { label: 'Double authentification', done: !!currentUser?.totp_enabled, section: 'securite' },
  ];
  const doneCount = checks.filter(c => c.done).length;
  const score = Math.round((doneCount / checks.length) * 100);
  const cards = [
    { section: 'foyer', Icon: Users, label: 'Foyer', value: `${members.length} membre${members.length > 1 ? 's' : ''}`, detail: jointCount ? `${jointCount} compte commun` : 'Compte commun à vérifier' },
    { section: 'comptes', Icon: Landmark, label: 'Comptes & banques', value: `${accounts.length} compte${accounts.length > 1 ? 's' : ''}`, detail: bankIssues ? `${bankIssues} connexion à vérifier` : `${connectedCount} connexion${connectedCount > 1 ? 's' : ''} active${connectedCount > 1 ? 's' : ''}` },
    { section: 'regles', Icon: BrainCircuit, label: 'Automatisation', value: `${categories.length} catégories`, detail: uncategorized ? `${uncategorized} opération${uncategorized > 1 ? 's' : ''} à classer` : 'Transactions bien rangées' },
    { section: 'securite', Icon: KeyRound, label: 'Protection', value: currentUser?.totp_enabled ? '2FA activée' : '2FA à activer', detail: currentUser?.totp_enabled ? 'Compte renforcé' : 'Recommandé pour vos données financières' },
  ];

  return (
    <section className="settings-panel settings-overview">
      <header>
        <h2>Réglages <em>en un coup d’œil.</em></h2>
        <p className="settings-panel-intro">Commencez par ce qui demande votre attention. Les options techniques restent accessibles dans les sections dédiées.</p>
      </header>

      <div className="settings-health-card">
        <div className="settings-health-score" style={{ '--score': `${score}%` }}><strong>{score}%</strong><span>configuré</span></div>
        <div className="settings-health-body">
          <div className="settings-health-title"><span>Configuration de Yotori Finance</span><small>{doneCount}/{checks.length} étapes terminées</small></div>
          <div className="settings-checklist">
            {checks.map(item => (
              <button key={item.label} type="button" className={item.done ? 'is-done' : ''} onClick={() => goTo(item.section)}>
                {item.done ? <CheckCircle2 size={15}/> : <Circle size={15}/>}<span>{item.label}</span>{!item.done && <ChevronRight size={13}/>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(bankIssues > 0 || uncategorized > 0 || !currentUser?.totp_enabled) && (
        <div className="settings-attention">
          <AlertTriangle size={16}/>
          <div><strong>À faire en priorité</strong><span>{bankIssues > 0 ? 'Une connexion bancaire demande votre attention.' : uncategorized > 0 ? `${uncategorized} transactions restent à classer.` : 'Activez la double authentification pour protéger le compte.'}</span></div>
          <button className="ds-btn" onClick={() => goTo(bankIssues > 0 ? 'comptes' : uncategorized > 0 ? 'regles' : 'securite')}>Ouvrir</button>
        </div>
      )}

      <div className="settings-overview-grid">
        {cards.map(({ section, Icon, label, value, detail }) => (
          <button key={section} type="button" className="settings-overview-card" onClick={() => goTo(section)}>
            <span className="settings-overview-icon"><Icon size={18}/></span>
            <span className="settings-overview-copy"><small>{label}</small><strong>{value}</strong><em>{detail}</em></span>
            <ChevronRight size={15} className="settings-overview-arrow"/>
          </button>
        ))}
      </div>
    </section>
  );
}

// ─── RegLesPanel : tab navigation horizontale pour Catégories & règles ───
// Au lieu d'un long scroll, l'utilisateur clique sur la tab du module qu'il
// veut voir. Crossfade GSAP entre tabs. Compteurs en chip sur chaque tab.
function RegLesPanel({
  t, categories, accounts, transactions, transferIds, updateTags, setTransferOverride,
  reloadCategories, onCategoryCreated, onCategoryUpdated, onCategoryDeleted, showToast,
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
      desc: 'Vos grandes familles de budget. Ouvrez une catégorie pour organiser ses détails sans alourdir la liste principale.',
      example: '',
    },
    {
      id: 'rules-vir',
      icon: ArrowLeftRight,
      label: 'Virements internes',
      desc: 'Évite que vos mouvements entre comptes soient comptés comme des dépenses.',
      example: 'LIVRET A → virement vers votre Livret',
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
              transactions={transactions}
              reloadCategories={reloadCategories}
              onCategoryCreated={onCategoryCreated}
              onCategoryUpdated={onCategoryUpdated}
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
                  <span>Applique vos règles aux transactions en « Non catégorisé ».</span>
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
