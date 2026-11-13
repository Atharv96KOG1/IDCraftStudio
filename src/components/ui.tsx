import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field${wide ? ' wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function NumberInput({
  value,
  onChange,
  step = 0.5,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(Math.round(value * 100) / 100));
  }, [value]);
  return (
    <input
      type="number"
      value={text}
      step={step}
      min={min}
      max={max}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(String(Math.round(value * 100) / 100));
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (!Number.isNaN(n)) onChange(min !== undefined ? Math.max(min, max !== undefined ? Math.min(max, n) : n) : n);
      }}
    />
  );
}

export function ColorInput({
  value,
  onChange,
  allowNone,
}: {
  value: string;
  onChange: (v: string) => void;
  allowNone?: boolean;
}) {
  const none = value === 'transparent' || !value;
  return (
    <div className="color-input">
      <input type="color" value={none ? '#ffffff' : value.slice(0, 7)} onChange={(e) => onChange(e.target.value)} />
      <input
        type="text"
        value={none ? 'none' : value}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
        }}
      />
      {allowNone && (
        <button type="button" className={`chip${none ? ' on' : ''}`} onClick={() => onChange(none ? '#ffffff' : 'transparent')} title="No fill">
          ∅
        </button>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 560,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }}>
        <header>
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

export interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

export function Menu({ label, items, className }: { label: ReactNode; items: MenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button className={className ?? 'btn'} onClick={() => setOpen(!open)}>
        {label} ▾
      </button>
      {open && (
        <div className="menu-pop">
          {items.map((it, i) => (
            <button
              key={i}
              className={`${it.danger ? 'danger' : ''}${it.divider ? ' divider' : ''}`}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

let toastTimer: number | undefined;
export function toast(msg: string, kind: 'ok' | 'error' = 'ok') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `show ${kind}`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el!.className = ''), 3200);
}
