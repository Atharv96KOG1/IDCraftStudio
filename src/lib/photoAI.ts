/**
 * Offline photo AI: face detection (BlazeFace) and person/hair/skin segmentation
 * (MediaPipe selfie multiclass) running locally via WebAssembly, plus a colour
 * pipeline used by both the automatic and the manual photo editor.
 */
import type { FaceDetector, ImageSegmenter } from '@mediapipe/tasks-vision';
import { dataUrlToBlob } from './utils';

// ---------------------------------------------------------------- models

let models: Promise<{ fd: FaceDetector; seg: ImageSegmenter }> | null = null;

export function loadModels() {
  if (!models) {
    models = (async () => {
      const { FilesetResolver, FaceDetector, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const base = new URL('./mediapipe/', document.baseURI).href;
      const fileset = await FilesetResolver.forVisionTasks(base + 'wasm');
      const fd = await FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: base + 'models/blaze_face_short_range.tflite', delegate: 'CPU' },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.45,
      });
      const seg = await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: base + 'models/selfie_multiclass_256x256.tflite', delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
      return { fd, seg };
    })();
    models.catch(() => (models = null));
  }
  return models;
}

// ---------------------------------------------------------------- types

export interface Face {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
  /** Eye positions in source pixels (image-left eye first). */
  eyes: [{ x: number; y: number }, { x: number; y: number }] | null;
}

export interface Analysis {
  face: Face | null;
  facesFound: number;
  /** Alpha = probability of person (hair, skin, clothes) at mask resolution. */
  person: HTMLCanvasElement | null;
  /** Alpha = probability of face/body skin. */
  skin: HTMLCanvasElement | null;
  /** Top of the head (hair included), source pixels. */
  headTop: number | null;
}

export interface PhotoEdit {
  /** Output width / height. */
  aspect: number;
  /** Crop centre and height in source pixels. */
  cx: number;
  cy: number;
  cropH: number;
  rotation: number;
  flipX: boolean;
  /** Replace the background with this colour; null keeps the original. */
  background: string | null;
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  tint: number;
  sharpness: number;
  smoothing: number;
}

export const ASPECTS = [
  { label: 'ID photo 3:4', value: 3 / 4 },
  { label: 'Passport 35×45 mm', value: 35 / 45 },
  { label: 'Square 1:1', value: 1 },
  { label: 'Portrait 4:5', value: 4 / 5 },
];

export const BACKGROUNDS = [
  { label: 'Keep original', value: null },
  { label: 'White', value: '#ffffff' },
  { label: 'Light blue', value: '#dbeafe' },
  { label: 'Light grey', value: '#e5e7eb' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Red', value: '#dc2626' },
] as const;

export const NEUTRAL_COLOUR = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, tint: 0, sharpness: 0, smoothing: 0 };

// ---------------------------------------------------------------- source

/** Loads an image (data URL / File) into a canvas, max `maxSize` px, EXIF-rotated. */
export async function loadSource(src: string | Blob, maxSize = 1600): Promise<HTMLCanvasElement> {
  const blob = typeof src === 'string' ? (src.startsWith('data:') ? dataUrlToBlob(src) : await (await fetch(src)).blob()) : src;
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const r = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * r);
  c.height = Math.round(bmp.height * r);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

export function defaultEdit(src: HTMLCanvasElement, aspect = 3 / 4): PhotoEdit {
  return {
    aspect,
    cx: src.width / 2,
    cy: src.height / 2,
    cropH: Math.min(src.height, src.width / aspect),
    rotation: 0,
    flipX: false,
    background: null,
    ...NEUTRAL_COLOUR,
  };
}

// ---------------------------------------------------------------- analysis

function maskCanvas(w: number, h: number, alpha: (i: number) => number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, alpha(i))) * 255);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export async function analyze(src: HTMLCanvasElement): Promise<Analysis> {
  const { fd, seg } = await loadModels();

  // Faces — choose the biggest one.
  const det = fd.detect(src).detections;
  let face: Face | null = null;
  for (const d of det) {
    const b = d.boundingBox;
    if (!b) continue;
    if (face && b.width * b.height <= face.w * face.h) continue;
    const kp = d.keypoints;
    const eyes =
      kp.length >= 2
        ? ([
            { x: kp[0].x * src.width, y: kp[0].y * src.height },
            { x: kp[1].x * src.width, y: kp[1].y * src.height },
          ].sort((a, b) => a.x - b.x) as Face['eyes'])
        : null;
    face = { x: b.originX, y: b.originY, w: b.width, h: b.height, score: d.categories[0]?.score ?? 0, eyes };
  }

  // Segmentation: 0 background, 1 hair, 2 body skin, 3 face skin, 4 clothes, 5 accessories.
  let person: HTMLCanvasElement | null = null;
  let skin: HTMLCanvasElement | null = null;
  let headTop: number | null = null;
  const res = seg.segment(src);
  try {
    const masks = res.confidenceMasks;
    if (masks && masks.length >= 4) {
      const mw = masks[0].width;
      const mh = masks[0].height;
      const bg = masks[0].getAsFloat32Array();
      const hair = masks[1].getAsFloat32Array();
      const body = masks[2].getAsFloat32Array();
      const faceSkin = masks[3].getAsFloat32Array();
      person = maskCanvas(mw, mh, (i) => 1 - bg[i]);
      skin = maskCanvas(mw, mh, (i) => faceSkin[i] + body[i] * 0.5);

      // Highest row with hair/face above the detected face → top of head.
      if (face) {
        const x0 = Math.max(0, Math.floor(((face.x - face.w * 0.15) / src.width) * mw));
        const x1 = Math.min(mw - 1, Math.ceil(((face.x + face.w * 1.15) / src.width) * mw));
        const yFace = Math.floor((face.y / src.height) * mh);
        for (let y = 0; y <= yFace; y++) {
          let hits = 0;
          for (let x = x0; x <= x1; x++) if (hair[y * mw + x] + faceSkin[y * mw + x] > 0.5) hits++;
          if (hits >= Math.max(2, (x1 - x0) * 0.08)) {
            headTop = (y / mh) * src.height;
            break;
          }
        }
      }
    }
  } finally {
    res.close();
  }

  return { face, facesFound: det.length, person, skin, headTop };
}

// ---------------------------------------------------------------- automatic edit

/** Frames the face like an ID photo and straightens the head. */
export function autoCrop(a: Analysis): Partial<PhotoEdit> {
  const f = a.face;
  if (!f) return {};
  let rotation = 0;
  if (f.eyes) {
    const [l, r] = f.eyes;
    const deg = (Math.atan2(r.y - l.y, r.x - l.x) * 180) / Math.PI;
    if (Math.abs(deg) <= 20) rotation = -Math.round(deg * 10) / 10;
  }
  const chin = f.y + f.h * 1.08;
  let top = a.headTop ?? f.y - f.h * 0.5;
  // Guard against a mask that reached far above the head (e.g. hats, busy backgrounds).
  top = Math.max(top, f.y - f.h * 0.9);
  const headH = chin - top;
  const cropH = headH / 0.6; // head ≈ 60% of the photo height, shoulders visible
  const cropTop = top - cropH * 0.12;
  const cx = f.x + f.w / 2;
  return { cx, cy: cropTop + cropH / 2, cropH, rotation };
}

/** Measures the photo and returns colour corrections (white balance, exposure, contrast). */
export function autoColour(src: HTMLCanvasElement, a: Analysis): Partial<PhotoEdit> {
  const S = 220;
  const r = Math.min(1, S / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * r));
  c.height = Math.max(1, Math.round(src.height * r));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;

  // White balance from near-neutral pixels only (greys/whites in the scene), so a
  // colourful background or clothing does not skew it.
  let sr = 0, sg = 0, sb = 0, n = 0;
  const lumas: number[] = [];
  for (let i = 0; i < d.length; i += 4) {
    const R = d[i], G = d[i + 1], B = d[i + 2];
    const L = 0.299 * R + 0.587 * G + 0.114 * B;
    lumas.push(L);
    if (L < 40 || L > 245) continue;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    if ((mx - mn) / mx > 0.22) continue;
    sr += R;
    sg += G;
    sb += B;
    n++;
  }
  const out: Partial<PhotoEdit> = { saturation: 6, sharpness: 25 };
  if (n > d.length / 4 / 50) {
    const avg = (sr + sg + sb) / (3 * n);
    out.warmth = clamp(((sb - sr) / n / avg) * 100, -25, 25);
    out.tint = clamp((((sr + sb) / 2 - sg) / n / avg) * 100, -20, 20);
  }

  // Contrast from the spread of brightness.
  lumas.sort((x, y) => x - y);
  const p2 = lumas[Math.floor(lumas.length * 0.02)] / 255;
  const p98 = lumas[Math.floor(lumas.length * 0.98)] / 255;
  const spread = Math.max(0.2, p98 - p2);
  out.contrast = clamp((0.85 / spread - 1) * 60, -10, 35);

  // Exposure from the face brightness (target: well-lit skin).
  let faceL = 0;
  if (a.face) {
    const fx0 = Math.floor(a.face.x * r), fy0 = Math.floor(a.face.y * r);
    const fw = Math.max(1, Math.floor(a.face.w * r)), fh = Math.max(1, Math.floor(a.face.h * r));
    const fd = ctx.getImageData(Math.max(0, fx0), Math.max(0, fy0), fw, fh).data;
    let s = 0;
    for (let i = 0; i < fd.length; i += 4) s += 0.299 * fd[i] + 0.587 * fd[i + 1] + 0.114 * fd[i + 2];
    faceL = s / (fd.length / 4) / 255;
  } else {
    faceL = lumas[Math.floor(lumas.length / 2)] / 255;
  }
  if (faceL > 0.03 && faceL < 0.97) {
    const target = 0.6;
    const gamma = Math.log(target) / Math.log(faceL);
    out.brightness = clamp(-Math.log2(gamma) * 100, -45, 60);
  }
  for (const k of ['warmth', 'tint', 'contrast', 'brightness'] as const) if (out[k] !== undefined) out[k] = Math.round(out[k]!);
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------- rendering

function transformTo(ctx: CanvasRenderingContext2D, e: PhotoEdit, outW: number, outH: number) {
  const s = outH / e.cropH;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((e.rotation * Math.PI) / 180);
  ctx.scale(e.flipX ? -s : s, s);
  ctx.translate(-e.cx, -e.cy);
}

function maskAlpha(mask: HTMLCanvasElement, src: HTMLCanvasElement, e: PhotoEdit, outW: number, outH: number) {
  const c = document.createElement('canvas');
  c.width = outW;
  c.height = outH;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  transformTo(ctx, e, outW, outH);
  ctx.drawImage(mask, 0, 0, mask.width, mask.height, 0, 0, src.width, src.height);
  return ctx.getImageData(0, 0, outW, outH).data;
}

function blurred(c: HTMLCanvasElement, px: number) {
  const b = document.createElement('canvas');
  b.width = c.width;
  b.height = c.height;
  const ctx = b.getContext('2d', { willReadFrequently: true })!;
  ctx.filter = `blur(${px}px)`;
  ctx.drawImage(c, 0, 0);
  return ctx.getImageData(0, 0, b.width, b.height).data;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Renders the final photo for the given edit. */
export function renderPhoto(src: HTMLCanvasElement, a: Analysis | null, e: PhotoEdit, outH: number): HTMLCanvasElement {
  const outW = Math.round(outH * e.aspect);
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = e.background ?? '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingQuality = 'high';
  transformTo(ctx, e, outW, outH);
  ctx.drawImage(src, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const img = ctx.getImageData(0, 0, outW, outH);
  const p = img.data;

  // 1. Colour: white balance → exposure (gamma) → contrast as per-channel lookup tables.
  const gains = [1 + e.warmth * 0.0025 - e.tint * 0.001, 1 + e.tint * 0.0025, 1 - e.warmth * 0.0025 - e.tint * 0.001];
  const gamma = Math.pow(2, -e.brightness / 100);
  const k = 1 + e.contrast / 100;
  const luts = gains.map((g) => {
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      let x = Math.min(1, (v / 255) * g);
      x = Math.pow(x, gamma);
      x = (x - 0.5) * k + 0.5;
      lut[v] = x * 255;
    }
    return lut;
  });
  const sat = 1 + e.saturation / 100;
  for (let i = 0; i < p.length; i += 4) {
    let r = luts[0][p[i]], g = luts[1][p[i + 1]], b = luts[2][p[i + 2]];
    if (sat !== 1) {
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      r = L + (r - L) * sat;
      g = L + (g - L) * sat;
      b = L + (b - L) * sat;
    }
    p[i] = r;
    p[i + 1] = g;
    p[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);

  // 2. Skin smoothing: blend a soft blur into skin areas only.
  if (e.smoothing > 0 && a?.skin) {
    const skinA = maskAlpha(a.skin, src, e, outW, outH);
    const soft = blurred(out, Math.max(1, outH * 0.004));
    const amt = e.smoothing / 100;
    for (let i = 0; i < p.length; i += 4) {
      const w = (skinA[i + 3] / 255) * amt * 0.85;
      if (w <= 0) continue;
      p[i] += (soft[i] - p[i]) * w;
      p[i + 1] += (soft[i + 1] - p[i + 1]) * w;
      p[i + 2] += (soft[i + 2] - p[i + 2]) * w;
    }
    ctx.putImageData(img, 0, 0);
  }

  // 3. Background replacement with a softened person mask.
  if (e.background && a?.person) {
    const personA = maskAlpha(a.person, src, e, outW, outH);
    const [br, bg, bb] = hexToRgb(e.background);
    for (let i = 0; i < p.length; i += 4) {
      let t = (personA[i + 3] / 255 - 0.25) / 0.5; // smoothstep 0.25..0.75
      t = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
      p[i] = p[i] * t + br * (1 - t);
      p[i + 1] = p[i + 1] * t + bg * (1 - t);
      p[i + 2] = p[i + 2] * t + bb * (1 - t);
    }
    ctx.putImageData(img, 0, 0);
  }

  // 4. Sharpen (unsharp mask).
  if (e.sharpness > 0) {
    const soft = blurred(out, 1);
    const amt = e.sharpness / 50;
    for (let i = 0; i < p.length; i += 4) {
      p[i] += (p[i] - soft[i]) * amt;
      p[i + 1] += (p[i + 1] - soft[i + 1]) * amt;
      p[i + 2] += (p[i + 2] - soft[i + 2]) * amt;
    }
    ctx.putImageData(img, 0, 0);
  }
  return out;
}

// ---------------------------------------------------------------- one-click / batch

export interface AutoOptions {
  aspect?: number;
  background?: string | null;
  smoothing?: number;
}

/** Full automatic pipeline. Returns the finished photo as JPEG data URL. */
export async function autoEnhance(source: string | Blob, o: AutoOptions = {}) {
  const src = await loadSource(source);
  const a = await analyze(src);
  const edit: PhotoEdit = {
    ...defaultEdit(src, o.aspect ?? 3 / 4),
    ...autoCrop(a),
    ...autoColour(src, a),
    background: o.background ?? null,
    smoothing: o.smoothing ?? 0,
  };
  const photo = renderPhoto(src, a, edit, 800).toDataURL('image/jpeg', 0.92);
  return { photo, faceFound: !!a.face };
}

/** Smaller copy of the original kept so the photo can be re-edited later. */
export async function originalCopy(source: string | Blob) {
  return (await loadSource(source, 1400)).toDataURL('image/jpeg', 0.9);
}
