// Source: Settings.jsx lines 332-600 — ComptesSection (+ MergeModal used internally)
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, Upload, Edit3, Trash2, ArrowLeftRight } from 'lucide-react';
import { Combobox } from '../../../components/Combobox.jsx';
import { BusyButton } from '../../../components/ui/BusyButton.jsx';
import { BankConnectModal } from '../../../components/BankConnectModal.jsx';
import { ACCOUNT_ROLES, ACCOUNT_ROLE_KEYS, suggestAccountRole, SUPPORTED_CURRENCIES, bankColor } from '../../../utils.js';
import { MergeModal } from '../modals/MergeModal.jsx';
import { BankConnectionsSection } from './BankConnectionsSection.jsx';

const CURRENCY_FLAGS = { EUR: '🇪🇺', USD: '🇺🇸', GBP: '🇬🇧', CHF: '🇨🇭' };

export function ComptesSection({ accounts, accountBalances, members, transactions, updateAccount, deleteAccount, mergeAccounts, fmt, onImport }) {
  const { t } = useTranslation();
  const [mergingId, setMergingId] = useState(null);
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
            const role = a.role || 'principal';
            const isGocardless = a.source === 'gocardless' || !!a.externalId;
            const accTx = role === 'principal' ? transactions.filter(t => t.accountId === a.id) : [];
            const otherIds = accounts.filter(x => x.id !== a.id).map(x => x.id);
            const suggestion = role === 'principal' ? suggestAccountRole(accTx, otherIds) : null;
            const showSuggestion = suggestion && suggestion.role && suggestion.role !== 'principal' && suggestion.confidence !== 'low';
            return (
              <div key={a.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>

                {/* ── identité ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="member-avatar large" style={{ background: bankColor(a.bank), flexShrink: 0 }}>
                    {(a.name || a.bank || '?').charAt(0).toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {editingNameId === a.id ? (
                        <input
                          autoFocus
                          value={editingNameVal}
                          onChange={e => setEditingNameVal(e.target.value)}
                          onBlur={() => commitName(a)}
                          onKeyDown={e => { if (e.key === 'Enter') commitName(a); if (e.key === 'Escape') setEditingNameId(null); }}
                          style={{ fontWeight:600, fontSize:14, color:'var(--ink)', border:'none', borderBottom:'1.5px solid var(--accent)', background:'transparent', outline:'none', padding:'0 2px', minWidth:60, maxWidth:200 }}
                        />
                      ) : (
                        <button type="button" onClick={() => { setEditingNameId(a.id); setEditingNameVal(a.name || ''); }}
                          title="Cliquer pour renommer"
                          style={{ fontWeight:600, fontSize:14, color:'var(--ink)', background:'none', border:'none', padding:0, cursor:'text', textAlign:'left' }}>
                          {a.name || a.bank}
                          <Edit3 size={11} style={{ marginLeft:5, color:'var(--ink-3)', verticalAlign:'middle' }}/>
                        </button>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, letterSpacing: '.3px',
                        background: isGocardless ? 'var(--accent-soft)' : 'var(--bg-sunk)',
                        color: isGocardless ? 'var(--accent)' : 'var(--ink-3)' }}>
                        {isGocardless ? 'GoCardless' : 'Manuel'}
                      </span>
                      {a.isJoint && <span className="acc-joint-chip">👪 Joint</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                      {a.bank}{a.iban ? ` · •••• ${a.iban.replace(/\s/g, '').slice(-4)}` : ''}
                    </div>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', flexShrink: 0 }}>
                    {fmt(accountBalances[a.id] || 0)}
                  </span>
                </div>

                {/* ── membres ── */}
                {members.length > 0 && updateAccount && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, paddingLeft: 52, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Titulaires :</span>
                    {members.map(m => {
                      const assigned = (a.memberIds || []).includes(m.id);
                      return (
                        <button key={m.id} type="button"
                          onClick={() => updateAccount(a.id, { memberIds: assigned ? (a.memberIds||[]).filter(id=>id!==m.id) : [...(a.memberIds||[]),m.id] })}
                          style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 8px 2px 4px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight: assigned?600:400,
                            border:`1.5px solid ${assigned?m.color:'var(--border)'}`,
                            background: assigned?m.color+'18':'transparent',
                            color: assigned?m.color:'var(--ink-3)' }}>
                          <span style={{ width:16,height:16,borderRadius:'50%',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,
                            background:assigned?m.color:'var(--border-strong)', color:assigned?'#fff':'var(--ink-3)' }}>
                            {m.name.charAt(0).toUpperCase()}
                          </span>
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ── contrôles inline ── */}
                {updateAccount && (
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10, paddingLeft:52, flexWrap:'wrap' }}>
                    <button type="button"
                      className={`acc-joint-toggle ${a.isJoint?'is-on':''}`}
                      onClick={() => updateAccount(a.id,{isJoint:!a.isJoint})}
                      title={a.isJoint?'Retirer le statut joint':'Marquer comme compte joint'}>
                      👪 Joint
                    </button>
                    <Combobox width={148} value={role}
                      onChange={val => updateAccount(a.id,{role:val})}
                      options={ACCOUNT_ROLE_KEYS.map(k=>({value:k,label:ACCOUNT_ROLES[k].label,meta:ACCOUNT_ROLES[k].desc.split('—')[0].trim()}))}/>
                    <Combobox width={90} value={a.currency||'EUR'}
                      onChange={val => updateAccount(a.id,{currency:val})}
                      options={SUPPORTED_CURRENCIES.map(c=>({value:c,label:`${CURRENCY_FLAGS[c]} ${c}`}))}/>
                    <div style={{flex:1}}/>
                    {mergeAccounts && accounts.length > 1 && (
                      <button className="secondary-btn"
                        style={{fontSize:12,padding:'4px 10px',display:'flex',alignItems:'center',gap:5}}
                        onClick={() => setMergingId(a.id)}>
                        <ArrowLeftRight size={12}/> Fusionner
                      </button>
                    )}
                    <BusyButton className="icon-btn-sm" iconOnly spinnerSize={13} onClick={() => deleteAccount(a.id)} title="Supprimer">
                      <Trash2 size={13}/>
                    </BusyButton>
                  </div>
                )}

                {showSuggestion && (
                  <div style={{marginTop:8,paddingLeft:52,fontSize:11.5,fontStyle:'italic',fontFamily:"'Newsreader',Georgia,serif",color:'var(--ink-3)'}}>
                    <span style={{color:'var(--accent)',fontStyle:'normal',fontFamily:'inherit'}}>↪ Suggéré : {ACCOUNT_ROLES[suggestion.role].label}</span> — {suggestion.reason}{' '}
                    <button onClick={() => updateAccount(a.id,{role:suggestion.role})} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',textDecoration:'underline',padding:0,fontSize:11.5,fontStyle:'normal',fontFamily:'inherit'}}>
                      Appliquer
                    </button>
                  </div>
                )}
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
