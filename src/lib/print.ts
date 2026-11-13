import { jsPDF } from 'jspdf';
import type { Person, Template } from './types';
import { renderSideToDataURL } from './render';
import { nextFrame } from './utils';

export type Paper = 'A4' | 'Letter' | 'Card';
export type SidesMode = 'front' | 'back' | 'both';

export interface PrintOptions {
  paper: Paper;
  sides: SidesMode;
  marginMm: number;
  gapMm: number;
  cutMarks: boolean;
  dpi: number;
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

const PAPERS: Record<Exclude<Paper, 'Card'>, [number, number]> = {
  A4: [210, 297],
  Letter: [215.9, 279.4],
};

export interface Grid {
  pageW: number;
  pageH: number;
  cols: number;
  rows: number;
  originX: number;
  originY: number;
}

/** Fit as many cards as possible, trying portrait and landscape paper. */
export function computeGrid(tpl: Template, o: Pick<PrintOptions, 'paper' | 'marginMm' | 'gapMm'>): Grid {
  const cw = tpl.widthMm;
  const ch = tpl.heightMm;
  if (o.paper === 'Card') return { pageW: cw, pageH: ch, cols: 1, rows: 1, originX: 0, originY: 0 };
  const [pw, ph] = PAPERS[o.paper];
  const options = [
    [pw, ph],
    [ph, pw],
  ].map(([W, H]) => {
    const cols = Math.max(0, Math.floor((W - 2 * o.marginMm + o.gapMm) / (cw + o.gapMm)));
    const rows = Math.max(0, Math.floor((H - 2 * o.marginMm + o.gapMm) / (ch + o.gapMm)));
    const usedW = cols * cw + (cols - 1) * o.gapMm;
    const usedH = rows * ch + (rows - 1) * o.gapMm;
    return { pageW: W, pageH: H, cols, rows, originX: (W - usedW) / 2, originY: (H - usedH) / 2 };
  });
  return options[1].cols * options[1].rows > options[0].cols * options[0].rows ? options[1] : options[0];
}

/**
 * Renders every card and lays them out on pages.
 * In "both" mode each front sheet is followed by its back sheet with columns
 * mirrored, so cards line up when the paper is flipped on its long edge.
 */
export async function buildPages(
  tpl: Template,
  people: Person[],
  o: PrintOptions,
  onProgress: (done: number, total: number) => void,
): Promise<Page[]> {
  const grid = computeGrid(tpl, o);
  const perPage = grid.cols * grid.rows;
  if (!perPage) throw new Error('The card does not fit on this paper with these margins.');
  const wantFront = o.sides !== 'back';
  const wantBack = o.sides !== 'front' && tpl.hasBack;
  if (!wantFront && !wantBack) throw new Error('This template has no back side.');

  const total = people.length * ((wantFront ? 1 : 0) + (wantBack ? 1 : 0));
  let done = 0;
  const fronts: string[] = [];
  const backs: string[] = [];
  for (const p of people) {
    if (wantFront) {
      fronts.push(await renderSideToDataURL(tpl, 'front', p, o.dpi));
      onProgress(++done, total);
    }
    if (wantBack) {
      backs.push(await renderSideToDataURL(tpl, 'back', p, o.dpi));
      onProgress(++done, total);
    }
    await nextFrame();
  }

  const pages: Page[] = [];
  const pos = (i: number, mirror: boolean) => {
    const row = Math.floor(i / grid.cols);
    let col = i % grid.cols;
    if (mirror) col = grid.cols - 1 - col;
    return { x: grid.originX + col * (tpl.widthMm + o.gapMm), y: grid.originY + row * (tpl.heightMm + o.gapMm) };
  };
  const marks = o.cutMarks && o.paper !== 'Card';
  for (let start = 0; start < people.length; start += perPage) {
    const count = Math.min(perPage, people.length - start);
    const sheet = (srcs: string[], mirror: boolean): Page => ({
      w: grid.pageW,
      h: grid.pageH,
      cutMarks: marks,
      items: Array.from({ length: count }, (_, i) => ({
        ...pos(i, mirror),
        w: tpl.widthMm,
        h: tpl.heightMm,
        src: srcs[start + i],
      })),
    });
    if (wantFront) pages.push(sheet(fronts, false));
    if (wantBack) pages.push(sheet(backs, o.paper !== 'Card' && wantFront));
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

/** Opens the system print dialog via a hidden iframe. */
export function printPages(pages: Page[]): Promise<void> {
  const css = `
    @page { size: ${pages[0].w}mm ${pages[0].h}mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    .page { position: relative; width: ${pages[0].w}mm; height: ${pages[0].h}mm; overflow: hidden; page-break-after: always; break-after: page; }
    .page:last-child { page-break-after: auto; break-after: auto; }
    img { position: absolute; display: block; }
    .m { position: absolute; background: #555; }
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
      const imgs = p.items
        .map((it) => `<img src="${it.src}" style="left:${it.x}mm;top:${it.y}mm;width:${it.w}mm;height:${it.h}mm">`)
        .join('');
      return `<div class="page">${marks}${imgs}</div>`;
    })
    .join('');

  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!doctype html><html><head><style>${css}</style></head><body>${body}</body></html>`);
    doc.close();
    const imgs = Array.from(doc.images);
    Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => (i.onload = i.onerror = r))))).then(() => {
      iframe.contentWindow!.focus();
      iframe.contentWindow!.print();
      setTimeout(() => {
        iframe.remove();
        resolve();
      }, 1000);
    });
  });
}
