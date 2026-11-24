// Plan geometry in feet.
import type { Opening, Pt, Story, Wall } from './types';

export const EPS = 0.05; // feet; points closer than this are the same point

export const dist = (a: Pt, b: Pt): number => Math.hypot(b.x - a.x, b.y - a.y);
export const wallLength = (w: Wall): number => dist(w.a, w.b);
export const samePt = (a: Pt, b: Pt): boolean => dist(a, b) < EPS;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  depth: number;
}

export const boundsOf = (pts: ReadonlyArray<Pt>): Bounds | null => {
  if (pts.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, depth: maxY - minY };
};

export const exteriorWalls = (story: Story): Wall[] => story.walls.filter((w) => w.exterior);

export const storyBounds = (story: Story): Bounds | null => {
  const walls = exteriorWalls(story).length ? exteriorWalls(story) : story.walls;
  return boundsOf(walls.flatMap((w) => [w.a, w.b]));
};

/**
 * The closed outline formed by the exterior walls, as a polygon, or null
 * when the exterior walls do not form exactly one closed loop.
 */
export const outlinePolygon = (story: Story): Pt[] | null => {
  const walls = exteriorWalls(story);
  if (walls.length < 3) return null;
  const remaining = [...walls];
  const first = remaining.shift()!;
  const poly: Pt[] = [first.a];
  let cursor = first.b;
  while (remaining.length) {
    const i = remaining.findIndex((w) => samePt(w.a, cursor) || samePt(w.b, cursor));
    if (i < 0) return null;
    const w = remaining.splice(i, 1)[0]!;
    poly.push(cursor);
    cursor = samePt(w.a, cursor) ? w.b : w.a;
  }
  return samePt(cursor, poly[0]!) ? poly : null;
};

export const polygonArea = (poly: ReadonlyArray<Pt>): number => {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
};

/** Floor area of a story: the outline polygon, else the bounding box. */
export const footprintArea = (story: Story): number => {
  const poly = outlinePolygon(story);
  if (poly) return polygonArea(poly);
  const b = storyBounds(story);
  return b ? b.width * b.depth : 0;
};

export const exteriorPerimeter = (story: Story): number =>
  exteriorWalls(story).reduce((s, w) => s + wallLength(w), 0);

/** The shorter plan side: what floor joists and trusses must span. */
export const spanOf = (story: Story): number => {
  const b = storyBounds(story);
  return b ? Math.min(b.width, b.depth) : 0;
};

const pointOnSegmentInterior = (p: Pt, w: Wall): boolean => {
  const len = wallLength(w);
  if (len < EPS) return false;
  const t = ((p.x - w.a.x) * (w.b.x - w.a.x) + (p.y - w.a.y) * (w.b.y - w.a.y)) / (len * len);
  if (t * len < EPS || (1 - t) * len < EPS) return false;
  const proj = { x: w.a.x + t * (w.b.x - w.a.x), y: w.a.y + t * (w.b.y - w.a.y) };
  return dist(p, proj) < EPS;
};

/**
 * Counts wall junctions: a corner where two wall ends meet, and a tee where
 * a wall end meets another wall (in its middle, or a third wall at a corner).
 */
export const junctions = (walls: ReadonlyArray<Wall>): { corners: number; tees: number } => {
  const groups: { p: Pt; n: number }[] = [];
  for (const w of walls) {
    for (const p of [w.a, w.b]) {
      const g = groups.find((x) => samePt(x.p, p));
      if (g) g.n++;
      else groups.push({ p, n: 1 });
    }
  }
  let corners = 0;
  let tees = 0;
  for (const g of groups) {
    if (g.n >= 2) {
      corners += 1;
      tees += g.n - 2;
    } else if (walls.some((w) => pointOnSegmentInterior(g.p, w))) {
      tees += 1;
    }
  }
  return { corners, tees };
};

export const openingsOnWall = (story: Story, wallId: string): Opening[] =>
  story.openings.filter((o) => o.wallId === wallId);

export const pointAlong = (w: Wall, offsetFt: number): Pt => {
  const len = wallLength(w) || 1;
  const t = offsetFt / len;
  return { x: w.a.x + (w.b.x - w.a.x) * t, y: w.a.y + (w.b.y - w.a.y) * t };
};
