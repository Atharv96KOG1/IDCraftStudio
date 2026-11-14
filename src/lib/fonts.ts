import { create } from 'zustand';
import catalogJson from './fontCatalog.json';
import { db } from './db';

export type FontCategory = 'sans' | 'serif' | 'display' | 'script' | 'mono' | 'marathi';

export interface CatalogFont {
  family: string;
  categories: FontCategory[];
  devanagari: boolean;
  bold: boolean;
  italic: boolean;
}

/** Fonts bundled with the app (open licence, work offline). */
export const CATALOG = catalogJson as CatalogFont[];
const catalogSet = new Set(CATALOG.map((f) => f.family));

/** Fonts that ship with Windows 10/11. Only the ones actually installed are shown. */
const WINDOWS_FONTS = [
  'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Cambria', 'Candara', 'Comic Sans MS', 'Consolas', 'Constantia',
  'Corbel', 'Courier New', 'Franklin Gothic Medium', 'Gabriola', 'Georgia', 'Impact', 'Ink Free', 'Lucida Console',
  'Lucida Sans Unicode', 'Microsoft Sans Serif', 'Palatino Linotype', 'Segoe Print', 'Segoe Script', 'Segoe UI',
  'Sitka Text', 'Sylfaen', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Book Antiqua', 'Century Gothic',
  'Garamond', 'Bookman Old Style', 'Copperplate Gothic Bold', 'Lucida Handwriting', 'Monotype Corsiva',
  // Devanagari fonts that come with Windows
  'Nirmala UI', 'Mangal', 'Aparajita', 'Kokila', 'Utsaah', 'Sanskrit Text',
];
/** Windows fonts that can display Marathi. */
export const WINDOWS_DEVANAGARI = ['Nirmala UI', 'Mangal', 'Aparajita', 'Kokila', 'Utsaah', 'Sanskrit Text'];

let cssLoaded = false;
export function loadBundledFontCss() {
  if (cssLoaded) return;
  cssLoaded = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './fonts/fonts.css';
  document.head.appendChild(link);
}

/** Make sure a font (and the glyphs for `text`) is loaded before drawing on canvas. */
export async function ensureFont(family: string, bold: boolean, italic: boolean, text: string) {
  const spec = `${italic ? 'italic ' : ''}${bold ? 700 : 400} 32px "${family}"`;
  try {
    await document.fonts.load(spec, text || 'Aa');
  } catch {
    /* unknown font: canvas falls back */
  }
}

/** True when the font is installed (measures text against generic fallbacks). */
function isInstalled(family: string): boolean {
  const ctx = document.createElement('canvas').getContext('2d')!;
  const sample = 'mmmmmmmmmmlli WWW 0123 मराठी';
  return ['monospace', 'serif', 'sans-serif'].some((generic) => {
    ctx.font = `40px ${generic}`;
    const base = ctx.measureText(sample).width;
    ctx.font = `40px "${family}", ${generic}`;
    return ctx.measureText(sample).width !== base;
  });
}

const FAV_KEY = 'favouriteFonts';
const RECENT_KEY = 'recentFonts';
const SYS_KEY = 'pcFonts';

function readList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function writeList(key: string, v: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

interface FontState {
  /** Fonts found on this computer. */
  pcFonts: string[];
  /** Fonts the user added from .ttf/.otf files. */
  customFonts: { id: number; family: string }[];
  favourites: string[];
  recent: string[];
  init: () => Promise<void>;
  scanPcFonts: () => Promise<number>;
  addFontFiles: (files: File[]) => Promise<string[]>;
  removeCustomFont: (id: number) => Promise<void>;
  toggleFavourite: (family: string) => void;
  markUsed: (family: string) => void;
}

export const useFonts = create<FontState>((set, get) => ({
  pcFonts: [],
  customFonts: [],
  favourites: readList(FAV_KEY),
  recent: readList(RECENT_KEY),

  init: async () => {
    loadBundledFontCss();
    const known = readList(SYS_KEY);
    const pc = [...new Set([...WINDOWS_FONTS.filter(isInstalled), ...known])].filter((f) => !catalogSet.has(f));
    const custom = await db.fonts.toArray();
    for (const f of custom) await registerFontFace(f.family, f.data);
    set({
      pcFonts: pc.sort((a, b) => a.localeCompare(b)),
      customFonts: custom.map((f) => ({ id: f.id!, family: f.family })),
    });
  },

  /** Reads every font installed on the PC (Local Font Access API). */
  scanPcFonts: async () => {
    const q = (window as unknown as { queryLocalFonts?: () => Promise<{ family: string }[]> }).queryLocalFonts;
    if (!q) throw new Error('This computer does not allow reading the installed font list.');
    const list = await q();
    const families = [...new Set(list.map((f) => f.family))].filter((f) => !catalogSet.has(f) && !f.startsWith('.'));
    writeList(SYS_KEY, families);
    const merged = [...new Set([...get().pcFonts, ...families])].sort((a, b) => a.localeCompare(b));
    set({ pcFonts: merged });
    return merged.length;
  },

  addFontFiles: async (files) => {
    const added: string[] = [];
    for (const file of files) {
      const data = await file.arrayBuffer();
      const family = (await readFontFamilyName(data)) ?? file.name.replace(/\.[^.]+$/, '');
      await registerFontFace(family, data);
      const existing = await db.fonts.where('family').equals(family).first();
      if (existing) await db.fonts.update(existing.id!, { data, fileName: file.name });
      else await db.fonts.add({ family, data, fileName: file.name, addedAt: Date.now() });
      added.push(family);
    }
    const custom = await db.fonts.toArray();
    set({ customFonts: custom.map((f) => ({ id: f.id!, family: f.family })) });
    return added;
  },

  removeCustomFont: async (id) => {
    await db.fonts.delete(id);
    set({ customFonts: get().customFonts.filter((f) => f.id !== id) });
  },

  toggleFavourite: (family) => {
    const favs = get().favourites.includes(family) ? get().favourites.filter((f) => f !== family) : [...get().favourites, family];
    writeList(FAV_KEY, favs);
    set({ favourites: favs });
  },

  markUsed: (family) => {
    const recent = [family, ...get().recent.filter((f) => f !== family)].slice(0, 8);
    writeList(RECENT_KEY, recent);
    set({ recent });
  },
}));

async function registerFontFace(family: string, data: ArrayBuffer) {
  try {
    const face = new FontFace(family, data);
    await face.load();
    document.fonts.add(face);
  } catch {
    /* invalid font file */
  }
}

/** Reads the font family name from a TTF/OTF "name" table. */
async function readFontFamilyName(buf: ArrayBuffer): Promise<string | null> {
  try {
    const v = new DataView(buf);
    const numTables = v.getUint16(4);
    for (let i = 0; i < numTables; i++) {
      const rec = 12 + i * 16;
      const tag = String.fromCharCode(v.getUint8(rec), v.getUint8(rec + 1), v.getUint8(rec + 2), v.getUint8(rec + 3));
      if (tag !== 'name') continue;
      const off = v.getUint32(rec + 8);
      const count = v.getUint16(off + 2);
      const strOff = off + v.getUint16(off + 4);
      let best: string | null = null;
      for (let j = 0; j < count; j++) {
        const r = off + 6 + j * 12;
        const platform = v.getUint16(r);
        const nameId = v.getUint16(r + 6);
        const len = v.getUint16(r + 8);
        const start = strOff + v.getUint16(r + 10);
        if (nameId !== 16 && nameId !== 1) continue;
        let s = '';
        if (platform === 3 || platform === 0) {
          for (let k = 0; k < len; k += 2) s += String.fromCharCode(v.getUint16(start + k));
        } else {
          for (let k = 0; k < len; k++) s += String.fromCharCode(v.getUint8(start + k));
        }
        if (nameId === 16) return s; // typographic family wins
        best ??= s;
      }
      return best;
    }
  } catch {
    /* not a TTF/OTF (e.g. WOFF2) */
  }
  return null;
}

export const isDevanagariFont = (family: string) =>
  CATALOG.some((f) => f.family === family && f.devanagari) || WINDOWS_DEVANAGARI.includes(family);

export const hasDevanagari = (text: string) => /[ऀ-ॿ]/.test(text);
