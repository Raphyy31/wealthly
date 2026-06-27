// Scenes.jsx — Wealthly demo scenes (port ESM 2026-05-22)
// Scene 1: full app view (with sidebar). Subsequent scenes are FOCUSED zooms.
// All scenes use viewBox 1600x900 (matches canvas aspect ratio).
import React from 'react';

// Shared sidebar (only Scene 1 uses it)
const Sidebar = ({ activeIdx }) => (
  <g>
    <rect x="24" y="24" width="220" height="852" rx="14" fill="#FFFFFF" stroke="#E2E6DF"/>
    <text x="44" y="62" fill="#0C0F0B" fontFamily="Geist, sans-serif" fontSize="14" fontWeight="500">Wealthly</text>
    {['Vue', 'Patrimoine', 'Trésorerie', 'Transactions', 'Mois type', 'Fiscalité', 'Réglages'].map((l, i) => (
      <g key={l}>
        <rect x="40" y={108+i*54} width="14" height="14" rx="3" fill={i===activeIdx?"#2B8FB0":"#D1D6CC"}/>
        <text x="64" y={120+i*54} fill={i===activeIdx?"#0C0F0B":"#878E7C"} fontFamily="Geist, sans-serif" fontSize="13" fontWeight={i===activeIdx?500:400}>{l}</text>
      </g>
    ))}
  </g>
);

// ────────────────────────────────────────────────────────────────────
// SCENE 1 — Full dashboard with sidebar (only scene that shows sidebar)
// ────────────────────────────────────────────────────────────────────
const Scene1Dashboard = () => (
  <svg className="scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="s1area" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#2B8FB0" stopOpacity="0.35"/>
        <stop offset="100%" stopColor="#2B8FB0" stopOpacity="0"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="1600" height="900" fill="#F7F9F6"/>
    <Sidebar activeIdx={0}/>

    <rect x="268" y="24" width="1308" height="852" rx="14" fill="#FFFFFF" stroke="#E2E6DF"/>

    {/* Hero card — SPOT */}
    <g data-spot="hero-card">
      <rect x="296" y="64" width="852" height="356" rx="14" fill="#FFFFFF" stroke="#E2E6DF"/>
      <text x="320" y="106" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="11" letterSpacing="1.6">PATRIMOINE NET TOTAL · 21 MAI 2026</text>
      <text x="320" y="196" fill="#0C0F0B" fontFamily="Geist, system-ui, sans-serif" fontSize="86" fontWeight="400" letterSpacing="-3.4">487 320,40 €</text>
      <rect x="320" y="222" width="164" height="32" rx="16" fill="#E1F1E9"/>
      <text x="344" y="244" fill="#0E7C56" fontFamily="Geist, sans-serif" fontSize="13" fontWeight="500">↑ +6 240 € · +1,29 %</text>
      <text x="500" y="244" fill="#545B4F" fontFamily="Geist, sans-serif" fontSize="13">vs 30 jours</text>

      {['1M','3M','6M','1A','5A','MAX'].map((p,i)=>(
        <g key={p}>
          <rect x={832+i*52} y={84} width="44" height="26" rx="6"
                fill={i===3?"#EEF1ED":"transparent"}
                stroke={i===3?"#E2E6DF":"transparent"}/>
          <text x={854+i*52} y={101} fill={i===3?"#0C0F0B":"#878E7C"} fontFamily="Geist, sans-serif" fontSize="11" textAnchor="middle">{p}</text>
        </g>
      ))}

      <path d="M320,372 C400,360 480,310 560,300 C650,288 720,330 820,270 C900,222 980,250 1060,210 C1100,192 1130,200 1148,178"
            fill="none" stroke="#2B8FB0" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M320,372 C400,360 480,310 560,300 C650,288 720,330 820,270 C900,222 980,250 1060,210 C1100,192 1130,200 1148,178 L1148,400 L320,400 Z"
            fill="url(#s1area)"/>
      <circle cx="1148" cy="178" r="6" fill="#FFFFFF" stroke="#2B8FB0" strokeWidth="2.5"/>
    </g>

    {/* Allocation card */}
    <g>
      <rect x="1172" y="64" width="376" height="356" rx="14" fill="#FFFFFF" stroke="#E2E6DF"/>
      <text x="1196" y="106" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="11" letterSpacing="1.6">ALLOCATION</text>
      <g transform="translate(1296, 222)">
        <circle r="78" fill="none" stroke="#EEF1ED" strokeWidth="18"/>
        <circle r="78" fill="none" stroke="#0E7C56" strokeWidth="18" strokeDasharray="180 490" transform="rotate(-90)"/>
        <circle r="78" fill="none" stroke="#2B8FB0" strokeWidth="18" strokeDasharray="125 490" strokeDashoffset="-180" transform="rotate(-90)"/>
        <circle r="78" fill="none" stroke="#C2843B" strokeWidth="18" strokeDasharray="78 490" strokeDashoffset="-305" transform="rotate(-90)"/>
        <circle r="78" fill="none" stroke="#C2603E" strokeWidth="18" strokeDasharray="58 490" strokeDashoffset="-383" transform="rotate(-90)"/>
      </g>
      {[
        {c:'#0E7C56', l:'Immobilier', v:'46%'},
        {c:'#2B8FB0', l:'Placements', v:'31%'},
        {c:'#C2843B', l:'Liquidités', v:'13%'},
        {c:'#C2603E', l:'Dettes', v:'10%'},
      ].map((it,i)=>(
        <g key={i}>
          <rect x="1196" y={336+i*16} width="10" height="10" rx="2" fill={it.c}/>
          <text x="1214" y={345+i*16} fill="#545B4F" fontFamily="Geist, sans-serif" fontSize="12">{it.l}</text>
          <text x="1532" y={345+i*16} fill="#0C0F0B" fontFamily="Geist Mono, monospace" fontSize="12" textAnchor="end">{it.v}</text>
        </g>
      ))}
    </g>

    {/* KPI cards */}
    {[
      {l:'Liquidités', v:'42 100 €', d:'+1,2 %', dc:'#0E7C56'},
      {l:'Placements', v:'151 240 €', d:'+3,8 %', dc:'#0E7C56'},
      {l:'Immobilier', v:'310 000 €', d:'+0,0 %', dc:'#545B4F'},
      {l:'Dettes', v:'−15 880 €', d:'−5,2 %', dc:'#0E7C56'},
    ].map((k,i)=>(
      <g key={k.l}>
        <rect x={296+i*316} y="444" width="296" height="192" rx="14" fill="#FFFFFF" stroke="#E2E6DF"/>
        <text x={320+i*316} y="486" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="10.5" letterSpacing="1.6">{k.l.toUpperCase()}</text>
        <text x={320+i*316} y="552" fill="#0C0F0B" fontFamily="Geist, system-ui, sans-serif" fontSize="36" letterSpacing="-1.4">{k.v}</text>
        <text x={320+i*316} y="596" fill={k.dc} fontFamily="Geist, sans-serif" fontSize="12.5" fontWeight="500">{k.d} <tspan fill="#878E7C">· 30 j</tspan></text>
      </g>
    ))}

    {/* Tx strip */}
    <g>
      <rect x="296" y="660" width="1252" height="196" rx="14" fill="#FFFFFF" stroke="#E2E6DF"/>
      <text x="320" y="700" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="10.5" letterSpacing="1.6">DERNIÈRES OPÉRATIONS</text>
      {[
        {nm:'Crédit Agricole · Salaire', ct:'Revenus · 21 mai', am:'+ 4 280,00 €', ac:'#0E7C56', ic:'C', icb:'#0E893E'},
        {nm:'Boursorama · DCA ETF World', ct:'Investissement · 20 mai', am:'+ 500,00 €', ac:'#2AA0A0', ic:'B', icb:'#FF248C'},
        {nm:'Revolut · EDF', ct:'Énergie · 19 mai', am:'− 142,30 €', ac:'#0C0F0B', ic:'R', icb:'#0666EB'},
        {nm:'BNP Paribas · Loyer', ct:'Habitation · 18 mai', am:'− 1 320,00 €', ac:'#0C0F0B', ic:'B', icb:'#00915A'},
      ].map((t,i)=>(
        <g key={i} transform={`translate(0, ${720+i*32})`}>
          <circle cx="338" cy="0" r="13" fill={t.icb}/>
          <text x="338" y="4" fill="#fff" fontFamily="Geist, sans-serif" fontSize="11" fontWeight="600" textAnchor="middle">{t.ic}</text>
          <text x="368" y="4" fill="#0C0F0B" fontFamily="Geist, sans-serif" fontSize="13" fontWeight="500">{t.nm}</text>
          <text x="368" y="20" fill="#878E7C" fontFamily="Geist, sans-serif" fontSize="11">{t.ct}</text>
          <text x="1528" y="4" fill={t.ac} fontFamily="Geist Mono, monospace" fontSize="13" fontWeight="500" textAnchor="end">{t.am}</text>
        </g>
      ))}
    </g>
  </svg>
);

// ────────────────────────────────────────────────────────────────────
// SCENE 2 — Sankey ZOOM (no sidebar, fullscreen flow)
// ────────────────────────────────────────────────────────────────────
const Scene2Sankey = () => (
  <svg className="scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="s2flow1" x1="0" x2="1">
        <stop offset="0%" stopColor="#0E7C56" stopOpacity="0.65"/>
        <stop offset="100%" stopColor="#2B8FB0" stopOpacity="0.55"/>
      </linearGradient>
      <linearGradient id="s2flow2" x1="0" x2="1">
        <stop offset="0%" stopColor="#0E7C56" stopOpacity="0.6"/>
        <stop offset="100%" stopColor="#C2843B" stopOpacity="0.5"/>
      </linearGradient>
      <linearGradient id="s2flow3" x1="0" x2="1">
        <stop offset="0%" stopColor="#0E7C56" stopOpacity="0.6"/>
        <stop offset="100%" stopColor="#2AA0A0" stopOpacity="0.55"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="1600" height="900" fill="#F7F9F6"/>

    {/* Page title — top-left of canvas */}
    <text x="96" y="100" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="13" letterSpacing="2">FLUX MENSUELS · MAI 2026</text>
    <text x="96" y="170" fill="#0C0F0B" fontFamily="Geist, system-ui, sans-serif" fontSize="58" letterSpacing="-2" fontStyle="italic">Chaque euro, à sa place.</text>

    {/* Sankey — bigger, takes most of viewport */}
    <g data-spot="sankey">
      {/* Source node — Revenus */}
      <rect x="160" y="320" width="28" height="440" rx="6" fill="#0E7C56"/>
      <text x="206" y="490" fill="#0C0F0B" fontFamily="Geist, sans-serif" fontSize="22" fontWeight="500">Revenus</text>
      <text x="206" y="522" fill="#545B4F" fontFamily="Geist Mono, monospace" fontSize="16">5 420 € · 100 %</text>

      {/* Tier 2 — 3 splits */}
      <rect x="780" y="296" width="28" height="220" rx="6" fill="#2B8FB0"/>
      <text x="826" y="386" fill="#0C0F0B" fontFamily="Geist, sans-serif" fontSize="19" fontWeight="500">Charges fixes</text>
      <text x="826" y="416" fill="#545B4F" fontFamily="Geist Mono, monospace" fontSize="14">2 090 € · 38,6 %</text>

      <rect x="780" y="538" width="28" height="118" rx="6" fill="#C2843B"/>
      <text x="826" y="588" fill="#0C0F0B" fontFamily="Geist, sans-serif" fontSize="19" fontWeight="500">Vie courante</text>
      <text x="826" y="618" fill="#545B4F" fontFamily="Geist Mono, monospace" fontSize="14">1 280 € · 23,6 %</text>

      <rect x="780" y="676" width="28" height="84" rx="6" fill="#2AA0A0"/>
      <text x="826" y="716" fill="#0C0F0B" fontFamily="Geist, sans-serif" fontSize="19" fontWeight="500">Épargne</text>
      <text x="826" y="746" fill="#545B4F" fontFamily="Geist Mono, monospace" fontSize="14">2 050 € · 37,8 %</text>

      {/* Flows from source to tier 2 */}
      <path d="M188,320 C400,320 560,296 780,296 L780,516 C560,516 400,540 188,540 Z" fill="url(#s2flow1)"/>
      <path d="M188,540 C400,540 560,538 780,538 L780,656 C560,656 400,660 188,660 Z" fill="url(#s2flow2)"/>
      <path d="M188,660 C400,660 560,676 780,676 L780,760 C560,760 400,760 188,760 Z" fill="url(#s2flow3)"/>

      {/* Tier 3 — sub items from charges fixes */}
      {[
        {y:296, h:62, l:'Loyer · BNP', a:'1 320 €', c:'#2B8FB0'},
        {y:362, h:36, l:'Énergie · EDF', a:'298 €', c:'#2B8FB0'},
        {y:402, h:24, l:'Internet · Free', a:'72 €', c:'#2AA0A0'},
        {y:430, h:48, l:'Assurances (3)', a:'400 €', c:'#2AA0A0'},
      ].map((sub, i) => (
        <g key={i}>
          <rect x="1280" y={sub.y} width="28" height={sub.h} rx="5" fill={sub.c}/>
          <text x="1330" y={sub.y + sub.h/2 + 6} fill="#0C0F0B" fontFamily="Geist, sans-serif" fontSize="14">{sub.l}</text>
          <text x="1528" y={sub.y + sub.h/2 + 6} fill="#545B4F" fontFamily="Geist Mono, monospace" fontSize="13" textAnchor="end">{sub.a}</text>
        </g>
      ))}

      <path d="M808,296 C1000,296 1100,296 1280,296 L1280,358 C1100,358 1000,358 808,358 Z" fill="#2B8FB0" opacity="0.32"/>
      <path d="M808,358 C1000,358 1100,362 1280,362 L1280,398 C1100,398 1000,398 808,398 Z" fill="#2B8FB0" opacity="0.22"/>
      <path d="M808,398 C1000,398 1100,402 1280,402 L1280,426 C1100,426 1000,426 808,426 Z" fill="#2AA0A0" opacity="0.22"/>
      <path d="M808,426 C1000,426 1100,430 1280,430 L1280,478 C1100,478 1000,478 808,478 Z" fill="#2AA0A0" opacity="0.22"/>

      {/* Status pills at bottom */}
      <g transform="translate(160, 800)">
        <rect x="0" y="0" width="220" height="44" rx="22" fill="#E1F1E9"/>
        <circle cx="22" cy="22" r="5" fill="#0E7C56"/>
        <text x="38" y="28" fill="#0E7C56" fontFamily="Geist, sans-serif" fontSize="14" fontWeight="500">Conforme au mois type</text>

        <rect x="240" y="0" width="220" height="44" rx="22" fill="#F4E2DE"/>
        <circle cx="262" cy="22" r="5" fill="#B23E29"/>
        <text x="278" y="28" fill="#B23E29" fontFamily="Geist, sans-serif" fontSize="14" fontWeight="500">Vie courante · +12 %</text>
      </g>
    </g>
  </svg>
);

// ────────────────────────────────────────────────────────────────────
// SCENE 3 — Mortgage / loan view (no sidebar, focused)
// ────────────────────────────────────────────────────────────────────
const Scene3Loan = () => (
  <svg className="scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="s3capital" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#2B8FB0" stopOpacity="0.4"/>
        <stop offset="100%" stopColor="#2B8FB0" stopOpacity="0"/>
      </linearGradient>
      <linearGradient id="s3interest" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#C2843B" stopOpacity="0.35"/>
        <stop offset="100%" stopColor="#C2843B" stopOpacity="0"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="1600" height="900" fill="#F7F9F6"/>

    <text x="96" y="100" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="13" letterSpacing="2">CRÉDIT IMMOBILIER · BNP PARIBAS</text>
    <text x="96" y="170" fill="#0C0F0B" fontFamily="Geist, system-ui, sans-serif" fontSize="58" letterSpacing="-2" fontStyle="italic">Votre crédit, démystifié.</text>

    <g data-spot="loan">
      {/* Main card */}
      <rect x="96" y="220" width="1408" height="600" rx="18" fill="#FFFFFF" stroke="#E2E6DF"/>

      {/* Left column — key numbers */}
      <text x="140" y="280" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="11" letterSpacing="1.6">CAPITAL RESTANT</text>
      <text x="140" y="358" fill="#0C0F0B" fontFamily="Geist Mono, monospace" fontSize="64" fontWeight="500" letterSpacing="-2.4">237 480 €</text>
      <text x="140" y="392" fill="#545B4F" fontFamily="Geist, sans-serif" fontSize="14">sur 320 000 € empruntés</text>

      {/* Progress bar — capital remboursé */}
      <rect x="140" y="420" width="500" height="10" rx="5" fill="#EEF1ED"/>
      <rect x="140" y="420" width="129" height="10" rx="5" fill="#2B8FB0"/>
      <text x="140" y="452" fill="#545B4F" fontFamily="Geist Mono, monospace" fontSize="12">25,8 % remboursé · 17 ans restants</text>

      {/* KPI grid */}
      <g transform="translate(140, 500)">
        <text fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="10.5" letterSpacing="1.4">TAUX</text>
        <text y="36" fill="#0C0F0B" fontFamily="Geist Mono, monospace" fontSize="26" letterSpacing="-0.8">1,55 %</text>
        <text y="58" fill="#545B4F" fontFamily="Geist, sans-serif" fontSize="12">fixe · TAEG</text>
      </g>
      <g transform="translate(280, 500)">
        <text fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="10.5" letterSpacing="1.4">MENSUALITÉ</text>
        <text y="36" fill="#0C0F0B" fontFamily="Geist Mono, monospace" fontSize="26" letterSpacing="-0.8">1 320 €</text>
        <text y="58" fill="#545B4F" fontFamily="Geist, sans-serif" fontSize="12">le 1er du mois</text>
      </g>
      <g transform="translate(440, 500)">
        <text fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="10.5" letterSpacing="1.4">COÛT TOTAL</text>
        <text y="36" fill="#0C0F0B" fontFamily="Geist Mono, monospace" fontSize="26" letterSpacing="-0.8">48 240 €</text>
        <text y="58" fill="#C2843B" fontFamily="Geist, sans-serif" fontSize="12">intérêts cumulés</text>
      </g>

      {/* Next 6 payments */}
      <text x="140" y="650" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="11" letterSpacing="1.6">PROCHAINES ÉCHÉANCES</text>
      {[
        {d:'1 juin 2026', cap:'+1 003', int:'317'},
        {d:'1 juil. 2026', cap:'+1 004', int:'316'},
        {d:'1 août 2026', cap:'+1 005', int:'315'},
        {d:'1 sept. 2026', cap:'+1 006', int:'314'},
      ].map((p,i)=>(
        <g key={i} transform={`translate(${140+i*150}, 680)`}>
          <rect x="0" y="0" width="130" height="76" rx="8" fill="#EEF1ED" stroke="#E2E6DF"/>
          <text x="14" y="22" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="10">{p.d}</text>
          <text x="14" y="44" fill="#2B8FB0" fontFamily="Geist Mono, monospace" fontSize="13" fontWeight="500">{p.cap} €</text>
          <text x="14" y="62" fill="#C2843B" fontFamily="Geist Mono, monospace" fontSize="11">−{p.int} € intérêts</text>
        </g>
      ))}

      {/* Right column — amortization chart */}
      <text x="780" y="280" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="11" letterSpacing="1.6">AMORTISSEMENT · 23 ANS</text>

      {/* Stacked area chart: capital vs interest over time */}
      {/* Capital paid (blue, growing) */}
      <path d="M820,720 L820,720
               L900,712 L980,700 L1060,684 L1140,664 L1220,640 L1300,608 L1380,568 L1460,520
               L1460,720 Z"
            fill="url(#s3capital)"/>
      <path d="M820,720 L900,712 L980,700 L1060,684 L1140,664 L1220,640 L1300,608 L1380,568 L1460,520"
            fill="none" stroke="#2B8FB0" strokeWidth="2.4" strokeLinecap="round"/>

      {/* Interest paid (orange, decreasing) */}
      <path d="M820,360 L820,360
               L900,378 L980,400 L1060,426 L1140,460 L1220,500 L1300,548 L1380,602 L1460,656
               L1460,720 L820,720 Z"
            fill="url(#s3interest)" opacity="0.6"/>
      <path d="M820,360 L900,378 L980,400 L1060,426 L1140,460 L1220,500 L1300,548 L1380,602 L1460,656"
            fill="none" stroke="#C2843B" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4"/>

      {/* Today marker (year 6) */}
      <line x1="980" y1="280" x2="980" y2="720" stroke="#0C0F0B" strokeWidth="1" strokeDasharray="3 5" opacity="0.4"/>
      <circle cx="980" cy="280" r="4" fill="#0C0F0B"/>
      <text x="990" y="278" fill="#0C0F0B" fontFamily="Geist Mono, monospace" fontSize="11" fontWeight="500">aujourd&apos;hui · an 6</text>

      {/* Legend */}
      <g transform="translate(820, 760)">
        <circle cx="0" cy="0" r="5" fill="#2B8FB0"/>
        <text x="14" y="5" fill="#545B4F" fontFamily="Geist, sans-serif" fontSize="13">Capital remboursé</text>
        <circle cx="180" cy="0" r="5" fill="#C2843B"/>
        <text x="194" y="5" fill="#545B4F" fontFamily="Geist, sans-serif" fontSize="13">Intérêts cumulés</text>
      </g>

      {/* X-axis */}
      <text x="820" y="780" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="10">2020</text>
      <text x="980" y="780" fill="#0C0F0B" fontFamily="Geist Mono, monospace" fontSize="10">2026</text>
      <text x="1460" y="780" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="10" textAnchor="end">2043</text>
    </g>
  </svg>
);

// ────────────────────────────────────────────────────────────────────
// SCENE 4 — PEA live (animated stock lines)
// ────────────────────────────────────────────────────────────────────
const Scene4Pea = () => (
  <svg className="scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="s4area" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#0E7C56" stopOpacity="0.3"/>
        <stop offset="100%" stopColor="#0E7C56" stopOpacity="0"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="1600" height="900" fill="#F7F9F6"/>

    <text x="96" y="100" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="13" letterSpacing="2">PEA · BOURSORAMA · 14 LIGNES</text>
    <text x="96" y="170" fill="#0C0F0B" fontFamily="Geist, system-ui, sans-serif" fontSize="58" letterSpacing="-2" fontStyle="italic">Vos placements, en direct.</text>

    <g data-spot="pea">
      {/* Big card */}
      <rect x="96" y="220" width="1408" height="600" rx="18" fill="#FFFFFF" stroke="#E2E6DF"/>

      {/* Left — hero number */}
      <text x="140" y="280" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="11" letterSpacing="1.6">VALEUR ACQUISE</text>
      <text x="140" y="368" fill="#0C0F0B" fontFamily="Geist, system-ui, sans-serif" fontSize="74" letterSpacing="-2.8">82 480 €</text>
      <rect x="140" y="390" width="180" height="32" rx="16" fill="#E1F1E9"/>
      <text x="164" y="412" fill="#0E7C56" fontFamily="Geist, sans-serif" fontSize="13" fontWeight="500">↑ +12 240 € · +17,4 %</text>

      {/* Live indicator */}
      <g transform="translate(140, 446)">
        <circle cx="6" cy="0" r="5" fill="#0E7C56">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="1.8s" repeatCount="indefinite"/>
        </circle>
        <text x="20" y="5" fill="#0E7C56" fontFamily="Geist Mono, monospace" fontSize="11" letterSpacing="1.4" fontWeight="500">EN DIRECT · MAJ 17:42:14</text>
      </g>

      {/* Stock lines list */}
      <text x="140" y="510" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="10.5" letterSpacing="1.4">VOS LIGNES</text>
      {[
        {tic:'CW8', nm:'Amundi MSCI World', shr:'132', px:'412,80', dt:'+1,4 %', dtc:'#0E7C56'},
        {tic:'EWLD', nm:'Lyxor MSCI World', shr:'48', px:'358,40', dt:'+1,1 %', dtc:'#0E7C56'},
        {tic:'PE500', nm:'Amundi S&P 500', shr:'62', px:'48,12', dt:'+0,8 %', dtc:'#0E7C56'},
        {tic:'PAEEM', nm:'Amundi Emerging', shr:'90', px:'24,18', dt:'−0,3 %', dtc:'#B23E29'},
        {tic:'AC', nm:'Accor', shr:'24', px:'42,80', dt:'+2,6 %', dtc:'#0E7C56'},
      ].map((s,i)=>(
        <g key={s.tic} transform={`translate(140, ${540+i*44})`}>
          <text x="0" y="22" fill="#0C0F0B" fontFamily="Geist Mono, monospace" fontSize="13" fontWeight="500">{s.tic}</text>
          <text x="80" y="22" fill="#545B4F" fontFamily="Geist, sans-serif" fontSize="13">{s.nm}</text>
          <text x="380" y="22" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="12" textAnchor="end">{s.shr} pts</text>
          <text x="520" y="22" fill="#0C0F0B" fontFamily="Geist Mono, monospace" fontSize="13" fontWeight="500" textAnchor="end">{s.px} €</text>
          <text x="600" y="22" fill={s.dtc} fontFamily="Geist Mono, monospace" fontSize="12" textAnchor="end">{s.dt}</text>
        </g>
      ))}

      {/* Right — live chart with pulsing dot at end */}
      <text x="780" y="280" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="11" letterSpacing="1.6">12 MOIS</text>

      {/* Grid lines */}
      <line x1="800" y1="380" x2="1460" y2="380" stroke="#E2E6DF" strokeDasharray="2 4"/>
      <line x1="800" y1="500" x2="1460" y2="500" stroke="#E2E6DF" strokeDasharray="2 4"/>
      <line x1="800" y1="620" x2="1460" y2="620" stroke="#E2E6DF" strokeDasharray="2 4"/>

      {/* Main perf line */}
      <path d="M800,620 C840,608 880,612 920,592 C960,572 1000,580 1040,556 C1080,532 1120,540 1160,500 C1200,460 1240,470 1280,430 C1320,395 1360,408 1400,376 C1440,348 1460,360 1460,340"
            fill="none" stroke="#0E7C56" strokeWidth="2.6" strokeLinecap="round"/>
      <path d="M800,620 C840,608 880,612 920,592 C960,572 1000,580 1040,556 C1080,532 1120,540 1160,500 C1200,460 1240,470 1280,430 C1320,395 1360,408 1400,376 C1440,348 1460,360 1460,340 L1460,720 L800,720 Z"
            fill="url(#s4area)"/>

      {/* Pulsing live dot at end of line */}
      <circle cx="1460" cy="340" r="14" fill="#0E7C56" opacity="0.18">
        <animate attributeName="r" values="6;18;6" dur="1.8s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.35;0;0.35" dur="1.8s" repeatCount="indefinite"/>
      </circle>
      <circle cx="1460" cy="340" r="6" fill="#FFFFFF" stroke="#0E7C56" strokeWidth="2.5"/>

      {/* Tick markers below chart */}
      {['JUIN','JUIL','AOÛT','SEPT','OCT','NOV','DÉC','JAN','FÉV','MAR','AVR','MAI'].map((m,i)=>(
        <text key={i} x={810 + i*55} y="760" fill={i===11?"#0C0F0B":"#878E7C"} fontFamily="Geist Mono, monospace" fontSize="9.5" letterSpacing="0.6">{m}</text>
      ))}
    </g>
  </svg>
);

// ────────────────────────────────────────────────────────────────────
// SCENE 5 — Auto-categorization (animated)
// Transactions stream in left, get auto-tagged, settle into category columns on right
// ────────────────────────────────────────────────────────────────────
const Scene5Categorize = () => {
  // Static SVG visualization: rows of transactions with tags animating
  return (
    <svg className="scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="s5beam" x1="0" x2="1">
          <stop offset="0%" stopColor="#2B8FB0" stopOpacity="0"/>
          <stop offset="50%" stopColor="#2B8FB0" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#2B8FB0" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1600" height="900" fill="#F7F9F6"/>

      <text x="96" y="100" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="13" letterSpacing="2">CATÉGORISATION · INTELLIGENTE</text>
      <text x="96" y="170" fill="#0C0F0B" fontFamily="Geist, system-ui, sans-serif" fontSize="58" letterSpacing="-2" fontStyle="italic">Triées pour vous.</text>

      <g data-spot="categorize">
        {/* Left card — raw transactions arriving */}
        <rect x="96" y="220" width="540" height="600" rx="18" fill="#FFFFFF" stroke="#E2E6DF"/>
        <text x="124" y="262" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="11" letterSpacing="1.6">FLUX BRUT · IMPORT BANCAIRE</text>

        {[
          {raw:'CB CARREFOUR PARIS 13', am:'− 42,80 €', y:296, cat:'Alimentation', catC:'#0E7C56'},
          {raw:'SARL DUPOND LOC', am:'− 1 320,00 €', y:352, cat:'Logement', catC:'#2B8FB0'},
          {raw:'EDF CLIENTS 75', am:'− 142,30 €', y:408, cat:'Énergie', catC:'#C2843B'},
          {raw:'PRLV SEPA NETFLIX', am:'− 17,99 €', y:464, cat:'Loisirs', catC:'#2AA0A0'},
          {raw:'VIR SALAIRE ENTREPRISE X', am:'+ 4 280,00 €', y:520, cat:'Revenus', catC:'#0E7C56'},
          {raw:'CB SNCF CONNECT', am:'− 89,00 €', y:576, cat:'Transports', catC:'#C2843B'},
          {raw:'PAYPAL *AMAZON', am:'− 36,40 €', y:632, cat:'Shopping', catC:'#C2603E'},
          {raw:'CB BOULANGERIE LE PAIN', am:'− 12,20 €', y:688, cat:'Alimentation', catC:'#0E7C56'},
          {raw:'PRLV SEPA FREE TELECOM', am:'− 19,99 €', y:744, cat:'Télécoms', catC:'#2AA0A0'},
        ].map((t,i)=>(
          <g key={i}>
            <rect x="124" y={t.y} width="484" height="44" rx="8" fill="#EEF1ED" stroke="#E2E6DF"/>
            <text x="140" y={t.y+18} fill="#545B4F" fontFamily="Geist Mono, monospace" fontSize="11.5" letterSpacing="0.4">{t.raw}</text>
            <text x="140" y={t.y+34} fill="#0C0F0B" fontFamily="Geist Mono, monospace" fontSize="13" fontWeight="500">{t.am}</text>
            {/* Auto-detected tag pill */}
            <g transform={`translate(478, ${t.y+12})`}>
              <rect x="0" y="0" width="116" height="22" rx="11" fill={t.catC} opacity="0.15"/>
              <circle cx="12" cy="11" r="3" fill={t.catC}/>
              <text x="22" y="15" fill={t.catC} fontFamily="Geist Mono, monospace" fontSize="10" fontWeight="500" letterSpacing="0.4">{t.cat.toUpperCase()}</text>
            </g>
          </g>
        ))}

        {/* Connector beam from left card to right */}
        <rect x="636" y="488" width="180" height="2" fill="url(#s5beam)">
          <animate attributeName="x" values="636;640;636" dur="2.5s" repeatCount="indefinite"/>
        </rect>

        {/* AI badge — discrete, no emoji */}
        <g transform="translate(696, 460)">
          <rect x="0" y="0" width="60" height="22" rx="6" fill="#E1F1E9" stroke="#BFE0CE"/>
          <text x="30" y="15" fill="#2AA0A0" fontFamily="Geist Mono, monospace" fontSize="10" fontWeight="600" letterSpacing="1.6" textAnchor="middle">AUTO</text>
        </g>

        {/* Right side — category buckets with bars */}
        <rect x="844" y="220" width="660" height="600" rx="18" fill="#FFFFFF" stroke="#E2E6DF"/>
        <text x="872" y="262" fill="#878E7C" fontFamily="Geist Mono, monospace" fontSize="11" letterSpacing="1.6">CATÉGORIES · MAI 2026</text>

        {[
          {l:'Logement', a:'1 320 €', c:'#2B8FB0', barW:520},
          {l:'Alimentation', a:'418 €', c:'#0E7C56', barW:188},
          {l:'Énergie', a:'298 €', c:'#C2843B', barW:138},
          {l:'Transports', a:'212 €', c:'#C2843B', barW:106},
          {l:'Loisirs', a:'88 €', c:'#2AA0A0', barW:54},
          {l:'Shopping', a:'76 €', c:'#C2603E', barW:48},
          {l:'Télécoms', a:'52 €', c:'#2AA0A0', barW:38},
          {l:'Revenus', a:'+ 4 280 €', c:'#0E7C56', barW:520, positive:true},
        ].map((cat,i)=>(
          <g key={cat.l} transform={`translate(872, ${290+i*58})`}>
            <text x="0" y="14" fill="#0C0F0B" fontFamily="Geist, sans-serif" fontSize="14" fontWeight="500">{cat.l}</text>
            <text x="604" y="14" fill="#0C0F0B" fontFamily="Geist Mono, monospace" fontSize="13" fontWeight="500" textAnchor="end">{cat.a}</text>
            <rect x="0" y="24" width="604" height="6" rx="3" fill="#EEF1ED"/>
            <rect x="0" y="24" width={cat.barW} height="6" rx="3" fill={cat.c} opacity={cat.positive?0.9:0.7}/>
          </g>
        ))}
      </g>
    </svg>
  );
};

// ────────────────────────────────────────────────────────────────────
// SCENES list
// ────────────────────────────────────────────────────────────────────
const SCENES = [
  {
    id: 'intro',
    isIntro: true,
    duration: 2400,
  },
  {
    id: 'overview',
    eyebrow: 'Vue d\u2019ensemble',
    title: 'Votre patrimoine net, <em>consolidé.</em>',
    body: 'Comptes, placements, immobilier, dettes. Une vue, en temps réel.',
    tag: 'Vue globale',
    spotSel: 'hero-card',
    annoSide: 'right',
    wipeDir: 'right',
    duration: 4400,
    Component: Scene1Dashboard,
  },
  {
    id: 'sankey',
    focused: true,
    wipeDir: 'left',
    duration: 4800,
    Component: Scene2Sankey,
  },
  {
    id: 'loan',
    focused: true,
    wipeDir: 'right',
    duration: 4800,
    Component: Scene3Loan,
  },
  {
    id: 'pea',
    focused: true,
    wipeDir: 'left',
    duration: 5400,
    countUp: { from: 0, to: 82480, at: 700, duration: 1200, label: 'valeur acquise', sublabel: 'PEA · mai 2026' },
    Component: Scene4Pea,
  },
  {
    id: 'categorize',
    focused: true,
    wipeDir: 'right',
    duration: 5400,
    Component: Scene5Categorize,
  },
];

export { SCENES, Scene1Dashboard, Scene2Sankey, Scene3Loan, Scene4Pea, Scene5Categorize };
