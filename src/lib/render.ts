import Konva from 'konva';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import type { CardElement, Fit, Person, SideKey, Template } from './types';
import { PT_TO_MM, formatDate } from './utils';

export interface RenderOptions {
  /** Pixels per millimetre. */
  scale: number;
  person: Person | null;
  /** Editor mode: show {{Field}} placeholders and photo/QR stand-ins. */
  placeholders: boolean;
}

// ---------- placeholder text ----------

function lookup(key: string, person: Person | null): string | undefined {
  if (key === 'Today') return formatDate(new Date());
  if (!person) return undefined;
  if (key === 'Serial') return String(person.serial).padStart(5, '0');
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

const qrCache = new Map<string, Promise<HTMLImageElement>>();
function qrImage(value: string, dark: string, light: string): Promise<HTMLImageElement> {
  const key = `${value}|${dark}|${light}`;
  let p = qrCache.get(key);
  if (!p) {
    p = QRCode.toDataURL(value, {
      margin: 0,
      width: 600,
      errorCorrectionLevel: 'M',
      color: { dark, light: light === 'transparent' ? '#0000' : light },
    }).then(loadImage);
    qrCache.set(key, p);
    if (qrCache.size > 300) qrCache.delete(qrCache.keys().next().value!);
  }
  return p;
}

function barcodeCanvas(value: string, format: string, color: string, showText: boolean): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  try {
    JsBarcode(canvas, value, {
      format,
      lineColor: color,
      background: 'rgba(0,0,0,0)',
      displayValue: showText,
      margin: 0,
      width: 4,
      height: 160,
      fontSize: 36,
      textMargin: 4,
      font: 'Arial',
    });
    return canvas;
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

function roundedClip(W: number, H: number, r: number) {
  const rr = Math.max(0, Math.min(r, W / 2, H / 2));
  type PathCtx = Pick<CanvasRenderingContext2D, 'beginPath' | 'moveTo' | 'lineTo' | 'arcTo' | 'closePath'>;
  return (ctx: PathCtx) => {
    ctx.beginPath();
    ctx.moveTo(rr, 0);
    ctx.lineTo(W - rr, 0);
    ctx.arcTo(W, 0, W, rr, rr);
    ctx.lineTo(W, H - rr);
    ctx.arcTo(W, H, W - rr, H, rr);
    ctx.lineTo(rr, H);
    ctx.arcTo(0, H, 0, H - rr, rr);
    ctx.lineTo(0, rr);
    ctx.arcTo(0, 0, rr, 0, rr);
    ctx.closePath();
  };
}

const SERIF = ['Georgia', 'Times New Roman', 'Cambria'];
const MONO = ['Courier New', 'Consolas'];
/** Fallback fonts so a design still renders sensibly where a font is missing. */
function withFallback(font: string) {
  const generic = SERIF.includes(font) ? 'serif' : MONO.includes(font) ? 'monospace' : 'Arial, Helvetica, sans-serif';
  return `"${font}", ${generic}`;
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
        letterSpacing: el.letterSpacing * s * 0.1,
        wrap: el.autoShrink ? 'none' : 'word',
        ellipsis: !el.autoShrink,
      });
      if (el.autoShrink && text) {
        let guard = 0;
        while (guard++ < 60 && fontSize > 2 && (node.getTextWidth() > W || fontSize * el.lineHeight > H)) {
          fontSize *= 0.95;
          node.fontSize(fontSize);
        }
      }
      g.add(node);
      break;
    }

    case 'image':
    case 'photo': {
      const src = el.type === 'image' ? el.src : o.person?.photo ?? '';
      const radius = el.radius * s;
      if (!src) {
        if (o.placeholders) {
          const ph = placeholderBox(W, H, el.type === 'photo' ? 'PHOTO' : 'IMAGE', s);
          ph.clipFunc(roundedClip(W, H, radius));
          g.add(ph);
        }
      } else {
        try {
          const img = await loadImage(src);
          const inner = new Konva.Group({ clipFunc: roundedClip(W, H, radius) });
          inner.add(new Konva.Image({ image: img, ...fitImage(img.naturalWidth, img.naturalHeight, W, H, el.fit) }));
          g.add(inner);
        } catch {
          if (o.placeholders) g.add(placeholderBox(W, H, 'Missing image', s));
        }
      }
      if (el.type === 'photo' && el.borderWidth > 0) {
        const bw = el.borderWidth * s;
        g.add(
          new Konva.Rect({
            x: bw / 2,
            y: bw / 2,
            width: W - bw,
            height: H - bw,
            stroke: el.borderColor,
            strokeWidth: bw,
            cornerRadius: Math.max(0, Math.min(radius - bw / 2, (W - bw) / 2, (H - bw) / 2)),
          }),
        );
      }
      break;
    }

    case 'qr': {
      const value = resolveText(el.value, o.person, false);
      const size = Math.min(W, H);
      const offX = (W - size) / 2;
      const offY = (H - size) / 2;
      if (!value) {
        if (o.placeholders) g.add(placeholderBox(W, H, 'QR', s));
        break;
      }
      if (visibleColor(el.background)) {
        const pad = size * 0.06;
        g.add(new Konva.Rect({ x: offX - pad, y: offY - pad, width: size + pad * 2, height: size + pad * 2, fill: el.background }));
      }
      const img = await qrImage(value, el.color, 'transparent');
      g.add(new Konva.Image({ image: img, x: offX, y: offY, width: size, height: size }));
      break;
    }

    case 'barcode': {
      const value = resolveText(el.value, o.person, false);
      if (!value) {
        if (o.placeholders) g.add(placeholderBox(W, H, 'BARCODE', s));
        break;
      }
      const canvas = barcodeCanvas(value, el.format, el.color, el.showText);
      if (canvas) {
        g.add(new Konva.Image({ image: canvas, width: W, height: H }));
      } else if (o.placeholders) {
        g.add(placeholderBox(W, H, `Invalid ${el.format} value`, s));
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

/** Renders a side to an image at the given DPI (for printing / export). */
export async function renderSideToDataURL(
  tpl: Template,
  sideKey: SideKey,
  person: Person | null,
  dpi = 300,
  mimeType: 'image/png' | 'image/jpeg' = 'image/jpeg',
): Promise<string> {
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
    return stage.toDataURL({ mimeType, quality: 0.93, pixelRatio: 1 });
  } finally {
    stage.destroy();
  }
}
