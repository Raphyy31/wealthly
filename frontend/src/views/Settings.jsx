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
import { ACCOUNT_ROLES, ACCOUNT_ROLE_KEYS, suggestAccountRole, SUPPORTED_CURRENCIES } from '../utils.js';
import { BankConnectModal } from '../components/BankConnectModal.jsx';

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

export function SettingsView({ members, accounts, accountBalances, saveMember, deleteMember, deleteAccount, updateAccount, transactions = [], exportData, importData, resetAllData, categories = [], fmt, baseCurrency = 'EUR', setBaseCurrency, rates, ratesDate, currentUser, onImport }) {
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
  const initials = (currentUser?.full_name || currentUser?.email || '?')
    .split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
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
              <button className="icon-btn-sm" onClick={() => deleteMember(m.id)}><Trash2 size={13}/></button>
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
                <span className="member-avatar large" style={{ background: 'var(--info)' }}>{a.bank?.charAt(0) || '?'}</span>
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
                <button className="icon-btn-sm" onClick={() => deleteAccount(a.id)}><Trash2 size={13}/></button>
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
  const onReset = () => {
    if (!window.confirm(t('confirms.resetSettings1'))) return;
    if (!window.confirm(t('confirms.resetSettings2'))) return;
    resetAllData && resetAllData();
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
        <button className="danger-btn" onClick={onReset}>
          <Trash2 size={14}/> {t('settings.data.resetAll')}
        </button>
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
  const [newCategory, setNewCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type !== 'income'),
    [categories]
  );

  const onAdd = async (e) => {
    e.preventDefault();
    if (!newPattern.trim() || !newCategory) return;
    try {
      setSubmitting(true);
      // Validate the regex client-side first — fail fast with a clear message.
      try { new RegExp(newPattern, 'i'); } catch (re) {
        setError(t('settings.rules.invalidRegex', { message: re.message }));
        setSubmitting(false);
        return;
      }
      await api.rules.create({ pattern: newPattern.trim(), category_slug: newCategory });
      setNewPattern('');
      setNewCategory('');
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

      {/* Add form */}
      <form onSubmit={onAdd} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={newPattern}
          onChange={(e) => setNewPattern(e.target.value)}
          placeholder={t('settings.rules.patternPh')}
          style={{ flex: '2 1 220px', minWidth: 0 }}
        />
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <Combobox
            value={newCategory}
            onChange={(val) => setNewCategory(val)}
            placeholder={t('settings.rules.targetCategory')}
            options={[
              { value: '', label: t('settings.rules.targetCategory') },
              ...expenseCategories.map(c => ({ value: c.id, label: c.name, icon: c.icon })),
            ]}
          />
        </div>
        <button
          type="submit"
          className="primary-btn"
          disabled={submitting || !newPattern.trim() || !newCategory}
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
          {rules.map((r) => {
            const slug = r.category_slug || r.categoryId;
            const cat = categories.find((c) => c.id === slug);
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
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: (cat?.color || '#999') + '22',
                    color: cat?.color || 'var(--text-secondary)',
                    fontSize: 11,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat?.icon} {cat?.name || slug}
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
          <button className="primary-btn" onClick={() => { if (draft.name) onSave(draft); }}><Check size={14}/> {t('actions.save')}</button>
        </div>
      </div>
    </div>
  );
}
