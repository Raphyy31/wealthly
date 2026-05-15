import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Check, ChevronDown, X } from 'lucide-react';

/**
 * Combobox — Finary-style searchable dropdown with optional grouping.
 *
 * Props:
 *   options      [{ value, label, icon?, iconBg?, meta?, group? }]
 *                  icon   — emoji string or React node shown in a rounded square (requires iconBg)
 *                         or inline without background (no iconBg)
 *                  iconBg — CSS background color for the icon square
 *                  meta   — small secondary text (e.g. count, balance)
 *                  group  — section header string; consecutive items with the same group
 *                           are rendered under a shared header
 *   value        string                — currently selected value
 *   onChange     (value) => void
 *   placeholder  string               — shown when nothing is selected
 *   disabled     bool
 *   width        string|number        — optional fixed width on the trigger
 *   className    string               — extra class on the trigger wrapper
 */
export function Combobox({
  options = [],
  value,
  onChange,
  placeholder = 'Choisir…',
  disabled = false,
  width,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [panelRect, setPanelRect] = useState(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find(o => o.value === value);

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Build grouped row list
  const rows = [];
  let lastGroup;
  filtered.forEach(opt => {
    if (opt.group !== lastGroup) {
      lastGroup = opt.group;
      if (opt.group) rows.push({ kind: 'header', label: opt.group });
    }
    rows.push({ kind: 'option', ...opt });
  });

  const doOpen = () => {
    if (disabled) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPanelRect(r);
    setOpen(true);
    setQuery('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const doClose = () => setOpen(false);

  const pick = (val) => { onChange(val); doClose(); };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (document.getElementById('_cmb_panel')?.contains(e.target)) return;
      doClose();
    };
    // Close on scroll only when it happens OUTSIDE the panel (page scroll, modal scroll)
    const onScroll = (e) => {
      const panel = document.getElementById('_cmb_panel');
      if (panel && panel.contains(e.target)) return;
      doClose();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const panel = open && panelRect && (
    <div
      id="_cmb_panel"
      className="cmb-panel"
      style={{
        position: 'fixed',
        top: panelRect.bottom + 4,
        left: panelRect.left,
        width: panelRect.width,
        zIndex: 9999,
      }}
    >
      <div className="cmb-search-row">
        <Search size={13} className="cmb-si" />
        <input
          ref={inputRef}
          className="cmb-si-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher…"
          onKeyDown={e => {
            if (e.key === 'Escape') doClose();
            if (e.key === 'Enter') {
              const first = rows.find(r => r.kind === 'option');
              if (first) pick(first.value);
            }
          }}
        />
        {query && (
          <button className="cmb-si-clear" onMouseDown={e => { e.preventDefault(); setQuery(''); inputRef.current?.focus(); }}>
            <X size={12} />
          </button>
        )}
      </div>
      <div className="cmb-list">
        {rows.length === 0 && (
          <div className="cmb-empty">Aucun résultat</div>
        )}
        {rows.map((row, i) =>
          row.kind === 'header' ? (
            <div key={'h' + i} className="cmb-gh">{row.label}</div>
          ) : (
            <div
              key={row.value}
              className={`cmb-it${row.value === value ? ' sel' : ''}`}
              onMouseDown={e => { e.preventDefault(); pick(row.value); }}
            >
              {row.iconBg ? (
                <span className="cmb-it-ic" style={{ background: row.iconBg }}>{row.icon}</span>
              ) : row.icon != null ? (
                <span className="cmb-it-raw-ic">{row.icon}</span>
              ) : null}
              <div className="cmb-it-body">
                <span className="cmb-it-lbl">{row.label}</span>
                {row.meta && <span className="cmb-it-meta">{row.meta}</span>}
              </div>
              {row.value === value && <Check size={13} className="cmb-it-chk" />}
            </div>
          )
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`cmb-wrap${className ? ' ' + className : ''}`}
      ref={triggerRef}
      style={width ? { width } : undefined}
    >
      <button
        type="button"
        className={`cmb-trigger${open ? ' open' : ''}${disabled ? ' disabled' : ''}`}
        onClick={doOpen}
        disabled={disabled}
      >
        {selected?.iconBg ? (
          <span className="cmb-trigger-ic" style={{ background: selected.iconBg }}>{selected.icon}</span>
        ) : selected?.icon != null ? (
          <span className="cmb-trigger-raw-ic">{selected.icon}</span>
        ) : null}
        <span className={`cmb-trigger-lbl${!selected ? ' placeholder' : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} className={`cmb-chev${open ? ' open' : ''}`} />
      </button>
      {typeof document !== 'undefined' && createPortal(panel, document.body)}
    </div>
  );
}
