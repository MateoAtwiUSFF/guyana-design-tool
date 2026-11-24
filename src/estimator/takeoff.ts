// Wall framing takeoff: counts every stud and track piece in the walls.
//
// Per wall, at the stud spacing (16" OC by default):
//   common studs  = ceil(length / spacing) + 1, less the ones that fall in openings
//   track         = top + bottom, the full wall length
// Per window (and door, if the setting says so):
//   king/jack studs  = N on each side, N by story count (2 / 3 / 4)
//   box header       = 2 studs + 2 tracks, same size and gauge as the wall
//   cripples         = at the stud spacing, above the header and below the sill
//   sill track       = one track under the window
// Per story: extra studs at corners and tees.
// Gable ends and parapets are framed with the top floor's members.
import { exteriorPerimeter, junctions, openingsOnWall, storyBounds, wallLength } from '../model/geometry';
import type { Design, Story } from '../model/types';
import { findProfile } from './steel';
import type { FloorFraming, Settings, StudRule } from './settings';

export type PieceRole =
  | 'common stud'
  | 'king/jack stud'
  | 'corner/tee stud'
  | 'header stud'
  | 'header track'
  | 'cripple stud'
  | 'sill track'
  | 'wall track'
  | 'gable stud'
  | 'gable track'
  | 'parapet stud'
  | 'parapet track';

export interface Piece {
  storyIndex: number;
  role: PieceRole;
  code: string;
  pieces: number;
  lengthFt: number;
}

export const pieceLft = (p: Piece): number => p.pieces * p.lengthFt;

/** The building width that picks the stud rule: the widest story's short side. */
export const buildingWidth = (design: Design): number =>
  Math.max(0, ...design.stories.map((s) => {
    const b = storyBounds(s);
    return b ? Math.min(b.width, b.depth) : 0;
  }));

export const selectStudRule = (settings: Settings, design: Design): StudRule | null => {
  const n = design.stories.length;
  const width = buildingWidth(design);
  return (
    settings.framing.studRules.find(
      (r) => r.stories === n && (r.maxWidthFt == null || width <= r.maxWidthFt),
    ) ?? null
  );
};

export const floorFramingFor = (rule: StudRule, storyIndex: number): FloorFraming =>
  rule.floors[Math.min(storyIndex, rule.floors.length - 1)]!;

const studsPerSide = (settings: Settings, stories: number): number => {
  const table = settings.framing.openingStudsPerSideByStories;
  return table[Math.min(stories, table.length) - 1] ?? 1;
};

const countAtSpacing = (lengthFt: number, spacingIn: number): number =>
  Math.ceil((lengthFt * 12) / spacingIn - 1e-9);

export const storyTakeoff = (
  settings: Settings,
  design: Design,
  story: Story,
  storyIndex: number,
  framing: FloorFraming,
): Piece[] => {
  const f = settings.framing;
  const oc = f.studSpacingIn;
  const H = design.wallHeightFt;
  const n = studsPerSide(settings, design.stories.length);
  const btb = framing.backToBack ? 2 : 1;
  const openingBtb = framing.backToBack && f.backToBackIncludesOpeningStuds ? 2 : 1;
  const webFt = (findProfile(settings, framing.stud)?.webIn ?? 3.625) / 12;
  const out: Piece[] = [];
  const add = (role: PieceRole, code: string, pieces: number, lengthFt: number) => {
    if (pieces > 0 && lengthFt > 0) out.push({ storyIndex, role, code, pieces, lengthFt });
  };

  for (const wall of story.walls) {
    const L = wallLength(wall);
    if (L <= 0) continue;
    let commons = countAtSpacing(L, oc) + 1;
    add('wall track', framing.track, 2, L);

    for (const o of openingsOnWall(story, wall.id)) {
      const isWindow = o.kind === 'window';
      const rulesApply = isWindow || f.openingRulesApplyToDoors;
      const perSide = rulesApply ? n : 1;
      commons -= Math.max(0, Math.floor((o.widthFt * 12) / oc));
      add('king/jack stud', framing.stud, 2 * perSide * openingBtb, H);
      if (!rulesApply) continue;

      const headerLen = o.widthFt + (2 * f.headerBearingIn) / 12;
      add('header stud', framing.stud, f.headerStuds, headerLen);
      add('header track', framing.track, f.headerTracks, headerLen);

      const crippleCount = Math.max(1, Math.floor((o.widthFt * 12) / oc));
      const topLen = H - (o.sillFt + o.heightFt) - webFt;
      if (topLen > 0.05) add('cripple stud', framing.stud, crippleCount, topLen);
      if (isWindow && o.sillFt > 0.05) {
        add('cripple stud', framing.stud, crippleCount, o.sillFt);
        add('sill track', framing.track, f.sillTracks, o.widthFt);
      }
    }
    add('common stud', framing.stud, Math.max(0, commons) * btb, H);
  }

  const j = junctions(story.walls);
  add('corner/tee stud', framing.stud, (j.corners * f.cornerExtraStuds + j.tees * f.teeExtraStuds) * openingBtb, H);
  return out;
};

/** Rise of a pitched roof over its span (gable/hip), feet. */
export const roofRise = (design: Design, span: number): number =>
  design.roof.type === 'flat' ? 0 : (span / 2) * (design.roof.pitch / 12);

/** The roof span: the side perpendicular to the ridge. */
export const roofSpan = (design: Design, story: Story): number => {
  const b = storyBounds(story);
  if (!b) return 0;
  const axis = design.roof.ridgeAxis === 'auto' ? (b.width >= b.depth ? 'x' : 'y') : design.roof.ridgeAxis;
  if (design.roof.type === 'gable') return axis === 'x' ? b.depth : b.width;
  return Math.min(b.width, b.depth);
};

/** Gable-end triangle studs, and parapet walls, framed with the top floor's members. */
export const roofWallTakeoff = (settings: Settings, design: Design, framing: FloorFraming): Piece[] => {
  const top = design.stories.length - 1;
  const story = design.stories[top];
  if (!story) return [];
  const oc = settings.framing.studSpacingIn;
  const out: Piece[] = [];
  if (design.roof.type === 'gable') {
    const span = roofSpan(design, story);
    const rise = roofRise(design, span);
    if (span > 0 && rise > 0) {
      // Studs in a triangle average half the rise; two gable ends.
      const studs = countAtSpacing(span, oc) + 1;
      out.push({ storyIndex: top, role: 'gable stud', code: framing.stud, pieces: 2 * studs, lengthFt: rise / 2 });
      const rake = Math.hypot(span / 2, rise);
      out.push({ storyIndex: top, role: 'gable track', code: framing.track, pieces: 4, lengthFt: rake });
    }
  } else if (design.roof.type === 'flat' && design.roof.parapetFt > 0) {
    const perim = exteriorPerimeter(story);
    const studs = countAtSpacing(perim, oc) + 1;
    out.push({ storyIndex: top, role: 'parapet stud', code: framing.stud, pieces: studs, lengthFt: design.roof.parapetFt });
    out.push({ storyIndex: top, role: 'parapet track', code: framing.track, pieces: 2, lengthFt: perim });
  }
  return out;
};

export interface PartTotal {
  code: string;
  description: string;
  pieces: number;
  lft: number;
}

/** Totals by product code, with waste added to linear feet. */
export const aggregateParts = (settings: Settings, pieces: ReadonlyArray<Piece>): PartTotal[] => {
  const map = new Map<string, PartTotal>();
  for (const p of pieces) {
    const t = map.get(p.code) ?? {
      code: p.code,
      description: findProfile(settings, p.code)?.description ?? p.code,
      pieces: 0,
      lft: 0,
    };
    t.pieces += p.pieces;
    t.lft += pieceLft(p);
    map.set(p.code, t);
  }
  const waste = 1 + settings.framing.wastePct;
  return [...map.values()].map((t) => ({ ...t, lft: t.lft * waste }));
};
