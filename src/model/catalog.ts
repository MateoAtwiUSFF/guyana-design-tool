// Sizes and colours for things placed on the plan.
import type { FurnitureKind, RoomType } from './types';

export const FURNITURE: Record<FurnitureKind, { label: string; w: number; d: number; h: number; color: string }> = {
  bed: { label: 'Bed', w: 5, d: 6.67, h: 2, color: '#c9d6e3' },
  sofa: { label: 'Sofa', w: 7, d: 3, h: 2.6, color: '#8a9a7b' },
  table: { label: 'Table', w: 4, d: 3, h: 2.5, color: '#a47551' },
  toilet: { label: 'Toilet', w: 1.6, d: 2.4, h: 2.4, color: '#f4f4f4' },
  shower: { label: 'Shower', w: 3, d: 3, h: 6.5, color: '#bcd9e6' },
  sink: { label: 'Sink', w: 2, d: 1.6, h: 2.8, color: '#f4f4f4' },
  counter: { label: 'Counter', w: 8, d: 2, h: 3, color: '#d8cbb3' },
  stove: { label: 'Stove', w: 2.5, d: 2.2, h: 3, color: '#3b3b3b' },
  fridge: { label: 'Fridge', w: 2.5, d: 2.5, h: 6, color: '#e6e6e6' },
  wardrobe: { label: 'Wardrobe', w: 4, d: 2, h: 7, color: '#7d5a3c' },
};

export const ROOM_TYPES: Record<RoomType, { label: string; color: string }> = {
  bedroom: { label: 'Bedroom', color: '#dbe7f3' },
  bathroom: { label: 'Bathroom', color: '#d5eef0' },
  kitchen: { label: 'Kitchen', color: '#f6e7cf' },
  living: { label: 'Living', color: '#e9f0dc' },
  dining: { label: 'Dining', color: '#f3e3dc' },
  laundry: { label: 'Laundry', color: '#e6e1f0' },
  garage: { label: 'Garage', color: '#e4e4e4' },
  other: { label: 'Room', color: '#efefef' },
};

export const OPENING_DEFAULTS = {
  window: { widthFt: 4, heightFt: 4, sillFt: 3 },
  door: { widthFt: 3, heightFt: 6.83, sillFt: 0 },
  interiorDoor: { widthFt: 2.67, heightFt: 6.83, sillFt: 0 },
};
