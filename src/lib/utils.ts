export const uid = (): string =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const clone = <T,>(v: T): T => structuredClone(v);

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const PT_TO_MM = 0.352778;

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function readFileAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function readFileAsText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export function pickFiles(accept: string, multiple = false, directory = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    if (directory) input.setAttribute('webkitdirectory', '');
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}

/** Downscale an image (file or data URL) to keep the local database small. */
export async function resizeImage(src: Blob | string, maxSize = 900, quality = 0.9): Promise<string> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read image'));
      i.src = url;
    });
    const ratio = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * ratio);
    const h = Math.round(img.naturalHeight * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    const isPng = typeof src === 'string' ? src.startsWith('data:image/png') : src.type === 'image/png';
    return isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
  } finally {
    if (typeof src !== 'string') URL.revokeObjectURL(url);
  }
}

export const baseName = (filename: string) => filename.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');

export const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));
