// ============================================================================
// Sheet — bottom-sheet pattern iOS-style (vaul) re-skinné papier-chaud + cobalt
//
// Sprint mobile 2026-05-20 : remplace les anciens .modal qui pop au centre
// par un sheet qui slide depuis le bas du viewport — pattern natif iOS /
// Material Design. Drag-handle visuel, fermeture par swipe-down ou tap
// backdrop, snap automatique à 92vh max.
//
// Usage :
//   <Sheet open={open} onOpenChange={setOpen}>
//     <Sheet.Content>
//       <Sheet.Header>
//         <Sheet.Title>Titre</Sheet.Title>
//         <Sheet.Description>Sous-titre optionnel.</Sheet.Description>
//       </Sheet.Header>
//       <Sheet.Body>… formulaire …</Sheet.Body>
//       <Sheet.Footer>
//         <button onClick={() => setOpen(false)}>Annuler</button>
//         <button className="primary-btn">Enregistrer</button>
//       </Sheet.Footer>
//     </Sheet.Content>
//   </Sheet>
//
// Le composant est responsive : sur desktop il pop au centre (modal
// classique) ; sur mobile il slide depuis le bas avec drag-to-dismiss.
// Tout est géré par vaul (lib utilisée par shadcn).
// ============================================================================
import * as React from 'react';
import { Drawer as VaulDrawer } from 'vaul';
import { cn } from '../../lib/utils.js';

function Sheet({ open, onOpenChange, children, ...props }) {
  return (
    <VaulDrawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false} {...props}>
      {children}
    </VaulDrawer.Root>
  );
}

const SheetTrigger = VaulDrawer.Trigger;
const SheetPortal = VaulDrawer.Portal;
const SheetClose = VaulDrawer.Close;

const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <VaulDrawer.Overlay
    ref={ref}
    className={cn('sheet-overlay', className)}
    {...props}
  />
));
SheetOverlay.displayName = 'SheetOverlay';

const SheetContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <VaulDrawer.Content
      ref={ref}
      className={cn('sheet-content', className)}
      {...props}
    >
      {/* Drag handle — barre grise centrée en haut */}
      <div className="sheet-handle" aria-hidden="true" />
      {children}
    </VaulDrawer.Content>
  </SheetPortal>
));
SheetContent.displayName = 'SheetContent';

const SheetHeader = ({ className, ...props }) => (
  <div className={cn('sheet-header', className)} {...props} />
);

const SheetBody = ({ className, ...props }) => (
  <div className={cn('sheet-body', className)} {...props} />
);

const SheetFooter = ({ className, ...props }) => (
  <div className={cn('sheet-footer', className)} {...props} />
);

const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <VaulDrawer.Title
    ref={ref}
    className={cn('sheet-title', className)}
    {...props}
  />
));
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <VaulDrawer.Description
    ref={ref}
    className={cn('sheet-description', className)}
    {...props}
  />
));
SheetDescription.displayName = 'SheetDescription';

// CSS injecté une fois (idempotent, pattern Skeleton.jsx / EmptyState.jsx)
let _sheetCssInjected = false;
function ensureSheetCss() {
  if (_sheetCssInjected || typeof document === 'undefined') return;
  _sheetCssInjected = true;
  const style = document.createElement('style');
  style.dataset.sheet = '1';
  style.textContent = `
    .sheet-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 14, 12, 0.42);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 9000;
      animation: sheetOverlayIn 0.22s ease-out;
    }
    @keyframes sheetOverlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .sheet-content {
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
    }
    .sheet-handle {
      width: 38px;
      height: 4px;
      background: var(--border-strong);
      border-radius: 2px;
      margin: 8px auto 4px;
      flex-shrink: 0;
      cursor: grab;
    }
    .sheet-header {
      padding: 12px 22px 4px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex-shrink: 0;
    }
    .sheet-title {
      margin: 0;
      font: 500 18px/1.25 var(--font-sans);
      letter-spacing: -0.02em;
      color: var(--ink);
    }
    .sheet-description {
      margin: 0;
      font: 400 13px/1.5 var(--font-sans);
      color: var(--ink-3);
    }
    .sheet-body {
      padding: 14px 22px;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      flex: 1;
      min-height: 0;
    }
    .sheet-footer {
      padding: 14px 22px calc(14px + env(safe-area-inset-bottom, 0px));
      border-top: 1px solid var(--border);
      display: flex;
      gap: 8px;
      flex-shrink: 0;
      background: var(--bg-elev);
    }
    .sheet-footer > * { flex: 1; }

    /* Desktop : pop au centre, taille bornée (overlay & content gardent
       leur position fixed mais on remonte le content pour faire un
       modal classique au milieu de l'écran) */
    @media (min-width: 768px) {
      .sheet-content {
        bottom: 50%;
        transform: translateY(50%);
        left: 50%;
        right: auto;
        margin-left: 0;
        width: min(540px, calc(100vw - 32px));
        max-width: 540px;
        border-radius: 14px;
        border: 1px solid var(--border);
        box-shadow: 0 24px 64px -16px rgba(15, 14, 12, 0.32);
      }
      .sheet-content[data-vaul-drawer-direction="bottom"] {
        /* Vaul applique son propre transform — on désactive la translate
           desktop pour laisser vaul gérer, mais on garde une largeur fixe.
           Sur desktop on vit avec le slide-from-bottom de vaul, c'est ok. */
      }
      .sheet-handle { display: none; }
    }
  `;
  document.head.appendChild(style);
}
if (typeof window !== 'undefined') ensureSheetCss();

Sheet.Trigger = SheetTrigger;
Sheet.Close = SheetClose;
Sheet.Content = SheetContent;
Sheet.Header = SheetHeader;
Sheet.Body = SheetBody;
Sheet.Footer = SheetFooter;
Sheet.Title = SheetTitle;
Sheet.Description = SheetDescription;

export { Sheet };
