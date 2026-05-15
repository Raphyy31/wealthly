// ============================================================================
// Wealthly — shared constants
//
// Extracted from WealthlyApp.jsx during the L1 monolith split. Keep this file
// limited to data and lookup tables; React components and stateful helpers
// belong elsewhere. Anything imported from lucide-react is already used as a
// component reference downstream — don't replace icons with strings.
// ============================================================================

import {
  Home, Heart, BarChart3, Target, PiggyBank, Bitcoin, Landmark, Coins,
  CreditCard, Banknote, Wallet,
} from 'lucide-react';

export const APP_NAME = 'Wealthly';

export const STORAGE_KEYS = {
  MEMBERS: 'w2:members',
  ACCOUNTS: 'w2:accounts',
  TRANSACTIONS: 'w2:transactions',
  ASSETS: 'w2:assets',
  LIABILITIES: 'w2:liabilities',
  CATEGORIES: 'w2:categories',
  RULES: 'w2:rules',
  MAPPINGS: 'w2:mappings',
  BUDGETS: 'w2:budgets',
  RECURRING_OVERRIDES: 'w2:recurring_overrides',
  GOALS: 'w2:goals',
  SETTINGS: 'w2:settings',
  ONBOARDED: 'w2:onboarded',
  DATA_CACHE: 'w2:data_cache',
  ACTIVE_MEMBER: 'w2:active_member',
  THEME: 'w2:theme',
};

// Two-level taxonomy (2026-05-15). Each row has `parent` (slug of parent top-level,
// null = top-level). Mirrors backend/app/defaults.py — keep in sync.
export const DEFAULT_CATEGORIES = [
  // INCOME
  { id: 'income', name: 'Revenus', color: '#10b981', type: 'income', icon: '💰', kind: 'needs', parent: null },
  { id: 'salary', name: 'Salaire', color: '#10b981', type: 'income', icon: '💼', kind: 'needs', parent: 'income' },
  { id: 'freelance', name: 'Freelance / Indépendant', color: '#0f9d6f', type: 'income', icon: '💻', kind: 'needs', parent: 'income' },
  { id: 'rental_income', name: 'Revenus locatifs', color: '#0e8e63', type: 'income', icon: '🏘️', kind: 'needs', parent: 'income' },
  { id: 'invest_income', name: 'Dividendes & intérêts', color: '#059669', type: 'income', icon: '📈', kind: 'needs', parent: 'income' },
  { id: 'allowances', name: 'Allocations (CAF, APL…)', color: '#34d399', type: 'income', icon: '👨‍👩‍👧', kind: 'needs', parent: 'income' },
  { id: 'reimbursements', name: 'Remboursements', color: '#3fbf85', type: 'income', icon: '↩️', kind: 'needs', parent: 'income' },
  { id: 'other_income', name: 'Autres revenus', color: '#4dd49b', type: 'income', icon: '💵', kind: 'needs', parent: 'income' },

  // HOUSING
  { id: 'housing', name: 'Logement', color: '#f97316', type: 'expense', icon: '🏠', kind: 'needs', parent: null },
  { id: 'rent', name: 'Loyer', color: '#f97316', type: 'expense', icon: '🔑', kind: 'needs', parent: 'housing' },
  { id: 'mortgage_interest', name: 'Crédit immo (intérêts)', color: '#ea7d2a', type: 'expense', icon: '🏦', kind: 'needs', parent: 'housing' },
  { id: 'condo_fees', name: 'Charges copropriété', color: '#e07a30', type: 'expense', icon: '🏢', kind: 'needs', parent: 'housing' },
  { id: 'home_maintenance', name: 'Entretien & travaux', color: '#d97534', type: 'expense', icon: '🔧', kind: 'needs', parent: 'housing' },
  { id: 'furniture', name: 'Mobilier & déco maison', color: '#cf7039', type: 'expense', icon: '🛋️', kind: 'wants', parent: 'housing' },

  // UTILITIES
  { id: 'utilities', name: 'Énergie & Internet', color: '#fb923c', type: 'expense', icon: '⚡', kind: 'needs', parent: null },
  { id: 'electricity_gas', name: 'Électricité & gaz', color: '#fb923c', type: 'expense', icon: '💡', kind: 'needs', parent: 'utilities' },
  { id: 'water', name: 'Eau', color: '#0ea5e9', type: 'expense', icon: '💧', kind: 'needs', parent: 'utilities' },
  { id: 'internet_telecom', name: 'Internet & téléphone', color: '#f59e51', type: 'expense', icon: '📶', kind: 'needs', parent: 'utilities' },

  // INSURANCE
  { id: 'insurance', name: 'Assurances', color: '#ea580c', type: 'expense', icon: '🛡️', kind: 'needs', parent: null },
  { id: 'insurance_home', name: 'Assurance habitation', color: '#ea580c', type: 'expense', icon: '🏡', kind: 'needs', parent: 'insurance' },
  { id: 'insurance_auto', name: 'Assurance auto', color: '#d8521b', type: 'expense', icon: '🚙', kind: 'needs', parent: 'insurance' },
  { id: 'insurance_health', name: 'Mutuelle santé', color: '#c44a17', type: 'expense', icon: '❤️‍🩹', kind: 'needs', parent: 'insurance' },
  { id: 'insurance_life', name: 'Prévoyance & vie', color: '#b34114', type: 'expense', icon: '🤝', kind: 'needs', parent: 'insurance' },

  // SUBSCRIPTIONS
  { id: 'subscriptions', name: 'Abonnements', color: '#a855f7', type: 'expense', icon: '📱', kind: 'wants', parent: null },
  { id: 'subs_video', name: 'Streaming vidéo', color: '#a855f7', type: 'expense', icon: '🎬', kind: 'wants', parent: 'subscriptions' },
  { id: 'subs_music', name: 'Streaming musique', color: '#9c4ce8', type: 'expense', icon: '🎵', kind: 'wants', parent: 'subscriptions' },
  { id: 'subs_cloud', name: 'Cloud & logiciels', color: '#9242da', type: 'expense', icon: '☁️', kind: 'wants', parent: 'subscriptions' },
  { id: 'subs_gym', name: 'Salle de sport', color: '#8838cc', type: 'expense', icon: '🏋️', kind: 'wants', parent: 'subscriptions' },
  { id: 'subs_press', name: 'Presse & médias', color: '#7e2ebf', type: 'expense', icon: '📰', kind: 'wants', parent: 'subscriptions' },
  { id: 'subs_services', name: 'Apple, Google, services', color: '#7425b1', type: 'expense', icon: '🍎', kind: 'wants', parent: 'subscriptions' },

  // GROCERIES
  { id: 'groceries', name: 'Courses', color: '#22c55e', type: 'expense', icon: '🛒', kind: 'needs', parent: null },
  { id: 'groceries_super', name: 'Supermarché', color: '#22c55e', type: 'expense', icon: '🏪', kind: 'needs', parent: 'groceries' },
  { id: 'groceries_frozen', name: 'Surgelés (Picard)', color: '#1cb054', type: 'expense', icon: '🧊', kind: 'needs', parent: 'groceries' },
  { id: 'groceries_organic', name: 'Bio / primeur / marché', color: '#179c4a', type: 'expense', icon: '🥕', kind: 'needs', parent: 'groceries' },
  { id: 'groceries_bakery', name: 'Boulangerie', color: '#138840', type: 'expense', icon: '🥖', kind: 'needs', parent: 'groceries' },

  // RESTAURANTS
  { id: 'restaurants', name: 'Restaurants', color: '#ec4899', type: 'expense', icon: '🍽️', kind: 'wants', parent: null },
  { id: 'resto_meal', name: 'Restaurant', color: '#ec4899', type: 'expense', icon: '🍷', kind: 'wants', parent: 'restaurants' },
  { id: 'resto_fast', name: 'Fast-food', color: '#dd4188', type: 'expense', icon: '🍔', kind: 'wants', parent: 'restaurants' },
  { id: 'resto_cafe', name: 'Café / bar', color: '#cf3a78', type: 'expense', icon: '☕', kind: 'wants', parent: 'restaurants' },
  { id: 'resto_delivery', name: 'Livraison (UberEats, Deliveroo)', color: '#c03368', type: 'expense', icon: '🛵', kind: 'wants', parent: 'restaurants' },

  // TRANSPORT
  { id: 'transport', name: 'Transport', color: '#3b82f6', type: 'expense', icon: '🚗', kind: 'needs', parent: null },
  { id: 'fuel', name: 'Carburant', color: '#2563eb', type: 'expense', icon: '⛽', kind: 'needs', parent: 'transport' },
  { id: 'parking_tolls', name: 'Stationnement & péages', color: '#3877e5', type: 'expense', icon: '🅿️', kind: 'needs', parent: 'transport' },
  { id: 'public_transport', name: 'Transports en commun', color: '#356bd4', type: 'expense', icon: '🚇', kind: 'needs', parent: 'transport' },
  { id: 'taxi_vtc', name: 'Taxi / VTC', color: '#325fc4', type: 'expense', icon: '🚕', kind: 'wants', parent: 'transport' },
  { id: 'car_maintenance', name: 'Entretien véhicule', color: '#2e54b3', type: 'expense', icon: '🔩', kind: 'needs', parent: 'transport' },

  // SHOPPING
  { id: 'shopping', name: 'Shopping', color: '#d946ef', type: 'expense', icon: '🛍️', kind: 'wants', parent: null },
  { id: 'shop_clothing', name: 'Vêtements', color: '#d946ef', type: 'expense', icon: '👕', kind: 'wants', parent: 'shopping' },
  { id: 'shop_electronics', name: 'Électronique', color: '#c93fdb', type: 'expense', icon: '💻', kind: 'wants', parent: 'shopping' },
  { id: 'shop_gifts', name: 'Cadeaux', color: '#b938c8', type: 'expense', icon: '🎁', kind: 'wants', parent: 'shopping' },
  { id: 'shop_marketplace', name: 'Marketplace (Amazon, Vinted)', color: '#a931b4', type: 'expense', icon: '📦', kind: 'wants', parent: 'shopping' },

  // LEISURE
  { id: 'leisure', name: 'Loisirs', color: '#8b5cf6', type: 'expense', icon: '🎭', kind: 'wants', parent: null },
  { id: 'leisure_culture', name: 'Cinéma, concerts, expos', color: '#8b5cf6', type: 'expense', icon: '🎟️', kind: 'wants', parent: 'leisure' },
  { id: 'leisure_sport', name: 'Sport (ponctuel)', color: '#7e54e5', type: 'expense', icon: '⚽', kind: 'wants', parent: 'leisure' },
  { id: 'leisure_books', name: 'Livres & presse', color: '#724cd5', type: 'expense', icon: '📖', kind: 'wants', parent: 'leisure' },
  { id: 'leisure_hobbies', name: 'Hobbies & jeux', color: '#6644c4', type: 'expense', icon: '🎮', kind: 'wants', parent: 'leisure' },

  // TRAVEL
  { id: 'travel', name: 'Voyages', color: '#06b6d4', type: 'expense', icon: '✈️', kind: 'wants', parent: null },
  { id: 'travel_flight', name: 'Vol', color: '#06b6d4', type: 'expense', icon: '🛫', kind: 'wants', parent: 'travel' },
  { id: 'travel_lodging', name: 'Hôtel / Airbnb', color: '#05a3bd', type: 'expense', icon: '🏨', kind: 'wants', parent: 'travel' },
  { id: 'travel_train', name: 'Train longue distance', color: '#0590a7', type: 'expense', icon: '🚄', kind: 'wants', parent: 'travel' },
  { id: 'travel_rental', name: 'Location voiture', color: '#047d90', type: 'expense', icon: '🚗', kind: 'wants', parent: 'travel' },

  // HEALTH
  { id: 'health', name: 'Santé', color: '#ef4444', type: 'expense', icon: '⚕️', kind: 'needs', parent: null },
  { id: 'health_doctor', name: 'Médecin & spécialistes', color: '#ef4444', type: 'expense', icon: '🩺', kind: 'needs', parent: 'health' },
  { id: 'health_pharmacy', name: 'Pharmacie', color: '#e03d3d', type: 'expense', icon: '💊', kind: 'needs', parent: 'health' },
  { id: 'health_dental_optical', name: 'Dentaire & optique', color: '#d23636', type: 'expense', icon: '🦷', kind: 'needs', parent: 'health' },
  { id: 'health_wellness', name: 'Bien-être & spa', color: '#c32f2f', type: 'expense', icon: '💆', kind: 'wants', parent: 'health' },

  // CHILDREN
  { id: 'children', name: 'Enfants', color: '#f59e0b', type: 'expense', icon: '👶', kind: 'needs', parent: null },
  { id: 'children_childcare', name: 'Crèche / Nounou', color: '#f59e0b', type: 'expense', icon: '🧸', kind: 'needs', parent: 'children' },
  { id: 'children_school_meals', name: 'Cantine & périscolaire', color: '#e6920a', type: 'expense', icon: '🍱', kind: 'needs', parent: 'children' },
  { id: 'children_baby', name: 'Lait, couches, bébé', color: '#d78609', type: 'expense', icon: '🍼', kind: 'needs', parent: 'children' },
  { id: 'children_clothing', name: 'Vêtements enfants', color: '#c87a08', type: 'expense', icon: '👶', kind: 'needs', parent: 'children' },
  { id: 'children_activities', name: 'Activités & loisirs enfants', color: '#b96e07', type: 'expense', icon: '🎨', kind: 'wants', parent: 'children' },
  { id: 'children_tuition', name: 'Frais de scolarité', color: '#aa6206', type: 'expense', icon: '🎓', kind: 'needs', parent: 'children' },

  // EDUCATION (adultes)
  { id: 'education', name: 'Éducation', color: '#6366f1', type: 'expense', icon: '📚', kind: 'needs', parent: null },

  // TAXES
  { id: 'taxes', name: 'Impôts & Taxes', color: '#7c2d12', type: 'expense', icon: '🏛️', kind: 'needs', parent: null },
  { id: 'tax_income', name: 'Impôt sur le revenu', color: '#7c2d12', type: 'expense', icon: '📋', kind: 'needs', parent: 'taxes' },
  { id: 'tax_property', name: 'Taxe foncière', color: '#6e2810', type: 'expense', icon: '🏠', kind: 'needs', parent: 'taxes' },
  { id: 'tax_housing', name: "Taxe d'habitation", color: '#60230e', type: 'expense', icon: '🏘️', kind: 'needs', parent: 'taxes' },
  { id: 'tax_urssaf', name: 'URSSAF / cotisations', color: '#521e0c', type: 'expense', icon: '📑', kind: 'needs', parent: 'taxes' },

  // FINANCIAL
  { id: 'financial', name: 'Finance & épargne', color: '#475569', type: 'expense', icon: '🏦', kind: 'savings', parent: null },
  { id: 'fees', name: 'Frais bancaires', color: '#dc2626', type: 'expense', icon: '💳', kind: 'needs', parent: 'financial' },
  { id: 'credit_principal', name: 'Remboursement crédit (capital)', color: '#52525b', type: 'transfer', icon: '💸', kind: 'savings', parent: 'financial' },
  { id: 'savings', name: 'Épargne', color: '#0891b2', type: 'transfer', icon: '🏦', kind: 'savings', parent: 'financial' },
  { id: 'investment', name: 'Investissements', color: '#0e7490', type: 'transfer', icon: '📊', kind: 'savings', parent: 'financial' },

  // LEGACY ALIASES
  { id: 'sport', name: 'Sport & Fitness', color: '#f97316', type: 'expense', icon: '💪', kind: 'wants', parent: 'subscriptions' },
  { id: 'streaming', name: 'Streaming & Médias', color: '#a855f7', type: 'expense', icon: '🎬', kind: 'wants', parent: 'subscriptions' },
  { id: 'childcare', name: 'Garde & Crèche', color: '#f59e0b', type: 'expense', icon: '🧸', kind: 'needs', parent: 'children' },
  { id: 'pharmacy', name: 'Pharmacie', color: '#ef4444', type: 'expense', icon: '💊', kind: 'needs', parent: 'health' },

  // TECHNICAL
  { id: 'cash', name: 'Retrait DAB', color: '#64748b', type: 'expense', icon: '💵', kind: 'wants', parent: null },
  { id: 'transfer', name: 'Virements internes', color: '#94a3b8', type: 'transfer', icon: '🔄', kind: 'savings', parent: null },
  { id: 'uncategorized', name: 'Non catégorisé', color: '#9ca3af', type: 'expense', icon: '❓', kind: 'wants', parent: null },
];

// Helper: returns the parent slug of a category, or the slug itself if top-level.
export const categoryTopSlug = (slug, categories = DEFAULT_CATEGORIES) => {
  const cat = categories.find(c => c.id === slug || c.slug === slug);
  if (!cat) return slug;
  return cat.parent || cat.parent_slug || cat.id || cat.slug;
};

// Order matters: the generic "virement" pattern must stay LAST so that more
// specific salary / savings / transfer patterns get a chance to match first.
export const DEFAULT_RULES = [
  { pattern: /carrefour|leclerc|lidl|auchan|monoprix|franprix|intermarch|casino|super u|biocoop|naturalia/i, categoryId: 'groceries' },
  { pattern: /uber eats|deliveroo|just eat|mcdonald|burger king|kfc|subway|starbucks|paul |brioche dor|krispy kreme/i, categoryId: 'restaurants' },
  { pattern: /restaurant|brasserie|bistrot|pizzeria|sushi|kebab|tacos/i, categoryId: 'restaurants' },
  { pattern: /apple\.com\/bill|app store|appstore|itunes|google play|playstore|google\*|microsoft store|xbox|playstation|nintendo|steam|epic games|ea games|ubisoft|olarc/i, categoryId: 'subscriptions' },
  { pattern: /icloud|google one|dropbox|microsoft 365|office 365|adobe|github|notion|linear|canva|figma|evernote|lastpass|1password|nordvpn|expressvpn|surfshark|proton /i, categoryId: 'subscriptions' },
  { pattern: /basic-?fit|basic fit|fitness park|anytime fitness|on air fitness|on air|l'orange bleue|neoness|magic form|keepcool|club med gym|elancia|gigafit|cmg sports|salle de sport|sport club|moving/i, categoryId: 'sport' },
  { pattern: /netflix|spotify|disney\+|disney plus|prime video|deezer|youtube premium|canal\+|salto|paramount|hbo|apple tv|apple music|soundcloud|tidal|qobuz|napster|molotov/i, categoryId: 'streaming' },
  { pattern: /hellofresh|hello fresh|quitoque|gousto|kitchen daily|frichti/i, categoryId: 'subscriptions' },
  { pattern: /le monde|le figaro|liberation|mediapart|les echos|l.equipe|la croix|le point|nouvel obs|lemag/i, categoryId: 'subscriptions' },
  { pattern: /sfr|orange|free mobile|bouygues|red by sfr|sosh|prixtel/i, categoryId: 'utilities' },
  { pattern: /edf |engie|total energies|enedis|grdf|veolia|suez/i, categoryId: 'utilities' },
  { pattern: /loyer|location|fonciere|syndic|charges copro/i, categoryId: 'housing' },
  { pattern: /maaf|axa|maif|matmut|generali|allianz|groupama|gan |mma /i, categoryId: 'insurance' },
  { pattern: /sncf|ratp|navigo|blablacar|flixbus|ouigo|trainline|tgv inoui/i, categoryId: 'transport' },
  { pattern: /uber(?!\s*eats)|bolt|free now|heetch|kapten/i, categoryId: 'transport' },
  { pattern: /total |shell|esso |bp |intermarch.*carbur|leclerc.*carbur|carbur/i, categoryId: 'fuel' },
  { pattern: /pharmacie|doctolib|mutuelle hopital|laboratoire|opticien|dentiste|medecin|clinique/i, categoryId: 'pharmacy' },
  { pattern: /mutuelle(?! hopital)|hospitalisation|chirurgie|urgences|ehpad|maison de retraite/i, categoryId: 'health' },
  { pattern: /amazon|cdiscount|fnac|darty|leroy merlin|castorama|ikea|but |conforama/i, categoryId: 'shopping' },
  { pattern: /zalando|asos|h&m|zara|uniqlo|decathlon|sephora|nocibe|sport2000/i, categoryId: 'shopping' },
  { pattern: /cinema|ugc|pathe|gaumont|theatre|concert|fnac spectacles|ticketmaster/i, categoryId: 'leisure' },
  { pattern: /booking|airbnb|hotel|hotels\.com|expedia|ryanair|easyjet|air france|transavia|ifa hotels/i, categoryId: 'travel' },
  { pattern: /salaire|virement employeur|paie |paiement\s+salaire|net a payer/i, categoryId: 'salary' },
  { pattern: /caf |allocation|allocataire|^apl\b|alloc\s+log/i, categoryId: 'other_income' },
  { pattern: /pole emploi|france travail|assedic|are\s+/i, categoryId: 'other_income' },
  { pattern: /cnav |carsat |pension|retraite\s+vers/i, categoryId: 'other_income' },
  { pattern: /interets\s+crediteur|coupon|dividende|distribution\s+opcvm|rb\s+coupon/i, categoryId: 'invest_income' },
  { pattern: /impot|tresor public|dgfip|taxe foncier|taxe habitation|cfe /i, categoryId: 'taxes' },
  { pattern: /retrait|dab |distributeur|retrait d.esp.ces|^ret\s+(gab|cb|dab)/i, categoryId: 'cash' },
  { pattern: /vers(ement)?\s+(livret|epargne|pel|pee|per\b)|virement.*(livret|epargne)|prelev.*epargne|alimentation.*compte/i, categoryId: 'savings' },
  { pattern: /\b(epargne|livret a|ldds|lep |pel\b|pee\b|per\b)/i, categoryId: 'savings' },
  { pattern: /pea |bourse|action |titre |sicav|opcvm|etf |trade\s+republic|degiro|interactive\s+broker|saxo /i, categoryId: 'investment' },
  { pattern: /commission|cotisation\s+carte|agios|frais\s+(de\s+)?(tenue|gestion|dossier|bancaire|sur)|forfait\s+compte|interets\s+debiteurs/i, categoryId: 'fees' },
  { pattern: /crèche|creche|nounou|assistante mater|cantine|periscolaire|garde enfant|halte garderie/i, categoryId: 'childcare' },
  { pattern: /ecole|centre aere|activite enfant|jouet|natalys|orchestra/i, categoryId: 'children' },
  { pattern: /cultura|amazon kindle|udemy|coursera|formation|skillshare|edx /i, categoryId: 'education' },
  // Virements RECUS d'un tiers (souvent revenu ponctuel — remboursement, cadeau, freelance).
  { pattern: /vir(ement)?\s+(re[cç]u|en\s+(votre|ma)\s+faveur|de\s+(la\s+part\s+de|m\.|mme|monsieur|madame))|virement.*re[cç]u/i, categoryId: 'other_income' },
  // Virements EMIS / SEPA / INST / internes — catch-all transfer LAST.
  { pattern: /vir(ement)?\s+(emis|sortant|sepa|inst|instantan|interne|permanent|programme)\b|^vir\.?\s+|prelevement.*virement|annulation\s+virement|virement\s+compte|de:.*vers:/i, categoryId: 'transfer' },

  // ---- Sub-category patterns FR (inspired by cozy-banks/brands.json) ----
  // Streaming vidéo
  { pattern: /netflix|disney\s*\+|disney plus|prime video|canal\+|salto|paramount\+|hbo|apple tv|molotov/i, categoryId: 'subs_video' },
  // Streaming musique
  { pattern: /spotify|deezer|apple music|youtube music|tidal|qobuz|soundcloud|napster/i, categoryId: 'subs_music' },
  // Cloud & logiciels
  { pattern: /icloud|google one|dropbox|microsoft 365|office 365|adobe|github|notion|linear|canva|figma|evernote|lastpass|1password|nordvpn|expressvpn|surfshark|proton |scaleway|ovh\b/i, categoryId: 'subs_cloud' },
  // Apple/Google billing (services génériques)
  { pattern: /apple\.com\/bill|app store|appstore|itunes|google play|playstore|google\*|microsoft store|xbox|playstation|nintendo|steam|epic games/i, categoryId: 'subs_services' },
  // Salle de sport
  { pattern: /basic-?fit|basic fit|fitness park|anytime fitness|on air fitness|on air|l'orange bleue|neoness|magic form|keepcool|club med gym|gigafit|cmg sports|salle de sport/i, categoryId: 'subs_gym' },
  // Presse & médias
  { pattern: /le monde|le figaro|liberation|mediapart|les echos|l.equipe|la croix|le point|nouvel obs/i, categoryId: 'subs_press' },
  // Supermarchés FR (overrides generic groceries)
  { pattern: /\bcarrefour\b|\bcrf\b|\bleclerc\b(?!.*carbur)|\blidl\b|\bauchan\b|\bmonoprix\b|\bmonop\b|\bfranprix\b|\bintermarch\b(?!.*carbur)|\bcasino\b|\bsuper u\b|\bbio.?coop\b|\bnaturalia\b/i, categoryId: 'groceries_super' },
  // Surgelés (Picard)
  { pattern: /\bpicard\b/i, categoryId: 'groceries_frozen' },
  // Boulangerie
  { pattern: /boulangerie|paul\b|brioche dor|pain\s+quotidien|maison kayser/i, categoryId: 'groceries_bakery' },
  // Livraison
  { pattern: /uber eats|deliveroo|just eat|frichti|too good to go/i, categoryId: 'resto_delivery' },
  // Fast-food
  { pattern: /mcdonald|burger king|kfc|subway|tacos|chipotle/i, categoryId: 'resto_fast' },
  // Café / bar
  { pattern: /starbucks|columbus|costa coffee|caf[eé]\s|brasserie|bistrot/i, categoryId: 'resto_cafe' },
  // Internet & télécoms (overrides generic utilities)
  { pattern: /\bfree\b(?!\s*now)|\bsfr\b|\borange\b|\bbouygues\b|\bsosh\b|\bred by sfr\b|\bprixtel\b|\bnumericable\b/i, categoryId: 'internet_telecom' },
  // Électricité & gaz
  { pattern: /\bedf\b|\bengie\b|\btotal energies\b|enedis|\bgrdf\b|direct energie|ekwateur/i, categoryId: 'electricity_gas' },
  // Eau
  { pattern: /\bveolia\b|\bsuez\b|\bsaur\b|compagnie\s+des\s+eaux|syndicat.*eaux/i, categoryId: 'water' },
  // Transports en commun
  { pattern: /\bsncf\b|\bratp\b|\bnavigo\b|trainline|ouigo|tgv inoui|flixbus|blablacar/i, categoryId: 'public_transport' },
  // Taxi / VTC
  { pattern: /\buber\b(?!\s*eats)|\bbolt\b|free now|\bheetch\b|kapten|taxi g7/i, categoryId: 'taxi_vtc' },
  // Stationnement & péages
  { pattern: /\bapcoa\b|\bindigo\b|effia\b|parking\b|vinci\s+autoroute|aprr|escota|sanef|asf\b|cofiroute/i, categoryId: 'parking_tolls' },
  // Pharmacie
  { pattern: /pharmacie/i, categoryId: 'health_pharmacy' },
  // Médecin & spécialistes
  { pattern: /doctolib|laboratoire|medecin|clinique|hopital|maeva\s+sant/i, categoryId: 'health_doctor' },
  // Dentaire / optique
  { pattern: /dentiste|opticien|optic 2000|alain afflelou|lissac|grandvision/i, categoryId: 'health_dental_optical' },
  // Mutuelle santé
  { pattern: /mutuelle(?! hopital)|harmonie\s+mutuelle|malakoff|generali\s+sant|mgen|aprionis|mma\s+sant/i, categoryId: 'insurance_health' },
  // Assurance auto
  { pattern: /assurance\s+auto|axa\s+auto|maaf\s+auto|matmut\s+auto|allianz\s+auto/i, categoryId: 'insurance_auto' },
  // Assurance habitation
  { pattern: /assurance\s+habit|axa\s+habit|maif\s+habit|matmut\s+habit|maaf\s+habit/i, categoryId: 'insurance_home' },
  // Loyer
  { pattern: /\bloyer\b|location\s+immo|nexity\s+gerance|foncia\s+gerance/i, categoryId: 'rent' },
  // Charges copropriété
  { pattern: /syndic|charges\s+copro|cabinet\s+gerance/i, categoryId: 'condo_fees' },
  // URSSAF
  { pattern: /\burssaf\b|cotisations?\s+sociales/i, categoryId: 'tax_urssaf' },
  // Impôt sur le revenu
  { pattern: /impot\s+sur\s+le\s+revenu|impots?\s+ir\b|prelevement\s+a\s+la\s+source|pasrau|finances\s+publiques/i, categoryId: 'tax_income' },
  // Taxe foncière
  { pattern: /taxe\s+fonci/i, categoryId: 'tax_property' },
  // Taxe d'habitation
  { pattern: /taxe\s+d.?habitation/i, categoryId: 'tax_housing' },
  // Crèche / Nounou
  { pattern: /cr[eè]che|nounou|assistante\s+mater|halte\s+garderie|micro.?cr[eè]che/i, categoryId: 'children_childcare' },
  // Cantine
  { pattern: /cantine|periscolaire|ecole.*restauration|caisse\s+ecoles/i, categoryId: 'children_school_meals' },
  // Bébé
  { pattern: /natalys|orchestra|aubert|kiabi.*bebe|du pareil au meme|babymoov/i, categoryId: 'children_baby' },
  // Allocations
  { pattern: /\bcaf\b|allocation|allocataire|\bapl\b|prime\s+(activite|naissance)/i, categoryId: 'allowances' },
  // Marketplace
  { pattern: /\bamazon\b|cdiscount|\bvinted\b|leboncoin|\baliexpress\b|\btemu\b|\bshein\b/i, categoryId: 'shop_marketplace' },
  // Électronique
  { pattern: /\bfnac\b|\bdarty\b|boulanger|\bldlc\b|materiel\.net|grosbill|topachat/i, categoryId: 'shop_electronics' },
  // Vol
  { pattern: /ryanair|easyjet|air france|transavia|vueling|wizz air|emirates|qatar airways|klm\b|lufthansa/i, categoryId: 'travel_flight' },
  // Hôtel / Airbnb
  { pattern: /\bbooking\.com\b|\bairbnb\b|hotels\.com|expedia|accor|ibis\b|mercure|novotel/i, categoryId: 'travel_lodging' },
];

export const BANK_PROFILES = {
  revolut_fr: {
    name: 'Revolut',
    detect: (headers) => {
      const lower = headers.map(h => h.toLowerCase());
      return lower.includes('type') && lower.includes('produit') && lower.includes('description') && lower.includes('montant') && lower.includes('frais');
    },
    mapping: { date: 'Date de début', label: 'Description', amount: 'Montant', balance: 'Solde', fees: 'Frais', currency: 'Devise', state: 'État' },
    options: { skipPending: true, includeFeesInAmount: true },
  },
  credit_agricole: {
    name: 'Crédit Agricole',
    detect: (headers) => {
      const joined = headers.join(' ').toLowerCase();
      return /date.*op/i.test(joined) && /libell/i.test(joined) && (/d.bit/i.test(joined) || /cr.dit/i.test(joined));
    },
    mapping: null,
  },
  boursorama: {
    name: 'Boursorama',
    detect: (headers) => {
      const joined = headers.join(' ').toLowerCase();
      return /dateop/i.test(joined) || (/^date$/i.test(headers[0] || '') && /libell/i.test(joined) && /montant/i.test(joined));
    },
    mapping: null,
  },
};

export const ASSET_TYPES = [
  { id: 'checking_account', name: 'Compte courant', icon: Wallet, color: '#3b82f6', description: 'Compte chèque, dépôts à vue' },
  { id: 'savings_account', name: 'Livret épargne', icon: PiggyBank, color: '#0891b2', description: 'Livret A, LDDS, LEP, PEL' },
  { id: 'real_estate', name: 'Immobilier', icon: Home, color: '#f97316', description: 'Résidence principale, locatif' },
  { id: 'life_insurance', name: 'Assurance vie', icon: Heart, color: '#ec4899', description: 'Contrats AV (multi-supports, fonds €)' },
  { id: 'pea', name: 'PEA', icon: BarChart3, color: '#10b981', description: 'Plan Épargne Actions (max 150k€)' },
  { id: 'per', name: 'PER', icon: Target, color: '#06b6d4', description: 'Plan Épargne Retraite' },
  { id: 'crypto', name: 'Cryptomonnaies', icon: Bitcoin, color: '#f59e0b', description: 'BTC, ETH, autres' },
  { id: 'stocks', name: 'Titres / CTO', icon: Landmark, color: '#3b82f6', description: 'Compte-titres ordinaire' },
  { id: 'other_asset', name: 'Autre actif', icon: Coins, color: '#6b7280', description: 'Or, art, parts SCPI…' },
];

// Maps asset type → broad class used by the wealth allocation donut.
export const ASSET_CLASS_MAP = {
  checking_account:{ class: 'Liquidités',   color: '#3b82f6' },
  real_estate:     { class: 'Immobilier',   color: '#f97316' },
  life_insurance:  { class: 'Épargne',      color: '#ec4899' },
  pea:             { class: 'Placements',   color: '#10b981' },
  per:             { class: 'Retraite',     color: '#06b6d4' },
  savings_account: { class: 'Épargne',      color: '#0891b2' },
  crypto:          { class: 'Alternatifs',  color: '#f59e0b' },
  stocks:          { class: 'Placements',   color: '#3b82f6' },
  other_asset:     { class: 'Divers',       color: '#6b7280' },
};

export const LIABILITY_TYPES = [
  { id: 'mortgage', name: 'Crédit immobilier', icon: Home, color: '#7c2d12' },
  { id: 'consumer_loan', name: 'Crédit conso', icon: CreditCard, color: '#dc2626' },
  { id: 'auto_loan', name: 'Crédit auto', icon: CreditCard, color: '#ea580c' },
  { id: 'other_loan', name: 'Autre prêt', icon: Banknote, color: '#6b7280' },
];

// Member avatar palette — harmonised with the private-banking tokens. Stable
// order so the same person keeps the same colour across renders.
// Wealthly member palette — vivid but cohesive, all in the same family as the
// Wealthly brand gradient. Used for member dots / avatars across the app.
export const MEMBER_PALETTE = ['#3b6fe0', '#a78bfa', '#34d399', '#fbbf24', '#ec5a13', '#f472b6', '#06b6d4', '#94a3b8'];
