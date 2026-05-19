// Source: Settings.jsx lines 1391-1576 — BankConnectionsSection
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, Plus, RefreshCw, AlertCircle, Unlink, Activity } from 'lucide-react';
import * as api from '../../../api.js';
import { BankConnectModal } from '../../../components/BankConnectModal.jsx';

// Parse defensif d'un ISO timestamp en UTC. Si la string n'a pas de suffix
// Z ni d'offset (+HH:MM), JS la traite comme local time -> ecart de 1-2h
// pendant l'heure d'ete francaise. Bug remonte par user 2026-05-19
// ("sync il y a 5 min affiche il y a 2h"). Le backend envoie maintenant
// avec Z mais on garde le defensif pour les anciennes valeurs en cache.
function parseUtcIso(isoStr) {
  if (!isoStr) return null;
  const s = String(isoStr);
  // Detecte la presence d'un suffix timezone (Z ou +HH:MM ou -HH:MM).
  // Si absent, on suffixe Z pour forcer une lecture UTC.
  const hasTz = /[Z]$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + 'Z');
}

// Helper "il y a Xj/Xh" pour rendre les dates de sync lisibles instantanément.
function relativeTime(isoStr) {
  const d0 = parseUtcIso(isoStr);
  if (!d0 || Number.isNaN(d0.getTime())) return 'jamais';
  const diffMs = Date.now() - d0.getTime();
  // Clamp negatif (clock skew leger) sur "a l'instant" plutot que "il y a -1 min".
  if (diffMs < 0) return 'à l\'instant';
  const min = Math.floor(diffMs / 60000);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (min < 1) return 'à l\'instant';
  if (min < 60) return `il y a ${min} min`;
  if (h < 24) return `il y a ${h} h`;
  if (d < 7) return `il y a ${d} ${d > 1 ? 'jours' : 'jour'}`;
  return `il y a ${Math.floor(d / 7)} sem.`;
}

// Stale = sync date > 24h. Critical = > 7 jours.
function syncFreshness(isoStr) {
  const d0 = parseUtcIso(isoStr);
  if (!d0 || Number.isNaN(d0.getTime())) return 'never';
  const ageH = (Date.now() - d0.getTime()) / 3600000;
  if (ageH > 168) return 'critical';
  if (ageH > 24) return 'stale';
  return 'fresh';
}

export function BankConnectionsSection() {
  const { t } = useTranslation();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [refreshingId, setRefreshingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [syncMessage, setSyncMessage] = useState(null);
  const [diagId, setDiagId] = useState(null);          // connection actuellement en cours de diagnostic
  const [diagResult, setDiagResult] = useState(null);  // { connection_id, verdict, issues[], recommendation }

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

  const handleDiagnose = async (id) => {
    setDiagId(id);
    setDiagResult(null);
    setSyncMessage(null);
    try {
      const r = await api.banking.diagnose(id);
      setDiagResult(r);
    } catch (e) {
      setSyncMessage({ kind: 'error', text: `Diagnostic impossible : ${e?.detail || e?.message || 'erreur inconnue'}` });
    } finally {
      setDiagId(null);
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
                {' · '}
                {(() => {
                  const fresh = syncFreshness(c.last_synced_at);
                  const colors = {
                    fresh: 'var(--positive)',
                    stale: 'var(--warning)',
                    critical: 'var(--negative)',
                    never: 'var(--ink-3)',
                  };
                  return (
                    <span style={{ color: colors[fresh], fontWeight: fresh === 'critical' || fresh === 'never' ? 600 : 400 }}>
                      synchronisé {relativeTime(c.last_synced_at)}
                    </span>
                  );
                })()}
                {c.accounts?.length > 0 && ` · ${t('settings.banks.accountsCount', { count: c.accounts.length })}`}
              </div>
              {c.error_message && (
                <div style={{ fontSize: 11, color: 'var(--danger-text)', marginTop: 2 }}>{c.error_message}</div>
              )}
              {/* Diagnostic result (panneau dépliable sous la connexion) */}
              {diagResult && diagResult.connection_id === c.id && (
                <div className="bank-diag-result" style={{
                  marginTop: 10, padding: 12, borderRadius: 8,
                  background: diagResult.verdict === 'ok' ? 'var(--positive-soft)'
                            : diagResult.verdict === 'expired' || diagResult.verdict === 'error' ? 'var(--negative-soft)'
                            : 'var(--warning-soft)',
                  border: '1px solid ' + (diagResult.verdict === 'ok' ? 'var(--positive)'
                            : diagResult.verdict === 'expired' || diagResult.verdict === 'error' ? 'var(--negative)'
                            : 'var(--warning)'),
                  fontSize: 12,
                  color: 'var(--ink)',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10.5 }}>
                    Diagnostic · {diagResult.verdict}
                  </div>
                  {diagResult.last_sync_age_hours != null && (
                    <div>Dernière sync : il y a {diagResult.last_sync_age_hours} h</div>
                  )}
                  {diagResult.connection_age_days != null && (
                    <div>Consentement âgé de {diagResult.connection_age_days} j (max 90 j DSP2)</div>
                  )}
                  {diagResult.gocardless_status && (
                    <div>Status GoCardless : <code style={{ background: 'var(--bg-sunk)', padding: '1px 4px', borderRadius: 3 }}>{diagResult.gocardless_status}</code></div>
                  )}
                  {diagResult.issues?.length > 0 && (
                    <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                      {diagResult.issues.map((iss, i) => <li key={i}>{iss}</li>)}
                    </ul>
                  )}
                  {diagResult.recommendation && (
                    <div style={{ marginTop: 8, fontStyle: 'italic', fontFamily: 'Newsreader,Georgia,serif' }}>
                      → {diagResult.recommendation}
                    </div>
                  )}
                </div>
              )}
            </div>
            {c.status === 'authorized' && (
              <button
                className="secondary-btn"
                style={{ fontSize: 11, padding: '5px 10px', whiteSpace: 'nowrap' }}
                onClick={() => handleDiagnose(c.id)}
                disabled={diagId === c.id}
                title="Diagnostiquer la connexion (ping GoCardless en temps réel)"
              >
                <Activity size={12} className={diagId === c.id ? 'spin' : ''}/> Diagnostic
              </button>
            )}
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
