// The design app: header, floor tabs, 2D plan or 3D view, tools, and panels.
// Mobile: panels open as a bottom sheet. Desktop: panels sit on the right.
import { lazy, Suspense, useMemo, useState } from 'react';
import { estimate as runEstimate } from '../estimator/estimate';
import { formatGyd } from '../estimator/money';
import { newDesign, sampleDesign } from '../model/factory';
import { useDesign } from '../state/design-store';
import { useSettings } from '../state/settings-store';
import { Inspector } from './Inspector';
import { EstimatePanel, FinishesPanel, LearnPanel, RoofPanel, SharePanel } from './panels';
import { PlanEditor } from './PlanEditor';
import { Toolbar } from './Toolbar';

const View3D = lazy(() => import('../three/View3D').then((m) => ({ default: m.View3D })));

type PanelId = 'cost' | 'roof' | 'finishes' | 'learn' | 'share';
const PANELS: { id: PanelId; label: string; icon: string }[] = [
  { id: 'cost', label: 'Cost', icon: 'G$' },
  { id: 'roof', label: 'Roof', icon: '⌂' },
  { id: 'finishes', label: 'Colours', icon: '🎨' },
  { id: 'learn', label: 'Learn', icon: '🎓' },
  { id: 'share', label: 'Share', icon: '↗' },
];

export function Designer() {
  const settings = useSettings((s) => s.settings);
  const design = useDesign((s) => s.design);
  const view = useDesign((s) => s.view);
  const storyIndex = useDesign((s) => s.storyIndex);
  const { setView, setStory, addStory, removeStory, undo, redo, load, change } = useDesign.getState();
  const canUndo = useDesign((s) => s.past.length > 0);
  const canRedo = useDesign((s) => s.future.length > 0);
  const [panel, setPanel] = useState<PanelId | null>(() => (window.innerWidth >= 900 ? 'cost' : null));
  const [menu, setMenu] = useState(false);

  const est = useMemo(() => runEstimate(settings, design), [settings, design]);
  const totalLabel =
    est.status === 'ok' ? formatGyd(est.totalUsd, settings.currency.gydPerUsd) : est.status === 'engineering-required' ? 'Needs engineering' : 'G$0';

  const panelBody = (id: PanelId) => {
    switch (id) {
      case 'cost': return <EstimatePanel estimate={est} settings={settings} />;
      case 'roof': return <RoofPanel />;
      case 'finishes': return <FinishesPanel settings={settings} />;
      case 'learn': return <LearnPanel settings={settings} />;
      case 'share': return <SharePanel estimate={est} settings={settings} />;
    }
  };

  return (
    <div className={`app ${panel ? 'panel-open' : ''}`}>
      <header className="topbar">
        <a className="brand" href={settings.education.websiteUrl} target="_blank" rel="noreferrer" title="Frames and Supplies (Guyana)">
          <span className="logo">GF</span>
          <span className="brand-text">House Designer</span>
        </a>
        <input className="design-name" value={design.name} onChange={(e) => change((d) => { d.name = e.target.value; })} aria-label="Design name" />
        <div className="top-actions">
          <button onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo">↶</button>
          <button onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo">↷</button>
          <div className="seg view-toggle">
            <button className={view === '2d' ? 'on' : ''} onClick={() => setView('2d')}>2D</button>
            <button className={view === '3d' ? 'on' : ''} onClick={() => setView('3d')}>3D</button>
          </div>
          <button onClick={() => setMenu(!menu)} aria-label="Menu" aria-expanded={menu}>☰</button>
        </div>
        {menu && (
          <div className="menu card" onClick={() => setMenu(false)}>
            <button onClick={() => { if (confirm('Start a new, empty design?')) load(newDesign(settings)); }}>New design</button>
            <button onClick={() => load(sampleDesign(settings))}>Load the sample house</button>
            <button onClick={() => setPanel('share')}>Share</button>
            <a href={settings.education.websiteUrl} target="_blank" rel="noreferrer">guyanaframe.com</a>
          </div>
        )}
      </header>

      <div className="floors">
        {design.stories.map((s, i) => (
          <button key={s.id} className={`chip ${i === storyIndex ? 'on' : ''}`} onClick={() => setStory(i)}>
            Floor {i + 1}
          </button>
        ))}
        {design.stories.length < 4 && (
          <button className="chip ghost" onClick={() => addStory(true)} title="Add a floor on top, copying the outside walls">+ Floor</button>
        )}
        {design.stories.length > 1 && (
          <button className="chip ghost" onClick={() => confirm(`Remove floor ${storyIndex + 1}?`) && removeStory(storyIndex)}>Remove floor</button>
        )}
        <label className="chip ghost wall-h">
          Wall height
          <select value={design.wallHeightFt} onChange={(e) => change((d) => { d.wallHeightFt = Number(e.target.value); })}>
            {[8, 9, 10].map((h) => <option key={h} value={h}>{h} ft</option>)}
          </select>
        </label>
      </div>

      <main className="stage">
        {view === '2d' ? (
          <PlanEditor />
        ) : (
          <Suspense fallback={<div className="loading">Loading 3D…</div>}>
            <View3D design={design} />
          </Suspense>
        )}
        {view === '2d' && <Inspector />}
      </main>

      {view === '2d' && <Toolbar />}

      <nav className="panel-tabs">
        <button className="total-pill" onClick={() => setPanel(panel === 'cost' ? null : 'cost')}>
          <span className="muted small">Estimate</span>
          <b>{totalLabel}</b>
        </button>
        {PANELS.map((p) => (
          <button key={p.id} className={`ptab ptab-${p.id} ${panel === p.id ? 'on' : ''}`} onClick={() => setPanel(panel === p.id ? null : p.id)}>
            <span className="ico">{p.icon}</span>
            <span className="lbl">{p.label}</span>
          </button>
        ))}
      </nav>

      <aside className={`sheet ${panel ? 'open' : ''}`} aria-hidden={!panel}>
        {panel && (
          <>
            <button className="sheet-close" onClick={() => setPanel(null)} aria-label="Close panel">×</button>
            {panelBody(panel)}
          </>
        )}
      </aside>
    </div>
  );
}
