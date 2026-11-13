import * as XLSX from 'xlsx';
import type { Person, Template } from './types';
import { downloadBlob } from './utils';

export interface ParsedSheet {
  columns: string[];
  rows: Record<string, string>[];
}

export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error('The file has no sheets.');
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false, dateNF: 'dd-mmm-yyyy' });
  const columns: string[] = [];
  for (const row of raw) for (const k of Object.keys(row)) if (!columns.includes(k) && !k.startsWith('__EMPTY')) columns.push(k);
  const rows = raw
    .map((r) => Object.fromEntries(columns.map((c) => [c, String(r[c] ?? '').trim()])))
    .filter((r) => Object.values(r).some((v) => v !== ''));
  return { columns, rows };
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
    `${tpl.name.replace(/[^\w\- ]+/g, '')} records.xlsx`,
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
    `${tpl.name.replace(/[^\w\- ]+/g, '')} import sheet.xlsx`,
  );
}
