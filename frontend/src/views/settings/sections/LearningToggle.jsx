// Source: Settings.jsx lines 2053-2120 — LearningToggle
import { useState, useEffect } from 'react';
import * as api from '../../../api.js';

export function LearningToggle({ showToast }) {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = showToast || (() => {});

  useEffect(() => {
    (async () => {
      try {
        const s = await api.categorizeEngine.getLearningSettings();
        if (s && typeof s.auto_learning_enabled === 'boolean') setEnabled(s.auto_learning_enabled);
      } catch { /* silent — demo mode renvoie null */ }
      setLoading(false);
    })();
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setSaving(true);
    try {
      await api.categorizeEngine.updateLearningSettings(next);
      setEnabled(next);
      toast(next ? '🧠 Apprentissage automatique activé' : 'Apprentissage automatique désactivé', 'success');
    } catch (err) {
      toast(err.message || 'Mise à jour impossible', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
            🧠 Apprentissage automatique
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: '4px 0 0', lineHeight: 1.5, maxWidth: 540 }}>
            Quand tu recatégorises 2 fois le même marchand dans la même catégorie, Wealthly crée automatiquement une règle apprise. Désactive si tu préfères tout gérer manuellement.
          </p>
        </div>
        <button
          type="button"
          className={`learning-toggle-btn ${enabled ? 'on' : 'off'}`}
          onClick={toggle}
          disabled={saving}
          aria-pressed={enabled}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 8,
            background: enabled ? 'var(--accent)' : 'var(--bg-elev)',
            color: enabled ? '#fff' : 'var(--ink-2)',
            border: '1px solid ' + (enabled ? 'var(--accent)' : 'var(--border-strong)'),
            fontWeight: 600, fontSize: 13, cursor: saving ? 'wait' : 'pointer',
            transition: 'background 0.15s, color 0.15s, border-color 0.15s',
          }}
        >
          {saving ? '…' : (enabled ? 'Activé' : 'Désactivé')}
        </button>
      </div>
    </section>
  );
}
