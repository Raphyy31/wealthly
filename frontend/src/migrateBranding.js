// ============================================================================
// Migration Wealthly → Yotori Finance (rebranding 2026-07)
//
// Les préférences locales étaient stockées sous des clés « wealthly » (deux
// formes : préfixe deux-points et préfixe tiret). On les recopie une seule
// fois vers `yotori:*` / `yotori-*`, puis on supprime les anciennes clés.
// Sans ça : thème, langue, mode démo, devise, filtres… seraient réinitialisés
// pour tous les utilisateurs existants au premier chargement post-rebranding.
//
// Le préfixe legacy est construit dynamiquement (`'wealth' + 'ly'`) pour
// qu'aucun outil de renommage global ne réécrive cette constante — ce module
// DOIT continuer à référencer l'ancien nom pour faire son travail.
//
// ⚠️ Ce module doit être importé EN PREMIER dans main.jsx : les imports ES
// sont hissés et évalués dans l'ordre de déclaration, et i18n.js lit
// `yotori:lang` dès son évaluation. Le script inline no-flash d'index.html
// fait la même migration encore plus tôt — celui-ci est la ceinture de
// sécurité (idempotent, no-op si tout est déjà migré).
// ============================================================================
const LEGACY_PREFIX = 'wealth' + 'ly'; // ne PAS renommer — voir en-tête
try {
  const legacy = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && (k.startsWith(LEGACY_PREFIX + ':') || k.startsWith(LEGACY_PREFIX + '-'))) legacy.push(k);
  }
  legacy.forEach((k) => {
    const next = 'yotori' + k.slice(LEGACY_PREFIX.length);
    if (next === k) return;
    if (window.localStorage.getItem(next) === null) {
      window.localStorage.setItem(next, window.localStorage.getItem(k));
    }
    window.localStorage.removeItem(k);
  });
} catch { /* localStorage indisponible (SSR / privacy mode) — non bloquant */ }
