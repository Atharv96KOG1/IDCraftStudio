import Dexie, { type Table } from 'dexie';
import type { Person, Template } from './types';
import { MODERN_TEMPLATES, SEED_TEMPLATES } from './templates';

interface Meta {
  key: string;
  value: unknown;
}

export interface StoredFont {
  id?: number;
  family: string;
  data: ArrayBuffer;
  fileName: string;
  addedAt: number;
}

class IDCraftDB extends Dexie {
  templates!: Table<Template, string>;
  people!: Table<Person, number>;
  meta!: Table<Meta, string>;
  fonts!: Table<StoredFont, number>;

  constructor() {
    super('idcraft-studio');
    this.version(1).stores({
      templates: 'id, name, updatedAt',
      people: '++id, templateId, serial, createdAt',
      meta: 'key',
    });
    this.version(2).stores({ fonts: '++id, family' });
  }
}

export const db = new IDCraftDB();

/** Reserve `count` consecutive serial numbers and return the first one. */
export async function reserveSerials(count: number): Promise<number> {
  return db.transaction('rw', db.meta, async () => {
    const cur = ((await db.meta.get('nextSerial'))?.value as number | undefined) ?? 1;
    await db.meta.put({ key: 'nextSerial', value: cur + count });
    return cur;
  });
}

let seeding: Promise<void> | null = null;

/** Adds the starter templates on first run. Safe to call more than once. */
export function seedIfEmpty(): Promise<void> {
  seeding ??= db.transaction('rw', db.templates, db.meta, async () => {
    if (!(await db.meta.get('seeded'))) {
      if ((await db.templates.count()) === 0) await db.templates.bulkPut(SEED_TEMPLATES());
      await db.meta.put({ key: 'seeded', value: true });
    }
    // v1.2: modern designs, added once (also for existing installs).
    if (!(await db.meta.get('seededModern'))) {
      await db.templates.bulkPut(MODERN_TEMPLATES());
      await db.meta.put({ key: 'seededModern', value: true });
    }
  });
  return seeding;
}

export interface Backup {
  app: 'IDCraft Studio';
  version: 1;
  exportedAt: string;
  templates: Template[];
  people: Person[];
  nextSerial: number;
  fonts?: { family: string; fileName: string; data: string }[];
}

const toBase64 = (buf: ArrayBuffer) => {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'IDCraft Studio',
    version: 1,
    exportedAt: new Date().toISOString(),
    templates: await db.templates.toArray(),
    people: await db.people.toArray(),
    nextSerial: ((await db.meta.get('nextSerial'))?.value as number | undefined) ?? 1,
    fonts: (await db.fonts.toArray()).map((f) => ({ family: f.family, fileName: f.fileName, data: toBase64(f.data) })),
  };
}

export async function restoreBackup(b: Backup) {
  if (b?.app !== 'IDCraft Studio' || !Array.isArray(b.templates) || !Array.isArray(b.people)) {
    throw new Error('This file is not an IDCraft Studio backup.');
  }
  await db.transaction('rw', [db.templates, db.people, db.meta, db.fonts], async () => {
    await db.templates.clear();
    await db.people.clear();
    await db.templates.bulkPut(b.templates);
    await db.people.bulkPut(b.people);
    if (b.fonts?.length) {
      await db.fonts.clear();
      await db.fonts.bulkAdd(b.fonts.map((f) => ({ family: f.family, fileName: f.fileName, data: fromBase64(f.data), addedAt: Date.now() })));
    }
    await db.meta.put({ key: 'nextSerial', value: b.nextSerial ?? 1 });
  });
}
