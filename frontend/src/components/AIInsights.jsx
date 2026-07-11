// ============================================================================
// AIInsights — Coach patrimoine + Alertes intelligentes.
// Reçoit un snapshot financier (chiffres déjà calculés), appelle /ai/insights
// une fois au montage (coût maîtrisé), avec bouton rafraîchir. Dégrade
// proprement (skeleton → contenu → état neutre / erreur silencieuse).
// ============================================================================
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, Lightbulb } from 'lucide-react';
import * as api from '../api.js';

// scope = 'all' (foyer) ou id du membre → le coaching est calculé et mis en
// cache PAR périmètre. hasData=false (membre sans comptes/opérations) → on
// n'appelle pas l'IA, on affiche une invite. scopeLabel enrichit le message.
export function AIInsights({ snapshot, scope = 'all', hasData = true, scopeLabel }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const fetchedScopeRef = useRef(null);

  const load = async (force = false) => {
    if (!snapshot || !hasData) return;
    setLoading(true); setError(false);
    try {
      const res = await api.insights.get(snapshot, force, scope);
      setData(res || null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Recharge quand le périmètre change (switch de membre). Cache serveur 24h
  // par scope (force=false) ; le bouton force une analyse fraîche.
  useEffect(() => {
    if (!snapshot || !hasData) { setData(null); return; }
    if (fetchedScopeRef.current === scope) return;
    fetchedScopeRef.current = scope;
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, scope, hasData]);

  const coach = data?.coach || [];
  const alerts = data?.alerts || [];

  // Périmètre sans données (membre neuf) : invite plutôt qu'appel IA à vide.
  if (!hasData) {
    return (
      <section className="card ai-insights">
        <div className="card-header">
          <h3 className="ai-insights-title"><Sparkles size={15}/> Coach patrimoine</h3>
        </div>
        <p className="ai-empty">
          Pas encore de données{scopeLabel ? ` pour ${scopeLabel}` : ' sur ce périmètre'}. Ajoutez des comptes ou importez des opérations pour obtenir un coaching personnalisé.
        </p>
      </section>
    );
  }

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
        <p className="ai-empty">Analyse indisponible pour le moment. Réessayez dans un instant.</p>
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
          ) : (alerts.length === 0 && (
            // Jamais de carte totalement vide : si data est arrivé null/échoué
            // sans lever d'erreur, on affiche quand même un message neutre.
            <p className="ai-empty">
              {data
                ? 'Rien à signaler ce mois-ci — tout est sous contrôle.'
                : "Analyse indisponible pour le moment. Vérifie que l'IA est bien configurée, ou réessaie."}
            </p>
          ))}

          {data && !data.ai_used && (coach.length > 0 || alerts.length > 0) && (
            <div className="ai-foot">Analyse locale (IA indisponible)</div>
          )}
        </>
      )}
    </section>
  );
}
