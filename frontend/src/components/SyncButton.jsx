// SyncButton — bouton header avec popover pour synchroniser les connexions
// bancaires GoCardless depuis n'importe quelle vue (Transactions, Dashboard).
//
// Pattern : trigger ds-btn ghost + RefreshCw, badge âge sync (ex "2h" ou "!"
// si stale). Click → popover listant chaque connexion avec son état + sync
// par-banque + "Tout synchroniser". GSAP : rotation continue de l'icône
// pendant qu'un sync est en cours, count-up sur le total imported après.
//
// Pourquoi un composant dédié plutôt que dupliquer BankConnectionsSection :
// dans Transactions on veut JUSTE sync + status, pas le flow connect/delete/
// diagnose (qui reste dans Réglages → Banques).
import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, AlertCircle, CheckCircle2, Unlink } from 'lucide-react';
import * as api from '../api.js';
import { gsap } from '../utils/gsapSetup.js';

// Réutilisé de BankConnectionsSection — duplicaté volontairement pour garder
// le composant autonome (pas de cross-import depuis views/settings).
function parseUtcIso(isoStr) {
  if (!isoStr) return null;
  const s = String(isoStr);
  const hasTz = /[Z]$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + 'Z');
}

function relativeTime(isoStr) {
  const d0 = parseUtcIso(isoStr);
  if (!d0 || Number.isNaN(d0.getTime())) return 'jamais';
  const diffMs = Date.now() - d0.getTime();
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

function syncFreshness(isoStr) {
  const d0 = parseUtcIso(isoStr);
  if (!d0 || Number.isNaN(d0.getTime())) return 'never';
  const ageH = (Date.now() - d0.getTime()) / 3600000;
  if (ageH > 168) return 'critical';
  if (ageH > 24) return 'stale';
  return 'fresh';
}

// Badge d'âge compact : "2h", "3j", ou "!" si critical (>7j).
function ageBadge(isoStr) {
  const d0 = parseUtcIso(isoStr);
  if (!d0 || Number.isNaN(d0.getTime())) return '!';
  const diffMs = Date.now() - d0.getTime();
  if (diffMs < 0) return 'now';
  const min = Math.floor(diffMs / 60000);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (h > 168) return '!';
  if (min < 60) return `${min}m`;
  if (h < 24) return `${h}h`;
  return `${d}j`;
}

export function SyncButton({ onAfterSync }) {
  const [connections, setConnections] = useState([]);
  const [open, setOpen] = useState(false);
  const [syncingIds, setSyncingIds] = useState(new Set());
  const [lastResult, setLastResult] = useState(null); // { imported, skipped, errors, ts }
  const wrapRef = useRef(null);
  const iconRef = useRef(null);
  const tweenRef = useRef(null);

  const isAnySyncing = syncingIds.size > 0;

  // Worst freshness across all connections — détermine la couleur du badge.
  const worstFreshness = connections.reduce((acc, c) => {
    const f = syncFreshness(c.last_synced_at);
    if (f === 'critical') return 'critical';
    if (f === 'stale' && acc !== 'critical') return 'stale';
    if (f === 'never' && acc === 'fresh') return 'never';
    return acc;
  }, 'fresh');

  // Plus ancien sync — utilisé pour le badge compact "2h" / "3j" / "!".
  const oldestSync = connections.reduce((acc, c) => {
    if (!c.last_synced_at) return acc;
    const d = parseUtcIso(c.last_synced_at);
    if (!d) return acc;
    if (!acc || d.getTime() < acc.getTime()) return d;
    return acc;
  }, null);

  const reload = useCallback(async () => {
    try {
      const list = await api.banking.listConnections();
      setConnections(list || []);
    } catch {
      // silently fail — pas grave si le user n'a pas encore connecté de banque
      setConnections([]);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // GSAP : rotation continue de l'icône pendant qu'au moins une sync est en cours.
  useEffect(() => {
    if (!iconRef.current) return;
    if (isAnySyncing) {
      tweenRef.current = gsap.to(iconRef.current, {
        rotation: 360,
        duration: 0.9,
        ease: 'none',
        repeat: -1,
        transformOrigin: '50% 50%',
      });
    } else {
      tweenRef.current?.kill();
      gsap.set(iconRef.current, { rotation: 0 });
      tweenRef.current = null;
    }
    return () => { tweenRef.current?.kill(); };
  }, [isAnySyncing]);

  // Fermeture popover sur click hors / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    const tid = setTimeout(() => {
      window.addEventListener('mousedown', onClick);
      window.addEventListener('keydown', onEsc);
    }, 50);
    return () => {
      clearTimeout(tid);
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const syncOne = async (id) => {
    setSyncingIds(prev => new Set(prev).add(id));
    try {
      return await api.banking.sync(id);
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleSyncOne = async (id) => {
    try {
      const res = await syncOne(id);
      const errors = res.status === 'rate_limited'
        ? ['Mise à jour temporairement limitée · dernières données conservées']
        : (res.errors || []);
      setLastResult({ imported: res.imported || 0, skipped: res.skipped || 0, errors, ts: Date.now() });
      await reload();
      // res inclut new_tx_ids (backend 2026-05-25) → la modale post-sync peut
      // cibler exactement les nouvelles tx à faire valider par l'utilisateur.
      onAfterSync?.({ ...res, new_tx_ids: res.new_tx_ids || [] });
    } catch (e) {
      setLastResult({ imported: 0, skipped: 0, errors: [e.message], ts: Date.now() });
    }
  };

  const handleSyncAll = async () => {
    const totals = { imported: 0, skipped: 0, errors: [], new_tx_ids: [] };
    for (const c of connections) {
      try {
        const res = await syncOne(c.id);
        if (res.status === 'rate_limited') {
          totals.errors.push('GoCardless limite temporairement les mises à jour. Réessai automatique plus tard.');
          break;
        }
        totals.imported += res.imported || 0;
        totals.skipped += res.skipped || 0;
        if (res.errors?.length) totals.errors.push(...res.errors);
        if (res.new_tx_ids?.length) totals.new_tx_ids.push(...res.new_tx_ids);
      } catch (e) {
        totals.errors.push(e.message);
      }
    }
    setLastResult({ ...totals, ts: Date.now() });
    await reload();
    onAfterSync?.(totals);
  };

  if (connections.length === 0) return null; // pas de banques connectées → pas de bouton

  const badgeText = isAnySyncing ? '...' : ageBadge(oldestSync?.toISOString());
  const badgeColor =
    worstFreshness === 'critical' ? 'var(--danger)' :
    worstFreshness === 'stale' ? 'var(--warning)' :
    worstFreshness === 'never' ? 'var(--ink-3)' :
    'var(--positive)';

  return (
    <span className="sync-btn-wrap" ref={wrapRef} style={{ position: 'relative' }}>
      <button
        className={`ds-btn ghost ${isAnySyncing ? 'is-syncing' : ''}`}
        onClick={() => setOpen(o => !o)}
        title={isAnySyncing ? 'Synchronisation en cours…' : `Synchroniser ${connections.length} banque${connections.length > 1 ? 's' : ''}`}
        type="button"
      >
        <span ref={iconRef} style={{ display: 'inline-flex' }}>
          <RefreshCw size={14}/>
        </span>
        <span className="sync-btn-label">Sync</span>
        <span
          className="sync-badge"
          style={{
            marginLeft: 4,
            fontSize: 10.5,
            fontFamily: 'var(--font-mono, monospace)',
            color: badgeColor,
            padding: '1px 5px',
            borderRadius: 4,
            background: 'color-mix(in srgb, currentColor 8%, transparent)',
            border: '1px solid color-mix(in srgb, currentColor 14%, transparent)',
          }}
        >
          {badgeText}
        </span>
      </button>

      {open && (
        <div
          className="sync-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 50,
            width: 320,
            background: 'var(--bg-elev)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 10px 30px -10px rgba(0,0,0,0.25), 0 4px 12px -4px rgba(0,0,0,0.1)',
            padding: 8,
            animation: 'cmbPanelIn 180ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div style={{ padding: '6px 8px 8px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
              Synchronisation banques
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2 }}>
              {connections.length} connexion{connections.length > 1 ? 's' : ''} · GoCardless DSP2
            </div>
          </div>

          {connections.map(c => {
            const fresh = syncFreshness(c.last_synced_at);
            const isThisOneSyncing = syncingIds.has(c.id);
            const dotColor =
              fresh === 'fresh' ? 'var(--positive)' :
              fresh === 'stale' ? 'var(--warning)' :
              fresh === 'critical' ? 'var(--danger)' :
              'var(--ink-3)';
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 8px',
                  borderRadius: 6,
                  gap: 8,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }}/>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.institution_name || c.bank_name || 'Banque'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 12, marginTop: 1 }}>
                    {c.last_synced_at ? `synchronisé ${relativeTime(c.last_synced_at)}` : 'jamais synchronisé'}
                  </div>
                </div>
                <button
                  className="icon-btn-sm"
                  onClick={() => handleSyncOne(c.id)}
                  disabled={isThisOneSyncing}
                  title="Synchroniser cette banque"
                  style={{ flexShrink: 0 }}
                >
                  <RefreshCw size={12} className={isThisOneSyncing ? 'spin' : ''}/>
                </button>
              </div>
            );
          })}

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 8, display: 'flex', gap: 6 }}>
            <button
              className="ds-btn primary"
              onClick={handleSyncAll}
              disabled={isAnySyncing}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <RefreshCw size={13} className={isAnySyncing ? 'spin' : ''}/>
              {isAnySyncing ? 'Synchronisation…' : 'Tout synchroniser'}
            </button>
          </div>

          {lastResult && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 10px',
                borderRadius: 6,
                background: lastResult.errors.length ? 'color-mix(in srgb, var(--warning) 10%, transparent)' : 'color-mix(in srgb, var(--positive) 10%, transparent)',
                fontSize: 12,
                color: lastResult.errors.length ? 'var(--warning)' : 'var(--positive)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {lastResult.errors.length ? <AlertCircle size={13}/> : <CheckCircle2 size={13}/>}
              <span>
                {lastResult.imported > 0 ? `${lastResult.imported} nouvelle${lastResult.imported > 1 ? 's' : ''} tx` : 'Aucune nouvelle tx'}
                {lastResult.skipped > 0 && ` · ${lastResult.skipped} déjà connues`}
                {lastResult.errors.length > 0 && ` · ${lastResult.errors.length} erreur${lastResult.errors.length > 1 ? 's' : ''}`}
              </span>
            </div>
          )}

          {/* Footer info — où aller pour reconnecter une banque perdue (cas AMEX) */}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 10.5, color: 'var(--ink-3)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Unlink size={10}/>
            <span>Banque manquante ? Réglages → Banques</span>
          </div>
        </div>
      )}
    </span>
  );
}
