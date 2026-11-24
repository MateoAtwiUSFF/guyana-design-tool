// Builders for new designs and shapes.
import { DEFAULT_SETTINGS, type Settings } from '../estimator/settings';
import type { Design, Pt, Story, Wall } from './types';

export const uid = (prefix = 'id'): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;

export const emptyStory = (): Story => ({ id: uid('story'), walls: [], openings: [], rooms: [], furniture: [] });

/** Closed loop of exterior walls through the given corners. */
export const loopWalls = (pts: Pt[], exterior = true): Wall[] =>
  pts.map((a, i) => ({ id: uid('wall'), a, b: pts[(i + 1) % pts.length]!, exterior }));

export const rectWalls = (x: number, y: number, w: number, h: number): Wall[] =>
  loopWalls([
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ]);

export const newDesign = (settings: Settings = DEFAULT_SETTINGS): Design => ({
  id: uid('design'),
  name: 'My house',
  stories: [emptyStory()],
  wallHeightFt: settings.framing.defaultWallHeightFt,
  foundation: 'slab',
  roof: { type: 'gable', pitch: 5, overhangFt: 1.5, parapetFt: 3, ridgeAxis: 'auto' },
  finishes: {
    siding: settings.finishes.siding[0]?.id ?? '',
    sidingColor: settings.finishes.siding[0]?.defaultColor ?? '#eeeeee',
    roofing: settings.finishes.roofing[0]?.id ?? '',
    roofColor: settings.finishes.roofing[0]?.defaultColor ?? '#999999',
    trimColor: settings.finishes.trimColors[0] ?? '#ffffff',
  },
  updatedAt: new Date().toISOString(),
});

/** A 24 x 32 ft starter house: 2 bedrooms, 1 bath, kitchen/living. */
export const sampleDesign = (settings: Settings = DEFAULT_SETTINGS): Design => {
  const d = newDesign(settings);
  d.name = 'Starter house 24 x 32';
  const s = d.stories[0]!;
  s.walls = rectWalls(0, 0, 32, 24);
  const [south, east, north, west] = s.walls as [Wall, Wall, Wall, Wall];
  const iw1: Wall = { id: uid('wall'), a: { x: 16, y: 0 }, b: { x: 16, y: 24 }, exterior: false };
  const iw2: Wall = { id: uid('wall'), a: { x: 16, y: 12 }, b: { x: 32, y: 12 }, exterior: false };
  const iw3: Wall = { id: uid('wall'), a: { x: 0, y: 8 }, b: { x: 8, y: 8 }, exterior: false };
  const iw4: Wall = { id: uid('wall'), a: { x: 8, y: 0 }, b: { x: 8, y: 8 }, exterior: false };
  s.walls.push(iw1, iw2, iw3, iw4);
  s.openings = [
    { id: uid('op'), wallId: south.id, kind: 'door', offsetFt: 12, widthFt: 3, heightFt: 6.83, sillFt: 0 },
    { id: uid('op'), wallId: south.id, kind: 'window', offsetFt: 24, widthFt: 4, heightFt: 4, sillFt: 3 },
    { id: uid('op'), wallId: east.id, kind: 'window', offsetFt: 6, widthFt: 4, heightFt: 4, sillFt: 3 },
    { id: uid('op'), wallId: east.id, kind: 'window', offsetFt: 18, widthFt: 4, heightFt: 4, sillFt: 3 },
    { id: uid('op'), wallId: north.id, kind: 'window', offsetFt: 8, widthFt: 6, heightFt: 4, sillFt: 3 },
    { id: uid('op'), wallId: west.id, kind: 'window', offsetFt: 4, widthFt: 2, heightFt: 2, sillFt: 5 },
    { id: uid('op'), wallId: west.id, kind: 'window', offsetFt: 16, widthFt: 4, heightFt: 4, sillFt: 3 },
    { id: uid('op'), wallId: iw2.id, kind: 'door', offsetFt: 4, widthFt: 2.67, heightFt: 6.83, sillFt: 0 },
    { id: uid('op'), wallId: iw3.id, kind: 'door', offsetFt: 4, widthFt: 2.5, heightFt: 6.83, sillFt: 0 },
    { id: uid('op'), wallId: iw1.id, kind: 'door', offsetFt: 4, widthFt: 2.67, heightFt: 6.83, sillFt: 0 },
    { id: uid('op'), wallId: iw1.id, kind: 'door', offsetFt: 18, widthFt: 2.67, heightFt: 6.83, sillFt: 0 },
  ];
  s.rooms = [
    { id: uid('room'), name: 'Bedroom 1', type: 'bedroom', x: 16, y: 12, w: 16, h: 12 },
    { id: uid('room'), name: 'Bedroom 2', type: 'bedroom', x: 16, y: 0, w: 16, h: 12 },
    { id: uid('room'), name: 'Bath', type: 'bathroom', x: 0, y: 0, w: 8, h: 8 },
    { id: uid('room'), name: 'Kitchen / living', type: 'kitchen', x: 0, y: 8, w: 16, h: 16 },
  ];
  s.furniture = [
    { id: uid('f'), kind: 'bed', x: 24, y: 18, rotation: 0 },
    { id: uid('f'), kind: 'bed', x: 24, y: 6, rotation: 0 },
    { id: uid('f'), kind: 'toilet', x: 2, y: 2, rotation: 0 },
    { id: uid('f'), kind: 'shower', x: 6, y: 6, rotation: 0 },
    { id: uid('f'), kind: 'sofa', x: 6, y: 20, rotation: 0 },
    { id: uid('f'), kind: 'counter', x: 12, y: 12, rotation: 90 },
  ];
  return d;
};
