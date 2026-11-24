// Side/bottom panels: roof, finishes, cost estimate, learning, sharing.
import { useEffect, useMemo, useState } from 'react';
import type { Estimate } from '../estimator/estimate';
import { perSqft } from '../estimator/estimate';
import { formatGyd } from '../estimator/money';
import type { Settings } from '../estimator/settings';
import type { RoofType } from '../model/types';
import { useDesign } from '../state/design-store';
import { facebookShareUrl, shareUrl, whatsappShareUrl } from '../state/share';

const g = (s: Settings) => (v: Estimate['totalUsd']) => formatGyd(v, s.currency.gydPerUsd);

export function RoofPanel() {
  const design = useDesign((s) => s.design);
  const change = useDesign((s) => s.change);
  const r = design.roof;
  const set = (fn: (x: typeof r) => void) => change((d) => fn(d.roof));
  const types: { id: RoofType; label: string; note: string }[] = [
    { id: 'gable', label: 'Gable', note: 'Two slopes meeting at a ridge, with triangle walls at the ends. Simple and good for rain.' },
    { id: 'hip', label: 'Hip', note: 'Slopes on all four sides. Stands up better to strong wind.' },
    { id: 'flat', label: 'Flat', note: 'Nearly flat, with a parapet wall around the edge. Modern look; needs a waterproof membrane.' },
  ];
  return (
    <div className="panel">
      <h2>Roof</h2>
      <div className="seg">
        {types.map((t) => (
          <button key={t.id} className={r.type === t.id ? 'on' : ''} onClick={() => set((x) => { x.type = t.id; })}>{t.label}</button>
        ))}
      </div>
      <p className="muted small">{types.find((t) => t.id === r.type)?.note}</p>
      {r.type !== 'flat' ? (
        <>
          <Range label="Pitch" value={r.pitch} min={2} max={12} step={0.5} unit="/12" onChange={(v) => set((x) => { x.pitch = v; })} />
          <Range label="Overhang" value={r.overhangFt} min={0} max={4} step={0.25} unit=" ft" onChange={(v) => set((x) => { x.overhangFt = v; })} />
          {r.type === 'gable' && (
            <div className="seg small">
              {(['auto', 'x', 'y'] as const).map((a) => (
                <button key={a} className={r.ridgeAxis === a ? 'on' : ''} onClick={() => set((x) => { x.ridgeAxis = a; })}>
                  {a === 'auto' ? 'Ridge: long side' : a === 'x' ? 'Ridge ↔' : 'Ridge ↕'}
                </button>
              ))}
            </div>
          )}
          <p className="muted small">Pitch is how many inches the roof rises for every 12 inches across. The overhang shades the walls and keeps rain off them.</p>
        </>
      ) : (
        <Range label="Parapet" value={r.parapetFt} min={0} max={5} step={0.5} unit=" ft" onChange={(v) => set((x) => { x.parapetFt = v; })} />
      )}
      <h3>Foundation</h3>
      <div className="seg">
        <button className={design.foundation === 'slab' ? 'on' : ''} onClick={() => change((d) => { d.foundation = 'slab'; })}>Slab on ground</button>
        <button className={design.foundation === 'raised' ? 'on' : ''} onClick={() => change((d) => { d.foundation = 'raised'; })}>Raised on piers</button>
      </div>
      <p className="muted small">A raised house sits on concrete piers, like many Guyana homes: safer in floods and cooler underneath.</p>
    </div>
  );
}

function Range({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="range">
      <span>{label} <b>{value}{unit}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function FinishesPanel({ settings }: { settings: Settings }) {
  const design = useDesign((s) => s.design);
  const change = useDesign((s) => s.change);
  const f = design.finishes;
  const set = (fn: (x: typeof f) => void) => change((d) => fn(d.finishes));
  const palette = ['#f2efe6', '#e8e2d4', '#dfe6ea', '#c9d9c3', '#f3d9b1', '#e9b8a5', '#b8c7d9', '#8fa4b8', '#6b7f6a', '#9c6b4e', '#ffffff', '#2f3a45'];
  const roofPalette = ['#9aa3a8', '#8b2e2a', '#2f5d3a', '#1f3a5f', '#4a4a4a', '#b5651d', '#d9d9d9'];
  return (
    <div className="panel">
      <h2>Exterior finishes</h2>
      <h3>Walls</h3>
      <div className="options">
        {settings.finishes.siding.map((o) => (
          <button key={o.id} className={`option ${f.siding === o.id ? 'on' : ''}`} onClick={() => set((x) => { x.siding = o.id; x.sidingColor = o.defaultColor; })}>
            <b>{o.name}</b>
            <span className="muted small">{o.note}</span>
          </button>
        ))}
      </div>
      <Swatches colors={palette} value={f.sidingColor} onPick={(c) => set((x) => { x.sidingColor = c; })} />
      <h3>Roof</h3>
      <div className="options">
        {settings.finishes.roofing.map((o) => (
          <button key={o.id} className={`option ${f.roofing === o.id ? 'on' : ''}`} onClick={() => set((x) => { x.roofing = o.id; x.roofColor = o.defaultColor; })}>
            <b>{o.name}</b>
            <span className="muted small">{o.note}</span>
          </button>
        ))}
      </div>
      <Swatches colors={roofPalette} value={f.roofColor} onPick={(c) => set((x) => { x.roofColor = c; })} />
      <h3>Trim</h3>
      <Swatches colors={settings.finishes.trimColors} value={f.trimColor} onPick={(c) => set((x) => { x.trimColor = c; })} />
    </div>
  );
}

function Swatches({ colors, value, onPick }: { colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="swatches">
      {colors.map((c) => (
        <button key={c} className={`sw ${c.toLowerCase() === value.toLowerCase() ? 'on' : ''}`} style={{ background: c }} onClick={() => onPick(c)} aria-label={`Colour ${c}`} />
      ))}
      <label className="sw custom" title="Pick any colour">
        <input type="color" value={value} onChange={(e) => onPick(e.target.value)} />
      </label>
    </div>
  );
}

export function EstimatePanel({ estimate: e, settings }: { estimate: Estimate; settings: Settings }) {
  const fmt = g(settings);
  const [open, setOpen] = useState<string | null>('framing');
  const [showParts, setShowParts] = useState(false);
  if (e.status === 'empty') return <div className="panel"><h2>Cost estimate</h2><p className="muted">{e.messages[0]}</p></div>;
  if (e.status === 'engineering-required') {
    return (
      <div className="panel">
        <h2>Cost estimate</h2>
        <div className="notice">{e.messages.map((m) => <p key={m}>{m}</p>)}</div>
        <a className="btn primary" href={`${settings.education.websiteUrl}/contact/`} target="_blank" rel="noreferrer">Contact us</a>
      </div>
    );
  }
  return (
    <div className="panel">
      <h2>Cost estimate</h2>
      <div className="total-card">
        <div className="big">{fmt(e.totalUsd)}</div>
        <div className="muted small">
          {Math.round(e.stats.floorAreaSqft).toLocaleString()} sq ft · {fmt(perSqft(e))} per sq ft · {e.stats.stories} {e.stats.stories === 1 ? 'story' : 'stories'}
        </div>
        <div className="split">
          <span>Material <b>{fmt(e.materialUsd)}</b></span>
          <span>Labour <b>{fmt(e.laborUsd)}</b></span>
        </div>
      </div>
      {e.sections.map((s) => (
        <section key={s.id} className="est-section">
          <button className="est-head" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>
            <span>{s.title}</span>
            <b>{fmt(s.totalUsd)}</b>
          </button>
          {open === s.id && (
            <>
              <div className="est-sub muted small">Material {fmt(s.materialUsd)} · Labour {fmt(s.laborUsd)}</div>
              <table className="est-table">
                <tbody>
                  {s.lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div>{l.label}</div>
                        <div className="muted small">{l.qty.toLocaleString()} {l.unit} · {l.explain}</div>
                      </td>
                      <td className="num">
                        {fmt(l.materialUsd.plus(l.laborUsd))}
                        <div className="muted small">M {fmt(l.materialUsd)}<br />L {fmt(l.laborUsd)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {s.id === 'framing' && (
                <div className="framing-extra">
                  <p className="small">Framing rule: <b>{e.stats.studRule}</b> · about {Math.round(e.stats.steelWeightLb).toLocaleString()} lb of steel</p>
                  <button className="btn ghost small" onClick={() => setShowParts(!showParts)}>{showParts ? 'Hide' : 'Show'} steel parts list</button>
                  {showParts && (
                    <table className="parts">
                      <thead><tr><th>Part</th><th>Pieces</th><th>Lin. ft</th><th>Price</th></tr></thead>
                      <tbody>
                        {e.parts.map((p) => (
                          <tr key={p.code}>
                            <td><code>{p.code}</code><div className="muted small">{p.description}</div></td>
                            <td className="num">{p.pieces}</td>
                            <td className="num">{Math.round(p.lft).toLocaleString()}</td>
                            <td className="num">{fmt(p.totalUsd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      ))}
      <p className="muted small">This is a starting estimate, not a quote. Prices change; land, permits and site work are not included. Talk to Frames and Supplies (Guyana) for a firm price.</p>
    </div>
  );
}

export function LearnPanel({ settings }: { settings: Settings }) {
  const [playing, setPlaying] = useState<string | null>(null);
  return (
    <div className="panel">
      <h2>Learn steel framing</h2>
      <div className="tips">
        <div className="tip"><b>16" on centre</b><p>Studs stand every 16 inches, measured centre to centre. Sheets of board are 48" wide, so every edge lands on a stud.</p></div>
        <div className="tip"><b>Reading a part code</b><p><code>362S162-33</code>: 3.62" deep web, <b>S</b>tud, 1.62" flange, 33 mil (20 gauge) steel. <b>T</b> means track, the channel that holds studs at top and bottom.</p></div>
        <div className="tip"><b>Gauge</b><p>A lower gauge number is thicker steel. 20 ga (33 mil) suits one story; 18 ga (43 mil) carries two stories; three stories use 6" studs, doubled on the ground floor.</p></div>
        <div className="tip"><b>Openings</b><p>Every window and door is framed with extra studs each side, a box header (2 studs + 2 tracks) to carry the load across, and short cripple studs above and below.</p></div>
        <div className="tip"><b>Joists or trusses?</b><p>Short spans (15 ft or less) can use joists. Longer spans need trusses: triangles of steel that carry the load to the outside walls.</p></div>
        <div className="tip"><b>Why steel in Guyana?</b><p>Steel does not rot, feed termites or burn, stays straight in humidity, and goes up fast.</p></div>
      </div>
      <h3>Videos</h3>
      <div className="videos">
        {settings.education.videos.map((v) => (
          <div key={v.youtubeId} className="video">
            {playing === v.youtubeId ? (
              <iframe src={`https://www.youtube-nocookie.com/embed/${v.youtubeId}?autoplay=1`} title={v.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            ) : (
              <button className="thumb" onClick={() => setPlaying(v.youtubeId)} style={{ backgroundImage: `url(https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg)` }} aria-label={`Play ${v.title}`}>
                <span>▶</span>
              </button>
            )}
            <div className="small">{v.title}</div>
          </div>
        ))}
      </div>
      <p>
        <a href={settings.education.websiteUrl} target="_blank" rel="noreferrer">guyanaframe.com</a> ·{' '}
        <a href={settings.education.youtubeChannelUrl} target="_blank" rel="noreferrer">US Frame Factory on YouTube</a>
      </p>
    </div>
  );
}

export function SharePanel({ estimate, settings }: { estimate: Estimate; settings: Settings }) {
  const design = useDesign((s) => s.design);
  const [url, setUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    shareUrl(design).then((u) => alive && setUrl(u)).catch(() => {});
    return () => { alive = false; };
  }, [design]);
  const text = useMemo(
    () => `I designed my house: ${Math.round(estimate.stats.floorAreaSqft)} sq ft${estimate.status === 'ok' ? `, about ${formatGyd(estimate.totalUsd, settings.currency.gydPerUsd)}` : ''}.`,
    [estimate, settings],
  );
  return (
    <div className="panel">
      <h2>Share</h2>
      <p className="muted small">Anyone with the link can see your house in 3D and copy it. No account needed.</p>
      <div className="share-btns">
        <a className="btn fb" href={url ? facebookShareUrl(url) : undefined} target="_blank" rel="noreferrer">Share on Facebook</a>
        <a className="btn wa" href={url ? whatsappShareUrl(url, text) : undefined} target="_blank" rel="noreferrer">Send on WhatsApp</a>
        <button className="btn" disabled={!url} onClick={async () => { await navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
      <p className="muted small">For TikTok or Reels, open the 3D view and tap <b>Fly-around video</b>.</p>
    </div>
  );
}
