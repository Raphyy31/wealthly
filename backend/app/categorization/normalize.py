"""Normalisation des libellés bancaires bruts.

Les libellés Crédit Agricole / BNP / SocGen ressemblent à :
  "Paiement par carte\\nPAIEMENT PAR CARTE X8987 FRANPRIX LEVALLOIS  12/04"
  "Prélèvement\\nPRELEVEMENT MAIF 79038 NIORT FR70ZZZ000884"
  "Retrait au distributeur\\nRETRAIT AU DISTRIBUTEUR X8987 LEVALLOIS PERR 22H04"

On extrait :
  - operation_type (card_payment, direct_debit, transfer_*, atm_withdrawal…)
  - merchant : nom marchand nettoyé (MAJ, sans accents, sans préfixes/dates)
  - sepa_creditor_id : ex "FR70ZZZ000884" si présent
  - flags : SELF_TRANSFER, LOAN_INSTALLMENT, FOREIGN, REFUND…

`raw` est l'original UPPERCASED + désaccentué — sert de filet de sécurité
quand l'extraction du merchant rate (regex matchent contre les deux).
"""
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class NormalizedLabel:
    raw: str
    operation_type: str
    merchant: str
    sepa_creditor_id: Optional[str] = None
    flags: set = field(default_factory=set)


def _strip_accents(s: str) -> str:
    """Désaccentue via décomposition NFKD + filtrage des marques combinantes.

    Méthode canonique Python : robuste à tous les cas (français, espagnol,
    allemand, scandinave) sans table de correspondance fragile.
    """
    return "".join(
        c for c in unicodedata.normalize("NFKD", s)
        if not unicodedata.combining(c)
    )


# ─── Préfixes verbaux à retirer pour extraire le merchant ────────────────────
_PREFIX_PATTERNS = [
    (r"^PAIEMENT\s+PAR\s+CARTE\s+X\d+\s+",    "card_payment"),
    (r"^PRELEVEMENT\s+(SEPA\s+)?",            "direct_debit"),
    (r"^VIREMENT\s+EMIS\s+WEB\s*",            "transfer_out"),
    (r"^VIREMENT\s+EMIS\s+",                  "transfer_out"),
    (r"^VIREMENT\s+EN\s+VOTRE\s+FAVEUR\s+(DE\s+)?", "transfer_in"),
    (r"^VIREMENT\s+RECU\s+",                  "transfer_in"),
    (r"^RETRAIT\s+AU\s+DISTRIBUTEUR\s+X\d+\s+", "atm_withdrawal"),
    (r"^RETRAIT\s+DAB\s+",                    "atm_withdrawal"),
    (r"^VERSEMENT\s+D'?ESPECES\s+",           "cash_deposit"),
    (r"^COTISATION\s+",                       "fee"),
    (r"^CHEQUE\s+EMIS\s+\d*\s*",              "check"),
    (r"^FRAIS\s+",                            "fee"),
    (r"^INTERETS?\s+",                        "interest"),
    (r"^DEPENSE\s+ECHELONNEE\s*",             "card_payment"),  # AMEX
    (r"^RETRO\s+A\s+TITRE\s+COMMERCIAL\s+",   "interest"),
]

_SEPA_CREDITOR_RE = re.compile(r"\bFR\d{2}ZZZ\d+\b")
_DATE_SUFFIX_RE   = re.compile(r"\s+\d{2}/\d{2}(?:/\d{2,4})?\b")
_TIME_SUFFIX_RE   = re.compile(r"\s+\d{1,2}H\d{2}\b")
# Codes techniques en fin de chaîne après newline (Crédit Agricole format).
_TRAIL_TECH_RE    = re.compile(r"\n[A-Z0-9]{6,}.*$")
_WHITESPACE_RE    = re.compile(r"\s+")

# Patterns de détection pour les flags.
_SELF_TRANSFER_RE = re.compile(
    r"VIREMENT\s+(EMIS|EN\s+VOTRE\s+FAVEUR).*\b(M\.|MME|MONSIEUR|MADAME)\s+[A-Z]+\s+[A-Z]+"
)
_LOAN_INSTALLMENT_RE = re.compile(r"ECHEANCE\s+PRET|PRELEVEMENT\s+ECHEANCE")
_REFUND_RE           = re.compile(r"\bREMBOURSEMENT\b|\bREFUND\b")
_FOREIGN_RE          = re.compile(r"\bCOMMISSION\s+SUR\b|\bCHANGE\s+EN\b")


def normalize_label(raw: str) -> NormalizedLabel:
    """Transforme un libellé bancaire brut en NormalizedLabel structuré."""
    if not raw:
        return NormalizedLabel(raw="", operation_type="unknown", merchant="")

    # 1) Uppercase + accents → ASCII. On garde \n pour préserver la structure.
    upper = _strip_accents(raw.upper())

    # 2) SEPA creditor ID (avant nettoyage, il est en fin de chaîne).
    sepa_m = _SEPA_CREDITOR_RE.search(upper)
    sepa = sepa_m.group(0) if sepa_m else None

    # 3) Flags techniques (avant le nettoyage qui pourrait virer des mots-clés).
    flags = set()
    if _SELF_TRANSFER_RE.search(upper):
        flags.add("SELF_TRANSFER")
    if _LOAN_INSTALLMENT_RE.search(upper):
        flags.add("LOAN_INSTALLMENT")
    if _REFUND_RE.search(upper):
        flags.add("REFUND")
    if _FOREIGN_RE.search(upper):
        flags.add("FOREIGN")

    # 4) Détection de l'operation_type via les préfixes, et nettoyage du merchant.
    # Le raw_upper (avec \n) est conservé pour le filet de sécurité regex.
    # Le merchant part de la première ligne significative.
    lines = [l.strip() for l in upper.split("\n") if l.strip()]
    if not lines:
        return NormalizedLabel(raw=upper, operation_type="unknown", merchant="")

    # On cherche la ligne contenant le préfixe verbal (généralement la 2e).
    op_type = "unknown"
    merchant_line = lines[-1]  # Par défaut : la dernière ligne non vide.
    for line in lines:
        for pat, otype in _PREFIX_PATTERNS:
            if re.search(pat, line):
                op_type = otype
                # Le merchant est ce qui reste après le préfixe.
                merchant_line = re.sub(pat, "", line)
                break
        if op_type != "unknown":
            break

    # 5) Nettoyage final du merchant : retire dates, heures, codes SEPA, espaces.
    merchant = merchant_line
    merchant = _DATE_SUFFIX_RE.sub("", merchant)
    merchant = _TIME_SUFFIX_RE.sub("", merchant)
    merchant = _SEPA_CREDITOR_RE.sub("", merchant)
    merchant = _TRAIL_TECH_RE.sub("", merchant)
    merchant = _WHITESPACE_RE.sub(" ", merchant).strip()

    # Si après tout ça merchant est vide ou trop court, on tombe sur la dernière
    # ligne brute (sans préfixe retiré) — robustesse pour formats inhabituels.
    if len(merchant) < 2:
        merchant = lines[-1].strip()

    return NormalizedLabel(
        raw=upper.replace("\n", " ").strip(),  # raw aplati pour matching regex
        operation_type=op_type,
        merchant=merchant,
        sepa_creditor_id=sepa,
        flags=flags,
    )
