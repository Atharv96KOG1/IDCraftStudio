import { useEffect, useRef, useState } from 'react';
import { EXAMPLES, generate, samplePerson, understand, type Brief, type Generated, type Kind, type Style } from '../lib/generator';
import { renderSideToDataURL } from '../lib/render';
import { useStore } from '../lib/store';
import { Field, Modal, toast } from './ui';

const KINDS: [Kind, string][] = [
  ['school', 'School'], ['college', 'College'], ['corporate', 'Company / Employee'], ['medical', 'Hospital / Medical'],
  ['event', 'Event / Conference'], ['member', 'Membership / Club'], ['press', 'Press / Media'], ['security', 'Security'], ['visitor', 'Visitor'],
];
const STYLES: [Style, string][] = [['modern', 'Modern'], ['classic', 'Classic'], ['minimal', 'Minimal'], ['bold', 'Bold'], ['dark', 'Dark']];

export function GeneratorDialog({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [brief, setBrief] = useState<Brief | null>(null);
  const [seed, setSeed] = useState(0);
  const [designs, setDesigns] = useState<(Generated & { preview?: string; back?: string })[]>([]);
  const [busy, setBusy] = useState(false);

  const runId = useRef(0);
  const run = async (b: Brief, s: number) => {
    const id = ++runId.current; // newer requests replace older ones
    setBusy(true);
    const list = generate(b, 6, s);
    setDesigns(list);
    const withPreviews: (Generated & { preview?: string; back?: string })[] = [];
    try {
      for (const d of list) {
        const person = samplePerson(d.template);
        const preview = await renderSideToDataURL(d.template, 'front', person, 110, 'image/png');
        const back = await renderSideToDataURL(d.template, 'back', person, 110, 'image/png');
        if (id !== runId.current) return;
        withPreviews.push({ ...d, preview, back });
        setDesigns([...withPreviews, ...list.slice(withPreviews.length)]);
      }
    } catch (e) {
      if (id === runId.current) toast(`Preview failed: ${(e as Error).message}`, 'error');
    } finally {
      if (id === runId.current) setBusy(false);
    }
  };

  const start = (text = prompt) => {
    const b = understand(text);
    setBrief(b);
    setSeed(0);
    run(b, 0);
  };

  const tweak = (patch: Partial<Brief>) => {
    if (!brief) return;
    const b = { ...brief, ...patch };
    setBrief(b);
    run(b, seed);
  };

  useEffect(() => {
    const ta = document.querySelector<HTMLTextAreaElement>('.gen-prompt');
    ta?.focus();
  }, []);

  const use = async (d: Generated) => {
    await useStore.getState().addTemplate(d.template);
    toast('Design added. Edit anything you like.');
    onClose();
  };

  return (
    <Modal title="✨ Design a card with AI" onClose={onClose} width={1040}>
      <div className="gen">
        <div className="gen-input">
          <textarea
            className="gen-prompt"
            rows={2}
            placeholder="Describe the card, e.g. “School ID card in blue for 'Sunrise Public School' with QR code” or “मराठी शाळा ओळखपत्र हिरव्या रंगात”"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                start();
              }
            }}
          />
          <button className="btn ai" onClick={() => start()} disabled={busy}>
            ✨ Generate
          </button>
        </div>
        <div className="chips">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              className="chip"
              onClick={() => {
                setPrompt(ex);
                start(ex);
              }}
            >
              {ex}
            </button>
          ))}
        </div>

        {brief && (
          <div className="gen-brief">
            <Field label="Card type">
              <select value={brief.kind} onChange={(e) => tweak({ kind: e.target.value as Kind })}>
                {KINDS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Language">
              <select value={brief.lang} onChange={(e) => tweak({ lang: e.target.value as Brief['lang'] })}>
                <option value="en">English</option>
                <option value="mr">मराठी</option>
              </select>
            </Field>
            <Field label="Shape">
              <select value={brief.portrait ? 'p' : 'l'} onChange={(e) => tweak({ portrait: e.target.value === 'p' })}>
                <option value="p">Portrait</option>
                <option value="l">Landscape</option>
              </select>
            </Field>
            <Field label="Style">
              <select value={brief.style} onChange={(e) => tweak({ style: e.target.value as Style })}>
                {STYLES.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Colour">
              <input type="color" value={brief.color} onChange={(e) => tweak({ color: e.target.value })} />
            </Field>
            <Field label="Code">
              <select value={brief.code} onChange={(e) => tweak({ code: e.target.value as Brief['code'] })}>
                <option value="barcode">Barcode</option>
                <option value="qr">QR code</option>
                <option value="both">Both</option>
                <option value="none">None</option>
              </select>
            </Field>
            <Field label="Organisation name">
              <input value={brief.orgName} placeholder="(placeholder)" onChange={(e) => setBrief({ ...brief, orgName: e.target.value })} onBlur={() => run(brief, seed)} />
            </Field>
          </div>
        )}

        {designs.length > 0 && (
          <>
            <div className="gen-grid">
              {designs.map((d, i) => (
                <div key={d.template.id} className="gen-card" onClick={() => !busy && use(d)} title="Use this design">
                  <div className="gen-thumbs">
                    {d.preview ? <img src={d.preview} alt={`Design ${i + 1} front`} /> : <div className="gen-ph">…</div>}
                    {d.back && <img className="back" src={d.back} alt={`Design ${i + 1} back`} />}
                  </div>
                  <div className="gen-label">
                    <span>{d.label}</span>
                    <b>Use →</b>
                  </div>
                </div>
              ))}
            </div>
            <div className="btn-row center">
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  const s = seed + 1;
                  setSeed(s);
                  run(brief!, s);
                }}
              >
                ↻ Show 6 more designs
              </button>
            </div>
          </>
        )}
        {!brief && <p className="hint">Runs entirely on this computer. Write in English or Marathi, or pick an example above.</p>}
      </div>
    </Modal>
  );
}
