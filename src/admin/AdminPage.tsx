// Admin: every estimator input, editable. Money is entered in USD and shown
// in both USD and GYD.
import { Fragment, useMemo, useRef } from 'react';
import { estimate, perSqft } from '../estimator/estimate';
import { formatGyd, formatUsd, usd } from '../estimator/money';
import type { FinishOption } from '../estimator/settings';
import { steelPricePerLft } from '../estimator/steel';
import { sampleDesign } from '../model/factory';
import { parseSettings, useSettings } from '../state/settings-store';

type Kind = 'usd' | 'pct' | 'ft' | 'in' | 'num' | 'lb';

function Num({ label, value, onChange, kind = 'num', help, rate, step }: { label: string; value: number; onChange: (v: number) => void; kind?: Kind; help?: string; rate: number; step?: number }) {
  const shown = kind === 'pct' ? +(value * 100).toFixed(4) : value;
  const unit = { usd: 'US$', pct: '%', ft: 'ft', in: 'in', num: '', lb: 'lb' }[kind];
  return (
    <label className="afield">
      <span className="alabel">{label}{help && <small>{help}</small>}</span>
      <span className="ainput">
        {kind === 'usd' && <i>{unit}</i>}
        <input
          type="number"
          step={step ?? (kind === 'usd' ? 0.01 : kind === 'pct' ? 0.5 : 0.1)}
          value={Number.isFinite(shown) ? shown : ''}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            onChange(kind === 'pct' ? v / 100 : v);
          }}
        />
        {kind !== 'usd' && unit && <i>{unit}</i>}
      </span>
      {kind === 'usd' && <span className="gyd">{formatGyd(usd(value || 0), rate)}</span>}
    </label>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="afield">
      <span className="alabel">{label}</span>
      <span className="ainput wide"><input value={value} onChange={(e) => onChange(e.target.value)} /></span>
    </label>
  );
}

function Check({ label, value, onChange, help }: { label: string; value: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <label className="afield check">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="alabel">{label}{help && <small>{help}</small>}</span>
    </label>
  );
}

export function AdminPage() {
  const settings = useSettings((s) => s.settings);
  const { update, reset, setSettings } = useSettings.getState();
  const rate = settings.currency.gydPerUsd;
  const fileRef = useRef<HTMLInputElement>(null);
  const u = update;
  const n = (props: Omit<Parameters<typeof Num>[0], 'rate'>) => <Num rate={rate} {...props} />;

  const preview = useMemo(() => estimate(settings, sampleDesign(settings)), [settings]);
  const codes = settings.steel.profiles.map((p) => p.code);
  const studCodes = codes.filter((c) => /S/.test(c.replace(/-.*/, '')));
  const trackCodes = codes.filter((c) => /T/.test(c.replace(/-.*/, '')));

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `designer-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const importJson = async (f: File) => {
    try {
      setSettings(parseSettings(await f.text()));
    } catch {
      alert('That file is not a valid settings file.');
    }
  };

  return (
    <div className="admin">
      <header className="admin-head">
        <a href="/" className="brand"><span className="logo">GF</span><span className="brand-text">House Designer · Admin</span></a>
        <div className="row">
          <button className="btn" onClick={exportJson}>Export JSON</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          <button className="btn danger" onClick={() => confirm('Reset every setting to the defaults?') && reset()}>Reset defaults</button>
        </div>
      </header>
      <p className="notice small">
        Settings save automatically in this browser. Until accounts and the database are switched on, the public app uses each visitor's own copy (the defaults); use Export/Import to move settings between browsers.
      </p>

      <div className="admin-grid">
        <div className="admin-main">
          <Card title="Currency">
            {n({ label: 'Guyana dollars per US dollar', value: rate, step: 0.5, onChange: (v) => u((s) => { s.currency.gydPerUsd = v; }), help: 'The app shows clients GYD only.' })}
          </Card>

          <Card title="Steel prices (ERP method)" note="Price per lft = (lb/ft × $/lb ÷ yield + lb/ft × overhead + roll-forming labour) ÷ (1 − margin). Same method as the USFF ERP's in-house roll-formed parts.">
            <table className="atable">
              <thead><tr><th>Mil</th><th>Label</th><th>Coil $/lb</th><th>GYD/lb</th><th>Yield %</th></tr></thead>
              <tbody>
                {Object.entries(settings.steel.gauges).map(([mil, g]) => (
                  <tr key={mil}>
                    <td>{mil}</td>
                    <td><input value={g.label} onChange={(e) => u((s) => { s.steel.gauges[mil]!.label = e.target.value; })} /></td>
                    <td><input type="number" step={0.01} value={g.pricePerLbUsd} onChange={(e) => u((s) => { s.steel.gauges[mil]!.pricePerLbUsd = Number(e.target.value); })} /></td>
                    <td className="gyd">{formatGyd(usd(g.pricePerLbUsd || 0), rate)}</td>
                    <td><input type="number" step={0.5} value={+(g.yield * 100).toFixed(3)} onChange={(e) => u((s) => { s.steel.gauges[mil]!.yield = Number(e.target.value) / 100; })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <AddGauge onAdd={(mil) => u((s) => { s.steel.gauges[mil] = { label: `${mil} mil`, pricePerLbUsd: 0.53, yield: 0.88 }; })} />
            {n({ label: 'Operational overhead', kind: 'usd', value: settings.steel.overheadPerLbUsd, onChange: (v) => u((s) => { s.steel.overheadPerLbUsd = v; }), help: 'per lb of steel' })}
            {n({ label: 'Roll-forming labour', kind: 'usd', step: 0.001, value: settings.steel.rollFormLaborPerLftUsd, onChange: (v) => u((s) => { s.steel.rollFormLaborPerLftUsd = v; }), help: 'per linear foot' })}
            {n({ label: 'Margin on steel parts', kind: 'pct', value: settings.steel.marginPct, onChange: (v) => u((s) => { s.steel.marginPct = v; }) })}

            <h4>Profiles</h4>
            <table className="atable">
              <thead><tr><th>Code</th><th>Description</th><th>Mil</th><th>lb/ft</th><th>Web in</th><th>Price/lft</th><th /></tr></thead>
              <tbody>
                {settings.steel.profiles.map((p, i) => {
                  let price = '—';
                  try {
                    const sp = steelPricePerLft(settings, p.code).pricePerLft;
                    price = `${formatUsd(sp)} / ${formatGyd(sp, rate)}`;
                  } catch { /* missing gauge */ }
                  const set = (fn: (x: typeof p) => void) => u((s) => fn(s.steel.profiles[i]!));
                  return (
                    <tr key={i}>
                      <td><input value={p.code} onChange={(e) => set((x) => { x.code = e.target.value.toUpperCase(); })} /></td>
                      <td><input value={p.description} onChange={(e) => set((x) => { x.description = e.target.value; })} /></td>
                      <td><input type="number" value={p.mil} onChange={(e) => set((x) => { x.mil = Number(e.target.value); })} /></td>
                      <td><input type="number" step={0.0001} value={p.weightPerFtLb} onChange={(e) => set((x) => { x.weightPerFtLb = Number(e.target.value); })} /></td>
                      <td><input type="number" step={0.125} value={p.webIn} onChange={(e) => set((x) => { x.webIn = Number(e.target.value); })} /></td>
                      <td className="gyd">{price}</td>
                      <td><button className="x" onClick={() => u((s) => { s.steel.profiles.splice(i, 1); })} aria-label="Remove">×</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button className="btn ghost small" onClick={() => u((s) => { s.steel.profiles.push({ code: 'NEW', description: '', mil: 43, weightPerFtLb: 1, webIn: 3.625 }); })}>+ Add profile</button>
          </Card>

          <Card title="Wall framing">
            {n({ label: 'Stud spacing', kind: 'in', value: settings.framing.studSpacingIn, onChange: (v) => u((s) => { s.framing.studSpacingIn = v; }), help: 'on centre' })}
            {n({ label: 'Default wall height', kind: 'ft', value: settings.framing.defaultWallHeightFt, onChange: (v) => u((s) => { s.framing.defaultWallHeightFt = v; }) })}
            {n({ label: 'Tallest wall priced', kind: 'ft', value: settings.framing.maxWallHeightFt, onChange: (v) => u((s) => { s.framing.maxWallHeightFt = v; }), help: 'taller walls show "needs engineering"' })}
            {n({ label: 'Most stories priced', value: settings.framing.maxStoriesPriced, step: 1, onChange: (v) => u((s) => { s.framing.maxStoriesPriced = Math.round(v); }), help: 'more stories show "needs engineering"' })}
            <div className="afield">
              <span className="alabel">Studs each side of an opening<small>by number of stories</small></span>
              <span className="ainput">
                {settings.framing.openingStudsPerSideByStories.map((v, i) => (
                  <label key={i} className="mini">{i + 1} st.<input type="number" value={v} onChange={(e) => u((s) => { s.framing.openingStudsPerSideByStories[i] = Number(e.target.value); })} /></label>
                ))}
                <button className="btn ghost small" onClick={() => u((s) => { s.framing.openingStudsPerSideByStories.push(s.framing.openingStudsPerSideByStories.at(-1) ?? 2); })}>+</button>
              </span>
            </div>
            <Check label="Doors use the same opening rule as windows" value={settings.framing.openingRulesApplyToDoors} onChange={(v) => u((s) => { s.framing.openingRulesApplyToDoors = v; })} help="Off: doors get 1 stud each side, no header or cripples" />
            {n({ label: 'Box header studs', value: settings.framing.headerStuds, step: 1, onChange: (v) => u((s) => { s.framing.headerStuds = v; }) })}
            {n({ label: 'Box header tracks', value: settings.framing.headerTracks, step: 1, onChange: (v) => u((s) => { s.framing.headerTracks = v; }) })}
            {n({ label: 'Header bearing, each side', kind: 'in', value: settings.framing.headerBearingIn, onChange: (v) => u((s) => { s.framing.headerBearingIn = v; }) })}
            {n({ label: 'Sill tracks per window', value: settings.framing.sillTracks, step: 1, onChange: (v) => u((s) => { s.framing.sillTracks = v; }) })}
            {n({ label: 'Extra studs per corner', value: settings.framing.cornerExtraStuds, step: 1, onChange: (v) => u((s) => { s.framing.cornerExtraStuds = v; }) })}
            {n({ label: 'Extra studs per tee', value: settings.framing.teeExtraStuds, step: 1, onChange: (v) => u((s) => { s.framing.teeExtraStuds = v; }) })}
            <Check label="Back-to-back also doubles opening and corner studs" value={settings.framing.backToBackIncludesOpeningStuds} onChange={(v) => u((s) => { s.framing.backToBackIncludesOpeningStuds = v; })} />
            {n({ label: 'Waste', kind: 'pct', value: settings.framing.wastePct, onChange: (v) => u((s) => { s.framing.wastePct = v; }) })}
            {n({ label: 'Framing labour', kind: 'pct', value: settings.framing.laborPctOfMaterial, onChange: (v) => u((s) => { s.framing.laborPctOfMaterial = v; }), help: 'of framing material price' })}
          </Card>

          <Card title="Stud rules" note="The first rule matching the number of stories and the building width wins. Floor 1 is the ground floor; the last floor listed repeats for floors above it.">
            {settings.framing.studRules.map((r, i) => (
              <div key={i} className="rule">
                <div className="rule-head">
                  <input className="rule-name" value={r.name} onChange={(e) => u((s) => { s.framing.studRules[i]!.name = e.target.value; })} />
                  <button className="x" onClick={() => u((s) => { s.framing.studRules.splice(i, 1); })} aria-label="Remove rule">×</button>
                </div>
                <div className="row">
                  <label className="mini">Stories<input type="number" value={r.stories} onChange={(e) => u((s) => { s.framing.studRules[i]!.stories = Number(e.target.value); })} /></label>
                  <label className="mini">Max width ft<input type="number" placeholder="any" value={r.maxWidthFt ?? ''} onChange={(e) => u((s) => { s.framing.studRules[i]!.maxWidthFt = e.target.value === '' ? null : Number(e.target.value); })} /></label>
                  <button className="btn ghost small" disabled={i === 0} onClick={() => u((s) => { const [x] = s.framing.studRules.splice(i, 1); s.framing.studRules.splice(i - 1, 0, x!); })}>Move up</button>
                </div>
                {r.floors.map((f, j) => (
                  <div key={j} className="row floor-row">
                    <span>Floor {j + 1}</span>
                    <select value={f.stud} onChange={(e) => u((s) => { s.framing.studRules[i]!.floors[j]!.stud = e.target.value; })}>
                      {studCodes.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <select value={f.track} onChange={(e) => u((s) => { s.framing.studRules[i]!.floors[j]!.track = e.target.value; })}>
                      {trackCodes.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <label className="mini"><input type="checkbox" checked={f.backToBack} onChange={(e) => u((s) => { s.framing.studRules[i]!.floors[j]!.backToBack = e.target.checked; })} /> back-to-back</label>
                    {r.floors.length > 1 && <button className="x" onClick={() => u((s) => { s.framing.studRules[i]!.floors.splice(j, 1); })}>×</button>}
                  </div>
                ))}
                <button className="btn ghost small" onClick={() => u((s) => { const fl = s.framing.studRules[i]!.floors; fl.push({ ...fl[fl.length - 1]! }); })}>+ Floor</button>
              </div>
            ))}
            <button className="btn ghost small" onClick={() => u((s) => { s.framing.studRules.push({ name: 'New rule', stories: 1, maxWidthFt: null, floors: [{ stud: studCodes[0] ?? '', track: trackCodes[0] ?? '', backToBack: false }] }); })}>+ Add rule</button>
          </Card>

          <Card title="Floors and roofs">
            {n({ label: 'Joists up to span', kind: 'ft', value: settings.floorsAndRoofs.joistMaxSpanFt, onChange: (v) => u((s) => { s.floorsAndRoofs.joistMaxSpanFt = v; }), help: 'floors and flat roofs only; pitched roofs always use trusses' })}
            {n({ label: 'Joists, material only', kind: 'usd', value: settings.floorsAndRoofs.joistRateUsdPerSqft, onChange: (v) => u((s) => { s.floorsAndRoofs.joistRateUsdPerSqft = v; }), help: 'per sq ft' })}
            {n({ label: 'Joist labour', kind: 'pct', value: settings.floorsAndRoofs.joistLaborPct, onChange: (v) => u((s) => { s.floorsAndRoofs.joistLaborPct = v; }), help: 'of joist price' })}
            <h4>Truss tiers <small className="muted">(material + assembly labour, per sq ft; a span exactly on a limit takes the lower rate)</small></h4>
            <table className="atable">
              <thead><tr><th>Span up to (ft)</th><th>US$/sq ft</th><th>GYD/sq ft</th><th /></tr></thead>
              <tbody>
                {settings.floorsAndRoofs.trussTiers.map((t, i) => (
                  <tr key={i}>
                    <td><input type="number" placeholder="no limit" value={t.maxSpanFt ?? ''} onChange={(e) => u((s) => { s.floorsAndRoofs.trussTiers[i]!.maxSpanFt = e.target.value === '' ? null : Number(e.target.value); })} /></td>
                    <td><input type="number" step={0.25} value={t.rateUsdPerSqft} onChange={(e) => u((s) => { s.floorsAndRoofs.trussTiers[i]!.rateUsdPerSqft = Number(e.target.value); })} /></td>
                    <td className="gyd">{formatGyd(usd(t.rateUsdPerSqft || 0), rate)}</td>
                    <td><button className="x" onClick={() => u((s) => { s.floorsAndRoofs.trussTiers.splice(i, 1); })}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn ghost small" onClick={() => u((s) => { s.floorsAndRoofs.trussTiers.push({ maxSpanFt: null, rateUsdPerSqft: 12 }); s.floorsAndRoofs.trussTiers.sort((a, b) => (a.maxSpanFt ?? Infinity) - (b.maxSpanFt ?? Infinity)); })}>+ Add tier</button>
            {n({ label: 'Truss install labour', kind: 'pct', value: settings.floorsAndRoofs.trussInstallLaborPct, onChange: (v) => u((s) => { s.floorsAndRoofs.trussInstallLaborPct = v; }), help: 'added on top of the truss price' })}
            <Check label="Price roof trusses on plan area including overhang" value={settings.floorsAndRoofs.roofAreaIncludesOverhang} onChange={(v) => u((s) => { s.floorsAndRoofs.roofAreaIncludesOverhang = v; })} />
          </Card>

          <Card title="Foundation">
            {n({ label: 'Slab material', kind: 'usd', value: settings.foundation.slabMaterialUsdPerSqft, onChange: (v) => u((s) => { s.foundation.slabMaterialUsdPerSqft = v; }), help: 'per sq ft' })}
            {n({ label: 'Slab labour', kind: 'usd', value: settings.foundation.slabLaborUsdPerSqft, onChange: (v) => u((s) => { s.foundation.slabLaborUsdPerSqft = v; }), help: 'per sq ft' })}
            {n({ label: 'Footing material', kind: 'usd', value: settings.foundation.footingMaterialUsdPerLft, onChange: (v) => u((s) => { s.foundation.footingMaterialUsdPerLft = v; }), help: 'per lft of exterior wall' })}
            {n({ label: 'Footing labour', kind: 'usd', value: settings.foundation.footingLaborUsdPerLft, onChange: (v) => u((s) => { s.foundation.footingLaborUsdPerLft = v; }), help: 'per lft' })}
            {n({ label: 'Raised piers material', kind: 'usd', value: settings.foundation.raisedPiersMaterialUsdPerSqft, onChange: (v) => u((s) => { s.foundation.raisedPiersMaterialUsdPerSqft = v; }), help: 'per sq ft of footprint' })}
            {n({ label: 'Raised piers labour', kind: 'usd', value: settings.foundation.raisedPiersLaborUsdPerSqft, onChange: (v) => u((s) => { s.foundation.raisedPiersLaborUsdPerSqft = v; }), help: 'per sq ft' })}
          </Card>

          <Card title="Exterior finishes">
            <FinishTable title="Siding" rows={settings.finishes.siding} rate={rate} onChange={(fn) => u((s) => fn(s.finishes.siding))} />
            <FinishTable title="Roofing" rows={settings.finishes.roofing} rate={rate} onChange={(fn) => u((s) => fn(s.finishes.roofing))} />
            <Text label="Trim colours (comma separated)" value={settings.finishes.trimColors.join(', ')} onChange={(v) => u((s) => { s.finishes.trimColors = v.split(',').map((x) => x.trim()).filter(Boolean); })} />
          </Card>

          <Card title="Windows and doors">
            {n({ label: 'Window material', kind: 'usd', value: settings.openings.windowMaterialUsdPerSqft, onChange: (v) => u((s) => { s.openings.windowMaterialUsdPerSqft = v; }), help: 'per sq ft of window' })}
            {n({ label: 'Window install', kind: 'usd', value: settings.openings.windowInstallUsdEach, onChange: (v) => u((s) => { s.openings.windowInstallUsdEach = v; }), help: 'each' })}
            {n({ label: 'Exterior door', kind: 'usd', value: settings.openings.exteriorDoorMaterialUsdEach, onChange: (v) => u((s) => { s.openings.exteriorDoorMaterialUsdEach = v; }), help: 'material, each' })}
            {n({ label: 'Interior door', kind: 'usd', value: settings.openings.interiorDoorMaterialUsdEach, onChange: (v) => u((s) => { s.openings.interiorDoorMaterialUsdEach = v; }), help: 'material, each' })}
            {n({ label: 'Door install', kind: 'usd', value: settings.openings.doorInstallUsdEach, onChange: (v) => u((s) => { s.openings.doorInstallUsdEach = v; }), help: 'each' })}
          </Card>

          <Card title="Interior (per sq ft)">
            {([
              ['drywallMaterialUsdPerSqft', 'Drywall material'], ['drywallLaborUsdPerSqft', 'Drywall labour'],
              ['paintMaterialUsdPerSqft', 'Paint material'], ['paintLaborUsdPerSqft', 'Paint labour'],
              ['insulationMaterialUsdPerSqft', 'Insulation material'], ['insulationLaborUsdPerSqft', 'Insulation labour'],
              ['flooringMaterialUsdPerSqft', 'Floor tile material'], ['flooringLaborUsdPerSqft', 'Floor tile labour'],
            ] as const).map(([k, label]) => n({ label, kind: 'usd', value: settings.interior[k], onChange: (v) => u((s) => { s.interior[k] = v; }) }))}
          </Card>

          <Card title="Allowances">
            {([
              ['bathroomMaterialUsd', 'Bathroom fixtures material', 'each bathroom'], ['bathroomLaborUsd', 'Bathroom labour', 'each bathroom'],
              ['kitchenMaterialUsd', 'Kitchen material', 'each kitchen'], ['kitchenLaborUsd', 'Kitchen labour', 'each kitchen'],
              ['electricalMaterialUsdPerSqft', 'Electrical material', 'per sq ft of floor'], ['electricalLaborUsdPerSqft', 'Electrical labour', 'per sq ft of floor'],
              ['plumbingMaterialUsdPerSqft', 'Plumbing material', 'per sq ft of floor'], ['plumbingLaborUsdPerSqft', 'Plumbing labour', 'per sq ft of floor'],
              ['waterStorageUsd', 'Water tank and pump', 'per house; 0 leaves it out'], ['septicUsd', 'Septic and soakaway', 'per house; 0 leaves it out'],
            ] as const).map(([k, label, help]) => n({ label, help, kind: 'usd', value: settings.allowances[k], onChange: (v) => u((s) => { s.allowances[k] = v; }) }))}
          </Card>

          <Card title="Learning links">
            <Text label="Website" value={settings.education.websiteUrl} onChange={(v) => u((s) => { s.education.websiteUrl = v; })} />
            <Text label="YouTube channel" value={settings.education.youtubeChannelUrl} onChange={(v) => u((s) => { s.education.youtubeChannelUrl = v; })} />
            <table className="atable">
              <thead><tr><th>YouTube ID</th><th>Title</th><th /></tr></thead>
              <tbody>
                {settings.education.videos.map((v, i) => (
                  <tr key={i}>
                    <td><input value={v.youtubeId} onChange={(e) => u((s) => { s.education.videos[i]!.youtubeId = e.target.value; })} /></td>
                    <td><input value={v.title} onChange={(e) => u((s) => { s.education.videos[i]!.title = e.target.value; })} /></td>
                    <td><button className="x" onClick={() => u((s) => { s.education.videos.splice(i, 1); })}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn ghost small" onClick={() => u((s) => { s.education.videos.push({ youtubeId: '', title: '', topic: 'general' }); })}>+ Add video</button>
          </Card>
        </div>

        <aside className="admin-preview">
          <Card title="Preview: sample 24 × 32 house">
            {preview.status === 'ok' ? (
              <>
                <div className="big">{formatGyd(preview.totalUsd, rate)}</div>
                <div className="muted">{formatUsd(preview.totalUsd)} · {formatGyd(perSqft(preview), rate)} ({formatUsd(perSqft(preview))}) per sq ft</div>
                <table className="atable compact">
                  <thead><tr><th /><th>USD</th><th>GYD</th></tr></thead>
                  <tbody>
                    {preview.sections.map((s) => (
                      <Fragment key={s.id}>
                        <tr className="sec"><td>{s.title}</td><td>{formatUsd(s.totalUsd)}</td><td>{formatGyd(s.totalUsd, rate)}</td></tr>
                        <tr><td className="indent">Material</td><td>{formatUsd(s.materialUsd)}</td><td>{formatGyd(s.materialUsd, rate)}</td></tr>
                        <tr><td className="indent">Labour</td><td>{formatUsd(s.laborUsd)}</td><td>{formatGyd(s.laborUsd, rate)}</td></tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
                <h4>Steel parts</h4>
                <table className="atable compact">
                  <tbody>
                    {preview.parts.map((p) => (
                      <tr key={p.code}><td><code>{p.code}</code></td><td>{Math.round(p.lft)} lft</td><td>{formatUsd(p.totalUsd)}</td><td>{formatGyd(p.totalUsd, rate)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p>{preview.messages.join(' ')}</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="acard">
      <h3>{title}</h3>
      {note && <p className="muted small">{note}</p>}
      {children}
    </section>
  );
}

function AddGauge({ onAdd }: { onAdd: (mil: string) => void }) {
  return (
    <button className="btn ghost small" onClick={() => { const m = prompt('Thickness in mils (e.g. 68):'); if (m && /^\d+$/.test(m)) onAdd(m); }}>
      + Add gauge
    </button>
  );
}

function FinishTable({ title, rows, rate, onChange }: { title: string; rows: FinishOption[]; rate: number; onChange: (fn: (rows: FinishOption[]) => void) => void }) {
  return (
    <>
      <h4>{title}</h4>
      <table className="atable">
        <thead><tr><th>Name</th><th>Material $/sq ft</th><th>Labour $/sq ft</th><th>GYD total/sq ft</th><th>Colour</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td>
                <input value={r.name} onChange={(e) => onChange((x) => { x[i]!.name = e.target.value; })} />
                <input className="small" value={r.note} placeholder="Note shown to clients" onChange={(e) => onChange((x) => { x[i]!.note = e.target.value; })} />
              </td>
              <td><input type="number" step={0.05} value={r.materialUsdPerSqft} onChange={(e) => onChange((x) => { x[i]!.materialUsdPerSqft = Number(e.target.value); })} /></td>
              <td><input type="number" step={0.05} value={r.laborUsdPerSqft} onChange={(e) => onChange((x) => { x[i]!.laborUsdPerSqft = Number(e.target.value); })} /></td>
              <td className="gyd">{formatGyd(usd(r.materialUsdPerSqft + r.laborUsdPerSqft || 0), rate)}</td>
              <td><input type="color" value={r.defaultColor} onChange={(e) => onChange((x) => { x[i]!.defaultColor = e.target.value; })} /></td>
              <td><button className="x" onClick={() => onChange((x) => { x.splice(i, 1); })}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn ghost small" onClick={() => onChange((x) => { x.push({ id: `opt-${Date.now()}`, name: 'New option', materialUsdPerSqft: 1, laborUsdPerSqft: 1, note: '', defaultColor: '#dddddd' }); })}>+ Add {title.toLowerCase()} option</button>
    </>
  );
}
