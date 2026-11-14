import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useStore } from '../lib/store';
import type { ElementType } from '../lib/types';
import { db } from '../lib/db';
import { pickFiles, resizeImage } from '../lib/utils';
import { CardCanvas } from './CardCanvas';
import { CLIPARTS, SHAPES, clipartSrc } from '../lib/shapes';
import { conceptFromName } from '../lib/fieldDetect';

const EMOJIS = ['👤', '📞', '📱', '✉️', '🏠', '📍', '🎂', '🩸', '🆔', '🏫', '🎓', '📚', '📅', '🌐', '💼', '🏢', '👪', '🔢', '⭐', '✅', '🏆', '🚌', '🏥', '⚽', '🎨', '🎵', '❤️', '🔒', '🕒', '🇮🇳'];
/** Emoji shown before a field when “with icons” is on. */
const FIELD_EMOJI: Record<string, string> = {
  name: '👤', firstName: '👤', lastName: '👤', phone: '📞', emergency: '🚨', email: '✉️', address: '🏠', city: '📍', dob: '🎂',
  blood: '🩸', class: '🏫', division: '🏫', roll: '🔢', studentId: '🆔', employeeId: '🆔', id: '🆔', father: '👨', mother: '👩',
  parent: '👪', designation: '💼', department: '🏢', company: '🏢', course: '🎓', year: '📅', validTill: '📅', issueDate: '📅', gender: '⚧️', aadhaar: '🆔',
};
import { useState } from 'react';
import { Properties } from './Properties';

const TOOLS: { type: ElementType; icon: string; label: string }[] = [
  { type: 'text', icon: 'T', label: 'Text' },
  { type: 'photo', icon: '👤', label: 'Photo' },
  { type: 'image', icon: '🖼', label: 'Image / logo' },
  { type: 'rect', icon: '▭', label: 'Rectangle' },
  { type: 'ellipse', icon: '◯', label: 'Ellipse' },
  { type: 'line', icon: '─', label: 'Line' },
  { type: 'qr', icon: '▦', label: 'QR code' },
  { type: 'barcode', icon: '║', label: 'Barcode' },
];

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

export function Designer() {
  useShortcuts();
  return (
    <div className="designer">
      <aside className="panel left">
        <Tools />
        <Library />
        <Layers />
      </aside>
      <main className="stage-area">
        <CanvasBar />
        <CardCanvas />
      </main>
      <Properties />
    </div>
  );
}

function Tools() {
  const addElement = useStore((s) => s.addElement);
  const tpl = useStore((s) => s.template)!;
  return (
    <section>
      <h3>Add</h3>
      <div className="tools">
        {TOOLS.map((t) => (
          <button
            key={t.type}
            className="tool"
            onClick={async () => {
              if (t.type === 'image') {
                const [f] = await pickFiles('image/*');
                if (!f) return;
                const src = await resizeImage(f, 1600);
                const img = await new Promise<HTMLImageElement>((r) => {
                  const i = new Image();
                  i.onload = () => r(i);
                  i.src = src;
                });
                const w = Math.min(25, tpl.widthMm * 0.4);
                addElement('image', { src, w, h: Math.round((w * img.naturalHeight) / img.naturalWidth * 10) / 10, name: f.name });
              } else {
                addElement(t.type);
              }
            }}
          >
            <span className="tool-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Shapes, clipart and one-click data fields. */
function Library() {
  const [tab, setTab] = useState<'fields' | 'shapes' | 'clipart' | 'emoji'>('fields');
  const [icons, setIcons] = useState(true);
  const addElement = useStore((s) => s.addElement);
  const tpl = useStore((s) => s.template)!;
  const label = (f: string) => f.replace(/([a-z])([A-Z])/g, '$1 $2');
  return (
    <section>
      <div className="seg small">
        {(['fields', 'shapes', 'clipart', 'emoji'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'fields' ? 'Fields' : t === 'shapes' ? 'Shapes' : t === 'clipart' ? 'Icons' : '😀'}
          </button>
        ))}
      </div>
      {tab === 'fields' && (
        <div className="field-list">
          <p className="hint">Click to add “Label : value” to the card.</p>
          <label className="check-line">
            <input type="checkbox" checked={icons} onChange={(e) => setIcons(e.target.checked)} /> with icons 📞 ✉️ 🏠
          </label>
          {tpl.fields.map((f) => {
            const em = FIELD_EMOJI[conceptFromName(label(f))?.kind ?? ''] ?? '▪️';
            return (
              <button
                key={f}
                onClick={() =>
                  addElement('text', { text: `${icons ? `${em} ` : ''}${label(f)} : {{${f}}}`, name: f, w: Math.min(50, tpl.widthMm - 4), h: 5 })
                }
              >
                {icons ? `${em} ` : ''}
                {label(f)}
              </button>
            );
          })}
        </div>
      )}
      {tab === 'shapes' && (
        <div className="shape-grid">
          {SHAPES.map((s) => (
            <button key={s.kind} title={s.label} onClick={() => addElement('shape', { shape: s.kind, name: s.label })}>
              {s.icon}
            </button>
          ))}
        </div>
      )}
      {tab === 'emoji' && (
        <div className="clip-grid">
          {EMOJIS.map((e) => (
            <button key={e} title="Add emoji" onClick={() => addElement('text', { text: e, name: `Emoji ${e}`, w: 7, h: 7, fontSize: 14, align: 'center' })}>
              {e}
            </button>
          ))}
        </div>
      )}
      {tab === 'clipart' && (
        <div className="clip-grid">
          {CLIPARTS.map((c) => (
            <button
              key={c.id}
              title={c.label}
              onClick={() => addElement('image', { clipart: c.id, tint: '#1f2937', src: '', w: 6, h: 6, fit: 'contain', name: c.label })}
            >
              <img src={clipartSrc(c.id, '#374151')} alt={c.label} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Layers() {
  const tpl = useStore((s) => s.template)!;
  const side = useStore((s) => s.side);
  const selectedId = useStore((s) => s.selectedId);
  const { select, updateElement } = useStore.getState();
  const items = [...tpl[side].elements].reverse();
  return (
    <section className="layers">
      <h3>Layers</h3>
      {!items.length && <p className="hint">Nothing on this side yet. Add elements above.</p>}
      <ul>
        {items.map((el) => (
          <li key={el.id} className={el.id === selectedId ? 'sel' : ''} onClick={() => select(el.id)}>
            <span className={`layer-name${el.hidden ? ' dim' : ''}`}>{el.name}</span>
            <button
              title={el.hidden ? 'Show' : 'Hide'}
              onClick={(e) => {
                e.stopPropagation();
                updateElement(el.id, { hidden: !el.hidden });
              }}
            >
              {el.hidden ? '◌' : '●'}
            </button>
            <button
              title={el.locked ? 'Unlock' : 'Lock'}
              onClick={(e) => {
                e.stopPropagation();
                updateElement(el.id, { locked: !el.locked });
              }}
            >
              {el.locked ? '🔒' : '🔓'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CanvasBar() {
  const tpl = useStore((s) => s.template)!;
  const side = useStore((s) => s.side);
  const zoom = useStore((s) => s.zoom);
  const previewId = useStore((s) => s.previewPersonId);
  const { setSide, setZoom, setPreviewPerson } = useStore.getState();
  const people = useLiveQuery(() => db.people.where('templateId').equals(tpl.id).limit(500).toArray(), [tpl.id]) ?? [];
  const label = (fields: Record<string, string>) => fields[tpl.fields[0]] || Object.values(fields).find(Boolean) || '(no name)';

  useEffect(() => {
    if (!tpl.hasBack && side === 'back') setSide('front');
  }, [tpl.hasBack, side, setSide]);

  return (
    <div className="canvas-bar">
      <div className="seg">
        <button className={side === 'front' ? 'on' : ''} onClick={() => setSide('front')}>
          Front
        </button>
        <button className={side === 'back' ? 'on' : ''} onClick={() => setSide('back')} disabled={!tpl.hasBack}>
          Back
        </button>
      </div>
      <label className="preview-pick">
        Preview with
        <select value={previewId ?? ''} onChange={(e) => setPreviewPerson(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Field placeholders</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              #{String(p.serial).padStart(5, '0')} · {label(p.fields)}
            </option>
          ))}
        </select>
      </label>
      <div className="zoom">
        <button onClick={() => setZoom(zoom / 1.25)} title="Zoom out">
          −
        </button>
        <button onClick={() => setZoom(1)} title="Fit to window">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={() => setZoom(zoom * 1.25)} title="Zoom in">
          +
        </button>
      </div>
      <span className="dims">
        {tpl.widthMm} × {tpl.heightMm} mm
      </span>
    </div>
  );
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || document.querySelector('.modal-backdrop')) return;
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && key === 'v') {
        e.preventDefault();
        s.paste();
        return;
      }
      const id = s.selectedId;
      if (!id) return;
      const el = s.template?.[s.side].elements.find((x) => x.id === id);
      if (!el) return;
      if (mod && key === 'c') {
        e.preventDefault();
        s.copy();
      } else if (mod && key === 'd') {
        e.preventDefault();
        s.duplicateElement(id);
      } else if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        s.deleteElement(id);
      } else if (key === 'escape') {
        s.select(null);
      } else if (key.startsWith('arrow') && !el.locked) {
        e.preventDefault();
        const step = e.shiftKey ? 2 : 0.5;
        const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
        const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
        s.updateElement(id, { x: Math.round((el.x + dx) * 100) / 100, y: Math.round((el.y + dy) * 100) / 100 }, 'nudge');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
