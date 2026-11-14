import Konva from 'konva';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import type { CardElement, Fit, Person, SideKey, Template } from './types';
import { PT_TO_MM, formatDate } from './utils';
import { ensureFont } from './fonts';
import { conceptFromName } from './fieldDetect';
import { clipartSrc, tracePath } from './shapes';
import { isKrutiFont, toKrutiDev } from './marathi';

export interface RenderOptions {
  /** Pixels per millimetre. */
  scale: number;
  person: Person | null;
  /** Editor mode: show {{Field}} placeholders and photo/QR stand-ins. */
  placeholders: boolean;
}

// ---------- placeholder text ----------

const HIDDEN_FIELDS = /^photo ?file$/i;

/** Every filled-in field of the person as "Label: value" lines (for QR codes). */
function allDetails(person: Person): string {
  const lines = Object.entries(person.fields)
    .filter(([k, v]) => v?.trim() && !HIDDEN_FIELDS.test(k))
    .map(([k, v]) => `${k.replace(/([a-z])([A-Z])/g, '$1 $2')}: ${v.trim()}`);
  lines.push(`ID No: ${String(person.serial).padStart(5, '0')}`);
  return lines.join('\n');
}

const vEsc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** vCard 3.0 so phones offer "Add to contacts" when the QR is scanned. */
function vCard(person: Person): string {
  const by: Partial<Record<string, string>> = {};
  const rest: string[] = [];
  for (const [k, v] of Object.entries(person.fields)) {
    if (!v?.trim() || HIDDEN_FIELDS.test(k)) continue;
    const kind = conceptFromName(k.replace(/([a-z])([A-Z])/g, '$1 $2'))?.kind;
    if (kind && ['name', 'phone', 'email', 'address', 'company', 'designation', 'department'].includes(kind) && !by[kind]) by[kind] = v.trim();
    else rest.push(`${k.replace(/([a-z])([A-Z])/g, '$1 $2')}: ${v.trim()}`);
  }
  const name = by.name ?? Object.values(person.fields).find((v) => v?.trim()) ?? '';
  const out = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vEsc(name)}`, `N:${vEsc(name)};;;;`];
  if (by.company) out.push(`ORG:${vEsc(by.company)}${by.department ? `;${vEsc(by.department)}` : ''}`);
  if (by.designation) out.push(`TITLE:${vEsc(by.designation)}`);
  if (by.phone) out.push(`TEL;TYPE=CELL:${by.phone.replace(/[^\d+]/g, '')}`);
  if (by.email) out.push(`EMAIL:${vEsc(by.email)}`);
  if (by.address) out.push(`ADR;TYPE=HOME:;;${vEsc(by.address)};;;;`);
  rest.push(`ID No: ${String(person.serial).padStart(5, '0')}`);
  out.push(`NOTE:${vEsc(rest.join('\n'))}`, 'END:VCARD');
  return out.join('\r\n');
}

function lookup(key: string, person: Person | null): string | undefined {
  if (key === 'Today') return formatDate(new Date());
  if (!person) return undefined;
  if (key === 'Serial') return String(person.serial).padStart(5, '0');
  if (key === 'AllDetails') return allDetails(person);
  if (key === 'vCard') return vCard(person);
  if (key === 'IssueDate') return formatDate(new Date(person.createdAt));
  const f = person.fields;
  if (key in f) return f[key] ?? '';
  const match = Object.keys(f).find((k) => k.toLowerCase() === key.toLowerCase());
  return match ? f[match] ?? '' : '';
}

export function resolveText(text: string, person: Person | null, placeholders: boolean): string {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (whole, key: string) => {
    const v = lookup(key, person);
    if (v !== undefined) return v;
    return placeholders ? whole : '';
  });
}

// ---------- image loading ----------

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image failed to load'));
      img.src = src;
    });
    imageCache.set(src, p);
    p.catch(() => imageCache.delete(src));
    if (imageCache.size > 250) imageCache.delete(imageCache.keys().next().value!);
  }
  return p;
}

/** QR module grid (true = dark). Cached because big cards repeat the same value. */
const qrCache = new Map<string, { size: number; dark: Uint8Array }>();
export function qrModules(value: string): { size: number; dark: Uint8Array } {
  let m = qrCache.get(value);
  if (!m) {
    // 'M' error correction scans best when printed; very long data drops to 'L' so it still fits.
    let q: ReturnType<typeof QRCode.create>;
    try {
      q = QRCode.create(value, { errorCorrectionLevel: 'M' });
    } catch {
      q = QRCode.create(value, { errorCorrectionLevel: 'L' });
    }
    m = { size: q.modules.size, dark: Uint8Array.from(q.modules.data as ArrayLike<number>) };
    qrCache.set(value, m);
    if (qrCache.size > 500) qrCache.delete(qrCache.keys().next().value!);
  }
  return m;
}

/** Width of one QR module in mm for a QR of `sizeMm` (used to warn when it gets too small to scan). */
export function qrModuleMm(value: string, sizeMm: number): number {
  try {
    return sizeMm / qrModules(value).size;
  } catch {
    return 0;
  }
}

interface BarcodeData {
  bars: string;
  text: string;
}

function barcodeData(value: string, format: string): BarcodeData | null {
  const target: { encodings?: { data: string; text: string }[] } = {};
  try {
    JsBarcode(target, value, { format, margin: 0 });
    const enc = target.encodings ?? [];
    return { bars: enc.map((e) => e.data).join(''), text: enc.map((e) => e.text).join('') || value };
  } catch {
    return null;
  }
}

// ---------- geometry helpers ----------

function fitImage(iw: number, ih: number, W: number, H: number, fit: Fit) {
  if (fit === 'stretch') return { x: 0, y: 0, width: W, height: H };
  if (fit === 'contain') {
    const r = Math.min(W / iw, H / ih);
    const width = iw * r;
    const height = ih * r;
    return { x: (W - width) / 2, y: (H - height) / 2, width, height };
  }
  // cover: crop the image so it fills the box
  const r = Math.max(W / iw, H / ih);
  const cw = W / r;
  const ch = H / r;
  return { x: 0, y: 0, width: W, height: H, crop: { x: (iw - cw) / 2, y: (ih - ch) / 2, width: cw, height: ch } };
}

const SERIF = ['Georgia', 'Times New Roman', 'Cambria'];
const MONO = ['Courier New', 'Consolas'];
/**
 * Fallback chain so a design still renders where a font is missing, and so
 * Marathi text in a Latin-only font still shows with a Devanagari font.
 */
function withFallback(font: string) {
  const generic = SERIF.includes(font) ? 'serif' : MONO.includes(font) ? 'monospace' : 'sans-serif';
  return `"${font}", "Noto Sans Devanagari", "Nirmala UI", "Mangal", Arial, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", ${generic}`;
}

const visibleColor =(c: string) => !!c && c !== 'transparent';

function placeholderBox(W: number, H: number, label: string, s: number) {
  const g = new Konva.Group();
  g.add(new Konva.Rect({ width: W, height: H, fill: '#e5e7eb', stroke: '#9ca3af', strokeWidth: 0.2 * s, dash: [s, s * 0.6] }));
  g.add(
    new Konva.Text({
      width: W,
      height: H,
      text: label,
      align: 'center',
      verticalAlign: 'middle',
      fontSize: Math.max(6, Math.min(W, H) * 0.18),
      fontFamily: 'Segoe UI, Arial',
      fill: '#6b7280',
    }),
  );
  return g;
}

// ---------- element rendering ----------

async function buildElement(el: CardElement, o: RenderOptions): Promise<Konva.Group> {
  const s = o.scale;
  const W = el.w * s;
  const H = el.h * s;
  const g = new Konva.Group({
    id: el.id,
    name: 'element',
    x: el.x * s,
    y: el.y * s,
    rotation: el.rotation,
    opacity: el.opacity,
    visible: !el.hidden,
  });
  // Invisible hit area so the whole box can be clicked and dragged.
  g.add(new Konva.Rect({ width: W, height: H, fill: 'transparent', name: 'hit' }));

  switch (el.type) {
    case 'rect':
      g.add(
        new Konva.Rect({
          width: W,
          height: H,
          fill: visibleColor(el.fill) ? el.fill : undefined,
          stroke: el.stroke,
          strokeWidth: el.strokeWidth * s,
          strokeEnabled: el.strokeWidth > 0,
          cornerRadius: Math.min(el.radius * s, W / 2, H / 2),
        }),
      );
      break;

    case 'ellipse':
      g.add(
        new Konva.Ellipse({
          x: W / 2,
          y: H / 2,
          radiusX: W / 2,
          radiusY: H / 2,
          fill: visibleColor(el.fill) ? el.fill : undefined,
          stroke: el.stroke,
          strokeWidth: el.strokeWidth * s,
          strokeEnabled: el.strokeWidth > 0,
        }),
      );
      break;

    case 'line':
      g.add(
        new Konva.Line({
          points: [0, H / 2, W, H / 2],
          stroke: el.stroke,
          strokeWidth: Math.max(0.05, el.strokeWidth) * s,
          dash: el.dashed ? [s * 1.2, s * 0.8] : undefined,
          lineCap: 'butt',
        }),
      );
      break;

    case 'text': {
      let text = resolveText(el.text, o.person, o.placeholders);
      if (el.uppercase) text = text.toUpperCase();
      const kruti = el.encoding === 'krutidev' || (el.encoding === undefined && isKrutiFont(el.fontFamily));
      if (kruti && /[\u0900-\u097F]/.test(text)) text = toKrutiDev(text);
      await Promise.all([
        ensureFont(el.fontFamily, el.bold, el.italic, text),
        /[\u0900-\u097F]/.test(text) ? ensureFont('Noto Sans Devanagari', el.bold, false, text) : null,
      ]);
      let fontSize = el.fontSize * PT_TO_MM * s;
      const node = new Konva.Text({
        width: W,
        height: H,
        text,
        fontSize,
        fontFamily: withFallback(el.fontFamily),
        fontStyle: `${el.italic ? 'italic ' : ''}${el.bold ? 'bold' : 'normal'}`,
        textDecoration: el.underline ? 'underline' : '',
        fill: el.color,
        align: el.align,
        verticalAlign: el.vAlign,
        lineHeight: el.lineHeight,
        // Per-letter spacing would split Marathi conjuncts, so it is ignored for Devanagari text.
        letterSpacing: /[\u0900-\u097F]/.test(text) ? 0 : el.letterSpacing * s * 0.1,
        wrap: el.autoShrink ? 'none' : 'word',
        ellipsis: !el.autoShrink,
      });
      if (el.autoShrink && text) {
        let guard = 0;
        // Measure the full line (Konva would report the already-cut width).
        const widest = () => Math.max(...text.split('\n').map((l) => node.measureSize(l).width));
        while (guard++ < 60 && fontSize > 2 && (widest() > W || fontSize * el.lineHeight > H)) {
          fontSize *= 0.95;
          node.fontSize(fontSize);
        }
      }
      g.add(node);
      break;
    }

    case 'image':
    case 'photo': {
      const src = el.type === 'image' ? (el.clipart ? clipartSrc(el.clipart, el.tint) : el.src) : o.person?.photo ?? '';
      const radius = el.radius * s;
      const mask = el.mask ?? 'rect';
      const clip = (ctx: Parameters<typeof tracePath>[0]) => tracePath(ctx, mask, W, H, radius);
      if (!src) {
        if (o.placeholders) {
          const ph = placeholderBox(W, H, el.type === 'photo' ? 'PHOTO' : 'IMAGE', s);
          ph.clipFunc(clip);
          g.add(ph);
        }
      } else {
        try {
          const img = await loadImage(src);
          const inner = new Konva.Group({ clipFunc: clip });
          const fitted = fitImage(img.naturalWidth || 1024, img.naturalHeight || 1024, W, H, el.fit);
          if (el.type === 'photo' && el.fitLock === false) {
            // Unlocked: zoom / move / rotate the photo inside its frame.
            const z = el.photoZoom ?? 1;
            inner.add(
              new Konva.Image({
                image: img,
                crop: fitted.crop,
                width: W * z,
                height: H * z,
                offsetX: (W * z) / 2,
                offsetY: (H * z) / 2,
                x: W / 2 + ((el.photoX ?? 0) / 100) * W,
                y: H / 2 + ((el.photoY ?? 0) / 100) * H,
                rotation: el.photoRotation ?? 0,
              }),
            );
          } else inner.add(new Konva.Image({ image: img, ...fitted }));
          g.add(inner);
        } catch {
          if (o.placeholders) g.add(placeholderBox(W, H, 'Missing image', s));
        }
      }
      if (el.type === 'photo' && el.borderWidth > 0) {
        const bw = el.borderWidth * s;
        g.add(
          new Konva.Shape({
            x: bw / 2,
            y: bw / 2,
            stroke: el.borderColor,
            strokeWidth: bw,
            sceneFunc: (ctx, shape) => {
              tracePath(ctx, mask, W - bw, H - bw, Math.max(0, radius - bw / 2));
              ctx.strokeShape(shape);
            },
          }),
        );
      }
      break;
    }

    case 'shape':
      g.add(
        new Konva.Shape({
          fill: visibleColor(el.fill) ? el.fill : undefined,
          stroke: el.stroke,
          strokeWidth: el.strokeWidth * s,
          strokeEnabled: el.strokeWidth > 0,
          sceneFunc: (ctx, shape) => {
            tracePath(ctx, el.shape, W, H, 0);
            ctx.fillStrokeShape(shape);
          },
        }),
      );
      break;

    case 'qr': {
      const value = resolveText(el.value, o.person, false);
      const size = Math.min(W, H);
      const offX = (W - size) / 2;
      const offY = (H - size) / 2;
      if (!value) {
        if (o.placeholders) g.add(placeholderBox(W, H, 'QR', s));
        break;
      }
      let m: { size: number; dark: Uint8Array };
      try {
        m = qrModules(value);
      } catch {
        if (o.placeholders) g.add(placeholderBox(W, H, 'Too much data for QR', s));
        break;
      }
      const cell = size / m.size;
      if (visibleColor(el.background)) {
        // Quiet zone of 2 modules around the code helps phone scanners.
        const pad = Math.max(cell * 2, size * 0.04);
        g.add(new Konva.Rect({ x: offX - pad, y: offY - pad, width: size + pad * 2, height: size + pad * 2, fill: el.background }));
      }
      // Drawn as sharp vector squares, so it stays crisp at any print resolution.
      g.add(
        new Konva.Shape({
          x: offX,
          y: offY,
          fill: el.color,
          sceneFunc: (ctx, shape) => {
            ctx.beginPath();
            for (let r = 0; r < m.size; r++) {
              for (let c = 0; c < m.size; c++) {
                if (!m.dark[r * m.size + c]) continue;
                // Run of dark modules in a row = one rectangle (no hairline gaps).
                let e = c;
                while (e + 1 < m.size && m.dark[r * m.size + e + 1]) e++;
                ctx.rect(c * cell, r * cell, (e - c + 1) * cell + 0.01, cell + 0.01);
                c = e;
              }
            }
            ctx.fillShape(shape);
          },
        }),
      );
      break;
    }

    case 'barcode': {
      const value = resolveText(el.value, o.person, false);
      if (!value) {
        if (o.placeholders) g.add(placeholderBox(W, H, 'BARCODE', s));
        break;
      }
      const bc = barcodeData(value, el.format);
      if (!bc) {
        if (o.placeholders) g.add(placeholderBox(W, H, `Invalid ${el.format} value`, s));
        break;
      }
      const textH = el.showText ? Math.min(H * 0.28, 3.2 * s) : 0;
      const barH = H - textH;
      const unit = W / bc.bars.length;
      g.add(
        new Konva.Shape({
          fill: el.color,
          sceneFunc: (ctx, shape) => {
            ctx.beginPath();
            for (let i = 0; i < bc.bars.length; i++) {
              if (bc.bars[i] !== '1') continue;
              let e = i;
              while (bc.bars[e + 1] === '1') e++;
              ctx.rect(i * unit, 0, (e - i + 1) * unit, barH);
              i = e;
            }
            ctx.fillShape(shape);
          },
        }),
      );
      if (el.showText) {
        g.add(
          new Konva.Text({
            y: barH,
            width: W,
            height: textH,
            text: bc.text,
            align: 'center',
            verticalAlign: 'middle',
            fontSize: textH * 0.85,
            fontFamily: 'Consolas, "Courier New", monospace',
            fill: el.color,
          }),
        );
      }
      break;
    }
  }
  return g;
}

/** Builds one card side as a Konva group (card origin at 0,0). */
export async function buildSide(tpl: Template, sideKey: SideKey, o: RenderOptions): Promise<Konva.Group> {
  const side = tpl[sideKey];
  const W = tpl.widthMm * o.scale;
  const H = tpl.heightMm * o.scale;
  const card = new Konva.Group({ name: 'card', clip: { x: 0, y: 0, width: W, height: H } });
  card.add(new Konva.Rect({ name: 'card-bg', width: W, height: H, fill: side.background || '#ffffff' }));
  if (side.backgroundImage) {
    try {
      const img = await loadImage(side.backgroundImage);
      card.add(new Konva.Image({ name: 'card-bg', image: img, ...fitImage(img.naturalWidth, img.naturalHeight, W, H, 'cover') }));
    } catch {
      /* ignore broken background */
    }
  }
  const nodes = await Promise.all(side.elements.map((el) => buildElement(el, o)));
  nodes.forEach((n) => card.add(n));
  return card;
}

/** Renders a side to a canvas at the given DPI (for printing / export). */
export async function renderSideToCanvas(tpl: Template, sideKey: SideKey, person: Person | null, dpi = 300): Promise<HTMLCanvasElement> {
  const scale = dpi / 25.4;
  const W = Math.round(tpl.widthMm * scale);
  const H = Math.round(tpl.heightMm * scale);
  const container = document.createElement('div');
  const stage = new Konva.Stage({ container, width: W, height: H });
  const layer = new Konva.Layer();
  stage.add(layer);
  try {
    layer.add(await buildSide(tpl, sideKey, { scale, person, placeholders: false }));
    layer.draw();
    return stage.toCanvas({ pixelRatio: 1 });
  } finally {
    stage.destroy();
  }
}

/** Renders a side to an image data URL at the given DPI. */
export async function renderSideToDataURL(
  tpl: Template,
  sideKey: SideKey,
  person: Person | null,
  dpi = 300,
  mimeType: 'image/png' | 'image/jpeg' = 'image/jpeg',
): Promise<string> {
  const canvas = await renderSideToCanvas(tpl, sideKey, person, dpi);
  return canvas.toDataURL(mimeType, 0.93);
}
