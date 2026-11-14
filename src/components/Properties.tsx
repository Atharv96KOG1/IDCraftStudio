import { useEffect, useState } from 'react';
import { selectedElement, useStore } from '../lib/store';
import type { BarcodeFormat, CardElement, Fit, ShapeKind, Template, TextEncoding } from '../lib/types';
import { MASKS, SHAPES } from '../lib/shapes';
import { isKrutiFont } from '../lib/marathi';
import { qrModuleMm, resolveText } from '../lib/render';
import { db } from '../lib/db';
import { SYSTEM_FIELDS } from '../lib/types';
import { CARD_PRESETS } from '../lib/elements';
import { FontPicker } from './FontPicker';
import { pickFiles, resizeImage, round2 } from '../lib/utils';
import { ColorInput, Field, NumberInput, Toggle } from './ui';

export function Properties() {
  const el = useStore(selectedElement);
  return <aside className="panel right">{el ? <ElementProps el={el} /> : <CardProps />}</aside>;
}

function FieldInsert({ onInsert }: { onInsert: (token: string) => void }) {
  const fields = useStore((s) => s.template!.fields);
  return (
    <select
      className="insert"
      value=""
      onChange={(e) => {
        if (e.target.value) onInsert(`{{${e.target.value}}}`);
      }}
    >
      <option value="">+ Insert field…</option>
      <optgroup label="Record fields">
        {fields.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </optgroup>
      <optgroup label="Automatic">
        {SYSTEM_FIELDS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

function ElementProps({ el }: { el: CardElement }) {
  const update = useStore((s) => s.updateElement);
  const tpl = useStore((s) => s.template)!;
  const { deleteElement, duplicateElement, moveLayer } = useStore.getState();
  const set = (patch: Partial<CardElement>, key?: string) => update(el.id, patch, key ?? Object.keys(patch).join(','));

  const align = (how: 'l' | 'c' | 'r' | 't' | 'm' | 'b') => {
    const p: Partial<CardElement> = {};
    if (how === 'l') p.x = 0;
    if (how === 'c') p.x = round2((tpl.widthMm - el.w) / 2);
    if (how === 'r') p.x = round2(tpl.widthMm - el.w);
    if (how === 't') p.y = 0;
    if (how === 'm') p.y = round2((tpl.heightMm - el.h) / 2);
    if (how === 'b') p.y = round2(tpl.heightMm - el.h);
    update(el.id, p);
  };

  return (
    <div className="props">
      <div className="props-head">
        <input className="name-input" value={el.name} onChange={(e) => set({ name: e.target.value }, 'name')} />
        <span className="badge">{el.type}</span>
      </div>

      <section>
        <h3>Position (mm)</h3>
        <div className="grid2">
          <Field label="X">
            <NumberInput value={el.x} onChange={(x) => set({ x })} />
          </Field>
          <Field label="Y">
            <NumberInput value={el.y} onChange={(y) => set({ y })} />
          </Field>
          <Field label="Width">
            <NumberInput value={el.w} min={1} onChange={(w) => set({ w })} />
          </Field>
          <Field label="Height">
            <NumberInput value={el.h} min={0.5} onChange={(h) => set({ h })} />
          </Field>
          <Field label="Rotation °">
            <NumberInput value={el.rotation} step={1} onChange={(rotation) => set({ rotation })} />
          </Field>
          <Field label="Opacity %">
            <NumberInput value={Math.round(el.opacity * 100)} step={5} min={0} max={100} onChange={(v) => set({ opacity: v / 100 })} />
          </Field>
        </div>
        <div className="btn-row tight" title="Align to card">
          <button onClick={() => align('l')} title="Align left">⇤</button>
          <button onClick={() => align('c')} title="Centre horizontally">↔</button>
          <button onClick={() => align('r')} title="Align right">⇥</button>
          <button onClick={() => align('t')} title="Align top">⤒</button>
          <button onClick={() => align('m')} title="Centre vertically">↕</button>
          <button onClick={() => align('b')} title="Align bottom">⤓</button>
        </div>
      </section>

      <TypeProps el={el} set={set} />

      <section>
        <h3>Arrange</h3>
        <div className="btn-row tight">
          <button onClick={() => moveLayer(el.id, 'top')}>To front</button>
          <button onClick={() => moveLayer(el.id, 'up')}>Forward</button>
          <button onClick={() => moveLayer(el.id, 'down')}>Backward</button>
          <button onClick={() => moveLayer(el.id, 'bottom')}>To back</button>
        </div>
        <div className="row">
          <Toggle label="Locked" checked={el.locked} onChange={(locked) => set({ locked })} />
          <Toggle label="Hidden" checked={el.hidden} onChange={(hidden) => set({ hidden })} />
        </div>
        <div className="btn-row">
          <button className="btn" onClick={() => duplicateElement(el.id)}>
            Duplicate
          </button>
          <button className="btn danger" onClick={() => deleteElement(el.id)}>
            Delete
          </button>
        </div>
      </section>
    </div>
  );
}

function TypeProps({ el, set }: { el: CardElement; set: (p: Partial<CardElement>, key?: string) => void }) {
  switch (el.type) {
    case 'text':
      return (
        <section>
          <h3>Text</h3>
          <textarea rows={3} value={el.text} onChange={(e) => set({ text: e.target.value }, 'text')} />
          <FieldInsert onInsert={(tok) => set({ text: el.text + tok })} />
          <div className="grid2">
            <Field label="Font" wide>
              <FontPicker value={el.fontFamily} text={el.text} onChange={(fontFamily) => set({ fontFamily })} />
            </Field>
            <Field label="Size (pt)">
              <NumberInput value={el.fontSize} min={3} step={0.5} onChange={(fontSize) => set({ fontSize })} />
            </Field>
            <Field label="Colour">
              <ColorInput value={el.color} onChange={(color) => set({ color })} />
            </Field>
            <Field label="Line height">
              <NumberInput value={el.lineHeight} step={0.05} min={0.6} onChange={(lineHeight) => set({ lineHeight })} />
            </Field>
            <Field label="Letter spacing">
              <NumberInput value={el.letterSpacing} step={0.2} onChange={(letterSpacing) => set({ letterSpacing })} />
            </Field>
          </div>
          <div className="btn-row tight">
            <button className={el.bold ? 'on' : ''} onClick={() => set({ bold: !el.bold })} style={{ fontWeight: 700 }}>
              B
            </button>
            <button className={el.italic ? 'on' : ''} onClick={() => set({ italic: !el.italic })} style={{ fontStyle: 'italic' }}>
              I
            </button>
            <button className={el.underline ? 'on' : ''} onClick={() => set({ underline: !el.underline })} style={{ textDecoration: 'underline' }}>
              U
            </button>
            <button className={el.uppercase ? 'on' : ''} onClick={() => set({ uppercase: !el.uppercase })} title="Uppercase">
              AA
            </button>
            <span className="sep" />
            {(['left', 'center', 'right'] as const).map((a) => (
              <button key={a} className={el.align === a ? 'on' : ''} onClick={() => set({ align: a })} title={`Align ${a}`}>
                {a === 'left' ? '⯇' : a === 'center' ? '≡' : '⯈'}
              </button>
            ))}
            <span className="sep" />
            {(['top', 'middle', 'bottom'] as const).map((a) => (
              <button key={a} className={el.vAlign === a ? 'on' : ''} onClick={() => set({ vAlign: a })} title={`Vertical ${a}`}>
                {a === 'top' ? '⯅' : a === 'middle' ? '◆' : '⯆'}
              </button>
            ))}
          </div>
          <Toggle label="Shrink to fit (single line)" checked={el.autoShrink} onChange={(autoShrink) => set({ autoShrink })} />
          <Field label="Marathi font type">
            <select
              value={el.encoding ?? (isKrutiFont(el.fontFamily) ? 'krutidev' : 'unicode')}
              onChange={(e) => set({ encoding: e.target.value as TextEncoding })}
            >
              <option value="unicode">Unicode font (Noto, Mukta, Nirmala, Shivaji Unicode…)</option>
              <option value="krutidev">Kruti Dev (legacy) – convert Unicode text automatically</option>
            </select>
          </Field>
          {/[\u0900-\u097F]/.test(el.text) && el.letterSpacing !== 0 && (
            <p className="hint">Tip: keep letter spacing at 0 for Marathi so letters join correctly.</p>
          )}
        </section>
      );

    case 'image':
      return (
        <section>
          <h3>Image</h3>
          {el.src && !el.clipart && <img className="thumb-preview" src={el.src} alt="" />}
          {el.clipart && (
            <Field label="Clipart colour">
              <ColorInput value={el.tint ?? '#111827'} onChange={(tint) => set({ tint })} />
            </Field>
          )}
          <div className="btn-row">
            <button
              className="btn"
              onClick={async () => {
                const [f] = await pickFiles('image/*');
                // PNG logos keep their transparency.
                if (f) set({ src: await resizeImage(f, 2000), clipart: undefined });
              }}
            >
              {el.src || el.clipart ? 'Replace image…' : 'Choose image / PNG logo…'}
            </button>
          </div>
          <FitSelect value={el.fit} onChange={(fit) => set({ fit })} />
          <MaskSelect value={el.mask} onChange={(mask) => set({ mask })} />
          <Field label="Corner radius (mm)">
            <NumberInput value={el.radius} min={0} onChange={(radius) => set({ radius })} />
          </Field>
        </section>
      );

    case 'photo':
      return (
        <section>
          <h3>Photo</h3>
          <p className="hint">Shows each record's photo inside the chosen frame shape.</p>
          <FitSelect value={el.fit} onChange={(fit) => set({ fit })} />
          <MaskSelect value={el.mask} onChange={(mask) => set({ mask })} />
          <Toggle
            label={el.fitLock === false ? '🔓 Unlocked – move / zoom / rotate photo' : '🔒 Locked – photo fits the frame automatically'}
            checked={el.fitLock !== false}
            onChange={(v) => set({ fitLock: v })}
          />
          {el.fitLock === false && (
            <div className="photo-adjust">
              {(
                [
                  ['photoZoom', 'Zoom', 0.3, 4, 0.01, 1],
                  ['photoX', 'Move left / right', -100, 100, 1, 0],
                  ['photoY', 'Move up / down', -100, 100, 1, 0],
                  ['photoRotation', 'Rotate °', -180, 180, 1, 0],
                ] as const
              ).map(([k, label, min, max, step, def]) => (
                <label key={k} className="slider">
                  <span>
                    {label}
                    <b>{Math.round(((el[k] ?? def) as number) * 100) / 100}</b>
                  </span>
                  <input type="range" min={min} max={max} step={step} value={(el[k] ?? def) as number} onChange={(e) => set({ [k]: Number(e.target.value) }, k)} />
                </label>
              ))}
              <button className="btn" onClick={() => set({ photoZoom: 1, photoX: 0, photoY: 0, photoRotation: 0 })}>
                Reset position
              </button>
            </div>
          )}
          <div className="grid2">
            <Field label="Corner radius">
              <NumberInput value={el.radius} min={0} onChange={(radius) => set({ radius })} />
            </Field>
            <Field label="Border (mm)">
              <NumberInput value={el.borderWidth} min={0} step={0.1} onChange={(borderWidth) => set({ borderWidth })} />
            </Field>
            <Field label="Border colour" wide>
              <ColorInput value={el.borderColor} onChange={(borderColor) => set({ borderColor })} />
            </Field>
          </div>
        </section>
      );

    case 'rect':
    case 'ellipse':
      return (
        <section>
          <h3>Shape</h3>
          <div className="grid2">
            <Field label="Fill" wide>
              <ColorInput value={el.fill} allowNone onChange={(fill) => set({ fill })} />
            </Field>
            <Field label="Border" wide>
              <ColorInput value={el.stroke} onChange={(stroke) => set({ stroke })} />
            </Field>
            <Field label="Border (mm)">
              <NumberInput value={el.strokeWidth} min={0} step={0.1} onChange={(strokeWidth) => set({ strokeWidth })} />
            </Field>
            {el.type === 'rect' && (
              <Field label="Corner radius">
                <NumberInput value={el.radius} min={0} onChange={(radius) => set({ radius })} />
              </Field>
            )}
          </div>
        </section>
      );

    case 'shape':
      return (
        <section>
          <h3>Shape</h3>
          <div className="shape-grid">
            {SHAPES.map((x) => (
              <button key={x.kind} title={x.label} className={el.shape === x.kind ? 'on' : ''} onClick={() => set({ shape: x.kind })}>
                {x.icon}
              </button>
            ))}
          </div>
          <div className="grid2">
            <Field label="Fill" wide>
              <ColorInput value={el.fill} allowNone onChange={(fill) => set({ fill })} />
            </Field>
            <Field label="Border" wide>
              <ColorInput value={el.stroke} onChange={(stroke) => set({ stroke })} />
            </Field>
            <Field label="Border (mm)">
              <NumberInput value={el.strokeWidth} min={0} step={0.1} onChange={(strokeWidth) => set({ strokeWidth })} />
            </Field>
          </div>
        </section>
      );

    case 'line':
      return (
        <section>
          <h3>Line</h3>
          <div className="grid2">
            <Field label="Colour" wide>
              <ColorInput value={el.stroke} onChange={(stroke) => set({ stroke })} />
            </Field>
            <Field label="Thickness (mm)">
              <NumberInput value={el.strokeWidth} min={0.05} step={0.05} onChange={(strokeWidth) => set({ strokeWidth })} />
            </Field>
          </div>
          <Toggle label="Dashed" checked={el.dashed} onChange={(dashed) => set({ dashed })} />
        </section>
      );

    case 'qr':
      return (
        <section>
          <h3>QR code</h3>
          <div className="btn-row tight">
            <button className={el.value === '{{AllDetails}}' ? 'on' : ''} onClick={() => set({ value: '{{AllDetails}}' })} title="Every filled-in field of the person">
              All details
            </button>
            <button className={el.value === '{{vCard}}' ? 'on' : ''} onClick={() => set({ value: '{{vCard}}' })} title="Phones offer to save it as a contact">
              Contact card
            </button>
            <button className={el.value === '{{Serial}}' ? 'on' : ''} onClick={() => set({ value: '{{Serial}}' })}>
              ID only
            </button>
          </div>
          <textarea rows={2} value={el.value} onChange={(e) => set({ value: e.target.value }, 'value')} />
          <FieldInsert onInsert={(tok) => set({ value: el.value + tok })} />
          <QrCheck value={el.value} sizeMm={Math.min(el.w, el.h)} />
          <p className="hint">
            “All details” puts every filled-in field of each person (name, class, phone, email, address…) into the QR. Photos are too big to
            fit inside any QR code.
          </p>
          <div className="grid2">
            <Field label="Colour" wide>
              <ColorInput value={el.color} onChange={(color) => set({ color })} />
            </Field>
            <Field label="Background" wide>
              <ColorInput value={el.background} allowNone onChange={(background) => set({ background })} />
            </Field>
          </div>
        </section>
      );

    case 'barcode':
      return (
        <section>
          <h3>Barcode</h3>
          <input value={el.value} onChange={(e) => set({ value: e.target.value }, 'value')} />
          <FieldInsert onInsert={(tok) => set({ value: el.value + tok })} />
          <div className="grid2">
            <Field label="Format">
              <select value={el.format} onChange={(e) => set({ format: e.target.value as BarcodeFormat })}>
                <option value="CODE128">Code 128</option>
                <option value="CODE39">Code 39</option>
                <option value="EAN13">EAN-13</option>
                <option value="ITF14">ITF-14</option>
              </select>
            </Field>
            <Field label="Colour">
              <ColorInput value={el.color} onChange={(color) => set({ color })} />
            </Field>
          </div>
          <Toggle label="Show text under bars" checked={el.showText} onChange={(showText) => set({ showText })} />
        </section>
      );
  }
}

function MaskSelect({ value, onChange }: { value?: ShapeKind; onChange: (m: ShapeKind) => void }) {
  return (
    <Field label="Frame shape (mask)">
      <select value={value ?? 'rect'} onChange={(e) => onChange(e.target.value as ShapeKind)}>
        {MASKS.map((m) => (
          <option key={m} value={m}>
            {SHAPES.find((x) => x.kind === m)?.label ?? m}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Warns when QR dots get too small for phones to read reliably. */
function QrCheck({ value, sizeMm }: { value: string; sizeMm: number }) {
  const tpl = useStore((s) => s.template)!;
  const previewId = useStore((s) => s.previewPersonId);
  const [sample, setSample] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const pick = previewId != null ? db.people.get(previewId) : db.people.where('templateId').equals(tpl.id).first();
    pick.then((p) => alive && setSample(p ? resolveText(value, p, false) : null));
    return () => {
      alive = false;
    };
  }, [value, previewId, tpl.id]);
  if (!sample) return null;
  const mod = qrModuleMm(sample, sizeMm);
  if (!mod) return <p className="warn-box">Too much data for one QR code. Use “Contact card” or fewer fields.</p>;
  const need = Math.ceil((0.33 / mod) * sizeMm);
  return mod < 0.33 ? (
    <p className="warn-box">
      QR dots are {mod.toFixed(2)} mm – may not scan well. Make the QR at least <b>{need} mm</b> wide, or put less data in it.
    </p>
  ) : (
    <p className="ok-box">✓ QR scans well (dot size {mod.toFixed(2)} mm, {sample.length} characters).</p>
  );
}

function FitSelect({ value, onChange }: { value: Fit; onChange: (f: Fit) => void }) {
  return (
    <Field label="Fit">
      <select value={value} onChange={(e) => onChange(e.target.value as Fit)}>
        <option value="cover">Fill (crop)</option>
        <option value="contain">Fit inside</option>
        <option value="stretch">Stretch</option>
      </select>
    </Field>
  );
}

function CardProps() {
  const tpl = useStore((s) => s.template)!;
  const side = useStore((s) => s.side);
  const mutate = useStore((s) => s.mutate);
  const [newField, setNewField] = useState('');
  const preset = CARD_PRESETS.findIndex((p) => p.w === tpl.widthMm && p.h === tpl.heightMm);

  const setSize = (w: number, h: number) =>
    mutate((t: Template) => {
      t.widthMm = w;
      t.heightMm = h;
    });

  const addField = () => {
    const f = newField.trim().replace(/[{}]/g, '');
    if (!f || tpl.fields.includes(f)) return;
    mutate((t) => t.fields.push(f));
    setNewField('');
  };

  return (
    <div className="props">
      <div className="props-head">
        <input className="name-input" value={tpl.name} onChange={(e) => mutate((t) => (t.name = e.target.value), 'tpl-name')} />
        <span className="badge">card</span>
      </div>

      <section>
        <h3>Card size</h3>
        <select
          value={preset}
          onChange={(e) => {
            const p = CARD_PRESETS[Number(e.target.value)];
            if (p) setSize(p.w, p.h);
          }}
        >
          {preset < 0 && <option value={-1}>Custom</option>}
          {CARD_PRESETS.map((p, i) => (
            <option key={p.label} value={i}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="grid2">
          <Field label="Width (mm)">
            <NumberInput value={tpl.widthMm} min={20} onChange={(w) => setSize(w, tpl.heightMm)} />
          </Field>
          <Field label="Height (mm)">
            <NumberInput value={tpl.heightMm} min={20} onChange={(h) => setSize(tpl.widthMm, h)} />
          </Field>
        </div>
        <Toggle label="Two-sided card (has a back)" checked={tpl.hasBack} onChange={(v) => mutate((t) => (t.hasBack = v))} />
      </section>

      <section>
        <h3>{side === 'front' ? 'Front' : 'Back'} background</h3>
        <Field label="Colour">
          <ColorInput value={tpl[side].background} onChange={(c) => mutate((t) => (t[side].background = c), `bg-${side}`)} />
        </Field>
        {tpl[side].backgroundImage && <img className="thumb-preview" src={tpl[side].backgroundImage!} alt="" />}
        <div className="btn-row">
          <button
            className="btn"
            onClick={async () => {
              const [f] = await pickFiles('image/*');
              if (!f) return;
              const src = await resizeImage(f, 2000, 0.92);
              mutate((t) => (t[side].backgroundImage = src));
            }}
          >
            {tpl[side].backgroundImage ? 'Replace image…' : 'Background image…'}
          </button>
          {tpl[side].backgroundImage && (
            <button className="btn" onClick={() => mutate((t) => (t[side].backgroundImage = null))}>
              Remove
            </button>
          )}
        </div>
        <p className="hint">Use a full-bleed design exported from any graphics tool as the background.</p>
      </section>

      <section>
        <h3>Data fields</h3>
        <p className="hint">Columns each record has (Name, DOB, Address, Blood Group, Mobile…). Type to rename – the card and records update too.</p>
        <div className="field-list">
          {tpl.fields.map((f, i) => (
            <FieldRow key={f} name={f} index={i} />
          ))}
        </div>
        <div className="row">
          <input
            placeholder="New field name"
            value={newField}
            onChange={(e) => setNewField(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addField()}
          />
          <button className="btn" onClick={addField}>
            Add
          </button>
        </div>
        <p className="hint">Automatic: {SYSTEM_FIELDS.map((f) => `{{${f}}}`).join('  ')}</p>
      </section>
    </div>
  );
}

/** Rename (everywhere: card, QR, records), reorder or remove a data field. */
function FieldRow({ name, index }: { name: string; index: number }) {
  const tpl = useStore((s) => s.template)!;
  const mutate = useStore((s) => s.mutate);
  const [text, setText] = useState(name);
  useEffect(() => setText(name), [name]);

  const rename = async () => {
    const to = text.trim().replace(/[{}]/g, '');
    if (!to || to === name) return setText(name);
    if (tpl.fields.includes(to)) {
      setText(name);
      return alert(`A field called “${to}” already exists.`);
    }
    const re = new RegExp(`\\{\\{\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g');
    mutate((t) => {
      t.fields = t.fields.map((x) => (x === name ? to : x));
      for (const side of [t.front, t.back])
        for (const el of side.elements) {
          if (el.type === 'text') el.text = el.text.replace(re, `{{${to}}}`);
          if (el.type === 'qr' || el.type === 'barcode') el.value = el.value.replace(re, `{{${to}}}`);
        }
    });
    await db.people
      .where('templateId')
      .equals(tpl.id)
      .modify((p) => {
        if (name in p.fields) {
          p.fields[to] = p.fields[name];
          delete p.fields[name];
        }
      });
  };
  const move = (d: number) =>
    mutate((t) => {
      const j = index + d;
      if (j < 0 || j >= t.fields.length) return;
      [t.fields[index], t.fields[j]] = [t.fields[j], t.fields[index]];
    });

  return (
    <div className="field-row">
      <input value={text} onChange={(e) => setText(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} title="Type to rename" />
      <button onClick={() => move(-1)} title="Move up">↑</button>
      <button onClick={() => move(1)} title="Move down">↓</button>
      <button
        onClick={() => confirm(`Remove the field “${name}” from this card? Record data is kept.`) && mutate((t) => (t.fields = t.fields.filter((x) => x !== name)))}
        title="Remove field"
      >
        ✕
      </button>
    </div>
  );
}
