import { useEffect, useState } from 'react';
import { useStore } from './lib/store';
import { seedIfEmpty } from './lib/db';
import { Designer } from './components/Designer';
import { Records } from './components/Records';
import { TopBar, type Tab } from './components/TopBar';

export default function App() {
  const template = useStore((s) => s.template);
  const saveState = useStore((s) => s.saveState);
  const [tab, setTab] = useState<Tab>('design');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await seedIfEmpty();
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
    const flush = () => {
      useStore.getState().saveNow();
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);

  if (error) return <div className="splash error">Could not open the local database: {error}</div>;
  if (!template) return <div className="splash">Loading IDCraft Studio…</div>;

  return (
    <div className="app">
      <TopBar tab={tab} setTab={setTab} />
      {tab === 'design' ? <Designer /> : <Records onPreview={() => setTab('design')} />}
    </div>
  );
}
