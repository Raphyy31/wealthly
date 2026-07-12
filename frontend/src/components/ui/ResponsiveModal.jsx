// ============================================================================
// ResponsiveModal — wrapper qui preserve le markup .modal desktop EXACT
// et bascule vers vaul (bottom-sheet swipe-to-dismiss) sur mobile.
//
// User feedback explicite : "go all (pas grave si l'app mobile plante)
// TANT QU'ON CHANGE PAS LA VERSION WEB!!!". On respecte le markup
// existant a la lettre cote desktop pour zero risque de regression.
//
// USAGE — migrer une modal existante :
//
//   AVANT :
//   {open && (
//     <div className="modal-backdrop" onClick={onClose}>
//       <div className="modal" onClick={e => e.stopPropagation()}>
//         <div className="modal-header"><h2>Titre</h2><X/></div>
//         <div className="modal-body">...</div>
//         <div className="modal-footer">...</div>
//       </div>
//     </div>
//   )}
//
//   APRES :
//   <ResponsiveModal open={open} onClose={onClose}>
//     <div className="modal-header"><h2>Titre</h2><X/></div>
//     <div className="modal-body">...</div>
//     <div className="modal-footer">...</div>
//   </ResponsiveModal>
//
// Le composant injecte le bon wrapper selon la taille d'ecran : .modal-
// backdrop classique sur desktop, Vaul Drawer (swipe-to-dismiss) sur
// mobile. Les classes internes .modal-header / .modal-body / .modal-
// footer restent identiques — le CSS existant prend le relais.
// ============================================================================
import * as React from 'react';
import { createPortal } from 'react-dom';
import { Drawer as VaulDrawer } from 'vaul';
import { useIsNarrow } from '../../hooks/useIsNarrow.js';

export function ResponsiveModal({ open, onClose, children, className = '', title }) {
  const isNarrow = useIsNarrow(640);

  // Lock body scroll quand ouvert (parite desktop / mobile)
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  // ── Mobile : vaul bottom-sheet (swipe-to-dismiss natif) ────────────
  if (isNarrow) {
    return (
      <VaulDrawer.Root open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
        <VaulDrawer.Portal>
          <VaulDrawer.Overlay className="rm-vaul-overlay" />
          <VaulDrawer.Content className={`rm-vaul-content modal ${className}`} aria-describedby={undefined}>
            {/* Drag handle visuel — pattern iOS */}
            <div className="rm-vaul-handle" aria-hidden="true" />
            {/* Titre a11y (Radix l'exige) — visuellement masqué ; le contenu garde
                son propre header visuel. Évite le warning « DialogContent requires
                a DialogTitle ». */}
            <VaulDrawer.Title className="sr-only">{title || 'Fenêtre'}</VaulDrawer.Title>
            {/* Wrapper interne pour scroll si modal-body present */}
            <div className="rm-vaul-inner">
              {children}
            </div>
          </VaulDrawer.Content>
        </VaulDrawer.Portal>
      </VaulDrawer.Root>
    );
  }

  // ── Desktop : portal vers document.body ────────────────────────────
  // Sans portal, la modale etait rendue en place dans l'arbre. Si un ancetre
  // a un `transform` (GSAP / Framer / will-change), il devient le bloc
  // conteneur du `position: fixed` -> le backdrop n'est plus relatif au
  // viewport et la modale s'ouvre decalee/coupee quand la page est scrollee
  // (bug "je clique en bas de page, ca s'envoie en haut coupe"). Le portal
  // vers body garantit que `fixed` vise toujours le viewport. Markup interne
  // .modal-backdrop / .modal preserve a la lettre.
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${className}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title || 'Fenêtre'}>
        {children}
      </div>
    </div>,
    document.body
  );
}

// CSS inject une seule fois (idempotent)
let _rmCss = false;
function ensureRmCss() {
  if (_rmCss || typeof document === 'undefined') return;
  _rmCss = true;
  const style = document.createElement('style');
  style.dataset.rm = '1';
  style.textContent = `
    .rm-vaul-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 14, 12, 0.42);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 9000;
    }
    .rm-vaul-content {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 9001;
      display: flex;
      flex-direction: column;
      max-height: 92vh;
      background: var(--bg-elev);
      border-top: 1px solid var(--border);
      border-radius: 18px 18px 0 0;
      box-shadow: 0 -12px 40px -12px rgba(15, 14, 12, 0.18);
      outline: none;
      /* override !important du mobile-overhaul CSS pour ce nouveau pattern */
      transform: none;
      animation: none;
      margin: 0;
      width: 100%;
      max-width: 100%;
    }
    .rm-vaul-handle {
      width: 38px;
      height: 4px;
      background: var(--border-strong);
      border-radius: 2px;
      margin: 8px auto 0;
      flex-shrink: 0;
      cursor: grab;
    }
    .rm-vaul-inner {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex: 1;
      min-height: 0;
    }
    /* Le .modal-body interne devient scrollable sur mobile */
    .rm-vaul-inner .modal-body {
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch;
      flex: 1;
      min-height: 0;
    }
    /* Les éditeurs Patrimoine utilisent wizard-body plutôt que modal-body. */
    .rm-vaul-inner > .wizard-body {
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch;
      flex: 1;
      min-height: 0 !important;
    }
    /* Footer reste collant en bas avec safe-area */
    .rm-vaul-inner .modal-footer {
      padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px)) !important;
      flex-shrink: 0;
      background: var(--bg-elev);
    }
  `;
  document.head.appendChild(style);
}
if (typeof window !== 'undefined') ensureRmCss();
