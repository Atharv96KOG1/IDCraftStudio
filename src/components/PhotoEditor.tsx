import { useEffect, useRef, useState } from 'react';
import {
  ASPECTS,
  BACKGROUNDS,
  NEUTRAL_COLOUR,
  analyze,
  autoColour,
  autoCrop,
  defaultEdit,
  loadSource,
  renderPhoto,
  type Analysis,
  type PhotoEdit,
} from '../lib/photoAI';
import { ColorInput, Modal, NumberInput, toast } from './ui';
import { canvasToBlob, revealFile, saveFile } from '../lib/files';

const PREVIEW_H = 520;

/**
 * Photo editor with one-click AI (face crop, straighten, colour, background)
 * and full manual control. `source` is the original image.
 */
export function PhotoEditor({
  source,
  autoRun,
  onSave,
  onCancel,
}: {
  source: string;
  autoRun: boolean;
  onSave: (photo: string, original: string) => void;
  onCancel: () => void;
}) {
  const [src, setSrc] = useState<HTMLCanvasElement | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [edit, setEdit] = useState<PhotoEdit | null>(null);
  const [busy, setBusy] = useState<string | null>('Loading photo…');
  const [status, setStatus] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const [guide, setGuide] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const base = useRef(1);
  const [custom, setCustom] = useState(false);
  const [size, setSize] = useState({ w: 30, h: 40 });
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const presetIndex = edit ? ASPECTS.findIndex((a) => Math.abs(a.value - edit.aspect) < 0.001 && a.w === size.w) : -1;
  const preset = custom ? -1 : presetIndex >= 0 ? presetIndex : edit ? ASPECTS.findIndex((a) => Math.abs(a.value - edit.aspect) < 0.001) : 0;

  const savePhotoFile = async () => {
    if (!src || !edit) return;
    const outH = Math.round((size.h / 25.4) * 300);
    const canvas = renderPhoto(src, analysis, { ...edit, aspect: size.w / size.h }, outH);
    const file = await saveFile('Photos', `Photo ${round1(size.w)}x${round1(size.h)}mm ${Date.now()}.jpg`, await canvasToBlob(canvas, 'jpg', 300));
    if (file) await revealFile(file);
    toast('Photo saved.');
  };

  // Load the source image.
  useEffect(() => {
    let alive = true;
    loadSource(source)
      .then((c) => {
        if (!alive) return;
        setSrc(c);
        const e = defaultEdit(c);
        base.current = e.cropH;
        setEdit(e);
        setBusy(null);
        if (autoRun) runAI(c, e);
      })
      .catch(() => {
        setBusy(null);
        toast('Could not open this image.', 'error');
        onCancel();
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  // Live preview.
  useEffect(() => {
    if (!src || !edit || !canvasRef.current) return;
    const id = requestAnimationFrame(() => {
      const r = renderPhoto(src, analysis, edit, PREVIEW_H);
      const c = canvasRef.current!;
      c.width = r.width;
      c.height = r.height;
      c.getContext('2d')!.drawImage(r, 0, 0);
    });
    return () => cancelAnimationFrame(id);
  }, [src, analysis, edit]);

  async function ensureAnalysis(c: HTMLCanvasElement) {
    if (analysis) return analysis;
    setBusy('Starting AI… (first time takes a few seconds)');
    const a = await analyze(c);
    setAnalysis(a);
    return a;
  }

  async function runAI(c = src!, e = edit!) {
    try {
      const a = await ensureAnalysis(c);
      setBusy(null);
      const next: PhotoEdit = {
        ...e,
        ...autoCrop(a),
        ...autoColour(c, a),
        background: e.background ?? '#ffffff',
      };
      if (a.face) base.current = Math.max(base.current, next.cropH);
      setEdit(next);
      setStatus(
        a.face
          ? {
              kind: a.facesFound > 1 ? 'warn' : 'ok',
              text:
                a.facesFound > 1
                  ? `${a.facesFound} faces found. Used the largest one; check the crop.`
                  : `Face found (${Math.round(a.face.score * 100)}% sure). Cropped, straightened and colour-corrected.`,
            }
          : { kind: 'warn', text: 'No face found. Colours were corrected; please crop by hand.' },
      );
    } catch (err) {
      setBusy(null);
      setStatus({ kind: 'warn', text: `AI could not run on this computer: ${(err as Error).message}` });
    }
  }

  async function aiColourOnly() {
    if (!src || !edit) return;
    const a = await ensureAnalysis(src).catch(() => null);
    setBusy(null);
    setEdit({ ...edit, ...autoColour(src, a ?? { face: null, facesFound: 0, person: null, skin: null, headTop: null }) });
  }

  async function setBackground(bg: string | null) {
    if (!src || !edit) return;
    if (bg) {
      try {
        await ensureAnalysis(src);
      } catch (err) {
        setStatus({ kind: 'warn', text: `Background removal unavailable: ${(err as Error).message}` });
      }
      setBusy(null);
    }
    setEdit({ ...edit, background: bg });
  }

  if (!edit || !src) {
    return (
      <Modal title="Edit photo" onClose={onCancel} width={420}>
        <p className="hint">{busy ?? 'Loading…'}</p>
      </Modal>
    );
  }

  const set = (p: Partial<PhotoEdit>) => setEdit({ ...edit, ...p });
  const zoom = base.current / edit.cropH;
  const displayH = canvasRef.current?.getBoundingClientRect().height || PREVIEW_H;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    const k = edit.cropH / displayH;
    const t = (-edit.rotation * Math.PI) / 180;
    const sx = (dx * Math.cos(t) - dy * Math.sin(t)) * k * (edit.flipX ? -1 : 1);
    const sy = (dx * Math.sin(t) + dy * Math.cos(t)) * k;
    set({ cx: edit.cx - sx, cy: edit.cy - sy });
  };
  const onWheel = (e: React.WheelEvent) => {
    set({ cropH: Math.max(40, Math.min(base.current * 1.5, edit.cropH * (e.deltaY > 0 ? 1.08 : 1 / 1.08))) });
  };

  const save = () => {
    const out = renderPhoto(src, analysis, edit, 800).toDataURL('image/jpeg', 0.92);
    const original = (() => {
      const r = Math.min(1, 1400 / Math.max(src.width, src.height));
      if (r === 1) return src.toDataURL('image/jpeg', 0.9);
      const c = document.createElement('canvas');
      c.width = Math.round(src.width * r);
      c.height = Math.round(src.height * r);
      c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.9);
    })();
    onSave(out, original);
  };

  const slider = (key: keyof typeof NEUTRAL_COLOUR, label: string, min = -100, max = 100) => (
    <label className="slider">
      <span>
        {label}
        <b>{edit[key]}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={edit[key]}
        onChange={(e) => {
          set({ [key]: Number(e.target.value) });
          if (key === 'smoothing' && !analysis) ensureAnalysis(src).then(() => setBusy(null), () => setBusy(null));
        }}
        onDoubleClick={() => set({ [key]: 0 })}
      />
    </label>
  );

  return (
    <Modal
      title="Edit photo"
      onClose={onCancel}
      width={980}
      footer={
        <>
          <span className="hint">Drag the photo to move it · scroll to zoom · double-click a slider to reset it</span>
          <span className="grow" />
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={!!busy}>
            Use this photo
          </button>
        </>
      }
    >
      <div className="photo-editor">
        <div className="pe-stage">
          <div className="pe-frame" style={{ aspectRatio: String(edit.aspect) }}>
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              onWheel={onWheel}
            />
            {guide && (
              <svg className="pe-guide" viewBox="0 0 100 100" preserveAspectRatio="none">
                <ellipse cx="50" cy="40" rx="24" ry="27" />
                <line x1="50" y1="0" x2="50" y2="100" />
              </svg>
            )}
            {busy && <div className="pe-busy">{busy}</div>}
          </div>
          <label className="toggle">
            <input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} />
            <span>Show face guide</span>
          </label>
        </div>

        <div className="pe-controls">
          <button className="btn ai" onClick={() => runAI()} disabled={!!busy}>
            ✨ Auto-fix with AI
          </button>
          {status && <p className={`pe-status ${status.kind}`}>{status.text}</p>}

          <section>
            <h3>Crop</h3>
            <select
              value={preset >= 0 ? preset : 'custom'}
              onChange={(e) => {
                if (e.target.value === 'custom') return setCustom(true);
                setCustom(false);
                const a = ASPECTS[Number(e.target.value)];
                setSize({ w: a.w, h: a.h });
                set({ aspect: a.value });
              }}
            >
              {ASPECTS.map((a, i) => (
                <option key={a.label} value={i}>
                  {a.label}
                </option>
              ))}
              <option value="custom">Custom size…</option>
            </select>
            {preset < 0 && (
              <div className="grid2">
                <label className="field">
                  <span>Width (mm)</span>
                  <NumberInput value={size.w} min={5} step={1} onChange={(w) => (setSize({ ...size, w }), set({ aspect: w / size.h }))} />
                </label>
                <label className="field">
                  <span>Height (mm)</span>
                  <NumberInput value={size.h} min={5} step={1} onChange={(h) => (setSize({ ...size, h }), set({ aspect: size.w / h }))} />
                </label>
              </div>
            )}
            <button className="btn" onClick={savePhotoFile} title="Save this photo as a JPG at 300 dpi in its real size">
              💾 Save {round1(size.w)} × {round1(size.h)} mm photo (300 dpi)
            </button>
            <label className="slider">
              <span>
                Zoom<b>{zoom.toFixed(2)}×</b>
              </span>
              <input
                type="range"
                min={0.7}
                max={6}
                step={0.01}
                value={zoom}
                onChange={(e) => set({ cropH: base.current / Number(e.target.value) })}
              />
            </label>
            <label className="slider">
              <span>
                Straighten<b>{edit.rotation}°</b>
              </span>
              <input type="range" min={-45} max={45} step={0.5} value={edit.rotation} onChange={(e) => set({ rotation: Number(e.target.value) })} />
            </label>
            <div className="btn-row tight">
              <button onClick={() => set({ rotation: edit.rotation - 90 })} title="Rotate left">
                ↺ 90°
              </button>
              <button onClick={() => set({ rotation: edit.rotation + 90 })} title="Rotate right">
                ↻ 90°
              </button>
              <button className={edit.flipX ? 'on' : ''} onClick={() => set({ flipX: !edit.flipX })}>
                ⇋ Mirror
              </button>
              <button
                onClick={() => {
                  const d = defaultEdit(src, edit.aspect);
                  set({ cx: d.cx, cy: d.cy, cropH: d.cropH, rotation: 0, flipX: false });
                }}
              >
                Reset
              </button>
            </div>
          </section>

          <section>
            <h3>Background (AI)</h3>
            <div className="bg-swatches">
              {BACKGROUNDS.map((b) => (
                <button
                  key={b.label}
                  className={`swatch${edit.background === b.value ? ' on' : ''}`}
                  title={b.label}
                  style={{ background: b.value ?? 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 10px 10px' }}
                  onClick={() => setBackground(b.value)}
                >
                  {b.value === null ? 'Original' : ''}
                </button>
              ))}
              <ColorInput value={edit.background ?? '#ffffff'} onChange={(c) => setBackground(c)} />
            </div>
          </section>

          <section>
            <div className="row between">
              <h3>Colour &amp; light</h3>
              <div className="btn-row tight">
                <button onClick={aiColourOnly}>✨ Auto colour</button>
                <button onClick={() => set({ ...NEUTRAL_COLOUR })}>Reset</button>
              </div>
            </div>
            {slider('brightness', 'Brightness')}
            {slider('contrast', 'Contrast')}
            {slider('saturation', 'Saturation')}
            {slider('warmth', 'Warmth')}
            {slider('tint', 'Tint (green ↔ magenta)')}
            {slider('sharpness', 'Sharpness', 0, 100)}
            {slider('smoothing', 'Skin smoothing (AI)', 0, 100)}
          </section>
        </div>
      </div>
    </Modal>
  );
}
