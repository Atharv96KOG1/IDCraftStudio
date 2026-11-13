import Dexie, { type Table } from 'dexie';
import type { Person, Template } from './types';
import { SEED_TEMPLATES } from './templates';

interface Meta {
  key: string;
  value: unknown;
}

class IDCraftDB extends Dexie {
  templates!: Table<Template, string>;
  people!: Table<Person, number>;
  meta!: Table<Meta, string>;

  constructor() {
    super('idcraft-studio');
    this.version(1).stores({
      templates: 'id, name, updatedAt',
      people: '++id, templateId, serial, createdAt',
      meta: 'key',
    });
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
    if (await db.meta.get('seeded')) return;
    if ((await db.templates.count()) === 0) await db.templates.bulkPut(SEED_TEMPLATES());
    await db.meta.put({ key: 'seeded', value: true });
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
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'IDCraft Studio',
    version: 1,
    exportedAt: new Date().toISOString(),
    templates: await db.templates.toArray(),
    people: await db.people.toArray(),
    nextSerial: ((await db.meta.get('nextSerial'))?.value as number | undefined) ?? 1,
  };
}

export async function restoreBackup(b: Backup) {
  if (b?.app !== 'IDCraft Studio' || !Array.isArray(b.templates) || !Array.isArray(b.people)) {
    throw new Error('This file is not an IDCraft Studio backup.');
  }
  await db.transaction('rw', db.templates, db.people, db.meta, async () => {
    await db.templates.clear();
    await db.people.clear();
    await db.templates.bulkPut(b.templates);
    await db.people.bulkPut(b.people);
    await db.meta.put({ key: 'nextSerial', value: b.nextSerial ?? 1 });
  });
}
