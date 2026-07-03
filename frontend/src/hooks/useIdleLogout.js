// ============================================================================
// useIdleLogout — Déconnexion automatique après inactivité (sécurité finance).
//
// Détecte les événements user (mousemove, keydown, touchstart, scroll, click)
// et déclenche un warning à `warnAtMinutes` puis logout à `timeoutMinutes`.
// Le timer reset à chaque activité.
//
// Usage :
//   useIdleLogout({
//     enabled: authState === 'authed',
//     timeoutMinutes: 30,
//     warnAtMinutes: 25,
//     onWarn: () => toast('Déconnexion dans 5 min…'),
//     onLogout: () => { logout(); navigate('/'); },
//   });
//
// Implémentation :
//   - Storage localStorage `yotori:lastActivity` partagé entre onglets
//   - Tick toutes les 30s (suffisant — économique batterie mobile)
//   - 0 dépendance externe
// ============================================================================
import { useEffect, useRef } from 'react';

const STORAGE_KEY = 'yotori:lastActivity';
const TICK_INTERVAL_MS = 30_000;  // 30s
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];

export function useIdleLogout({
  enabled = true,
  timeoutMinutes = 30,
  warnAtMinutes = 25,
  onWarn,
  onLogout,
} = {}) {
  const warnedRef = useRef(false);
  const onWarnRef = useRef(onWarn);
  const onLogoutRef = useRef(onLogout);

  // Stocker les callbacks dans des refs pour qu'ils restent stables même si
  // l'appelant ne mémoïse pas avec useCallback.
  useEffect(() => { onWarnRef.current = onWarn; }, [onWarn]);
  useEffect(() => { onLogoutRef.current = onLogout; }, [onLogout]);

  useEffect(() => {
    if (!enabled) return;

    const touch = () => {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        // Stockage indispo (mode privé Safari)
      }
      warnedRef.current = false;
    };

    // Initial timestamp si absent
    if (!localStorage.getItem(STORAGE_KEY)) {
      touch();
    }

    ACTIVITY_EVENTS.forEach(ev => {
      window.addEventListener(ev, touch, { passive: true });
    });

    const checkInactivity = () => {
      const lastTs = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      if (!lastTs) return;
      const elapsedMs = Date.now() - lastTs;
      const elapsedMin = elapsedMs / 60_000;

      if (elapsedMin >= timeoutMinutes) {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        if (onLogoutRef.current) onLogoutRef.current();
      } else if (elapsedMin >= warnAtMinutes && !warnedRef.current) {
        warnedRef.current = true;
        if (onWarnRef.current) {
          const remainingMin = Math.max(1, Math.ceil(timeoutMinutes - elapsedMin));
          onWarnRef.current(remainingMin);
        }
      }
    };

    const intervalId = setInterval(checkInactivity, TICK_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      ACTIVITY_EVENTS.forEach(ev => {
        window.removeEventListener(ev, touch);
      });
    };
  }, [enabled, timeoutMinutes, warnAtMinutes]);
}
