import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

// Wraps a button whose onClick is async. While the promise is pending:
//  - the button is disabled (prevents double-clicks)
//  - a spinner is shown on the leading edge
//  - the original children are dimmed slightly
// Falls back to passing-through for sync handlers.
export function BusyButton({ onClick, children, busy: externalBusy, className = '', style, type = 'button', disabled, ...rest }) {
  const [internalBusy, setInternalBusy] = useState(false);
  const inFlight = useRef(false);
  const busy = externalBusy ?? internalBusy;
  const handle = async (e) => {
    if (inFlight.current || !onClick) return;
    inFlight.current = true;
    setInternalBusy(true);
    try {
      await onClick(e);
    } finally {
      inFlight.current = false;
      setInternalBusy(false);
    }
  };
  return (
    <button
      type={type}
      className={className}
      style={{ ...style, opacity: busy ? 0.65 : style?.opacity, cursor: busy ? 'wait' : style?.cursor }}
      onClick={handle}
      disabled={busy || disabled}
      {...rest}
    >
      {busy && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: 6, verticalAlign: -2 }}/>}
      {children}
    </button>
  );
}
