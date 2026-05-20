// ============================================================================
// Helpers shadcn standards — cn() pour merger des classes Tailwind
// proprement (gère les conflits via tailwind-merge).
// ============================================================================
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
