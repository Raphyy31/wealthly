import React from 'react';

/**
 * ChipSelect — Lydia-style pill toggle for short option lists (2–4 options).
 *
 * Props:
 *   options  [{ value, label, icon? }]  — icon is a string (emoji) or React node
 *   value    string                     — currently selected value
 *   onChange (value) => void
 *   small    bool                       — compact padding variant
 */
export function ChipSelect({ options, value, onChange, small = false }) {
  return (
    <div className={`chip-sel${small ? ' chip-sel-sm' : ''}`}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={`chip-sel-btn${value === opt.value ? ' active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon != null && (
            <span className="chip-sel-icon">{opt.icon}</span>
          )}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
