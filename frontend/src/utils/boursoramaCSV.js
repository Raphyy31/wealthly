// Parse Boursorama positions CSV (semicolon, French decimals).
// Returns { positions: Array<{ name, isin, quantity, buyingPrice, lastPrice, amount }> }
// or { error: string } if format unrecognized.

const FR_NUMBER = (s) => {
  if (typeof s !== 'string') return parseFloat(s) || 0;
  const cleaned = s.replace(/\s/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

export function parseBoursoramaPositions(text) {
  if (!text || !text.trim()) return { error: 'Fichier vide' };
  // Strip BOM
  let s = text.replace(/^﻿/, '');
  const lines = s.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { error: 'Le fichier ne contient pas de positions' };

  const headerRaw = lines[0];
  const header = headerRaw.split(';').map(h => h.trim().toLowerCase());
  const requiredCols = ['name', 'isin', 'quantity', 'buyingprice', 'lastprice'];
  for (const col of requiredCols) {
    if (!header.includes(col)) {
      return { error: `Colonne manquante : ${col}. Vérifie que c'est bien un export Boursorama.` };
    }
  }
  const idx = (col) => header.indexOf(col);

  const positions = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i], ';');
    if (row.length < requiredCols.length) continue;
    positions.push({
      name: row[idx('name')]?.replace(/^"|"$/g, '').trim(),
      isin: row[idx('isin')]?.trim(),
      quantity: FR_NUMBER(row[idx('quantity')]),
      buyingPrice: FR_NUMBER(row[idx('buyingprice')]),
      lastPrice: FR_NUMBER(row[idx('lastprice')]),
      amount: header.includes('amount') ? FR_NUMBER(row[idx('amount')]) : null,
    });
  }
  return { positions };
}

function parseCSVRow(line, sep = ';') {
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
