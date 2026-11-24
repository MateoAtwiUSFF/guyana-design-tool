// The building a user draws. Every length is in FEET, measured on the plan
// (x to the east, y to the north). Story 0 is the ground floor.

export interface Pt {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  a: Pt;
  b: Pt;
  /** Exterior walls get siding outside and count toward the building outline. */
  exterior: boolean;
}

export type OpeningKind = 'window' | 'door';

export interface Opening {
  id: string;
  wallId: string;
  kind: OpeningKind;
  /** Distance along the wall, from wall end `a` to the CENTER of the opening. */
  offsetFt: number;
  widthFt: number;
  heightFt: number;
  /** Height of the bottom of the opening above the floor. 0 for doors. */
  sillFt: number;
}

export type RoomType = 'bedroom' | 'bathroom' | 'kitchen' | 'living' | 'dining' | 'laundry' | 'garage' | 'other';

/** A room is a labelled rectangle on the plan. */
export interface Room {
  id: string;
  name: string;
  type: RoomType;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type FurnitureKind =
  | 'bed'
  | 'sofa'
  | 'table'
  | 'toilet'
  | 'shower'
  | 'sink'
  | 'counter'
  | 'stove'
  | 'fridge'
  | 'wardrobe';

export interface Furniture {
  id: string;
  kind: FurnitureKind;
  x: number;
  y: number;
  /** Degrees, counter-clockwise. */
  rotation: number;
}

export interface Story {
  id: string;
  walls: Wall[];
  openings: Opening[];
  rooms: Room[];
  furniture: Furniture[];
}

export type RoofType = 'gable' | 'hip' | 'flat';

export interface RoofDesign {
  type: RoofType;
  /** Rise in inches per 12 inches of run (gable and hip). */
  pitch: number;
  /** Eave/rake overhang, feet (gable and hip). */
  overhangFt: number;
  /** Parapet height above the roof deck, feet (flat). */
  parapetFt: number;
  /** Which plan axis the ridge runs along (gable). 'auto' = the longer side. */
  ridgeAxis: 'auto' | 'x' | 'y';
}

export type FoundationType = 'slab' | 'raised';

export interface Finishes {
  /** id of a siding option in settings.finishes.siding */
  siding: string;
  sidingColor: string;
  /** id of a roofing option in settings.finishes.roofing */
  roofing: string;
  roofColor: string;
  trimColor: string;
}

export interface Design {
  id: string;
  name: string;
  stories: Story[];
  /** Floor-to-ceiling wall height per story, feet. */
  wallHeightFt: number;
  foundation: FoundationType;
  roof: RoofDesign;
  finishes: Finishes;
  updatedAt: string;
}
