// LearningToggle — toggle "Apprentissage automatique" pour la categorisation IA.
// Quand active, Wealthly cree des regles regex apprises apres 2 recategorisations
// manuelles du meme marchand vers la meme categorie.
//
// Refondu 2026-05-21 pour utiliser le shared ToggleCard + style premium
// (gradient cobalt-soft + GSAP) coherent avec FoyerSection.
import { useState, useEffect } from 'react';
import { Brain } from 'lucide-react';
import * as api from '../../../api.js';
import { ToggleCard } from '../../../components/ui/PremiumToggle.jsx';

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

  const handleChange = async (next) => {
    if (saving) return;
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
    <section className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
      <div className="card-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={16} style={{ color: 'var(--accent)' }}/>
          Apprentissage automatique
        </h3>
        <span className="card-meta">Catégorisation IA</span>
      </div>
      <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, margin: 0 }}>
          Quand tu recatégorises <strong style={{ color: 'var(--ink)' }}>2 fois le même marchand</strong> dans
          la même catégorie, Wealthly crée automatiquement une règle apprise. Désactive si tu préfères tout
          gérer manuellement.
        </p>
        <ToggleCard
          checked={enabled}
          onChange={handleChange}
          title="Activer l'apprentissage"
          description={enabled
            ? 'Les règles apprises s\'appliquent à toutes les futures synchronisations.'
            : 'Aucune nouvelle règle ne sera créée automatiquement.'}
          disabled={saving}
        />
      </div>
    </section>
  );
}
