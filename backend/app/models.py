"""
Database models — these define the Postgres schema.

Hierarchy:
- Household: top-level container (one family = one household)
- User: a login (only adults have logins)
- Member: a person tracked (adults + children)
- Account: bank account, can belong to multiple members (joint accounts)
- Transaction: a single bank line item
- Asset, Liability: non-bank wealth items
- Category, Budget, Goal, Achievement: budgeting & gamification
"""
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Date,
    ForeignKey, Table, JSON, Text, UniqueConstraint, Index, LargeBinary
)
from sqlalchemy.orm import relationship
import uuid

from app.database import Base


def _uuid():
    return str(uuid.uuid4())


# ============================================================================
# ASSOCIATION TABLES (many-to-many)
# ============================================================================

# Account <-> Member (a joint account belongs to multiple members)
account_members = Table(
    "account_members",
    Base.metadata,
    Column("account_id", String, ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True),
    Column("member_id", String, ForeignKey("members.id", ondelete="CASCADE"), primary_key=True),
)

# Asset <-> Member
asset_members = Table(
    "asset_members",
    Base.metadata,
    Column("asset_id", String, ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True),
    Column("member_id", String, ForeignKey("members.id", ondelete="CASCADE"), primary_key=True),
)

# Liability <-> Member
liability_members = Table(
    "liability_members",
    Base.metadata,
    Column("liability_id", String, ForeignKey("liabilities.id", ondelete="CASCADE"), primary_key=True),
    Column("member_id", String, ForeignKey("members.id", ondelete="CASCADE"), primary_key=True),
)


# ============================================================================
# CORE TABLES
# ============================================================================

class Household(Base):
    """A family unit. Everything is scoped to a household."""
    __tablename__ = "households"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False, default="Mon foyer")
    # plan: solo | pro | family | admin (free forever for platform founders)
    plan = Column(String, nullable=False, default="solo")
    # Category Learning : si False, le hook on_transaction_recategorized
    # ne crée plus de règle apprise automatiquement (l'user gère tout à
    # la main). Par défaut activé — l'app apprend en silence.
    auto_learning_enabled = Column(Boolean, nullable=False, default=True)
    # Email bilan mensuel automatique (opt-in dans Réglages). Si True, le cron
    # mensuel envoie le bilan du mois écoulé au 1er utilisateur du foyer.
    monthly_report_enabled = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="household", cascade="all, delete-orphan")
    members = relationship("Member", back_populates="household", cascade="all, delete-orphan")
    accounts = relationship("Account", back_populates="household", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="household", cascade="all, delete-orphan")
    assets = relationship("Asset", back_populates="household", cascade="all, delete-orphan")
    liabilities = relationship("Liability", back_populates="household", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="household", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="household", cascade="all, delete-orphan")
    goals = relationship("Goal", back_populates="household", cascade="all, delete-orphan")
    achievements = relationship("Achievement", back_populates="household", cascade="all, delete-orphan")
    rules = relationship("CategorisationRule", back_populates="household", cascade="all, delete-orphan")
    bank_connections = relationship("BankConnection", back_populates="household", cascade="all, delete-orphan")
    fixed_charges = relationship("FixedCharge", back_populates="household", cascade="all, delete-orphan")


class User(Base):
    """Login credentials for an adult member of the household."""
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)  # admin can manage household settings
    # Versionne les JWT : incrémenté à chaque changement/réinit de mot de passe
    # et désactivation 2FA → les anciens tokens (cookie 7j) deviennent invalides
    # (révocation de session). Vérifié dans get_current_user via le claim "tv".
    token_version = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime, default=datetime.utcnow)

    # "Mois type" — JSON budget template the user defines once and compares each
    # real month against. Shape: { version, updated_at, lines: [{id, category_id,
    # kind, label, amount, locked}] }. See specs/2026-05-14-budget-mensuel-refonte-design.md.
    ref_month = Column(JSON, nullable=True)

    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    household = relationship("Household", back_populates="users")

    # Optional link to a Member entry (adult users usually have a Member counterpart)
    member_id = Column(String, ForeignKey("members.id", ondelete="SET NULL"), nullable=True)

    # Google OAuth — stores the Google user ID ("sub" claim) so the same
    # Google account always maps to the same Wealthly user, even if they
    # change their Google email. Nullable = password-only users.
    google_id = Column(String, nullable=True, index=True)

    # 2FA TOTP (C19 2026-05-18) — secret base32 généré par pyotp.random_base32().
    # Stocké en clair (équivalent password — au pire compromis DB = comme leak pw).
    # `totp_enabled` requis pour distinguer "secret en cours de setup" vs "vérifié".
    # Si User.totp_enabled = True, login exige étape 2 (code 6 chiffres TOTP).
    totp_secret = Column(String, nullable=True)
    totp_enabled = Column(Boolean, default=False, nullable=False)
    # Timestamp of the last accepted TOTP code (anti-replay).
    # A new code is accepted only if its 30s window is strictly after this.
    totp_last_otp_at = Column(DateTime, nullable=True)


class RefMonth(Base):
    """Mois type (budget template) — scoped per (household, member).

    `member_id IS NULL` ⇒ ménage / "Famille" — comptes joints, dépenses
    partagées, virements reçus des adultes.
    `member_id IS NOT NULL` ⇒ Mois type personnel d'un adulte.

    Migration : la colonne historique `users.ref_month` (JSON par-user)
    est portée à la volée lors du premier GET vers une ligne de cette
    table avec `member_id = user.member_id` (perso) si défini, sinon
    `member_id = NULL` (ménage).
    """
    __tablename__ = "ref_months"
    __table_args__ = (
        UniqueConstraint("household_id", "member_id", name="uq_ref_month_scope"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(String, ForeignKey("members.id", ondelete="CASCADE"), nullable=True, index=True)
    version = Column(Integer, nullable=False, default=1)
    lines = Column(JSON, nullable=False, default=list)
    updated_at = Column(DateTime, default=datetime.utcnow)


class AuthEvent(Base):
    """Append-only audit log of every authentication attempt.
    Powers the /admin monitoring page + brute-force lockout logic.

    `kind` enum:
      - login_success / login_failure
      - register_success / register_failure
      - password_reset_request / password_reset_success
      - logout
    """
    __tablename__ = "auth_events"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    email = Column(String, nullable=True, index=True)  # captured even on register failure
    kind = Column(String, nullable=False, index=True)
    success = Column(Boolean, nullable=False, default=True, index=True)
    ip = Column(String, nullable=True, index=True)
    user_agent = Column(Text, nullable=True)
    detail = Column(Text, nullable=True)  # free-form: failure reason, country, etc.
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Member(Base):
    """A person tracked in the household. Adults usually have a User login,
    children do not."""
    __tablename__ = "members"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="adult")  # adult | child
    color = Column(String, nullable=False, default="#3b82f6")
    created_at = Column(DateTime, default=datetime.utcnow)

    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    household = relationship("Household", back_populates="members")

    accounts = relationship("Account", secondary=account_members, back_populates="members")
    assets = relationship("Asset", secondary=asset_members, back_populates="members")
    liabilities = relationship("Liability", secondary=liability_members, back_populates="members")


class Account(Base):
    """A bank account. Can be owned by 1+ members (joint accounts)."""
    __tablename__ = "accounts"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    bank = Column(String, nullable=True)
    type = Column(String, nullable=False, default="checking")  # checking|savings|pea|credit
    # Cashflow role — drives which accounts contribute to income / expenses
    # aggregates. Independent from `type` (which is the bank product family).
    #   principal      — main account, salary lands here, all flows count
    #   depenses       — secondary spend wallet (Revolut style); outflows ARE
    #                    real expenses, inflows are usually transfers from
    #                    principal and DO NOT count as income
    #   epargne        — savings; balance counts in net worth, neither inflows
    #                    nor outflows count for monthly cashflow
    #   investissement — broker; same rule as epargne for cashflow purposes
    #   professionnel  — fully excluded from personal patrimoine and cashflow
    role = Column(String, nullable=False, default="principal", index=True)
    # Compte joint famille — flag indépendant du rôle. Un compte joint peut
    # avoir n'importe quel rôle (principal pour un compte courant joint,
    # epargne pour un Livret A joint, etc.). Sert au Mois type Famille pour
    # agréger uniquement les comptes vraiment partagés.
    is_joint = Column(Boolean, nullable=False, default=False, server_default="false", index=True)
    # IBAN complet quand fourni par l'aggrégateur. Le frontend en affiche
    # les 4 derniers caractères pour aider à distinguer plusieurs comptes
    # de la même banque avec un nom similaire.
    iban = Column(String, nullable=True)
    initial_balance = Column(Float, nullable=False, default=0.0)
    # Solde officiel renvoyé par l'agrégateur GoCardless à la dernière sync.
    # Source de vérité pour les comptes synchronisés — évite la divergence
    # entre (initial_balance + Σtransactions) et le vrai solde côté banque
    # quand des transactions pending ne sont pas encore visibles via DSP2.
    # NULL pour les comptes manuels / CSV : le frontend retombe alors sur
    # le calcul classique.
    last_known_balance = Column(Float, nullable=True)
    last_balance_at = Column(DateTime, nullable=True)
    # ISO 4217 currency the account is denominated in (EUR / USD / GBP / CHF / …).
    # Lets us aggregate multi-currency holdings: the frontend converts to the
    # user's display currency at render time using live ECB rates.
    currency = Column(String, nullable=False, default="EUR")
    # Source of the account: manual | csv | gocardless. Lets us spot accounts
    # auto-created by an open-banking sync vs ones the user entered themselves.
    source = Column(String, nullable=False, default="manual", index=True, server_default="manual")
    # Stable identifier from the aggregator (e.g. GoCardless account UUID).
    # Together with source, it lets a sync re-find the same account across
    # runs without creating duplicates.
    external_id = Column(String, nullable=True, index=True)
    # Stable UUID shared with the wealth_items table — Option A++ unification
    # preparation (2026-05-13). Lets us treat Accounts and Assets as a single
    # patrimoine item set without merging the underlying tables yet.
    wealth_item_uuid = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    household = relationship("Household", back_populates="accounts")

    members = relationship("Member", secondary=account_members, back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")


class Transaction(Base):
    """A single transaction line from a bank statement."""
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=_uuid)
    account_id = Column(String, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    label = Column(String, nullable=False, default="")
    amount = Column(Float, nullable=False)
    category_id = Column(String, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    is_manual_category = Column(Boolean, default=False)
    is_recurring_override = Column(Boolean, nullable=True)  # null = auto-detect, true/false = manual override
    is_transfer_override = Column(Boolean, nullable=True)   # null = auto-detect, true/false = manual override on internal-transfer detection
    # Payee canonique résolu par le moteur de catégorisation. Permet d'unifier
    # toutes les variantes de libellé d'un même marchand (FRANPRIX LEVALLOIS P,
    # FRANPRIX 5 RUE…) sous une seule entité affichable et requalifiable.
    payee_id = Column(String, ForeignKey("payees.id", ondelete="SET NULL"), nullable=True, index=True)
    # Source de la catégorisation pour audit : user_rule | payee_default |
    # learned_rule | builtin_rule | llm | unknown.
    cat_source = Column(String, nullable=True)
    notes = Column(Text, nullable=True, default="")
    tags = Column(JSON, nullable=False, default=list)  # transverse tags: ["vacances-2026", "pro", "cadeau"]
    # Hash for deduplication on import: account_id|date|amount|label_truncated
    dedup_hash = Column(String, nullable=False, index=True)
    # Source of the transaction: csv | manual | gocardless
    source = Column(String, nullable=False, default="manual", index=True)
    # Stable identifier from the bank aggregator (e.g. GoCardless transactionId).
    # When set, a unique (account_id, external_id) index dedups syncs across runs.
    external_id = Column(String, nullable=True, index=True)
    # Statut de revue par l'utilisateur — alimente la modale post-sync qui
    # invite à valider catégorie/payee des nouvelles tx importées via GoCardless.
    # NULL = pas besoin de revue (manual / CSV / déjà revue par l'user).
    # 'pending' = nouvelle tx importée par sync, en attente de validation.
    # 'reviewed' = l'user a explicitement validé.
    review_status = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    household = relationship("Household", back_populates="transactions")
    account = relationship("Account", back_populates="transactions")
    category = relationship("Category")

    __table_args__ = (
        UniqueConstraint("household_id", "dedup_hash", name="uq_household_dedup"),
        UniqueConstraint("account_id", "external_id", name="uq_account_external_id"),
        Index("ix_tx_household_date", "household_id", "date"),
    )


class Asset(Base):
    """Non-bank asset: real estate, life insurance, PEA, crypto, etc.

    Real-estate-specific fields (purchase_price, surface_m2, notary_fees,
    agency_fees, works_fees, furniture_fees, purchase_date,
    construction_year, ownership_pct, subtype) were added 2026-05-05 to
    feed the Finary-style "Ajouter mon immobilier" wizard. They're all
    optional and only meaningful when type == "real_estate".
    """
    __tablename__ = "assets"

    id = Column(String, primary_key=True, default=_uuid)
    type = Column(String, nullable=False)  # real_estate | life_insurance | pea | per | savings_account | crypto | stocks | other_asset
    name = Column(String, nullable=False)
    current_value = Column(Float, nullable=False, default=0.0)
    # ISO 4217 — see Account.currency comment.
    currency = Column(String, nullable=False, default="EUR")
    # Live-pricing — when set, the frontend overrides current_value with
    # quantity × live_price coming from /quotes (Yahoo Finance). Empty
    # ticker means the asset stays manually-valued (real estate, livret, …).
    # Examples: AAPL, MSFT, CW8.PA (Amundi MSCI World on Euronext), BTC-EUR.
    ticker = Column(String, nullable=True, index=True)
    isin   = Column(String, nullable=True)             # ISO 6166 — e.g. FR0007054358
    quantity = Column(Float, nullable=True)
    notes = Column(Text, nullable=True, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Real-estate enrichment — Finary parity
    subtype = Column(String, nullable=True)              # RP | locative | secondaire | scpi | other
    purchase_price = Column(Float, nullable=True)
    surface_m2 = Column(Float, nullable=True)
    notary_fees = Column(Float, nullable=True)
    agency_fees = Column(Float, nullable=True)
    works_fees = Column(Float, nullable=True)
    furniture_fees = Column(Float, nullable=True)
    purchase_date = Column(Date, nullable=True)
    construction_year = Column(Integer, nullable=True)
    ownership_pct = Column(Float, nullable=True, default=100.0)
    address = Column(String, nullable=True)              # liée à l'emprunt si tu veux

    # Stable UUID shared with the wealth_items table — Option A++ unification
    # preparation (2026-05-13). See Account.wealth_item_uuid.
    wealth_item_uuid = Column(String, nullable=True)

    # Child positions reference the parent envelope (PEA/CTO/AV/crypto).
    # Nullable: top-level assets keep parent_asset_id = NULL. v1 of the
    # Boursorama CSV import (2026-05-13) creates child rows with
    # type='stocks' and parent_asset_id = the open envelope's id.
    parent_asset_id = Column(String, ForeignKey("assets.id", ondelete="CASCADE"), nullable=True, index=True)

    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    household = relationship("Household", back_populates="assets")
    members = relationship("Member", secondary=asset_members, back_populates="assets")


class Liability(Base):
    """A loan: mortgage, consumer credit, auto loan, etc.

    Enriched fields (added 2026-05-05) drive the Finary-style detail view:
    amortization schedule, mensualité breakdown (capital / intérêts /
    assurance), %-remboursé, coût total. They're all optional — legacy
    rows still render, just without the breakdown.
    """
    __tablename__ = "liabilities"

    id = Column(String, primary_key=True, default=_uuid)
    type = Column(String, nullable=False)  # mortgage | consumer_loan | auto_loan | other_loan
    name = Column(String, nullable=False)
    initial_capital = Column(Float, nullable=False, default=0.0)   # original principal
    remaining_capital = Column(Float, nullable=False, default=0.0) # current outstanding
    monthly_payment = Column(Float, nullable=False, default=0.0)   # full mensualité (P+I+A)
    # ISO 4217 — see Account.currency comment.
    currency = Column(String, nullable=False, default="EUR")
    interest_rate = Column(Float, nullable=False, default=0.0)     # annual rate %
    end_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True, default="")

    # Enriched
    down_payment = Column(Float, nullable=True)            # apport
    insurance_rate = Column(Float, nullable=True)          # annual % of initial capital
    application_fees = Column(Float, nullable=True)        # frais de dossier (one-shot)
    ownership_pct = Column(Float, nullable=True, default=100.0)  # détention de l'emprunt
    duration_months = Column(Integer, nullable=True)       # total duration
    start_date = Column(Date, nullable=True)               # first echéance
    linked_asset_id = Column(String, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)

    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    household = relationship("Household", back_populates="liabilities")
    members = relationship("Member", secondary=liability_members, back_populates="liabilities")
    linked_asset = relationship("Asset", foreign_keys=[linked_asset_id])


class Category(Base):
    """Spending category. Each household gets a default set on creation.
    parent_slug is the slug of the parent top-level category — NULL means
    this row IS a top-level category. Two-level taxonomy only (no grandparents)."""
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=_uuid)
    slug = Column(String, nullable=False)  # stable identifier: "groceries", "salary", etc.
    name = Column(String, nullable=False)
    color = Column(String, nullable=False, default="#9ca3af")
    icon = Column(String, nullable=False, default="❓")
    type = Column(String, nullable=False)  # income | expense | transfer
    kind = Column(String, nullable=False, default="needs")  # needs | wants | savings (for 50/30/20)
    parent_slug = Column(String, nullable=True)  # parent category slug, NULL = top-level

    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    household = relationship("Household", back_populates="categories")

    __table_args__ = (
        UniqueConstraint("household_id", "slug", name="uq_household_category_slug"),
    )


class CategorisationRule(Base):
    """Custom regex rules learned from manual category overrides.

    Trois provenances possibles (`created_by`) :
    - 'user' : créée explicitement par l'utilisateur via la modale
    - 'learning' : créée auto par le Category Learning après N recatégorisations
                   manuelles du même payee dans la même catégorie
    - 'builtin' : héritée d'une règle livrée d'origine (rare, généralement
                   on préfère cibler le payee directement)
    """
    __tablename__ = "categorisation_rules"

    id = Column(String, primary_key=True, default=_uuid)
    pattern = Column(String, nullable=False)  # regex source ou substring
    category_slug = Column(String, nullable=False)
    source = Column(String, default="manual")  # manual | learned (legacy, gardé pour compat)
    # Provenance enrichie pour le filtrage UI et le debug.
    created_by = Column(String, default="user", nullable=False)  # user | learning | builtin
    # Type de la règle : 'category' (assigne une catégorie) ou 'transfer'
    # (flag comme virement interne). Permet de gérer les top-ups vers cartes
    # secondaires non connectées (Revolut**, Lydia, etc.).
    rule_type = Column(String, default="category", nullable=False)  # category | transfer
    # Pour rule_type='transfer' : compte cible du virement. Le type
    # (savings / secondary) est dérivé du role du compte au runtime côté
    # frontend. Nullable (legacy / sans destination explicite).
    transfer_dest_account_id = Column(String, nullable=True)
    # Si la règle est attachée à un payee canonique, on persiste la FK.
    # Utile pour l'apprentissage : une règle apprise cible un payee, pas
    # juste un pattern regex flou.
    payee_id = Column(String, ForeignKey("payees.id", ondelete="CASCADE"), nullable=True)
    # Priorité d'application : user=100, learning=50, builtin=10. Plus haut = appliqué d'abord.
    priority = Column(Integer, default=100, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    household = relationship("Household", back_populates="rules")


class Payee(Base):
    """Marchand canonique scopé au foyer.

    Inspiration Actual Budget : on identifie d'abord QUI est le bénéficiaire
    (Uber, Franprix, MAIF…) avant de raisonner sur la catégorie. Toutes les
    variantes du libellé brut bancaire pointent vers le même Payee, ce qui
    permet à l'utilisateur de requalifier une catégorie en un seul endroit
    au lieu de toucher 50 règles regex distinctes.
    """
    __tablename__ = "payees"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)  # Nom canonique affiché ("Uber", "Franprix")
    default_category_id = Column(String, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    is_transfer = Column(Boolean, default=False, nullable=False)  # Virement interne (Revolut, Lydia self-transfer…)
    created_by = Column(String, default="user", nullable=False)   # builtin | import | user | learning
    created_at = Column(DateTime, default=datetime.utcnow)

    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)

    __table_args__ = (
        # Évite les doublons de payees (case-insensitive géré côté code).
        UniqueConstraint("household_id", "name", name="uq_household_payee_name"),
    )


class PayeeMatchRule(Base):
    """Règle de résolution libellé brut → Payee canonique.

    Distincte de CategorisationRule (qui mappe pattern → catégorie). Ici on
    mappe pattern → payee. Le payee porte ensuite la catégorie par défaut.
    """
    __tablename__ = "payee_match_rules"

    id = Column(String, primary_key=True, default=_uuid)
    payee_id = Column(String, ForeignKey("payees.id", ondelete="CASCADE"), nullable=False, index=True)
    match_type = Column(String, nullable=False, default="contains")  # exact | contains | regex
    pattern = Column(String, nullable=False)
    priority = Column(Integer, default=0, nullable=False)            # plus haut = appliqué d'abord
    match_against = Column(String, default="both", nullable=False)   # merchant | raw | both
    created_by = Column(String, default="user", nullable=False)      # builtin | user | learning
    created_at = Column(DateTime, default=datetime.utcnow)

    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)


class Budget(Base):
    """A budget cap per category, per household."""
    __tablename__ = "budgets"

    id = Column(String, primary_key=True, default=_uuid)
    category_slug = Column(String, nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    household = relationship("Household", back_populates="budgets")

    __table_args__ = (
        UniqueConstraint("household_id", "category_slug", name="uq_household_budget"),
    )


class Goal(Base):
    """A savings goal (vacation, house deposit, etc.)."""
    __tablename__ = "goals"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    emoji = Column(String, default="🎯")
    target_amount = Column(Float, nullable=False, default=0.0)
    current_amount = Column(Float, nullable=False, default=0.0)
    deadline = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    household = relationship("Household", back_populates="goals")


class BankConnection(Base):
    """A GoCardless Bank Account Data connection for automatic tx sync."""
    __tablename__ = "bank_connections"

    id = Column(String, primary_key=True, default=_uuid)
    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String, nullable=True)           # GoCardless requisition_id
    bank_name = Column(String, nullable=False)           # GoCardless institution_id
    bank_country = Column(String, default="FR")
    status = Column(String, default="pending")           # pending | authorized | error
    state = Column(String, nullable=True)                # CSRF / ?ref= reference
    accounts_data = Column(JSON, nullable=True)          # enriched GoCardless accounts list
    error_message = Column(Text, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    household = relationship("Household", back_populates="bank_connections")


class Achievement(Base):
    """Unlocked gamification achievement."""
    __tablename__ = "achievements"

    id = Column(String, primary_key=True, default=_uuid)
    achievement_slug = Column(String, nullable=False)  # first_import, first_member, etc.
    unlocked_at = Column(DateTime, default=datetime.utcnow)

    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    household = relationship("Household", back_populates="achievements")

    __table_args__ = (
        UniqueConstraint("household_id", "achievement_slug", name="uq_household_achievement"),
    )


class PasswordResetToken(Base):
    """Single-use token sent to a user's email to reset their password.

    Stored as a SHA-256 hash so a leaked DB row cannot be replayed
    against the live link. Tokens expire after 60 minutes.
    """
    __tablename__ = "password_reset_tokens"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class WealthSnapshot(Base):
    """Monthly snapshot of household net worth.

    One row per (household, year-month). Lets the frontend render a real
    patrimoine evolution curve — without it, the only history available
    came from bank-account balances rolled forward from transactions,
    which excluded assets / liabilities valued in the wealth tab.

    The frontend POSTs a snapshot on first load each month (idempotent —
    upserts on the unique constraint), so the timeline is always current.
    """
    __tablename__ = "wealth_snapshots"

    id = Column(String, primary_key=True, default=_uuid)
    month = Column(String, nullable=False)  # 'YYYY-MM'
    captured_at = Column(DateTime, default=datetime.utcnow)

    # All values in EUR, household-level (sum across members).
    net_worth = Column(Float, nullable=False, default=0.0)
    liquid_wealth = Column(Float, nullable=False, default=0.0)
    assets_value = Column(Float, nullable=False, default=0.0)
    liabilities_value = Column(Float, nullable=False, default=0.0)

    # Breakdown — added 2026-05-05 to power the brut / net / financier toggle
    # in the Synthèse view. Nullable for backwards compatibility; older
    # snapshots simply fall back to the aggregate values above.
    real_estate_value = Column(Float, nullable=True)        # subset of assets_value
    financial_assets_value = Column(Float, nullable=True)   # liquid + non-RE assets
    mortgage_debt = Column(Float, nullable=True)            # subset of liabilities_value
    other_debt = Column(Float, nullable=True)               # liabilities - mortgage

    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    household = relationship("Household")

    __table_args__ = (
        UniqueConstraint("household_id", "month", name="uq_household_snapshot_month"),
    )



# Association table — FixedCharge can be assigned to specific household members
fixed_charge_members = Table(
    "fixed_charge_members",
    Base.metadata,
    Column("fixed_charge_id", String, ForeignKey("fixed_charges.id", ondelete="CASCADE"), primary_key=True),
    Column("member_id", String, ForeignKey("members.id", ondelete="CASCADE"), primary_key=True),
)


class FixedCharge(Base):
    """A stable monthly charge defined by the user.

    Unlike auto-detected recurring expenses (which derive from imported
    transactions), these are explicit and stay constant unless the user
    edits them. They drive the "Reste à vivre" calculation in Suivi
    mensuel: revenus - sum(active fixed charges).

    Activity window:
    - `start_month` (YYYY-MM): the charge is active starting from this
      month. Defaults to the creation month, so an "added today" charge
      counts from now.
    - `end_month` (YYYY-MM, nullable): if set, charge stops being counted
      after that month. Useful for time-bounded subscriptions.
    """
    __tablename__ = "fixed_charges"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    day_of_month = Column(Integer, nullable=True)  # 1-31 — informational
    category_slug = Column(String, nullable=True)
    start_month = Column(String, nullable=False)   # 'YYYY-MM'
    end_month = Column(String, nullable=True)      # 'YYYY-MM' or null
    notes = Column(Text, nullable=True, default="")
    # 'expense' (default — loyer, abonnement…) or 'income' (salaire, rente…).
    # Lets the Suivi mensuel Revenus group surface planned recurring income
    # the same way it surfaces planned recurring charges.
    kind = Column(String, nullable=False, default="expense", server_default="expense")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    household = relationship("Household", back_populates="fixed_charges")
    members = relationship("Member", secondary=fixed_charge_members)


class DcaPlan(Base):
    """A systematic investment plan (Dollar Cost Averaging).

    Represents a recurring buy order: e.g. 'invest 300€/month in CW8.PA
    from my PEA account on the 1st of each month'.
    The backend stores the plan; all projection math runs on the frontend.
    """
    __tablename__ = "dca_plans"

    id           = Column(String, primary_key=True, default=_uuid)
    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    name         = Column(String, nullable=False)          # "DCA ETF Monde"
    ticker       = Column(String, nullable=True)           # "CW8.PA"
    asset_name   = Column(String, nullable=True)           # human label if no ticker
    amount       = Column(Float, nullable=False)           # amount per period
    currency     = Column(String, default="EUR")
    frequency    = Column(String, default="monthly")       # monthly | quarterly | annual
    day_of_month = Column(Integer, default=1)              # 1–28
    account_id   = Column(String, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    start_date   = Column(String, nullable=True)           # "YYYY-MM-DD"
    status       = Column(String, default="active")        # active | paused | stopped
    target_years = Column(Integer, default=10)             # projection horizon
    expected_return = Column(Float, default=7.0)           # annual % for projection
    notes        = Column(Text, nullable=True)
    member_ids   = Column(JSON, default=list)
    # Per-month execution status: { "2026-01": true, "2026-02": false, ... }
    # Missing keys default to true for past months (the user only marks
    # exceptions). Keeps backward-compat with existing plans.
    executions   = Column(JSON, default=dict, nullable=False, server_default='{}')

    # Reminders (mig 0009). Cron Railway scanne chaque jour les plans actifs
    # avec reminder_email_enabled=true ET next_execution_date - today <=
    # reminder_lead_days -> envoie un email via Resend ('Pense a investir
    # 300€ sur ton DCA ETF Monde le 1er mars').
    reminder_email_enabled = Column(Boolean, default=False, nullable=False)
    reminder_lead_days     = Column(Integer, default=2, nullable=False)  # jours avant l'execution

    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    household    = relationship("Household")


class PlannedEvent(Base):
    """A one-off, future-dated cash movement entered by the user.

    The missing brick for the forward cash-flow projection (Vue Projection).
    Unlike FixedCharge (recurring) and RefMonth (typical month), a planned
    event happens ONCE on a specific date — e.g. '−4 200 € impôts le
    2026-09-15' or '+1 500 € prime le 2026-12-01'.

    `direction`: 'out' (sortie, default) or 'in' (entrée). `amount` is
    always stored positive; the sign is derived from direction at
    projection time.

    `account_id` is optional: when set, the event is attributed to a
    specific liquid account (e.g. 'je puise dans le Livret A'), which lets
    the per-account projection stay accurate. When null, it applies to the
    aggregate liquid balance.
    """
    __tablename__ = "planned_events"

    id           = Column(String, primary_key=True, default=_uuid)
    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    label        = Column(String, nullable=False)
    amount       = Column(Float, nullable=False, default=0.0)   # always positive
    direction    = Column(String, nullable=False, default="out")  # 'in' | 'out'
    date         = Column(Date, nullable=False, index=True)      # the day it hits
    account_id   = Column(String, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    category_slug = Column(String, nullable=True)
    notes        = Column(Text, nullable=True, default="")

    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    household    = relationship("Household")


class Document(Base):
    """Coffre-fort — un document stocké par l'utilisateur (facture, bail,
    justificatif, attestation d'assurance…).

    v1 : les octets sont stockés directement en base (LargeBinary), avec un
    plafond de taille appliqué côté router. Auto-suffisant — aucun bucket ni
    service externe à configurer. Une v2 pourra migrer vers Supabase Storage
    (déplacer `data` vers un object store et garder ici l'URL signée).

    Liens optionnels vers un compte ou un actif, pour retrouver le bail d'un
    bien immobilier ou la facture liée à un compte.
    """
    __tablename__ = "documents"

    id            = Column(String, primary_key=True, default=_uuid)
    household_id  = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    filename      = Column(String, nullable=False)
    content_type  = Column(String, nullable=False, default="application/octet-stream")
    size_bytes    = Column(Integer, nullable=False, default=0)
    category      = Column(String, nullable=True)  # facture | bail | assurance | justificatif | autre
    account_id    = Column(String, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    asset_id      = Column(String, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    notes         = Column(Text, nullable=True, default="")
    data          = Column(LargeBinary, nullable=False)  # octets du fichier

    created_at    = Column(DateTime, default=datetime.utcnow)

    household     = relationship("Household")


class Notification(Base):
    """Alerte intelligente générée par le moteur de détection.

    Le moteur tourne de façon idempotente (sur sync + refresh à l'ouverture) :
    chaque alerte a une `dedup_key` stable par foyer pour ne JAMAIS créer de
    doublon quand on re-scanne (ex: 'budget_overrun:restaurants:2026-06').

    `kind` (catalogue) : unusual_debit | subscription_hike | duplicate_charge |
                         budget_overrun | fixed_charge_unpaid | low_balance |
                         income_missing | savings_goal
    `severity` : info | warn | critical
    `status`   : unread | read | dismissed
    `data`     : payload JSON (montants, période…) pour le rendu front + email.
    `link`     : vue cible au clic (ex: 'transactions', 'monthly', 'projection').
    """
    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint("household_id", "dedup_key", name="uq_notif_dedup"),
        Index("ix_notif_household_status", "household_id", "status"),
    )

    id           = Column(String, primary_key=True, default=_uuid)
    household_id = Column(String, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    dedup_key    = Column(String, nullable=False)
    kind         = Column(String, nullable=False)
    severity     = Column(String, nullable=False, default="info")
    title        = Column(String, nullable=False)
    body         = Column(Text, nullable=False, default="")
    data         = Column(JSON, nullable=False, default=dict)
    link         = Column(String, nullable=True)
    status       = Column(String, nullable=False, default="unread", index=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    household    = relationship("Household")


class AiState(Base):
    """État IA par foyer (1 ligne/foyer) : cache du Coach + compteur mensuel.

    - `coach_cache` / `coach_cached_at` : dernier résultat du Coach (Sonnet),
      réutilisé pendant AI_COACH_CACHE_HOURS → au plus 1 appel/jour/foyer.
    - `period` (YYYY-MM) + `month_count` : nombre d'appels IA réels ce mois →
      plafonné par AI_MONTHLY_CAP (au-delà = fallback déterministe).
    Garde-fou anti token-burn, le tout sur la clé serveur unique.
    """
    __tablename__ = "ai_state"

    household_id   = Column(String, ForeignKey("households.id", ondelete="CASCADE"), primary_key=True)
    period         = Column(String, nullable=True)        # 'YYYY-MM'
    month_count    = Column(Integer, nullable=False, default=0)
    coach_cache    = Column(JSON, nullable=True)
    coach_cached_at = Column(DateTime, nullable=True)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    household      = relationship("Household")
