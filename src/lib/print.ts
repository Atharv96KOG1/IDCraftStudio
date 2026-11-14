import { jsPDF } from 'jspdf';
import type { Person, Template } from './types';
import { loadImage, renderSideToCanvas } from './render';
import { dataUrlToBlob, nextFrame } from './utils';

export type Paper = 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | '4x6' | 'Custom' | 'Card';
export type SidesMode = 'front' | 'back' | 'both';
/** auto = mix upright and turned cards to fit the most on a sheet. */
export type LayoutMode = 'auto' | 'normal' | 'rotated';
export type Orientation = 'auto' | 'portrait' | 'landscape';
/** How the paper is turned over for the back: around its vertical or horizontal axis. */
export type DuplexFlip = 'auto' | 'horizontal' | 'vertical';
/** Mirror the whole print (for transfer film / reverse printing). */
export type MirrorMode = 'none' | 'horizontal' | 'vertical';

export interface PrintOptions {
  paper: Paper;
  customW: number;
  customH: number;
  orientation: Orientation;
  layout: LayoutMode;
  sides: SidesMode;
  marginMm: number;
  gapMm: number;
  cutMarks: boolean;
  dpi: number;
  flip: DuplexFlip;
  mirror: MirrorMode;
}

export const DEFAULT_PRINT: PrintOptions = {
  paper: 'A4',
  customW: 210,
  customH: 297,
  orientation: 'auto',
  layout: 'auto',
  sides: 'front',
  marginMm: 5,
  gapMm: 2,
  cutMarks: true,
  dpi: 300,
  flip: 'auto',
  mirror: 'none',
};

export const PAPERS: Record<Exclude<Paper, 'Card' | 'Custom'>, [number, number, string]> = {
  A4: [210, 297, 'A4 (210 × 297 mm)'],
  A3: [297, 420, 'A3 (297 × 420 mm)'],
  A5: [148, 210, 'A5 (148 × 210 mm)'],
  Letter: [215.9, 279.4, 'Letter (8.5 × 11 in)'],
  Legal: [215.9, 355.6, 'Legal (8.5 × 14 in)'],
  '4x6': [101.6, 152.4, 'Photo paper 4 × 6 in'],
};

/** One card position on the sheet. `rot` 90 = card turned clockwise. */
export interface Slot {
  x: number;
  y: number;
  rot: 0 | 90;
}

export interface SheetLayout {
  pageW: number;
  pageH: number;
  slots: Slot[];
  upright: number;
  turned: number;
}

interface Placed {
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
}

export interface Page {
  w: number;
  h: number;
  items: Placed[];
  cutMarks: boolean;
}

const fitCount = (len: number, size: number, gap: number) => (len + 1e-6 < size ? 0 : Math.floor((len + gap + 1e-6) / (size + gap)));

/** Grid of `cols × rows` cards of size w×h starting at (x0, y0). */
function grid(x0: number, y0: number, cols: number, rows: number, w: number, h: number, gap: number, rot: 0 | 90): Slot[] {
  const out: Slot[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: x0 + c * (w + gap), y: y0 + r * (h + gap), rot });
  return out;
}

/** Best packing of a×b cards in a W×H area, optionally mixing upright and turned blocks. */
function pack(W: number, H: number, a: number, b: number, gap: number, mode: LayoutMode): Slot[] {
  const candidates: Slot[][] = [];
  const allow = (rot: 0 | 90) => mode === 'auto' || (mode === 'normal' ? rot === 0 : rot === 90);
  const dims = (rot: 0 | 90) => (rot === 0 ? [a, b] : [b, a]);
  for (const first of [0, 90] as const) {
    if (!allow(first)) continue;
    const second: 0 | 90 = first === 0 ? 90 : 0;
    const [w1, h1] = dims(first);
    const [w2, h2] = dims(second);
    // Plain grid.
    candidates.push(grid(0, 0, fitCount(W, w1, gap), fitCount(H, h1, gap), w1, h1, gap, first));
    if (mode !== 'auto') continue;
    // Rows of the first orientation on top, the rest filled with the other orientation.
    const maxRows = fitCount(H, h1, gap);
    for (let r = 1; r < maxRows; r++) {
      const used = r * (h1 + gap);
      candidates.push([
        ...grid(0, 0, fitCount(W, w1, gap), r, w1, h1, gap, first),
        ...grid(0, used, fitCount(W, w2, gap), fitCount(H - used, h2, gap), w2, h2, gap, second),
      ]);
    }
    // Columns of the first orientation on the left, the rest with the other.
    const maxCols = fitCount(W, w1, gap);
    for (let c = 1; c < maxCols; c++) {
      const used = c * (w1 + gap);
      candidates.push([
        ...grid(0, 0, c, fitCount(H, h1, gap), w1, h1, gap, first),
        ...grid(used, 0, fitCount(W - used, w2, gap), fitCount(H, h2, gap), w2, h2, gap, second),
      ]);
    }
  }
  const turned = (s: Slot[]) => s.filter((x) => x.rot === 90).length;
  candidates.sort((p, q) => q.length - p.length || turned(p) - turned(q));
  return candidates[0] ?? [];
}

export function paperSize(o: Pick<PrintOptions, 'paper' | 'customW' | 'customH'>): [number, number] {
  if (o.paper === 'Custom') return [Math.max(20, o.customW), Math.max(20, o.customH)];
  if (o.paper === 'Card') return [0, 0];
  return [PAPERS[o.paper][0], PAPERS[o.paper][1]];
}

/** Fits as many cards as possible on the sheet (trying both paper orientations). */
export function computeLayout(tpl: Template, o: PrintOptions): SheetLayout {
  const cw = tpl.widthMm;
  const ch = tpl.heightMm;
  if (o.paper === 'Card') return { pageW: cw, pageH: ch, slots: [{ x: 0, y: 0, rot: 0 }], upright: 1, turned: 0 };
  const [pw, ph] = paperSize(o);
  const sheets: [number, number][] = [];
  if (o.orientation !== 'landscape') sheets.push([Math.min(pw, ph), Math.max(pw, ph)]);
  if (o.orientation !== 'portrait') sheets.push([Math.max(pw, ph), Math.min(pw, ph)]);
  let best: SheetLayout | null = null;
  for (const [W, H] of sheets) {
    const slots = pack(W - 2 * o.marginMm, H - 2 * o.marginMm, cw, ch, o.gapMm, o.layout);
    if (best && slots.length <= best.slots.length) continue;
    // Centre the block of cards on the sheet.
    const right = Math.max(0, ...slots.map((s) => s.x + (s.rot ? ch : cw)));
    const bottom = Math.max(0, ...slots.map((s) => s.y + (s.rot ? cw : ch)));
    const dx = (W - right) / 2;
    const dy = (H - bottom) / 2;
    const placed = slots.map((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
    best = { pageW: W, pageH: H, slots: placed, upright: placed.filter((s) => !s.rot).length, turned: placed.filter((s) => s.rot).length };
  }
  return best ?? { pageW: pw, pageH: ph, slots: [], upright: 0, turned: 0 };
}

/** Rotates (clockwise, degrees) and/or mirrors a rendered card. */
function transformCard(src: HTMLCanvasElement, rot: number, flipX: boolean, flipY: boolean): string {
  const r = ((rot % 360) + 360) % 360;
  if (!r && !flipX && !flipY) return src.toDataURL('image/jpeg', 0.93);
  const c = document.createElement('canvas');
  const turned = r === 90 || r === 270;
  c.width = turned ? src.height : src.width;
  c.height = turned ? src.width : src.height;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.rotate((r * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c.toDataURL('image/jpeg', 0.93);
}

/**
 * Renders every card and lays them out on pages. With front + back, each
 * front sheet is followed by its back sheet, mirrored so the cards line up
 * when the paper is turned over.
 */
export async function buildPages(
  tpl: Template,
  people: Person[],
  o: PrintOptions,
  onProgress: (done: number, total: number) => void,
): Promise<Page[]> {
  const layout = computeLayout(tpl, o);
  const perPage = layout.slots.length;
  if (!perPage) throw new Error('The card does not fit on this paper with these margins.');
  const wantFront = o.sides !== 'back';
  const wantBack = o.sides !== 'front' && tpl.hasBack;
  if (!wantFront && !wantBack) throw new Error('This template has no back side.');

  const W = layout.pageW;
  const H = layout.pageH;
  const flip = o.flip === 'auto' ? (W <= H ? 'horizontal' : 'vertical') : o.flip;
  const mX = o.mirror === 'horizontal';
  const mY = o.mirror === 'vertical';
  const duplex = wantFront && wantBack && o.paper !== 'Card';

  const total = people.length * ((wantFront ? 1 : 0) + (wantBack ? 1 : 0));
  let done = 0;
  const pages: Page[] = [];
  const marks = o.cutMarks && o.paper !== 'Card';

  const place = (canvas: HTMLCanvasElement, slot: Slot, back: boolean): Placed => {
    let { x, y } = slot;
    let rot: number = slot.rot;
    const w = slot.rot ? tpl.heightMm : tpl.widthMm;
    const h = slot.rot ? tpl.widthMm : tpl.heightMm;
    if (back && duplex) {
      if (flip === 'horizontal') {
        x = W - x - w;
        rot = (360 - rot) % 360;
      } else {
        y = H - y - h;
        rot = (180 - rot + 360) % 360;
      }
    }
    if (mX) x = W - x - w;
    if (mY) y = H - y - h;
    return { x, y, w, h, src: transformCard(canvas, rot, mX, mY) };
  };

  for (let start = 0; start < people.length; start += perPage) {
    const batch = people.slice(start, start + perPage);
    const front: Page = { w: W, h: H, cutMarks: marks, items: [] };
    const back: Page = { w: W, h: H, cutMarks: marks, items: [] };
    for (let i = 0; i < batch.length; i++) {
      if (wantFront) {
        front.items.push(place(await renderSideToCanvas(tpl, 'front', batch[i], o.dpi), layout.slots[i], false));
        onProgress(++done, total);
      }
      if (wantBack) {
        back.items.push(place(await renderSideToCanvas(tpl, 'back', batch[i], o.dpi), layout.slots[i], true));
        onProgress(++done, total);
      }
      await nextFrame();
    }
    if (o.paper === 'Card') {
      // One card per page: front, back, front, back…
      for (let i = 0; i < batch.length; i++) {
        if (wantFront) pages.push({ ...front, items: [front.items[i]] });
        if (wantBack) pages.push({ ...back, items: [back.items[i]] });
      }
    } else {
      if (wantFront) pages.push(front);
      if (wantBack) pages.push(back);
    }
  }
  return pages;
}

const MARK = 3; // mm
const MARK_GAP = 1; // mm

function markSegments(it: Placed): [number, number, number, number][] {
  const segs: [number, number, number, number][] = [];
  const xs = [it.x, it.x + it.w];
  const ys = [it.y, it.y + it.h];
  for (const x of xs) {
    segs.push([x, it.y - MARK_GAP - MARK, x, it.y - MARK_GAP]);
    segs.push([x, it.y + it.h + MARK_GAP, x, it.y + it.h + MARK_GAP + MARK]);
  }
  for (const y of ys) {
    segs.push([it.x - MARK_GAP - MARK, y, it.x - MARK_GAP, y]);
    segs.push([it.x + it.w + MARK_GAP, y, it.x + it.w + MARK_GAP + MARK, y]);
  }
  return segs;
}

export function pagesToPdf(pages: Page[]): Blob {
  const first = pages[0];
  const orient = (p: Page) => (p.w > p.h ? 'landscape' : 'portrait');
  const doc = new jsPDF({ unit: 'mm', format: [first.w, first.h], orientation: orient(first), compress: true });
  pages.forEach((p, i) => {
    if (i > 0) doc.addPage([p.w, p.h], orient(p));
    if (p.cutMarks) {
      doc.setLineWidth(0.1);
      doc.setDrawColor(80);
      // Marks first; cards drawn on top hide any mark that would cross a neighbour.
      p.items.forEach((it) => markSegments(it).forEach(([x1, y1, x2, y2]) => doc.line(x1, y1, x2, y2)));
    }
    p.items.forEach((it) => doc.addImage(it.src, 'JPEG', it.x, it.y, it.w, it.h, undefined, 'FAST'));
  });
  return doc.output('blob');
}

/** One sheet as an image at the given DPI (for JPG export). */
export async function pageToCanvas(p: Page, dpi: number): Promise<HTMLCanvasElement> {
  const k = dpi / 25.4;
  const c = document.createElement('canvas');
  c.width = Math.round(p.w * k);
  c.height = Math.round(p.h * k);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  if (p.cutMarks) {
    ctx.strokeStyle = '#505050';
    ctx.lineWidth = Math.max(1, 0.1 * k);
    ctx.beginPath();
    p.items.forEach((it) =>
      markSegments(it).forEach(([x1, y1, x2, y2]) => {
        ctx.moveTo(x1 * k, y1 * k);
        ctx.lineTo(x2 * k, y2 * k);
      }),
    );
    ctx.stroke();
  }
  for (const it of p.items) ctx.drawImage(await loadImage(it.src), it.x * k, it.y * k, it.w * k, it.h * k);
  return c;
}

function pagesHtml(pages: Page[], url: (src: string) => string): string {
  const css = `
    @page { size: ${pages[0].w}mm ${pages[0].h}mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    .page { position: relative; width: ${pages[0].w}mm; height: ${pages[0].h}mm; overflow: hidden; page-break-after: always; break-after: page; background: #fff; }
    .page:last-child { page-break-after: auto; break-after: auto; }
    img { position: absolute; display: block; }
    .m { position: absolute; background: #555; }
    @media screen { body { background: #888; } .page { margin: 10mm auto; box-shadow: 0 2px 8px #0005; } }
  `;
  const body = pages
    .map((p) => {
      const marks = p.cutMarks
        ? p.items
            .flatMap(markSegments)
            .map(([x1, y1, x2, y2]) =>
              x1 === x2
                ? `<div class="m" style="left:${x1 - 0.05}mm;top:${Math.min(y1, y2)}mm;width:0.1mm;height:${Math.abs(y2 - y1)}mm"></div>`
                : `<div class="m" style="left:${Math.min(x1, x2)}mm;top:${y1 - 0.05}mm;width:${Math.abs(x2 - x1)}mm;height:0.1mm"></div>`,
            )
            .join('')
        : '';
      const imgs = p.items.map((it) => `<img src="${url(it.src)}" style="left:${it.x}mm;top:${it.y}mm;width:${it.w}mm;height:${it.h}mm">`).join('');
      return `<div class="page">${marks}${imgs}</div>`;
    })
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>IDCraft Studio print</title><style>${css}</style></head><body>${body}</body></html>`;
}

/** Self-contained HTML file (images embedded) that prints at real size from any browser. */
export const pagesToHtml = (pages: Page[]) => new Blob([pagesHtml(pages, (s) => s)], { type: 'text/html' });

/** Opens the system print dialog via a hidden iframe. */
export function printPages(pages: Page[]): Promise<void> {
  // Blob URLs keep the page HTML small even for hundreds of high-DPI cards.
  const urls = new Map<string, string>();
  const blobUrl = (src: string) => {
    let u = urls.get(src);
    if (!u) {
      u = URL.createObjectURL(dataUrlToBlob(src));
      urls.set(src, u);
    }
    return u;
  };
  const html = pagesHtml(pages, blobUrl);
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    const imgs = Array.from(doc.images);
    Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => (i.onload = i.onerror = r))))).then(() => {
      iframe.contentWindow!.focus();
      iframe.contentWindow!.print();
      setTimeout(() => {
        iframe.remove();
        urls.forEach((u) => URL.revokeObjectURL(u));
        resolve();
      }, 1000);
    });
  });
}
