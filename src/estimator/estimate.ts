// Turns a design + settings into a priced estimate, in USD (Decimal).
// The app converts to GYD for display.
import Decimal from 'decimal.js';
import {
  exteriorPerimeter,
  footprintArea,
  openingsOnWall,
  spanOf,
  wallLength,
} from '../model/geometry';
import type { Design, Story } from '../model/types';
import { type Money, ZERO, sum, usd } from './money';
import type { Settings } from './settings';
import { steelPricePerLft } from './steel';
import {
  type PartTotal,
  type Piece,
  aggregateParts,
  floorFramingFor,
  roofRise,
  roofSpan,
  roofWallTakeoff,
  selectStudRule,
  storyTakeoff,
} from './takeoff';

export interface EstimateLine {
  id: string;
  label: string;
  qty: number;
  unit: string;
  materialUsd: Money;
  laborUsd: Money;
  /** Plain-language explanation of how the line was worked out. */
  explain: string;
}

export type SectionId = 'framing' | 'foundation' | 'other';

export interface EstimateSection {
  id: SectionId;
  title: string;
  lines: EstimateLine[];
  materialUsd: Money;
  laborUsd: Money;
  totalUsd: Money;
}

export interface PricedPart extends PartTotal {
  pricePerLftUsd: Money;
  totalUsd: Money;
  weightLb: number;
}

export interface Estimate {
  status: 'ok' | 'engineering-required' | 'empty';
  messages: string[];
  sections: EstimateSection[];
  parts: PricedPart[];
  pieces: Piece[];
  stats: {
    stories: number;
    floorAreaSqft: number;
    footprintSqft: number;
    buildingWidthFt: number;
    studRule: string | null;
    steelWeightLb: number;
  };
  materialUsd: Money;
  laborUsd: Money;
  totalUsd: Money;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

const section = (id: SectionId, title: string, lines: EstimateLine[]): EstimateSection => {
  const materialUsd = sum(lines.map((l) => l.materialUsd));
  const laborUsd = sum(lines.map((l) => l.laborUsd));
  return { id, title, lines, materialUsd, laborUsd, totalUsd: materialUsd.plus(laborUsd) };
};

const perUnit = (qty: number, mat: number, lab: number) => ({
  materialUsd: usd(mat).mul(qty),
  laborUsd: usd(lab).mul(qty),
});

/** Rate for framing a floor or flat roof of a given span. */
export const floorSystemRate = (settings: Settings, span: number) => {
  const fr = settings.floorsAndRoofs;
  if (span <= fr.joistMaxSpanFt) {
    return { kind: 'joists' as const, rate: fr.joistRateUsdPerSqft, laborPct: fr.joistLaborPct };
  }
  return { kind: 'trusses' as const, rate: trussRate(settings, span), laborPct: fr.trussInstallLaborPct };
};

/** Truss rate for a span. Spans exactly on a tier limit take the lower rate. */
export const trussRate = (settings: Settings, span: number): number => {
  const tiers = settings.floorsAndRoofs.trussTiers;
  const hit = tiers.find((t) => t.maxSpanFt == null || span <= t.maxSpanFt);
  return (hit ?? tiers[tiers.length - 1])?.rateUsdPerSqft ?? 0;
};

const fmtFt = (n: number) => `${r1(n)} ft`;

/** Plan area of a roof including its overhang on every side. */
const roofPlanArea = (story: Story, overhangFt: number) =>
  footprintArea(story) + exteriorPerimeter(story) * overhangFt + 4 * overhangFt * overhangFt;

export const estimate = (settings: Settings, design: Design): Estimate => {
  const stories = design.stories.filter((s) => s.walls.length > 0);
  const empty: Estimate = {
    status: 'empty',
    messages: [],
    sections: [],
    parts: [],
    pieces: [],
    stats: { stories: 0, floorAreaSqft: 0, footprintSqft: 0, buildingWidthFt: 0, studRule: null, steelWeightLb: 0 },
    materialUsd: ZERO,
    laborUsd: ZERO,
    totalUsd: ZERO,
  };
  if (stories.length === 0) return { ...empty, messages: ['Draw some walls to see an estimate.'] };
  const d: Design = { ...design, stories };
  const f = settings.framing;

  const floorAreaSqft = stories.reduce((s, st) => s + footprintArea(st), 0);
  const ground = stories[0]!;
  const top = stories[stories.length - 1]!;
  const stats = {
    stories: stories.length,
    floorAreaSqft,
    footprintSqft: footprintArea(ground),
    buildingWidthFt: Math.max(...stories.map(spanOf)),
    studRule: null as string | null,
    steelWeightLb: 0,
  };

  const engineering = (msg: string): Estimate => ({
    ...empty,
    status: 'engineering-required',
    messages: [msg, 'Contact Frames and Supplies (Guyana) for an engineered design and quote.'],
    stats,
  });
  if (stories.length > f.maxStoriesPriced) {
    return engineering(`Buildings over ${f.maxStoriesPriced} stories depend on engineering, so no price is given.`);
  }
  if (d.wallHeightFt > f.maxWallHeightFt) {
    return engineering(`Walls taller than ${f.maxWallHeightFt} ft need engineering, so no price is given.`);
  }
  const rule = selectStudRule(settings, d);
  if (!rule) {
    return engineering(`No framing rule covers a ${stories.length}-story building this size.`);
  }
  stats.studRule = rule.name;

  // ── FRAMING ────────────────────────────────────────────────────────────
  const framingLines: EstimateLine[] = [];
  const pieces: Piece[] = [];
  const waste = 1 + f.wastePct;
  const priceOfPieces = (ps: Piece[]): Money =>
    sum(ps.map((p) => steelPricePerLft(settings, p.code).pricePerLft.mul(p.pieces * p.lengthFt * waste)));

  stories.forEach((story, i) => {
    const framing = floorFramingFor(rule, i);
    const ps = storyTakeoff(settings, d, story, i, framing);
    pieces.push(...ps);
    const material = priceOfPieces(ps);
    const lft = ps.reduce((s, p) => s + p.pieces * p.lengthFt, 0) * waste;
    framingLines.push({
      id: `walls-${i}`,
      label: `Wall framing, floor ${i + 1}`,
      qty: r1(lft),
      unit: 'lft steel',
      materialUsd: material,
      laborUsd: material.mul(f.laborPctOfMaterial),
      explain:
        `${framing.stud} studs${framing.backToBack ? ' back-to-back' : ''} at ${f.studSpacingIn}" OC with ${framing.track} track. ` +
        `Openings get ${f.openingStudsPerSideByStories[Math.min(stories.length, f.openingStudsPerSideByStories.length) - 1]} studs each side, a box header and cripples. ` +
        `Includes ${Math.round(f.wastePct * 100)}% waste. Labor is ${Math.round(f.laborPctOfMaterial * 100)}% of material.`,
    });
  });

  const roofWalls = roofWallTakeoff(settings, d, floorFramingFor(rule, stories.length - 1));
  if (roofWalls.length) {
    pieces.push(...roofWalls);
    const material = priceOfPieces(roofWalls);
    const lft = roofWalls.reduce((s, p) => s + p.pieces * p.lengthFt, 0) * waste;
    framingLines.push({
      id: 'roof-walls',
      label: d.roof.type === 'gable' ? 'Gable end framing' : 'Parapet framing',
      qty: r1(lft),
      unit: 'lft steel',
      materialUsd: material,
      laborUsd: material.mul(f.laborPctOfMaterial),
      explain: 'Framed with the top floor studs and track.',
    });
  }

  // Floors: every upper floor, plus the ground floor when the house is raised.
  stories.forEach((story, i) => {
    if (i === 0 && d.foundation !== 'raised') return;
    const area = footprintArea(story);
    const span = spanOf(story);
    const sys = floorSystemRate(settings, span);
    const material = usd(sys.rate).mul(area);
    framingLines.push({
      id: `floor-${i}`,
      label: `Floor framing, floor ${i + 1}`,
      qty: r1(area),
      unit: 'sq ft',
      materialUsd: material,
      laborUsd: material.mul(sys.laborPct),
      explain:
        sys.kind === 'joists'
          ? `Span ${fmtFt(span)} is ${settings.floorsAndRoofs.joistMaxSpanFt} ft or less, so joists at $${sys.rate}/sq ft (material only).`
          : `Span ${fmtFt(span)} is over ${settings.floorsAndRoofs.joistMaxSpanFt} ft, so floor trusses at $${sys.rate}/sq ft including material and assembly.`,
    });
  });

  // Roof structure.
  {
    const span = roofSpan(d, top);
    const pitched = d.roof.type !== 'flat';
    const overhang = pitched ? d.roof.overhangFt : 0;
    const area = settings.floorsAndRoofs.roofAreaIncludesOverhang
      ? roofPlanArea(top, overhang)
      : footprintArea(top);
    const sys = pitched
      ? { kind: 'trusses' as const, rate: trussRate(settings, span), laborPct: settings.floorsAndRoofs.trussInstallLaborPct }
      : floorSystemRate(settings, span);
    const material = usd(sys.rate).mul(area);
    framingLines.push({
      id: 'roof',
      label: `Roof framing (${d.roof.type})`,
      qty: r1(area),
      unit: 'sq ft plan',
      materialUsd: material,
      laborUsd: material.mul(sys.laborPct),
      explain:
        sys.kind === 'joists'
          ? `Flat roof spanning ${fmtFt(span)}: joists at $${sys.rate}/sq ft (material only).`
          : `${pitched ? 'Pitched roofs always use trusses' : 'Flat roof over ' + settings.floorsAndRoofs.joistMaxSpanFt + ' ft uses trusses'}. Span ${fmtFt(span)} prices at $${sys.rate}/sq ft including material and assembly.`,
    });
  }

  // ── FOUNDATION ─────────────────────────────────────────────────────────
  const fd = settings.foundation;
  const groundArea = footprintArea(ground);
  const groundPerim = exteriorPerimeter(ground);
  const foundationLines: EstimateLine[] = [];
  if (d.foundation === 'slab') {
    foundationLines.push({
      id: 'slab', label: 'Concrete slab', qty: r1(groundArea), unit: 'sq ft',
      ...perUnit(groundArea, fd.slabMaterialUsdPerSqft, fd.slabLaborUsdPerSqft),
      explain: 'Slab-on-grade under the ground floor.',
    });
  } else {
    foundationLines.push({
      id: 'piers', label: 'Piers / columns (raised house)', qty: r1(groundArea), unit: 'sq ft',
      ...perUnit(groundArea, fd.raisedPiersMaterialUsdPerSqft, fd.raisedPiersLaborUsdPerSqft),
      explain: 'Concrete piers that lift the house off the ground, common in Guyana for flooding and airflow.',
    });
  }
  foundationLines.push({
    id: 'footing', label: 'Perimeter footing', qty: r1(groundPerim), unit: 'lft',
    ...perUnit(groundPerim, fd.footingMaterialUsdPerLft, fd.footingLaborUsdPerLft),
    explain: 'Thickened edge / strip footing under the exterior walls.',
  });

  // ── OTHER ──────────────────────────────────────────────────────────────
  const otherLines: EstimateLine[] = [];
  const H = d.wallHeightFt;
  let extGross = 0, extOpen = 0, intWallOneSide = 0, intOpen = 0;
  let windowArea = 0, windows = 0, extDoors = 0, intDoors = 0, bathrooms = 0, kitchens = 0;
  for (const st of stories) {
    for (const w of st.walls) {
      const L = wallLength(w);
      const ops = openingsOnWall(st, w.id);
      const openArea = ops.reduce((s, o) => s + o.widthFt * o.heightFt, 0);
      if (w.exterior) { extGross += L * H; extOpen += openArea; }
      else { intWallOneSide += L * H; intOpen += openArea; }
      for (const o of ops) {
        if (o.kind === 'window') { windows++; windowArea += o.widthFt * o.heightFt; }
        else if (w.exterior) extDoors++;
        else intDoors++;
      }
    }
    bathrooms += st.rooms.filter((r) => r.type === 'bathroom').length;
    kitchens += st.rooms.filter((r) => r.type === 'kitchen').length;
  }
  const topSpan = roofSpan(d, top);
  const gableArea = d.roof.type === 'gable' ? topSpan * roofRise(d, topSpan) : 0; // two triangles
  const parapetArea = d.roof.type === 'flat' ? exteriorPerimeter(top) * d.roof.parapetFt : 0;
  const sidingArea = Math.max(0, extGross - extOpen) + gableArea + parapetArea;

  const siding = settings.finishes.siding.find((s) => s.id === d.finishes.siding) ?? settings.finishes.siding[0];
  if (siding) {
    otherLines.push({
      id: 'siding', label: `Exterior: ${siding.name}`, qty: r1(sidingArea), unit: 'sq ft',
      ...perUnit(sidingArea, siding.materialUsdPerSqft, siding.laborUsdPerSqft),
      explain: 'Outside face of exterior walls, less windows and doors, plus gable ends or parapets.',
    });
  }
  const roofing = settings.finishes.roofing.find((s) => s.id === d.finishes.roofing) ?? settings.finishes.roofing[0];
  if (roofing) {
    const pitched = d.roof.type !== 'flat';
    const slope = pitched ? Math.sqrt(1 + (d.roof.pitch / 12) ** 2) : 1;
    const area = (pitched ? roofPlanArea(top, d.roof.overhangFt) : footprintArea(top)) * slope;
    otherLines.push({
      id: 'roofing', label: `Roofing: ${roofing.name}`, qty: r1(area), unit: 'sq ft',
      ...perUnit(area, roofing.materialUsdPerSqft, roofing.laborUsdPerSqft),
      explain: pitched ? `Roof surface including overhang; a ${d.roof.pitch}/12 pitch adds ${Math.round((slope - 1) * 100)}% over the plan area.` : 'Flat roof surface.',
    });
  }
  const op = settings.openings;
  if (windows) {
    otherLines.push({
      id: 'windows', label: 'Windows', qty: windows, unit: 'each',
      materialUsd: usd(op.windowMaterialUsdPerSqft).mul(windowArea),
      laborUsd: usd(op.windowInstallUsdEach).mul(windows),
      explain: `${r1(windowArea)} sq ft of window, priced by size, plus installation each.`,
    });
  }
  if (extDoors) otherLines.push({ id: 'ext-doors', label: 'Exterior doors', qty: extDoors, unit: 'each', ...perUnit(extDoors, op.exteriorDoorMaterialUsdEach, op.doorInstallUsdEach), explain: 'Doors in exterior walls.' });
  if (intDoors) otherLines.push({ id: 'int-doors', label: 'Interior doors', qty: intDoors, unit: 'each', ...perUnit(intDoors, op.interiorDoorMaterialUsdEach, op.doorInstallUsdEach), explain: 'Doors in interior walls.' });

  const it = settings.interior;
  const ceilings = floorAreaSqft;
  const drywall = Math.max(0, extGross - extOpen) + Math.max(0, 2 * intWallOneSide - 2 * intOpen) + ceilings;
  otherLines.push({ id: 'drywall', label: 'Drywall (walls and ceilings)', qty: r1(drywall), unit: 'sq ft', ...perUnit(drywall, it.drywallMaterialUsdPerSqft, it.drywallLaborUsdPerSqft), explain: 'Inside face of exterior walls, both sides of interior walls, and every ceiling.' });
  otherLines.push({ id: 'paint', label: 'Interior paint', qty: r1(drywall), unit: 'sq ft', ...perUnit(drywall, it.paintMaterialUsdPerSqft, it.paintLaborUsdPerSqft), explain: 'Same area as the drywall.' });
  const insul = Math.max(0, extGross - extOpen) + footprintArea(top);
  otherLines.push({ id: 'insulation', label: 'Insulation', qty: r1(insul), unit: 'sq ft', ...perUnit(insul, it.insulationMaterialUsdPerSqft, it.insulationLaborUsdPerSqft), explain: 'Exterior walls and the top ceiling. Keeps the heat out and quiets rain on the roof.' });
  otherLines.push({ id: 'flooring', label: 'Floor tile', qty: r1(floorAreaSqft), unit: 'sq ft', ...perUnit(floorAreaSqft, it.flooringMaterialUsdPerSqft, it.flooringLaborUsdPerSqft), explain: 'Every floor.' });

  const al = settings.allowances;
  otherLines.push({ id: 'electrical', label: 'Electrical', qty: r1(floorAreaSqft), unit: 'sq ft', ...perUnit(floorAreaSqft, al.electricalMaterialUsdPerSqft, al.electricalLaborUsdPerSqft), explain: 'Allowance by floor area: panel, wiring, outlets and lights.' });
  otherLines.push({ id: 'plumbing', label: 'Plumbing', qty: r1(floorAreaSqft), unit: 'sq ft', ...perUnit(floorAreaSqft, al.plumbingMaterialUsdPerSqft, al.plumbingLaborUsdPerSqft), explain: 'Allowance by floor area: supply and drain piping.' });
  if (bathrooms) otherLines.push({ id: 'bathrooms', label: 'Bathroom fixtures', qty: bathrooms, unit: 'each', ...perUnit(bathrooms, al.bathroomMaterialUsd, al.bathroomLaborUsd), explain: 'Toilet, sink and shower for each bathroom you placed.' });
  if (kitchens) otherLines.push({ id: 'kitchens', label: 'Kitchen', qty: kitchens, unit: 'each', ...perUnit(kitchens, al.kitchenMaterialUsd, al.kitchenLaborUsd), explain: 'Cabinets, countertop and sink allowance.' });
  if (al.waterStorageUsd > 0) otherLines.push({ id: 'water', label: 'Water tank and pump', qty: 1, unit: 'each', materialUsd: usd(al.waterStorageUsd), laborUsd: ZERO, explain: 'Allowance per house.' });
  if (al.septicUsd > 0) otherLines.push({ id: 'septic', label: 'Septic tank and soakaway', qty: 1, unit: 'each', materialUsd: usd(al.septicUsd), laborUsd: ZERO, explain: 'Allowance per house.' });

  const sections = [
    section('framing', 'Framing', framingLines),
    section('foundation', 'Foundation', foundationLines),
    section('other', 'Finishes and other', otherLines),
  ];

  const parts: PricedPart[] = aggregateParts(settings, pieces).map((p) => {
    const unit = steelPricePerLft(settings, p.code);
    return {
      ...p,
      pricePerLftUsd: unit.pricePerLft,
      totalUsd: unit.pricePerLft.mul(p.lft),
      weightLb: unit.weightPerFtLb * p.lft,
    };
  });
  stats.steelWeightLb = parts.reduce((s, p) => s + p.weightLb, 0);

  const materialUsd = sum(sections.map((s) => s.materialUsd));
  const laborUsd = sum(sections.map((s) => s.laborUsd));
  return {
    status: 'ok',
    messages: [],
    sections,
    parts,
    pieces,
    stats,
    materialUsd,
    laborUsd,
    totalUsd: materialUsd.plus(laborUsd),
  };
};

export const perSqft = (e: Estimate): Money =>
  e.stats.floorAreaSqft > 0 ? e.totalUsd.div(e.stats.floorAreaSqft) : new Decimal(0);
