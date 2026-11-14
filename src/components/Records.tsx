import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useStore } from '../lib/store';
import { db, reserveSerials } from '../lib/db';
import type { Person, Template } from '../lib/types';
import { parseSpreadsheet, exportPeople, downloadSampleSheet, type ParsedSheet } from '../lib/sheets';
import { baseName, pickFiles, resizeImage } from '../lib/utils';
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
  const info = Object.fromEntries(detected.map((d) => [d.column, d]));
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
    await db.people.bulkAdd(records);
    toast(`Imported ${records.length} records.`);
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
            {busy ? 'Importing…' : `Import ${sheet.rows.length} records`}
          </button>
        </>
      }
    >
      <p className="hint">
        Column names were read from row {sheet.headerRow} of “{sheet.sheetName}”. Each column was matched automatically by its name
        and its values. Change any choice below if needed.
      </p>
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

function PhotoMatchDialog({ tpl, people, onClose }: { tpl: Template; people: Person[]; onClose: () => void }) {
  const guess =
    tpl.fields.find((f) => people.some((p) => /\.(jpe?g|png|webp|bmp|gif|heic)$/i.test(p.fields[f] ?? ''))) ??
    tpl.fields.find((f) => /id|roll|code|no|number|क्रमांक/i.test(f)) ??
    tpl.fields[0] ??
    'Serial';
  const [key, setKey] = useState(guess);
  const [overwrite, setOverwrite] = useState(false);
  const [ai, setAi] = useState(true);
  const [bg, setBg] = useState<string | null>('#ffffff');
  const [progress, setProgress] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const keyOf = (p: Person) => baseName(key === 'Serial' ? String(p.serial).padStart(5, '0') : p.fields[key] ?? '').trim().toLowerCase();
  const index = useMemo(() => {
    const m = new Map<string, Person[]>();
    for (const p of people) {
      const k = keyOf(p);
      if (k) m.set(k, [...(m.get(k) ?? []), p]);
      if (key === 'Serial') m.set(String(p.serial), [p]);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, key]);

  const images = files.filter((f) => f.type.startsWith('image/'));
  const matches = images.map((f) => ({ file: f, people: index.get(baseName(f.name).trim().toLowerCase()) ?? [] }));
  const matched = matches.filter((m) => m.people.length);
  const unmatched = matches.filter((m) => !m.people.length);

  const apply = async () => {
    setBusy(true);
    let n = 0;
    let noFace = 0;
    let done = 0;
    for (const m of matched) {
      setProgress(`Processing ${++done} / ${matched.length}…`);
      const targets = m.people.filter((p) => !p.photo || overwrite);
      if (!targets.length) continue;
      let photo: string;
      let original: string;
      try {
        original = await originalCopy(m.file);
        if (ai) {
          const r = await autoEnhance(m.file, { background: bg });
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
        Name each photo after the record's key, e.g. <code>EMP1023.jpg</code> for the record whose {key} is EMP1023.
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
        <button className="btn" onClick={async () => setFiles(await pickFiles('image/*', true))}>
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
