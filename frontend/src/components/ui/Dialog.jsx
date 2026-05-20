// ============================================================================
// Dialog — modal accessible Radix-based, re-skinné papier-chaud + cobalt
//
// Sprint mobile 2026-05-20 : Radix UI Dialog garantit focus-trap, ESC pour
// fermer, click-outside, ARIA correct, scroll lock. Bien meilleur que les
// modals ad-hoc qu'on avait.
//
// Sur desktop : pop centré classique.
// Sur mobile : on switch automatiquement sur <Sheet> via le helper
// useIsNarrow (responsive modal pattern).
//
// Usage :
//   <Dialog open={open} onOpenChange={setOpen}>
//     <Dialog.Content>
//       <Dialog.Header>
//         <Dialog.Title>Titre</Dialog.Title>
//         <Dialog.Description>Sous-titre.</Dialog.Description>
//       </Dialog.Header>
//       <Dialog.Body>… contenu …</Dialog.Body>
//       <Dialog.Footer>
//         <Dialog.Close className="secondary-btn">Annuler</Dialog.Close>
//         <button className="primary-btn">OK</button>
//       </Dialog.Footer>
//     </Dialog.Content>
//   </Dialog>
// ============================================================================
import * as React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Sheet } from './Sheet.jsx';
import { useIsNarrow } from '../../hooks/useIsNarrow.js';

function Dialog({ open, onOpenChange, children, ...props }) {
  const isNarrow = useIsNarrow(640);
  // Sur mobile, on bascule automatiquement sur Sheet (bottom-sheet).
  // On detecte les sous-elements Dialog.* et on les passe a Sheet.*.
  if (isNarrow) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange} {...props}>
        {/* On laisse l'utilisateur passer <Dialog.Content> et on remappe
            ci-dessous au niveau de DialogContent. */}
        {children}
      </Sheet>
    );
  }
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange} {...props}>
      {children}
    </RadixDialog.Root>
  );
}

const DialogTrigger = (props) => {
  // Sur mobile -> Sheet.Trigger, desktop -> Radix Dialog.Trigger
  // Pour eviter la complexite on expose les deux et l'app choisit.
  return <RadixDialog.Trigger {...props} />;
};

const DialogClose = React.forwardRef(({ className, children, ...props }, ref) => (
  <RadixDialog.Close ref={ref} className={cn(className)} {...props}>
    {children}
  </RadixDialog.Close>
));
DialogClose.displayName = 'DialogClose';

const DialogContent = React.forwardRef(({ className, children, showClose = true, ...props }, ref) => {
  const isNarrow = useIsNarrow(640);
  if (isNarrow) {
    // Quand on est sur mobile, le parent <Dialog> a deja swap vers <Sheet>.
    // Donc DialogContent doit se comporter comme Sheet.Content pour rester
    // compatible avec l'arbre de composants.
    return (
      <Sheet.Content ref={ref} className={className} {...props}>
        {children}
      </Sheet.Content>
    );
  }
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="dialog-overlay" />
      <RadixDialog.Content
        ref={ref}
        className={cn('dialog-content', className)}
        {...props}
      >
        {showClose && (
          <RadixDialog.Close className="dialog-close" aria-label="Fermer">
            <X size={16} />
          </RadixDialog.Close>
        )}
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
});
DialogContent.displayName = 'DialogContent';

const DialogHeader = ({ className, ...props }) => {
  const isNarrow = useIsNarrow(640);
  const Cmp = isNarrow ? Sheet.Header : 'div';
  return <Cmp className={cn(!isNarrow && 'dialog-header', className)} {...props} />;
};

const DialogBody = ({ className, ...props }) => {
  const isNarrow = useIsNarrow(640);
  const Cmp = isNarrow ? Sheet.Body : 'div';
  return <Cmp className={cn(!isNarrow && 'dialog-body', className)} {...props} />;
};

const DialogFooter = ({ className, ...props }) => {
  const isNarrow = useIsNarrow(640);
  const Cmp = isNarrow ? Sheet.Footer : 'div';
  return <Cmp className={cn(!isNarrow && 'dialog-footer', className)} {...props} />;
};

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => {
  const isNarrow = useIsNarrow(640);
  if (isNarrow) return <Sheet.Title ref={ref} className={className} {...props} />;
  return (
    <RadixDialog.Title
      ref={ref}
      className={cn('dialog-title', className)}
      {...props}
    />
  );
});
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => {
  const isNarrow = useIsNarrow(640);
  if (isNarrow) return <Sheet.Description ref={ref} className={className} {...props} />;
  return (
    <RadixDialog.Description
      ref={ref}
      className={cn('dialog-description', className)}
      {...props}
    />
  );
});
DialogDescription.displayName = 'DialogDescription';

// CSS injecté une fois (idempotent)
let _dialogCssInjected = false;
function ensureDialogCss() {
  if (_dialogCssInjected || typeof document === 'undefined') return;
  _dialogCssInjected = true;
  const style = document.createElement('style');
  style.dataset.dialog = '1';
  style.textContent = `
    .dialog-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 14, 12, 0.42);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 9000;
      animation: dialogOverlayIn 0.18s ease-out;
    }
    @keyframes dialogOverlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .dialog-content {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 9001;
      width: min(540px, calc(100vw - 32px));
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      background: var(--bg-elev);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: 0 24px 64px -16px rgba(15, 14, 12, 0.32);
      animation: dialogIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      outline: none;
    }
    @keyframes dialogIn {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
      to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    .dialog-close {
      position: absolute;
      top: 14px;
      right: 14px;
      width: 32px;
      height: 32px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--ink-2);
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }
    .dialog-close:hover {
      border-color: var(--ink-2);
      color: var(--ink);
      background: var(--bg-sunk);
    }
    .dialog-close:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--accent-soft);
    }
    .dialog-header {
      padding: 22px 60px 8px 22px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex-shrink: 0;
    }
    .dialog-title {
      margin: 0;
      font: 500 18px/1.25 var(--font-sans);
      letter-spacing: -0.02em;
      color: var(--ink);
    }
    .dialog-description {
      margin: 0;
      font: 400 13px/1.5 var(--font-sans);
      color: var(--ink-3);
    }
    .dialog-body {
      padding: 14px 22px;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }
    .dialog-footer {
      padding: 14px 22px 18px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);
}
if (typeof window !== 'undefined') ensureDialogCss();

Dialog.Trigger = DialogTrigger;
Dialog.Close = DialogClose;
Dialog.Content = DialogContent;
Dialog.Header = DialogHeader;
Dialog.Body = DialogBody;
Dialog.Footer = DialogFooter;
Dialog.Title = DialogTitle;
Dialog.Description = DialogDescription;

export { Dialog };
