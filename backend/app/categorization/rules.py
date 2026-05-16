"""Règles builtin de catégorisation — bootstrap pour les nouveaux foyers.

~120 patterns regex compilés une fois au chargement du module. Chaque règle
peut soit :
  - créer un Payee canonique (`payee_name="Uber"`) + lui attacher la catégorie
  - assigner directement une catégorie (cas génériques type SALAIRE)
  - flag is_transfer (Revolut, N26, Lydia self-transfers)

Ordre : les règles plus spécifiques (longues) doivent être déclarées avant les
courtes pour éviter les faux matchs. Ex: `UBER EATS` avant `UBER`.
"""
import re
from dataclasses import dataclass, field
from typing import Optional, FrozenSet, Literal


# Note : pour les patterns courts (≤ 3 char) on AJOUTE \\b aux deux bouts pour
# éviter de matcher 'RATP' contre 'MIRATP'. Pour les longs et distinctifs
# (FRANPRIX, DELIVEROO) ce n'est pas nécessaire.

@dataclass(frozen=True)
class Rule:
    id: str
    slug: str
    pattern_str: str
    payee_name: Optional[str] = None
    priority: int = 0
    operation_types: FrozenSet[str] = field(default_factory=frozenset)
    amount_sign: Literal["debit", "credit", "any"] = "any"
    match_against: Literal["merchant", "raw", "both"] = "both"
    is_transfer: bool = False  # règle qui doit déclencher is_transfer_override
    notes: str = ""


def _r(id: str, slug: str, pattern: str, payee: Optional[str] = None, **kw) -> Rule:
    return Rule(id=id, slug=slug, pattern_str=pattern, payee_name=payee, **kw)


# ─── BUILTIN RULES ───────────────────────────────────────────────────────────
# Ordre : haut = priorité. Les multi-mots/longs viennent avant les courts.
BUILTIN_RULES: list[Rule] = [
    # ── Transferts internes (PRIORITY MAX) — détectés AVANT toute cat de dépense
    _r("xfer.revolut",  "uncategorized", r"REVOLUT(?:\*+\d*\*?|\*\*\d+)", payee="Revolut", is_transfer=True, priority=200),
    _r("xfer.n26",      "uncategorized", r"\bN26\b", payee="N26", is_transfer=True, priority=200),
    _r("xfer.lydia",    "uncategorized", r"\bLYDIA\b", payee="Lydia", is_transfer=True, priority=190, notes="P2P FR — peut aussi être paiement réel; user re-flag au cas par cas"),
    _r("xfer.wise",     "uncategorized", r"\bWISE\b|TRANSFERWISE", payee="Wise", is_transfer=True, priority=200),
    _r("xfer.bunq",     "uncategorized", r"\bBUNQ\b", payee="Bunq", is_transfer=True, priority=200),

    # ── Abonnements vidéo
    _r("subs.netflix",  "subs_video", r"\bNETFLIX\b", payee="Netflix", priority=100),
    _r("subs.disney",   "subs_video", r"\bDISNEY\s*\+?\b|DISNEYPLUS", payee="Disney+", priority=100),
    _r("subs.amazon_prime", "subs_video", r"AMAZON\s*PRIME\s*VIDEO|PRIME\s*VIDEO", payee="Prime Video", priority=110),
    _r("subs.canal",    "subs_video", r"CANAL\+|CANALPLUS|GROUPE\s*CANAL", payee="Canal+", priority=100),
    _r("subs.paramount","subs_video", r"PARAMOUNT\+?", payee="Paramount+", priority=100),
    _r("subs.mubi",     "subs_video", r"\bMUBI\b", payee="MUBI", priority=100),
    _r("subs.ocs",      "subs_video", r"\bOCS\b", payee="OCS", priority=100),
    _r("subs.molotov",  "subs_video", r"\bMOLOTOV\b", payee="Molotov", priority=100),
    _r("subs.apple_tv", "subs_video", r"APPLE\s*TV(?:\+|\s|$)", payee="Apple TV+", priority=110),

    # ── Abonnements musique
    _r("subs.spotify",  "subs_music", r"\bSPOTIFY\b", payee="Spotify", priority=100),
    _r("subs.deezer",   "subs_music", r"\bDEEZER\b", payee="Deezer", priority=100),
    _r("subs.apple_music", "subs_music", r"APPLE\s*MUSIC", payee="Apple Music", priority=110),
    _r("subs.youtube_music", "subs_music", r"YOUTUBE\s*MUSIC", payee="YouTube Music", priority=110),
    _r("subs.tidal",    "subs_music", r"\bTIDAL\b", payee="Tidal", priority=100),
    _r("subs.qobuz",    "subs_music", r"\bQOBUZ\b", payee="Qobuz", priority=100),

    # ── Cloud / SaaS / IA
    _r("subs.claude",   "subs_cloud", r"CLAUDE\.AI|ANTHROPIC", payee="Claude / Anthropic", priority=110),
    _r("subs.openai",   "subs_cloud", r"OPENAI|CHATGPT", payee="OpenAI", priority=110),
    _r("subs.github",   "subs_cloud", r"\bGITHUB\b", payee="GitHub", priority=100),
    _r("subs.vercel",   "subs_cloud", r"\bVERCEL\b", payee="Vercel", priority=100),
    _r("subs.railway",  "subs_cloud", r"\bRAILWAY\b", payee="Railway", priority=100),
    _r("subs.supabase", "subs_cloud", r"\bSUPABASE\b", payee="Supabase", priority=100),
    _r("subs.notion",   "subs_cloud", r"\bNOTION\b", payee="Notion", priority=100),
    _r("subs.linear",   "subs_cloud", r"\bLINEAR\b", payee="Linear", priority=100),
    _r("subs.figma",    "subs_cloud", r"\bFIGMA\b", payee="Figma", priority=100),
    _r("subs.adobe",    "subs_cloud", r"\bADOBE\b", payee="Adobe", priority=100),
    _r("subs.dropbox",  "subs_cloud", r"\bDROPBOX\b", payee="Dropbox", priority=100),
    _r("subs.icloud",   "subs_cloud", r"\bICLOUD\b", payee="iCloud", priority=100),
    _r("subs.google_storage", "subs_cloud", r"GOOGLE\s*(STORAGE|ONE|DRIVE)", payee="Google One", priority=110),

    # ── Apple/Google billing génériques
    _r("subs.apple_bill", "subs_services", r"APPLE\.COM\/BILL|APPLE\s*CORK|ITUNES", payee="Apple", priority=90),
    _r("subs.google_play","subs_services", r"GOOGLE\s*PLAY|GOOGLE\*", payee="Google Play", priority=90),

    # ── Sport / Gym
    _r("subs.gymness",  "subs_gym", r"GYMNESS", payee="Gymness", priority=100),
    _r("subs.basicfit", "subs_gym", r"BASIC\s*\-?\s*FIT", payee="Basic-Fit", priority=100),
    _r("subs.fitnesspark","subs_gym", r"FITNESS\s*PARK", payee="Fitness Park", priority=100),
    _r("subs.keepcool", "subs_gym", r"KEEPCOOL|KEEP\s*COOL", payee="Keepcool", priority=100),
    _r("subs.neoness",  "subs_gym", r"\bNEONESS\b", payee="Neoness", priority=100),
    _r("subs.urbansports","subs_gym", r"URBAN\s*SPORTS", payee="Urban Sports Club", priority=100),
    _r("subs.classpass","subs_gym", r"\bCLASSPASS\b", payee="ClassPass", priority=100),
    _r("subs.onair",    "subs_gym", r"\bON\s*AIR\b", payee="On Air", priority=90),

    # ── Presse
    _r("subs.lemonde",  "subs_press", r"LE\s*MONDE", payee="Le Monde", priority=100),
    _r("subs.liberation","subs_press", r"\bLIBERATION\b", payee="Libération", priority=100),
    _r("subs.mediapart","subs_press", r"\bMEDIAPART\b", payee="Mediapart", priority=100),
    _r("subs.lefigaro", "subs_press", r"LE\s*FIGARO", payee="Le Figaro", priority=100),
    _r("subs.lesechos", "subs_press", r"LES\s*ECHOS", payee="Les Échos", priority=100),
    _r("subs.lequipe",  "subs_press", r"L'?\s*EQUIPE", payee="L'Équipe", priority=100),
    _r("subs.telerama", "subs_press", r"\bTELERAMA\b", payee="Télérama", priority=100),
    _r("subs.nyt",      "subs_press", r"NEW\s*YORK\s*TIMES|NYTIMES", payee="The New York Times", priority=100),

    # ── Transport — VTC / Taxi (UBER EATS doit gagner contre UBER)
    _r("transport.ubereats","resto_delivery", r"UBER\s*\*?\s*EATS", payee="Uber Eats", priority=130),
    _r("transport.uber",   "taxi_vtc", r"\bUBER\b(?!\s*\*?\s*EATS)", payee="Uber", priority=100),
    _r("transport.bolt",   "taxi_vtc", r"\bBOLT(?:\.EU)?\b", payee="Bolt", priority=100),
    _r("transport.heetch", "taxi_vtc", r"\bHEETCH\b", payee="Heetch", priority=100),
    _r("transport.freenow","taxi_vtc", r"FREENOW|FREE\s*NOW", payee="FREE NOW", priority=100),
    _r("transport.kapten", "taxi_vtc", r"\bKAPTEN\b|\bMARCEL\b", payee="Marcel", priority=100),
    _r("transport.lyft",   "taxi_vtc", r"\bLYFT\b", payee="Lyft", priority=100),

    # ── Transport — public
    _r("transport.ratp",   "public_transport", r"\bRATP\b", payee="RATP", priority=100),
    _r("transport.navigo", "public_transport", r"\bNAVIGO\b|IDFM\b|ILE\s*DE\s*FRANCE\s*MOBILITES", payee="Navigo", priority=100),
    _r("transport.sncf_tgv","travel_train", r"SNCF.*TGV|\bOUIGO\b|TRAINLINE|THALYS|EUROSTAR", payee="SNCF Voyages", priority=110),
    _r("transport.sncf",   "public_transport", r"\bSNCF\b", payee="SNCF", priority=90),
    _r("transport.newrest","travel_train", r"NEWREST\s*WAGONS|WAGONS-LITS", payee="Newrest Wagons-Lits", priority=100, notes="Resto à bord du train"),

    # ── Vols
    _r("travel.airfrance","travel_flight", r"AIR\s*FRANCE", payee="Air France", priority=100),
    _r("travel.ryanair", "travel_flight", r"\bRYANAIR\b", payee="Ryanair", priority=100),
    _r("travel.easyjet", "travel_flight", r"\bEASYJET\b", payee="EasyJet", priority=100),
    _r("travel.transavia","travel_flight", r"\bTRANSAVIA\b", payee="Transavia", priority=100),
    _r("travel.klm",     "travel_flight", r"\bKLM\b", payee="KLM", priority=100),
    _r("travel.lufthansa","travel_flight", r"\bLUFTHANSA\b", payee="Lufthansa", priority=100),
    _r("travel.ba",      "travel_flight", r"BRITISH\s*AIRWAYS", payee="British Airways", priority=100),

    # ── Hôtels / Airbnb
    _r("travel.booking", "travel_lodging", r"BOOKING\.COM|\bBOOKING\b", payee="Booking.com", priority=100),
    _r("travel.airbnb",  "travel_lodging", r"\bAIRBNB\b", payee="Airbnb", priority=100),
    _r("travel.hotels",  "travel_lodging", r"HOTELS?\.COM", payee="Hotels.com", priority=100),
    _r("travel.expedia", "travel_lodging", r"\bEXPEDIA\b", payee="Expedia", priority=100),

    # ── Location voiture
    _r("travel.hertz",   "travel_rental", r"\bHERTZ\b", payee="Hertz", priority=100),
    _r("travel.avis",    "travel_rental", r"\bAVIS\b", payee="Avis", priority=100),
    _r("travel.europcar","travel_rental", r"\bEUROPCAR\b", payee="Europcar", priority=100),
    _r("travel.sixt",    "travel_rental", r"\bSIXT\b", payee="Sixt", priority=100),

    # ── Carburant / Stations
    _r("fuel.totalenergies","fuel", r"TOTAL\s*ENERGIES?|TOTALENERGIES", payee="TotalEnergies", priority=110),
    _r("fuel.esso",      "fuel", r"\bESSO\b", payee="Esso", priority=100),
    _r("fuel.shell",     "fuel", r"\bSHELL\b", payee="Shell", priority=100),
    _r("fuel.bp",        "fuel", r"\bBP\b", payee="BP", priority=100),
    _r("fuel.avia",      "fuel", r"\bAVIA\b", payee="AVIA", priority=100),
    _r("fuel.intermarche_station","fuel", r"INTERMARCHE.*STATION|STATION.*INTERMARCHE", payee="Intermarché Station", priority=110),
    _r("fuel.leclerc_station","fuel", r"LECLERC.*STATION|STATION.*LECLERC", payee="Leclerc Station", priority=110),

    # ── Parking / Péages
    _r("parking.vinci",  "parking_tolls", r"\bVINCI\b", payee="VINCI Autoroutes", priority=100),
    _r("parking.aprr",   "parking_tolls", r"\bAPRR\b", payee="APRR", priority=100),
    _r("parking.sanef",  "parking_tolls", r"\bSANEF\b|COFIROUTE|\bASF\b", payee="Péages autoroute", priority=100),
    _r("parking.adp",    "parking_tolls", r"\bADP\b\s*(ROISSY|ORLY|CDG)?|ORY\s*P\d|ROISSY\s*P\d", payee="ADP Parking", priority=100),
    _r("parking.qpark",  "parking_tolls", r"Q\-?PARK", payee="Q-Park", priority=100),
    _r("parking.indigo", "parking_tolls", r"\bINDIGO\b", payee="Indigo Parking", priority=100),
    _r("parking.saemes", "parking_tolls", r"\bSAEMES\b", payee="SAEMES", priority=100),
    _r("parking.stat_voirie","parking_tolls", r"STAT\s*VOIRIE|HORODATEUR", payee="Stationnement voirie", priority=90),
    _r("parking.atb",    "parking_tolls", r"\bATB\s*PKG\b", payee="ATB Parking", priority=100),

    # ── Auto entretien
    _r("car.norauto",    "car_maintenance", r"\bNORAUTO\b", payee="Norauto", priority=100),
    _r("car.feuvert",    "car_maintenance", r"FEU\s*VERT", payee="Feu Vert", priority=100),
    _r("car.speedy",     "car_maintenance", r"\bSPEEDY\b", payee="Speedy", priority=100),
    _r("car.midas",      "car_maintenance", r"\bMIDAS\b", payee="Midas", priority=100),
    _r("car.euromaster", "car_maintenance", r"\bEUROMASTER\b", payee="Euromaster", priority=100),

    # ── Courses (gros volumes — ordre par fréquence approximative)
    _r("groceries.franprix","groceries_super", r"FRANPRIX", payee="Franprix", priority=100),
    _r("groceries.monoprix","groceries_super", r"MONOPRIX", payee="Monoprix", priority=100),
    _r("groceries.carrefour","groceries_super", r"CARREFOUR(?!.*STATION)", payee="Carrefour", priority=100),
    _r("groceries.auchan","groceries_super", r"\bAUCHAN\b", payee="Auchan", priority=100),
    _r("groceries.leclerc","groceries_super", r"\bLECLERC\b(?!.*STATION)", payee="Leclerc", priority=100),
    _r("groceries.intermarche","groceries_super", r"INTERMARCHE(?!.*STATION)", payee="Intermarché", priority=100),
    _r("groceries.casino","groceries_super", r"\bCASINO\b(?!.*\sJEUX)", payee="Casino", priority=100),
    _r("groceries.lidl", "groceries_super", r"\bLIDL\b", payee="Lidl", priority=100),
    _r("groceries.aldi", "groceries_super", r"\bALDI\b", payee="Aldi", priority=100),
    _r("groceries.spar", "groceries_super", r"\bSPAR\b", payee="Spar", priority=100),
    _r("groceries.g20",  "groceries_super", r"\bG20\b", payee="G20", priority=100),
    _r("groceries.u_express","groceries_super", r"\b(SUPER\s*U|U\s*EXPRESS|HYPER\s*U)\b", payee="Magasins U", priority=100),
    _r("groceries.kmarket","groceries_super", r"\bK\s*MARKET\b", payee="K Market", priority=100),
    _r("groceries.picard","groceries_frozen", r"\bPICARD\b", payee="Picard", priority=100),
    _r("groceries.thiriet","groceries_frozen", r"\bTHIRIET\b", payee="Thiriet", priority=100),
    _r("groceries.biocoop","groceries_organic", r"BIOCOOP", payee="Biocoop", priority=100),
    _r("groceries.naturalia","groceries_organic", r"\bNATURALIA\b", payee="Naturalia", priority=100),
    _r("groceries.lavieclaire","groceries_organic", r"LA\s*VIE\s*CLAIRE", payee="La Vie Claire", priority=100),
    _r("groceries.bakery","groceries_bakery", r"BOULANGERIE|MAISON\s*KAYSER|\bPAUL\b|BRIOCHE\s*DOREE|MARIE\s*BLACHERE", priority=80, notes="Pas de payee — multi-marchands, garde le merchant nettoyé"),

    # ── Restaurants — livraison
    _r("resto.deliveroo","resto_delivery", r"\bDELIVEROO\b", payee="Deliveroo", priority=100),
    _r("resto.justeat",  "resto_delivery", r"JUST\s*EAT", payee="Just Eat", priority=100),
    _r("resto.frichti",  "resto_delivery", r"\bFRICHTI\b", payee="Frichti", priority=100),
    _r("resto.stuart",   "resto_delivery", r"\bSTUART\b", payee="Stuart", priority=100),

    # ── Restaurants — fast / cafés
    _r("resto.mcdo",     "resto_fast", r"MCDONALD|\bMC\s*DO\b", payee="McDonald's", priority=100),
    _r("resto.bk",       "resto_fast", r"BURGER\s*KING", payee="Burger King", priority=100),
    _r("resto.kfc",      "resto_fast", r"\bKFC\b", payee="KFC", priority=100),
    _r("resto.subway",   "resto_fast", r"\bSUBWAY\b", payee="Subway", priority=100),
    _r("resto.starbucks","resto_cafe", r"\bSTARBUCKS\b", payee="Starbucks", priority=100),
    _r("resto.costa",    "resto_cafe", r"COSTA\s*COFFEE", payee="Costa Coffee", priority=100),

    # ── Pharmacies / Santé
    _r("health.pharma_generic","health_pharmacy", r"\bPHARMAC?I?E?\b|PHARMA\s*[A-Z]+", priority=80, notes="Pattern générique pharmacie — pas de payee canonique (nom local)"),
    _r("health.lafayette","health_pharmacy", r"LAFAYETTE.*PHARMA|PHARMACIE\s*LAFAYETTE", payee="Pharmacie Lafayette", priority=100),
    _r("health.optic.krys","health_dental_optical", r"\bKRYS\b", payee="Krys", priority=100),
    _r("health.optic.afflelou","health_dental_optical", r"AFFLELOU|ALAIN\s*AFFLELOU", payee="Alain Afflelou", priority=100),
    _r("health.optic.lissac","health_dental_optical", r"\bLISSAC\b", payee="Lissac", priority=100),
    _r("health.optic.center","health_dental_optical", r"OPTICAL\s*CENTER", payee="Optical Center", priority=100),

    # ── Shopping — marketplaces
    _r("shop.amazon",    "shop_marketplace", r"\bAMAZON(?:\s*EU|\s*PAYMENTS|\.[A-Z]+)?\b", payee="Amazon", priority=100),
    _r("shop.vinted",    "shop_marketplace", r"\bVINTED\b", payee="Vinted", priority=100),
    _r("shop.leboncoin", "shop_marketplace", r"LEBONCOIN", payee="Leboncoin", priority=100),
    _r("shop.ebay",      "shop_marketplace", r"\bEBAY\b", payee="eBay", priority=100),
    _r("shop.backmarket","shop_marketplace", r"BACKMARKET|BACK\s*MARKET", payee="Back Market", priority=100),
    _r("shop.temu",      "shop_marketplace", r"\bTEMU\b", payee="Temu", priority=100),
    _r("shop.aliexpress","shop_marketplace", r"ALIEXPRESS|ALI\s*EXPRESS", payee="AliExpress", priority=100),
    _r("shop.shein",     "shop_marketplace", r"\bSHEIN\b", payee="Shein", priority=100),

    # ── Shopping — mode
    _r("shop.zara",      "shop_clothing", r"\bZARA\b", payee="Zara", priority=100),
    _r("shop.uniqlo",    "shop_clothing", r"\bUNIQLO\b", payee="Uniqlo", priority=100),
    _r("shop.hm",        "shop_clothing", r"H\s*\&\s*M|HM\s*HENNES|HENNES\s*MAURITZ", payee="H&M", priority=100),
    _r("shop.celio",     "shop_clothing", r"\bCELIO\b", payee="Celio", priority=100),
    _r("shop.kiabi",     "shop_clothing", r"\bKIABI\b", payee="Kiabi", priority=100),
    _r("shop.decathlon", "shop_clothing", r"DECATHLON", payee="Decathlon", priority=100),
    _r("shop.gosport",   "shop_clothing", r"GO\s*SPORT", payee="Go Sport", priority=100),
    _r("shop.jdsports",  "shop_clothing", r"JD\s*.*SPORTS", payee="JD Sports", priority=100),
    _r("shop.footlocker","shop_clothing", r"FOOT\s*LOCKER", payee="Foot Locker", priority=100),
    _r("shop.nike",      "shop_clothing", r"\bNIKE\b", payee="Nike", priority=100),
    _r("shop.adidas",    "shop_clothing", r"\bADIDAS\b", payee="Adidas", priority=100),
    _r("shop.laredoute", "shop_clothing", r"LA\s*REDOUTE|LAREDOUTE", payee="La Redoute", priority=100),
    _r("shop.work_in_progress","shop_clothing", r"WORK\s*IN\s*PROGRESS", payee="Carhartt WIP", priority=100),
    _r("shop.amer_sports","shop_clothing", r"AMER\s*SPORTS", payee="Amer Sports", priority=100),
    _r("shop.axel_arigato","shop_clothing", r"AXEL\s*ARIGATO", payee="Axel Arigato", priority=100),

    # ── Shopping — électronique
    _r("shop.fnac",      "shop_electronics", r"\bFNAC\b", payee="Fnac", priority=100),
    _r("shop.darty",     "shop_electronics", r"\bDARTY\b", payee="Darty", priority=100),
    _r("shop.boulanger", "shop_electronics", r"\bBOULANGER\b", payee="Boulanger", priority=100),
    _r("shop.apple_store","shop_electronics", r"APPLE\s*STORE", payee="Apple Store", priority=100),
    _r("shop.ldlc",      "shop_electronics", r"\bLDLC\b", payee="LDLC", priority=100),

    # ── Logement / Énergie / Telecom
    _r("utilities.edf",  "electricity_gas", r"\bEDF\b", payee="EDF", priority=100),
    _r("utilities.engie","electricity_gas", r"\bENGIE\b", payee="Engie", priority=100),
    _r("utilities.totalenergies_elec","electricity_gas", r"TOTAL\s*ENERGIES?\s*(ELEC|ELEC?TR)", payee="TotalEnergies", priority=110),
    _r("utilities.eaux", "water", r"\bVEOLIA\b|\bSUEZ\b|EAUX\s*DE\s*PARIS|SAUR", payee="Eau", priority=100),
    _r("telecom.sfr",    "internet_telecom", r"\bSFR\b|RED\s*BY\s*SFR", payee="SFR", priority=100),
    _r("telecom.orange", "internet_telecom", r"\bORANGE\b(?!\s*JUS)", payee="Orange", priority=100),
    _r("telecom.bouygues","internet_telecom", r"BOUYGUES", payee="Bouygues Telecom", priority=100),
    _r("telecom.free",   "internet_telecom", r"FREE\s*(TELECOM|MOBILE|HAUT\s*DEBIT)", payee="Free", priority=110),
    _r("telecom.sosh",   "internet_telecom", r"\bSOSH\b", payee="Sosh", priority=100),

    # ── Assurances (génériques — pas toujours de sous-cat fiable sans contexte)
    _r("ins.maif",       "insurance", r"\bMAIF\b", payee="MAIF", priority=100),
    _r("ins.macif",      "insurance", r"\bMACIF\b", payee="MACIF", priority=100),
    _r("ins.matmut",     "insurance", r"\bMATMUT\b", payee="MATMUT", priority=100),
    _r("ins.gmf",        "insurance", r"\bGMF\b", payee="GMF", priority=100),
    _r("ins.axa",        "insurance", r"\bAXA\b", payee="AXA", priority=100),
    _r("ins.groupama",   "insurance", r"GROUPAMA", payee="Groupama", priority=100),
    _r("ins.allianz",    "insurance", r"\bALLIANZ\b", payee="Allianz", priority=100),
    _r("ins.alan",       "insurance_health", r"\bALAN\b", payee="Alan", priority=100),
    _r("ins.harmonie",   "insurance_health", r"HARMONIE\s*MUTUELLE", payee="Harmonie Mutuelle", priority=100),
    _r("ins.mgen",       "insurance_health", r"\bMGEN\b", payee="MGEN", priority=100),

    # ── Impôts
    _r("tax.dgfip",      "taxes", r"\bDGFIP\b|IMPOTS?(\.GOUV)?", payee="DGFIP", priority=100),
    _r("tax.urssaf",     "tax_urssaf", r"\bURSSAF\b", payee="URSSAF", priority=100),
    _r("tax.taxe_fonc",  "tax_property", r"TAXE\s*FONCIERE", priority=100),
    _r("tax.taxe_hab",   "tax_housing",  r"TAXE\s*HABITATION", priority=100),

    # ── Enfants
    _r("kids.pajemploi", "children_childcare", r"PAJEMPLOI|PAJE\s*EMPLOI", payee="Pajemploi", priority=100),
    _r("kids.creche",    "children_childcare", r"\bCRECHE\b|MULTI\s*ACCUEIL|MICRO\s*CRECHE", priority=90),

    # ── Loisirs — cinéma / billetterie
    _r("leisure.ugc",    "leisure_culture", r"\bUGC\b", payee="UGC", priority=100),
    _r("leisure.pathe",  "leisure_culture", r"\bPATHE\b|GAUMONT", payee="Pathé Gaumont", priority=100),
    _r("leisure.mk2",    "leisure_culture", r"\bMK2\b", payee="MK2", priority=100),
    _r("leisure.cgr",    "leisure_culture", r"CGR\s*CINEMA", payee="CGR", priority=100),
    _r("leisure.fnac_billet","leisure_culture", r"FNAC\s*SPECTACLES", payee="Fnac Spectacles", priority=110),
    _r("leisure.billetreduc","leisure_culture", r"BILLETREDUC", payee="BilletRéduc", priority=100),
    _r("leisure.ticketmaster","leisure_culture", r"TICKETMASTER", payee="Ticketmaster", priority=100),

    # ── Loisirs — padel / sports occasionnels
    _r("leisure.padel",  "leisure_sport", r"\b4PADEL\b|\bACE\s*PADEL\b|\bPADEL\b", priority=80, notes="Plusieurs clubs — pas de payee unique"),

    # ── Frais bancaires / cotisations
    _r("fees.cotisation_premium","fees", r"COTISATION\s*(OFFRE|CARTE)\s*PREMIUM", priority=100),
    _r("fees.cotisation_carte","fees", r"COTISATION\s*CARTE", priority=90),
    _r("fees.commission","fees", r"COMMISSION\s+D'?INTERVENTION|AGIOS|FRAIS\s+DE\s+TENUE", priority=100),

    # ── Cash / Retrait
    _r("cash.dab",       "cash", r"RETRAIT\s+(AU\s+)?DISTRIBUTEUR|RETRAIT\s+DAB", priority=100),

    # ── Revenus génériques
    _r("income.salary",  "salary", r"\bSALAIRE\b|\bPAIE\s+EMPL", priority=100, amount_sign="credit"),
    _r("income.allowance","allowances", r"\bCAF\b|ALLOCATIONS?\s+FAMILIAL|\bAPL\b", priority=100, amount_sign="credit"),

    # ── Règlements carte de crédit (côté +) = transfer interne
    _r("xfer.credit_card_settlement","uncategorized", r"PRELEVEMENT\s*AUTOMATIQUE\s*ENREGISTRE-?MERCI", priority=200, amount_sign="credit", is_transfer=True, notes="AMEX/CB monthly statement payment received"),
    _r("xfer.echelonnement","uncategorized", r"DEPENSE\s*ECHELONNEE", priority=180, is_transfer=True, notes="AMEX installment plan, -X et +X paire"),
]


# ─── Compilation des regex une seule fois au chargement ─────────────────────
@dataclass
class CompiledRule:
    rule: Rule
    regex: re.Pattern


COMPILED_RULES: list[CompiledRule] = [
    CompiledRule(rule=r, regex=re.compile(r.pattern_str, re.IGNORECASE))
    for r in BUILTIN_RULES
]


def rule_matches(rule: Rule, regex: re.Pattern, merchant: str, raw: str, amount: float, op_type: str) -> tuple[bool, str | None]:
    """Teste une règle compilée contre un libellé normalisé.

    Retourne (matched, matched_on) où matched_on est 'merchant' ou 'raw'.
    """
    # 1) Filtres durs : type d'opération + signe du montant
    if rule.operation_types and op_type not in rule.operation_types:
        return False, None
    if rule.amount_sign == "debit" and amount >= 0:
        return False, None
    if rule.amount_sign == "credit" and amount <= 0:
        return False, None

    # 2) Match contre merchant en priorité (cas nominal)
    if rule.match_against in ("merchant", "both") and merchant:
        if regex.search(merchant):
            return True, "merchant"

    # 3) Fallback raw — filet de sécurité si la normalisation a raté
    if rule.match_against in ("raw", "both"):
        if regex.search(raw):
            return True, "raw"

    return False, None
