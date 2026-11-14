import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useStore } from '../lib/store';
import { db, reserveSerials } from '../lib/db';
import type { Person, Template } from '../lib/types';
import { parseSpreadsheet, exportPeople, downloadSampleSheet, type ParsedSheet } from '../lib/sheets';
import { pickFiles, resizeImage } from '../lib/utils';
import { guessPhotoField, isImageFile, matchPhotos } from '../lib/photoMatch';
import { toMarathi } from '../lib/marathi';
import { Camera } from './Camera';
import { PhotoEditor } from './PhotoEditor';
import { autoEnhance, originalCopy, BACKGROUNDS } from '../lib/photoAI';
import { detectColumns, KIND_LABEL } from '../lib/fieldDetect';
import { PrintDialog } from './PrintDialog';
import { Field, Modal, Toggle, toast } from './ui';

export function Records({ onPreview }: { onPreview: () => void }) {
  const tpl = useStore((s) => s.template)!;
  const people = useLiveQuery(() => db.people.where('templateId').equals(tpl.id).sortBy('serial'), [tpl.id]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Person | 'new' | null>(null);
  const [importing, setImporting] = useState<ParsedSheet | null>(null);
  const [matching, setMatching] = useState(false);
  const [printing, setPrinting] = useState<Person[] | null>(null);
  const [enhancing, setEnhancing] = useState<Person[] | null>(null);
  const [bulk, setBulk] = useState<Person[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'unprinted' | 'nophoto'>('all');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (people ?? []).filter((p) => {
      if (filter === 'unprinted' && p.printCount > 0) return false;
      if (filter === 'nophoto' && p.photo) return false;
      if (!q) return true;
      return String(p.serial).includes(q) || Object.values(p.fields).some((v) => v.toLowerCase().includes(q));
    });
  }, [people, query, filter]);

  const cols = tpl.fields;
  const allChecked = visible.length > 0 && visible.every((p) => selected.has(p.id!));
  const chosen = (people ?? []).filter((p) => selected.has(p.id!));

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const importFile = async () => {
    const [f] = await pickFiles('.xlsx,.xls,.csv,.ods');
    if (!f) return;
    try {
      const parsed = await parseSpreadsheet(f);
      if (!parsed.rows.length) return toast('No rows found in that file.', 'error');
      setImporting(parsed);
    } catch (e) {
      toast(`Could not read the file: ${(e as Error).message}`, 'error');
    }
  };

  const deleteSelected = async () => {
    if (!chosen.length) return;
    if (!confirm(`Delete ${chosen.length} record(s)? This cannot be undone.`)) return;
    await db.people.bulkDelete(chosen.map((p) => p.id!));
    setSelected(new Set());
    toast(`Deleted ${chosen.length} record(s).`);
  };

  return (
    <div className="records">
      <div className="records-bar">
        <input className="search" placeholder="Search records…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">All records</option>
          <option value="unprinted">Not printed yet</option>
          <option value="nophoto">Missing photo</option>
        </select>
        <span className="grow" />
        <button className="btn" onClick={() => setEditing('new')}>
          + Add record
        </button>
        <button className="btn" onClick={importFile}>
          Import Excel / CSV
        </button>
        <button className="btn" onClick={() => setMatching(true)} disabled={!people?.length}>
          Match photos
        </button>
        <button className="btn" onClick={() => people && exportPeople(tpl, visible)} disabled={!visible.length}>
          Export Excel
        </button>
        <button className="btn" onClick={() => downloadSampleSheet(tpl)} title="Blank spreadsheet with this card's columns">
          Sample sheet
        </button>
      </div>

      <div className="selection-bar">
        <span>
          {people?.length ?? 0} records · {visible.length} shown · <b>{chosen.length} selected</b>
        </span>
        <span className="grow" />
        <button className="btn danger" onClick={deleteSelected} disabled={!chosen.length}>
          Delete selected
        </button>
        <button
          className="btn"
          onClick={() => setBulk(chosen.length ? chosen : visible)}
          disabled={!visible.length}
          title="Change a field for many records at once (new year, class, address, Marathi…)"
        >
          ✎ Bulk edit
        </button>
        <button
          className="btn"
          onClick={() => setEnhancing((chosen.length ? chosen : visible).filter((p) => p.photo))}
          disabled={!(chosen.length ? chosen : visible).some((p) => p.photo)}
          title="Crop to face, straighten and fix colours with AI"
        >
          ✨ AI photos
        </button>
        <button className="btn primary" onClick={() => setPrinting(chosen.length ? chosen : visible)} disabled={!visible.length}>
          🖨 Print {chosen.length ? `${chosen.length} selected` : `all ${visible.length} shown`}
        </button>
      </div>

      <div className="table-wrap">
        {people && !people.length ? (
          <div className="empty">
            <h2>No records yet</h2>
            <p>Add people one by one, or import a spreadsheet. Column names should match the card's data fields:</p>
            <p className="chips center">
              {tpl.fields.map((f) => (
                <span key={f} className="chip">
                  {f}
                </span>
              ))}
            </p>
            <div className="btn-row center">
              <button className="btn" onClick={() => setEditing('new')}>
                + Add record
              </button>
              <button className="btn primary" onClick={importFile}>
                Import Excel / CSV
              </button>
            </div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="check">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => setSelected(allChecked ? new Set() : new Set(visible.map((p) => p.id!)))}
                  />
                </th>
                <th>Photo</th>
                <th>Serial</th>
                {cols.map((c) => (
                  <th key={c}>{c}</th>
                ))}
                <th>Printed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className={selected.has(p.id!) ? 'sel' : ''} onDoubleClick={() => setEditing(p)}>
                  <td className="check">
                    <input type="checkbox" checked={selected.has(p.id!)} onChange={() => toggle(p.id!)} />
                  </td>
                  <td>{p.photo ? <img className="avatar" src={p.photo} alt="" /> : <span className="avatar none">—</span>}</td>
                  <td className="mono">{String(p.serial).padStart(5, '0')}</td>
                  {cols.map((c) => (
                    <td key={c}>{p.fields[c]}</td>
                  ))}
                  <td>{p.printCount ? `${p.printCount}×` : <span className="muted">no</span>}</td>
                  <td className="actions">
                    <button
                      onClick={() => {
                        useStore.getState().setPreviewPerson(p.id!);
                        onPreview();
                      }}
                    >
                      Preview
                    </button>
                    <button onClick={() => setEditing(p)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && <PersonDialog tpl={tpl} person={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {importing && <ImportDialog tpl={tpl} sheet={importing} onClose={() => setImporting(null)} />}
      {matching && people && <PhotoMatchDialog tpl={tpl} people={people} onClose={() => setMatching(false)} />}
      {bulk && <BulkEditDialog tpl={tpl} people={bulk} onClose={() => setBulk(null)} />}
      {enhancing && <BulkPhotoDialog people={enhancing} onClose={() => setEnhancing(null)} />}
      {printing && <PrintDialog tpl={tpl} people={printing} onClose={() => setPrinting(null)} />}
    </div>
  );
}

function PersonDialog({ tpl, person, onClose }: { tpl: Template; person: Person | null; onClose: () => void }) {
  const [fields, setFields] = useState<Record<string, string>>(() => ({ ...person?.fields }));
  const [photo, setPhoto] = useState<string | null>(person?.photo ?? null);
  const [original, setOriginal] = useState<string | null>(person?.photoOriginal ?? person?.photo ?? null);
  const [camera, setCamera] = useState(false);
  const [editing, setEditing] = useState<{ src: string; auto: boolean } | null>(null);
  const extra = Object.keys(fields).filter((k) => !tpl.fields.includes(k));

  const save = async () => {
    if (person) {
      await db.people.update(person.id!, { fields, photo, photoOriginal: original });
    } else {
      const serial = await reserveSerials(1);
      await db.people.add({ templateId: tpl.id, serial, fields, photo, photoOriginal: original, createdAt: Date.now(), printCount: 0, printedAt: null });
    }
    toast(person ? 'Record updated.' : 'Record added.');
    onClose();
  };

  const remove = async () => {
    if (!person || !confirm('Delete this record? This cannot be undone.')) return;
    await db.people.delete(person.id!);
    onClose();
  };

  return (
    <Modal
      title={person ? `Edit record #${String(person.serial).padStart(5, '0')}` : 'New record'}
      onClose={onClose}
      width={640}
      footer={
        <>
          {person && (
            <button className="btn danger" onClick={remove}>
              Delete
            </button>
          )}
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Save
          </button>
        </>
      }
    >
      <div className="person-form">
        <div className="photo-col">
          {camera ? (
            <Camera
              onCancel={() => setCamera(false)}
              onCapture={(d) => {
                setCamera(false);
                setEditing({ src: d, auto: true });
              }}
            />
          ) : (
            <>
              {photo ? <img className="photo-big" src={photo} alt="" /> : <div className="photo-big none">No photo</div>}
              <div className="btn-row tight">
                <button
                  className="btn"
                  onClick={async () => {
                    const [f] = await pickFiles('image/*');
                    if (f) setEditing({ src: await resizeImage(f, 2000, 0.92), auto: true });
                  }}
                >
                  Upload
                </button>
                {photo && (
                  <button className="btn" onClick={() => setEditing({ src: original ?? photo, auto: false })}>
                    ✨ Edit
                  </button>
                )}
                <button className="btn" onClick={() => setCamera(true)}>
                  Camera
                </button>
                {photo && (
                  <button
                    className="btn"
                    onClick={() => {
                      setPhoto(null);
                      setOriginal(null);
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {editing && (
          <PhotoEditor
            source={editing.src}
            autoRun={editing.auto}
            onCancel={() => setEditing(null)}
            onSave={(p, o) => {
              setPhoto(p);
              setOriginal(o);
              setEditing(null);
            }}
          />
        )}
        <div className="fields-col">
          {[...tpl.fields, ...extra].map((f, i) => (
            <Field key={f} label={f}>
              <input autoFocus={i === 0} value={fields[f] ?? ''} onChange={(e) => setFields({ ...fields, [f]: e.target.value })} />
            </Field>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function ImportDialog({ tpl, sheet, onClose }: { tpl: Template; sheet: ParsedSheet; onClose: () => void }) {
  const detected = useMemo(() => detectColumns(sheet.columns, sheet.rows, tpl.fields), [sheet, tpl.fields]);
  const [mapping, setMapping] = useState<Record<string, string>>(() => Object.fromEntries(detected.map((d) => [d.column, d.target])));
  const [busy, setBusy] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoAi, setPhotoAi] = useState(false);
  const [status, setStatus] = useState('');
  const info = Object.fromEntries(detected.map((d) => [d.column, d]));
  // Column with camera file names (DSC0001.JPG / 001.jpg) → photos placed on the cards right after import.
  const photoCol = sheet.columns.find((c) => info[c].kind === 'photo' && mapping[c] !== 'skip');
  const photoField = photoCol ? (mapping[photoCol].startsWith('new:') ? mapping[photoCol].slice(4) : mapping[photoCol]) : null;
  const matched = detected.filter((d) => !d.target.startsWith('new:') && d.target !== 'skip').length;
  const added = Object.values(mapping).filter((v) => v.startsWith('new:')).length;

  const run = async () => {
    setBusy(true);
    const used = Object.entries(mapping).filter(([, v]) => v !== 'skip');
    const newFields = [...new Set(used.filter(([, v]) => v.startsWith('new:')).map(([, v]) => v.slice(4)))];
    if (newFields.length) {
      useStore.getState().mutate((t) => newFields.forEach((f) => !t.fields.includes(f) && t.fields.push(f)));
    }
    const first = await reserveSerials(sheet.rows.length);
    const now = Date.now();
    const records: Person[] = sheet.rows.map((row, i) => {
      const fields: Record<string, string> = {};
      for (const [col, target] of used) {
        const key = target.startsWith('new:') ? target.slice(4) : target;
        // Two columns into one field (e.g. first + last name) are joined with a space.
        fields[key] = fields[key] ? `${fields[key]} ${row[col] ?? ''}`.trim() : row[col] ?? '';
      }
      return { templateId: tpl.id, serial: first + i, fields, photo: null, createdAt: now, printCount: 0, printedAt: null };
    });
    const ids = (await db.people.bulkAdd(records, { allKeys: true })) as number[];
    let photoMsg = '';
    if (photoField && photoFiles.length) {
      const added = (await db.people.bulkGet(ids)).filter(Boolean) as Person[];
      const { matched, images } = matchPhotos(added, photoFiles, photoField);
      const [n, noFace] = await applyPhotoMatches(matched, { overwrite: true, ai: photoAi, bg: '#ffffff' }, (d, t) => setStatus(`Adding photos ${d} / ${t}…`));
      photoMsg = ` Photos added to ${n} record(s)${images.length - matched.length ? `; ${images.length - matched.length} photo file(s) had no matching row` : ''}${noFace ? `; no face found in ${noFace}` : ''}.`;
    }
    toast(`Imported ${records.length} records.${photoMsg}`);
    onClose();
  };

  return (
    <Modal
      title={`Import ${sheet.rows.length} rows`}
      onClose={onClose}
      width={880}
      footer={
        <>
          <span className="hint">
            ✨ Auto-detected: {matched} matched to card fields{added ? `, ${added} new field${added === 1 ? '' : 's'}` : ''}
          </span>
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={run} disabled={busy}>
            {busy ? status || 'Importing…' : `Import ${sheet.rows.length} records`}
          </button>
        </>
      }
    >
      <p className="hint">
        Column names were read from row {sheet.headerRow} of “{sheet.sheetName}”. Each column was matched automatically by its name
        and its values. Change any choice below if needed.
      </p>
      {photoField && (
        <div className="ok-box">
          📷 Column “{photoCol}” has photo file names. Choose the folder with the camera photos and they will be placed on the cards
          straight away.
          <div className="btn-row">
            <button className="btn" onClick={async () => setPhotoFiles((await pickFiles('image/*', true, true)).filter(isImageFile))}>
              📁 Choose photos folder…
            </button>
            <button className="btn" onClick={async () => setPhotoFiles((await pickFiles('image/*', true)).filter(isImageFile))}>
              Choose photos…
            </button>
            {photoFiles.length > 0 && <b>{photoFiles.length} photos selected</b>}
          </div>
          {photoFiles.length > 0 && <Toggle label="✨ AI: crop to face and fix colours (slower)" checked={photoAi} onChange={setPhotoAi} />}
        </div>
      )}
      <div className="detect-table">
        <div className="detect-head">
          <span>Column in file</span>
          <span>Detected as</span>
          <span>Example</span>
          <span>Goes into card field</span>
        </div>
        {sheet.columns.map((c) => {
          const d = info[c];
          const auto = mapping[c] === d.target;
          return (
            <div key={c} className="detect-row">
              <span className="col-name" title={c}>
                {c}
              </span>
              <span>
                <span className={`kind ${d.confidence}`} title={`Detected from ${d.reason}`}>
                  {KIND_LABEL[d.kind]}
                </span>
              </span>
              <span className="sample" title={d.sample}>
                {d.sample || '—'}
              </span>
              <span className="row">
                <select value={mapping[c]} onChange={(e) => setMapping({ ...mapping, [c]: e.target.value })}>
                  {tpl.fields.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                  {d.target.startsWith('new:') && <option value={d.target}>New field “{d.target.slice(4)}”</option>}
                  {!d.target.startsWith('new:') && !tpl.fields.includes(c) && <option value={`new:${c}`}>New field “{c}”</option>}
                  <option value="skip">Don’t import</option>
                </select>
                {auto && mapping[c] !== 'skip' && <span className="auto-tag">auto</span>}
              </span>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

type PhotoMatch = { file: File; people: Person[] };

/** Saves matched photos into records (optionally AI-cropped). Returns [added, noFace]. */
async function applyPhotoMatches(
  matched: PhotoMatch[],
  o: { overwrite: boolean; ai: boolean; bg: string | null },
  onProgress: (done: number, total: number) => void,
): Promise<[number, number]> {
  let n = 0;
  let noFace = 0;
  let done = 0;
  for (const m of matched) {
    onProgress(++done, matched.length);
    const targets = m.people.filter((p) => !p.photo || o.overwrite);
    if (!targets.length) continue;
    let photo: string;
    let original: string;
    try {
      original = await originalCopy(m.file);
      if (o.ai) {
        const r = await autoEnhance(m.file, { background: o.bg });
        photo = r.photo;
        if (!r.faceFound) noFace++;
      } else {
        photo = await resizeImage(m.file, 900);
      }
    } catch {
      continue;
    }
    for (const p of targets) {
      await db.people.update(p.id!, { photo, photoOriginal: original });
      n++;
    }
  }
  return [n, noFace];
}

function PhotoMatchDialog({ tpl, people, onClose }: { tpl: Template; people: Person[]; onClose: () => void }) {
  const [key, setKey] = useState(() => guessPhotoField(tpl.fields, people));
  const [overwrite, setOverwrite] = useState(false);
  const [ai, setAi] = useState(true);
  const [bg, setBg] = useState<string | null>('#ffffff');
  const [progress, setProgress] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const { images, matched, unmatched } = useMemo(() => matchPhotos(people, files, key), [people, files, key]);

  const apply = async () => {
    setBusy(true);
    const [n, noFace] = await applyPhotoMatches(matched, { overwrite, ai, bg }, (d, t) => setProgress(`Processing ${d} / ${t}…`));
    toast(
      `Added photos to ${n} record(s).${noFace ? ` No face found in ${noFace} photo(s); check them with ✨ Edit.` : ''}`,
      noFace ? 'error' : 'ok',
    );
    onClose();
  };

  return (
    <Modal
      title="Match photos to records"
      onClose={onClose}
      width={620}
      footer={
        <>
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!matched.length || busy} onClick={apply}>
            {busy ? 'Saving…' : `Apply ${matched.length} photo(s)`}
          </button>
        </>
      }
    >
      <p className="hint">
        Photos are matched by file name, e.g. <code>DSC0001.JPG</code> or <code>001.jpg</code> for the record whose {key} is DSC0001 / 1.
      </p>
      <Field label="Match file name against">
        <select value={key} onChange={(e) => setKey(e.target.value)}>
          {tpl.fields.map((f) => (
            <option key={f}>{f}</option>
          ))}
          <option value="Serial">Serial</option>
        </select>
      </Field>
      <Toggle label="Replace photos that already exist" checked={overwrite} onChange={setOverwrite} />
      <Toggle label="✨ AI: crop to face, straighten and fix colours" checked={ai} onChange={setAi} />
      {ai && (
        <Field label="Background">
          <select value={bg ?? ''} onChange={(e) => setBg(e.target.value || null)}>
            {BACKGROUNDS.map((b) => (
              <option key={b.label} value={b.value ?? ''}>
                {b.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {progress && busy && <p className="hint">{progress}</p>}
      <div className="btn-row">
        <button className="btn" onClick={async () => setFiles(await pickFiles('image/*,.jpg,.jpeg,.png', true))}>
          Choose photos…
        </button>
        <button className="btn" onClick={async () => setFiles(await pickFiles('image/*', true, true))}>
          Choose folder…
        </button>
      </div>
      {images.length > 0 && (
        <div className="match-result">
          <p>
            <b>{matched.length}</b> matched · <b>{unmatched.length}</b> not matched (of {images.length} images)
          </p>
          {unmatched.length > 0 && (
            <details>
              <summary>Show unmatched files</summary>
              <ul className="file-list">
                {unmatched.slice(0, 200).map((m) => (
                  <li key={m.file.name}>{m.file.name}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Modal>
  );
}

function BulkPhotoDialog({ people, onClose }: { people: Person[]; onClose: () => void }) {
  const [bg, setBg] = useState<string | null>('#ffffff');
  const [smoothing, setSmoothing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const run = async () => {
    let noFace = 0;
    let failed = 0;
    for (let i = 0; i < people.length; i++) {
      setProgress(i);
      const p = people[i];
      const source = p.photoOriginal ?? p.photo;
      if (!source) continue;
      try {
        const r = await autoEnhance(source, { background: bg, smoothing: smoothing ? 30 : 0 });
        if (!r.faceFound) noFace++;
        await db.people.update(p.id!, { photo: r.photo, photoOriginal: source });
      } catch {
        failed++;
      }
    }
    toast(
      `Improved ${people.length - failed} photo(s).${noFace ? ` No face found in ${noFace}; check them with ✨ Edit.` : ''}${failed ? ` ${failed} failed.` : ''}`,
      noFace || failed ? 'error' : 'ok',
    );
    onClose();
  };

  return (
    <Modal
      title={`AI-improve ${people.length} photo${people.length === 1 ? '' : 's'}`}
      onClose={() => progress === null && onClose()}
      width={480}
      footer={
        progress !== null ? (
          <div className="progress">
            <div className="progress-bar" style={{ width: `${(progress / people.length) * 100}%` }} />
            <span>
              Processing {progress + 1} / {people.length}…
            </span>
          </div>
        ) : (
          <>
            <span className="grow" />
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" onClick={run}>
              ✨ Start
            </button>
          </>
        )
      }
    >
      <p className="hint">
        Each photo is cropped to the face, straightened and colour-corrected. Originals are kept, so you can re-edit any photo later.
      </p>
      <Field label="Background">
        <select value={bg ?? ''} onChange={(e) => setBg(e.target.value || null)}>
          {BACKGROUNDS.map((b) => (
            <option key={b.label} value={b.value ?? ''}>
              {b.label}
            </option>
          ))}
        </select>
      </Field>
      <Toggle label="Light skin smoothing" checked={smoothing} onChange={setSmoothing} />
    </Modal>
  );
}

type BulkAction = 'set' | 'replace' | 'add' | 'marathi' | 'upper' | 'clearPrinted';

/** Change one field for many records: set, find/replace, +1 (next year/class), English → Marathi. */
function BulkEditDialog({ tpl, people, onClose }: { tpl: Template; people: Person[]; onClose: () => void }) {
  const [field, setField] = useState(tpl.fields[0] ?? '');
  const [action, setAction] = useState<BulkAction>('set');
  const [value, setValue] = useState('');
  const [find, setFind] = useState('');
  const [step, setStep] = useState(1);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);

  const change = (v: string): string => {
    switch (action) {
      case 'set':
        return value;
      case 'replace':
        return find ? v.split(find).join(value) : v;
      case 'add':
        // Adds to every number in the text: "5th" → "6th", "2025-26" → "2026-27".
        return v.replace(/\d+/g, (n) => String(Number(n) + step).padStart(n.length, '0'));
      case 'marathi':
        return toMarathi(v);
      case 'upper':
        return v.toUpperCase();
      default:
        return v;
    }
  };
  const out = action === 'marathi' && target.trim() ? target.trim() : field;
  const sample = people.find((p) => p.fields[field]) ?? people[0];

  const run = async () => {
    setBusy(true);
    if (action !== 'clearPrinted' && !tpl.fields.includes(out)) useStore.getState().mutate((t) => t.fields.push(out));
    await db.transaction('rw', db.people, async () => {
      for (const p of people) {
        if (action === 'clearPrinted') await db.people.update(p.id!, { printCount: 0, printedAt: null });
        else await db.people.update(p.id!, { fields: { ...p.fields, [out]: change(p.fields[field] ?? '') } });
      }
    });
    toast(`Updated ${people.length} record(s).`);
    onClose();
  };

  return (
    <Modal
      title={`Bulk edit ${people.length} record${people.length === 1 ? '' : 's'}`}
      onClose={onClose}
      width={520}
      footer={
        <>
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={run} disabled={busy}>
            Apply to {people.length}
          </button>
        </>
      }
    >
      <div className="grid2">
        <Field label="What to do">
          <select value={action} onChange={(e) => setAction(e.target.value as BulkAction)}>
            <option value="set">Set a value</option>
            <option value="replace">Find and replace</option>
            <option value="add">Add to numbers (next year / class)</option>
            <option value="marathi">English → Marathi (approximate)</option>
            <option value="upper">MAKE UPPERCASE</option>
            <option value="clearPrinted">Mark as not printed</option>
          </select>
        </Field>
        {action !== 'clearPrinted' && (
          <Field label="Field">
            <select value={field} onChange={(e) => setField(e.target.value)}>
              {tpl.fields.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
        )}
        {action === 'replace' && (
          <Field label="Find">
            <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="2025-26" />
          </Field>
        )}
        {(action === 'set' || action === 'replace') && (
          <Field label={action === 'set' ? 'New value' : 'Replace with'}>
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={action === 'set' ? '' : '2026-27'} />
          </Field>
        )}
        {action === 'add' && (
          <Field label="Add">
            <input type="number" value={step} onChange={(e) => setStep(Number(e.target.value) || 0)} />
          </Field>
        )}
        {action === 'marathi' && (
          <Field label="Save into field">
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={`${field}_MR (empty = same field)`} />
          </Field>
        )}
      </div>
      {sample && action !== 'clearPrinted' && (
        <p className="ok-box">
          Example: “{sample.fields[field] ?? ''}” → “{change(sample.fields[field] ?? '')}”
        </p>
      )}
      {action === 'marathi' && <p className="hint">Machine transliteration is a starting point – check names before printing.</p>}
    </Modal>
  );
}
