"""
Garde-fou anti token-burn pour les appels IA (clé serveur unique).

- Plafond mensuel d'appels par foyer (AI_MONTHLY_CAP) → au-delà, fallback.
- Cache du Coach (AI_COACH_CACHE_HOURS) → au plus 1 appel Sonnet/jour/foyer.

Tout passe par la table ai_state (1 ligne/foyer). Les requêtes tournent dans la
transaction de la requête HTTP (app.current_household_id posé) → RLS OK.
"""
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AiState


def _period() -> str:
    n = datetime.utcnow()
    return f"{n.year}-{n.month:02d}"


def _ensure_ctx(db: Session, hh: str) -> None:
    """Réaffirme app.current_household_id dans la transaction courante.

    set_config(..., true) de get_current_user est LOCAL (reset au commit). Comme
    ce service fait plusieurs commits par requête, on ré-applique la variable au
    début de chaque accès pour que RLS laisse passer. No-op sur SQLite (tests)."""
    try:
        db.execute(text("SELECT set_config('app.current_household_id', :h, true)"), {"h": hh})
    except Exception:
        pass


def _get(db: Session, hh: str) -> AiState:
    _ensure_ctx(db, hh)
    st = db.query(AiState).filter(AiState.household_id == hh).first()
    if not st:
        st = AiState(household_id=hh, period=_period(), month_count=0)
        db.add(st)
        db.commit()
        # ⚠️ RLS : le commit vient d'effacer app.current_household_id (variable
        # LOCAL transaction). Sans ré-affirmation, le SELECT du refresh tourne
        # sans contexte → 0 ligne → InvalidRequestError → 500 au TOUT PREMIER
        # appel IA d'un foyer neuf (bug prod 2026-07-03, invisible sur SQLite).
        _ensure_ctx(db, hh)
        db.refresh(st)
    return st


def under_cap(db: Session, hh: str) -> bool:
    st = _get(db, hh)
    if st.period != _period():
        return True  # nouveau mois → compteur repartira à 0 à l'enregistrement
    return (st.month_count or 0) < settings.AI_MONTHLY_CAP


def record_use(db: Session, hh: str, n: int = 1) -> None:
    st = _get(db, hh)
    p = _period()
    if st.period != p:
        st.period = p
        st.month_count = 0
    st.month_count = (st.month_count or 0) + n
    st.updated_at = datetime.utcnow()
    db.commit()


# Le Coach est calculé PAR SCOPE (foyer entier = 'all', ou un membre précis) :
# les chiffres du snapshot diffèrent selon le membre sélectionné, donc le cache
# doit être ventilé par scope pour ne pas resservir l'analyse du foyer sur un
# membre (et inversement). On stocke un dict { scope: {payload, ts} } dans la
# colonne JSON coach_cache existante — pas de migration.
def _is_legacy_cache(cache) -> bool:
    """Ancien format : payload direct {coach, alerts} (avant le cache par scope)."""
    return isinstance(cache, dict) and ("coach" in cache or "alerts" in cache)


def coach_cache_get(db: Session, hh: str, scope: str = "all"):
    st = _get(db, hh)
    cache = st.coach_cache
    if not cache:
        return None
    # Rétrocompat : l'ancien blob unique est traité comme le scope 'all',
    # daté par la colonne coach_cached_at.
    if _is_legacy_cache(cache):
        if scope != "all" or not st.coach_cached_at:
            return None
        age_h = (datetime.utcnow() - st.coach_cached_at).total_seconds() / 3600
        return None if age_h > settings.AI_COACH_CACHE_HOURS else cache
    if not isinstance(cache, dict):
        return None
    entry = cache.get(scope)
    if not entry or not entry.get("ts"):
        return None
    try:
        ts = datetime.fromisoformat(entry["ts"])
    except (ValueError, TypeError):
        return None
    age_h = (datetime.utcnow() - ts).total_seconds() / 3600
    if age_h > settings.AI_COACH_CACHE_HOURS:
        return None
    return entry.get("payload")


def coach_cache_set(db: Session, hh: str, payload: dict, scope: str = "all") -> None:
    st = _get(db, hh)
    cache = st.coach_cache
    # Migre l'ancien blob unique vers le format par scope à la première écriture.
    if not isinstance(cache, dict) or _is_legacy_cache(cache):
        cache = {}
    cache = dict(cache)  # nouvelle référence → SQLAlchemy détecte le changement
    cache[scope] = {"payload": payload, "ts": datetime.utcnow().isoformat()}
    st.coach_cache = cache
    st.coach_cached_at = datetime.utcnow()
    st.updated_at = datetime.utcnow()
    db.commit()
