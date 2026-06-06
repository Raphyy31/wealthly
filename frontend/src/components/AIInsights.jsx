// ============================================================================
// AIInsights — Coach patrimoine + Alertes intelligentes.
// Reçoit un snapshot financier (chiffres déjà calculés), appelle /ai/insights
// une fois au montage (coût maîtrisé), avec bouton rafraîchir. Dégrade
// proprement (skeleton → contenu → état neutre / erreur silencieuse).
// ============================================================================
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, Lightbulb } from 'lucide-react';
import * as api from '../api.js';

export function AIInsights({ snapshot }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const fetchedRef = useRef(false);

  const load = async (force = false) => {
    if (!snapshot) return;
    setLoading(true); setError(false);
    try {
      const res = await api.insights.get(snapshot, force);
      setData(res || null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Au montage : cache serveur (force=false). Le bouton force une analyse fraîche.
  useEffect(() => {
    if (fetchedRef.current || !snapshot) return;
    fetchedRef.current = true;
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  const coach = data?.coach || [];
  const alerts = data?.alerts || [];

  return (
    <section className="card ai-insights">
      <div className="card-header">
        <h3 className="ai-insights-title"><Sparkles size={15}/> Coach patrimoine</h3>
        <button
          className="icon-btn-sm" onClick={() => load(true)} disabled={loading}
          title="Rafraîchir l'analyse (nouvelle requête IA)" aria-label="Rafraîchir l'analyse"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''}/>
        </button>
      </div>

      {loading && !data ? (
        <div className="ai-skeleton">
          <div className="ai-skel-line"/><div className="ai-skel-line short"/>
        </div>
      ) : error ? (
        <p className="ai-empty">Analyse indisponible pour le moment. Réessaie dans un instant.</p>
      ) : (
        <>
          {alerts.length > 0 && (
            <div className="ai-alerts">
              {alerts.map((a, i) => (
                <div key={i} className={`ai-alert ${a.severity === 'warn' ? 'warn' : 'info'}`}>
                  <AlertTriangle size={15} aria-hidden="true"/>
                  <span>{a.text}</span>
                </div>
              ))}
            </div>
          )}

          {coach.length > 0 ? (
            <div className="ai-coach">
              {coach.map((c, i) => (
                <div key={i} className="ai-coach-item">
                  <Lightbulb size={15} aria-hidden="true"/>
                  <div>
                    {c.title && <div className="ai-coach-item-title">{c.title}</div>}
                    <div className="ai-coach-item-body">{c.body}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (alerts.length === 0 && data && (
            <p className="ai-empty">Rien à signaler ce mois-ci — tout est sous contrôle.</p>
          ))}

          {data && !data.ai_used && (coach.length > 0 || alerts.length > 0) && (
            <div className="ai-foot">Analyse locale (IA indisponible)</div>
          )}
        </>
      )}
    </section>
  );
}
