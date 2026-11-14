import { useMemo, useState } from 'react';
import type { Person, Template } from '../lib/types';
import { buildPages, computeGrid, pagesToPdf, printPages, type Paper, type PrintOptions, type SidesMode } from '../lib/print';
import { db } from '../lib/db';
import { downloadBlob } from '../lib/utils';
import { safeFileName } from '../lib/utils';
import { Field, Modal, NumberInput, Toggle, toast } from './ui';

const saved = (): Partial<PrintOptions> => {
  try {
    return JSON.parse(localStorage.getItem('printOptions') ?? '{}');
  } catch {
    return {};
  }
};

export function PrintDialog({ tpl, people, onClose }: { tpl: Template; people: Person[]; onClose: () => void }) {
  const [o, setO] = useState<PrintOptions>(() => ({
    paper: 'A4',
    sides: tpl.hasBack ? 'both' : 'front',
    marginMm: 10,
    gapMm: 4,
    cutMarks: true,
    dpi: 300,
    ...saved(),
  }));
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [markPrinted, setMarkPrinted] = useState(true);
  const set = (p: Partial<PrintOptions>) => {
    const next = { ...o, ...p };
    setO(next);
    localStorage.setItem('printOptions', JSON.stringify(next));
  };
  const sides: SidesMode = tpl.hasBack ? o.sides : 'front';
  const grid = useMemo(() => computeGrid(tpl, o), [tpl, o]);
  const perPage = grid.cols * grid.rows;
  const sheets = perPage ? Math.ceil(people.length / perPage) * (sides === 'both' ? 2 : 1) : 0;

  const run = async (mode: 'pdf' | 'print') => {
    try {
      setProgress({ done: 0, total: 1 });
      const pages = await buildPages(tpl, people, { ...o, sides }, (done, total) => setProgress({ done, total }));
      if (mode === 'pdf') {
        downloadBlob(pagesToPdf(pages), `${safeFileName(tpl.name)} - ${people.length} cards.pdf`);
      } else {
        await printPages(pages);
      }
      // The system print dialog can be cancelled, so ask before counting the cards as printed.
      const confirmed = mode === 'pdf' || confirm(`Did the ${people.length} card(s) print correctly?\n\nOK = mark them as printed.`);
      if (markPrinted && confirmed) {
        const now = Date.now();
        await db.transaction('rw', db.people, async () => {
          for (const p of people) {
            const cur = await db.people.get(p.id!);
            if (cur) await db.people.update(p.id!, { printCount: cur.printCount + 1, printedAt: now });
          }
        });
      }
      toast(mode === 'pdf' ? 'PDF saved.' : 'Sent to printer.');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
      setProgress(null);
    }
  };

  return (
    <Modal
      title={`Print ${people.length} card${people.length === 1 ? '' : 's'}`}
      onClose={() => !progress && onClose()}
      width={600}
      footer={
        progress ? (
          <div className="progress">
            <div className="progress-bar" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            <span>
              Rendering {progress.done} / {progress.total}…
            </span>
          </div>
        ) : (
          <>
            <span className="grow" />
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn" onClick={() => run('pdf')} disabled={!perPage}>
              Save PDF
            </button>
            <button className="btn primary" onClick={() => run('print')} disabled={!perPage}>
              Print…
            </button>
          </>
        )
      }
    >
      <div className="grid2">
        <Field label="Paper">
          <select value={o.paper} onChange={(e) => set({ paper: e.target.value as Paper })}>
            <option value="A4">A4 sheet</option>
            <option value="Letter">Letter sheet</option>
            <option value="Card">Card printer (one card per page)</option>
          </select>
        </Field>
        <Field label="Sides">
          <select value={sides} onChange={(e) => set({ sides: e.target.value as SidesMode })} disabled={!tpl.hasBack}>
            <option value="front">Front only</option>
            {tpl.hasBack && <option value="back">Back only</option>}
            {tpl.hasBack && <option value="both">Front + back (duplex)</option>}
          </select>
        </Field>
        {o.paper !== 'Card' && (
          <>
            <Field label="Page margin (mm)">
              <NumberInput value={o.marginMm} min={0} step={1} onChange={(marginMm) => set({ marginMm })} />
            </Field>
            <Field label="Gap between cards (mm)">
              <NumberInput value={o.gapMm} min={0} step={1} onChange={(gapMm) => set({ gapMm })} />
            </Field>
          </>
        )}
        <Field label="Quality">
          <select value={o.dpi} onChange={(e) => set({ dpi: Number(e.target.value) })}>
            <option value={200}>Draft (200 dpi)</option>
            <option value={300}>Standard (300 dpi)</option>
            <option value={600}>High (600 dpi)</option>
          </select>
        </Field>
      </div>
      {o.paper !== 'Card' && <Toggle label="Cut marks" checked={o.cutMarks} onChange={(cutMarks) => set({ cutMarks })} />}
      <Toggle label="Mark these records as printed" checked={markPrinted} onChange={setMarkPrinted} />

      <div className="print-summary">
        {perPage ? (
          <>
            <SheetPreview tpl={tpl} grid={grid} gap={o.gapMm} />
            <p>
              {o.paper === 'Card' ? (
                <>One card per page · {sheets} pages</>
              ) : (
                <>
                  {grid.cols} × {grid.rows} = <b>{perPage}</b> cards per sheet ({grid.pageW > grid.pageH ? 'landscape' : 'portrait'}) ·{' '}
                  <b>{sheets}</b> sheet{sheets === 1 ? '' : 's'}
                </>
              )}
            </p>
            {sides === 'both' && o.paper !== 'Card' && (
              <p className="hint">Back sheets are mirrored so they line up when you flip the paper on its long edge.</p>
            )}
          </>
        ) : (
          <p className="error">The card does not fit on this paper. Reduce the margin or gap.</p>
        )}
      </div>
    </Modal>
  );
}

function SheetPreview({ tpl, grid, gap }: { tpl: Template; grid: ReturnType<typeof computeGrid>; gap: number }) {
  const scale = 150 / Math.max(grid.pageW, grid.pageH);
  return (
    <div className="sheet" style={{ width: grid.pageW * scale, height: grid.pageH * scale }}>
      {Array.from({ length: grid.cols * grid.rows }, (_, i) => (
        <div
          key={i}
          style={{
            left: (grid.originX + (i % grid.cols) * (tpl.widthMm + gap)) * scale,
            top: (grid.originY + Math.floor(i / grid.cols) * (tpl.heightMm + gap)) * scale,
            width: tpl.widthMm * scale,
            height: tpl.heightMm * scale,
          }}
        />
      ))}
    </div>
  );
}
