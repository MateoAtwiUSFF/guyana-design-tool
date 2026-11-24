import { describe, expect, it } from 'vitest';
import { newDesign, rectWalls, sampleDesign, emptyStory } from '../model/factory';
import type { Design, Wall } from '../model/types';
import { estimate, floorSystemRate, trussRate } from './estimate';
import { DEFAULT_SETTINGS as S, type Settings } from './settings';
import { steelPricePerLft } from './steel';
import { selectStudRule, storyTakeoff } from './takeoff';

const clone = <T>(x: T): T => structuredClone(x);

const oneWall = (lengthFt: number): Design => {
  const d = newDesign(S);
  const wall: Wall = { id: 'w1', a: { x: 0, y: 0 }, b: { x: lengthFt, y: 0 }, exterior: true };
  d.stories[0]!.walls = [wall];
  return d;
};

const byRole = (pieces: ReturnType<typeof storyTakeoff>, role: string) =>
  pieces.filter((p) => p.role === role);

describe('steel pricing (ERP method)', () => {
  it('prices 362S162-33 per lft as weight × $/lb ÷ yield + overhead + roll-form labor, then margin', () => {
    const w = 0.87615;
    const cost = (w * 0.53) / 0.88 + w * 0.1 + 70 / 1200;
    const p = steelPricePerLft(S, '362S162-33');
    expect(p.costPerLft.toNumber()).toBeCloseTo(cost, 10);
    expect(p.pricePerLft.toNumber()).toBeCloseTo(cost / (1 - 0.375), 10);
  });

  it('follows the admin steel price', () => {
    const s = clone(S);
    s.steel.gauges['33']!.pricePerLbUsd = 1;
    expect(steelPricePerLft(s, '362S162-33').pricePerLft.gt(steelPricePerLft(S, '362S162-33').pricePerLft)).toBe(true);
  });
});

describe('wall takeoff', () => {
  it('frames a plain 10 ft wall at 16" OC: 9 studs and top + bottom track', () => {
    const d = oneWall(10);
    const rule = selectStudRule(S, d)!;
    const ps = storyTakeoff(S, d, d.stories[0]!, 0, rule.floors[0]!);
    expect(byRole(ps, 'common stud')[0]).toMatchObject({ code: '362S162-33', pieces: 9, lengthFt: 9 });
    expect(byRole(ps, 'wall track')[0]).toMatchObject({ code: '362T125-33', pieces: 2, lengthFt: 10 });
  });

  it('frames a window: kings/jacks each side, box header, cripples and sill track', () => {
    const d = oneWall(10);
    d.stories[0]!.openings = [{ id: 'o', wallId: 'w1', kind: 'window', offsetFt: 5, widthFt: 4, heightFt: 4, sillFt: 3 }];
    const ps = storyTakeoff(S, d, d.stories[0]!, 0, selectStudRule(S, d)!.floors[0]!);
    expect(byRole(ps, 'common stud')[0]!.pieces).toBe(9 - 3);
    expect(byRole(ps, 'king/jack stud')[0]!.pieces).toBe(4); // 2 each side, 1 story
    const headerLen = 4 + 8 / 12;
    expect(byRole(ps, 'header stud')[0]).toMatchObject({ pieces: 2 });
    expect(byRole(ps, 'header stud')[0]!.lengthFt).toBeCloseTo(headerLen);
    expect(byRole(ps, 'header track')[0]).toMatchObject({ pieces: 2, code: '362T125-33' });
    const cripples = byRole(ps, 'cripple stud');
    expect(cripples).toHaveLength(2);
    expect(cripples[0]!.pieces).toBe(3);
    expect(cripples[0]!.lengthFt).toBeCloseTo(9 - 7 - 3.625 / 12);
    expect(cripples[1]!.lengthFt).toBe(3);
    expect(byRole(ps, 'sill track')[0]).toMatchObject({ pieces: 1, lengthFt: 4 });
  });

  it('uses 3 studs per side for two stories and 4 for three', () => {
    for (const [stories, perSide] of [[2, 3], [3, 4]] as const) {
      const d = oneWall(10);
      d.stories[0]!.openings = [{ id: 'o', wallId: 'w1', kind: 'window', offsetFt: 5, widthFt: 4, heightFt: 4, sillFt: 3 }];
      while (d.stories.length < stories) d.stories.push({ ...emptyStory(), walls: clone(d.stories[0]!.walls) });
      const rule = selectStudRule(S, d)!;
      const framing = rule.floors[Math.min(1, rule.floors.length - 1)]!; // a single-stud floor
      const ps = storyTakeoff(S, d, d.stories[0]!, 1, framing);
      expect(byRole(ps, 'king/jack stud')[0]!.pieces).toBe(2 * perSide);
    }
  });

  it('counts corners of a rectangle', () => {
    const d = newDesign(S);
    d.stories[0]!.walls = rectWalls(0, 0, 20, 20);
    const ps = storyTakeoff(S, d, d.stories[0]!, 0, selectStudRule(S, d)!.floors[0]!);
    expect(byRole(ps, 'corner/tee stud')[0]!.pieces).toBe(4 * S.framing.cornerExtraStuds);
  });
});

describe('stud rules', () => {
  const house = (w: number, h: number, stories: number) => {
    const d = newDesign(S);
    d.stories = Array.from({ length: stories }, () => ({ ...emptyStory(), walls: rectWalls(0, 0, w, h) }));
    return d;
  };
  it('single story 25 ft wide or less: 20 ga 3-5/8"', () => {
    expect(selectStudRule(S, house(40, 25, 1))!.floors[0]!.stud).toBe('362S162-33');
  });
  it('single story wider than 25 ft: 18 ga', () => {
    expect(selectStudRule(S, house(40, 26, 1))!.floors[0]!.stud).toBe('362S162-43');
  });
  it('two story: 18 ga 3-5/8"', () => {
    expect(selectStudRule(S, house(30, 20, 2))!.floors[0]!.stud).toBe('362S162-43');
  });
  it('three story: 6" 18 ga, back-to-back on the first floor only', () => {
    const r = selectStudRule(S, house(30, 20, 3))!;
    expect(r.floors.map((f) => [f.stud, f.backToBack])).toEqual([
      ['600S162-43', true],
      ['600S162-43', false],
      ['600S162-43', false],
    ]);
  });
  it('four stories: engineering, no price', () => {
    const e = estimate(S, house(30, 20, 4));
    expect(e.status).toBe('engineering-required');
    expect(e.totalUsd.toNumber()).toBe(0);
  });
  it('the 25 ft limit comes from settings', () => {
    const s: Settings = clone(S);
    s.framing.studRules[0]!.maxWidthFt = 30;
    expect(selectStudRule(s, house(40, 28, 1))!.floors[0]!.stud).toBe('362S162-33');
  });
});

describe('floor and roof rates', () => {
  it('joists up to 15 ft, then truss tiers; limits take the lower rate', () => {
    expect(floorSystemRate(S, 15)).toMatchObject({ kind: 'joists', rate: 3 });
    expect(floorSystemRate(S, 15.1)).toMatchObject({ kind: 'trusses', rate: 8 });
    expect(trussRate(S, 25)).toBe(8);
    expect(trussRate(S, 25.1)).toBe(10);
    expect(trussRate(S, 32)).toBe(10);
    expect(trussRate(S, 32.1)).toBe(12);
  });

  it('pitched roofs always use trusses, even on short spans', () => {
    const d = newDesign(S);
    d.stories[0]!.walls = rectWalls(0, 0, 20, 12);
    d.roof.type = 'hip';
    const roof = estimate(S, d).sections[0]!.lines.find((l) => l.id === 'roof')!;
    expect(roof.explain).toContain('trusses');
  });

  it('a flat roof under 15 ft uses joists', () => {
    const d = newDesign(S);
    d.stories[0]!.walls = rectWalls(0, 0, 20, 12);
    d.roof.type = 'flat';
    const roof = estimate(S, d).sections[0]!.lines.find((l) => l.id === 'roof')!;
    expect(roof.materialUsd.toNumber()).toBeCloseTo(3 * 240);
  });
});

describe('estimate', () => {
  it('prices the sample house with framing labor at 80% of framing material', () => {
    const e = estimate(S, sampleDesign(S));
    expect(e.status).toBe('ok');
    const walls = e.sections[0]!.lines.find((l) => l.id === 'walls-0')!;
    expect(walls.laborUsd.toNumber()).toBeCloseTo(walls.materialUsd.toNumber() * 0.8, 6);
    expect(e.stats.floorAreaSqft).toBeCloseTo(768);
    expect(e.totalUsd.gt(0)).toBe(true);
    const perSqft = e.totalUsd.toNumber() / 768;
    // Sanity: a basic steel-frame house, well under the Guyana block-house range.
    expect(perSqft).toBeGreaterThan(40);
    expect(perSqft).toBeLessThan(160);
  });

  it('parts list lft equals pieces × length plus waste', () => {
    const e = estimate(S, oneWall(10));
    const stud = e.parts.find((p) => p.code === '362S162-33')!;
    expect(stud.lft).toBeCloseTo(9 * 9 * (1 + S.framing.wastePct));
  });
});
