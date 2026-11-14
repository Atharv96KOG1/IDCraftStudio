import { useEffect, useState } from 'react';
import { useStore } from './lib/store';
import { seedIfEmpty } from './lib/db';
import { useFonts } from './lib/fonts';
import { Designer } from './components/Designer';
import { Records } from './components/Records';
import { TopBar, type Tab } from './components/TopBar';
import { ActivationScreen } from './components/License';
import { getLicense, type LicenseStatus } from './lib/license';

export default function App() {
  const template = useStore((s) => s.template);
  const saveState = useStore((s) => s.saveState);
  const [tab, setTab] = useState<Tab>('design');
  const [error, setError] = useState<string | null>(null);
  const [license, setLicense] = useState<LicenseStatus | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLicense(await getLicense());
        await seedIfEmpty();
        await useFonts.getState().init();
        const s = useStore.getState();
        await s.refreshTemplates();
        const list = useStore.getState().templates;
        const last = localStorage.getItem('lastTemplate');
        const id = list.find((t) => t.id === last)?.id ?? list[0]?.id;
        if (id) await s.openTemplate(id);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  // Autosave shortly after each change.
  useEffect(() => {
    if (saveState !== 'dirty') return;
    const t = setTimeout(() => useStore.getState().saveNow(), 600);
    return () => clearTimeout(t);
  }, [template, saveState]);

  useEffect(() => {
    const bridge = (window as unknown as { idcraft?: { onFlush?: (f: () => Promise<void>) => void } }).idcraft;
    bridge?.onFlush?.(() => useStore.getState().saveNow());
    // Files dropped anywhere outside a drop zone must not replace the app.
    const block = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  useEffect(() => {
    const flush = () => {
      useStore.getState().saveNow();
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);

  if (error) return <div className="splash error">Could not open the local database: {error}</div>;
  if (!template || !license) return <div className="splash">Loading IDCraft Studio…</div>;
  if (license.state === 'expired' || license.state === 'clock') return <ActivationScreen status={license} onDone={setLicense} />;

  return (
    <div className="app">
      <TopBar tab={tab} setTab={setTab} license={license} onLicense={setLicense} />
      {tab === 'design' ? <Designer /> : <Records onPreview={() => setTab('design')} />}
    </div>
  );
}
