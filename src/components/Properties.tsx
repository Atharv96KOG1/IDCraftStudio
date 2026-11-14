import { useState } from 'react';
import { selectedElement, useStore } from '../lib/store';
import type { BarcodeFormat, CardElement, Fit, Template } from '../lib/types';
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
          {/[\u0900-\u097F]/.test(el.text) && el.letterSpacing !== 0 && (
            <p className="hint">Tip: keep letter spacing at 0 for Marathi so letters join correctly.</p>
          )}
        </section>
      );

    case 'image':
      return (
        <section>
          <h3>Image</h3>
          {el.src && <img className="thumb-preview" src={el.src} alt="" />}
          <div className="btn-row">
            <button
              className="btn"
              onClick={async () => {
                const [f] = await pickFiles('image/*');
                if (f) set({ src: await resizeImage(f, 1600) });
              }}
            >
              {el.src ? 'Replace image…' : 'Choose image…'}
            </button>
          </div>
          <FitSelect value={el.fit} onChange={(fit) => set({ fit })} />
          <Field label="Corner radius (mm)">
            <NumberInput value={el.radius} min={0} onChange={(radius) => set({ radius })} />
          </Field>
        </section>
      );

    case 'photo':
      return (
        <section>
          <h3>Photo</h3>
          <p className="hint">Shows each record's photo. Set a corner radius of half the width for a round photo.</p>
          <FitSelect value={el.fit} onChange={(fit) => set({ fit })} />
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
        <p className="hint">Columns each record has. Use them in text, QR and barcodes as {'{{Field}}'}.</p>
        <div className="chips">
          {tpl.fields.map((f) => (
            <span className="chip" key={f}>
              {f}
              <button onClick={() => mutate((t) => (t.fields = t.fields.filter((x) => x !== f)))} title="Remove field">
                ✕
              </button>
            </span>
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
