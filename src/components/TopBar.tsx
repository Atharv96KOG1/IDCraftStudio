import { useState } from 'react';
import { useStore } from '../lib/store';
import { STARTERS } from '../lib/templates';
import { exportBackup, restoreBackup, type Backup } from '../lib/db';
import { renderSideToDataURL } from '../lib/render';
import type { Template } from '../lib/types';
import { clone, dataUrlToBlob, downloadBlob, pickFiles, readFileAsText, uid } from '../lib/utils';
import { safeFileName } from '../lib/utils';
import { Menu, Modal, toast } from './ui';
import { GeneratorDialog } from './GeneratorDialog';
import { LicenseDialog } from './License';
import { bridge } from '../lib/license';
import { canSaveToDisk, dateStamp, openFolder, revealFile, saveFile } from '../lib/files';
import { db } from '../lib/db';
import { Field, Toggle } from './ui';
import type { LicenseStatus } from '../lib/license';

export type Tab = 'design' | 'records';

export function TopBar({
  tab,
  setTab,
  license,
  onLicense,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  license: LicenseStatus;
  onLicense: (s: LicenseStatus) => void;
}) {
  const tpl = useStore((s) => s.template)!;
  const templates = useStore((s) => s.templates);
  const saveState = useStore((s) => s.saveState);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const { openTemplate, addTemplate, deleteTemplate, undo, redo } = useStore.getState();
  const [about, setAbout] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showLicense, setShowLicense] = useState(false);

  const safeName = safeFileName(tpl.name);

  const [nextYear, setNextYear] = useState(false);

  /** Saves the design as a file in Documents › IDCraft Studio › Templates and shows it. */
  const exportTemplate = async () => {
    await useStore.getState().saveNow();
    const file = await saveFile('Templates', `${safeName}.idct`, new Blob([JSON.stringify({ app: 'IDCraft Studio', template: useStore.getState().template }, null, 2)], { type: 'application/json' }));
    if (file) {
      await revealFile(file);
      toast(`Template saved: ${file}`);
    } else toast('Template file downloaded.');
  };

  const importTemplate = async () => {
    const [f] = await pickFiles('.idct,.json');
    if (!f) return;
    try {
      const data = JSON.parse(await readFileAsText(f));
      const t: Template = data.template;
      if (!t?.front || !t?.back) throw new Error('not a template');
      await addTemplate({ ...t, id: uid(), name: `${t.name} (imported)`, createdAt: Date.now(), updatedAt: Date.now() });
      toast('Template imported.');
    } catch {
      toast('That file is not an IDCraft Studio template.', 'error');
    }
  };

  const exportPng = async () => {
    const { side, previewPersonId } = useStore.getState();
        const person = previewPersonId ? (await db.people.get(previewPersonId)) ?? null : null;
    const url = await renderSideToDataURL(tpl, side, person, 300, 'image/png');
    downloadBlob(dataUrlToBlob(url), `${safeName} - ${side}.png`);
  };

  const backup = async () => {
    const data = await exportBackup();
    const file = await saveFile('Backups', `IDCraft backup ${dateStamp()}.idcb`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
    await revealFile(file);
    toast(`Backup saved: ${data.templates.length} templates, ${data.people.length} records.`);
  };

  const restore = async () => {
    const [f] = await pickFiles('.idcb,.json');
    if (!f) return;
    if (!confirm('Restoring replaces ALL current templates and records with the backup. Continue?')) return;
    try {
      const data = JSON.parse(await readFileAsText(f)) as Backup;
      useStore.setState({ saveState: 'saved', template: null });
      await restoreBackup(data);
      useStore.setState({ saveState: 'saved' });
      await useStore.getState().refreshTemplates();
      const first = useStore.getState().templates[0];
      if (first) await openTemplate(first.id);
      toast('Backup restored.');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <header className="topbar">
      <div className="brand">
        <img className="logo-img" src="./icon.png" alt="" />
        <span>IDCraft Studio</span>
      </div>

      <select className="tpl-select" value={tpl.id} onChange={(e) => openTemplate(e.target.value)} title="Open template">
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <button className="btn ai-small" onClick={() => setGenerating(true)} title="Describe a card and get ready-made designs">
        ✨ AI Design
      </button>

      <Menu
        label="Template"
        items={[
          ...STARTERS.map((s) => ({ label: `New: ${s.label}`, onClick: () => addTemplate(s.make()) })),
          {
            label: 'Duplicate this template',
            divider: true,
            onClick: () => addTemplate({ ...clone(tpl), id: uid(), name: `${tpl.name} copy`, createdAt: Date.now(), updatedAt: Date.now() }),
          },
          { label: 'Copy for next year…', onClick: () => setNextYear(true) },
          { label: '💾 Save template to computer', onClick: exportTemplate, divider: true },
          { label: 'Open saved template file…', onClick: importTemplate },
          ...(canSaveToDisk() ? [{ label: '📂 Open templates folder', onClick: () => openFolder('Templates') }] : []),
          { label: 'Export current side as PNG', onClick: exportPng },
          {
            label: 'Delete this template…',
            danger: true,
            divider: true,
            onClick: () => {
              if (templates.length <= 1) return toast('You need at least one template.', 'error');
              if (confirm(`Delete “${tpl.name}” and all of its records? This cannot be undone.`)) deleteTemplate(tpl.id);
            },
          },
        ]}
      />

      <div className="seg tabs">
        <button className={tab === 'design' ? 'on' : ''} onClick={() => setTab('design')}>
          Design
        </button>
        <button className={tab === 'records' ? 'on' : ''} onClick={() => setTab('records')}>
          Records &amp; Print
        </button>
      </div>

      <span className="grow" />

      {tab === 'design' && (
        <div className="seg">
          <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            ↶
          </button>
          <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
            ↷
          </button>
        </div>
      )}
      {license.state === 'trial' && (
        <button className={`trial-pill${(license.daysLeft ?? 0) <= 3 ? ' low' : ''}`} onClick={() => setShowLicense(true)}>
          Trial: {license.daysLeft} day{license.daysLeft === 1 ? '' : 's'} left · Activate
        </button>
      )}
      <span className={`save-state ${saveState}`}>{saveState === 'saved' ? '✓ Saved' : 'Saving…'}</span>

      <Menu
        label="⚙"
        className="btn icon-btn"
        items={[
          { label: 'Licence…', onClick: () => setShowLicense(true) },
          { label: 'Back up all data…', onClick: backup, divider: true },
          { label: 'Restore from backup…', onClick: restore },
          ...(canSaveToDisk()
            ? [
                { label: '📂 Open saved files folder', onClick: () => openFolder(''), divider: true },
                {
                  label: 'Change save folder…',
                  onClick: async () => {
                    const d = await bridge?.files?.chooseBaseDir();
                    if (d) toast(`Files will be saved in ${d}`);
                  },
                },
              ]
            : []),
          { label: 'Keyboard shortcuts & about', divider: true, onClick: () => setAbout(true) },
        ]}
      />

      {generating && <GeneratorDialog onClose={() => setGenerating(false)} />}
      {nextYear && <NextYearDialog tpl={tpl} onClose={() => setNextYear(false)} />}
      {showLicense && (
        <LicenseDialog
          status={license}
          onClose={() => setShowLicense(false)}
          onChange={(s) => {
            onLicense(s);
            if (s.state === 'expired') setShowLicense(false);
          }}
        />
      )}
      {about && (
        <Modal title="IDCraft Studio" onClose={() => setAbout(false)} width={480}>
          <p>Design, fill and print ID cards. All data stays on this computer.</p>
          <table className="shortcuts">
            <tbody>
              {[
                ['Ctrl + Z / Ctrl + Y', 'Undo / redo'],
                ['Ctrl + C / Ctrl + V', 'Copy / paste element'],
                ['Ctrl + D', 'Duplicate element'],
                ['Delete', 'Delete element'],
                ['Arrow keys', 'Nudge 0.5 mm (Shift: 2 mm)'],
                ['Esc', 'Deselect'],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td>
                    <kbd>{k}</kbd>
                  </td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">Version 1.0.0</p>
        </Modal>
      )}
    </header>
  );
}

/** "2025-26" → "2026-27", "2025" → "2026". */
function bumpYears(text: string, by = 1): string {
  return text
    .replace(/\b(20\d\d)(\s*[-–/]\s*)(20\d\d|\d\d)\b/g, (_m, a: string, sep: string, b: string) => `${Number(a) + by}${sep}${String(Number(b) + by).padStart(b.length, '0')}`)
    .replace(/\b(20\d\d)\b(?!\s*[-–/]\s*\d)/g, (_m, a: string) => String(Number(a) + by));
}

/** Makes a copy of the design (and optionally its records) for the next academic year. */
function NextYearDialog({ tpl, onClose }: { tpl: Template; onClose: () => void }) {
  const [name, setName] = useState(() => (bumpYears(tpl.name) !== tpl.name ? bumpYears(tpl.name) : `${tpl.name} ${new Date().getFullYear() + 1}`));
  const [years, setYears] = useState(true);
  const [records, setRecords] = useState(true);
  const classField = tpl.fields.find((f) => /class|std|standard|grade|इयत्ता|वर्ग/i.test(f));
  const [promote, setPromote] = useState(!!classField);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    await useStore.getState().saveNow();
    const t: Template = { ...clone(tpl), id: uid(), name, createdAt: Date.now(), updatedAt: Date.now() };
    if (years)
      for (const side of [t.front, t.back])
        for (const el of side.elements) {
          if (el.type === 'text') el.text = bumpYears(el.text);
          if (el.type === 'qr' || el.type === 'barcode') el.value = bumpYears(el.value);
        }
    if (records) {
      const people = await db.people.where('templateId').equals(tpl.id).toArray();
      await db.people.bulkAdd(
        people.map(({ id: _id, ...p }) => {
          const fields = { ...p.fields };
          if (promote && classField && fields[classField]) fields[classField] = fields[classField].replace(/\d+/, (n) => String(Number(n) + 1));
          if (years) for (const k of Object.keys(fields)) if (/year|session|valid|वर्ष/i.test(k)) fields[k] = bumpYears(fields[k]);
          return { ...p, templateId: t.id, fields, printCount: 0, printedAt: null, createdAt: Date.now() };
        }),
      );
    }
    await useStore.getState().addTemplate(t);
    toast(`Created “${name}”. Change names, addresses or photos as needed.`);
    onClose();
  };

  return (
    <Modal
      title="Copy for next year"
      onClose={onClose}
      width={520}
      footer={
        <>
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={run} disabled={busy || !name.trim()}>
            Create copy
          </button>
        </>
      }
    >
      <Field label="New template name">
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Toggle label="Change years on the card (2025-26 → 2026-27)" checked={years} onChange={setYears} />
      <Toggle label="Copy all records (people, photos)" checked={records} onChange={setRecords} />
      {records && classField && <Toggle label={`Move everyone up one ${classField} (5 → 6)`} checked={promote} onChange={setPromote} />}
      <p className="hint">The old year stays as it is. Use ✎ Bulk edit on the Records page for other changes.</p>
    </Modal>
  );
}
