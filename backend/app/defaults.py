"""
Default categories seeded for every new household.
Mirror the DEFAULT_CATEGORIES list from the React frontend.

Two-level hierarchy: each category has an optional `parent_slug`.
Top-level categories (parent_slug=None) group their children for display.
Existing slugs are preserved so historical transactions keep their category.
"""
DEFAULT_CATEGORIES = [
    # ============ REVENUS ============
    {"slug": "income",        "name": "Revenus",                   "color": "#10b981", "type": "income",   "icon": "💰", "kind": "needs",   "parent_slug": None},
    {"slug": "salary",        "name": "Salaire",                   "color": "#10b981", "type": "income",   "icon": "💼", "kind": "needs",   "parent_slug": "income"},
    {"slug": "freelance",     "name": "Freelance / Indépendant",   "color": "#0f9d6f", "type": "income",   "icon": "💻", "kind": "needs",   "parent_slug": "income"},
    {"slug": "rental_income", "name": "Revenus locatifs",          "color": "#0e8e63", "type": "income",   "icon": "🏘️", "kind": "needs",   "parent_slug": "income"},
    {"slug": "invest_income", "name": "Dividendes & intérêts",     "color": "#059669", "type": "income",   "icon": "📈", "kind": "needs",   "parent_slug": "income"},
    {"slug": "allowances",    "name": "Allocations (CAF, APL…)",   "color": "#34d399", "type": "income",   "icon": "👨‍👩‍👧", "kind": "needs",   "parent_slug": "income"},
    {"slug": "reimbursements","name": "Remboursements",            "color": "#3fbf85", "type": "income",   "icon": "↩️", "kind": "needs",   "parent_slug": "income"},
    {"slug": "other_income",  "name": "Autres revenus",            "color": "#4dd49b", "type": "income",   "icon": "💵", "kind": "needs",   "parent_slug": "income"},

    # ============ LOGEMENT ============
    {"slug": "housing",            "name": "Logement",               "color": "#f97316", "type": "expense", "icon": "🏠", "kind": "needs", "parent_slug": None},
    {"slug": "rent",               "name": "Loyer",                  "color": "#f97316", "type": "expense", "icon": "🔑", "kind": "needs", "parent_slug": "housing"},
    {"slug": "condo_fees",         "name": "Charges copropriété",    "color": "#e07a30", "type": "expense", "icon": "🏢", "kind": "needs", "parent_slug": "housing"},
    {"slug": "home_maintenance",   "name": "Entretien & travaux",    "color": "#d97534", "type": "expense", "icon": "🔧", "kind": "needs", "parent_slug": "housing"},
    {"slug": "furniture",          "name": "Mobilier & déco maison", "color": "#cf7039", "type": "expense", "icon": "🛋️", "kind": "wants", "parent_slug": "housing"},
    {"slug": "household_cleaning", "name": "Produits ménagers",      "color": "#c26b3e", "type": "expense", "icon": "🧴", "kind": "needs", "parent_slug": "housing"},
    {"slug": "household_laundry",  "name": "Pressing & blanchisserie","color": "#b56043","type": "expense", "icon": "👔", "kind": "needs", "parent_slug": "housing"},
    {"slug": "household_help",     "name": "Aide à domicile",        "color": "#a85548", "type": "expense", "icon": "🤲", "kind": "needs", "parent_slug": "housing"},

    # ============ ÉNERGIE & INTERNET ============
    {"slug": "utilities",       "name": "Énergie & Internet",   "color": "#fb923c", "type": "expense", "icon": "⚡", "kind": "needs", "parent_slug": None},
    {"slug": "electricity_gas", "name": "Électricité & gaz",    "color": "#fb923c", "type": "expense", "icon": "💡", "kind": "needs", "parent_slug": "utilities"},
    {"slug": "water",           "name": "Eau",                  "color": "#0ea5e9", "type": "expense", "icon": "💧", "kind": "needs", "parent_slug": "utilities"},
    {"slug": "internet_telecom","name": "Internet & téléphone", "color": "#f59e51", "type": "expense", "icon": "📶", "kind": "needs", "parent_slug": "utilities"},

    # ============ ASSURANCES ============
    {"slug": "insurance",       "name": "Assurances",          "color": "#ea580c", "type": "expense", "icon": "🛡️", "kind": "needs", "parent_slug": None},
    {"slug": "insurance_home",  "name": "Assurance habitation","color": "#ea580c", "type": "expense", "icon": "🏡", "kind": "needs", "parent_slug": "insurance"},
    {"slug": "insurance_auto",  "name": "Assurance auto",      "color": "#d8521b", "type": "expense", "icon": "🚙", "kind": "needs", "parent_slug": "insurance"},
    {"slug": "insurance_health","name": "Mutuelle santé",      "color": "#c44a17", "type": "expense", "icon": "❤️‍🩹","kind": "needs", "parent_slug": "insurance"},
    {"slug": "insurance_life",  "name": "Prévoyance & vie",    "color": "#b34114", "type": "expense", "icon": "🤝", "kind": "needs", "parent_slug": "insurance"},
    {"slug": "insurance_loan",  "name": "Assurance de prêt",   "color": "#a03a12", "type": "expense", "icon": "📋", "kind": "needs", "parent_slug": "insurance"},

    # ============ ABONNEMENTS ============
    {"slug": "subscriptions", "name": "Abonnements",              "color": "#a855f7", "type": "expense", "icon": "📱", "kind": "wants", "parent_slug": None},
    {"slug": "subs_video",    "name": "Streaming vidéo",          "color": "#a855f7", "type": "expense", "icon": "🎬", "kind": "wants", "parent_slug": "subscriptions"},
    {"slug": "subs_music",    "name": "Streaming musique",        "color": "#9c4ce8", "type": "expense", "icon": "🎵", "kind": "wants", "parent_slug": "subscriptions"},
    {"slug": "subs_cloud",    "name": "Cloud & logiciels",        "color": "#9242da", "type": "expense", "icon": "☁️", "kind": "wants", "parent_slug": "subscriptions"},
    {"slug": "subs_gym",      "name": "Salle de sport",           "color": "#8838cc", "type": "expense", "icon": "🏋️", "kind": "wants", "parent_slug": "subscriptions"},
    {"slug": "subs_press",    "name": "Presse & médias",          "color": "#7e2ebf", "type": "expense", "icon": "📰", "kind": "wants", "parent_slug": "subscriptions"},
    {"slug": "subs_services", "name": "Apple, Google & services", "color": "#7425b1", "type": "expense", "icon": "🍎", "kind": "wants", "parent_slug": "subscriptions"},

    # ============ COURSES ============
    {"slug": "groceries",         "name": "Courses",               "color": "#22c55e", "type": "expense", "icon": "🛒", "kind": "needs", "parent_slug": None},
    {"slug": "groceries_super",   "name": "Supermarché",           "color": "#22c55e", "type": "expense", "icon": "🏪", "kind": "needs", "parent_slug": "groceries"},
    {"slug": "groceries_frozen",  "name": "Surgelés (Picard)",     "color": "#1cb054", "type": "expense", "icon": "🧊", "kind": "needs", "parent_slug": "groceries"},
    {"slug": "groceries_organic", "name": "Bio / primeur / marché","color": "#179c4a", "type": "expense", "icon": "🥕", "kind": "needs", "parent_slug": "groceries"},
    {"slug": "groceries_bakery",  "name": "Boulangerie",           "color": "#138840", "type": "expense", "icon": "🥖", "kind": "needs", "parent_slug": "groceries"},

    # ============ RESTAURANTS ============
    {"slug": "restaurants",    "name": "Restaurants",                    "color": "#ec4899", "type": "expense", "icon": "🍽️", "kind": "wants", "parent_slug": None},
    {"slug": "resto_meal",     "name": "Restaurant",                     "color": "#ec4899", "type": "expense", "icon": "🍷", "kind": "wants", "parent_slug": "restaurants"},
    {"slug": "resto_fast",     "name": "Fast-food",                      "color": "#dd4188", "type": "expense", "icon": "🍔", "kind": "wants", "parent_slug": "restaurants"},
    {"slug": "resto_cafe",     "name": "Café / bar",                     "color": "#cf3a78", "type": "expense", "icon": "☕", "kind": "wants", "parent_slug": "restaurants"},
    {"slug": "resto_delivery", "name": "Livraison (UberEats, Deliveroo)","color": "#c03368", "type": "expense", "icon": "🛵", "kind": "wants", "parent_slug": "restaurants"},

    # ============ TRANSPORT ============
    {"slug": "transport",       "name": "Transport",               "color": "#3b82f6", "type": "expense", "icon": "🚗", "kind": "needs", "parent_slug": None},
    {"slug": "fuel",            "name": "Carburant",               "color": "#2563eb", "type": "expense", "icon": "⛽", "kind": "needs", "parent_slug": "transport"},
    {"slug": "parking_tolls",   "name": "Stationnement & péages", "color": "#3877e5", "type": "expense", "icon": "🅿️", "kind": "needs", "parent_slug": "transport"},
    {"slug": "public_transport","name": "Transports en commun",   "color": "#356bd4", "type": "expense", "icon": "🚇", "kind": "needs", "parent_slug": "transport"},
    {"slug": "taxi_vtc",        "name": "Taxi / VTC",              "color": "#325fc4", "type": "expense", "icon": "🚕", "kind": "wants", "parent_slug": "transport"},
    {"slug": "car_maintenance", "name": "Entretien véhicule",      "color": "#2e54b3", "type": "expense", "icon": "🔩", "kind": "needs", "parent_slug": "transport"},

    # ============ SHOPPING ============
    {"slug": "shopping",         "name": "Shopping",                    "color": "#d946ef", "type": "expense", "icon": "🛍️", "kind": "wants", "parent_slug": None},
    {"slug": "shop_clothing",    "name": "Vêtements",                   "color": "#d946ef", "type": "expense", "icon": "👕", "kind": "wants", "parent_slug": "shopping"},
    {"slug": "shop_electronics", "name": "Électronique",                "color": "#c93fdb", "type": "expense", "icon": "💻", "kind": "wants", "parent_slug": "shopping"},
    {"slug": "shop_gifts",       "name": "Cadeaux",                     "color": "#b938c8", "type": "expense", "icon": "🎁", "kind": "wants", "parent_slug": "shopping"},
    {"slug": "shop_marketplace", "name": "Marketplace (Amazon, Vinted)","color": "#a931b4", "type": "expense", "icon": "📦", "kind": "wants", "parent_slug": "shopping"},

    # ============ LOISIRS ============
    {"slug": "leisure",         "name": "Loisirs",                  "color": "#8b5cf6", "type": "expense", "icon": "🎭", "kind": "wants", "parent_slug": None},
    {"slug": "leisure_culture", "name": "Cinéma, concerts, expos", "color": "#8b5cf6", "type": "expense", "icon": "🎟️", "kind": "wants", "parent_slug": "leisure"},
    {"slug": "leisure_sport",   "name": "Sport (ponctuel)",         "color": "#7e54e5", "type": "expense", "icon": "⚽", "kind": "wants", "parent_slug": "leisure"},
    {"slug": "leisure_books",   "name": "Livres & presse",          "color": "#724cd5", "type": "expense", "icon": "📖", "kind": "wants", "parent_slug": "leisure"},
    {"slug": "leisure_hobbies", "name": "Hobbies & jeux",           "color": "#6644c4", "type": "expense", "icon": "🎮", "kind": "wants", "parent_slug": "leisure"},

    # ============ VOYAGES ============
    {"slug": "travel",         "name": "Voyages",              "color": "#06b6d4", "type": "expense", "icon": "✈️", "kind": "wants", "parent_slug": None},
    {"slug": "travel_flight",  "name": "Vol",                  "color": "#06b6d4", "type": "expense", "icon": "🛫", "kind": "wants", "parent_slug": "travel"},
    {"slug": "travel_lodging", "name": "Hôtel / Airbnb",       "color": "#05a3bd", "type": "expense", "icon": "🏨", "kind": "wants", "parent_slug": "travel"},
    {"slug": "travel_train",   "name": "Train longue distance", "color": "#0590a7", "type": "expense", "icon": "🚄", "kind": "wants", "parent_slug": "travel"},
    {"slug": "travel_rental",  "name": "Location voiture",     "color": "#047d90", "type": "expense", "icon": "🚗", "kind": "wants", "parent_slug": "travel"},

    # ============ SANTÉ ============
    {"slug": "health",                "name": "Santé",                "color": "#ef4444", "type": "expense", "icon": "⚕️", "kind": "needs", "parent_slug": None},
    {"slug": "health_doctor",         "name": "Médecin & spécialistes","color": "#ef4444", "type": "expense", "icon": "🩺", "kind": "needs", "parent_slug": "health"},
    {"slug": "health_pharmacy",       "name": "Pharmacie",            "color": "#e03d3d", "type": "expense", "icon": "💊", "kind": "needs", "parent_slug": "health"},
    {"slug": "health_dental_optical", "name": "Dentaire & optique",   "color": "#d23636", "type": "expense", "icon": "🦷", "kind": "needs", "parent_slug": "health"},
    {"slug": "health_wellness",       "name": "Bien-être & spa",      "color": "#c32f2f", "type": "expense", "icon": "💆", "kind": "wants", "parent_slug": "health"},

    # ============ ENFANTS ============
    {"slug": "children",              "name": "Enfants",                        "color": "#f59e0b", "type": "expense", "icon": "👶", "kind": "needs", "parent_slug": None},
    {"slug": "children_childcare",    "name": "Crèche / Nounou",                "color": "#f59e0b", "type": "expense", "icon": "🧸", "kind": "needs", "parent_slug": "children"},
    {"slug": "children_school_meals", "name": "Cantine & périscolaire",         "color": "#e6920a", "type": "expense", "icon": "🍱", "kind": "needs", "parent_slug": "children"},
    {"slug": "children_baby",         "name": "Lait, couches, bébé",            "color": "#d78609", "type": "expense", "icon": "🍼", "kind": "needs", "parent_slug": "children"},
    {"slug": "children_clothing",     "name": "Vêtements enfants",              "color": "#c87a08", "type": "expense", "icon": "👶", "kind": "needs", "parent_slug": "children"},
    {"slug": "children_activities",   "name": "Activités & loisirs enfants",    "color": "#b96e07", "type": "expense", "icon": "🎨", "kind": "wants", "parent_slug": "children"},
    {"slug": "children_tuition",      "name": "Frais de scolarité",             "color": "#aa6206", "type": "expense", "icon": "🎓", "kind": "needs", "parent_slug": "children"},

    # ============ ÉDUCATION ============
    {"slug": "education", "name": "Éducation", "color": "#6366f1", "type": "expense", "icon": "📚", "kind": "needs", "parent_slug": None},

    # ============ IMPÔTS & TAXES ============
    {"slug": "taxes",       "name": "Impôts & Taxes",        "color": "#7c2d12", "type": "expense", "icon": "🏛️", "kind": "needs", "parent_slug": None},
    {"slug": "tax_income",  "name": "Impôt sur le revenu",   "color": "#7c2d12", "type": "expense", "icon": "📋", "kind": "needs", "parent_slug": "taxes"},
    {"slug": "tax_property","name": "Taxe foncière",         "color": "#6e2810", "type": "expense", "icon": "🏠", "kind": "needs", "parent_slug": "taxes"},
    {"slug": "tax_housing", "name": "Taxe d'habitation",     "color": "#60230e", "type": "expense", "icon": "🏘️", "kind": "needs", "parent_slug": "taxes"},
    {"slug": "tax_urssaf",  "name": "URSSAF / cotisations",  "color": "#521e0c", "type": "expense", "icon": "📑", "kind": "needs", "parent_slug": "taxes"},

    # ============ FINANCE & ÉPARGNE ============
    {"slug": "financial",  "name": "Finance & Épargne",  "color": "#475569", "type": "expense", "icon": "🏦", "kind": "savings", "parent_slug": None},
    {"slug": "fees",       "name": "Frais bancaires",    "color": "#dc2626", "type": "expense", "icon": "💳", "kind": "needs",   "parent_slug": "financial"},
    {"slug": "savings",    "name": "Épargne",            "color": "#0891b2", "type": "transfer","icon": "🏦", "kind": "savings", "parent_slug": "financial"},
    {"slug": "investment", "name": "Investissements",    "color": "#0e7490", "type": "transfer","icon": "📊", "kind": "savings", "parent_slug": "financial"},

    # ============ CRÉDIT ============
    {"slug": "loans",            "name": "Crédit",                "color": "#4f46e5", "type": "expense", "icon": "🏦", "kind": "needs", "parent_slug": None},
    {"slug": "mortgage_interest","name": "Crédit immobilier",     "color": "#4f46e5", "type": "expense", "icon": "🏠", "kind": "needs", "parent_slug": "loans"},
    {"slug": "loan_auto",        "name": "Crédit auto",           "color": "#4845d4", "type": "expense", "icon": "🚗", "kind": "needs", "parent_slug": "loans"},
    {"slug": "loan_student",     "name": "Crédit étudiant",       "color": "#4338ca", "type": "expense", "icon": "🎓", "kind": "needs", "parent_slug": "loans"},
    {"slug": "loan_consumer",    "name": "Crédit conso",          "color": "#3e31be", "type": "expense", "icon": "💳", "kind": "needs", "parent_slug": "loans"},
    {"slug": "loan_personal",    "name": "Prêt personnel",        "color": "#3730a3", "type": "expense", "icon": "🤝", "kind": "needs", "parent_slug": "loans"},
    {"slug": "loan_revolving",   "name": "Crédit renouvelable",   "color": "#322b97", "type": "expense", "icon": "🔄", "kind": "needs", "parent_slug": "loans"},
    {"slug": "credit_principal", "name": "Remboursement capital", "color": "#2e268c", "type": "expense", "icon": "💸", "kind": "needs", "parent_slug": "loans"},
    {"slug": "loan_mortgage",    "name": "Crédit immobilier",     "color": "#4f46e5", "type": "expense", "icon": "🏠", "kind": "needs", "parent_slug": "loans"},

    # ============ SOINS PERSONNELS ============
    {"slug": "personal_care",         "name": "Soins personnels",    "color": "#db2777", "type": "expense", "icon": "💅", "kind": "wants", "parent_slug": None},
    {"slug": "personal_care_hair",    "name": "Coiffeur & barbier",  "color": "#db2777", "type": "expense", "icon": "✂️", "kind": "wants", "parent_slug": "personal_care"},
    {"slug": "personal_care_beauty",  "name": "Cosmétiques & beauté","color": "#c72470", "type": "expense", "icon": "💄", "kind": "wants", "parent_slug": "personal_care"},
    {"slug": "personal_care_hygiene", "name": "Parfum & hygiène",    "color": "#b32069", "type": "expense", "icon": "🧼", "kind": "needs", "parent_slug": "personal_care"},

    # ============ ANIMAUX ============
    {"slug": "pets",         "name": "Animaux",                  "color": "#b45309", "type": "expense", "icon": "🐾", "kind": "wants", "parent_slug": None},
    {"slug": "pets_vet",     "name": "Vétérinaire",              "color": "#b45309", "type": "expense", "icon": "🏥", "kind": "needs", "parent_slug": "pets"},
    {"slug": "pets_food",    "name": "Nourriture & accessoires", "color": "#a34e09", "type": "expense", "icon": "🦮", "kind": "needs", "parent_slug": "pets"},
    {"slug": "pets_grooming","name": "Toilettage",               "color": "#924908", "type": "expense", "icon": "🛁", "kind": "wants", "parent_slug": "pets"},

    # ============ LEGACY ALIASES (slugs anciens — conservés pour les transactions existantes) ============
    {"slug": "sport",      "name": "Sport & Fitness",    "color": "#8838cc", "type": "expense", "icon": "🏋️", "kind": "wants", "parent_slug": "subscriptions"},
    {"slug": "streaming",  "name": "Streaming & Médias", "color": "#a855f7", "type": "expense", "icon": "🎬", "kind": "wants", "parent_slug": "subscriptions"},
    {"slug": "childcare",  "name": "Garde & Crèche",     "color": "#f59e0b", "type": "expense", "icon": "🧸", "kind": "needs", "parent_slug": "children"},
    {"slug": "pharmacy",   "name": "Pharmacie",          "color": "#ef4444", "type": "expense", "icon": "💊", "kind": "needs", "parent_slug": "health"},
    {"slug": "household",  "name": "Ménage",             "color": "#78716c", "type": "expense", "icon": "🧹", "kind": "needs", "parent_slug": "housing"},

    # ============ DIVERS ============
    {"slug": "cash",          "name": "Retrait DAB",       "color": "#64748b", "type": "expense",  "icon": "💵", "kind": "wants",   "parent_slug": None},
    {"slug": "transfer",      "name": "Virements internes","color": "#94a3b8", "type": "transfer", "icon": "🔄", "kind": "savings", "parent_slug": None},
    {"slug": "uncategorized", "name": "Non catégorisé",    "color": "#9ca3af", "type": "expense",  "icon": "❓", "kind": "wants",   "parent_slug": None},
]
