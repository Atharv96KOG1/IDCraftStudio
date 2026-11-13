import { useState } from 'react';
import { useStore } from '../lib/store';
import { STARTERS } from '../lib/templates';
import { exportBackup, restoreBackup, type Backup } from '../lib/db';
import { renderSideToDataURL } from '../lib/render';
import type { Template } from '../lib/types';
import { clone, downloadBlob, pickFiles, readFileAsText, uid } from '../lib/utils';
import { Menu, Modal, toast } from './ui';

export type Tab = 'design' | 'records';

export function TopBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tpl = useStore((s) => s.template)!;
  const templates = useStore((s) => s.templates);
  const saveState = useStore((s) => s.saveState);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const { openTemplate, addTemplate, deleteTemplate, undo, redo } = useStore.getState();
  const [about, setAbout] = useState(false);

  const safeName = tpl.name.replace(/[^\w\- ]+/g, '');

  const exportTemplate = () =>
    downloadBlob(new Blob([JSON.stringify({ app: 'IDCraft Studio', template: tpl }, null, 2)], { type: 'application/json' }), `${safeName}.idct`);

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
    const { db } = await import('../lib/db');
    const person = previewPersonId ? (await db.people.get(previewPersonId)) ?? null : null;
    const url = await renderSideToDataURL(tpl, side, person, 300, 'image/png');
    downloadBlob(await (await fetch(url)).blob(), `${safeName} - ${side}.png`);
  };

  const backup = async () => {
    const data = await exportBackup();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), `IDCraft backup ${stamp}.idcb`);
    toast(`Backup saved: ${data.templates.length} templates, ${data.people.length} records.`);
  };

  const restore = async () => {
    const [f] = await pickFiles('.idcb,.json');
    if (!f) return;
    if (!confirm('Restoring replaces ALL current templates and records with the backup. Continue?')) return;
    try {
      await restoreBackup(JSON.parse(await readFileAsText(f)) as Backup);
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
        <span className="logo">ID</span>
        <span>IDCraft Studio</span>
      </div>

      <select className="tpl-select" value={tpl.id} onChange={(e) => openTemplate(e.target.value)} title="Open template">
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <Menu
        label="Template"
        items={[
          ...STARTERS.map((s) => ({ label: `New: ${s.label}`, onClick: () => addTemplate(s.make()) })),
          {
            label: 'Duplicate this template',
            divider: true,
            onClick: () => addTemplate({ ...clone(tpl), id: uid(), name: `${tpl.name} copy`, createdAt: Date.now(), updatedAt: Date.now() }),
          },
          { label: 'Export template file…', onClick: exportTemplate },
          { label: 'Import template file…', onClick: importTemplate },
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
      <span className={`save-state ${saveState}`}>{saveState === 'saved' ? '✓ Saved' : 'Saving…'}</span>

      <Menu
        label="⚙"
        className="btn icon-btn"
        items={[
          { label: 'Back up all data…', onClick: backup },
          { label: 'Restore from backup…', onClick: restore },
          { label: 'Keyboard shortcuts & about', divider: true, onClick: () => setAbout(true) },
        ]}
      />

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
