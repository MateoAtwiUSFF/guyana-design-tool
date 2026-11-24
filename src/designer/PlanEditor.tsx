// 2D plan editor: draw walls, rooms, doors, windows and furniture with a
// finger or mouse. One finger draws or moves; two fingers pan and zoom.
import { useEffect, useMemo, useRef, useState } from 'react';
import { FURNITURE, OPENING_DEFAULTS, ROOM_TYPES } from '../model/catalog';
import { uid } from '../model/factory';
import { dist, pointAlong, samePt, storyBounds, wallLength } from '../model/geometry';
import type { Design, Pt, Story, Wall } from '../model/types';
import { currentStory, useDesign } from '../state/design-store';

const SNAP_FT = 0.5;
const fmtLen = (ft: number) => {
  const inches = Math.round(ft * 12);
  const f = Math.floor(inches / 12);
  const i = inches % 12;
  return i ? `${f}' ${i}"` : `${f}'`;
};

interface ViewBox {
  cx: number;
  cy: number;
  scale: number; // px per foot
}

type Drag =
  | { kind: 'pan'; start: Pt; vb: ViewBox }
  | { kind: 'rect'; a: Pt; b: Pt }
  | { kind: 'room'; a: Pt; b: Pt }
  | { kind: 'wallPoint'; p: Pt }
  | { kind: 'endpoint'; from: Pt }
  | { kind: 'furniture'; id: string; offset: Pt }
  | { kind: 'roomMove'; id: string; offset: Pt }
  | { kind: 'opening'; id: string }
  | null;

const projectOnWall = (p: Pt, w: Wall) => {
  const L = wallLength(w) || 1;
  const t = ((p.x - w.a.x) * (w.b.x - w.a.x) + (p.y - w.a.y) * (w.b.y - w.a.y)) / (L * L);
  const tc = Math.max(0, Math.min(1, t));
  const q = { x: w.a.x + tc * (w.b.x - w.a.x), y: w.a.y + tc * (w.b.y - w.a.y) };
  return { offset: tc * L, d: dist(p, q) };
};

const nearestWall = (story: Story, p: Pt, maxFt: number) => {
  let best: { wall: Wall; offset: number; d: number } | null = null;
  for (const w of story.walls) {
    const r = projectOnWall(p, w);
    if (r.d <= maxFt && (!best || r.d < best.d)) best = { wall: w, ...r };
  }
  return best;
};

export function PlanEditor() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const design = useDesign((s) => s.design);
  const storyIndex = useDesign((s) => s.storyIndex);
  const story = currentStory({ design, storyIndex });
  const below = storyIndex > 0 ? design.stories[storyIndex - 1] : undefined;
  const tool = useDesign((s) => s.tool);
  const selection = useDesign((s) => s.selection);
  const { change, replace, checkpoint, select } = useDesign.getState();

  const [vb, setVb] = useState<ViewBox>(() => fitView(design.stories[0]!, 800, 600));
  const [drag, setDrag] = useState<Drag>(null);
  const [chain, setChain] = useState<Pt[]>([]);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const pointers = useRef(new Map<number, Pt>());
  const pinch = useRef<{ d: number; mid: Pt; vb: ViewBox } | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the plan once we know the real size.
  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current && size.w > 0 && size.w !== 800) {
      fitted.current = true;
      setVb(fitView(story, size.w, size.h));
    }
  }, [size, story]);

  // Leaving the wall tool ends the chain.
  useEffect(() => {
    if (tool.kind !== 'wall') setChain([]);
  }, [tool]);

  const toPlan = (clientX: number, clientY: number): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      x: vb.cx + (clientX - r.left - size.w / 2) / vb.scale,
      y: vb.cy + (clientY - r.top - size.h / 2) / vb.scale,
    };
  };

  const snapTol = 14 / vb.scale; // 14 px in feet
  const allEndpoints = useMemo(() => story.walls.flatMap((w) => [w.a, w.b]), [story]);
  const snap = (p: Pt, extra: Pt[] = []): Pt => {
    for (const q of [...allEndpoints, ...extra]) if (dist(p, q) < snapTol) return { ...q };
    const g = (v: number) => Math.round(v / SNAP_FT) * SNAP_FT;
    let s = { x: g(p.x), y: g(p.y) };
    // Make near-straight lines straight from the last chain point.
    const last = extra[extra.length - 1];
    if (last) {
      if (Math.abs(s.x - last.x) < snapTol) s = { ...s, x: last.x };
      if (Math.abs(s.y - last.y) < snapTol) s = { ...s, y: last.y };
    }
    return s;
  };

  const finishChain = (close: boolean) => {
    if (tool.kind !== 'wall') return;
    const pts = chain;
    if (pts.length >= 2) {
      change((d) => {
        const st = d.stories[storyIndex]!;
        for (let i = 0; i < pts.length - 1; i++) {
          st.walls.push({ id: uid('wall'), a: pts[i]!, b: pts[i + 1]!, exterior: tool.exterior });
        }
        if (close && pts.length >= 3) {
          st.walls.push({ id: uid('wall'), a: pts[pts.length - 1]!, b: pts[0]!, exterior: tool.exterior });
        }
      });
    }
    setChain([]);
  };

  const hitTest = (p: Pt) => {
    const tol = 12 / vb.scale;
    for (const o of story.openings) {
      const w = story.walls.find((x) => x.id === o.wallId);
      if (w && dist(pointAlong(w, o.offsetFt), p) < Math.max(tol, o.widthFt / 2)) return { kind: 'opening' as const, id: o.id };
    }
    for (const f of [...story.furniture].reverse()) {
      const c = FURNITURE[f.kind];
      if (Math.abs(p.x - f.x) < c.w / 2 && Math.abs(p.y - f.y) < c.d / 2) return { kind: 'furniture' as const, id: f.id };
    }
    const nw = nearestWall(story, p, tol);
    if (nw) return { kind: 'wall' as const, id: nw.wall.id };
    for (const r of [...story.rooms].reverse()) {
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return { kind: 'room' as const, id: r.id };
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    svgRef.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Pt, Pt];
      pinch.current = { d: dist(a, b), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, vb };
      setDrag(null);
      return;
    }
    if (pointers.current.size > 2) return;
    const raw = toPlan(e.clientX, e.clientY);

    switch (tool.kind) {
      case 'wall': {
        const p = snap(raw, chain);
        setDrag({ kind: 'wallPoint', p });
        setCursor(p);
        return;
      }
      case 'rect': {
        const p = snap(raw);
        setDrag({ kind: 'rect', a: p, b: p });
        return;
      }
      case 'room': {
        const p = snap(raw);
        setDrag({ kind: 'room', a: p, b: p });
        return;
      }
      case 'opening': {
        const nw = nearestWall(story, raw, 24 / vb.scale);
        if (!nw) return;
        const def =
          tool.opening === 'window' ? OPENING_DEFAULTS.window : nw.wall.exterior ? OPENING_DEFAULTS.door : OPENING_DEFAULTS.interiorDoor;
        const L = wallLength(nw.wall);
        if (L < def.widthFt + 0.5) return;
        const offset = Math.max(def.widthFt / 2 + 0.25, Math.min(L - def.widthFt / 2 - 0.25, Math.round(nw.offset * 2) / 2));
        const id = uid('op');
        change((d) => {
          d.stories[storyIndex]!.openings.push({ id, wallId: nw.wall.id, kind: tool.opening, offsetFt: offset, ...def });
        });
        select({ kind: 'opening', id });
        return;
      }
      case 'furniture': {
        const p = snap(raw);
        const id = uid('f');
        change((d) => {
          d.stories[storyIndex]!.furniture.push({ id, kind: tool.furniture, x: p.x, y: p.y, rotation: 0 });
        });
        select({ kind: 'furniture', id });
        return;
      }
      case 'select': {
        // Wall endpoint handles of the selected wall come first.
        if (selection?.kind === 'wall') {
          const w = story.walls.find((x) => x.id === selection.id);
          const end = w && [w.a, w.b].find((q) => dist(q, raw) < 16 / vb.scale);
          if (end) {
            checkpoint();
            setDrag({ kind: 'endpoint', from: { ...end } });
            return;
          }
        }
        const hit = hitTest(raw);
        select(hit);
        if (hit?.kind === 'furniture') {
          const f = story.furniture.find((x) => x.id === hit.id)!;
          checkpoint();
          setDrag({ kind: 'furniture', id: hit.id, offset: { x: raw.x - f.x, y: raw.y - f.y } });
        } else if (hit?.kind === 'room') {
          const r = story.rooms.find((x) => x.id === hit.id)!;
          checkpoint();
          setDrag({ kind: 'roomMove', id: hit.id, offset: { x: raw.x - r.x, y: raw.y - r.y } });
        } else if (hit?.kind === 'opening') {
          checkpoint();
          setDrag({ kind: 'opening', id: hit.id });
        } else if (!hit) {
          setDrag({ kind: 'pan', start: { x: e.clientX, y: e.clientY }, vb });
        }
        return;
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Pt, Pt];
      const p0 = pinch.current;
      const scale = clampScale(p0.vb.scale * (dist(a, b) / (p0.d || 1)));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      setVb({
        scale,
        cx: p0.vb.cx - (mid.x - p0.mid.x) / scale,
        cy: p0.vb.cy - (mid.y - p0.mid.y) / scale,
      });
      return;
    }
    const raw = toPlan(e.clientX, e.clientY);
    if (tool.kind === 'wall' && !drag) setCursor(snap(raw, chain));
    if (!drag) return;
    switch (drag.kind) {
      case 'pan':
        setVb({
          ...drag.vb,
          cx: drag.vb.cx - (e.clientX - drag.start.x) / drag.vb.scale,
          cy: drag.vb.cy - (e.clientY - drag.start.y) / drag.vb.scale,
        });
        return;
      case 'rect':
      case 'room':
        setDrag({ ...drag, b: snap(raw) });
        return;
      case 'wallPoint': {
        const p = snap(raw, chain);
        setDrag({ kind: 'wallPoint', p });
        setCursor(p);
        return;
      }
      case 'endpoint': {
        const to = snap(raw);
        const from = drag.from;
        if (samePt(to, from)) return;
        replace((d) => {
          const st = d.stories[storyIndex]!;
          for (const w of st.walls) {
            if (samePt(w.a, from)) w.a = { ...to };
            if (samePt(w.b, from)) w.b = { ...to };
          }
        });
        setDrag({ kind: 'endpoint', from: to });
        return;
      }
      case 'furniture':
        replace((d) => {
          const f = d.stories[storyIndex]!.furniture.find((x) => x.id === drag.id);
          if (f) {
            f.x = Math.round((raw.x - drag.offset.x) * 4) / 4;
            f.y = Math.round((raw.y - drag.offset.y) * 4) / 4;
          }
        });
        return;
      case 'roomMove':
        replace((d) => {
          const r = d.stories[storyIndex]!.rooms.find((x) => x.id === drag.id);
          if (r) {
            r.x = Math.round((raw.x - drag.offset.x) * 2) / 2;
            r.y = Math.round((raw.y - drag.offset.y) * 2) / 2;
          }
        });
        return;
      case 'opening':
        replace((d) => {
          const st = d.stories[storyIndex]!;
          const o = st.openings.find((x) => x.id === drag.id);
          const w = o && st.walls.find((x) => x.id === o.wallId);
          if (!o || !w) return;
          const L = wallLength(w);
          const off = Math.round(projectOnWall(raw, w).offset * 4) / 4;
          o.offsetFt = Math.max(o.widthFt / 2, Math.min(L - o.widthFt / 2, off));
        });
        return;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (!drag) return;
    switch (drag.kind) {
      case 'wallPoint': {
        const p = drag.p;
        const first = chain[0];
        if (first && chain.length >= 3 && samePt(p, first)) {
          finishChain(true);
        } else if (chain.length && samePt(p, chain[chain.length - 1]!)) {
          // Tapping the last point again finishes the chain.
          finishChain(false);
        } else {
          setChain([...chain, p]);
        }
        break;
      }
      case 'rect': {
        const { a, b } = drag;
        const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
        if (w >= 4 && h >= 4) {
          const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
          change((d) => {
            const st = d.stories[storyIndex]!;
            const pts = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
            pts.forEach((p, i) => st.walls.push({ id: uid('wall'), a: p, b: pts[(i + 1) % 4]!, exterior: true }));
          });
        }
        break;
      }
      case 'room': {
        if (tool.kind !== 'room') break;
        const { a, b } = drag;
        const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
        if (w >= 3 && h >= 3) {
          const id = uid('room');
          const type = tool.room;
          change((d) => {
            const st = d.stories[storyIndex]!;
            const n = st.rooms.filter((r) => r.type === type).length + 1;
            st.rooms.push({ id, type, name: `${ROOM_TYPES[type].label}${n > 1 ? ' ' + n : ''}`, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w, h });
          });
          select({ kind: 'room', id });
        }
        break;
      }
    }
    setDrag(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const before = toPlan(e.clientX, e.clientY);
    const scale = clampScale(vb.scale * Math.exp(-e.deltaY * 0.0015));
    setVb({
      scale,
      cx: before.x - (e.clientX - r.left - size.w / 2) / scale,
      cy: before.y - (e.clientY - r.top - size.h / 2) / scale,
    });
  };

  // Keyboard: Escape ends a chain, Enter finishes it, Delete removes selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Escape') setChain([]);
      if (e.key === 'Enter') finishChain(false);
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection) deleteSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const transform = `translate(${size.w / 2 - vb.cx * vb.scale} ${size.h / 2 - vb.cy * vb.scale}) scale(${vb.scale})`;
  const px = 1 / vb.scale; // one screen pixel in feet

  return (
    <div className="plan-wrap">
      <svg
        ref={svgRef}
        className="plan"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setCursor(null)}
        onWheel={onWheel}
      >
        <g transform={transform}>
          <Grid vb={vb} size={size} />
          {below && <Ghost story={below} px={px} />}
          {story.rooms.map((r) => (
            <g key={r.id}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={ROOM_TYPES[r.type].color} opacity={0.85}
                stroke={selection?.id === r.id ? 'var(--accent)' : 'none'} strokeWidth={3 * px} />
              <text x={r.x + r.w / 2} y={r.y + r.h / 2} fontSize={13 * px} textAnchor="middle" className="room-label">{r.name}</text>
              <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 15 * px} fontSize={11 * px} textAnchor="middle" className="room-sub">
                {Math.round(r.w * r.h)} sq ft
              </text>
            </g>
          ))}
          {story.walls.map((w) => (
            <WallShape key={w.id} wall={w} story={story} px={px} selected={selection?.id === w.id} selectedOpening={selection?.kind === 'opening' ? selection.id : null} />
          ))}
          {story.furniture.map((f) => {
            const c = FURNITURE[f.kind];
            return (
              <g key={f.id} transform={`translate(${f.x} ${f.y}) rotate(${-f.rotation})`}>
                <rect x={-c.w / 2} y={-c.d / 2} width={c.w} height={c.d} rx={0.2} fill="#fff" stroke={selection?.id === f.id ? 'var(--accent)' : '#7b8794'} strokeWidth={(selection?.id === f.id ? 3 : 1.2) * px} />
                <text y={4 * px} fontSize={10 * px} textAnchor="middle" className="furn-label">{c.label}</text>
              </g>
            );
          })}
          {selection?.kind === 'wall' &&
            (() => {
              const w = story.walls.find((x) => x.id === selection.id);
              return w ? [w.a, w.b].map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={9 * px} className="handle" strokeWidth={2 * px} />) : null;
            })()}
          {/* in-progress drawing */}
          {tool.kind === 'wall' && chain.length > 0 && (
            <>
              <polyline points={[...chain, ...(cursor ? [cursor] : [])].map((p) => `${p.x},${p.y}`).join(' ')} className="draft" strokeWidth={tool.exterior ? 0.5 : 0.35} />
              {chain.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={(i === 0 ? 8 : 5) * px} className="draft-pt" />)}
              {cursor && chain.length > 0 && <Dim a={chain[chain.length - 1]!} b={cursor} px={px} />}
            </>
          )}
          {tool.kind === 'wall' && cursor && <circle cx={cursor.x} cy={cursor.y} r={5 * px} className="cursor-pt" />}
          {drag && (drag.kind === 'rect' || drag.kind === 'room') && (
            <>
              <rect x={Math.min(drag.a.x, drag.b.x)} y={Math.min(drag.a.y, drag.b.y)} width={Math.abs(drag.b.x - drag.a.x)} height={Math.abs(drag.b.y - drag.a.y)} className="draft-rect" strokeWidth={2 * px} />
              <Dim a={{ x: Math.min(drag.a.x, drag.b.x), y: Math.min(drag.a.y, drag.b.y) }} b={{ x: Math.max(drag.a.x, drag.b.x), y: Math.min(drag.a.y, drag.b.y) }} px={px} />
              <Dim a={{ x: Math.max(drag.a.x, drag.b.x), y: Math.min(drag.a.y, drag.b.y) }} b={{ x: Math.max(drag.a.x, drag.b.x), y: Math.max(drag.a.y, drag.b.y) }} px={px} />
            </>
          )}
        </g>
      </svg>
      {tool.kind === 'wall' && (
        <div className="plan-hint">
          {chain.length === 0 ? 'Tap to start a wall. Tap again for each corner.' : 'Tap the first point to close, or'}
          {chain.length > 0 && (
            <>
              <button className="chip" onClick={() => finishChain(false)}>Done</button>
              <button className="chip ghost" onClick={() => setChain([])}>Cancel</button>
            </>
          )}
        </div>
      )}
      {tool.kind === 'rect' && <div className="plan-hint">Drag from one corner of the house to the other.</div>}
      {tool.kind === 'room' && <div className="plan-hint">Drag to mark the {ROOM_TYPES[tool.room].label.toLowerCase()}.</div>}
      {tool.kind === 'opening' && <div className="plan-hint">Tap a wall to add a {tool.opening}.</div>}
      {tool.kind === 'furniture' && <div className="plan-hint">Tap to place the {FURNITURE[tool.furniture].label.toLowerCase()}.</div>}
      <div className="zoom-btns">
        <button aria-label="Zoom in" onClick={() => setVb({ ...vb, scale: clampScale(vb.scale * 1.25) })}>+</button>
        <button aria-label="Zoom out" onClick={() => setVb({ ...vb, scale: clampScale(vb.scale / 1.25) })}>−</button>
        <button aria-label="Fit" onClick={() => setVb(fitView(story.walls.length ? story : design.stories[0]!, size.w, size.h))}>⤢</button>
      </div>
    </div>
  );

  function deleteSelection() {
    const sel = useDesign.getState().selection;
    if (!sel) return;
    change((d) => deleteFromStory(d, storyIndex, sel));
    select(null);
  }
}

export const deleteFromStory = (d: Design, storyIndex: number, sel: NonNullable<ReturnType<typeof useDesign.getState>['selection']>) => {
  const st = d.stories[storyIndex]!;
  if (sel.kind === 'wall') {
    st.walls = st.walls.filter((w) => w.id !== sel.id);
    st.openings = st.openings.filter((o) => o.wallId !== sel.id);
  } else if (sel.kind === 'opening') st.openings = st.openings.filter((o) => o.id !== sel.id);
  else if (sel.kind === 'room') st.rooms = st.rooms.filter((r) => r.id !== sel.id);
  else st.furniture = st.furniture.filter((f) => f.id !== sel.id);
};

const clampScale = (s: number) => Math.max(4, Math.min(120, s));

const fitView = (story: Story, w: number, h: number): ViewBox => {
  const b = storyBounds(story);
  if (!b || b.width === 0) return { cx: 15, cy: 12, scale: Math.max(6, Math.min(w, h) / 45) };
  const pad = 8;
  const scale = clampScale(Math.min(w / (b.width + pad * 2), h / (b.depth + pad * 2)));
  return { cx: b.minX + b.width / 2, cy: b.minY + b.depth / 2, scale };
};

function Grid({ vb, size }: { vb: ViewBox; size: { w: number; h: number } }) {
  const x0 = Math.floor(vb.cx - size.w / 2 / vb.scale) - 1;
  const x1 = Math.ceil(vb.cx + size.w / 2 / vb.scale) + 1;
  const y0 = Math.floor(vb.cy - size.h / 2 / vb.scale) - 1;
  const y1 = Math.ceil(vb.cy + size.h / 2 / vb.scale) + 1;
  const step = vb.scale < 8 ? 5 : 1;
  const lines = [];
  for (let x = Math.floor(x0 / step) * step; x <= x1; x += step)
    lines.push(<line key={`x${x}`} x1={x} y1={y0} x2={x} y2={y1} className={x % 10 === 0 ? 'grid-major' : 'grid-minor'} strokeWidth={1 / vb.scale} />);
  for (let y = Math.floor(y0 / step) * step; y <= y1; y += step)
    lines.push(<line key={`y${y}`} x1={x0} y1={y} x2={x1} y2={y} className={y % 10 === 0 ? 'grid-major' : 'grid-minor'} strokeWidth={1 / vb.scale} />);
  return <g>{lines}</g>;
}

function Ghost({ story, px }: { story: Story; px: number }) {
  return (
    <g opacity={0.35}>
      {story.walls.map((w) => (
        <line key={w.id} x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke="#6b7785" strokeDasharray={`${6 * px} ${4 * px}`} strokeWidth={w.exterior ? 0.5 : 0.3} />
      ))}
    </g>
  );
}

function Dim({ a, b, px }: { a: Pt; b: Pt; px: number }) {
  const L = dist(a, b);
  if (L < 0.5) return null;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  return (
    <g>
      <rect x={mx - 22 * px} y={my - 20 * px} width={44 * px} height={16 * px} rx={4 * px} className="dim-bg" />
      <text x={mx} y={my - 8 * px} fontSize={11 * px} textAnchor="middle" className="dim-text">{fmtLen(L)}</text>
    </g>
  );
}

function WallShape({ wall, story, px, selected, selectedOpening }: { wall: Wall; story: Story; px: number; selected: boolean; selectedOpening: string | null }) {
  const L = wallLength(wall);
  const t = wall.exterior ? 0.5 : 0.35;
  const ux = (wall.b.x - wall.a.x) / (L || 1), uy = (wall.b.y - wall.a.y) / (L || 1);
  const nx = -uy, ny = ux;
  const ops = story.openings.filter((o) => o.wallId === wall.id);
  const mid = pointAlong(wall, L / 2);
  return (
    <g>
      <line x1={wall.a.x} y1={wall.a.y} x2={wall.b.x} y2={wall.b.y} className={wall.exterior ? 'wall ext' : 'wall int'} strokeWidth={t} strokeLinecap="square" />
      {selected && <line x1={wall.a.x} y1={wall.a.y} x2={wall.b.x} y2={wall.b.y} stroke="var(--accent)" strokeWidth={t + 4 * px} opacity={0.35} />}
      {ops.map((o) => {
        const c = pointAlong(wall, o.offsetFt);
        const h = o.widthFt / 2;
        const p1 = { x: c.x - ux * h, y: c.y - uy * h }, p2 = { x: c.x + ux * h, y: c.y + uy * h };
        const sel = selectedOpening === o.id;
        return (
          <g key={o.id}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#fff" strokeWidth={t + 0.06} />
            {o.kind === 'window' ? (
              <>
                <line x1={p1.x + nx * t * 0.3} y1={p1.y + ny * t * 0.3} x2={p2.x + nx * t * 0.3} y2={p2.y + ny * t * 0.3} className="win" strokeWidth={1.5 * px} />
                <line x1={p1.x - nx * t * 0.3} y1={p1.y - ny * t * 0.3} x2={p2.x - nx * t * 0.3} y2={p2.y - ny * t * 0.3} className="win" strokeWidth={1.5 * px} />
              </>
            ) : (
              <path d={`M ${p1.x} ${p1.y} L ${p1.x + nx * o.widthFt} ${p1.y + ny * o.widthFt} A ${o.widthFt} ${o.widthFt} 0 0 1 ${p2.x} ${p2.y}`} className="door" strokeWidth={1.2 * px} />
            )}
            {sel && <circle cx={c.x} cy={c.y} r={Math.max(h, 10 * px)} fill="none" stroke="var(--accent)" strokeWidth={2.5 * px} />}
          </g>
        );
      })}
      {L > 2 && (
        <text x={mid.x + nx * (t / 2 + 10 * px)} y={mid.y + ny * (t / 2 + 10 * px) + 4 * px} fontSize={10 * px} textAnchor="middle" className="wall-dim">
          {fmtLen(L)}
        </text>
      )}
    </g>
  );
}
