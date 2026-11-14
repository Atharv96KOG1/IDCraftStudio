import type { CardElement, ElementType, Template } from './types';
import { uid } from './utils';

type Overrides = Partial<CardElement> & Record<string, unknown>;

const LABELS: Record<ElementType, string> = {
  text: 'Text',
  image: 'Image',
  photo: 'Photo',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  qr: 'QR code',
  barcode: 'Barcode',
};

export function makeElement(type: ElementType, o: Overrides = {}): CardElement {
  const base = {
    id: uid(),
    name: LABELS[type],
    x: 5,
    y: 5,
    w: 20,
    h: 10,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
  };
  let el: CardElement;
  switch (type) {
    case 'text':
      el = {
        ...base, type, w: 40, h: 7,
        text: 'Text', fontFamily: 'Segoe UI', fontSize: 9, bold: false, italic: false, underline: false,
        color: '#111827', align: 'left', vAlign: 'middle', lineHeight: 1.15, letterSpacing: 0,
        uppercase: false, autoShrink: false,
      };
      break;
    case 'image':
      el = { ...base, type, w: 15, h: 15, src: '', fit: 'contain', radius: 0 };
      break;
    case 'photo':
      el = { ...base, type, w: 22, h: 28, fit: 'cover', radius: 1, borderColor: '#ffffff', borderWidth: 0 };
      break;
    case 'rect':
      el = { ...base, type, w: 30, h: 12, fill: '#2563eb', stroke: '#000000', strokeWidth: 0, radius: 0 };
      break;
    case 'ellipse':
      el = { ...base, type, w: 15, h: 15, fill: '#f59e0b', stroke: '#000000', strokeWidth: 0 };
      break;
    case 'line':
      el = { ...base, type, w: 30, h: 1, stroke: '#111827', strokeWidth: 0.3, dashed: false };
      break;
    case 'qr':
      el = { ...base, type, w: 18, h: 18, value: '{{AllDetails}}', color: '#000000', background: '#ffffff' };
      break;
    case 'barcode':
      el = { ...base, type, w: 40, h: 10, value: '{{Serial}}', format: 'CODE128', color: '#000000', showText: true };
      break;
  }
  return { ...el, ...o } as CardElement;
}

/** New element placed in the middle of the card. */
export function makeCentered(type: ElementType, tpl: Template): CardElement {
  const el = makeElement(type);
  el.w = Math.min(el.w, tpl.widthMm - 4);
  el.h = Math.min(el.h, tpl.heightMm - 4);
  el.x = Math.round(((tpl.widthMm - el.w) / 2) * 10) / 10;
  el.y = Math.round(((tpl.heightMm - el.h) / 2) * 10) / 10;
  return el;
}


export const CARD_PRESETS = [
  { label: 'CR80 landscape (85.6 × 54 mm)', w: 85.6, h: 54 },
  { label: 'CR80 portrait (54 × 85.6 mm)', w: 54, h: 85.6 },
  { label: 'CR79 landscape (83.9 × 51 mm)', w: 83.9, h: 51 },
  { label: 'Badge 4 × 3 in (101.6 × 76.2 mm)', w: 101.6, h: 76.2 },
  { label: 'Badge 3 × 4 in (76.2 × 101.6 mm)', w: 76.2, h: 101.6 },
];

/** Placeholders like {{Name}} used anywhere in a template. */
export function placeholdersIn(tpl: Template): string[] {
  const found = new Set<string>();
  for (const side of [tpl.front, tpl.back]) {
    for (const el of side.elements) {
      const s = el.type === 'text' ? el.text : el.type === 'qr' || el.type === 'barcode' ? el.value : '';
      for (const m of s.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) found.add(m[1]);
    }
  }
  return [...found];
}
