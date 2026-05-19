// ============================================================================
// MagneticButton — Wrapper d'un <button> avec useMagneticHover applique.
//
// Drop-in replacement pour les CTAs primaires : meme API que <button>, le
// magnetic effect est applique automatiquement. Skip touch + reduced-motion
// au niveau du hook.
//
// Usage :
//   <MagneticButton className="ds-btn primary" onClick={...}>Action</MagneticButton>
//
// Pour les liens (<a>), utiliser MagneticButton avec as="a".
// ============================================================================
import { useMagneticHover } from '../hooks/useMagneticHover.js';

export function MagneticButton({
  as: Component = 'button',
  strength = 0.25,
  scale = 1.04,
  children,
  ...props
}) {
  const ref = useMagneticHover({ strength, scale });
  return (
    <Component ref={ref} {...props}>
      {children}
    </Component>
  );
}
