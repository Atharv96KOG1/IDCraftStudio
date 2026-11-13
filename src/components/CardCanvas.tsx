import { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { useLiveQuery } from 'dexie-react-hooks';
import { useStore } from '../lib/store';
import { buildSide } from '../lib/render';
import { db } from '../lib/db';
import { round2 } from '../lib/utils';

const PAD = 48;

export function CardCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const cardRef = useRef<Konva.Group | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const guidesRef = useRef<Konva.Group | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  const template = useStore((s) => s.template)!;
  const side = useStore((s) => s.side);
  const selectedId = useStore((s) => s.selectedId);
  const zoom = useStore((s) => s.zoom);
  const previewId = useStore((s) => s.previewPersonId);
  const person = useLiveQuery(() => (previewId ? db.people.get(previewId) : undefined), [previewId]) ?? null;

  const fit = Math.max(1, Math.min((size.w - PAD * 2) / template.widthMm, (size.h - PAD * 2) / template.heightMm));
  const scale = fit * zoom;
  const cardW = template.widthMm * scale;
  const cardH = template.heightMm * scale;
  const offX = Math.max(PAD, (size.w - cardW) / 2);
  const offY = Math.max(PAD, (size.h - cardH) / 2);

  // Create the stage once.
  useEffect(() => {
    const stage = new Konva.Stage({ container: hostRef.current!, width: 10, height: 10 });
    const layer = new Konva.Layer();
    const tr = new Konva.Transformer({
      rotateEnabled: true,
      keepRatio: false,
      ignoreStroke: true,
      anchorSize: 9,
      anchorCornerRadius: 2,
      borderStroke: '#2563eb',
      anchorStroke: '#2563eb',
      rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
      rotationSnapTolerance: 4,
      boundBoxFunc: (oldBox, newBox) => (Math.abs(newBox.width) < 4 || Math.abs(newBox.height) < 4 ? oldBox : newBox),
    });
    const guides = new Konva.Group({ listening: false });
    layer.add(tr);
    layer.add(guides);
    stage.add(layer);
    stage.on('mousedown touchstart', (e) => {
      if (e.target === stage || e.target.hasName('card-bg')) useStore.getState().select(null);
    });
    stageRef.current = stage;
    layerRef.current = layer;
    trRef.current = tr;
    guidesRef.current = guides;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: Math.floor(entry.contentRect.width), h: Math.floor(entry.contentRect.height) });
    });
    ro.observe(hostRef.current!.parentElement!);
    return () => {
      ro.disconnect();
      stage.destroy();
    };
  }, []);

  // Resize the stage so a zoomed-in card can be scrolled.
  useEffect(() => {
    stageRef.current?.size({ width: Math.max(size.w, cardW + PAD * 2), height: Math.max(size.h, cardH + PAD * 2) });
  }, [size, cardW, cardH]);

  // Rebuild the card whenever the design, side, zoom or preview record changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const card = await buildSide(template, side, { scale, person, placeholders: true });
      if (cancelled) {
        card.destroy();
        return;
      }
      card.position({ x: offX, y: offY });
      wireElements(card, scale);
      cardRef.current?.destroy();
      cardRef.current = card;
      const layer = layerRef.current!;
      layer.add(card);
      card.moveToBottom();
      // Outline + soft shadow sit under the card.
      layer.findOne('.outline')?.destroy();
      const outline = new Konva.Rect({
        name: 'outline',
        x: offX,
        y: offY,
        width: cardW,
        height: cardH,
        stroke: '#94a3b8',
        strokeWidth: 1,
        listening: false,
        shadowColor: '#0f172a',
        shadowBlur: 18,
        shadowOpacity: 0.12,
        shadowForStrokeEnabled: true,
      });
      layer.add(outline);
      outline.moveToBottom();
      guidesRef.current!.position({ x: offX, y: offY });
      attachTransformer();
      layer.batchDraw();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, side, scale, person, offX, offY]);

  useEffect(attachTransformer, [selectedId]);

  function attachTransformer() {
    const tr = trRef.current;
    if (!tr) return;
    const { selectedId: id, template: t, side: sd } = useStore.getState();
    const el = t?.[sd].elements.find((e) => e.id === id);
    const node = id ? cardRef.current?.getChildren((n) => n.id() === id)[0] : undefined;
    tr.nodes(node && el && !el.locked && !el.hidden ? [node] : []);
    tr.enabledAnchors(
      el?.type === 'line'
        ? ['middle-left', 'middle-right']
        : ['top-left', 'top-center', 'top-right', 'middle-right', 'middle-left', 'bottom-left', 'bottom-center', 'bottom-right'],
    );
    tr.moveToTop();
    tr.getLayer()?.batchDraw();
  }

  function wireElements(card: Konva.Group, s: number) {
    const st = useStore.getState();
    const elements = st.template![st.side].elements;
    for (const node of card.getChildren((n) => n.hasName('element'))) {
      const el = elements.find((e) => e.id === node.id());
      if (!el) continue;
      node.draggable(!el.locked);
      node.on('mousedown touchstart', (e) => {
        e.cancelBubble = true;
        useStore.getState().select(el.id);
      });
      node.on('mouseenter', () => (stageRef.current!.container().style.cursor = el.locked ? 'default' : 'move'));
      node.on('mouseleave', () => (stageRef.current!.container().style.cursor = 'default'));
      node.on('dragmove', () => snap(node, el.id, s));
      node.on('dragend', () => {
        guidesRef.current!.destroyChildren();
        useStore.getState().updateElement(el.id, { x: round2(node.x() / s), y: round2(node.y() / s) });
      });
      node.on('transformend', () => {
        const cur = useStore.getState().template![useStore.getState().side].elements.find((e) => e.id === el.id)!;
        const w = Math.max(1, round2(cur.w * Math.abs(node.scaleX())));
        const h = cur.type === 'line' ? cur.h : Math.max(1, round2(cur.h * Math.abs(node.scaleY())));
        node.scale({ x: 1, y: 1 });
        useStore.getState().updateElement(el.id, {
          x: round2(node.x() / s),
          y: round2(node.y() / s),
          w,
          h,
          rotation: Math.round(node.rotation() * 10) / 10,
        });
      });
    }
  }

  /** Snap to card edges/centre and to other elements' edges/centres. */
  function snap(node: Konva.Node, id: string, s: number) {
    const st = useStore.getState();
    const t = st.template!;
    const el = t[st.side].elements.find((e) => e.id === id)!;
    const guides = guidesRef.current!;
    guides.destroyChildren();
    if (el.rotation % 360 !== 0) return;
    const threshold = 5 / s; // 5 screen px in mm
    const vTargets = [0, t.widthMm / 2, t.widthMm];
    const hTargets = [0, t.heightMm / 2, t.heightMm];
    for (const o of t[st.side].elements) {
      if (o.id === id || o.hidden) continue;
      vTargets.push(o.x, o.x + o.w / 2, o.x + o.w);
      hTargets.push(o.y, o.y + o.h / 2, o.y + o.h);
    }
    let x = node.x() / s;
    let y = node.y() / s;
    const best = (pos: number, size: number, targets: number[]) => {
      let found: { delta: number; line: number } | null = null;
      for (const edge of [pos, pos + size / 2, pos + size]) {
        for (const tg of targets) {
          const d = tg - edge;
          if (Math.abs(d) < threshold && (!found || Math.abs(d) < Math.abs(found.delta))) found = { delta: d, line: tg };
        }
      }
      return found;
    };
    const bx = best(x, el.w, vTargets);
    const by = best(y, el.h, hTargets);
    if (bx) {
      x += bx.delta;
      guides.add(new Konva.Line({ points: [bx.line * s, -2000, bx.line * s, 2000], stroke: '#ec4899', strokeWidth: 1, dash: [4, 3] }));
    }
    if (by) {
      y += by.delta;
      guides.add(new Konva.Line({ points: [-2000, by.line * s, 2000, by.line * s], stroke: '#ec4899', strokeWidth: 1, dash: [4, 3] }));
    }
    node.position({ x: x * s, y: y * s });
  }

  return (
    <div className="canvas-scroll">
      <div ref={hostRef} />
    </div>
  );
}
