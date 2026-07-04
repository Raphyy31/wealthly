"""
SQLAlchemy database setup. Provides:
- engine: connection to Postgres
- SessionLocal: factory for DB sessions
- Base: parent class for all ORM models
- get_db: FastAPI dependency yielding a session
- set_rls_context: pose le contexte RLS du foyer, ré-affirmé automatiquement
  à CHAQUE nouvelle transaction de la session (fix racine du gotcha
  set_config LOCAL perdu au commit)
"""
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

_IS_POSTGRES = not settings.DATABASE_URL.startswith("sqlite")


def set_rls_context(db, household_id) -> None:
    """Pose `app.current_household_id` pour la session ET mémorise le foyer
    dans session.info pour que le listener after_begin ci-dessous le
    ré-affirme à chaque NOUVELLE transaction.

    Pourquoi : `set_config(..., true)` est LOCAL à la transaction Postgres —
    chaque COMMIT l'efface. Tout `db.refresh()` / SELECT qui suivait un commit
    tournait donc sous FORCE RLS sans contexte → 0 ligne → InvalidRequestError
    → 500. Deux incidents prod le 2026-07 (ai_state à la création du foyer,
    puis /banking/connect : la redirection bancaire ne partait JAMAIS). Ce
    fix racine rend le pattern commit-puis-lecture sûr PARTOUT.
    """
    db.info["rls_household_id"] = str(household_id) if household_id else None
    if _IS_POSTGRES and household_id:
        try:
            db.execute(
                text("SELECT set_config('app.current_household_id', :h, true)"),
                {"h": str(household_id)},
            )
        except Exception:
            pass


@event.listens_for(SessionLocal, "after_begin")
def _reassert_rls_context(session, transaction, connection):
    """Ré-affirme le contexte RLS au début de chaque transaction (post-commit
    inclus). No-op hors Postgres ou si aucun foyer n'a été posé."""
    if not _IS_POSTGRES:
        return
    hid = session.info.get("rls_household_id")
    if not hid:
        return
    try:
        connection.execute(
            text("SELECT set_config('app.current_household_id', :h, true)"),
            {"h": hid},
        )
    except Exception:
        pass


def get_db():
    """FastAPI dependency: provides a DB session, closes it after request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
