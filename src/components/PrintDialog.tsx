import { useMemo, useState } from 'react';
import type { Person, SideKey, Template } from '../lib/types';
import {
  DEFAULT_PRINT,
  PAPERS,
  buildPages,
  computeLayout,
  pageToCanvas,
  pagesToHtml,
  pagesToPdf,
  printPages,
  type DuplexFlip,
  type LayoutMode,
  type MirrorMode,
  type Orientation,
  type Paper,
  type PrintOptions,
  type SidesMode,
} from '../lib/print';
import { renderSideToCanvas } from '../lib/render';
import { db } from '../lib/db';
import { canSaveToDisk, canvasToBlob, dateStamp, openFolder, saveFile } from '../lib/files';
import { nextFrame, safeFileName } from '../lib/utils';
import { Field, Modal, NumberInput, Toggle, toast } from './ui';

const saved = (): Partial<PrintOptions> => {
  try {
    return JSON.parse(localStorage.getItem('printOptions2') ?? '{}');
  } catch {
    return {};
  }
};

type Output = 'print' | 'pdf' | 'jpg' | 'html' | 'cards';

export function PrintDialog({ tpl, people, onClose }: { tpl: Template; people: Person[]; onClose: () => void }) {
  const [o, setO] = useState<PrintOptions>(() => ({ ...DEFAULT_PRINT, sides: tpl.hasBack ? 'both' : 'front', ...saved() }));
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [markPrinted, setMarkPrinted] = useState(true);
  const [cardFormat, setCardFormat] = useState<'png' | 'jpg'>('png');
  const [cardDpi, setCardDpi] = useState(600);
  const [nameField, setNameField] = useState(tpl.fields[0] ?? 'Serial');
  const set = (p: Partial<PrintOptions>) => {
    const next = { ...o, ...p };
    setO(next);
    localStorage.setItem('printOptions2', JSON.stringify(next));
  };
  const sides: SidesMode = tpl.hasBack ? o.sides : 'front';
  const opts = { ...o, sides };
  const layout = useMemo(() => computeLayout(tpl, opts), [tpl, o, sides]); // eslint-disable-line react-hooks/exhaustive-deps
  const perPage = layout.slots.length;
  const sheets = perPage ? Math.ceil(people.length / perPage) * (sides === 'both' ? 2 : 1) : 0;
  const folder = `Output/${safeFileName(tpl.name)} ${dateStamp()}`;

  const markAsPrinted = async () => {
    const now = Date.now();
    await db.transaction('rw', db.people, async () => {
      for (const p of people) {
        const cur = await db.people.get(p.id!);
        if (cur) await db.people.update(p.id!, { printCount: cur.printCount + 1, printedAt: now });
      }
    });
  };

  const finish = async (what: string) => {
    if (canSaveToDisk()) {
      await openFolder(folder);
      toast(`${what} saved in Documents › IDCraft Studio › ${folder.replace('/', ' › ')}`);
    } else toast(`${what} downloaded.`);
  };

  const run = async (mode: Output) => {
    try {
      if (mode === 'cards') return await exportCards();
      setProgress({ done: 0, total: 1, label: 'Rendering' });
      const pages = await buildPages(tpl, people, opts, (done, total) => setProgress({ done, total, label: 'Rendering' }));
      const base = `${safeFileName(tpl.name)} - ${people.length} cards`;
      if (mode === 'pdf') {
        await saveFile(folder, `${base}.pdf`, pagesToPdf(pages));
        await finish('PDF');
      } else if (mode === 'html') {
        await saveFile(folder, `${base}.html`, pagesToHtml(pages));
        await finish('HTML page');
      } else if (mode === 'jpg') {
        for (let i = 0; i < pages.length; i++) {
          setProgress({ done: i, total: pages.length, label: 'Saving sheets' });
          const canvas = await pageToCanvas(pages[i], o.dpi);
          await saveFile(folder, `${base} - sheet ${String(i + 1).padStart(3, '0')}.jpg`, await canvasToBlob(canvas, 'jpg', o.dpi));
          await nextFrame();
        }
        await finish(`${pages.length} JPG sheet(s)`);
      } else {
        await printPages(pages);
      }
      // The system print dialog can be cancelled, so ask before counting the cards as printed.
      const confirmed = mode !== 'print' || confirm(`Did the ${people.length} card(s) print correctly?\n\nOK = mark them as printed.`);
      if (markPrinted && confirmed) await markAsPrinted();
      if (mode === 'print') toast('Sent to printer.');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
      setProgress(null);
    }
  };

  /** Every card side as its own image file at the chosen DPI. */
  const exportCards = async () => {
    const sideList: SideKey[] = sides === 'both' ? ['front', 'back'] : [sides === 'back' ? 'back' : 'front'];
    const total = people.length * sideList.length;
    const used = new Map<string, number>();
    let done = 0;
    const sub = `${folder} - ${cardDpi} dpi`;
    for (const p of people) {
      const raw = nameField === 'Serial' ? String(p.serial).padStart(5, '0') : p.fields[nameField] || String(p.serial).padStart(5, '0');
      let name = safeFileName(raw);
      const n = used.get(name) ?? 0;
      used.set(name, n + 1);
      if (n) name = `${name} (${n + 1})`;
      for (const side of sideList) {
        setProgress({ done, total, label: `Saving ${cardDpi} dpi images` });
        const canvas = await renderSideToCanvas(tpl, side, p, cardDpi);
        const blob = await canvasToBlob(canvas, cardFormat, cardDpi);
        canvas.width = canvas.height = 0; // free memory early (big at 2400 dpi)
        await saveFile(sub, `${name}${sideList.length > 1 ? ` - ${side}` : ''}.${cardFormat}`, blob);
        done++;
        await nextFrame();
      }
    }
    if (canSaveToDisk()) {
      await openFolder(sub);
      toast(`${total} image(s) saved in Documents › IDCraft Studio › ${sub.replace('/', ' › ')}`);
    } else toast(`${total} image(s) downloaded.`);
    onClose();
  };

  const busy = !!progress;
  const pxAt = (dpi: number) => `${Math.round((tpl.widthMm / 25.4) * dpi)} × ${Math.round((tpl.heightMm / 25.4) * dpi)} px`;

  return (
    <Modal
      title={`Print / export ${people.length} card${people.length === 1 ? '' : 's'}`}
      onClose={() => !busy && onClose()}
      width={760}
      footer={
        progress ? (
          <div className="progress">
            <div className="progress-bar" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
            <span>
              {progress.label} {progress.done} / {progress.total}…
            </span>
          </div>
        ) : (
          <>
            <span className="grow" />
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn" onClick={() => run('html')} disabled={!perPage} title="Web page that prints at real size">
              HTML
            </button>
            <button className="btn" onClick={() => run('jpg')} disabled={!perPage} title="Each sheet as a JPG image">
              JPG sheets
            </button>
            <button className="btn" onClick={() => run('pdf')} disabled={!perPage}>
              PDF
            </button>
            <button className="btn primary" onClick={() => run('print')} disabled={!perPage}>
              🖨 Print…
            </button>
          </>
        )
      }
    >
      <div className="print-cols">
        <div>
          <div className="grid2">
            <Field label="Paper">
              <select value={o.paper} onChange={(e) => set({ paper: e.target.value as Paper })}>
                {Object.entries(PAPERS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v[2]}
                  </option>
                ))}
                <option value="Custom">Custom size…</option>
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
            {o.paper === 'Custom' && (
              <>
                <Field label="Paper width (mm)">
                  <NumberInput value={o.customW} min={20} step={1} onChange={(customW) => set({ customW })} />
                </Field>
                <Field label="Paper height (mm)">
                  <NumberInput value={o.customH} min={20} step={1} onChange={(customH) => set({ customH })} />
                </Field>
              </>
            )}
            {o.paper !== 'Card' && (
              <>
                <Field label="Card arrangement">
                  <select value={o.layout} onChange={(e) => set({ layout: e.target.value as LayoutMode })}>
                    <option value="auto">Most cards (mix upright + turned)</option>
                    <option value="normal">All upright</option>
                    <option value="rotated">All turned 90°</option>
                  </select>
                </Field>
                <Field label="Sheet orientation">
                  <select value={o.orientation} onChange={(e) => set({ orientation: e.target.value as Orientation })}>
                    <option value="auto">Automatic (best fit)</option>
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </Field>
                <Field label="Page margin (mm)">
                  <NumberInput value={o.marginMm} min={0} step={0.5} onChange={(marginMm) => set({ marginMm })} />
                </Field>
                <Field label="Gap between cards (mm)">
                  <NumberInput value={o.gapMm} min={0} step={0.5} onChange={(gapMm) => set({ gapMm })} />
                </Field>
              </>
            )}
            {sides === 'both' && o.paper !== 'Card' && (
              <Field label="Back sheet flip">
                <select value={o.flip} onChange={(e) => set({ flip: e.target.value as DuplexFlip })}>
                  <option value="auto">Automatic (long edge)</option>
                  <option value="horizontal">Horizontal (left ↔ right)</option>
                  <option value="vertical">Vertical (top ↔ bottom)</option>
                </select>
              </Field>
            )}
            <Field label="Mirror print">
              <select value={o.mirror} onChange={(e) => set({ mirror: e.target.value as MirrorMode })}>
                <option value="none">Off</option>
                <option value="horizontal">Mirror horizontal</option>
                <option value="vertical">Mirror vertical</option>
              </select>
            </Field>
            <Field label="Quality">
              <select value={o.dpi} onChange={(e) => set({ dpi: Number(e.target.value) })}>
                <option value={200}>Draft (200 dpi)</option>
                <option value={300}>Standard (300 dpi)</option>
                <option value={600}>High (600 dpi)</option>
              </select>
            </Field>
          </div>
          <div className="row">
            {o.paper !== 'Card' && <Toggle label="Cut marks" checked={o.cutMarks} onChange={(cutMarks) => set({ cutMarks })} />}
            <Toggle label="Mark records as printed" checked={markPrinted} onChange={setMarkPrinted} />
          </div>
        </div>

        <div className="print-summary">
          {perPage ? (
            <>
              <SheetPreview tpl={tpl} layout={layout} />
              <p>
                {o.paper === 'Card' ? (
                  <>One card per page · {sheets} pages</>
                ) : (
                  <>
                    <b>{perPage}</b> cards per sheet
                    {layout.turned > 0 && layout.upright > 0 && (
                      <>
                        {' '}
                        ({layout.upright} upright + {layout.turned} turned)
                      </>
                    )}{' '}
                    · <b>{sheets}</b> sheet{sheets === 1 ? '' : 's'}
                  </>
                )}
              </p>
              <p className="hint">Cards print at their exact size ({tpl.widthMm} × {tpl.heightMm} mm). Set the printer to “Actual size / 100%”.</p>
            </>
          ) : (
            <p className="error">The card does not fit on this paper. Reduce the margin or gap.</p>
          )}
        </div>
      </div>

      <section className="export-cards">
        <h3>Save every card as a separate image</h3>
        <div className="grid4">
          <Field label="Resolution">
            <select value={cardDpi} onChange={(e) => setCardDpi(Number(e.target.value))}>
              {[300, 600, 1200, 2400].map((d) => (
                <option key={d} value={d}>
                  {d} dpi ({pxAt(d)})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Format">
            <select value={cardFormat} onChange={(e) => setCardFormat(e.target.value as 'png' | 'jpg')}>
              <option value="png">PNG (best quality)</option>
              <option value="jpg">JPG (smaller files)</option>
            </select>
          </Field>
          <Field label="File name from">
            <select value={nameField} onChange={(e) => setNameField(e.target.value)}>
              {tpl.fields.map((f) => (
                <option key={f}>{f}</option>
              ))}
              <option value="Serial">Serial</option>
            </select>
          </Field>
          <button className="btn" disabled={busy} onClick={() => run('cards')}>
            Save images
          </button>
        </div>
      </section>
    </Modal>
  );
}

function SheetPreview({ tpl, layout }: { tpl: Template; layout: ReturnType<typeof computeLayout> }) {
  const scale = 190 / Math.max(layout.pageW, layout.pageH);
  return (
    <div className="sheet" style={{ width: layout.pageW * scale, height: layout.pageH * scale }}>
      {layout.slots.map((s, i) => (
        <div
          key={i}
          className={s.rot ? 'turned' : ''}
          style={{
            left: s.x * scale,
            top: s.y * scale,
            width: (s.rot ? tpl.heightMm : tpl.widthMm) * scale,
            height: (s.rot ? tpl.widthMm : tpl.heightMm) * scale,
          }}
        />
      ))}
    </div>
  );
}
