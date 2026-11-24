// A shared design, opened from a link: 3D view, estimate, and "Edit a copy".
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { estimate } from '../estimator/estimate';
import { formatGyd } from '../estimator/money';
import type { Design } from '../model/types';
import { useDesign } from '../state/design-store';
import { useSettings } from '../state/settings-store';
import { decodeDesign } from '../state/share';

const View3D = lazy(() => import('../three/View3D').then((m) => ({ default: m.View3D })));

export function SharedView() {
  const [design, setDesign] = useState<Design | null>(null);
  const [error, setError] = useState(false);
  const settings = useSettings((s) => s.settings);
  const nav = useNavigate();
  useEffect(() => {
    const m = location.hash.match(/d=([^&]+)/);
    if (!m) return setError(true);
    decodeDesign(m[1]!).then(setDesign).catch(() => setError(true));
  }, []);
  const est = useMemo(() => (design ? estimate(settings, design) : null), [design, settings]);
  if (error) return <div className="shared-msg">This link is broken or incomplete. <a href="/">Design your own house</a></div>;
  if (!design || !est) return <div className="shared-msg">Loading…</div>;
  return (
    <div className="shared">
      <header className="topbar">
        <a className="brand" href="/"><span className="logo">GF</span><span className="brand-text">House Designer</span></a>
        <div className="shared-title">{design.name}</div>
        <button className="btn primary small" onClick={() => { useDesign.getState().load({ ...design, id: `copy_${Date.now()}` }); nav('/'); }}>Edit a copy</button>
      </header>
      <main className="stage">
        <Suspense fallback={<div className="loading">Loading 3D…</div>}>
          <View3D design={design} />
        </Suspense>
      </main>
      <div className="shared-foot">
        <b>{est.status === 'ok' ? formatGyd(est.totalUsd, settings.currency.gydPerUsd) : 'Needs engineering'}</b>
        <span className="muted small"> · {Math.round(est.stats.floorAreaSqft)} sq ft · {design.stories.length} {design.stories.length === 1 ? 'story' : 'stories'}</span>
      </div>
    </div>
  );
}
