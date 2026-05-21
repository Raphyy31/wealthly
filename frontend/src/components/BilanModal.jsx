// BilanModal — Vue "bilan patrimonial" complet style expert-comptable.
//
// Ouverte depuis Dashboard "Voir tout le patrimoine" (user feedback
// 2026-05-21 : "ne pas tete baissée, voir tout le patrimoine et la on
// aurais un tableau un peu stylé comptable ou autre qui montrerait
// avec la somme le patrimoine de l'individu").
//
// Pattern : modale plein écran (~85vw 85vh), look private banking
// sobre :
//   - Header avec date + bouton Export PDF + close
//   - Section ACTIFS groupée par classe (Liquidités, Placements, Immo...)
//     Chaque ligne : nom du compte/asset + montant aligné droite en mono
//     Sous-total de classe en gras + hairline
//   - Section PASSIFS même structure
//   - Footer : PATRIMOINE NET TOTAL en grand
//
// Esc + click overlay pour fermer. GSAP scale-only entry.
import { useEffect, useRef } from 'react';
import { X, FileText } from 'lucide-react';
import { gsap } from '../utils/gsapSetup.js';

const ASSET_CLASS_LABEL = {
  Liquidités: 'Liquidités',
  Placements: 'Placements',
  'Épargne': 'Épargne',
  Retraite: 'Retraite',
  Alternatifs: 'Alternatifs',
  Divers: 'Divers',
  Immobilier: 'Immobilier',
};

// Détecte la classe d'un asset/account.
function classify(item, ASSET_CLASS_MAP) {
  // Si c'est un compte (a un role bancaire) on le met en Liquidités.
  if (item.kind === 'account') return 'Liquidités';
  // Sinon c'est un asset (Wealth) — on pioche dans ASSET_CLASS_MAP.
  const cls = ASSET_CLASS_MAP?.[item.type]?.class;
  return cls || 'Divers';
}

const LIAB_CLASS = {
  mortgage: 'Crédit immobilier',
  consumer_loan: 'Crédit conso',
  auto_loan: 'Crédit auto',
  other_loan: 'Autre prêt',
};

export function BilanModal({
  open, onClose,
  visibleAccounts = [],
  accountBalances = {},
  visibleAssets = [],
  visibleLiabilities = [],
  memberShare,
  liabilityShare,
  ASSET_CLASS_MAP,
  onExportPdf,
  formatEUR,
  hidden,
}) {
  const cardRef = useRef(null);
  const overlayRef = useRef(null);

  // GSAP entry — scale-only conforme design rule (no translateY hovers)
  useEffect(() => {
    if (!open) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (overlayRef.current) {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' });
    }
    if (cardRef.current) {
      gsap.fromTo(cardRef.current,
        { opacity: 0, scale: 0.96 },
        { opacity: 1, scale: 1, duration: 0.45, ease: 'expo.out' }
      );
    }
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    // Lock body scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  // ─── Construction des sections Actifs ─────────────────────────────
  // 1. Liquidités = visibleAccounts (NW-eligible)
  const liquidLines = visibleAccounts
    .map(a => ({
      id: a.id,
      label: a.name || a.bank || 'Compte',
      hint: a.bank && a.name ? a.bank : null,
      value: (accountBalances[a.id] || 0) * (memberShare?.(a) ?? 1),
    }))
    .filter(l => Math.abs(l.value) > 0.5);

  // 2. Assets groupés par classe
  const assetsByClass = {};
  for (const a of visibleAssets) {
    const cls = ASSET_CLASS_MAP?.[a.type]?.class || 'Divers';
    if (!assetsByClass[cls]) assetsByClass[cls] = [];
    assetsByClass[cls].push({
      id: a.id,
      label: a.name || a.ticker || 'Actif',
      hint: a.ticker && a.name ? a.ticker : null,
      value: (parseFloat(a.currentValue) || 0) * (memberShare?.(a) ?? 1),
    });
  }

  // Ordre : Liquidités d'abord, puis Placements/Épargne/Retraite/Alternatifs/Divers, puis Immobilier en dernier
  const assetSectionOrder = ['Placements', 'Épargne', 'Retraite', 'Alternatifs', 'Divers', 'Immobilier'];
  const assetSections = [
    { label: 'Liquidités', lines: liquidLines },
    ...assetSectionOrder
      .filter(cls => assetsByClass[cls] && assetsByClass[cls].length > 0)
      .map(cls => ({ label: cls, lines: assetsByClass[cls] })),
  ];

  const totalAssets = assetSections.reduce(
    (s, sec) => s + sec.lines.reduce((ss, l) => ss + l.value, 0), 0
  );

  // ─── Passifs groupés par type ─────────────────────────────────────
  const liabByType = {};
  for (const l of visibleLiabilities) {
    const typeKey = l.type || 'other_loan';
    const groupLabel = LIAB_CLASS[typeKey] || 'Autre prêt';
    if (!liabByType[groupLabel]) liabByType[groupLabel] = [];
    // 2026-05-21 : liabilityShare (1/0) au lieu de memberShare (1/N) —
    // un emprunt est solidaire, on n'en affiche pas la moitie.
    liabByType[groupLabel].push({
      id: l.id,
      label: l.name || l.bank || 'Prêt',
      hint: l.bank && l.name ? l.bank : null,
      value: (parseFloat(l.remainingCapital) || 0) * (liabilityShare?.(l) ?? memberShare?.(l) ?? 1),
    });
  }
  const liabSectionOrder = ['Crédit conso', 'Crédit auto', 'Autre prêt', 'Crédit immobilier'];
  const liabSections = liabSectionOrder
    .filter(label => liabByType[label] && liabByType[label].length > 0)
    .map(label => ({ label, lines: liabByType[label] }));
  const totalLiab = liabSections.reduce(
    (s, sec) => s + sec.lines.reduce((ss, l) => ss + l.value, 0), 0
  );

  const netTotal = totalAssets - totalLiab;
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div
      ref={overlayRef}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'color-mix(in srgb, var(--bg-sunk) 75%, transparent)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        ref={cardRef}
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(960px, 100%)',
          maxHeight: 'calc(100vh - 48px)',
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 40px 80px -20px rgba(0,0,0,0.5), 0 16px 32px -8px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 28px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: 'var(--ink-3)',
              marginBottom: 4,
            }}>
              Bilan patrimonial · {today}
            </div>
            <h2 style={{
              margin: 0, fontFamily: 'Newsreader, Georgia, serif', fontWeight: 400,
              fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.025em',
              color: 'var(--ink)',
            }}>
              Patrimoine <em style={{ color: 'var(--ink-2)' }}>complet.</em>
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {onExportPdf && (
              <button
                onClick={onExportPdf}
                title="Exporter en PDF"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--ink-2)',
                  fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                }}
              >
                <FileText size={13}/>
                <span>Exporter PDF</span>
              </button>
            )}
            <button
              onClick={onClose}
              title="Fermer (Esc)"
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'transparent', border: '1px solid var(--border)',
                cursor: 'pointer', color: 'var(--ink-2)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={14}/>
            </button>
          </div>
        </header>

        {/* Body — scrollable */}
        <div style={{
          flex: 1, overflow: 'auto',
          padding: '24px 28px',
        }}>
          {/* ── ACTIFS ─────────────────────────────────────────────── */}
          <BilanSection
            title="Actifs"
            sections={assetSections}
            total={totalAssets}
            totalLabel="Total Actifs"
            formatEUR={formatEUR}
            hidden={hidden}
          />

          {/* ── PASSIFS ────────────────────────────────────────────── */}
          {liabSections.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <BilanSection
                title="Passifs"
                sections={liabSections}
                total={totalLiab}
                totalLabel="Total Passifs"
                formatEUR={formatEUR}
                hidden={hidden}
                negative
              />
            </div>
          )}

          {/* ── PATRIMOINE NET TOTAL ──────────────────────────────── */}
          <div style={{
            marginTop: 40,
            padding: '20px 24px',
            background: 'linear-gradient(135deg, var(--accent-soft) 0%, color-mix(in srgb, var(--accent-soft) 50%, var(--bg-sunk)) 100%)',
            border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
            borderRadius: 12,
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
            boxShadow: '0 10px 24px -12px color-mix(in srgb, var(--accent) 30%, transparent)',
          }}>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.18em',
                textTransform: 'uppercase', color: 'var(--accent)',
                marginBottom: 4,
              }}>
                Patrimoine net total
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                Actifs − Passifs
              </div>
            </div>
            <div style={{
              fontFamily: 'Newsreader, Georgia, serif',
              fontSize: 36, fontWeight: 400, fontStyle: 'italic',
              color: netTotal >= 0 ? 'var(--ink)' : 'var(--negative)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}>
              {hidden ? '···' : formatEUR(netTotal)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section helper (ACTIFS ou PASSIFS) ────────────────────────────
function BilanSection({ title, sections, total, totalLabel, formatEUR, hidden, negative = false }) {
  return (
    <section>
      <h3 style={{
        margin: '0 0 14px',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
        textTransform: 'uppercase', color: 'var(--ink-2)',
        paddingBottom: 8, borderBottom: '1px solid var(--border-strong)',
      }}>
        {title}
      </h3>
      {sections.map((sec, i) => {
        const subTotal = sec.lines.reduce((s, l) => s + l.value, 0);
        // Si une section n'a qu'UNE seule ligne et que son nom est tres
        // proche du label de section, on fusionne pour eviter le doublon
        // visuel "Crédit auto / • Crédit auto" qui paraissait redondant.
        const singleLine = sec.lines.length === 1 ? sec.lines[0] : null;
        const lineMatchesSection = singleLine && (
          (singleLine.label || '').toLowerCase().includes(sec.label.toLowerCase()) ||
          sec.label.toLowerCase().includes((singleLine.label || '').toLowerCase())
        );
        if (lineMatchesSection) {
          return (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                padding: '8px 0',
                fontSize: 13, fontWeight: 500, color: 'var(--ink)',
                borderBottom: '1px dotted var(--border)',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                  <span>{sec.label}</span>
                  {singleLine.hint && (
                    <span style={{
                      fontSize: 10.5, color: 'var(--ink-3)',
                      fontFamily: 'Geist Mono, ui-monospace, Menlo, monospace',
                      letterSpacing: '0.04em',
                    }}>
                      {singleLine.hint}
                    </span>
                  )}
                </span>
                <span style={{
                  fontFamily: 'Geist Mono, ui-monospace, Menlo, monospace',
                  fontVariantNumeric: 'tabular-nums',
                  color: negative ? 'var(--negative)' : 'var(--ink)',
                  letterSpacing: '0.01em',
                }}>
                  {hidden ? '···' : formatEUR(subTotal)}
                </span>
              </div>
            </div>
          );
        }
        return (
          <div key={i} style={{ marginBottom: 18 }}>
            {/* Sub-section label + sous-total */}
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              padding: '6px 0',
              fontSize: 13, fontWeight: 600, color: 'var(--ink)',
              borderBottom: '1px dotted var(--border)',
            }}>
              <span>{sec.label}</span>
              <span style={{
                fontVariantNumeric: 'tabular-nums',
                color: negative ? 'var(--negative)' : 'var(--ink)',
              }}>
                {hidden ? '···' : formatEUR(subTotal)}
              </span>
            </div>
            {/* Lignes individuelles */}
            {sec.lines.map(line => (
              <div key={line.id} style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                padding: '6px 12px',
                fontSize: 12.5,
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'baseline', gap: 8,
                  color: 'var(--ink-2)',
                }}>
                  <span style={{ color: 'var(--ink-3)', fontWeight: 300 }}>•</span>
                  <span>{line.label}</span>
                  {line.hint && (
                    <span style={{
                      fontSize: 10.5, color: 'var(--ink-3)',
                      fontFamily: 'Geist Mono, ui-monospace, Menlo, monospace',
                      letterSpacing: '0.04em',
                    }}>
                      {line.hint}
                    </span>
                  )}
                </span>
                <span style={{
                  fontFamily: 'Geist Mono, ui-monospace, Menlo, monospace',
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--ink-2)',
                  letterSpacing: '0.01em',
                }}>
                  {hidden ? '···' : formatEUR(line.value)}
                </span>
              </div>
            ))}
          </div>
        );
      })}
      {/* Total final de la section */}
      <div style={{
        marginTop: 18, paddingTop: 12,
        borderTop: '2px solid var(--ink-2)',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--ink)',
        }}>
          {totalLabel}
        </span>
        <span style={{
          fontFamily: 'Newsreader, Georgia, serif',
          fontStyle: 'italic',
          fontSize: 20, fontWeight: 400,
          color: negative ? 'var(--negative)' : 'var(--ink)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
        }}>
          {hidden ? '···' : formatEUR(total)}
        </span>
      </div>
    </section>
  );
}
