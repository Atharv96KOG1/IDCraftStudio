import { useEffect, useMemo, useRef, useState } from 'react';
import { CATALOG, WINDOWS_DEVANAGARI, useFonts, type FontCategory } from '../lib/fonts';
import { pickFiles } from '../lib/utils';
import { toast } from './ui';

type Tab = 'all' | 'fav' | FontCategory | 'pc' | 'mine';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fav', label: '★ Favourites' },
  { id: 'marathi', label: 'मराठी' },
  { id: 'sans', label: 'Simple' },
  { id: 'serif', label: 'Serif' },
  { id: 'display', label: 'Bold / Display' },
  { id: 'script', label: 'Stylish / Script' },
  { id: 'mono', label: 'Mono' },
  { id: 'pc', label: 'This PC' },
  { id: 'mine', label: 'My fonts' },
];

interface Row {
  family: string;
  devanagari: boolean;
  source: 'app' | 'pc' | 'mine';
}

export function FontPicker({ value, onChange, text }: { value: string; onChange: (f: string) => void; text: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const marathiText = /[ऀ-ॿ]/.test(text);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="font-picker" ref={wrap}>
      <button type="button" className="font-current" onClick={() => setOpen(!open)} style={{ fontFamily: `"${value}"` }}>
        <span>{value}</span>
        <span className="caret">▾</span>
      </button>
      {open && (
        <FontPanel
          value={value}
          initialTab={marathiText ? 'marathi' : 'all'}
          sample={text}
          onPick={(f) => {
            onChange(f);
            useFonts.getState().markUsed(f);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function FontPanel({ value, initialTab, sample, onPick }: { value: string; initialTab: Tab; sample: string; onPick: (f: string) => void }) {
  const { pcFonts, customFonts, favourites, recent, toggleFavourite, scanPcFonts, addFontFiles, removeCustomFont } = useFonts();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => search.current?.focus(), []);

  const all: Row[] = useMemo(
    () => [
      ...customFonts.map((f) => ({ family: f.family, devanagari: false, source: 'mine' as const })),
      ...CATALOG.map((f) => ({ family: f.family, devanagari: f.devanagari, source: 'app' as const })),
      ...pcFonts.map((f) => ({ family: f, devanagari: WINDOWS_DEVANAGARI.includes(f), source: 'pc' as const })),
    ],
    [customFonts, pcFonts],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list: Row[];
    switch (tab) {
      case 'all':
        list = all;
        break;
      case 'fav':
        list = all.filter((r) => favourites.includes(r.family));
        break;
      case 'pc':
        list = all.filter((r) => r.source === 'pc');
        break;
      case 'mine':
        list = all.filter((r) => r.source === 'mine');
        break;
      case 'marathi':
        list = all.filter((r) => r.devanagari);
        break;
      default:
        list = all.filter((r) => r.source === 'app' && CATALOG.find((c) => c.family === r.family)?.categories.includes(tab));
    }
    if (q) list = list.filter((r) => r.family.toLowerCase().includes(q));
    const seen = new Set<string>();
    return list.filter((r) => !seen.has(r.family) && seen.add(r.family));
  }, [all, tab, query, favourites]);

  const recentRows = tab === 'all' && !query ? recent.filter((f) => all.some((r) => r.family === f)) : [];
  const preview = (r: Row) => {
    if (sample.trim() && sample.length <= 40 && !sample.includes('{{')) return sample;
    return r.devanagari ? 'नमस्कार मराठी · Aa' : 'The quick brown fox';
  };

  const scan = async () => {
    setScanning(true);
    try {
      const n = await scanPcFonts();
      toast(`Found ${n} fonts on this PC.`);
      setTab('pc');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setScanning(false);
    }
  };

  const addFiles = async () => {
    const files = await pickFiles('.ttf,.otf,.woff,.woff2', true);
    if (!files.length) return;
    const added = await addFontFiles(files);
    toast(`Added ${added.length} font${added.length === 1 ? '' : 's'}: ${added.slice(0, 3).join(', ')}${added.length > 3 ? '…' : ''}`);
    setTab('mine');
  };

  const row = (r: Row, key: string) => (
    <div key={key} className={`font-row${r.family === value ? ' sel' : ''}`} onClick={() => onPick(r.family)}>
      <div className="font-info">
        <span className="font-name">
          {r.family}
          {r.devanagari && <span className="tag">मराठी</span>}
          {r.source === 'pc' && <span className="tag pc">PC</span>}
          {r.source === 'mine' && <span className="tag mine">Mine</span>}
        </span>
        <span className="font-sample" style={{ fontFamily: `"${r.family}"` }}>
          {preview(r)}
        </span>
      </div>
      {r.source === 'mine' && (
        <button
          className="star"
          title="Remove this font"
          onClick={(e) => {
            e.stopPropagation();
            const f = customFonts.find((c) => c.family === r.family);
            if (f && confirm(`Remove font “${r.family}”?`)) removeCustomFont(f.id);
          }}
        >
          🗑
        </button>
      )}
      <button
        className={`star${favourites.includes(r.family) ? ' on' : ''}`}
        title={favourites.includes(r.family) ? 'Remove from favourites' : 'Add to favourites'}
        onClick={(e) => {
          e.stopPropagation();
          toggleFavourite(r.family);
        }}
      >
        {favourites.includes(r.family) ? '★' : '☆'}
      </button>
    </div>
  );

  return (
    <div className="font-panel">
      <input ref={search} className="font-search" placeholder={`Search ${all.length} fonts…`} value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="font-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="font-list">
        {recentRows.length > 0 && (
          <>
            <div className="font-group">Recently used</div>
            {recentRows.map((f) => row(all.find((r) => r.family === f)!, `recent-${f}`))}
            <div className="font-group">All fonts</div>
          </>
        )}
        {rows.map((r) => row(r, `${r.source}-${r.family}`))}
        {!rows.length && (
          <p className="hint pad">
            {tab === 'fav'
              ? 'Click ☆ next to any font to add it here.'
              : tab === 'pc'
                ? 'Click “Find fonts on this PC” below.'
                : tab === 'mine'
                  ? 'Add your own .ttf / .otf font files below.'
                  : 'No fonts match your search.'}
          </p>
        )}
      </div>
      <div className="font-actions">
        <button className="btn" onClick={scan} disabled={scanning}>
          {scanning ? 'Searching…' : 'Find fonts on this PC'}
        </button>
        <button className="btn" onClick={addFiles}>
          + Add font file
        </button>
      </div>
    </div>
  );
}
