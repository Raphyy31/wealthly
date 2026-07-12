// ============================================================================
// positionsImport — parser universel CSV / XLSX pour les portefeuilles
//                   d'investissement (PEA, CTO, AV) toutes banques confondues.
//
// Stratégie :
//   1. Lecture fichier (CSV ou XLSX via SheetJS lazy-loaded à l'usage)
//   2. Détection du séparateur (`;`, `,`, `\t`)
//   3. Détection de la ligne d'en-tête (cherche la 1re ligne contenant
//      ISIN / libellé / quantité / valeur)
//   4. Auto-mapping des colonnes par mots-clés (FR + EN + variantes)
//   5. Si auto-mapping incomplet → wizard manuel côté UI
//   6. Mémorisation du mapping par "signature de banque" (set de headers)
//      → la 2e importation depuis la même banque est instantanée
//
// Output (par position) : { name, isin, quantity, buyingPrice, lastPrice, amount }
// (compatible avec le shape attendu par Wealth.jsx onConfirm)
// ============================================================================

// Mots-clés pour chaque champ Yotori Finance (normalisés sans accents/casse).
// L'ordre des hints compte : on match les plus spécifiques en premier.
const COLUMN_HINTS = {
  name: ['libelle', 'libellé', 'name', 'valeur', 'designation', 'instrument', 'security', 'titre', 'description', 'asset', 'product', 'produit', 'support'],
  isin: ['isin', 'code isin', 'codeisin', 'isincode', 'wkn'],
  ticker: ['symbol', 'symbole', 'ticker', 'mnemonique', 'mnémonique'],
  quantity: ['quantity', 'quantité', 'quantite', 'qte', 'qty', 'nombre', 'nombredetitres', 'nombre de titres', 'nombre de parts', 'shares', 'units', 'parts'],
  purchasePrice: ['purchaseprice', 'prixderevient', 'prix de revient', 'pru', 'prixmoyen', 'prix moyen', 'coursmoyen', 'cours moyen', 'costbasis', 'average cost', 'buyingprice', 'buying price', 'prixachat', 'prix achat', 'prix dachat', "prix d'achat"],
  lastPrice: ['lastprice', 'cours', 'coursactuel', 'cours actuel', 'price', 'last price', 'coursdecloture', 'cours de cloture', 'cours de clôture', 'marketprice', 'market price', 'currentprice', 'current price', 'unit price'],
  currentValue: ['amount', 'valeur', 'valorisation', 'value', 'marketvalue', 'market value', 'montant', 'valuation', 'totalvalue', 'valeur totale'],
};

// Normalise une chaîne pour comparaison (sans accents, espaces, ponctuation).
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Convertit une chaîne numérique FR ou EN en nombre.
// "1 234,56" / "1,234.56" / "1.234,56" → 1234.56
export function parseNumber(input) {
  if (typeof input === 'number') return input;
  if (input == null) return 0;
  const s = String(input).trim();
  if (!s) return 0;

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');

  if (hasDot && hasComma) {
    // Format EN "1,234.56" si dernier . > dernière , — sinon FR "1.234,56"
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastDot > lastComma) {
      return parseFloat(s.replace(/,/g, '')) || 0;
    } else {
      return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    }
  }
  if (hasComma) {
    // FR "1 234,56"
    return parseFloat(s.replace(/\s/g, '').replace(',', '.')) || 0;
  }
  // EN "1,234" treated as decimal-less; or "1234.56"
  return parseFloat(s.replace(/\s/g, '')) || 0;
}

// Auto-détecte le mapping des colonnes en cherchant les hints dans les headers.
// Pour chaque champ on essaie : (1) match exact, (2) match contenant.
export function autoDetectPositionsColumns(headers) {
  const mapping = {};
  const normHeaders = headers.map(norm);

  for (const [field, hints] of Object.entries(COLUMN_HINTS)) {
    const normHints = hints.map(norm);
    // Match exact d'abord (plus fiable)
    let idx = normHeaders.findIndex(h => normHints.includes(h));
    if (idx < 0) {
      // Match contenant (sur hints assez longs pour éviter les faux positifs)
      idx = normHeaders.findIndex(h =>
        normHints.some(hint => hint.length >= 4 && h.includes(hint))
      );
    }
    if (idx >= 0) mapping[field] = headers[idx];
  }
  return mapping;
}

// Vérifie qu'on a au minimum de quoi reconstituer les positions.
export function isMappingComplete(mapping) {
  if (!mapping.name) return false;
  if (!mapping.quantity) return false;
  // Une valeur — currentValue ou lastPrice — suffit pour reconstituer le reste
  return !!(mapping.currentValue || mapping.lastPrice);
}

// Découpe une ligne CSV en respectant les guillemets.
function parseCSVRow(line, sep) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === sep && !inQ) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

// Devine le séparateur (`;` est le plus courant en France, `,` ailleurs).
function detectSeparator(line) {
  const counts = {
    ';': (line.match(/;/g) || []).length,
    ',': (line.match(/,/g) || []).length,
    '\t': (line.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseCSV(text) {
  const stripped = text.replace(/^﻿/, ''); // BOM
  const lines = stripped.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const firstNonEmpty = lines.find(l => l.trim()) || lines[0];
  const sep = detectSeparator(firstNonEmpty);
  return lines.map(line => parseCSVRow(line, sep));
}

// Trouve la ligne d'en-tête : heuristique = première ligne qui contient
// au moins un des mots-clés connus. Permet de gérer les fichiers avec
// des lignes de méta-données au-dessus (Boursorama, BNP, etc.).
function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i].map(c => String(c || ''));
    if (row.length < 3) continue;
    const joined = row.join('|').toLowerCase();
    if (/isin|libell|valeur|quantit|symbol|titre|instrument|wkn/i.test(joined)) {
      return i;
    }
  }
  return 0;
}

// Point d'entrée principal : lit un fichier et renvoie tout ce qu'il faut.
// Renvoie : { headers, dataRows, mapping, autoDetected, error? }
export async function parsePositionsFile(file) {
  if (!file) return { error: 'Aucun fichier' };

  const name = file.name.toLowerCase();
  const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm');

  let rawRows;
  try {
    if (isXlsx) {
      // Lazy-load SheetJS uniquement quand l'utilisateur uploade un XLSX
      // (économie de ~600 kB sur le bundle initial).
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    } else {
      const text = await file.text();
      rawRows = parseCSV(text);
    }
  } catch (err) {
    return { error: `Lecture impossible : ${err.message}` };
  }

  // Strip lignes complètement vides
  const rows = rawRows.filter(r => r.some(c => String(c).trim() !== ''));
  if (rows.length < 2) {
    return { error: 'Fichier vide ou format non reconnu' };
  }

  const headerIdx = findHeaderRow(rows);
  const headers = rows[headerIdx].map(h => String(h || '').trim());
  const dataRows = rows.slice(headerIdx + 1);

  // Essai 1 : mapping appris depuis localStorage
  const learned = getLearnedMapping(headers);
  const mapping = learned || autoDetectPositionsColumns(headers);
  const autoDetected = isMappingComplete(mapping);

  return { headers, dataRows, mapping, autoDetected, fromLearned: !!learned };
}

// Applique un mapping pour produire la liste des positions.
export function applyPositionsMapping(headers, dataRows, mapping) {
  const colIdx = {};
  for (const [field, header] of Object.entries(mapping)) {
    if (header) colIdx[field] = headers.indexOf(header);
  }

  const positions = [];
  for (const row of dataRows) {
    const name = colIdx.name != null && colIdx.name >= 0
      ? String(row[colIdx.name] || '').trim()
      : '';
    if (!name) continue;

    const quantity = colIdx.quantity != null && colIdx.quantity >= 0
      ? parseNumber(row[colIdx.quantity])
      : 0;
    if (quantity === 0) continue; // skip lignes sans quantité

    const isin = colIdx.isin != null && colIdx.isin >= 0
      ? String(row[colIdx.isin] || '').trim().toUpperCase()
      : '';
    const ticker = colIdx.ticker != null && colIdx.ticker >= 0
      ? String(row[colIdx.ticker] || '').trim().toUpperCase()
      : '';
    const purchasePrice = colIdx.purchasePrice != null && colIdx.purchasePrice >= 0
      ? parseNumber(row[colIdx.purchasePrice])
      : 0;
    let lastPrice = colIdx.lastPrice != null && colIdx.lastPrice >= 0
      ? parseNumber(row[colIdx.lastPrice])
      : 0;
    let currentValue = colIdx.currentValue != null && colIdx.currentValue >= 0
      ? parseNumber(row[colIdx.currentValue])
      : 0;

    // Réconcilie : si on a quantité + valeur mais pas le cours, dériver
    if (!lastPrice && currentValue && quantity) lastPrice = currentValue / quantity;
    if (!currentValue && lastPrice && quantity) currentValue = lastPrice * quantity;

    positions.push({
      name,
      isin,
      ticker,
      tickerYahoo: isinToYahooTicker(isin),
      quantity,
      buyingPrice: purchasePrice,
      lastPrice,
      amount: currentValue,
    });
  }
  return positions;
}

export function importedPositionValue(position) {
  return parseNumber(position?.amount)
    || parseNumber(position?.quantity) * parseNumber(position?.lastPrice);
}

// Keeps the cash already present on the envelope while replacing or appending
// security lines. This is the number that must be persisted on the PEA/CTO
// parent after an import so the update is immediately visible.
export function portfolioValueAfterImport({ mode = 'replace', parentValue = 0, existingPositions = [], importedPositions = [] }) {
  const existingValue = existingPositions.reduce((sum, p) => sum + importedPositionValue({
    amount: p.currentValue ?? p.current_value,
    quantity: p.quantity,
    lastPrice: p.lastPrice,
  }), 0);
  const preservedCash = Math.max(0, parseNumber(parentValue) - existingValue);
  const importedValue = importedPositions.reduce((sum, p) => sum + importedPositionValue(p), 0);
  const positionsValue = mode === 'append' ? existingValue + importedValue : importedValue;
  return Math.round((positionsValue + preservedCash) * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────
// Persistance des mappings par signature de fichier (set des headers)
// → la 2e import depuis la même banque utilise le mapping appris.
// ─────────────────────────────────────────────────────────────────────────

const LEARNED_MAPPINGS_KEY = 'yotori:learned_position_mappings';

export function headersSignature(headers) {
  return headers.map(h => norm(h)).filter(Boolean).sort().join('|');
}

export function getLearnedMapping(headers) {
  try {
    const all = JSON.parse(localStorage.getItem(LEARNED_MAPPINGS_KEY) || '{}');
    return all[headersSignature(headers)] || null;
  } catch { return null; }
}

export function saveLearnedMapping(headers, mapping) {
  try {
    const all = JSON.parse(localStorage.getItem(LEARNED_MAPPINGS_KEY) || '{}');
    all[headersSignature(headers)] = mapping;
    localStorage.setItem(LEARNED_MAPPINGS_KEY, JSON.stringify(all));
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────
// ISIN → ticker Yahoo Finance (pour les ETFs PEA / actions FR courantes).
// Mapping minimal mais qui couvre les positions les plus communes des
// utilisateurs français. Yahoo n'expose pas de lookup direct, donc on
// maintient cette table à la main + on étend au fil des retours utilisateur.
// Si pas de match, on retourne null et l'utilisateur peut saisir le ticker
// Yahoo manuellement dans l'éditeur de position.
// ─────────────────────────────────────────────────────────────────────────

const ISIN_TO_YAHOO = {
  // ETFs World / Index courants en PEA
  LU1681043599: 'CW8.PA',     // Amundi MSCI World UCITS ETF
  FR0011869353: 'EWLD.PA',    // Lyxor PEA MSCI World
  FR0011871128: 'PUST.PA',    // Lyxor NASDAQ-100 PEA
  FR0010315770: 'ESE.PA',     // BNP Paribas Easy S&P 500
  FR0013412020: 'PE500.PA',   // Amundi PEA S&P 500
  IE00B4L5Y983: 'IWDA.AS',    // iShares Core MSCI World (CTO uniquement)
  IE00BJ0KDQ92: 'XWEQ.DE',    // Xtrackers MSCI World (CTO)
  // Actions FR phares (PEA-éligibles)
  FR0000121014: 'MC.PA',      // LVMH
  FR0000120271: 'TTE.PA',     // TotalEnergies
  FR0000120628: 'CS.PA',      // AXA
  FR0000120578: 'SAN.PA',     // Sanofi
  FR0000131906: 'RNO.PA',     // Renault
  FR0000131104: 'BNP.PA',     // BNP Paribas
  FR0000133308: 'ORA.PA',     // Orange
  FR0000125486: 'DG.PA',      // Vinci
  FR0000121667: 'EL.PA',      // EssilorLuxottica
  FR0014003TT8: 'AIR.PA',     // Airbus
  FR0010613471: 'AC.PA',      // Accor
  FR0000125007: 'SU.PA',      // Schneider Electric
  FR0000120321: 'OR.PA',      // L'Oréal
  FR0000120073: 'AI.PA',      // Air Liquide
  FR0010220475: 'CAP.PA',     // Capgemini
};

export function isinToYahooTicker(isin) {
  if (!isin) return null;
  return ISIN_TO_YAHOO[String(isin).toUpperCase()] || null;
}

// Liste des champs Yotori Finance + libellés courts pour l'UI du wizard de mapping
export const POSITION_FIELDS = [
  { key: 'name',          label: 'Nom / Libellé',        required: true },
  { key: 'isin',          label: 'ISIN',                 required: false },
  { key: 'ticker',        label: 'Symbole / Ticker',     required: false },
  { key: 'quantity',      label: 'Quantité',             required: true },
  { key: 'purchasePrice', label: 'Prix de revient',      required: false },
  { key: 'lastPrice',     label: 'Cours actuel',         required: false },
  { key: 'currentValue',  label: 'Valeur (= qty × cours)', required: false },
];
