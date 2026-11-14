import type { Person } from './types';
import { baseName } from './utils';

const IMG = /\.(jpe?g|png|webp|bmp|gif|heic|tiff?)$/i;
export const isImageFile = (f: File) => f.type.startsWith('image/') || IMG.test(f.name);

/** Keys a file name / cell value can match on: exact name, and the number in it without leading zeros. */
function keys(raw: string): string[] {
  const exact = baseName(raw.trim()).trim().toLowerCase();
  if (!exact) return [];
  const out = [exact, exact.replace(/[\s_-]+/g, '')];
  const digits = exact.match(/\d+/g);
  if (digits) out.push(`#${String(Number(digits[digits.length - 1]))}`);
  return out;
}

/** Field that holds photo file names (or the best ID-like field). */
export function guessPhotoField(fields: string[], people: Person[]): string {
  return (
    fields.find((f) => people.some((p) => IMG.test(p.fields[f] ?? ''))) ??
    fields.find((f) => /photo|image|pic|फोटो/i.test(f)) ??
    fields.find((f) => /id|roll|code|no|number|क्रमांक/i.test(f)) ??
    fields[0] ??
    'Serial'
  );
}

/**
 * Matches image files to records by the key field. Exact file names win
 * (DSC0001.JPG ↔ "DSC0001.jpg" or "dsc0001"); otherwise the number in the
 * name is used ("001.jpg" ↔ "1", "DSC07959.JPG" ↔ "7959").
 */
export function matchPhotos(people: Person[], files: File[], key: string) {
  const exact = new Map<string, Person[]>();
  const byNumber = new Map<string, Person[]>();
  const add = (m: Map<string, Person[]>, k: string, p: Person) => m.set(k, [...(m.get(k) ?? []), p]);
  for (const p of people) {
    const raw = key === 'Serial' ? String(p.serial) : p.fields[key] ?? '';
    for (const k of keys(raw)) add(k.startsWith('#') ? byNumber : exact, k, p);
  }
  const images = files.filter(isImageFile);
  const matches = images.map((file) => {
    const ks = keys(file.name);
    const hit = ks.filter((k) => !k.startsWith('#')).map((k) => exact.get(k)).find(Boolean) ?? ks.filter((k) => k.startsWith('#')).map((k) => byNumber.get(k)).find(Boolean);
    return { file, people: hit ?? [] };
  });
  return { images, matched: matches.filter((m) => m.people.length), unmatched: matches.filter((m) => !m.people.length) };
}
