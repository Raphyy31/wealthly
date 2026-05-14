// ============================================================================
// Settings — household, accounts, custom rules, bank connections, data tools
//
// Bundles SettingsView + the 4 sub-components it owns: CustomRulesSection,
// BankConnectionsSection, InstitutionPicker (modal), MemberEditor (modal).
// All read/write through the api module; the parent only passes data + a few
// CRUD callbacks.
// ============================================================================
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  { id: 'profil',     icon: User,     label: 'Profil' },
  { id: 'foyer',      icon: Users,    label: 'Foyer' },
  { id: 'comptes',    icon: Wallet,   label: 'Comptes & synchronisation' },
  { id: 'securite',   icon: Shield,   label: 'Sécurité' },
  { id: 'regles',     icon: Sparkles, label: 'Catégories & règles' },
  { id: 'devises',    icon: Globe,    label: 'Devises & langue' },
  { id: 'donnees',    icon: Database, label: 'Données' },
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
        <nav className="settings-rail" aria-label="Sections des réglages">
          {SETTINGS_SECTIONS.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                className={`settings-rail-item${activeSection === s.id ? ' active' : ''}`}
                onClick={() => goTo(s.id)}
              >
                <Icon size={15}/> <span>{s.label}</span>
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
                <h2>Catégories & <em>règles.</em></h2>
                <p className="settings-panel-intro">
                  Définis des règles de catégorisation pour tes transactions. Chaque règle est une regex insensible à la casse, testée sur le libellé.
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
  const { i18n: i18nHook } = useTranslation();
  const initials = (currentUser?.full_name || currentUser?.email || '?')
    .split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const currentLang = (i18nHook.resolvedLanguage || i18nHook.language || 'fr').slice(0, 2);

  return (
    <section className="settings-panel">
      <header>
        <h2>Votre <em>profil.</em></h2>
        <p className="settings-panel-intro">Les informations qui identifient votre compte Wealthly.</p>
      </header>

      <div className="card">
        <div className="settings-profile-card">
          <span className="settings-profile-avatar">{initials}</span>
          <div className="settings-profile-meta">
            <div className="settings-profile-name">
              {currentUser?.full_name || (currentUser?.email ? currentUser.email.split('@')[0] : 'Utilisateur')}
            </div>
            <div className="settings-profile-email">{currentUser?.email || 'Mode démo'}</div>
          </div>
        </div>

        <div className="settings-field-row">
          <div>
            <div className="settings-field-label">Nom complet</div>
            <div className="settings-field-hint">Bientôt modifiable depuis cette page.</div>
          </div>
          <div className="settings-field-control">
            <button className="secondary-btn" disabled>
              <Edit3 size={13}/> Changer mon nom
            </button>
          </div>
        </div>

        <div className="settings-field-row">
          <div>
            <div className="settings-field-label">Langue de l'interface</div>
            <div className="settings-field-hint">Affecte les libellés et formats de date.</div>
          </div>
          <div className="settings-field-control">
            <select
              value={currentLang}
              onChange={(e) => i18nHook.changeLanguage(e.target.value)}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div className="settings-field-row">
          <div>
            <div className="settings-field-label">Devise de référence</div>
            <div className="settings-field-hint">Convertit l'ensemble du patrimoine et du cashflow.</div>
          </div>
          <div className="settings-field-control">
            <select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency && setBaseCurrency(e.target.value)}
              disabled={!setBaseCurrency}
            >
              {SUPPORTED_CURRENCIES.map(c => (
                <option key={c} value={c}>{CURRENCY_FLAGS[c]} {c} — {CURRENCY_NAMES[c]}</option>
              ))}
            </select>
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
  return (
    <section className="settings-panel">
      <header>
        <h2>Votre <em>foyer.</em></h2>
        <p className="settings-panel-intro">
          Ajoute les adultes et enfants qui partagent ton patrimoine — utilisé pour répartir transactions et budgets.
        </p>
      </header>

      <div className="card">
        <div className="card-header">
          <h3><Users size={16}/> Membres du foyer</h3>
          <button
            className="secondary-btn"
            onClick={() => setEditingMember({ id: null, name: '', role: 'adult', color: COLORS[members.length % COLORS.length] })}
          >
            <Plus size={14}/> Ajouter
          </button>
        </div>
        <div className="member-list">
          {members.length === 0 && (
            <div className="empty-mini">
              <Users size={24}/>
              <p>Aucun membre encore. Ajoute-toi pour commencer.</p>
            </div>
          )}
          {members.map(m => (
            <div key={m.id} className="member-card">
              <span className="member-avatar large" style={{ background: m.color }}>{m.name.charAt(0).toUpperCase()}</span>
              <div className="member-card-info">
                <div className="member-card-name">{m.name}</div>
                <div className="member-card-role">{m.role === 'adult' ? 'Adulte' : 'Enfant'}</div>
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
  return (
    <section className="settings-panel">
      <header>
        <h2>Comptes & <em>synchronisation.</em></h2>
        <p className="settings-panel-intro">
          Tes comptes bancaires et leurs connexions automatiques via GoCardless. Connecte une banque, ou importe un CSV pour démarrer.
        </p>
      </header>

      <div className="card">
        <div className="card-header">
          <h3><Wallet size={16}/> Comptes bancaires</h3>
          {onImport && (
            <button className="secondary-btn" onClick={onImport}><Upload size={14}/> Importer un CSV</button>
          )}
        </div>
        <div className="member-list">
          {accounts.length === 0 && (
            <div className="empty-mini">
              <Wallet size={24}/>
              <p>Aucun compte pour le moment. Connecte une banque ci-dessous ou importe un CSV.</p>
              {onImport && (
                <button className="primary-btn" style={{ marginTop: 12 }} onClick={onImport}>
                  <Upload size={14}/> Importer un CSV
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
                      <span style={{ color: 'var(--primary)', fontStyle: 'normal', fontFamily: 'inherit' }}>↪ Suggéré : {ACCOUNT_ROLES[suggestion.role].label}</span> — {suggestion.reason}{' '}
                      <button
                        onClick={() => updateAccount(a.id, { role: suggestion.role })}
                        style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: 11.5, fontStyle: 'normal', fontFamily: 'inherit' }}
                      >
                        Appliquer
                      </button>
                    </div>
                  )}
                </div>
                {updateAccount && (
                  <div className="member-card-actions">
                    <select
                      value={role}
                      onChange={(e) => updateAccount(a.id, { role: e.target.value })}
                      title={roleMeta.desc}
                    >
                      {ACCOUNT_ROLE_KEYS.map(k => (
                        <option key={k} value={k}>{ACCOUNT_ROLES[k].label}</option>
                      ))}
                    </select>
                    <select
                      value={a.currency || 'EUR'}
                      onChange={(e) => updateAccount(a.id, { currency: e.target.value })}
                      title="Devise du compte"
                    >
                      {SUPPORTED_CURRENCIES.map(c => (
                        <option key={c} value={c}>{CURRENCY_FLAGS[c]} {c}</option>
                      ))}
                    </select>
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
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    if (!currentPwd) return setError('Renseigne ton mot de passe actuel.');
    if (newPwd.length < 10) return setError('Le nouveau mot de passe doit faire au moins 10 caractères.');
    if (!/[a-zA-Z]/.test(newPwd) || !/\d/.test(newPwd)) return setError('Le nouveau mot de passe doit contenir au moins une lettre et un chiffre.');
    if (newPwd !== confirmPwd) return setError('La confirmation ne correspond pas au nouveau mot de passe.');
    if (newPwd === currentPwd) return setError('Le nouveau mot de passe doit être différent de l\'actuel.');
    setSubmitting(true);
    try {
      await api.auth.changePassword(currentPwd, newPwd);
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err?.message || 'Échec du changement de mot de passe.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
            Changer le <em style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontWeight: 400 }}>mot de passe.</em>
          </h2>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>
        {success ? (
          <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
            <p style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 22, color: 'var(--positive)', margin: '0 0 12px' }}>
              Mot de passe mis à jour ✓
            </p>
          </div>
        ) : (
          <div className="modal-body">
            <div className="form-row">
              <label className="form-label">Mot de passe actuel</label>
              <input className="form-input" type="password" value={currentPwd}
                     onChange={e => setCurrentPwd(e.target.value)} autoFocus autoComplete="current-password"/>
            </div>
            <div className="form-row">
              <label className="form-label">Nouveau mot de passe</label>
              <input className="form-input" type="password" value={newPwd}
                     onChange={e => setNewPwd(e.target.value)} autoComplete="new-password"
                     placeholder="≥ 10 caractères, lettres + chiffres"/>
            </div>
            <div className="form-row">
              <label className="form-label">Confirmation</label>
              <input className="form-input" type="password" value={confirmPwd}
                     onChange={e => setConfirmPwd(e.target.value)} autoComplete="new-password"
                     onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}/>
            </div>
            {error && <div className="form-error">⚠︎ {error}</div>}
            <div className="modal-foot">
              <button className="secondary-btn" onClick={onClose} type="button">Annuler</button>
              <button className="primary-btn" disabled={submitting} onClick={submit} type="button">
                {submitting ? 'Mise à jour…' : 'Mettre à jour'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SecuriteSection({ currentUser }) {
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
        <h2>Votre <em>sécurité.</em></h2>
        <p className="settings-panel-intro">
          Gère l'accès à ton compte et surveille les connexions récentes.
        </p>
      </header>

      <div className="card">
        <div className="settings-field-row">
          <div>
            <div className="settings-field-label">Mot de passe</div>
            <div className="settings-field-hint">Change ton mot de passe régulièrement pour rester en sécurité.</div>
          </div>
          <div className="settings-field-control">
            <button className="secondary-btn" onClick={() => setShowPwdModal(true)}>
              Changer mon mot de passe
            </button>
          </div>
        </div>

        <div className="settings-field-row">
          <div>
            <div className="settings-field-label">Authentification à 2 facteurs (2FA)</div>
            <div className="settings-field-hint">Une couche de sécurité supplémentaire via une app TOTP.</div>
          </div>
          <div className="settings-field-control">
            <span className="settings-coming-soon-badge">Bientôt</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3><Activity size={16}/> Activité de connexion récente</h3>
        </div>
        {!currentUser?.is_admin || eventsError ? (
          <p className="settings-panel-intro" style={{ margin: 0 }}>À venir — l'historique de tes connexions sera bientôt disponible ici.</p>
        ) : events === null ? (
          <p className="settings-panel-intro" style={{ margin: 0 }}>Chargement…</p>
        ) : events.length === 0 ? (
          <p className="settings-panel-intro" style={{ margin: 0 }}>Aucune activité récente détectée.</p>
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
  const { i18n: i18nHook } = useTranslation();
  const currentLang = (i18nHook.resolvedLanguage || i18nHook.language || 'fr').slice(0, 2);
  return (
    <section className="settings-panel">
      <header>
        <h2>Devises & <em>langue.</em></h2>
        <p className="settings-panel-intro">
          La devise de référence pilote tout le patrimoine et le cashflow. La langue change les libellés de l'interface.
        </p>
      </header>

      <div className="card">
        <div className="settings-field-row">
          <div>
            <div className="settings-field-label">Devise de référence</div>
            <div className="settings-field-hint">
              {ratesDate ? `Taux EUR/USD/GBP/CHF mis à jour le ${new Date(ratesDate).toLocaleDateString('fr-FR')}.` : 'Tous les comptes seront convertis dans cette devise.'}
            </div>
          </div>
          <div className="settings-field-control">
            <select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency && setBaseCurrency(e.target.value)}
              disabled={!setBaseCurrency}
            >
              {SUPPORTED_CURRENCIES.map(c => (
                <option key={c} value={c}>{CURRENCY_FLAGS[c]} {c} — {CURRENCY_NAMES[c]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="settings-field-row">
          <div>
            <div className="settings-field-label">Langue de l'interface</div>
            <div className="settings-field-hint">Bascule l'application en français ou en anglais.</div>
          </div>
          <div className="settings-field-control">
            <select
              value={currentLang}
              onChange={(e) => i18nHook.changeLanguage(e.target.value)}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
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
  const onReset = () => {
    if (!window.confirm('Réinitialiser TOUTES tes données ? Cette action est irréversible. Pense à exporter un backup avant.')) return;
    if (!window.confirm('Dernière confirmation — toutes tes transactions, comptes, patrimoine et règles vont être effacés. Continuer ?')) return;
    resetAllData && resetAllData();
  };
  return (
    <section className="settings-panel">
      <header>
        <h2>Vos <em>données.</em></h2>
        <p className="settings-panel-intro">
          Exporte un backup avant chaque migration ou changement d'instance. Tu peux ré-importer un fichier JSON à tout moment.
        </p>
      </header>

      <div className="card">
        <div className="card-header"><h3><Database size={16}/> Sauvegarde & restauration</h3></div>
        <div className="settings-buttons">
          <button className="secondary-btn" onClick={exportData}><Download size={14}/> Exporter (backup JSON)</button>
          <label className="secondary-btn" style={{ cursor: 'pointer' }}>
            <Upload size={14}/> Importer un backup
            <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }}/>
          </label>
        </div>
        <p className="settings-footnote">
          Le backup contient tes comptes, transactions, patrimoine, budgets, règles et préférences. Aucun mot de passe.
        </p>
      </div>

      <div className="settings-danger-zone">
        <h3>Zone dangereuse</h3>
        <p>
          Réinitialise complètement Wealthly. Cette action efface tous tes comptes, transactions, actifs, dettes, règles et budgets. Elle est <strong>irréversible</strong>.
        </p>
        <button className="danger-btn" onClick={onReset}>
          <Trash2 size={14}/> Réinitialiser toutes mes données
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
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

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
        setError(`Regex invalide : ${re.message}`);
        setSubmitting(false);
        return;
      }
      await api.rules.create({ pattern: newPattern.trim(), category_slug: newCategory });
      setNewPattern('');
      setNewCategory('');
      setError(null);
      await refresh();
    } catch (err) {
      setError(err.message || "Impossible d'ajouter la règle");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Supprimer cette règle ?')) return;
    try {
      await api.rules.delete(id);
      await refresh();
    } catch (err) {
      setError(err.message || 'Suppression impossible');
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <h3><Sparkles size={16}/> Règles de catégorisation</h3>
        <span className="card-meta">{rules.length} règle{rules.length > 1 ? 's' : ''}</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '0 0 14px', lineHeight: 1.55, maxWidth: 640 }}>
        Apprenez au catégoriseur à reconnaître vos marchands habituels. Chaque règle est une expression régulière insensible à la casse, testée sur le libellé.
      </p>

      {/* Add form */}
      <form onSubmit={onAdd} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={newPattern}
          onChange={(e) => setNewPattern(e.target.value)}
          placeholder="ex : boulangerie martin|martin patisser"
          style={{ flex: '2 1 220px', minWidth: 0 }}
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          style={{ flex: '1 1 160px', minWidth: 0 }}
        >
          <option value="">Catégorie cible…</option>
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <button
          type="submit"
          className="primary-btn"
          disabled={submitting || !newPattern.trim() || !newCategory}
        >
          <Plus size={14}/> Ajouter
        </button>
      </form>

      {error && (
        <div style={{ padding: '8px 12px', background: 'var(--danger-soft)', color: 'var(--danger-text)', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
          <AlertCircle size={12} style={{ verticalAlign: 'text-bottom', marginRight: 4 }}/>
          {error}
        </div>
      )}

      {loading ? (
        <div className="empty-mini"><Activity size={20}/><p>Chargement…</p></div>
      ) : rules.length === 0 ? (
        <div className="empty-mini">
          <Sparkles size={22}/>
          <p>Aucune règle personnalisée. Ajoute-en une ci-dessus pour qu'un libellé spécifique aille toujours dans la bonne catégorie.</p>
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
                <button className="icon-btn-sm" onClick={() => onDelete(r.id)} title="Supprimer">
                  <Trash2 size={13}/>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="settings-footnote">
        Sépare plusieurs marchands avec le pipe <code>|</code> — <code>amazon|amzn|amz</code> couvre les 3 variantes. Les règles s'appliquent à toute nouvelle transaction importée et au bouton « Recatégoriser ».
      </p>
    </section>
  );
}

// ============================================================================
// BANK CONNECTIONS SECTION (GoCardless)
// ============================================================================
function BankConnectionsSection() {
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
          ? `${res.imported} importées · ${res.skipped} ignorées · erreurs : ${res.errors.join(', ')}`
          : `✅ ${res.imported} nouvelle${res.imported > 1 ? 's' : ''} transaction${res.imported > 1 ? 's' : ''}, ${res.skipped} ignorée${res.skipped > 1 ? 's' : ''}`,
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
        setSyncMessage({ kind: 'ok', text: `✅ ${res.accounts.length} compte(s) récupéré(s). Cliquez sur "Sync" pour importer les transactions.` });
      } else {
        const debugKeys = res.debug_raw_keys ? ` (clés EB : ${res.debug_raw_keys.join(', ')})` : '';
        setSyncMessage({ kind: 'warn', text: `Requisition GoCardless : ${res.session_status || '?'} — aucun compte retourné.${debugKeys} Reconnectez la banque pour relancer le consentement.` });
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
        <h3><Cloud size={16}/> Synchro bancaire (GoCardless) {loading && <RefreshCw size={12} className="spin" style={{marginLeft:6,opacity:.5}}/>}</h3>
        <button className="primary-btn" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setPicker(true)}>
          <Plus size={13}/> Connecter une banque
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
          <p>Aucune banque connectée. Connectez votre banque pour importer les transactions automatiquement.</p>
          <button className="primary-btn" style={{ marginTop: 8 }} onClick={() => setPicker(true)}>
            Connecter ma banque
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
                {c.status === 'authorized' ? '✅ Connecté' : c.status === 'error' ? '❌ Erreur' : '⏳ En attente'}
                {c.last_synced_at && ` · Synchro ${new Date(c.last_synced_at).toLocaleDateString('fr-FR')}`}
                {c.accounts?.length > 0 && ` · ${c.accounts.length} compte(s)`}
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
                title="Récupérer la liste des comptes depuis GoCardless"
              >
                <RefreshCw size={12} className={refreshingId === c.id ? 'spin' : ''}/> Récupérer les comptes
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
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Confirmer ?</span>
                <button
                  className="danger-btn"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                >
                  {deletingId === c.id ? <RefreshCw size={11} className="spin"/> : 'Oui'}
                </button>
                <button
                  className="secondary-btn"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => setConfirmDeleteId(null)}
                >
                  Non
                </button>
              </div>
            ) : (
              <button
                className="icon-btn-sm"
                title="Déconnecter"
                onClick={() => setConfirmDeleteId(c.id)}
                disabled={deletingId === c.id}
              >
                <Unlink size={13}/>
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="settings-footnote">
        Connexion sécurisée via <strong>GoCardless</strong> (PSD2 open banking). Vos identifiants bancaires ne transitent pas par Wealthly.
      </p>

      {picker && <BankConnectModal onClose={() => { setPicker(false); reload(); }}/>}
    </section>
  );
}

function MemberEditor({ member, onSave, onCancel }) {
  const [draft, setDraft] = useState(member);
  const COLORS = MEMBER_PALETTE;
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{member.id ? 'Modifier le membre' : 'Nouveau membre'}</h2>
          <button className="icon-btn-sm" onClick={onCancel}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <label><span>Prénom</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}/></label>
          <label><span>Rôle</span>
            <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
              <option value="adult">Adulte</option>
              <option value="child">Enfant</option>
            </select>
          </label>
          <label><span>Couleur</span>
            <div className="color-picker">
              {COLORS.map(c => (
                <button key={c} className={`color-dot ${draft.color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setDraft({ ...draft, color: c })}/>
              ))}
            </div>
          </label>
        </div>
        <div className="modal-footer">
          <button className="secondary-btn" onClick={onCancel}>Annuler</button>
          <button className="primary-btn" onClick={() => { if (draft.name) onSave(draft); }}><Check size={14}/> Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
