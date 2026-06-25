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

// Two-level taxonomy. Each row has `parent` (slug of parent, null = top-level).
// Mirrors backend/app/defaults.py — keep in sync.
export const DEFAULT_CATEGORIES = [
  // REVENUS
  { id: 'income',        name: 'Revenus',                 color: 'var(--positive)', type: 'income',   icon: '💰', kind: 'needs',   parent: null },
  { id: 'salary',        name: 'Salaire',                 color: 'var(--positive)', type: 'income',   icon: '💼', kind: 'needs',   parent: 'income' },
  { id: 'freelance',     name: 'Freelance / Indépendant', color: 'var(--positive)', type: 'income',   icon: '💻', kind: 'needs',   parent: 'income' },
  { id: 'rental_income', name: 'Revenus locatifs',        color: 'var(--positive)', type: 'income',   icon: '🏘️', kind: 'needs',   parent: 'income' },
  { id: 'invest_income', name: 'Dividendes & intérêts',   color: 'var(--positive)', type: 'income',   icon: '📈', kind: 'needs',   parent: 'income' },
  { id: 'allowances',    name: 'Allocations (CAF, APL…)', color: 'var(--positive)', type: 'income',   icon: '👨‍👩‍👧', kind: 'needs',   parent: 'income' },
  { id: 'reimbursements',name: 'Remboursements',          color: 'var(--positive)', type: 'income',   icon: '↩️', kind: 'needs',   parent: 'income' },
  { id: 'other_income',  name: 'Autres revenus',          color: 'var(--positive)', type: 'income',   icon: '💵', kind: 'needs',   parent: 'income' },

  // LOGEMENT
  { id: 'housing',            name: 'Logement',                color: 'var(--d4)', type: 'expense', icon: '🏠', kind: 'needs', parent: null },
  { id: 'rent',               name: 'Loyer',                   color: 'var(--d4)', type: 'expense', icon: '🔑', kind: 'needs', parent: 'housing' },
  { id: 'condo_fees',         name: 'Charges copropriété',     color: 'var(--d4)', type: 'expense', icon: '🏢', kind: 'needs', parent: 'housing' },
  { id: 'home_maintenance',   name: 'Entretien & travaux',     color: 'var(--d4)', type: 'expense', icon: '🔧', kind: 'needs', parent: 'housing' },
  { id: 'furniture',          name: 'Mobilier & déco maison',  color: 'var(--d4)', type: 'expense', icon: '🛋️', kind: 'wants', parent: 'housing' },
  { id: 'household_cleaning', name: 'Produits ménagers',       color: 'var(--d4)', type: 'expense', icon: '🧴', kind: 'needs', parent: 'housing' },
  { id: 'household_laundry',  name: 'Pressing & blanchisserie',color: 'var(--d4)', type: 'expense', icon: '👔', kind: 'needs', parent: 'housing' },
  { id: 'household_help',     name: 'Aide à domicile',         color: 'var(--d4)', type: 'expense', icon: '🤲', kind: 'needs', parent: 'housing' },

  // ÉNERGIE & INTERNET
  { id: 'utilities',       name: 'Énergie & Internet',  color: 'var(--d7)', type: 'expense', icon: '⚡', kind: 'needs', parent: null },
  { id: 'electricity_gas', name: 'Électricité & gaz',   color: 'var(--d7)', type: 'expense', icon: '💡', kind: 'needs', parent: 'utilities' },
  { id: 'water',           name: 'Eau',                 color: 'var(--d7)', type: 'expense', icon: '💧', kind: 'needs', parent: 'utilities' },
  { id: 'internet_telecom',name: 'Internet & téléphone',color: 'var(--d7)', type: 'expense', icon: '📶', kind: 'needs', parent: 'utilities' },

  // ASSURANCES
  { id: 'insurance',       name: 'Assurances',          color: 'var(--d3)', type: 'expense', icon: '🛡️', kind: 'needs', parent: null },
  { id: 'insurance_home',  name: 'Assurance habitation',color: 'var(--d3)', type: 'expense', icon: '🏡', kind: 'needs', parent: 'insurance' },
  { id: 'insurance_auto',  name: 'Assurance auto',      color: 'var(--d3)', type: 'expense', icon: '🚙', kind: 'needs', parent: 'insurance' },
  { id: 'insurance_health',name: 'Mutuelle santé',      color: 'var(--d3)', type: 'expense', icon: '❤️‍🩹',kind: 'needs', parent: 'insurance' },
  { id: 'insurance_life',  name: 'Prévoyance & vie',    color: 'var(--d3)', type: 'expense', icon: '🤝', kind: 'needs', parent: 'insurance' },
  { id: 'insurance_loan',  name: 'Assurance de prêt',   color: 'var(--d3)', type: 'expense', icon: '📋', kind: 'needs', parent: 'insurance' },

  // ABONNEMENTS
  { id: 'subscriptions', name: 'Abonnements',              color: 'var(--d5)', type: 'expense', icon: '📱', kind: 'wants', parent: null },
  { id: 'subs_video',    name: 'Streaming vidéo',          color: 'var(--d5)', type: 'expense', icon: '🎬', kind: 'wants', parent: 'subscriptions' },
  { id: 'subs_music',    name: 'Streaming musique',        color: 'var(--d5)', type: 'expense', icon: '🎵', kind: 'wants', parent: 'subscriptions' },
  { id: 'subs_cloud',    name: 'Cloud & logiciels',        color: 'var(--d5)', type: 'expense', icon: '☁️', kind: 'wants', parent: 'subscriptions' },
  { id: 'subs_gym',      name: 'Salle de sport',           color: 'var(--d5)', type: 'expense', icon: '🏋️', kind: 'wants', parent: 'subscriptions' },
  { id: 'subs_press',    name: 'Presse & médias',          color: 'var(--d5)', type: 'expense', icon: '📰', kind: 'wants', parent: 'subscriptions' },
  { id: 'subs_services', name: 'Apple, Google & services', color: 'var(--d5)', type: 'expense', icon: '🍎', kind: 'wants', parent: 'subscriptions' },

  // COURSES
  { id: 'groceries',         name: 'Courses',               color: 'var(--d2)', type: 'expense', icon: '🛒', kind: 'needs', parent: null },
  { id: 'groceries_super',   name: 'Supermarché',           color: 'var(--d2)', type: 'expense', icon: '🏪', kind: 'needs', parent: 'groceries' },
  { id: 'groceries_frozen',  name: 'Surgelés (Picard)',     color: 'var(--d2)', type: 'expense', icon: '🧊', kind: 'needs', parent: 'groceries' },
  { id: 'groceries_organic', name: 'Bio / primeur / marché',color: 'var(--d2)', type: 'expense', icon: '🥕', kind: 'needs', parent: 'groceries' },
  { id: 'groceries_bakery',  name: 'Boulangerie',           color: 'var(--d2)', type: 'expense', icon: '🥖', kind: 'needs', parent: 'groceries' },

  // RESTAURANTS
  { id: 'restaurants',    name: 'Restaurants',                     color: 'var(--d9)', type: 'expense', icon: '🍽️', kind: 'wants', parent: null },
  { id: 'resto_meal',     name: 'Restaurant',                      color: 'var(--d9)', type: 'expense', icon: '🍷', kind: 'wants', parent: 'restaurants' },
  { id: 'resto_fast',     name: 'Fast-food',                       color: 'var(--d9)', type: 'expense', icon: '🍔', kind: 'wants', parent: 'restaurants' },
  { id: 'resto_cafe',     name: 'Café / bar',                      color: 'var(--d9)', type: 'expense', icon: '☕', kind: 'wants', parent: 'restaurants' },
  { id: 'resto_delivery', name: 'Livraison (UberEats, Deliveroo)', color: 'var(--d9)', type: 'expense', icon: '🛵', kind: 'wants', parent: 'restaurants' },

  // TRANSPORT
  { id: 'transport',       name: 'Transport',              color: 'var(--d1)', type: 'expense', icon: '🚗', kind: 'needs', parent: null },
  { id: 'fuel',            name: 'Carburant',              color: 'var(--d1)', type: 'expense', icon: '⛽', kind: 'needs', parent: 'transport' },
  { id: 'parking_tolls',   name: 'Stationnement & péages',color: 'var(--d1)', type: 'expense', icon: '🅿️', kind: 'needs', parent: 'transport' },
  { id: 'public_transport',name: 'Transports en commun',  color: 'var(--d1)', type: 'expense', icon: '🚇', kind: 'needs', parent: 'transport' },
  { id: 'taxi_vtc',        name: 'Taxi / VTC',             color: 'var(--d1)', type: 'expense', icon: '🚕', kind: 'wants', parent: 'transport' },
  { id: 'car_maintenance', name: 'Entretien véhicule',     color: 'var(--d1)', type: 'expense', icon: '🔩', kind: 'needs', parent: 'transport' },

  // SHOPPING
  { id: 'shopping',         name: 'Shopping',                     color: 'var(--d8)', type: 'expense', icon: '🛍️', kind: 'wants', parent: null },
  { id: 'shop_clothing',    name: 'Vêtements',                    color: 'var(--d8)', type: 'expense', icon: '👕', kind: 'wants', parent: 'shopping' },
  { id: 'shop_electronics', name: 'Électronique',                 color: 'var(--d8)', type: 'expense', icon: '💻', kind: 'wants', parent: 'shopping' },
  { id: 'shop_gifts',       name: 'Cadeaux',                      color: 'var(--d8)', type: 'expense', icon: '🎁', kind: 'wants', parent: 'shopping' },
  { id: 'shop_marketplace', name: 'Marketplace (Amazon, Vinted)', color: 'var(--d8)', type: 'expense', icon: '📦', kind: 'wants', parent: 'shopping' },

  // LOISIRS
  { id: 'leisure',         name: 'Loisirs',                 color: 'var(--d3)', type: 'expense', icon: '🎭', kind: 'wants', parent: null },
  { id: 'leisure_culture', name: 'Cinéma, concerts, expos', color: 'var(--d3)', type: 'expense', icon: '🎟️', kind: 'wants', parent: 'leisure' },
  { id: 'leisure_sport',   name: 'Sport (ponctuel)',         color: 'var(--d3)', type: 'expense', icon: '⚽', kind: 'wants', parent: 'leisure' },
  { id: 'leisure_books',   name: 'Livres & presse',          color: 'var(--d3)', type: 'expense', icon: '📖', kind: 'wants', parent: 'leisure' },
  { id: 'leisure_hobbies', name: 'Hobbies & jeux',           color: 'var(--d3)', type: 'expense', icon: '🎮', kind: 'wants', parent: 'leisure' },

  // VOYAGES
  { id: 'travel',         name: 'Voyages',              color: 'var(--d7)', type: 'expense', icon: '✈️', kind: 'wants', parent: null },
  { id: 'travel_flight',  name: 'Vol',                  color: 'var(--d7)', type: 'expense', icon: '🛫', kind: 'wants', parent: 'travel' },
  { id: 'travel_lodging', name: 'Hôtel / Airbnb',       color: 'var(--d7)', type: 'expense', icon: '🏨', kind: 'wants', parent: 'travel' },
  { id: 'travel_train',   name: 'Train longue distance', color: 'var(--d7)', type: 'expense', icon: '🚄', kind: 'wants', parent: 'travel' },
  { id: 'travel_rental',  name: 'Location voiture',     color: 'var(--d7)', type: 'expense', icon: '🚗', kind: 'wants', parent: 'travel' },

  // SANTÉ
  { id: 'health',                name: 'Santé',                 color: 'var(--d6)', type: 'expense', icon: '⚕️', kind: 'needs', parent: null },
  { id: 'health_doctor',         name: 'Médecin & spécialistes',color: 'var(--d6)', type: 'expense', icon: '🩺', kind: 'needs', parent: 'health' },
  { id: 'health_pharmacy',       name: 'Pharmacie',             color: 'var(--d6)', type: 'expense', icon: '💊', kind: 'needs', parent: 'health' },
  { id: 'health_dental_optical', name: 'Dentaire & optique',    color: 'var(--d6)', type: 'expense', icon: '🦷', kind: 'needs', parent: 'health' },
  { id: 'health_wellness',       name: 'Bien-être & spa',       color: 'var(--d6)', type: 'expense', icon: '💆', kind: 'wants', parent: 'health' },

  // ENFANTS
  { id: 'children',              name: 'Enfants',                      color: 'var(--d4)', type: 'expense', icon: '👶', kind: 'needs', parent: null },
  { id: 'children_childcare',    name: 'Crèche / Nounou',              color: 'var(--d4)', type: 'expense', icon: '🧸', kind: 'needs', parent: 'children' },
  { id: 'children_school_meals', name: 'Cantine & périscolaire',       color: 'var(--d4)', type: 'expense', icon: '🍱', kind: 'needs', parent: 'children' },
  { id: 'children_baby',         name: 'Lait, couches, bébé',          color: 'var(--d4)', type: 'expense', icon: '🍼', kind: 'needs', parent: 'children' },
  { id: 'children_clothing',     name: 'Vêtements enfants',            color: 'var(--d4)', type: 'expense', icon: '👶', kind: 'needs', parent: 'children' },
  { id: 'children_activities',   name: 'Activités & loisirs enfants',  color: 'var(--d4)', type: 'expense', icon: '🎨', kind: 'wants', parent: 'children' },
  { id: 'children_tuition',      name: 'Frais de scolarité',           color: 'var(--d4)', type: 'expense', icon: '🎓', kind: 'needs', parent: 'children' },

  // ÉDUCATION
  { id: 'education', name: 'Éducation', color: 'var(--d3)', type: 'expense', icon: '📚', kind: 'needs', parent: null },

  // IMPÔTS & TAXES
  { id: 'taxes',       name: 'Impôts & Taxes',       color: 'var(--d6)', type: 'expense', icon: '🏛️', kind: 'needs', parent: null },
  { id: 'tax_income',  name: 'Impôt sur le revenu',  color: 'var(--d6)', type: 'expense', icon: '📋', kind: 'needs', parent: 'taxes' },
  { id: 'tax_property',name: 'Taxe foncière',        color: 'var(--d6)', type: 'expense', icon: '🏠', kind: 'needs', parent: 'taxes' },
  { id: 'tax_housing', name: "Taxe d'habitation",    color: 'var(--d6)', type: 'expense', icon: '🏘️', kind: 'needs', parent: 'taxes' },
  { id: 'tax_urssaf',  name: 'URSSAF / cotisations', color: 'var(--d6)', type: 'expense', icon: '📑', kind: 'needs', parent: 'taxes' },

  // FINANCE & ÉPARGNE
  { id: 'financial',  name: 'Finance & Épargne', color: 'var(--d6)', type: 'expense',  icon: '🏦', kind: 'savings', parent: null },
  { id: 'fees',       name: 'Frais bancaires',   color: 'var(--d6)', type: 'expense',  icon: '💳', kind: 'needs',   parent: 'financial' },
  { id: 'savings',    name: 'Épargne',           color: 'var(--d2)', type: 'transfer', icon: '🏦', kind: 'savings', parent: 'financial' },
  { id: 'investment', name: 'Investissements',   color: 'var(--d2)', type: 'transfer', icon: '📊', kind: 'savings', parent: 'financial' },

  // CRÉDIT
  { id: 'loans',            name: 'Crédit',                color: 'var(--d1)', type: 'expense', icon: '🏦', kind: 'needs', parent: null },
  { id: 'loan_auto',        name: 'Crédit auto',           color: 'var(--d1)', type: 'expense', icon: '🚗', kind: 'needs', parent: 'loans' },
  { id: 'loan_student',     name: 'Crédit étudiant',       color: 'var(--d1)', type: 'expense', icon: '🎓', kind: 'needs', parent: 'loans' },
  { id: 'loan_consumer',    name: 'Crédit conso',          color: 'var(--d1)', type: 'expense', icon: '💳', kind: 'needs', parent: 'loans' },
  { id: 'loan_personal',    name: 'Prêt personnel',        color: 'var(--d1)', type: 'expense', icon: '🤝', kind: 'needs', parent: 'loans' },
  { id: 'loan_revolving',   name: 'Crédit renouvelable',   color: 'var(--d1)', type: 'expense', icon: '🔄', kind: 'needs', parent: 'loans' },
  { id: 'credit_principal', name: 'Remboursement capital', color: 'var(--d1)', type: 'expense', icon: '💸', kind: 'needs', parent: 'loans' },
  { id: 'loan_mortgage',    name: 'Crédit immobilier',     color: 'var(--d1)', type: 'expense', icon: '🏠', kind: 'needs', parent: 'loans' },

  // SOINS PERSONNELS
  { id: 'personal_care',         name: 'Soins personnels',   color: 'var(--d5)', type: 'expense', icon: '💅', kind: 'wants', parent: null },
  { id: 'personal_care_hair',    name: 'Coiffeur & barbier', color: 'var(--d5)', type: 'expense', icon: '✂️', kind: 'wants', parent: 'personal_care' },
  { id: 'personal_care_beauty',  name: 'Cosmétiques & beauté',color: 'var(--d5)',type: 'expense', icon: '💄', kind: 'wants', parent: 'personal_care' },
  { id: 'personal_care_hygiene', name: 'Parfum & hygiène',   color: 'var(--d5)', type: 'expense', icon: '🧼', kind: 'needs', parent: 'personal_care' },

  // ANIMAUX
  { id: 'pets',         name: 'Animaux',                  color: 'var(--d4)', type: 'expense', icon: '🐾', kind: 'wants', parent: null },
  { id: 'pets_vet',     name: 'Vétérinaire',              color: 'var(--d4)', type: 'expense', icon: '🏥', kind: 'needs', parent: 'pets' },
  { id: 'pets_food',    name: 'Nourriture & accessoires', color: 'var(--d4)', type: 'expense', icon: '🦮', kind: 'needs', parent: 'pets' },
  { id: 'pets_grooming',name: 'Toilettage',               color: 'var(--d4)', type: 'expense', icon: '🛁', kind: 'wants', parent: 'pets' },

  // LEGACY ALIASES (slugs anciens — conservés pour les transactions existantes)
  { id: 'sport',     name: 'Sport & Fitness',    color: 'var(--d5)', type: 'expense', icon: '🏋️', kind: 'wants', parent: 'subscriptions' },
  { id: 'streaming', name: 'Streaming & Médias', color: 'var(--d5)', type: 'expense', icon: '🎬', kind: 'wants', parent: 'subscriptions' },
  { id: 'childcare', name: 'Garde & Crèche',     color: 'var(--d4)', type: 'expense', icon: '🧸', kind: 'needs', parent: 'children' },
  { id: 'pharmacy',  name: 'Pharmacie',          color: 'var(--d6)', type: 'expense', icon: '💊', kind: 'needs', parent: 'health' },
  { id: 'household', name: 'Ménage',             color: 'var(--d4)', type: 'expense', icon: '🧹', kind: 'needs', parent: 'housing' },

  // DIVERS
  { id: 'cash',          name: 'Retrait DAB',        color: 'var(--ink-3)', type: 'expense',  icon: '💵', kind: 'wants',   parent: null },
  { id: 'transfer',      name: 'Virements internes', color: 'var(--ink-3)', type: 'transfer', icon: '🔄', kind: 'savings', parent: null },
  { id: 'uncategorized', name: 'Non catégorisé',     color: 'var(--ink-3)', type: 'expense',  icon: '❓', kind: 'wants',   parent: null },
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
  { pattern: /basic-?fit|basic fit|fitness park|anytime fitness|on air fitness|on air|l'orange bleue|neoness|magic form|keepcool|club med gym|elancia|gigafit|cmg sports|salle de sport|sport club|moving/i, categoryId: 'subs_gym' },
  { pattern: /netflix|spotify|disney\+|disney plus|prime video|deezer|youtube premium|canal\+|salto|paramount|hbo|apple tv|apple music|soundcloud|tidal|qobuz|napster|molotov/i, categoryId: 'subs_video' },
  { pattern: /hellofresh|hello fresh|quitoque|gousto|kitchen daily|frichti/i, categoryId: 'subscriptions' },
  { pattern: /le monde|le figaro|liberation|mediapart|les echos|l.equipe|la croix|le point|nouvel obs|lemag/i, categoryId: 'subs_press' },
  { pattern: /sfr|orange|free mobile|bouygues|red by sfr|sosh|prixtel/i, categoryId: 'utilities' },
  { pattern: /edf |engie|total energies|enedis|grdf|veolia|suez/i, categoryId: 'utilities' },
  { pattern: /loyer|location|fonciere|syndic|charges copro/i, categoryId: 'housing' },
  { pattern: /maaf|axa|maif|matmut|generali|allianz|groupama|gan |mma /i, categoryId: 'insurance' },
  { pattern: /sncf|ratp|navigo|blablacar|flixbus|ouigo|trainline|tgv inoui/i, categoryId: 'transport' },
  { pattern: /uber(?!\s*eats)|bolt|free now|heetch|kapten/i, categoryId: 'transport' },
  { pattern: /total |shell|esso |bp |intermarch.*carbur|leclerc.*carbur|carbur/i, categoryId: 'fuel' },
  { pattern: /pharmacie|doctolib|mutuelle hopital|laboratoire|opticien|dentiste|medecin|clinique/i, categoryId: 'health_pharmacy' },
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
  { pattern: /vir(ement)?\s+(re[cç]u|en\s+(votre|ma)\s+faveur|de\s+(la\s+part\s+de|m\.|mme|monsieur|madame))|virement.*re[cç]u/i, categoryId: 'other_income' },
  { pattern: /vir(ement)?\s+(emis|sortant|sepa|inst|instantan|interne|permanent|programme)\b|^vir\.?\s+|prelevement.*virement|annulation\s+virement|virement\s+compte|de:.*vers:/i, categoryId: 'transfer' },
  { pattern: /netflix|disney\s*\+|disney plus|prime video|canal\+|salto|paramount\+|hbo|apple tv|molotov/i, categoryId: 'subs_video' },
  { pattern: /spotify|deezer|apple music|youtube music|tidal|qobuz|soundcloud|napster/i, categoryId: 'subs_music' },
  { pattern: /icloud|google one|dropbox|microsoft 365|office 365|adobe|github|notion|linear|canva|figma|evernote|lastpass|1password|nordvpn|expressvpn|surfshark|proton |scaleway|ovh\b/i, categoryId: 'subs_cloud' },
  { pattern: /apple\.com\/bill|app store|appstore|itunes|google play|playstore|google\*|microsoft store|xbox|playstation|nintendo|steam|epic games/i, categoryId: 'subs_services' },
  { pattern: /basic-?fit|basic fit|fitness park|anytime fitness|on air fitness|on air|l'orange bleue|neoness|magic form|keepcool|club med gym|gigafit|cmg sports|salle de sport/i, categoryId: 'subs_gym' },
  { pattern: /le monde|le figaro|liberation|mediapart|les echos|l.equipe|la croix|le point|nouvel obs/i, categoryId: 'subs_press' },
  { pattern: /\bcarrefour\b|\bcrf\b|\bleclerc\b(?!.*carbur)|\blidl\b|\bauchan\b|\bmonoprix\b|\bmonop\b|\bfranprix\b|\bintermarch\b(?!.*carbur)|\bcasino\b|\bsuper u\b|\bbio.?coop\b|\bnaturalia\b/i, categoryId: 'groceries_super' },
  { pattern: /\bpicard\b/i, categoryId: 'groceries_frozen' },
  { pattern: /boulangerie|paul\b|brioche dor|pain\s+quotidien|maison kayser/i, categoryId: 'groceries_bakery' },
  { pattern: /uber eats|deliveroo|just eat|frichti|too good to go/i, categoryId: 'resto_delivery' },
  { pattern: /mcdonald|burger king|kfc|subway|tacos|chipotle/i, categoryId: 'resto_fast' },
  { pattern: /starbucks|columbus|costa coffee|caf[eé]\s|brasserie|bistrot/i, categoryId: 'resto_cafe' },
  { pattern: /\bfree\b(?!\s*now)|\bsfr\b|\borange\b|\bbouygues\b|\bsosh\b|\bred by sfr\b|\bprixtel\b|\bnumericable\b/i, categoryId: 'internet_telecom' },
  { pattern: /\bedf\b|\bengie\b|\btotal energies\b|enedis|\bgrdf\b|direct energie|ekwateur/i, categoryId: 'electricity_gas' },
  { pattern: /\bveolia\b|\bsuez\b|\bsaur\b|compagnie\s+des\s+eaux|syndicat.*eaux/i, categoryId: 'water' },
  { pattern: /\bsncf\b|\bratp\b|\bnavigo\b|trainline|ouigo|tgv inoui|flixbus|blablacar/i, categoryId: 'public_transport' },
  { pattern: /\buber\b(?!\s*eats)|\bbolt\b|free now|\bheetch\b|kapten|taxi g7/i, categoryId: 'taxi_vtc' },
  { pattern: /\bapcoa\b|\bindigo\b|effia\b|parking\b|vinci\s+autoroute|aprr|escota|sanef|asf\b|cofiroute/i, categoryId: 'parking_tolls' },
  { pattern: /pharmacie/i, categoryId: 'health_pharmacy' },
  { pattern: /doctolib|laboratoire|medecin|clinique|hopital|maeva\s+sant/i, categoryId: 'health_doctor' },
  { pattern: /dentiste|opticien|optic 2000|alain afflelou|lissac|grandvision/i, categoryId: 'health_dental_optical' },
  { pattern: /mutuelle(?! hopital)|harmonie\s+mutuelle|malakoff|generali\s+sant|mgen|aprionis|mma\s+sant/i, categoryId: 'insurance_health' },
  { pattern: /assurance\s+auto|axa\s+auto|maaf\s+auto|matmut\s+auto|allianz\s+auto/i, categoryId: 'insurance_auto' },
  { pattern: /assurance\s+habit|axa\s+habit|maif\s+habit|matmut\s+habit|maaf\s+habit/i, categoryId: 'insurance_home' },
  { pattern: /\bloyer\b|location\s+immo|nexity\s+gerance|foncia\s+gerance/i, categoryId: 'rent' },
  { pattern: /syndic|charges\s+copro|cabinet\s+gerance/i, categoryId: 'condo_fees' },
  { pattern: /\burssaf\b|cotisations?\s+sociales/i, categoryId: 'tax_urssaf' },
  { pattern: /impot\s+sur\s+le\s+revenu|impots?\s+ir\b|prelevement\s+a\s+la\s+source|pasrau|finances\s+publiques/i, categoryId: 'tax_income' },
  { pattern: /taxe\s+fonci/i, categoryId: 'tax_property' },
  { pattern: /taxe\s+d.?habitation/i, categoryId: 'tax_housing' },
  { pattern: /cr[eè]che|nounou|assistante\s+mater|halte\s+garderie|micro.?cr[eè]che/i, categoryId: 'children_childcare' },
  { pattern: /cantine|periscolaire|ecole.*restauration|caisse\s+ecoles/i, categoryId: 'children_school_meals' },
  { pattern: /natalys|orchestra|aubert|kiabi.*bebe|du pareil au meme|babymoov/i, categoryId: 'children_baby' },
  { pattern: /\bcaf\b|allocation|allocataire|\bapl\b|prime\s+(activite|naissance)/i, categoryId: 'allowances' },
  { pattern: /\bamazon\b|cdiscount|\bvinted\b|leboncoin|\baliexpress\b|\btemu\b|\bshein\b/i, categoryId: 'shop_marketplace' },
  { pattern: /\bfnac\b|\bdarty\b|boulanger|\bldlc\b|materiel\.net|grosbill|topachat/i, categoryId: 'shop_electronics' },
  { pattern: /ryanair|easyjet|air france|transavia|vueling|wizz air|emirates|qatar airways|klm\b|lufthansa/i, categoryId: 'travel_flight' },
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

// Refonte tech 2026-06-25 : couleurs sur les tokens dataviz (--d1..d9) → palette
// cohérente, theme-aware (s'adapte light/dark) au lieu de l'arc-en-ciel Tailwind.
export const ASSET_TYPES = [
  { id: 'checking_account', name: 'Compte courant', icon: Wallet, color: 'var(--d1)', description: 'Compte chèque, dépôts à vue' },
  { id: 'savings_account', name: 'Livret épargne', icon: PiggyBank, color: 'var(--d2)', description: 'Livret A, LDDS, LEP, PEL' },
  { id: 'real_estate', name: 'Immobilier', icon: Home, color: 'var(--d4)', description: 'Résidence principale, locatif' },
  { id: 'life_insurance', name: 'Assurance vie', icon: Heart, color: 'var(--d5)', description: 'Contrats AV (multi-supports, fonds €)' },
  { id: 'pea', name: 'PEA', icon: BarChart3, color: 'var(--d3)', description: 'Plan Épargne Actions (max 150k€)' },
  { id: 'per', name: 'PER', icon: Target, color: 'var(--d7)', description: 'Plan Épargne Retraite' },
  { id: 'crypto', name: 'Cryptomonnaies', icon: Bitcoin, color: 'var(--d8)', description: 'BTC, ETH, autres' },
  { id: 'stocks', name: 'Titres / CTO', icon: Landmark, color: 'var(--d3)', description: 'Compte-titres ordinaire' },
  { id: 'other_asset', name: 'Autre actif', icon: Coins, color: 'var(--d6)', description: 'Or, art, parts SCPI…' },
];

export const ASSET_CLASS_MAP = {
  checking_account:{ class: 'Liquidités',   color: 'var(--d1)' },
  real_estate:     { class: 'Immobilier',   color: 'var(--d4)' },
  life_insurance:  { class: 'Épargne',      color: 'var(--d2)' },
  pea:             { class: 'Placements',   color: 'var(--d3)' },
  per:             { class: 'Retraite',     color: 'var(--d7)' },
  savings_account: { class: 'Épargne',      color: 'var(--d2)' },
  crypto:          { class: 'Alternatifs',  color: 'var(--d8)' },
  stocks:          { class: 'Placements',   color: 'var(--d3)' },
  other_asset:     { class: 'Divers',       color: 'var(--d6)' },
};

export const LIABILITY_TYPES = [
  { id: 'mortgage', name: 'Crédit immobilier', icon: Home, color: 'var(--d6)' },
  { id: 'consumer_loan', name: 'Crédit conso', icon: CreditCard, color: 'var(--d9)' },
  { id: 'auto_loan', name: 'Crédit auto', icon: CreditCard, color: 'var(--d5)' },
  { id: 'other_loan', name: 'Autre prêt', icon: Banknote, color: 'var(--ink-3)' },
];

// Palette membres — hex fixes assez foncés pour des initiales BLANCHES lisibles
// (identité stable inter-thèmes, comme les avatars Slack/Linear).
export const MEMBER_PALETTE = ['#2E5BFF', '#7C3AED', '#0E9F6E', '#0E7490', '#DB2777', '#475569', '#B45309', '#BE185D'];
