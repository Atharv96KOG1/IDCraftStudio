import * as XLSX from 'xlsx';
import type { Person, Template } from './types';
import { downloadBlob } from './utils';
import { safeFileName } from './utils';
import { findHeaderRow } from './fieldDetect';

export interface ParsedSheet {
  columns: string[];
  rows: Record<string, string>[];
  /** 1-based row number of the header row in the file. */
  headerRow: number;
  sheetName: string;
}

/** Decodes CSV/TXT bytes: UTF-8 (with or without BOM) or UTF-16 as saved by Excel. */
function decodeText(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    return new TextDecoder('windows-1252').decode(b);
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const isText = /\.(csv|txt|tsv)$/i.test(file.name) || file.type.startsWith('text/');
  const wb = isText
    ? XLSX.read(decodeText(buf), { type: 'string', raw: true }) // keep CSV text exactly as typed
    : XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error('The file has no sheets.');
  // Show dates the Indian way (dd/mm/yyyy) instead of the spreadsheet's US format.
  for (const addr of Object.keys(sheet)) {
    const cell = sheet[addr] as XLSX.CellObject;
    if (addr[0] !== '!' && cell?.t === 'd' && cell.v instanceof Date) {
      const d = cell.v;
      cell.w = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
  }
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '', raw: false, blankrows: true }).map((r) =>
    r.map((c) => String(c ?? '').trim()),
  );
  if (!grid.length) return { columns: [], rows: [], headerRow: 1, sheetName: wb.SheetNames[0] };
  const h = findHeaderRow(grid);
  const width = Math.max(...grid.slice(h, h + 50).map((r) => r.length));
  // Column names: trimmed, unique, blank headers named after their position.
  const seen = new Map<string, number>();
  const headers = Array.from({ length: width }, (_, i) => {
    let name = (grid[h][i] ?? '').replace(/\s+/g, ' ').trim();
    if (!name) name = `Column ${i + 1}`;
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return n > 1 ? `${name} ${n}` : name;
  });
  const rows = grid
    .slice(h + 1)
    .map((r) => Object.fromEntries(headers.map((name, i) => [name, r[i] ?? ''])))
    .filter((r) => Object.values(r).some((v) => v !== ''));
  // Drop columns that are blank both in the header and in every row.
  const columns = headers.filter((name, i) => grid[h][i]?.trim() || rows.some((r) => r[name]));
  return { columns, rows, headerRow: h + 1, sheetName: wb.SheetNames[0] };
}

export function exportPeople(tpl: Template, people: Person[]) {
  const extra = new Set<string>();
  people.forEach((p) => Object.keys(p.fields).forEach((k) => !tpl.fields.includes(k) && extra.add(k)));
  const cols = [...tpl.fields, ...extra];
  const data = people.map((p) => ({
    Serial: String(p.serial).padStart(5, '0'),
    ...Object.fromEntries(cols.map((c) => [c, p.fields[c] ?? ''])),
    'Has photo': p.photo ? 'Yes' : 'No',
    'Times printed': p.printCount,
    'Last printed': p.printedAt ? new Date(p.printedAt).toLocaleString() : '',
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Records');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${safeFileName(tpl.name)} records.xlsx`,
  );
}

/** Blank spreadsheet with the template's columns, for users to fill in. */
export function downloadSampleSheet(tpl: Template) {
  const ws = XLSX.utils.aoa_to_sheet([tpl.fields]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Records');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${safeFileName(tpl.name)} import sheet.xlsx`,
  );
}
