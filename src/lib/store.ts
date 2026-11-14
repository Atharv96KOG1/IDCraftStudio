import { create } from 'zustand';
import type { CardElement, ElementType, SideKey, Template } from './types';
import { db } from './db';
import { makeCentered } from './elements';
import { clone, uid } from './utils';

interface TemplateInfo {
  id: string;
  name: string;
}

interface State {
  templates: TemplateInfo[];
  template: Template | null;
  side: SideKey;
  selectedId: string | null;
  previewPersonId: number | null;
  zoom: number;
  past: Template[];
  future: Template[];
  lastKey: string | null;
  lastTime: number;
  saveState: 'saved' | 'dirty' | 'saving';
  clipboard: CardElement | null;

  refreshTemplates: () => Promise<void>;
  openTemplate: (id: string) => Promise<void>;
  addTemplate: (t: Template) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  saveNow: () => Promise<void>;

  /** Apply a change to the open template. Changes with the same `key` within 0.8s merge into one undo step. */
  mutate: (fn: (t: Template) => void, key?: string) => void;
  updateElement: (id: string, patch: Partial<CardElement>, key?: string) => void;
  addElement: (type: ElementType, patch?: Partial<CardElement>) => void;
  deleteElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  moveLayer: (id: string, dir: 'up' | 'down' | 'top' | 'bottom') => void;
  copy: () => void;
  paste: () => void;
  undo: () => void;
  redo: () => void;

  setSide: (s: SideKey) => void;
  select: (id: string | null) => void;
  setPreviewPerson: (id: number | null) => void;
  setZoom: (z: number) => void;
}

export const useStore = create<State>((set, get) => ({
  templates: [],
  template: null,
  side: 'front',
  selectedId: null,
  previewPersonId: null,
  zoom: 1,
  past: [],
  future: [],
  lastKey: null,
  lastTime: 0,
  saveState: 'saved',
  clipboard: null,

  refreshTemplates: async () => {
    const all = await db.templates.orderBy('name').toArray();
    set({ templates: all.map((t) => ({ id: t.id, name: t.name })) });
  },

  openTemplate: async (id) => {
    await get().saveNow();
    const t = await db.templates.get(id);
    if (!t) return;
    set({
      template: t,
      side: 'front',
      selectedId: null,
      previewPersonId: null,
      past: [],
      future: [],
      saveState: 'saved',
    });
    localStorage.setItem('lastTemplate', id);
  },

  addTemplate: async (t) => {
    await get().saveNow();
    await db.templates.put(t);
    await get().refreshTemplates();
    await get().openTemplate(t.id);
  },

  deleteTemplate: async (id) => {
    // Stop any pending autosave from writing the template back.
    if (get().template?.id === id) set({ template: null, saveState: 'saved' });
    await db.transaction('rw', db.templates, db.people, async () => {
      await db.templates.delete(id);
      await db.people.where('templateId').equals(id).delete();
    });
    set({ saveState: 'saved' });
    await get().refreshTemplates();
    const first = get().templates[0];
    if (first) await get().openTemplate(first.id);
    else set({ template: null });
  },

  saveNow: async () => {
    const t = get().template;
    if (!t || get().saveState === 'saved') return;
    set({ saveState: 'saving' });
    await db.templates.put(t);
    if (get().template === t) set({ saveState: 'saved' });
    const info = get().templates.find((x) => x.id === t.id);
    if (!info || info.name !== t.name) await get().refreshTemplates();
  },

  mutate: (fn, key) => {
    const t = get().template;
    if (!t) return;
    const now = Date.now();
    const merge = !!key && key === get().lastKey && now - get().lastTime < 800;
    const next = clone(t);
    fn(next);
    next.updatedAt = now;
    set({
      template: next,
      past: merge ? get().past : [...get().past.slice(-99), t],
      future: [],
      lastKey: key ?? null,
      lastTime: now,
      saveState: 'dirty',
    });
  },

  updateElement: (id, patch, key) =>
    get().mutate((t) => {
      const list = t[get().side].elements;
      const i = list.findIndex((e) => e.id === id);
      if (i >= 0) list[i] = { ...list[i], ...patch } as CardElement;
    }, key ? `${id}:${key}` : undefined),

  addElement: (type, patch) => {
    const t = get().template;
    if (!t) return;
    const el = { ...makeCentered(type, t), ...patch } as CardElement;
    if (patch && ('w' in patch || 'h' in patch) && !('x' in patch)) {
      el.x = Math.round(((t.widthMm - el.w) / 2) * 10) / 10;
      el.y = Math.round(((t.heightMm - el.h) / 2) * 10) / 10;
    }
    const existing = t[get().side].elements.filter((e) => e.type === type).length;
    if (existing) el.name = `${el.name} ${existing + 1}`;
    get().mutate((d) => d[get().side].elements.push(el));
    set({ selectedId: el.id });
  },

  deleteElement: (id) => {
    get().mutate((t) => {
      const side = t[get().side];
      side.elements = side.elements.filter((e) => e.id !== id);
    });
    if (get().selectedId === id) set({ selectedId: null });
  },

  duplicateElement: (id) => {
    const t = get().template;
    const src = t?.[get().side].elements.find((e) => e.id === id);
    if (!src) return;
    const copy = { ...clone(src), id: uid(), name: `${src.name} copy`, x: src.x + 2, y: src.y + 2, locked: false };
    get().mutate((d) => {
      const list = d[get().side].elements;
      list.splice(list.findIndex((e) => e.id === id) + 1, 0, copy);
    });
    set({ selectedId: copy.id });
  },

  moveLayer: (id, dir) =>
    get().mutate((t) => {
      const list = t[get().side].elements;
      const i = list.findIndex((e) => e.id === id);
      if (i < 0) return;
      const [el] = list.splice(i, 1);
      const to =
        dir === 'top' ? list.length : dir === 'bottom' ? 0 : dir === 'up' ? Math.min(list.length, i + 1) : Math.max(0, i - 1);
      list.splice(to, 0, el);
    }),

  copy: () => {
    const { template, side, selectedId } = get();
    const el = template?.[side].elements.find((e) => e.id === selectedId);
    if (el) set({ clipboard: clone(el) });
  },

  paste: () => {
    const c = get().clipboard;
    if (!c) return;
    const el = { ...clone(c), id: uid(), x: c.x + 2, y: c.y + 2, locked: false };
    get().mutate((t) => t[get().side].elements.push(el));
    set({ selectedId: el.id, clipboard: el });
  },

  undo: () => {
    const { past, template, future } = get();
    if (!past.length || !template) return;
    set({ template: past[past.length - 1], past: past.slice(0, -1), future: [template, ...future], saveState: 'dirty', lastKey: null });
  },

  redo: () => {
    const { past, template, future } = get();
    if (!future.length || !template) return;
    set({ template: future[0], future: future.slice(1), past: [...past, template], saveState: 'dirty', lastKey: null });
  },

  setSide: (side) => set({ side, selectedId: null }),
  select: (selectedId) => set({ selectedId }),
  setPreviewPerson: (previewPersonId) => set({ previewPersonId }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),
}));

export const selectedElement = (s: State): CardElement | undefined =>
  s.template?.[s.side].elements.find((e) => e.id === s.selectedId);
