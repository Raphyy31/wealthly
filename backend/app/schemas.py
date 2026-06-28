"""
Pydantic schemas — define the JSON shapes accepted and returned by the API.
- *Create schemas: input for POST endpoints
- *Update schemas: input for PUT/PATCH endpoints (all fields optional)
- *Out schemas: output (what the client sees)
"""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ============================================================================
# AUTH
# ============================================================================

class UserCreate(BaseModel):
    email: EmailStr
    # min_length matches validate_password() rule (sec-audit 2026-05-19: was 8)
    password: str = Field(min_length=10)
    full_name: str
    household_name: Optional[str] = "Mon foyer"


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = None  # 6 chiffres si 2FA activé


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ============================================================================
# 2FA TOTP (C19 2026-05-18)
# ============================================================================

class TotpSetupOut(BaseModel):
    """Réponse de POST /auth/totp/setup — affiche le QR + secret manuel."""
    secret: str  # base32 à afficher en backup
    otpauth_uri: str  # otpauth://totp/Wealthly:email?secret=...&issuer=Wealthly


class TotpVerifyIn(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class TotpDisableIn(BaseModel):
    password: str  # exige le mot de passe pour désactiver (anti-takeover)


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    is_admin: bool
    household_id: str
    member_id: Optional[str] = None
    # 2FA TOTP state — exposé pour permettre au frontend de forcer le setup
    # quand obligatoire (politique sécu 2026-05-19).
    totp_enabled: bool = False

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# MEMBERS
# ============================================================================

class MemberBase(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    role: str = "adult"  # adult | child
    color: str = Field(default="#3b82f6", max_length=20)


class MemberCreate(MemberBase):
    pass


class MemberUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=80)
    role: Optional[str] = None
    color: Optional[str] = Field(default=None, max_length=20)


class MemberOut(MemberBase):
    id: str
    household_id: str
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# ACCOUNTS
# ============================================================================

class AccountBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    bank: Optional[str] = Field(default=None, max_length=120)
    type: str = "checking"
    role: str = "principal"  # principal | depenses | epargne | investissement | professionnel
    is_joint: bool = False  # flag compte joint famille (indépendant du rôle)
    iban: Optional[str] = Field(default=None, max_length=40)
    initial_balance: float = 0.0
    currency: str = Field(default="EUR", max_length=8)  # ISO 4217 (EUR / USD / GBP / CHF / …)


class AccountCreate(AccountBase):
    member_ids: List[str] = []


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    bank: Optional[str] = None
    type: Optional[str] = None
    role: Optional[str] = None
    is_joint: Optional[bool] = None
    iban: Optional[str] = None
    initial_balance: Optional[float] = None
    currency: Optional[str] = None
    member_ids: Optional[List[str]] = None


class AccountOut(AccountBase):
    id: str
    household_id: str
    member_ids: List[str] = []
    current_balance: float = 0.0  # computed: initial + sum(transactions)
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# TRANSACTIONS
# ============================================================================

class TransactionBase(BaseModel):
    account_id: str
    date: date
    label: str = Field(default="", max_length=500)
    amount: float
    category_slug: Optional[str] = Field(default=None, max_length=80)
    is_manual_category: bool = False
    is_recurring_override: Optional[bool] = None
    is_transfer_override: Optional[bool] = None
    notes: Optional[str] = Field(default="", max_length=2000)
    tags: List[str] = Field(default_factory=list, max_length=20)


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    label: Optional[str] = Field(default=None, max_length=500)
    category_slug: Optional[str] = Field(default=None, max_length=80)
    is_manual_category: Optional[bool] = None
    is_recurring_override: Optional[bool] = None
    is_transfer_override: Optional[bool] = None
    notes: Optional[str] = Field(default=None, max_length=2000)
    tags: Optional[List[str]] = Field(default=None, max_length=20)
    # 'reviewed' pour clore la revue post-sync. Restreint côté router.
    review_status: Optional[str] = Field(default=None, max_length=16)


class TransactionOut(TransactionBase):
    id: str
    household_id: str
    payee_id: Optional[str] = None
    payee_name: Optional[str] = None
    cat_source: Optional[str] = None
    review_status: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class TransactionImport(BaseModel):
    """Bulk import endpoint: list of transactions to insert (deduped server-side)."""
    account_id: str
    transactions: List[TransactionCreate]


class TransactionImportResult(BaseModel):
    inserted: int
    skipped_duplicates: int


# ============================================================================
# ASSETS
# ============================================================================

class AssetBase(BaseModel):
    type: str = Field(max_length=40)
    name: str = Field(min_length=1, max_length=200)
    current_value: float = 0.0
    currency: str = Field(default="EUR", max_length=8)  # ISO 4217
    # Live-pricing: when ticker + quantity are set, the frontend overrides
    # current_value with quantity × live_price (Yahoo Finance via /quotes).
    ticker: Optional[str] = Field(default=None, max_length=20)
    isin: Optional[str] = Field(default=None, max_length=20)  # ISO 6166 — e.g. FR0007054358
    quantity: Optional[float] = None
    notes: Optional[str] = Field(default="", max_length=2000)
    # Real estate enrichment — all optional, used by the immo wizard
    subtype: Optional[str] = Field(default=None, max_length=40)
    purchase_price: Optional[float] = None
    surface_m2: Optional[float] = None
    notary_fees: Optional[float] = None
    agency_fees: Optional[float] = None
    works_fees: Optional[float] = None
    furniture_fees: Optional[float] = None
    purchase_date: Optional[date] = None
    construction_year: Optional[int] = None
    ownership_pct: Optional[float] = 100.0
    address: Optional[str] = Field(default=None, max_length=300)
    # Parent envelope (PEA/CTO/AV/crypto) when this asset is an
    # imported position. Null for top-level assets.
    parent_asset_id: Optional[str] = None


class AssetCreate(AssetBase):
    member_ids: List[str] = []


class AssetUpdate(BaseModel):
    type: Optional[str] = Field(default=None, max_length=40)
    name: Optional[str] = Field(default=None, max_length=200)
    current_value: Optional[float] = None
    currency: Optional[str] = Field(default=None, max_length=8)
    ticker: Optional[str] = Field(default=None, max_length=20)
    isin: Optional[str] = Field(default=None, max_length=20)
    quantity: Optional[float] = None
    notes: Optional[str] = Field(default=None, max_length=2000)
    member_ids: Optional[List[str]] = None
    subtype: Optional[str] = Field(default=None, max_length=40)
    purchase_price: Optional[float] = None
    surface_m2: Optional[float] = None
    notary_fees: Optional[float] = None
    agency_fees: Optional[float] = None
    works_fees: Optional[float] = None
    furniture_fees: Optional[float] = None
    purchase_date: Optional[date] = None
    construction_year: Optional[int] = None
    ownership_pct: Optional[float] = None
    address: Optional[str] = Field(default=None, max_length=300)
    parent_asset_id: Optional[str] = None


class AssetOut(AssetBase):
    id: str
    household_id: str
    member_ids: List[str] = []
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# LIABILITIES
# ============================================================================

class LiabilityBase(BaseModel):
    type: str = Field(max_length=40)
    name: str = Field(min_length=1, max_length=200)
    initial_capital: float = 0.0
    remaining_capital: float = 0.0
    monthly_payment: float = 0.0
    interest_rate: float = 0.0
    end_date: Optional[date] = None
    currency: str = Field(default="EUR", max_length=8)  # ISO 4217
    notes: Optional[str] = Field(default="", max_length=2000)
    # Enriched fields — all optional, legacy loans still load fine
    down_payment: Optional[float] = None
    insurance_rate: Optional[float] = None
    application_fees: Optional[float] = None
    ownership_pct: Optional[float] = 100.0
    duration_months: Optional[int] = None
    start_date: Optional[date] = None
    linked_asset_id: Optional[str] = None


class LiabilityCreate(LiabilityBase):
    member_ids: List[str] = []


class LiabilityUpdate(BaseModel):
    type: Optional[str] = Field(default=None, max_length=40)
    name: Optional[str] = Field(default=None, max_length=200)
    initial_capital: Optional[float] = None
    remaining_capital: Optional[float] = None
    monthly_payment: Optional[float] = None
    interest_rate: Optional[float] = None
    end_date: Optional[date] = None
    currency: Optional[str] = Field(default=None, max_length=8)
    notes: Optional[str] = Field(default=None, max_length=2000)
    member_ids: Optional[List[str]] = None
    down_payment: Optional[float] = None
    insurance_rate: Optional[float] = None
    application_fees: Optional[float] = None
    ownership_pct: Optional[float] = None
    duration_months: Optional[int] = None
    start_date: Optional[date] = None
    linked_asset_id: Optional[str] = None


class LiabilityOut(LiabilityBase):
    id: str
    household_id: str
    member_ids: List[str] = []
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# CATEGORIES
# ============================================================================

class CategoryOut(BaseModel):
    id: str
    slug: str
    name: str
    color: str
    icon: str
    type: str
    kind: str
    parent_slug: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=80)
    color: Optional[str] = Field(default=None, max_length=20)
    icon: Optional[str] = Field(default=None, max_length=20)
    kind: Optional[str] = None


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str = Field(default="#9ca3af", max_length=20)
    icon: str = Field(default="🏷️", max_length=20)
    type: str = "expense"  # income | expense | transfer
    kind: str = "needs"    # needs | wants | savings
    parent_slug: Optional[str] = Field(default=None, max_length=80)


# ============================================================================
# BUDGETS
# ============================================================================

class BudgetSet(BaseModel):
    category_slug: str
    amount: float


class BudgetOut(BaseModel):
    category_slug: str
    amount: float
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# GOALS
# ============================================================================

class GoalBase(BaseModel):
    name: str
    emoji: str = "🎯"
    target_amount: float = 0.0
    current_amount: float = 0.0
    deadline: Optional[date] = None


class GoalCreate(GoalBase):
    pass


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    emoji: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    deadline: Optional[date] = None


class GoalOut(GoalBase):
    id: str
    household_id: str
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# ACHIEVEMENTS
# ============================================================================

class AchievementOut(BaseModel):
    achievement_slug: str
    unlocked_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# RULES (auto-categorisation)
# ============================================================================

class RuleCreate(BaseModel):
    pattern: str
    category_slug: Optional[str] = None
    source: str = "manual"
    created_by: str = "user"         # user | learning | builtin
    rule_type: str = "category"      # category | transfer
    payee_id: Optional[str] = None
    priority: int = 100
    transfer_dest_account_id: Optional[str] = None  # cible du virement (rule_type=transfer)


class RuleOut(BaseModel):
    id: str
    pattern: str
    category_slug: Optional[str] = None
    source: str = "manual"
    created_by: str = "user"
    rule_type: str = "category"
    payee_id: Optional[str] = None
    priority: int = 100
    transfer_dest_account_id: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# WEALTH SNAPSHOTS
# ============================================================================

class WealthSnapshotCreate(BaseModel):
    month: str  # 'YYYY-MM'
    net_worth: float
    liquid_wealth: float
    assets_value: float
    liabilities_value: float
    real_estate_value: Optional[float] = None
    financial_assets_value: Optional[float] = None
    mortgage_debt: Optional[float] = None
    other_debt: Optional[float] = None


class WealthSnapshotOut(WealthSnapshotCreate):
    id: str
    captured_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# PASSWORD RESET
# ============================================================================

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class MessageOut(BaseModel):
    message: str


# ============================================================================
# RefMonth — Mois type budget template (per user, JSON blob)
# ============================================================================
class RefMonthLine(BaseModel):
    id: str
    category_id: Optional[str] = None
    kind: str  # "income" | "expense" | "saving"
    label: str
    amount: float
    locked: bool = False


class RefMonthIn(BaseModel):
    version: int = 1
    lines: List[RefMonthLine] = []


class RefMonthOut(BaseModel):
    version: int = 1
    updated_at: Optional[str] = None
    lines: List[RefMonthLine] = []
