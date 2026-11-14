/**
 * Saving files to the computer. In the desktop app files go into
 * Documents\IDCraft Studio\<folder> (or the folder the user picked) and the
 * folder is opened at the end. In a plain browser they are downloaded.
 */
import { bridge } from './license';
import { downloadBlob, safeFileName } from './utils';

export const canSaveToDisk = () => !!bridge?.files;

/** Saves one file. Returns the full path on the desktop app, or null when it was downloaded. */
export async function saveFile(folder: string, name: string, data: Blob): Promise<string | null> {
  const fsApi = bridge?.files;
  if (!fsApi) {
    downloadBlob(data, safeFileName(name));
    return null;
  }
  return fsApi.save(folder, safeFileName(name), new Uint8Array(await data.arrayBuffer()));
}

/** Opens the folder in Explorer / Finder. */
export async function openFolder(folder: string) {
  await bridge?.files?.openFolder(folder);
}

/** Selects a saved file in Explorer / Finder. */
export async function revealFile(path: string | null) {
  if (path) await bridge?.files?.reveal(path);
}

export const dateStamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}`;
};

// ---------- DPI metadata, so other programs print the image at its real size ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Canvas → PNG/JPEG blob with the DPI written into the file. */
export async function canvasToBlob(canvas: HTMLCanvasElement, type: 'png' | 'jpg', dpi: number): Promise<Blob> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image too large to save'))), type === 'png' ? 'image/png' : 'image/jpeg', 0.95),
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (type === 'jpg') {
    // JFIF APP0: units = dots per inch, X/Y density.
    if (bytes[2] === 0xff && bytes[3] === 0xe0 && bytes[6] === 0x4a && bytes[7] === 0x46) {
      bytes[13] = 1;
      bytes[14] = (dpi >> 8) & 0xff;
      bytes[15] = dpi & 0xff;
      bytes[16] = (dpi >> 8) & 0xff;
      bytes[17] = dpi & 0xff;
    }
    return new Blob([bytes], { type: 'image/jpeg' });
  }
  // PNG: insert a pHYs chunk (pixels per metre) right after IHDR.
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm);
  dv.setUint32(12, ppm);
  chunk[16] = 1;
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  const ihdrEnd = 8 + 25;
  const out = new Uint8Array(bytes.length + chunk.length);
  out.set(bytes.subarray(0, ihdrEnd));
  out.set(chunk, ihdrEnd);
  out.set(bytes.subarray(ihdrEnd), ihdrEnd + chunk.length);
  return new Blob([out], { type: 'image/png' });
}
