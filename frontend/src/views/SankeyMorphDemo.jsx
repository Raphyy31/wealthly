// ──────────────────────────────────────────────────────────────────────
// SankeyMorphDemo — prototype isole pour decider Sankey morphing
// Accessible via URL #/sankey-demo. Pas integre dans la nav.
//
// Objectif : montrer un Sankey qui morphe smoothly entre 2 etats
// (Mois type vs Mai 2026 mock) au clic d'un toggle. Les nodes
// communs gardent leur position, les nouveaux poussent depuis 0.
//
// Test : si la lecture des deltas est intuitive → on peut shipper
// dans Monthly. Sinon on part sur la V2 sobre (cartes deviation).
// ──────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveContainer, Sankey, Layer, Tooltip } from 'recharts';
import { gsap } from '../utils/gsapSetup.js';

const fmt = new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR',
  maximumFractionDigits: 0, minimumFractionDigits: 0,
});

// Couleurs alignees palette papier-chaud + cobalt
const C = {
  income:    '#2D8E5C',
  housing:   '#D97757',
  food:      '#5B8C5A',
  transport: '#7388B5',
  leisure:   '#C16A8C',
  shopping:  '#A87DB8',
  hotel:     '#3D6BB8',
  saving:    '#2540D9',
};

// Memes nodes dans les 2 etats (un node absent = valeur 0)
const NODES = [
  { name: 'Salaire',     color: C.income,    level: 0, icon: '💼' },
  { name: 'Logement',    color: C.housing,   level: 1, icon: '🏠' },
  { name: 'Courses',     color: C.food,      level: 1, icon: '🛒' },
  { name: 'Restaurant',  color: C.leisure,   level: 1, icon: '🍽️' },
  { name: 'Transport',   color: C.transport, level: 1, icon: '🚗' },
  { name: 'Loisirs',     color: C.shopping,  level: 1, icon: '🎬' },
  { name: 'Hôtel',       color: C.hotel,     level: 1, icon: '🏨' },
  { name: 'Épargne',     color: C.saving,    level: 1, icon: '💰' },
];

// Etat A : Mois type — repartition habituelle
const STATE_A = [800, 400, 200, 150, 100, 0, 350]; // logement…epargne
// Etat B : Mai 2026 — gros depassement hotel + restau, epargne dezinguee
const STATE_B = [820, 350, 380, 220, 280, 300, 70];

// Construit data pour Recharts a partir d'un tableau de valeurs
function buildData(values) {
  const links = values.map((v, i) => ({
    source: 0,
    target: i + 1,
    value: Math.max(v, 0.5), // min 0.5 pour eviter layout casse
    color: NODES[i + 1].color,
    realValue: v, // pour affichage
  }));
  return {
    nodes: NODES.map(n => ({ ...n })),
    links,
  };
}

// Interpolation lineaire entre deux tableaux de valeurs
function lerp(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

export function SankeyMorphDemo() {
  const [target, setTarget] = useState('A');
  const [values, setValues] = useState(STATE_A);
  const valuesRef = useRef(STATE_A);
  const isFirstRunRef = useRef(true);

  useEffect(() => {
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }
    const to = target === 'A' ? STATE_A : STATE_B;
    const from = [...valuesRef.current];
    const obj = { p: 0 };
    gsap.to(obj, {
      p: 1,
      duration: 0.8,
      ease: 'power2.inOut',
      onUpdate() {
        const next = lerp(from, to, obj.p);
        valuesRef.current = next;
        setValues(next);
      },
    });
  }, [target]);

  const data = useMemo(() => buildData(values), [values]);
  const targetValues = target === 'A' ? STATE_A : STATE_B;

  // Total entrees = sum des targets
  const totalIncome = targetValues.reduce((s, v) => s + v, 0);
  const totalA = STATE_A.reduce((s, v) => s + v, 0);
  const totalB = STATE_B.reduce((s, v) => s + v, 0);
  const delta = totalB - totalA;

  return (
    <div className="sankey-demo-page" style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <div className="subview-header">
        <div>
          <h1>Prototype <em>Sankey morphing.</em></h1>
          <p>Toggle Mois type ↔ Mai 2026 — les flux animent leur largeur en 0.8 s.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        {/* Toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setTarget('A')}
            className="ds-chip"
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: target === 'A' ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: target === 'A' ? 'var(--accent-soft)' : 'var(--bg-elev)',
              color: target === 'A' ? 'var(--accent)' : 'var(--ink-2)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Mois type
          </button>
          <button
            onClick={() => setTarget('B')}
            className="ds-chip"
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: target === 'B' ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: target === 'B' ? 'var(--accent-soft)' : 'var(--bg-elev)',
              color: target === 'B' ? 'var(--accent)' : 'var(--ink-2)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Mai 2026
          </button>
        </div>

        {/* Headline insight */}
        <div style={{
          marginBottom: 16,
          padding: '12px 16px',
          background: 'var(--bg-sunk)',
          borderRadius: 8,
          color: 'var(--ink-2)',
          fontSize: 14,
        }}>
          {target === 'A' ? (
            <>Total dépenses du <strong>mois type</strong> : {fmt.format(totalA)}.</>
          ) : (
            <>En mai, tu as dépensé <strong style={{ color: 'var(--negative)' }}>{fmt.format(totalB)}</strong>, soit <strong style={{ color: delta > 0 ? 'var(--negative)' : 'var(--positive)' }}>{delta > 0 ? '+' : ''}{fmt.format(delta)}</strong> vs ton mois type. Principalement à cause de <strong>Hôtel</strong> (nouveau) et <strong>Loisirs</strong>.</>
          )}
        </div>

        {/* Sankey */}
        <div style={{ height: 520 }}>
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              key={target}
              data={data}
              nodePadding={26}
              nodeWidth={14}
              iterations={64}
              margin={{ top: 24, right: 220, bottom: 24, left: 160 }}
              node={<DemoNode targetValues={targetValues} mode={target}/>}
              link={<DemoLink/>}
            >
              <Tooltip
                formatter={(v) => fmt.format(Math.round(v))}
                contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              />
            </Sankey>
          </ResponsiveContainer>
        </div>

        {/* Legende */}
        <div style={{
          marginTop: 16,
          display: 'flex',
          gap: 24,
          fontSize: 12,
          color: 'var(--ink-3)',
          justifyContent: 'center',
        }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--negative)', borderRadius: 2, marginRight: 6, verticalAlign: 'middle' }}/>Flux plus large que d'habitude</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--positive)', borderRadius: 2, marginRight: 6, verticalAlign: 'middle' }}/>Flux plus mince que d'habitude</span>
        </div>
      </div>
    </div>
  );
}

const HALO = { stroke: 'var(--bg)', strokeWidth: 2.5, strokeLinejoin: 'round', paintOrder: 'stroke' };

function DemoNode({ x, y, width, height, payload, targetValues, mode }) {
  if (!payload) return null;
  const isLeft = payload.level === 0;
  const fill = payload.color || '#94a3b8';
  const rx = Math.min(5, Math.floor(width / 2));
  const labelX = isLeft ? x - 16 : x + width + 14;
  const anchor = isLeft ? 'end' : 'start';
  const midY = y + height / 2;

  // Pour les noeuds de catégorie (level 1), récupérer la valeur cible
  // (mois choisi) pour l'affichage du label.
  const idx = NODES.indexOf(NODES.find(n => n.name === payload.name));
  const targetValue = isLeft
    ? targetValues.reduce((s, v) => s + v, 0)
    : (idx > 0 ? targetValues[idx - 1] : 0);

  const amtStr = fmt.format(Math.round(targetValue));
  const fontSize = isLeft ? 13 : height < 18 ? 10.5 : 12;
  const nameLine = (payload.icon ? `${payload.icon} ` : '') + payload.name;
  const singleLine = targetValue > 0 ? `${nameLine}  ${amtStr}` : nameLine;

  return (
    <Layer>
      <rect x={x - 2} y={y} width={width + 4} height={height} rx={rx + 2} ry={rx + 2} fill={fill} fillOpacity={0.18}/>
      <rect x={x} y={y} width={width} height={height} rx={rx} ry={rx} fill={fill} fillOpacity={0.97}/>
      <text
        x={labelX} y={midY} textAnchor={anchor} fontSize={fontSize}
        fontWeight={isLeft ? 600 : 500} fill="var(--ink)"
        dominantBaseline="middle"
        style={{ fontVariantNumeric: 'tabular-nums', opacity: targetValue < 1 ? 0.3 : 1 }}
        {...HALO}
      >
        {singleLine}
      </text>
    </Layer>
  );
}

function DemoLink({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload, index }) {
  // Couleur teintée selon delta vs Mois type
  const realValue = payload?.realValue || 0;
  const idx = payload?.target ? payload.target - 1 : 0;
  const typeValue = STATE_A[idx] || 0;
  const delta = realValue - typeValue;
  const isOverspend = delta > 5;
  const isSave = delta < -5;
  const tint = isOverspend ? '#B0392B' : isSave ? '#136D3E' : (payload?.color || '#94a3b8');

  const gradId = `dk-g-${index}`;
  const sw = Math.max(1, linkWidth);
  const half = sw / 2;
  const band =
    `M${sourceX},${sourceY - half}` +
    `C${sourceControlX},${sourceY - half} ${targetControlX},${targetY - half} ${targetX},${targetY - half}` +
    `L${targetX},${targetY + half}` +
    `C${targetControlX},${targetY + half} ${sourceControlX},${sourceY + half} ${sourceX},${sourceY + half}Z`;

  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.22"/>
          <stop offset="60%" stopColor={tint} stopOpacity="0.32"/>
          <stop offset="100%" stopColor={tint} stopOpacity="0.46"/>
        </linearGradient>
      </defs>
      <path d={band} fill={`url(#${gradId})`} stroke="none"/>
    </g>
  );
}
