// useIncomeShift — hook React qui expose le réglage "décalage salaire"
// (settings.enabled + settings.pivotDay) et permet de le mettre à jour.
//
// Backed par localStorage (key 'wealthly:income_shift'). Synchronisé entre
// onglets via l'événement 'storage' standard du navigateur. Default :
// { enabled: true, pivotDay: 25 } — couvre 95% des salariés français
// dont le virement tombe vers le 28-30 du mois pour financer le mois suivant.
import { useState, useEffect, useCallback } from 'react';
import { readIncomeShiftSetting, writeIncomeShiftSetting, INCOME_SHIFT_DEFAULTS } from '../utils.js';

export function useIncomeShift() {
  const [settings, setSettings] = useState(() => readIncomeShiftSetting());

  // Reload si autre onglet modifie le réglage (multi-tab sync).
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'wealthly:income_shift') setSettings(readIncomeShiftSetting());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      writeIncomeShiftSetting(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    writeIncomeShiftSetting(INCOME_SHIFT_DEFAULTS);
    setSettings(INCOME_SHIFT_DEFAULTS);
  }, []);

  return { settings, update, reset };
}
