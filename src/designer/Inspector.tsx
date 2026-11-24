// Edit the selected wall, opening, room or furniture.
import { ROOM_TYPES } from '../model/catalog';
import { wallLength } from '../model/geometry';
import type { Room, RoomType } from '../model/types';
import { currentStory, useDesign } from '../state/design-store';
import { deleteFromStory } from './PlanEditor';

const ftIn = (ft: number) => `${Math.floor(ft)}' ${Math.round((ft % 1) * 12)}"`;

function Num({ label, value, onChange, step = 0.25, min = 0 }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number }) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="num">
        <button onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))} aria-label={`Less ${label}`}>−</button>
        <input type="number" inputMode="decimal" step={step} min={min} value={+value.toFixed(2)} onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))} />
        <button onClick={() => onChange(+(value + step).toFixed(2))} aria-label={`More ${label}`}>+</button>
      </span>
    </label>
  );
}

export function Inspector() {
  const state = useDesign();
  const { selection, storyIndex, change, select } = state;
  const story = currentStory(state);
  if (!selection) return null;

  const del = () => {
    change((d) => deleteFromStory(d, storyIndex, selection));
    select(null);
  };
  const edit = (fn: (s: typeof story) => void) => change((d) => fn(d.stories[storyIndex]!));

  let body: React.ReactNode = null;
  if (selection.kind === 'wall') {
    const w = story.walls.find((x) => x.id === selection.id);
    if (!w) return null;
    body = (
      <>
        <h3>{w.exterior ? 'Outside wall' : 'Inside wall'} · {ftIn(wallLength(w))}</h3>
        <label className="field check">
          <input type="checkbox" checked={w.exterior} onChange={(e) => edit((s) => { s.walls.find((x) => x.id === w.id)!.exterior = e.target.checked; })} />
          <span>Outside wall (gets siding)</span>
        </label>
        <p className="muted small">Drag the round handles to move the wall ends.</p>
      </>
    );
  } else if (selection.kind === 'opening') {
    const o = story.openings.find((x) => x.id === selection.id);
    if (!o) return null;
    const set = (k: 'widthFt' | 'heightFt' | 'sillFt', v: number) => edit((s) => { const t = s.openings.find((x) => x.id === o.id)!; t[k] = v; });
    body = (
      <>
        <h3>{o.kind === 'window' ? 'Window' : 'Door'}</h3>
        <div className="fields">
          <Num label="Width ft" value={o.widthFt} onChange={(v) => set('widthFt', Math.max(1, v))} />
          <Num label="Height ft" value={o.heightFt} onChange={(v) => set('heightFt', Math.max(1, v))} />
          {o.kind === 'window' && <Num label="Sill ft" value={o.sillFt} onChange={(v) => set('sillFt', v)} />}
        </div>
        <p className="muted small">Each opening gets extra studs on both sides, a box header above and short "cripple" studs. Drag it along the wall to move it.</p>
      </>
    );
  } else if (selection.kind === 'room') {
    const r = story.rooms.find((x) => x.id === selection.id);
    if (!r) return null;
    const upd = (fn: (t: Room) => void) => edit((s) => fn(s.rooms.find((x) => x.id === r.id)!));
    body = (
      <>
        <h3>Room · {Math.round(r.w * r.h)} sq ft</h3>
        <div className="fields">
          <label className="field"><span>Name</span><input value={r.name} onChange={(e) => upd((t) => { t.name = e.target.value; })} /></label>
          <label className="field">
            <span>Type</span>
            <select value={r.type} onChange={(e) => upd((t) => { t.type = e.target.value as RoomType; })}>
              {(Object.keys(ROOM_TYPES) as RoomType[]).map((k) => <option key={k} value={k}>{ROOM_TYPES[k].label}</option>)}
            </select>
          </label>
          <Num label="Width ft" value={r.w} step={0.5} onChange={(v) => upd((t) => { t.w = Math.max(3, v); })} />
          <Num label="Depth ft" value={r.h} step={0.5} onChange={(v) => upd((t) => { t.h = Math.max(3, v); })} />
        </div>
        {r.type === 'bathroom' && <p className="muted small">Each bathroom adds a toilet, sink and shower to the estimate.</p>}
      </>
    );
  } else {
    const f = story.furniture.find((x) => x.id === selection.id);
    if (!f) return null;
    body = (
      <>
        <h3>Furniture</h3>
        <button className="btn" onClick={() => edit((s) => { const t = s.furniture.find((x) => x.id === f.id)!; t.rotation = (t.rotation + 90) % 360; })}>Rotate 90°</button>
      </>
    );
  }

  return (
    <div className="inspector card">
      <button className="close" onClick={() => select(null)} aria-label="Close">×</button>
      {body}
      <button className="btn danger" onClick={del}>Delete</button>
    </div>
  );
}
