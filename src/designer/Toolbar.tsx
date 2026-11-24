import { useState } from 'react';
import { FURNITURE, ROOM_TYPES } from '../model/catalog';
import type { FurnitureKind, RoomType } from '../model/types';
import { type Tool, useDesign } from '../state/design-store';

const same = (a: Tool, b: Tool) => JSON.stringify(a) === JSON.stringify(b);

export function Toolbar() {
  const tool = useDesign((s) => s.tool);
  const setTool = useDesign((s) => s.setTool);
  const [menu, setMenu] = useState<null | 'room' | 'furniture'>(null);

  const btn = (t: Tool, icon: string, label: string) => (
    <button className={`tool ${same(tool, t) ? 'on' : ''}`} onClick={() => { setTool(t); setMenu(null); }} title={label}>
      <span className="ico" aria-hidden>{icon}</span>
      <span className="lbl">{label}</span>
    </button>
  );

  return (
    <div className="toolbar-wrap">
      {menu === 'room' && (
        <div className="tool-menu">
          {(Object.keys(ROOM_TYPES) as RoomType[]).map((k) => (
            <button key={k} className="chip" onClick={() => { setTool({ kind: 'room', room: k }); setMenu(null); }}>
              <i className="swatch" style={{ background: ROOM_TYPES[k].color }} /> {ROOM_TYPES[k].label}
            </button>
          ))}
        </div>
      )}
      {menu === 'furniture' && (
        <div className="tool-menu">
          {(Object.keys(FURNITURE) as FurnitureKind[]).map((k) => (
            <button key={k} className="chip" onClick={() => { setTool({ kind: 'furniture', furniture: k }); setMenu(null); }}>
              {FURNITURE[k].label}
            </button>
          ))}
        </div>
      )}
      <div className="toolbar" role="toolbar" aria-label="Drawing tools">
        {btn({ kind: 'select' }, '👆', 'Select')}
        {btn({ kind: 'rect' }, '⬜', 'House')}
        {btn({ kind: 'wall', exterior: true }, '▬', 'Outside wall')}
        {btn({ kind: 'wall', exterior: false }, '┃', 'Inside wall')}
        {btn({ kind: 'opening', opening: 'window' }, '🪟', 'Window')}
        {btn({ kind: 'opening', opening: 'door' }, '🚪', 'Door')}
        <button className={`tool ${tool.kind === 'room' ? 'on' : ''}`} onClick={() => setMenu(menu === 'room' ? null : 'room')}>
          <span className="ico" aria-hidden>🛏</span>
          <span className="lbl">{tool.kind === 'room' ? ROOM_TYPES[tool.room].label : 'Room'} ▾</span>
        </button>
        <button className={`tool ${tool.kind === 'furniture' ? 'on' : ''}`} onClick={() => setMenu(menu === 'furniture' ? null : 'furniture')}>
          <span className="ico" aria-hidden>🛋</span>
          <span className="lbl">{tool.kind === 'furniture' ? FURNITURE[tool.furniture].label : 'Furnish'} ▾</span>
        </button>
      </div>
    </div>
  );
}
