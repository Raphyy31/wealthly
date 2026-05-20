// ComptesSection — Settings > Comptes & synchronisation
// Refonte 2026-05-20 : carte read-only par defaut, accordion editor au clic.
// Lisibilite x3 quand on a 10+ comptes, edition cachee mais accessible.
import { useState, useRef, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, Upload, Edit3, Trash2, ArrowLeftRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { Combobox } from '../../../components/Combobox.jsx';
import { BusyButton } from '../../../components/ui/BusyButton.jsx';
import { ACCOUNT_ROLES, ACCOUNT_ROLE_KEYS, suggestAccountRole, SUPPORTED_CURRENCIES, bankColor } from '../../../utils.js';
import { gsap } from '../../../utils/gsapSetup.js';
import { MergeModal } from '../modals/MergeModal.jsx';
import { BankConnectionsSection } from './BankConnectionsSection.jsx';

const CURRENCY_FLAGS = { EUR: '🇪🇺', USD: '🇺🇸', GBP: '🇬🇧', CHF: '🇨🇭' };

// Role -> couleur de chip
const ROLE_TINT = {
  principal:      { color: 'var(--ink-2)',  bg: 'var(--bg-sunk)' },
  depenses:       { color: 'var(--warning)', bg: 'color-mix(in oklab, var(--warning) 14%, transparent)' },
  epargne:        { color: 'var(--accent)',  bg: 'var(--accent-soft)' },
  investissement: { color: 'var(--accent)',  bg: 'var(--accent-soft)' },
  professionnel:  { color: 'var(--ink-3)',   bg: 'var(--bg-sunk)' },
};

export function ComptesSection({ accounts, accountBalances, members, transactions, updateAccount, deleteAccount, mergeAccounts, fmt, onImport }) {
  const { t } = useTranslation();
  const [mergingId, setMergingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingNameVal, setEditingNameVal] = useState('');

  const commitName = (a) => {
    const trimmed = editingNameVal.trim();
    if (trimmed && trimmed !== a.name) updateAccount(a.id, { name: trimmed });
    setEditingNameId(null);
  };

  return (
    <section className="settings-panel">
      <header>
        <h2>{t('settings.accounts.title')} <em>{t('settings.accounts.titleAccent')}</em></h2>
        <p className="settings-panel-intro">{t('settings.accounts.intro')}</p>
      </header>

      <div className="card">
        <div className="card-header">
          <h3><Wallet size={16}/> {t('settings.accounts.bankAccounts')}</h3>
          {onImport && (
            <button className="secondary-btn" onClick={onImport}><Upload size={14}/> {t('settings.accounts.importCsv')}</button>
          )}
        </div>

        {accounts.length === 0 && (
          <div className="empty-mini" style={{ margin: 24 }}>
            <Wallet size={24}/>
            <p>{t('settings.accounts.emptyAccounts')}</p>
            {onImport && (
              <button className="primary-btn" style={{ marginTop: 12 }} onClick={onImport}>
                <Upload size={14}/> {t('settings.accounts.importCsv')}
              </button>
            )}
          </div>
        )}

        <ul className="acc-list">
          {accounts.map(a => {
            const role = a.role || 'principal';
            const tint = ROLE_TINT[role] || ROLE_TINT.principal;
            const isGocardless = a.source === 'gocardless' || !!a.externalId;
            const accTx = role === 'principal' ? transactions.filter(t => t.accountId === a.id) : [];
            const otherIds = accounts.filter(x => x.id !== a.id).map(x => x.id);
            const suggestion = role === 'principal' ? suggestAccountRole(accTx, otherIds) : null;
            const showSuggestion = suggestion && suggestion.role && suggestion.role !== 'principal' && suggestion.confidence !== 'low';
            const noTxOnGoCardless = isGocardless && (a.source === 'gocardless') && accounts && transactions && transactions.filter(t => t.accountId === a.id).length === 0;
            const isEditing = editingId === a.id;

            return (
              <li key={a.id} className={`acc-row ${isEditing ? 'is-editing' : ''}`}>
                {/* ── read-only header ────────────────────────────────── */}
                <div className="acc-row-head">
                  <span className="acc-avatar" style={{ background: bankColor(a.bank) }}>
                    {(a.name || a.bank || '?').charAt(0).toUpperCase()}
                  </span>

                  <div className="acc-row-identity">
                    <div className="acc-row-line1">
                      {editingNameId === a.id ? (
                        <input
                          autoFocus
                          className="acc-name-input"
                          value={editingNameVal}
                          onChange={e => setEditingNameVal(e.target.value)}
                          onBlur={() => commitName(a)}
                          onKeyDown={e => { if (e.key === 'Enter') commitName(a); if (e.key === 'Escape') setEditingNameId(null); }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="acc-name-btn"
                          onClick={() => { setEditingNameId(a.id); setEditingNameVal(a.name || ''); }}
                          title="Cliquer pour renommer"
                        >
                          {a.name || a.bank}
                          <Edit3 size={11} className="acc-name-edit-ico"/>
                        </button>
                      )}
                      <span
                        className="acc-role-chip"
                        style={{ color: tint.color, background: tint.bg }}
                      >
                        {ACCOUNT_ROLES[role]?.label || role}
                      </span>
                      {a.isJoint && <span className="acc-joint-chip">👪 Joint</span>}
                    </div>
                    <div className="acc-row-line2">
                      <span className="acc-bank">{a.bank}</span>
                      {a.iban && <><span className="acc-sep">·</span><span className="acc-iban">•••• {a.iban.replace(/\s/g, '').slice(-4)}</span></>}
                      <span className="acc-sep">·</span>
                      <span className={`acc-src ${isGocardless ? 'is-gocardless' : ''}`}>
                        {isGocardless ? 'GoCardless' : 'Manuel'}
                      </span>
                      {noTxOnGoCardless && (
                        <span className="acc-warn" title="Aucune transaction récupérée — vérifie la connexion ou les permissions">
                          <AlertTriangle size={11}/> Pas de transactions
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="acc-row-balance">
                    <span className="acc-balance num">{fmt(accountBalances[a.id] || 0)}</span>
                  </div>

                  <button
                    className={`acc-edit-toggle ${isEditing ? 'is-on' : ''}`}
                    onClick={() => setEditingId(isEditing ? null : a.id)}
                    title={isEditing ? 'Fermer' : 'Éditer'}
                    aria-expanded={isEditing}
                  >
                    <ChevronDown size={14} className="acc-edit-chev"/>
                    <span>{isEditing ? 'Fermer' : 'Éditer'}</span>
                  </button>
                </div>

                {/* ── suggestion (always visible, hors edit mode) ─────── */}
                {showSuggestion && !isEditing && (
                  <div className="acc-suggest">
                    <span className="acc-suggest-eyebrow">↪ Suggéré</span>
                    <span className="acc-suggest-text">
                      <strong>{ACCOUNT_ROLES[suggestion.role].label}</strong> — {suggestion.reason}
                    </span>
                    <button className="acc-suggest-apply" onClick={() => updateAccount(a.id, { role: suggestion.role })}>
                      Appliquer
                    </button>
                  </div>
                )}

                {/* ── accordion editor ────────────────────────────────── */}
                <AccountEditor
                  account={a}
                  members={members}
                  isOpen={isEditing}
                  updateAccount={updateAccount}
                  onMerge={() => setMergingId(a.id)}
                  onDelete={() => deleteAccount(a.id)}
                  canMerge={!!mergeAccounts && accounts.length > 1}
                />
              </li>
            );
          })}
        </ul>

        <p className="settings-footnote">
          <strong>Principal</strong> — tout compte.<span className="sep">·</span>
          <strong>Dépenses secondaires</strong> (Revolut…) — seules les sorties comptent.<span className="sep">·</span>
          <strong>Épargne</strong> / <strong>Investissement</strong> — exclus du cashflow, comptent dans le patrimoine.<span className="sep">·</span>
          <strong>Professionnel</strong> — exclu du patrimoine personnel.
        </p>
      </div>

      {mergingId && (
        <MergeModal
          accounts={accounts}
          sourceId={mergingId}
          onClose={() => setMergingId(null)}
          onConfirm={async (targetId, sourceId) => {
            await mergeAccounts(targetId, sourceId);
            setMergingId(null);
          }}
        />
      )}

      <BankConnectionsSection />
    </section>
  );
}

// ─── AccountEditor : body accordion qui revele les controles d'edition ──
// Anime la hauteur via GSAP (mesure scrollHeight, tween en 280ms power3.out).
// Respect prefers-reduced-motion : snap a la valeur finale.
function AccountEditor({ account, members, isOpen, updateAccount, onMerge, onDelete, canMerge }) {
  const wrapRef = useRef(null);
  const contentRef = useRef(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const content = contentRef.current;
    if (!wrap || !content) return;
    const targetH = isOpen ? content.scrollHeight : 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      gsap.set(wrap, { height: targetH, opacity: isOpen ? 1 : 0 });
      return;
    }
    gsap.to(wrap, {
      height: targetH,
      opacity: isOpen ? 1 : 0,
      duration: isOpen ? 0.32 : 0.22,
      ease: isOpen ? 'power3.out' : 'power2.in',
    });
  }, [isOpen, account]);

  const role = account.role || 'principal';

  return (
    <div ref={wrapRef} className="acc-editor-wrap" style={{ height: 0, opacity: 0, overflow: 'hidden' }}>
      <div ref={contentRef} className="acc-editor">
        {/* Titulaires */}
        {members.length > 0 && (
          <div className="acc-editor-row">
            <span className="acc-editor-label">Titulaires</span>
            <div className="acc-editor-members">
              {members.map(m => {
                const assigned = (account.memberIds || []).includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`acc-member-chip ${assigned ? 'is-on' : ''}`}
                    style={{
                      borderColor: assigned ? m.color : 'var(--border)',
                      background: assigned ? m.color + '18' : 'transparent',
                      color: assigned ? m.color : 'var(--ink-3)',
                    }}
                    onClick={() => updateAccount(account.id, {
                      memberIds: assigned ? (account.memberIds || []).filter(id => id !== m.id) : [...(account.memberIds || []), m.id]
                    })}
                  >
                    <span className="acc-member-avatar" style={{ background: assigned ? m.color : 'var(--border-strong)', color: assigned ? '#fff' : 'var(--ink-3)' }}>
                      {m.name.charAt(0).toUpperCase()}
                    </span>
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Settings principaux : Joint / Role / Devise */}
        <div className="acc-editor-row">
          <span className="acc-editor-label">Paramètres</span>
          <div className="acc-editor-controls">
            <button
              type="button"
              className={`acc-joint-toggle ${account.isJoint ? 'is-on' : ''}`}
              onClick={() => updateAccount(account.id, { isJoint: !account.isJoint })}
              title={account.isJoint ? 'Retirer le statut joint' : 'Marquer comme compte joint'}
            >
              👪 Joint
            </button>
            <Combobox
              width={170}
              value={role}
              onChange={val => updateAccount(account.id, { role: val })}
              options={ACCOUNT_ROLE_KEYS.map(k => ({
                value: k,
                label: ACCOUNT_ROLES[k].label,
                meta: ACCOUNT_ROLES[k].desc.split('—')[0].trim(),
              }))}
            />
            <Combobox
              width={96}
              value={account.currency || 'EUR'}
              onChange={val => updateAccount(account.id, { currency: val })}
              options={SUPPORTED_CURRENCIES.map(c => ({ value: c, label: `${CURRENCY_FLAGS[c]} ${c}` }))}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="acc-editor-row acc-editor-actions">
          {canMerge && (
            <button className="secondary-btn" onClick={onMerge}>
              <ArrowLeftRight size={12}/> Fusionner avec…
            </button>
          )}
          <BusyButton
            className="danger-btn"
            onClick={onDelete}
            spinnerSize={13}
          >
            <Trash2 size={12}/> Supprimer ce compte
          </BusyButton>
        </div>
      </div>
    </div>
  );
}
