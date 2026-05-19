// Stateless toast renderer. Lifecycle (auto-dismiss) is owned by the caller —
// this component just renders the current message + variant.
//
// A11y (sprint visuel 2026-05-19) : role="status" + aria-live="polite" pour
// que les screen readers annoncent les confirmations sans interrompre. Pour
// les erreurs, on passe en role="alert" + aria-live="assertive".

export function Toast({ message, type }) {
  const isError = type === 'error';
  return (
    <div
      className={`toast toast-${type}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="toast-content">{message}</div>
    </div>
  );
}
