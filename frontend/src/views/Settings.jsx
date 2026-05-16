// ============================================================================
// Settings — household, accounts, custom rules, bank connections, data tools
//
// Bundles SettingsView + the 4 sub-components it owns: CustomRulesSection,
// BankConnectionsSection, InstitutionPicker (modal), MemberEditor (modal).
// All read/write through the api module; the parent only passes data + a few
// CRUD callbacks.
// ============================================================================
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ChipSelect } from '../components/ChipSelect.jsx';
import { Combobox } from '../components/Combobox.jsx';
import {
  Plus, Trash2, Edit3, Check, Upload, Download, Users, Wallet,
  Sparkles, Activity, AlertCircle, RefreshCw, Link2, Unlink, X, Cloud,
  User, Shield, DollarSign, Database, Globe,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as api from '../api.js';
import { MEMBER_PALETTE } from '../constants.js';
import { ACCOUNT_ROLES, ACCOUNT_ROLE_KEYS, suggestAccountRole, SUPPORTED_CURRENCIES, bankColor } from '../utils.js';
import { BankConnectModal } from '../components/BankConnectModal.jsx';
import { BusyButton } from '../components/ui/BusyButton.jsx';

const CURRENCY_FLAGS = { EUR: '🇪🇺', USD: '🇺🇸', GBP: '🇬🇧', CHF: '🇨🇭' };
const CURRENCY_NAMES = { EUR: 'Euro', USD: 'Dollar US', GBP: 'Livre sterling', CHF: 'Franc suisse' };

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

export function SettingsView({ members, accounts, accountBalances, saveMember, deleteMember, deleteAccount, updateAccount, transactions = [], exportData, importData, resetAllData, categories = [], reloadCategories, onCategoryCreated, onCategoryDeleted, showToast, fmt, baseCurrency = 'EUR', setBaseCurrency, rates, ratesDate, currentUser, onImport, recategorizeUncategorized, recategorizeTransfers }) {
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

// ============================================================================
// SECTION : PROFIL
// ============================================================================
function ProfilSection({ currentUser, baseCurrency, setBaseCurrency }) {
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
            <button className="secondary-btn" disabled>
              <Edit3 size={13}/> {t('settings.profile.changeName')}
            </button>
          </div>
        </div>

        <div className="settings-field-row">
          <div>
            <div className="settings-field-label">{t('settings.profile.uiLanguage')}</div>
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
            <div className="settings-field-label">{t('settings.profile.refCurrency')}</div>
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
    </section>
  );
}

// ============================================================================
// SECTION : FOYER
// ============================================================================
function FoyerSection({ members, setEditingMember, deleteMember, COLORS }) {
  const { t } = useTranslation();
  return (
    <section className="settings-panel">
      <header>
        <h2>{t('settings.household.title')} <em>{t('settings.household.titleAccent')}</em></h2>
        <p className="settings-panel-intro">
          {t('settings.household.intro')}
        </p>
      </header>

      <div className="card">
        <div className="card-header">
          <h3><Users size={16}/> {t('settings.household.members')}</h3>
          <button
            className="secondary-btn"
            onClick={() => setEditingMember({ id: null, name: '', role: 'adult', color: COLORS[members.length % COLORS.length] })}
          >
            <Plus size={14}/> {t('actions.add')}
          </button>
        </div>
        <div className="member-list">
          {members.length === 0 && (
            <div className="empty-mini">
              <Users size={24}/>
              <p>{t('settings.household.emptyMembers')}</p>
            </div>
          )}
          {members.map(m => (
            <div key={m.id} className="member-card">
              <span className="member-avatar large" style={{ background: m.color }}>{m.name.charAt(0).toUpperCase()}</span>
              <div className="member-card-info">
                <div className="member-card-name">{m.name}</div>
                <div className="member-card-role">{m.role === 'adult' ? t('settings.household.adult') : t('settings.household.child')}</div>
              </div>
              <button className="icon-btn-sm" onClick={() => setEditingMember(m)}><Edit3 size={13}/></button>
              <BusyButton className="icon-btn-sm" iconOnly spinnerSize={13} onClick={() => deleteMember(m.id)} title="Supprimer ce membre"><Trash2 size={13}/></BusyButton>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// SECTION : COMPTES & SYNCHRONISATION (merged accounts + GoCardless)
// ============================================================================
function ComptesSection({ accounts, accountBalances, members, transactions, updateAccount, deleteAccount, fmt, onImport }) {
  const { t } = useTranslation();
  return (
    <section className="settings-panel">
      <header>
        <h2>{t('settings.accounts.title')} <em>{t('settings.accounts.titleAccent')}</em></h2>
        <p className="settings-panel-intro">
          {t('settings.accounts.intro')}
        </p>
      </header>

      <div className="card">
        <div className="card-header">
          <h3><Wallet size={16}/> {t('settings.accounts.bankAccounts')}</h3>
          {onImport && (
            <button className="secondary-btn" onClick={onImport}><Upload size={14}/> {t('settings.accounts.importCsv')}</button>
          )}
        </div>
        <div className="member-list">
          {accounts.length === 0 && (
            <div className="empty-mini">
              <Wallet size={24}/>
              <p>{t('settings.accounts.emptyAccounts')}</p>
              {onImport && (
                <button className="primary-btn" style={{ marginTop: 12 }} onClick={onImport}>
                  <Upload size={14}/> {t('settings.accounts.importCsv')}
                </button>
              )}
            </div>
          )}
          {accounts.map(a => {
            const owners = (a.memberIds || []).map(id => members.find(m => m.id === id)?.name).filter(Boolean).join(' & ');
            const role = a.role || 'principal';
            const roleMeta = ACCOUNT_ROLES[role] || ACCOUNT_ROLES.principal;
            const accTx = role === 'principal' ? transactions.filter(t => t.accountId === a.id) : [];
            const otherIds = accounts.filter(x => x.id !== a.id).map(x => x.id);
            const suggestion = role === 'principal' ? suggestAccountRole(accTx, otherIds) : null;
            const showSuggestion = suggestion && suggestion.role && suggestion.role !== 'principal' && suggestion.confidence !== 'low';
            return (
              <div key={a.id} className="member-card" style={{ alignItems: 'flex-start' }}>
                <span className="member-avatar large" style={{ background: bankColor(a.bank) }}>{(a.bank || a.name || '?').charAt(0).toUpperCase()}</span>
                <div className="member-card-info" style={{ flex: 1 }}>
                  <div className="member-card-name">{a.name}</div>
                  <div className="member-card-role">{a.bank} · {owners} · {fmt(accountBalances[a.id] || 0)}</div>
                  {showSuggestion && (
                    <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-tertiary)', fontStyle: 'italic', fontFamily: "'Newsreader', Georgia, serif" }}>
                      <span style={{ color: 'var(--primary)', fontStyle: 'normal', fontFamily: 'inherit' }}>↪ {t('settings.accounts.suggested', { role: ACCOUNT_ROLES[suggestion.role].label })}</span> — {suggestion.reason}{' '}
                      <button
                        onClick={() => updateAccount(a.id, { role: suggestion.role })}
                        style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: 11.5, fontStyle: 'normal', fontFamily: 'inherit' }}
                      >
                        {t('actions.apply')}
                      </button>
                    </div>
                  )}
                </div>
                {updateAccount && (
                  <div className="member-card-actions">
                    <Combobox
                      value={role}
                      onChange={(val) => updateAccount(a.id, { role: val })}
                      options={ACCOUNT_ROLE_KEYS.map(k => ({ value: k, label: ACCOUNT_ROLES[k].label, meta: ACCOUNT_ROLES[k].desc.split('—')[0].trim() }))}
                    />
                    <Combobox
                      value={a.currency || 'EUR'}
                      onChange={(val) => updateAccount(a.id, { currency: val })}
                      options={SUPPORTED_CURRENCIES.map(c => ({ value: c, label: `${CURRENCY_FLAGS[c]} ${c}` }))}
                    />
                  </div>
                )}
                <BusyButton className="icon-btn-sm" iconOnly spinnerSize={13} onClick={() => deleteAccount(a.id)} title="Supprimer ce compte"><Trash2 size={13}/></BusyButton>
              </div>
            );
          })}
        </div>
        <p className="settings-footnote">
          <strong>Principal</strong> — tout compte.<span className="sep">·</span>
          <strong>Dépenses</strong> (Revolut, voyage) — seules les sorties comptent.<span className="sep">·</span>
          <strong>Épargne</strong> / <strong>Investissement</strong> — exclus du cashflow, comptent dans le patrimoine.<span className="sep">·</span>
          <strong>Professionnel</strong> — exclu du patrimoine personnel.
        </p>
      </div>

      <BankConnectionsSection />
    </section>
  );
}

// ============================================================================
// SECTION : SÉCURITÉ (placeholder + best-effort recent activity)
// ============================================================================
function ChangePasswordModal({ onClose }) {
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
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
      </div>
    </div>
  );
}

function SecuriteSection({ currentUser }) {
  const { t } = useTranslation();
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [events, setEvents] = useState(null);  // null = not loaded, [] = loaded empty, [...] = data
  const [eventsError, setEventsError] = useState(false);

  useEffect(() => {
    if (!currentUser?.is_admin) return;  // admin-only endpoint; skip otherwise
    let cancelled = false;
    (async () => {
      try {
        const data = await api.admin.authEvents(20);
        if (cancelled) return;
        // Filter to current user's events only if email matches
        const mine = Array.isArray(data)
          ? data.filter(e => !currentUser?.email || e.email === currentUser.email).slice(0, 5)
          : [];
        setEvents(mine);
      } catch {
        if (!cancelled) setEventsError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  return (
    <section className="settings-panel">
      <header>
        <h2>{t('settings.security.title')} <em>{t('settings.security.titleAccent')}</em></h2>
        <p className="settings-panel-intro">
          {t('settings.security.intro')}
        </p>
      </header>

      <div className="card">
        <div className="settings-field-row">
          <div>
            <div className="settings-field-label">{t('settings.security.password')}</div>
            <div className="settings-field-hint">{t('settings.security.passwordHint')}</div>
          </div>
          <div className="settings-field-control">
            <button className="secondary-btn" onClick={() => setShowPwdModal(true)}>
              {t('settings.security.changePassword')}
            </button>
          </div>
        </div>

        <div className="settings-field-row">
          <div>
            <div className="settings-field-label">{t('settings.security.twoFA')}</div>
            <div className="settings-field-hint">{t('settings.security.twoFAHint')}</div>
          </div>
          <div className="settings-field-control">
            <span className="settings-coming-soon-badge">{t('settings.security.comingSoon')}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3><Activity size={16}/> {t('settings.security.recentActivity')}</h3>
        </div>
        {!currentUser?.is_admin || eventsError ? (
          <p className="settings-panel-intro" style={{ margin: 0 }}>{t('settings.security.activityComingSoon')}</p>
        ) : events === null ? (
          <p className="settings-panel-intro" style={{ margin: 0 }}>{t('settings.security.loading')}</p>
        ) : events.length === 0 ? (
          <p className="settings-panel-intro" style={{ margin: 0 }}>{t('settings.security.noActivity')}</p>
        ) : (
          <div className="settings-auth-events">
            {events.map(ev => (
              <div key={ev.id} className="settings-auth-event-row">
                <span className="settings-auth-event-kind">{ev.kind || '—'} {ev.ip ? `· ${ev.ip}` : ''}</span>
                <span className="settings-auth-event-time">
                  {ev.created_at ? new Date(ev.created_at).toLocaleString('fr-FR') : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPwdModal && <ChangePasswordModal onClose={() => setShowPwdModal(false)}/>}
    </section>
  );
}

// ============================================================================
// SECTION : DEVISES & LANGUE
// ============================================================================
function DevisesSection({ baseCurrency, setBaseCurrency, ratesDate }) {
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

// ============================================================================
// SECTION : DONNÉES (export / import / danger zone)
// ============================================================================
function DonneesSection({ exportData, importData, resetAllData }) {
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
        <div className="card-header"><h3><Database size={16}/> {t('settings.data.backupCard')}</h3></div>
        <div className="settings-buttons">
          <button className="secondary-btn" onClick={exportData}><Download size={14}/> {t('settings.data.export')}</button>
          <label className="secondary-btn" style={{ cursor: 'pointer' }}>
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
        <BusyButton className="danger-btn" onClick={onReset}>
          <Trash2 size={14}/> {t('settings.data.resetAll')}
        </BusyButton>
      </div>
    </section>
  );
}

/**
 * Custom regex rules manager — adds to / overrides the built-in pattern
 * library so the user can teach the categorizer about merchants Wealthly
 * doesn't know yet (boulangerie locale, médecin habituel, abonnement de
 * niche, etc.).
 *
 * Backend exposes /rules with list / create / delete (rules.create takes
 * { pattern: string, categoryId: string }).
 */
function CustomRulesSection({ categories }) {
  const { t } = useTranslation();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newPattern, setNewPattern] = useState('');
  const [newTopId, setNewTopId] = useState('');     // niveau 1 (Catégorie)
  const [newSubId, setNewSubId] = useState('');     // niveau 2 (Détail, optionnel)
  const [submitting, setSubmitting] = useState(false);
  const [rulesFilter, setRulesFilter] = useState('all'); // all | user | learning | transfer

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api.rules.list();
      setRules(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      setError(err.message || t('settings.rules.loadFail'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { refresh(); }, [refresh]);

  const topCategories = useMemo(
    () => categories.filter((c) => !c.parent && c.id !== 'uncategorized' && c.type !== 'income'),
    [categories]
  );
  const subCategories = useMemo(
    () => categories.filter((c) => c.parent === newTopId),
    [categories, newTopId]
  );
  const targetSlug = newSubId || newTopId;

  const onAdd = async (e) => {
    e.preventDefault();
    if (!newPattern.trim() || !targetSlug) return;
    try {
      setSubmitting(true);
      // Validate the regex client-side first — fail fast with a clear message.
      try { new RegExp(newPattern, 'i'); } catch (re) {
        setError(t('settings.rules.invalidRegex', { message: re.message }));
        setSubmitting(false);
        return;
      }
      await api.rules.create({ pattern: newPattern.trim(), category_slug: targetSlug });
      setNewPattern('');
      setNewTopId('');
      setNewSubId('');
      setError(null);
      await refresh();
    } catch (err) {
      setError(err.message || t('settings.rules.addFail'));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm(t('confirms.deleteRule'))) return;
    try {
      await api.rules.delete(id);
      await refresh();
    } catch (err) {
      setError(err.message || t('settings.rules.deleteFail'));
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <h3><Sparkles size={16}/> {t('settings.rules.cardTitle')}</h3>
        <span className="card-meta">{t('settings.rules.rules', { count: rules.length })}</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '0 0 14px', lineHeight: 1.55, maxWidth: 640 }}>
        {t('settings.rules.lead')}
      </p>

      {/* Add form — pattern + niveau 1 (Catégorie) + niveau 2 (Détail, optionnel) */}
      <form onSubmit={onAdd} style={{ display: 'grid', gap: 8, marginBottom: 16, gridTemplateColumns: 'minmax(180px, 2fr) minmax(140px, 1fr) minmax(140px, 1fr) auto' }}>
        <input
          type="text"
          value={newPattern}
          onChange={(e) => setNewPattern(e.target.value)}
          placeholder={t('settings.rules.patternPh')}
          style={{ minWidth: 0 }}
        />
        <select
          value={newTopId}
          onChange={(e) => { setNewTopId(e.target.value); setNewSubId(''); }}
          style={{ minWidth: 0 }}
        >
          <option value="">Catégorie…</option>
          {topCategories.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <select
          value={newSubId}
          onChange={(e) => setNewSubId(e.target.value)}
          disabled={!newTopId || subCategories.length === 0}
          style={{ minWidth: 0 }}
        >
          <option value="">{subCategories.length === 0 ? 'Aucun détail' : 'Détail (optionnel)'}</option>
          {subCategories.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <button
          type="submit"
          className="primary-btn"
          disabled={submitting || !newPattern.trim() || !targetSlug}
        >
          <Plus size={14}/> {t('actions.add')}
        </button>
      </form>

      {error && (
        <div style={{ padding: '8px 12px', background: 'var(--danger-soft)', color: 'var(--danger-text)', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
          <AlertCircle size={12} style={{ verticalAlign: 'text-bottom', marginRight: 4 }}/>
          {error}
        </div>
      )}

      {loading ? (
        <div className="empty-mini"><Activity size={20}/><p>{t('actions.loading')}</p></div>
      ) : rules.length === 0 ? (
        <div className="empty-mini">
          <Sparkles size={22}/>
          <p>{t('settings.rules.emptyRules')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Filtre par provenance (Manuelle / Apprise / Intégrée) */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            {[
              { v: 'all', label: `Toutes (${rules.length})` },
              { v: 'user', label: `Manuelles (${rules.filter(r => (r.created_by || 'user') === 'user').length})` },
              { v: 'learning', label: `🧠 Apprises (${rules.filter(r => r.created_by === 'learning').length})` },
              { v: 'transfer', label: `↔ Virement (${rules.filter(r => r.rule_type === 'transfer').length})` },
            ].map(opt => (
              <button
                key={opt.v}
                className={`tx-sort-btn ${rulesFilter === opt.v ? 'active' : ''}`}
                onClick={() => setRulesFilter(opt.v)}
                style={{ fontSize: 11 }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {rules.filter(r => {
            if (rulesFilter === 'all') return true;
            if (rulesFilter === 'transfer') return r.rule_type === 'transfer';
            return (r.created_by || 'user') === rulesFilter;
          }).map((r) => {
            const slug = r.category_slug || r.categoryId;
            const cat = categories.find((c) => c.id === slug);
            const parentCat = cat?.parent ? categories.find((c) => c.id === cat.parent) : null;
            const cb = r.created_by || 'user';
            const isTransferRule = r.rule_type === 'transfer';
            return (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: 'var(--bg-subtle)',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                }}
              >
                <code
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: 'JetBrains Mono, ui-monospace, Menlo, monospace',
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={r.pattern}
                >
                  /{r.pattern}/i
                </code>
                {/* Badge provenance : Manuelle / 🧠 Apprise / Intégrée */}
                {cb !== 'user' && (
                  <span style={{
                    fontSize: 10, padding: '2px 7px', borderRadius: 4,
                    background: cb === 'learning' ? '#E7E0F7' : 'var(--bg-elev)',
                    color: cb === 'learning' ? '#7B57C6' : 'var(--ink-3)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}>
                    {cb === 'learning' ? '🧠 Apprise' : cb === 'builtin' ? 'Intégrée' : cb}
                  </span>
                )}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: isTransferRule ? 'var(--accent-soft)' : (cat?.color || '#999') + '22',
                    color: isTransferRule ? 'var(--accent)' : (cat?.color || 'var(--text-secondary)'),
                    fontSize: 11,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isTransferRule
                    ? <>↔ Virement interne</>
                    : (parentCat
                        ? <>{parentCat.icon} {parentCat.name} <span style={{ opacity: 0.6 }}>›</span> {cat.icon} {cat.name}</>
                        : <>{cat?.icon} {cat?.name || slug}</>)}
                </span>
                <button className="icon-btn-sm" onClick={() => onDelete(r.id)} title={t('actions.delete')}>
                  <Trash2 size={13}/>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="settings-footnote" dangerouslySetInnerHTML={{ __html: t('settings.rules.footnote') }} />
    </section>
  );
}

// ============================================================================
// BANK CONNECTIONS SECTION (GoCardless)
// ============================================================================
function BankConnectionsSection() {
  const { t } = useTranslation();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [refreshingId, setRefreshingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [syncMessage, setSyncMessage] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.banking.listConnections();
      setConnections(list || []);
    } catch (e) {
      setSyncMessage({ kind: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleSync = async (id) => {
    setSyncingId(id);
    setSyncMessage(null);
    try {
      const res = await api.banking.sync(id);
      setSyncMessage({
        kind: res.errors?.length ? 'warn' : 'ok',
        text: res.errors?.length
          ? t('settings.banks.syncedErrors', { imported: res.imported, skipped: res.skipped, errors: res.errors.join(', ') })
          : t('settings.banks.syncedSummary', { count: res.imported, imported: res.imported, skipped: res.skipped }),
      });
      await reload();
    } catch (e) {
      setSyncMessage({ kind: 'error', text: e.message });
    } finally {
      setSyncingId(null);
    }
  };

  const handleRefresh = async (id) => {
    setRefreshingId(id);
    setSyncMessage(null);
    try {
      const res = await api.banking.refreshConnection(id);
      if (res.accounts?.length > 0) {
        setSyncMessage({ kind: 'ok', text: t('settings.banks.fetchedAccounts', { count: res.accounts.length }) });
      } else {
        const debugKeys = res.debug_raw_keys ? ` (keys: ${res.debug_raw_keys.join(', ')})` : '';
        setSyncMessage({ kind: 'warn', text: t('settings.banks.noAccountsReturned', { status: res.session_status || '?', debug: debugKeys }) });
      }
      await reload();
    } catch (e) {
      setSyncMessage({ kind: 'error', text: e.message });
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    setConfirmDeleteId(null);
    setSyncMessage(null);
    try {
      await api.banking.deleteConnection(id);
      await reload();
    } catch (e) {
      setSyncMessage({ kind: 'error', text: e.message });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <h3><Cloud size={16}/> {t('settings.banks.title')} {loading && <RefreshCw size={12} className="spin" style={{marginLeft:6,opacity:.5}}/>}</h3>
        <button className="primary-btn" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setPicker(true)}>
          <Plus size={13}/> {t('settings.banks.connect')}
        </button>
      </div>

      {syncMessage && (
        <div className="settings-info" style={{
          color: syncMessage.kind === 'error' ? 'var(--danger)' : syncMessage.kind === 'warn' ? 'var(--warning)' : 'var(--success)',
        }}>
          <AlertCircle size={14}/><span>{syncMessage.text}</span>
        </div>
      )}

      {connections.length === 0 && !loading && (
        <div className="empty-mini">
          <Cloud size={24}/>
          <p>{t('settings.banks.empty')}</p>
          <button className="primary-btn" style={{ marginTop: 8 }} onClick={() => setPicker(true)}>
            {t('settings.banks.connectMine')}
          </button>
        </div>
      )}

      <div className="member-list">
        {connections.map((c) => (
          <div key={c.id} className="member-card">
            <span className="member-avatar large" style={{
              background: c.status === 'authorized' ? '#10b981' : c.status === 'error' ? '#ef4444' : '#f59e0b',
            }}>
              {c.bank_name.charAt(0)}
            </span>
            <div className="member-card-info" style={{ flex: 1 }}>
              <div className="member-card-name">{c.bank_name}</div>
              <div className="member-card-role">
                {c.status === 'authorized' ? t('settings.banks.connected') : c.status === 'error' ? t('settings.banks.error') : t('settings.banks.pending')}
                {c.last_synced_at && ` · ${t('settings.banks.syncedAt', { date: new Date(c.last_synced_at).toLocaleDateString() })}`}
                {c.accounts?.length > 0 && ` · ${t('settings.banks.accountsCount', { count: c.accounts.length })}`}
              </div>
              {c.error_message && (
                <div style={{ fontSize: 11, color: 'var(--danger-text)', marginTop: 2 }}>{c.error_message}</div>
              )}
            </div>
            {c.status === 'authorized' && (!c.accounts || c.accounts.length === 0) && (
              <button
                className="primary-btn"
                style={{ fontSize: 11, padding: '5px 12px', whiteSpace: 'nowrap' }}
                onClick={() => handleRefresh(c.id)}
                disabled={refreshingId === c.id}
                title={t('settings.banks.fetchAccountsTitle')}
              >
                <RefreshCw size={12} className={refreshingId === c.id ? 'spin' : ''}/> {t('settings.banks.fetchAccounts')}
              </button>
            )}
            {c.status === 'authorized' && c.accounts?.length > 0 && (
              <button
                className="secondary-btn"
                style={{ fontSize: 11, padding: '5px 10px', whiteSpace: 'nowrap' }}
                onClick={() => handleSync(c.id)}
                disabled={syncingId === c.id}
              >
                <RefreshCw size={12} className={syncingId === c.id ? 'spin' : ''}/> Sync
              </button>
            )}
            {confirmDeleteId === c.id ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t('confirms.confirmShort')}</span>
                <button
                  className="danger-btn"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                >
                  {deletingId === c.id ? <RefreshCw size={11} className="spin"/> : t('actions.yes')}
                </button>
                <button
                  className="secondary-btn"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => setConfirmDeleteId(null)}
                >
                  {t('actions.no')}
                </button>
              </div>
            ) : (
              <button
                className="icon-btn-sm"
                title={t('settings.banks.disconnect')}
                onClick={() => setConfirmDeleteId(c.id)}
                disabled={deletingId === c.id}
              >
                <Unlink size={13}/>
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="settings-footnote" dangerouslySetInnerHTML={{ __html: t('settings.banks.footnote') }} />

      {picker && <BankConnectModal onClose={() => { setPicker(false); reload(); }}/>}
    </section>
  );
}

function MemberEditor({ member, onSave, onCancel }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(member);
  const COLORS = MEMBER_PALETTE;
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{member.id ? t('settings.household.editMember') : t('settings.household.newMember')}</h2>
          <button className="icon-btn-sm" onClick={onCancel}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <label><span>{t('settings.household.firstName')}</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}/></label>
          <label><span>{t('settings.household.role')}</span>
            <ChipSelect
              value={draft.role}
              onChange={(val) => setDraft({ ...draft, role: val })}
              options={[
                { value: 'adult', label: t('settings.household.adult') },
                { value: 'child', label: t('settings.household.child') },
              ]}
            />
          </label>
          <label><span>{t('settings.household.color')}</span>
            <div className="color-picker">
              {COLORS.map(c => (
                <button key={c} className={`color-dot ${draft.color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setDraft({ ...draft, color: c })}/>
              ))}
            </div>
          </label>
        </div>
        <div className="modal-footer">
          <button className="secondary-btn" onClick={onCancel}>{t('actions.cancel')}</button>
          <BusyButton className="primary-btn" onClick={async () => { if (draft.name) await onSave(draft); }}><Check size={14}/> {t('actions.save')}</BusyButton>
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// MY CATEGORIES SECTION — create / delete user-owned categories (level 1 + 2)
// ============================================================================
const CATEGORY_PALETTE = [
  '#2540D9', '#136D3E', '#B0392B', '#8E641A',
  '#7E5A9B', '#C76A8A', '#6B7280', '#0F766E',
  '#A16207', '#9333EA', '#0EA5E9', '#DC2626',
];
const COMMON_ICONS = ['🏷️', '🛒', '🍽️', '🚗', '🏠', '💡', '📱', '🎬', '🎵', '🏥', '🎁', '✈️', '🎓', '👶', '💼', '💰', '☕', '🐶', '🎨', '🛠️'];

function MyCategoriesSection({ categories, reloadCategories, onCategoryCreated, onCategoryDeleted, showToast }) {
  const [creating, setCreating] = useState(null); // null | { parent: string|null }
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const toast = showToast || (() => {}); // safe fallback if not wired

  const topCats = useMemo(
    () => categories.filter(c => !c.parent && c.id !== 'uncategorized'),
    [categories]
  );

  const onDelete = async (slug, label) => {
    if (!window.confirm(`Supprimer « ${label} » ? Les transactions et règles liées seront détachées.`)) return;
    try {
      setBusyId(slug);
      await api.categories.delete(slug);
      // Optimistic local update — instant UI feedback, no wait for refetch.
      if (onCategoryDeleted) onCategoryDeleted(slug);
      toast(`« ${label} » supprimée`, 'success');
      // Background safety re-sync (no await, doesn't block UI).
      if (reloadCategories) reloadCategories();
    } catch (err) {
      setError(err.message || 'Suppression impossible');
      toast(err.message || 'Suppression impossible', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const onCreate = async (draft) => {
    try {
      const created = await api.categories.create({
        name: draft.name,
        color: draft.color,
        icon: draft.icon,
        type: draft.type,
        kind: draft.kind,
        parent_slug: draft.parent_slug || null,
      });
      // Optimistic local update FIRST so the new chip pops in instantly.
      if (onCategoryCreated && created) onCategoryCreated(created);
      setCreating(null);
      setError(null);
      const kindLabel = draft.parent_slug ? 'Détail' : 'Catégorie';
      toast(`${kindLabel} « ${created?.name || draft.name} » créé${draft.parent_slug ? '' : 'e'}`, 'success');
      // Background safety re-sync (no await, doesn't block UI).
      if (reloadCategories) reloadCategories();
    } catch (err) {
      setError(err.message || 'Création impossible');
      toast(err.message || 'Création impossible', 'error');
    }
  };

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <h3><Sparkles size={16}/> Mes catégories</h3>
        <button className="ds-btn" onClick={() => setCreating({ parent: null })}>
          <Plus size={14}/> Catégorie
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '0 0 14px', lineHeight: 1.55, maxWidth: 640 }}>
        Ajoute tes propres catégories (niveau 1) et leurs détails (niveau 2). Les transactions et règles peuvent ensuite cibler n'importe lequel des deux niveaux.
      </p>

      {error && (
        <div style={{ padding: '8px 12px', background: 'var(--danger-soft)', color: 'var(--danger-text)', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
          <AlertCircle size={12} style={{ verticalAlign: 'text-bottom', marginRight: 4 }}/> {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {topCats.map(top => {
          const subs = categories.filter(c => c.parent === top.id);
          return (
            <div key={top.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--bg-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>{top.icon}</span>
                <strong style={{ flex: 1, fontSize: 13.5 }}>{top.name}</strong>
                <span style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-elev)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {top.type === 'income' ? 'Revenu' : top.type === 'transfer' ? 'Virement' : 'Dépense'}
                </span>
                <button className="icon-btn-sm" title="Ajouter un détail" onClick={() => setCreating({ parent: top.id, parentName: top.name, type: top.type })}>
                  <Plus size={13}/>
                </button>
                <button className="icon-btn-sm" title="Supprimer" disabled={busyId === top.id} onClick={() => onDelete(top.id, top.name)}>
                  <Trash2 size={13}/>
                </button>
              </div>
              {subs.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingLeft: 26 }}>
                  {subs.map(sub => (
                    <span key={sub.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, background: 'var(--bg-elev)', border: '1px solid var(--border)', fontSize: 12 }}>
                      {sub.icon} {sub.name}
                      <button className="icon-btn-sm" style={{ padding: 2 }} disabled={busyId === sub.id} onClick={() => onDelete(sub.id, sub.name)}>
                        <X size={11}/>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {creating && (
        <CategoryCreateModal
          parent={creating.parent}
          parentName={creating.parentName}
          forcedType={creating.type}
          onSave={onCreate}
          onCancel={() => setCreating(null)}
        />
      )}
    </section>
  );
}

function CategoryCreateModal({ parent, parentName, forcedType, onSave, onCancel }) {
  const [draft, setDraft] = useState({
    name: '',
    color: CATEGORY_PALETTE[0],
    icon: COMMON_ICONS[0],
    type: forcedType || 'expense',
    kind: 'needs',
    parent_slug: parent || null,
  });
  const canSave = draft.name.trim().length >= 2;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{parent ? <>Nouveau <em>détail</em></> : <>Nouvelle <em>catégorie</em></>}</h2>
          <button className="icon-btn" onClick={onCancel}><X size={18}/></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {parent && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Rattaché à <strong style={{ color: 'var(--ink)' }}>{parentName}</strong></div>
          )}
          <label>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nom</span>
            <input
              type="text"
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder={parent ? 'ex : Vacances été' : 'ex : Mes loisirs'}
              autoFocus
              style={{ width: '100%' }}
            />
          </label>

          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Icône</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COMMON_ICONS.map(ic => (
                <button key={ic} type="button" onClick={() => setDraft({ ...draft, icon: ic })}
                  style={{ width: 30, height: 30, fontSize: 16, borderRadius: 6, border: '1px solid ' + (draft.icon === ic ? 'var(--accent)' : 'var(--border)'), background: draft.icon === ic ? 'var(--accent-soft)' : 'var(--bg-elev)', cursor: 'pointer' }}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Couleur</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORY_PALETTE.map(co => (
                <button key={co} type="button" onClick={() => setDraft({ ...draft, color: co })}
                  style={{ width: 26, height: 26, borderRadius: '50%', border: draft.color === co ? '3px solid var(--ink)' : '1px solid var(--border)', background: co, cursor: 'pointer' }}/>
              ))}
            </div>
          </div>

          {!parent && !forcedType && (
            <label>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Type</span>
              <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })} style={{ width: '100%' }}>
                <option value="expense">Dépense</option>
                <option value="income">Revenu</option>
                <option value="transfer">Virement</option>
              </select>
            </label>
          )}
        </div>
        <div className="modal-footer">
          <button className="secondary-btn" onClick={onCancel}>Annuler</button>
          <button className="primary-btn" disabled={!canSave} onClick={() => onSave(draft)}>
            <Check size={14}/> Créer
          </button>
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// PAYEES SECTION — gestion des marchands canoniques (Actual-style)
//
// Le moteur de catégorisation v2 crée automatiquement un Payee pour chaque
// marchand reconnu (Uber, Franprix, MAIF…). Cette section permet à l'user de :
//   - voir tous les payees de son foyer
//   - renommer / changer la catégorie par défaut
//   - basculer le flag "virement interne" (Revolut/Lydia top-ups)
//   - fusionner deux payees (variantes du même marchand)
//   - supprimer
// ============================================================================
function PayeesSection({ categories, showToast }) {
  const [payees, setPayees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [mergeSrc, setMergeSrc] = useState(null);
  const toast = showToast || (() => {});

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api.payees.list();
      setPayees(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const catBySlug = useMemo(() => {
    const m = {};
    categories.forEach(c => { m[c.id] = c; });
    return m;
  }, [categories]);

  // Le backend renvoie default_category_id (UUID), mais le frontend connaît
  // surtout les slugs. On résout via API ; ici on cherche par id direct.
  const catById = useMemo(() => {
    // Le frontend stocke c.id = slug. Pour matcher l'UUID renvoyé par le
    // backend on aura besoin d'une autre passe — pour l'instant on n'affiche
    // la catégorie que si l'API renvoie un slug (à étendre).
    return {};
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return payees;
    return payees.filter(p => p.name.toLowerCase().includes(q));
  }, [payees, search]);

  const onRename = async (id, name) => {
    try {
      await api.payees.update(id, { name });
      toast(`Renommé en « ${name} »`, 'success');
      setPayees(prev => prev.map(p => p.id === id ? { ...p, name } : p));
      setEditingId(null);
    } catch (err) {
      toast(err.message || 'Renommage impossible', 'error');
    }
  };

  const onToggleTransfer = async (p) => {
    try {
      const next = !p.is_transfer;
      await api.payees.update(p.id, { is_transfer: next });
      toast(next ? '↔ Marqué comme virement interne' : 'Statut transfert retiré', 'success');
      setPayees(prev => prev.map(x => x.id === p.id ? { ...x, is_transfer: next } : x));
    } catch (err) {
      toast(err.message || 'Mise à jour impossible', 'error');
    }
  };

  const onSetDefaultCat = async (p, slug) => {
    try {
      await api.payees.update(p.id, { default_category_slug: slug });
      toast('Catégorie par défaut mise à jour', 'success');
      await refresh();
    } catch (err) {
      toast(err.message || 'Mise à jour impossible', 'error');
    }
  };

  const onDelete = async (p) => {
    if (!window.confirm(`Supprimer « ${p.name} » ? Les transactions liées seront détachées de ce marchand mais conservent leur catégorie.`)) return;
    try {
      await api.payees.delete(p.id);
      toast(`« ${p.name} » supprimé`, 'success');
      setPayees(prev => prev.filter(x => x.id !== p.id));
    } catch (err) {
      toast(err.message || 'Suppression impossible', 'error');
    }
  };

  const onMerge = async (targetId) => {
    if (!mergeSrc || mergeSrc.id === targetId) return;
    try {
      await api.payees.merge(targetId, mergeSrc.id);
      toast(`« ${mergeSrc.name} » fusionné dans le marchand cible`, 'success');
      setMergeSrc(null);
      await refresh();
    } catch (err) {
      toast(err.message || 'Fusion impossible', 'error');
    }
  };

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <h3><Sparkles size={16}/> Marchands canoniques</h3>
        <span className="card-meta">{payees.length} marchand{payees.length > 1 ? 's' : ''}</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '0 0 14px', lineHeight: 1.55, maxWidth: 640 }}>
        Le moteur crée automatiquement un marchand pour chaque enseigne reconnue (Uber, Franprix, MAIF…). Toutes les variantes de libellé (« FRANPRIX LEVALLOIS P », « FRANPRIX 5 RUE… ») pointent dessus.
        Renomme ou fusionne pour requalifier en un seul endroit.
      </p>

      {error && (
        <div style={{ padding: '8px 12px', background: 'var(--danger-soft)', color: 'var(--danger-text)', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
          <AlertCircle size={12} style={{ verticalAlign: 'text-bottom', marginRight: 4 }}/> {error}
        </div>
      )}

      <input
        type="text"
        placeholder="Filtrer les marchands…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 12 }}
      />

      {mergeSrc && (
        <div style={{ padding: 10, background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 6, fontSize: 12, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Fusion : sélectionne le marchand cible pour absorber « <strong>{mergeSrc.name}</strong> » →</span>
          <button onClick={() => setMergeSrc(null)} className="icon-btn-sm" style={{ color: 'inherit' }}>
            <X size={14}/>
          </button>
        </div>
      )}

      {loading ? (
        <div className="empty-mini"><Activity size={20}/><p>Chargement…</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-mini">
          <Sparkles size={22}/>
          <p>{payees.length === 0 ? 'Aucun marchand encore — importe des transactions pour que le moteur en crée.' : 'Aucun marchand ne correspond à la recherche.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(p => {
            const isEditing = editingId === p.id;
            const isMergeTarget = mergeSrc && mergeSrc.id !== p.id;
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: isMergeTarget ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                  borderRadius: 6,
                  border: '1px solid ' + (isMergeTarget ? 'var(--accent)' : 'var(--border)'),
                  cursor: isMergeTarget ? 'pointer' : 'default',
                }}
                onClick={isMergeTarget ? () => onMerge(p.id) : undefined}
              >
                {isEditing ? (
                  <input
                    type="text"
                    defaultValue={p.name}
                    autoFocus
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.name) onRename(p.id, v); else setEditingId(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingId(null); }}
                    style={{ flex: 1, fontSize: 13, fontWeight: 500 }}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                )}
                {p.is_transfer && (
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ↔ Virement
                  </span>
                )}
                {p.created_by && p.created_by !== 'user' && (
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'var(--bg-elev)', color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {p.created_by === 'builtin' ? 'Auto' : p.created_by}
                  </span>
                )}
                {!isMergeTarget && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="icon-btn-sm" title="Renommer" onClick={() => setEditingId(p.id)}>
                      <Edit3 size={13}/>
                    </button>
                    <button className="icon-btn-sm" title={p.is_transfer ? 'Retirer le statut virement' : 'Marquer comme virement interne'} onClick={() => onToggleTransfer(p)}>
                      ↔
                    </button>
                    <button className="icon-btn-sm" title="Fusionner avec un autre marchand…" onClick={() => setMergeSrc(p)}>
                      ⇆
                    </button>
                    <button className="icon-btn-sm" title="Supprimer" onClick={() => onDelete(p)}>
                      <Trash2 size={13}/>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="settings-footnote" style={{ marginTop: 14, fontSize: 11, color: 'var(--ink-3)' }}>
        Tu peux fusionner deux marchands (variantes d'une même enseigne) via le bouton ⇆ — les transactions de la source sont réassignées à la cible.
      </p>
    </section>
  );
}


// ============================================================================
// LEARNING TOGGLE — bascule l'apprentissage auto (Category Learning) on/off
// ============================================================================
function LearningToggle({ showToast }) {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = showToast || (() => {});

  useEffect(() => {
    (async () => {
      try {
        const s = await api.categorizeEngine.getLearningSettings();
        if (s && typeof s.auto_learning_enabled === 'boolean') setEnabled(s.auto_learning_enabled);
      } catch { /* silent — demo mode renvoie null */ }
      setLoading(false);
    })();
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setSaving(true);
    try {
      await api.categorizeEngine.updateLearningSettings(next);
      setEnabled(next);
      toast(next ? '🧠 Apprentissage automatique activé' : 'Apprentissage automatique désactivé', 'success');
    } catch (err) {
      toast(err.message || 'Mise à jour impossible', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
            🧠 Apprentissage automatique
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: '4px 0 0', lineHeight: 1.5, maxWidth: 540 }}>
            Quand tu recatégorises 2 fois le même marchand dans la même catégorie, Wealthly crée automatiquement une règle apprise. Désactive si tu préfères tout gérer manuellement.
          </p>
        </div>
        <button
          type="button"
          className={`learning-toggle-btn ${enabled ? 'on' : 'off'}`}
          onClick={toggle}
          disabled={saving}
          aria-pressed={enabled}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 8,
            background: enabled ? 'var(--accent)' : 'var(--bg-elev)',
            color: enabled ? '#fff' : 'var(--ink-2)',
            border: '1px solid ' + (enabled ? 'var(--accent)' : 'var(--border-strong)'),
            fontWeight: 600, fontSize: 13, cursor: saving ? 'wait' : 'pointer',
            transition: 'background 0.15s, color 0.15s, border-color 0.15s',
          }}
        >
          {saving ? '…' : (enabled ? 'Activé' : 'Désactivé')}
        </button>
      </div>
    </section>
  );
}
