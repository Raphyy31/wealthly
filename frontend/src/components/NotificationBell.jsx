// ============================================================================
// NotificationBell — cloche + centre d'alertes intelligentes.
// Refresh (= détection) une fois au montage, badge non-lus, panneau déroulant,
// clic → marque lu + navigue vers la vue concernée, dismiss, tout marquer lu.
// ============================================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, AlertTriangle, AlertCircle, Info, X, Check } from 'lucide-react';
import * as api from '../api.js';

const ICONS = { critical: AlertCircle, warn: AlertTriangle, info: Info };

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

export function NotificationBell({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const fetchedRef = useRef(false);
  const wrapRef = useRef(null);

  const load = useCallback(async (detect) => {
    try {
      const res = detect ? await api.notifications.refresh() : await api.notifications.list();
      setItems(Array.isArray(res) ? res : []);
    } catch { /* silencieux — cloche secondaire */ }
  }, []);

  // Détection une fois par session, au montage.
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    load(true);
  }, [load]);

  // Fermer au clic extérieur.
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const unread = items.filter(n => n.status === 'unread').length;

  const onClickItem = async (n) => {
    if (n.status === 'unread') {
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, status: 'read' } : x));
      api.notifications.read(n.id).catch(() => {});
    }
    if (n.link && onNavigate) { onNavigate(n.link); setOpen(false); }
  };

  const onDismiss = async (e, id) => {
    e.stopPropagation();
    setItems(prev => prev.filter(x => x.id !== id));
    api.notifications.dismiss(id).catch(() => {});
  };

  const onReadAll = () => {
    setItems(prev => prev.map(x => ({ ...x, status: 'read' })));
    api.notifications.readAll().catch(() => {});
  };

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <NotifStyles/>
      <button className="notif-bell" onClick={() => setOpen(o => !o)} aria-label="Alertes" title="Alertes">
        <Bell size={18}/>
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <span className="notif-head-title">Alertes</span>
            {unread > 0 && <button className="notif-readall" onClick={onReadAll}><Check size={13}/> Tout marquer lu</button>}
          </div>

          {items.length === 0 ? (
            <div className="notif-empty">
              <Bell size={22}/>
              <p>Rien à signaler — tout est sous contrôle. 👌</p>
            </div>
          ) : (
            <div className="notif-list">
              {items.map(n => {
                const Icon = ICONS[n.severity] || Info;
                return (
                  <div key={n.id} className={`notif-item ${n.status === 'unread' ? 'unread' : ''}`} onClick={() => onClickItem(n)}>
                    <span className={`notif-ic ${n.severity}`}><Icon size={15}/></span>
                    <div className="notif-body">
                      <div className="notif-title">{n.title}</div>
                      <div className="notif-text">{n.body}</div>
                      <div className="notif-time">{timeAgo(n.created_at)}</div>
                    </div>
                    <button className="notif-dismiss" onClick={(e) => onDismiss(e, n.id)} aria-label="Écarter"><X size={14}/></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

let _notifCss = false;
function NotifStyles() {
  if (_notifCss) return null;
  // injecté dans le <head> (persiste — pas démonté avec la cloche)
  if (typeof document !== 'undefined') {
    _notifCss = true;
    const s = document.createElement('style');
    s.dataset.notif = '1';
    s.textContent = NOTIF_CSS;
    document.head.appendChild(s);
  }
  return null;
}

const NOTIF_CSS = `
.notif-wrap { position: relative; display: inline-flex; }
.notif-bell { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; background: var(--bg-elev); border: 1px solid var(--border); color: var(--ink-2); cursor: pointer; transition: background .15s, color .15s, border-color .15s; }
.notif-bell:hover { background: var(--bg-sunk); color: var(--ink); border-color: var(--border-strong); }
.notif-badge { position: absolute; top: -5px; right: -5px; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 999px; background: var(--negative); color: #fff; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px var(--bg-card, var(--bg-elev)); }
.notif-panel { position: absolute; top: 44px; right: 0; width: min(380px, 92vw); max-height: 70vh; overflow-y: auto; background: var(--bg-card, var(--bg-elev)); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 20px 50px -12px rgba(15,14,12,.28); z-index: 1500; animation: notifIn .14s ease-out; }
@keyframes notifIn { from { opacity: 0; transform: scale(.97) translateY(-4px); } to { opacity: 1; transform: none; } }
.notif-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--bg-card, var(--bg-elev)); }
.notif-head-title { font-size: 14px; font-weight: 600; color: var(--ink); }
.notif-readall { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: var(--accent); font-size: 12px; font-weight: 500; cursor: pointer; padding: 2px 4px; border-radius: 6px; }
.notif-readall:hover { background: var(--accent-soft); }
.notif-empty { text-align: center; padding: 32px 20px; color: var(--text-tertiary); }
.notif-empty p { margin: 10px 0 0; font-size: 13px; font-family: 'Newsreader', Georgia, serif; font-style: italic; }
.notif-list { display: flex; flex-direction: column; }
.notif-item { display: flex; gap: 11px; padding: 13px 16px; border-bottom: 1px solid var(--border-light, var(--border)); cursor: pointer; transition: background .12s; position: relative; }
.notif-item:hover { background: var(--bg-subtle); }
.notif-item.unread { background: color-mix(in srgb, var(--accent) 4%, transparent); }
.notif-item.unread::before { content: ''; position: absolute; left: 6px; top: 50%; transform: translateY(-50%); width: 5px; height: 5px; border-radius: 999px; background: var(--accent); }
.notif-ic { flex-shrink: 0; width: 30px; height: 30px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; }
.notif-ic.critical { background: color-mix(in srgb, var(--negative) 14%, transparent); color: var(--negative); }
.notif-ic.warn { background: color-mix(in srgb, var(--warning) 16%, transparent); color: var(--warning); }
.notif-ic.info { background: var(--accent-soft); color: var(--accent); }
.notif-body { flex: 1; min-width: 0; }
.notif-title { font-size: 13px; font-weight: 600; color: var(--ink); }
.notif-text { font-size: 12.5px; color: var(--text-secondary); line-height: 1.4; margin-top: 2px; }
.notif-time { font-size: 11px; color: var(--text-tertiary); margin-top: 4px; }
.notif-dismiss { flex-shrink: 0; background: none; border: none; color: var(--text-tertiary); cursor: pointer; padding: 2px; border-radius: 6px; height: fit-content; opacity: 0; transition: opacity .12s, color .12s, background .12s; }
.notif-item:hover .notif-dismiss { opacity: 1; }
.notif-dismiss:hover { background: var(--bg-hover); color: var(--ink); }
`;
