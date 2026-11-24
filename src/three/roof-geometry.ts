// Roof surfaces as triangles, in world coordinates (x = plan x, y = up,
// z = plan y). Built over the top story's bounding box.
import type { Bounds } from '../model/geometry';
import type { RoofDesign } from '../model/types';

export type V3 = [number, number, number];
export interface RoofMesh {
  /** Sloped roof surface triangles. */
  roof: V3[][];
  /** Gable-end wall triangles (siding). */
  gables: V3[][];
}

const quad = (a: V3, b: V3, c: V3, d: V3): V3[][] => [
  [a, b, c],
  [a, c, d],
];

/**
 * @param b      top story bounds (plan feet)
 * @param topY   height of the wall tops
 */
export const pitchedRoof = (b: Bounds, roof: RoofDesign, topY: number): RoofMesh => {
  const o = roof.overhangFt;
  const slope = roof.pitch / 12;
  const alongX = roof.ridgeAxis === 'auto' ? b.width >= b.depth : roof.ridgeAxis === 'x';
  // Work in a local frame where the ridge runs along "u" and the span is "v".
  const uMin = alongX ? b.minX : b.minY;
  const uMax = alongX ? b.maxX : b.maxY;
  const vMin = alongX ? b.minY : b.minX;
  const vMax = alongX ? b.maxY : b.maxX;
  const span = vMax - vMin;
  const vMid = (vMin + vMax) / 2;
  const rise = (span / 2) * slope;
  const ridgeY = topY + rise;
  const eaveY = topY - o * slope;
  const P = (u: number, y: number, v: number): V3 => (alongX ? [u, y, v] : [v, y, u]);

  if (roof.type === 'gable') {
    const u0 = uMin - o, u1 = uMax + o;
    const roofTris = [
      ...quad(P(u0, eaveY, vMin - o), P(u1, eaveY, vMin - o), P(u1, ridgeY, vMid), P(u0, ridgeY, vMid)),
      ...quad(P(u1, eaveY, vMax + o), P(u0, eaveY, vMax + o), P(u0, ridgeY, vMid), P(u1, ridgeY, vMid)),
    ];
    const gables = [
      [P(uMin, topY, vMin), P(uMin, topY, vMax), P(uMin, ridgeY, vMid)],
      [P(uMax, topY, vMax), P(uMax, topY, vMin), P(uMax, ridgeY, vMid)],
    ];
    return { roof: roofTris, gables };
  }

  // Hip: ridge shortened by half the span at each end (equal pitch all round).
  const half = span / 2;
  const r0 = Math.min(uMin + half, (uMin + uMax) / 2);
  const r1 = Math.max(uMax - half, (uMin + uMax) / 2);
  const e = { u0: uMin - o, u1: uMax + o, v0: vMin - o, v1: vMax + o };
  const ridgeA = P(r0, ridgeY, vMid), ridgeB = P(r1, ridgeY, vMid);
  const c00 = P(e.u0, eaveY, e.v0), c10 = P(e.u1, eaveY, e.v0), c11 = P(e.u1, eaveY, e.v1), c01 = P(e.u0, eaveY, e.v1);
  return {
    roof: [
      ...quad(c00, c10, ridgeB, ridgeA),
      ...quad(c11, c01, ridgeA, ridgeB),
      [c10, c11, ridgeB],
      [c01, c00, ridgeA],
    ],
    gables: [],
  };
};
