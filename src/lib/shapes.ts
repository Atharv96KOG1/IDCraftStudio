import type { ShapeKind } from './types';

/** Minimal canvas path API (works with Konva's context wrapper and CanvasRenderingContext2D). */
export type PathCtx = Pick<
  CanvasRenderingContext2D,
  'beginPath' | 'moveTo' | 'lineTo' | 'arcTo' | 'arc' | 'bezierCurveTo' | 'quadraticCurveTo' | 'closePath' | 'ellipse'
>;

export const SHAPES: { kind: ShapeKind; label: string; icon: string }[] = [
  { kind: 'rect', label: 'Rectangle', icon: '▭' },
  { kind: 'rounded', label: 'Rounded', icon: '▢' },
  { kind: 'circle', label: 'Circle / oval', icon: '◯' },
  { kind: 'triangle', label: 'Triangle', icon: '△' },
  { kind: 'diamond', label: 'Diamond', icon: '◇' },
  { kind: 'pentagon', label: 'Pentagon', icon: '⬠' },
  { kind: 'hexagon', label: 'Hexagon', icon: '⬡' },
  { kind: 'octagon', label: 'Octagon', icon: '⯃' },
  { kind: 'star', label: 'Star', icon: '☆' },
  { kind: 'star6', label: 'Star (6)', icon: '✡' },
  { kind: 'heart', label: 'Heart', icon: '♡' },
  { kind: 'shield', label: 'Shield', icon: '⛉' },
  { kind: 'arch', label: 'Arch', icon: '⌓' },
  { kind: 'badge', label: 'Badge', icon: '✹' },
  { kind: 'ribbon', label: 'Ribbon', icon: '🎗' },
  { kind: 'arrow', label: 'Arrow', icon: '➜' },
  { kind: 'chevron', label: 'Chevron', icon: '❯' },
  { kind: 'speech', label: 'Speech bubble', icon: '💬' },
  { kind: 'wave', label: 'Wave band', icon: '〰' },
  { kind: 'cloud', label: 'Cloud', icon: '☁' },
];

/** Shapes offered as photo / image masks. */
export const MASKS: ShapeKind[] = ['rect', 'rounded', 'circle', 'hexagon', 'octagon', 'diamond', 'star', 'heart', 'shield', 'arch', 'badge', 'pentagon', 'triangle', 'cloud'];

function polygon(ctx: PathCtx, pts: [number, number][]) {
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** Regular polygon / star fitted to the W×H box. */
function regular(n: number, W: number, H: number, inner = 0, rotate = -Math.PI / 2): [number, number][] {
  const pts: [number, number][] = [];
  const steps = inner ? n * 2 : n;
  for (let i = 0; i < steps; i++) {
    const a = rotate + (i * 2 * Math.PI) / steps;
    const r = inner && i % 2 ? inner : 1;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return pts.map(([x, y]) => [((x - x0) / (x1 - x0)) * W, ((y - y0) / (y1 - y0)) * H]);
}

function roundRect(ctx: PathCtx, W: number, H: number, r: number) {
  const rr = Math.max(0, Math.min(r, W / 2, H / 2));
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
}

/** Traces the outline of `kind` in a W×H box. `r` is the corner radius for rect/rounded. */
export function tracePath(ctx: PathCtx, kind: ShapeKind, W: number, H: number, r = 0) {
  ctx.beginPath();
  switch (kind) {
    case 'rect':
      return roundRect(ctx, W, H, r);
    case 'rounded':
      return roundRect(ctx, W, H, r || Math.min(W, H) * 0.18);
    case 'circle':
      ctx.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, Math.PI * 2);
      return ctx.closePath();
    case 'triangle':
      return polygon(ctx, [[W / 2, 0], [W, H], [0, H]]);
    case 'diamond':
      return polygon(ctx, [[W / 2, 0], [W, H / 2], [W / 2, H], [0, H / 2]]);
    case 'pentagon':
      return polygon(ctx, regular(5, W, H));
    case 'hexagon':
      return polygon(ctx, regular(6, W, H, 0, 0));
    case 'octagon':
      return polygon(ctx, regular(8, W, H, 0, Math.PI / 8));
    case 'star':
      return polygon(ctx, regular(5, W, H, 0.45));
    case 'star6':
      return polygon(ctx, regular(6, W, H, 0.58));
    case 'badge':
      return polygon(ctx, regular(16, W, H, 0.86));
    case 'heart':
      ctx.moveTo(W / 2, H * 0.28);
      ctx.bezierCurveTo(W * 0.5, H * 0.05, W * 0.08, H * -0.04, 0, H * 0.3);
      ctx.bezierCurveTo(-W * 0.04, H * 0.6, W * 0.35, H * 0.78, W / 2, H);
      ctx.bezierCurveTo(W * 0.65, H * 0.78, W * 1.04, H * 0.6, W, H * 0.3);
      ctx.bezierCurveTo(W * 0.92, H * -0.04, W * 0.5, H * 0.05, W / 2, H * 0.28);
      return ctx.closePath();
    case 'shield':
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W, H * 0.12);
      ctx.lineTo(W, H * 0.45);
      ctx.bezierCurveTo(W, H * 0.75, W * 0.7, H * 0.9, W / 2, H);
      ctx.bezierCurveTo(W * 0.3, H * 0.9, 0, H * 0.75, 0, H * 0.45);
      ctx.lineTo(0, H * 0.12);
      return ctx.closePath();
    case 'arch':
      ctx.moveTo(0, H);
      ctx.lineTo(0, W / 2);
      ctx.ellipse(W / 2, Math.min(W / 2, H), W / 2, Math.min(W / 2, H), 0, Math.PI, 0);
      ctx.lineTo(W, H);
      return ctx.closePath();
    case 'ribbon':
      return polygon(ctx, [[0, 0], [W, 0], [W * 0.88, H / 2], [W, H], [0, H], [W * 0.12, H / 2]]);
    case 'arrow':
      return polygon(ctx, [[0, H * 0.3], [W * 0.62, H * 0.3], [W * 0.62, 0], [W, H / 2], [W * 0.62, H], [W * 0.62, H * 0.7], [0, H * 0.7]]);
    case 'chevron':
      return polygon(ctx, [[0, 0], [W * 0.7, 0], [W, H / 2], [W * 0.7, H], [0, H], [W * 0.3, H / 2]]);
    case 'speech':
      roundRect(ctx, W, H * 0.78, Math.min(W, H) * 0.15);
      ctx.moveTo(W * 0.2, H * 0.7);
      ctx.lineTo(W * 0.15, H);
      ctx.lineTo(W * 0.42, H * 0.7);
      return ctx.closePath();
    case 'wave':
      ctx.moveTo(0, H * 0.2);
      ctx.bezierCurveTo(W * 0.25, -H * 0.1, W * 0.5, H * 0.5, W, H * 0.1);
      ctx.lineTo(W, H * 0.8);
      ctx.bezierCurveTo(W * 0.5, H * 1.2, W * 0.25, H * 0.5, 0, H * 0.9);
      return ctx.closePath();
    case 'cloud':
      ctx.moveTo(W * 0.2, H);
      ctx.bezierCurveTo(-W * 0.05, H, -W * 0.05, H * 0.5, W * 0.18, H * 0.48);
      ctx.bezierCurveTo(W * 0.15, H * 0.05, W * 0.55, -H * 0.05, W * 0.62, H * 0.28);
      ctx.bezierCurveTo(W * 0.8, H * 0.12, W * 1.02, H * 0.35, W * 0.9, H * 0.55);
      ctx.bezierCurveTo(W * 1.05, H * 0.62, W * 1.02, H, W * 0.8, H);
      return ctx.closePath();
  }
}

// ---------- clipart (original simple icons, 24×24 grid) ----------

export const CLIPARTS: { id: string; label: string; svg: string }[] = [
  { id: 'phone', label: 'Phone', svg: '<path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/>' },
  { id: 'mobile', label: 'Mobile', svg: '<path d="M7 1h10a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2zm0 3v14h10V4zm5 15.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/>' },
  { id: 'mail', label: 'Email', svg: '<path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2.3V17h16V7.3l-8 5.3zM5.5 7l6.5 4.3L18.5 7z"/>' },
  { id: 'location', label: 'Location', svg: '<path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>' },
  { id: 'calendar', label: 'Date', svg: '<path d="M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3zM5 9v10h14V9zm2 2h3v3H7z"/>' },
  { id: 'blood', label: 'Blood group', svg: '<path d="M12 2s7 7.6 7 12.5A7 7 0 0 1 5 14.5C5 9.6 12 2 12 2zm-3.2 12.2a1 1 0 0 0-1 1 4.2 4.2 0 0 0 4.2 4.2 1 1 0 0 0 0-2 2.2 2.2 0 0 1-2.2-2.2 1 1 0 0 0-1-1z"/>' },
  { id: 'user', label: 'Person', svg: '<circle cx="12" cy="7.5" r="4.5"/><path d="M3 21c0-4.4 4-7.5 9-7.5s9 3.1 9 7.5z"/>' },
  { id: 'users', label: 'Group', svg: '<circle cx="8.5" cy="8" r="3.5"/><circle cx="16.5" cy="9" r="3"/><path d="M1.5 20c0-3.6 3.2-6 7-6s7 2.4 7 6zM16.5 13.5c3.3 0 6 2 6 5.5h-5.3a8 8 0 0 0-2.7-5.3c.6-.1 1.3-.2 2-.2z"/>' },
  { id: 'home', label: 'Home', svg: '<path d="M12 3l10 9h-3v9h-5v-6h-4v6H5v-9H2z"/>' },
  { id: 'school', label: 'Graduation', svg: '<path d="M12 3L1 9l11 6 9-4.9V17h2V9zM5 13.2V17c0 2 3.1 4 7 4s7-2 7-4v-3.8l-7 3.8z"/>' },
  { id: 'book', label: 'Book', svg: '<path d="M4 3h7a2 2 0 0 1 2 2v16a2 2 0 0 0-2-2H4zm16 0h-5a2 2 0 0 0-1.5.7V21a2 2 0 0 1 1.5-.7h5z"/>' },
  { id: 'building', label: 'Office', svg: '<path d="M4 2h11v6h5v14H4zm3 3v2h2V5zm4 0v2h2V5zM7 9v2h2V9zm4 0v2h2V9zm-4 4v2h2v-2zm4 0v2h2v-2zm5-3v2h2v-2zm0 4v2h2v-2zM10 18v4h3v-4z"/>' },
  { id: 'briefcase', label: 'Work', svg: '<path d="M9 3h6a2 2 0 0 1 2 2v1h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4V5a2 2 0 0 1 2-2zm0 2v1h6V5zm-7 7.5V14h20v-1.5z"/>' },
  { id: 'id', label: 'ID card', svg: '<path d="M2 5h20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm6 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3.5 16.5h9c0-2-2-3.2-4.5-3.2s-4.5 1.2-4.5 3.2zM14 9v1.6h6V9zm0 3.2v1.6h6v-1.6z"/>' },
  { id: 'globe', label: 'Website', svg: '<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.4 2.1A8 8 0 0 0 4.1 11h3.4a15 15 0 0 1 3.1-6.9zm2.8 0A15 15 0 0 1 16.5 11h3.4a8 8 0 0 0-6.5-6.9zM12 4.6A13 13 0 0 0 9.5 11h5A13 13 0 0 0 12 4.6zM4.1 13a8 8 0 0 0 6.5 6.9A15 15 0 0 1 7.5 13zm5.4 0a13 13 0 0 0 2.5 6.4 13 13 0 0 0 2.5-6.4zm7 0a15 15 0 0 1-3.1 6.9 8 8 0 0 0 6.5-6.9z"/>' },
  { id: 'star', label: 'Star', svg: '<path d="M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z"/>' },
  { id: 'heart', label: 'Heart', svg: '<path d="M12 21s-9-5.6-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.4-9 12-9 12z"/>' },
  { id: 'check', label: 'Verified', svg: '<path d="M12 1l2.6 2 3.3-.2.9 3.2 2.8 1.8-1.2 3.2 1.2 3.2-2.8 1.8-.9 3.2-3.3-.2L12 23l-2.6-2-3.3.2-.9-3.2-2.8-1.8 1.2-3.2-1.2-3.2 2.8-1.8.9-3.2 3.3.2zm-1.3 13.6L7.4 11.3 6 12.7l4.7 4.7L18 10.1l-1.4-1.4z"/>' },
  { id: 'medal', label: 'Award', svg: '<path d="M7 1h4l1 4 1-4h4l-3 7.2a7 7 0 1 1-4 0zm5 9a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 1.8l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"/>' },
  { id: 'trophy', label: 'Trophy', svg: '<path d="M6 2h12v2h4v3a5 5 0 0 1-4.6 5A6 6 0 0 1 13 15.9V19h4v3H7v-3h4v-3.1A6 6 0 0 1 6.6 12 5 5 0 0 1 2 7V4h4zm-2 4v1a3 3 0 0 0 2 2.8V6zm16 0h-2v3.8A3 3 0 0 0 20 7z"/>' },
  { id: 'clock', label: 'Time', svg: '<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 4v7l5.5 3.3 1-1.7-4.5-2.7V6z"/>' },
  { id: 'lock', label: 'Security', svg: '<path d="M12 1a5 5 0 0 1 5 5v3h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1h2V6a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v3h6V6a3 3 0 0 0-3-3zm0 10a2 2 0 0 0-1 3.7V19h2v-2.3A2 2 0 0 0 12 13z"/>' },
  { id: 'cross', label: 'Medical', svg: '<path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/>' },
  { id: 'bus', label: 'Transport', svg: '<path d="M5 2h14a2 2 0 0 1 2 2v13a2 2 0 0 1-1 1.7V21h-3v-2H7v2H4v-2.3A2 2 0 0 1 3 17V4a2 2 0 0 1 2-2zm0 3v6h14V5zm2 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>' },
  { id: 'leaf', label: 'Nature', svg: '<path d="M21 3S9 2 5 9c-2.5 4.4-.6 8.4.6 9.8L3 21.4 4.4 22.8 7 20.2c1.4 1.2 5.4 3.1 9.8.6C23 17 21 3 21 3zM8 17.6l7-7.1-1.4-1.4L6.6 16.2c-.3-1.3-.2-3.6 1.1-5.5C10.4 6.9 16.6 5.7 19 5.3c-.3 2.4-1.6 8.6-5.4 11.3-1.9 1.3-4.2 1.4-5.6 1z"/>' },
  { id: 'sun', label: 'Sun', svg: '<circle cx="12" cy="12" r="4.5"/><path d="M11 1h2v4h-2zm0 18h2v4h-2zM1 11h4v2H1zm18 0h4v2h-4zM4.2 2.8l2.8 2.8-1.4 1.4-2.8-2.8zm14.2 14.2l2.8 2.8-1.4 1.4-2.8-2.8zM2.8 19.8l2.8-2.8 1.4 1.4-2.8 2.8zM17 5.6l2.8-2.8 1.4 1.4-2.8 2.8z"/>' },
  { id: 'flag', label: 'Flag', svg: '<path d="M4 2h2v1h14l-3 5 3 5H6v9H4z"/>' },
  { id: 'camera', label: 'Camera', svg: '<path d="M9 3h6l1.8 2H21a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4.2zm3 4.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>' },
  { id: 'music', label: 'Music', svg: '<path d="M9 3l12-2v14.5a3.5 3.5 0 1 1-2-3.2V5.4l-8 1.4v10.7A3.5 3.5 0 1 1 9 14.3z"/>' },
  { id: 'sports', label: 'Sports', svg: '<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 4.2L8.3 8.9l1.4 4.3h4.6l1.4-4.3zM4.3 9.6A8 8 0 0 0 5 15.8l2.4-.3-1.3-4.1zm15.4 0l-1.8 1.7-1.3 4.1 2.4.3a8 8 0 0 0 .7-6.1zM9.8 15.2l-1.4 2.4L12 20l3.6-2.4-1.4-2.4z"/>' },
];

const esc = (c: string) => c.replace(/[<>"&]/g, '');

/** Clipart as an SVG data URL in the given colour (large size so it prints sharply). */
export function clipartSrc(id: string, color = '#111827'): string {
  const c = CLIPARTS.find((x) => x.id === id);
  if (!c) return '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 24 24" fill="${esc(color)}">${c.svg}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
