// MonthlyReportToggle — opt-in du bilan mensuel par email.
// Quand activé, Wealthly envoie chaque début de mois un récap du mois écoulé
// (patrimoine net + delta, épargne, top dépenses, composition) à l'email du
// foyer. Bouton "envoyer un test" pour visualiser tout de suite.
import { useState, useEffect } from 'react';
import { Mail, Send } from 'lucide-react';
import * as api from '../../../api.js';
import { ToggleCard } from '../../../components/ui/PremiumToggle.jsx';

export function MonthlyReportToggle({ showToast }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const toast = showToast || (() => {});

  useEffect(() => {
    (async () => {
      try {
        const s = await api.reports.getSettings();
        if (s && typeof s.monthly_report_enabled === 'boolean') setEnabled(s.monthly_report_enabled);
      } catch { /* silent — demo mode renvoie un défaut */ }
      setLoading(false);
    })();
  }, []);

  const handleChange = async (next) => {
    if (saving) return;
    setSaving(true);
    try {
      await api.reports.setSettings(next);
      setEnabled(next);
      toast(next ? '📧 Bilan mensuel activé' : 'Bilan mensuel désactivé', 'success');
    } catch (err) {
      toast(err.message || 'Mise à jour impossible', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const res = await api.reports.sendTest();
      toast(`Bilan de test envoyé à ${res.to} ✓`, 'success');
    } catch (err) {
      toast(err.message || "Envoi impossible (email non configuré ?)", 'error');
    } finally {
      setTesting(false);
    }
  };

  if (loading) return null;

  return (
    <section className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
      <div className="card-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={16} style={{ color: 'var(--accent)' }}/>
          Bilan mensuel par email
        </h3>
        <span className="card-meta">Notifications</span>
      </div>
      <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, margin: 0 }}>
          Reçois chaque début de mois un <strong style={{ color: 'var(--ink)' }}>récap du mois écoulé</strong> :
          patrimoine net et son évolution, épargne du mois, top dépenses et composition de ton patrimoine.
          Envoyé à l'email de ton compte.
        </p>
        <ToggleCard
          checked={enabled}
          onChange={handleChange}
          title="Activer le bilan mensuel"
          description={enabled
            ? 'Tu recevras le bilan automatiquement au début de chaque mois.'
            : 'Aucun email de bilan ne sera envoyé.'}
          disabled={saving}
        />
        <button
          className="ds-btn ghost"
          onClick={sendTest}
          disabled={testing}
          style={{ alignSelf: 'flex-start' }}
        >
          <Send size={14} className={testing ? 'spin' : ''}/>
          {testing ? 'Envoi…' : 'M\'envoyer un bilan de test'}
        </button>
      </div>
    </section>
  );
}
