// Every number the estimator uses lives here, and every one of them is
// editable on the admin page. Prices are entered in USD; the client app shows
// GYD at `currency.gydPerUsd`. Nothing in the estimator hard-codes a value.

export interface GaugeSetting {
  /** Display label, e.g. "20 ga". */
  label: string;
  /** Coil steel cost, USD per lb. */
  pricePerLbUsd: number;
  /** Coil yield after scrap (0..1). Material cost is divided by this. */
  yield: number;
}

export interface ProfileSetting {
  /** Product code in USFF nomenclature, e.g. "362S162-33". */
  code: string;
  description: string;
  /** Steel thickness in mils; picks the gauge price. */
  mil: number;
  /** Measured weight, lb per linear foot (USFF profile table). */
  weightPerFtLb: number;
  /** Web depth in inches (used for box-header depth). */
  webIn: number;
}

/** One floor's framing members within a stud rule. */
export interface FloorFraming {
  stud: string;
  track: string;
  /** Back-to-back: every full-height stud is doubled. */
  backToBack: boolean;
}

/**
 * Picks the wall framing for a building. The first rule whose `stories`
 * matches and whose `maxWidthFt` (if set) is not exceeded wins.
 * `floors[0]` is the ground floor; if there are fewer entries than stories
 * the last entry repeats.
 */
export interface StudRule {
  name: string;
  stories: number;
  /** Max building width (the shorter plan side), feet. null = any width. */
  maxWidthFt: number | null;
  floors: FloorFraming[];
}

export interface TrussTier {
  /** Applies to spans up to and including this, feet. null = no upper limit. */
  maxSpanFt: number | null;
  rateUsdPerSqft: number;
}

export interface FinishOption {
  id: string;
  name: string;
  materialUsdPerSqft: number;
  laborUsdPerSqft: number;
  /** Shown in the app to teach what the option is. */
  note: string;
  /** Default colour (hex) offered in the picker. */
  defaultColor: string;
}

export interface Settings {
  version: number;
  currency: {
    /** Guyana dollars per US dollar. */
    gydPerUsd: number;
  };

  /** Steel part pricing, same method as the USFF ERP pricing engine. */
  steel: {
    gauges: Record<string, GaugeSetting>;
    profiles: ProfileSetting[];
    /** Operational overhead, USD per lb of finished steel. */
    overheadPerLbUsd: number;
    /** Roll-forming labor, USD per linear foot. */
    rollFormLaborPerLftUsd: number;
    /** Margin on steel parts (0..1). Price = cost / (1 - margin). */
    marginPct: number;
  };

  framing: {
    studSpacingIn: number;
    /** Default wall height for new designs, feet. */
    defaultWallHeightFt: number;
    /** Tallest wall height priced without engineering, feet. */
    maxWallHeightFt: number;
    /** Buildings with more stories than this need engineering: no price. */
    maxStoriesPriced: number;
    studRules: StudRule[];
    /** Studs on EACH side of an opening, by story count: index 0 = 1 story. */
    openingStudsPerSideByStories: number[];
    /** Apply the opening stud rule to doors as well as windows. */
    openingRulesApplyToDoors: boolean;
    /** Box header: studs and tracks of the same gauge and size as the wall. */
    headerStuds: number;
    headerTracks: number;
    /** Header length beyond the rough opening, each side, inches. */
    headerBearingIn: number;
    /** Track pieces under each window (sill). */
    sillTracks: number;
    /** Extra full-height studs at each wall corner. */
    cornerExtraStuds: number;
    /** Extra full-height studs where a wall tees into another. */
    teeExtraStuds: number;
    /** Back-to-back doubling also doubles king/jack and corner studs. */
    backToBackIncludesOpeningStuds: boolean;
    /** Added to steel linear feet for cutting loss, percent (0..1). */
    wastePct: number;
    /** Framing labor as a fraction of the framing material price. */
    laborPctOfMaterial: number;
  };

  floorsAndRoofs: {
    /** Spans up to this use joists (floors and flat roofs only). */
    joistMaxSpanFt: number;
    /** Joists, material only, USD per sqft. */
    joistRateUsdPerSqft: number;
    /** Labor added to joists as a fraction of the joist price. */
    joistLaborPct: number;
    /** Trusses include material and assembly labor. Ordered by span. */
    trussTiers: TrussTier[];
    /** Install labor added to trusses as a fraction of the truss price. */
    trussInstallLaborPct: number;
    /** Price roof trusses on the plan area including overhangs. */
    roofAreaIncludesOverhang: boolean;
  };

  foundation: {
    slabMaterialUsdPerSqft: number;
    slabLaborUsdPerSqft: number;
    /** Thickened edge / strip footing under exterior walls. */
    footingMaterialUsdPerLft: number;
    footingLaborUsdPerLft: number;
    /** Raised house: piers/columns under a framed ground floor. */
    raisedPiersMaterialUsdPerSqft: number;
    raisedPiersLaborUsdPerSqft: number;
  };

  finishes: {
    siding: FinishOption[];
    roofing: FinishOption[];
    trimColors: string[];
  };

  openings: {
    windowMaterialUsdPerSqft: number;
    windowInstallUsdEach: number;
    exteriorDoorMaterialUsdEach: number;
    interiorDoorMaterialUsdEach: number;
    doorInstallUsdEach: number;
  };

  interior: {
    drywallMaterialUsdPerSqft: number;
    drywallLaborUsdPerSqft: number;
    paintMaterialUsdPerSqft: number;
    paintLaborUsdPerSqft: number;
    insulationMaterialUsdPerSqft: number;
    insulationLaborUsdPerSqft: number;
    /** Floor finish (tile) over the whole floor area. */
    flooringMaterialUsdPerSqft: number;
    flooringLaborUsdPerSqft: number;
  };

  allowances: {
    /** Fixtures for one bathroom (toilet, sink, shower). */
    bathroomMaterialUsd: number;
    bathroomLaborUsd: number;
    kitchenMaterialUsd: number;
    kitchenLaborUsd: number;
    electricalMaterialUsdPerSqft: number;
    electricalLaborUsdPerSqft: number;
    plumbingMaterialUsdPerSqft: number;
    plumbingLaborUsdPerSqft: number;
    /** Per house: water tank and pump. 0 to leave out. */
    waterStorageUsd: number;
    /** Per house: septic tank and soakaway. 0 to leave out. */
    septicUsd: number;
  };

  education: {
    websiteUrl: string;
    youtubeChannelUrl: string;
    /** Videos linked from the estimate. */
    videos: { youtubeId: string; title: string; topic: string }[];
  };
}

/** USFF profile table weights (lb/ft) for the parts this tool uses. */
const PROFILES: ProfileSetting[] = [
  { code: '362S162-33', description: '3-5/8" stud, 1-5/8" flange, 20 ga', mil: 33, weightPerFtLb: 0.87615, webIn: 3.625 },
  { code: '362T125-33', description: '3-5/8" track, 1-1/4" leg, 20 ga', mil: 33, weightPerFtLb: 0.712602, webIn: 3.625 },
  { code: '362S162-43', description: '3-5/8" stud, 1-5/8" flange, 18 ga', mil: 43, weightPerFtLb: 1.14165, webIn: 3.625 },
  { code: '362T125-43', description: '3-5/8" track, 1-1/4" leg, 18 ga', mil: 43, weightPerFtLb: 0.928542, webIn: 3.625 },
  { code: '600S162-43', description: '6" stud, 1-5/8" flange, 18 ga', mil: 43, weightPerFtLb: 1.506978, webIn: 6 },
  { code: '600T125-43', description: '6" track, 1-1/4" leg, 18 ga', mil: 43, weightPerFtLb: 1.286259, webIn: 6 },
  { code: '362S162-54', description: '3-5/8" stud, 1-5/8" flange, 16 ga', mil: 54, weightPerFtLb: 1.4337, webIn: 3.625 },
  { code: '362T125-54', description: '3-5/8" track, 1-1/4" leg, 16 ga', mil: 54, weightPerFtLb: 1.166076, webIn: 3.625 },
  { code: '600S162-54', description: '6" stud, 1-5/8" flange, 16 ga', mil: 54, weightPerFtLb: 1.892484, webIn: 6 },
  { code: '600T125-54', description: '6" track, 1-1/4" leg, 16 ga', mil: 54, weightPerFtLb: 1.615302, webIn: 6 },
];

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  currency: { gydPerUsd: 208.5 },

  steel: {
    // Starting values copied from the USFF ERP's company pricing seed
    // (0-30 day tier). Set the real Guyana coil prices on the admin page.
    gauges: {
      '33': { label: '20 ga (33 mil)', pricePerLbUsd: 0.53, yield: 0.88 },
      '43': { label: '18 ga (43 mil)', pricePerLbUsd: 0.53, yield: 0.88 },
      '54': { label: '16 ga (54 mil)', pricePerLbUsd: 0.53, yield: 0.88 },
    },
    profiles: PROFILES,
    overheadPerLbUsd: 0.1,
    rollFormLaborPerLftUsd: 70 / (20 * 60),
    marginPct: 0.375,
  },

  framing: {
    studSpacingIn: 16,
    defaultWallHeightFt: 9,
    maxWallHeightFt: 9,
    maxStoriesPriced: 3,
    studRules: [
      {
        name: 'Single story, 25 ft wide or less',
        stories: 1,
        maxWidthFt: 25,
        floors: [{ stud: '362S162-33', track: '362T125-33', backToBack: false }],
      },
      {
        name: 'Single story, wider than 25 ft',
        stories: 1,
        maxWidthFt: null,
        floors: [{ stud: '362S162-43', track: '362T125-43', backToBack: false }],
      },
      {
        name: 'Two story',
        stories: 2,
        maxWidthFt: null,
        floors: [{ stud: '362S162-43', track: '362T125-43', backToBack: false }],
      },
      {
        name: 'Three story',
        stories: 3,
        maxWidthFt: null,
        floors: [
          { stud: '600S162-43', track: '600T125-43', backToBack: true },
          { stud: '600S162-43', track: '600T125-43', backToBack: false },
          { stud: '600S162-43', track: '600T125-43', backToBack: false },
        ],
      },
    ],
    openingStudsPerSideByStories: [2, 3, 4],
    openingRulesApplyToDoors: true,
    headerStuds: 2,
    headerTracks: 2,
    headerBearingIn: 4,
    sillTracks: 1,
    cornerExtraStuds: 2,
    teeExtraStuds: 2,
    backToBackIncludesOpeningStuds: true,
    wastePct: 0.05,
    laborPctOfMaterial: 0.8,
  },

  floorsAndRoofs: {
    joistMaxSpanFt: 15,
    joistRateUsdPerSqft: 3,
    joistLaborPct: 0.8,
    trussTiers: [
      { maxSpanFt: 25, rateUsdPerSqft: 8 },
      { maxSpanFt: 32, rateUsdPerSqft: 10 },
      { maxSpanFt: null, rateUsdPerSqft: 12 },
    ],
    trussInstallLaborPct: 0,
    roofAreaIncludesOverhang: true,
  },

  // Starting values from Guyana research (Nov 2026, see docs/cost-research.md).
  // Many are US prices adjusted for import: confirm with local quotes.
  foundation: {
    slabMaterialUsdPerSqft: 6,
    slabLaborUsdPerSqft: 3.5,
    footingMaterialUsdPerLft: 15,
    footingLaborUsdPerLft: 8,
    raisedPiersMaterialUsdPerSqft: 3,
    raisedPiersLaborUsdPerSqft: 2,
  },

  finishes: {
    siding: [
      { id: 'cement-board', name: 'Fibre cement board', materialUsdPerSqft: 1.5, laborUsdPerSqft: 1.5, note: 'Cement sheets screwed to the studs. Does not rot, burn or feed termites.', defaultColor: '#e8e2d4' },
      { id: 'hardie-plank', name: 'Hardie plank (lap siding)', materialUsdPerSqft: 2.5, laborUsdPerSqft: 2.5, note: 'Fibre cement boards that overlap like timber siding.', defaultColor: '#f2efe6' },
      { id: 'plywood', name: 'Plywood', materialUsdPerSqft: 1.3, laborUsdPerSqft: 1, note: 'Low cost, but needs paint and upkeep in the tropics.', defaultColor: '#c9a37a' },
      { id: 'stucco', name: 'Plaster over cement board', materialUsdPerSqft: 2.2, laborUsdPerSqft: 2.5, note: 'Looks like a concrete house; cement board with a plaster finish.', defaultColor: '#efe9dc' },
      { id: 'vinyl', name: 'Vinyl siding', materialUsdPerSqft: 2.8, laborUsdPerSqft: 2, note: 'Colour goes all the way through, so it never needs painting.', defaultColor: '#dfe6ea' },
    ],
    roofing: [
      { id: 'zinc', name: 'Corrugated zinc / galvalume', materialUsdPerSqft: 2.2, laborUsdPerSqft: 1.5, note: 'The common Guyana roof. Light, fast, and sheds heavy rain.', defaultColor: '#9aa3a8' },
      { id: 'metal-panel', name: 'Painted metal panels', materialUsdPerSqft: 3, laborUsdPerSqft: 1.5, note: 'Coloured, ribbed steel panels; longer life than plain zinc.', defaultColor: '#8b2e2a' },
      { id: 'shingle', name: 'Asphalt shingles', materialUsdPerSqft: 3.5, laborUsdPerSqft: 2.5, note: 'Needs plywood decking under it.', defaultColor: '#4a4a4a' },
      { id: 'membrane', name: 'Flat roof membrane', materialUsdPerSqft: 3.5, laborUsdPerSqft: 2, note: 'Waterproof sheet for flat roofs.', defaultColor: '#bfbfbf' },
    ],
    trimColors: ['#ffffff', '#1f2a36', '#7a4b2a', '#2f5d3a', '#b33a2b'],
  },

  openings: {
    windowMaterialUsdPerSqft: 10,
    windowInstallUsdEach: 100,
    exteriorDoorMaterialUsdEach: 550,
    interiorDoorMaterialUsdEach: 140,
    doorInstallUsdEach: 90,
  },

  interior: {
    drywallMaterialUsdPerSqft: 0.45,
    drywallLaborUsdPerSqft: 1.5,
    paintMaterialUsdPerSqft: 0.6,
    paintLaborUsdPerSqft: 1,
    insulationMaterialUsdPerSqft: 1,
    insulationLaborUsdPerSqft: 0.6,
    flooringMaterialUsdPerSqft: 2.5,
    flooringLaborUsdPerSqft: 4,
  },

  allowances: {
    bathroomMaterialUsd: 1500,
    bathroomLaborUsd: 900,
    kitchenMaterialUsd: 6000,
    kitchenLaborUsd: 1500,
    electricalMaterialUsdPerSqft: 7,
    electricalLaborUsdPerSqft: 5,
    plumbingMaterialUsdPerSqft: 4.5,
    plumbingLaborUsdPerSqft: 3.5,
    waterStorageUsd: 9200,
    septicUsd: 8600,
  },

  education: {
    websiteUrl: 'https://guyanaframe.com',
    youtubeChannelUrl: 'https://www.youtube.com/@usframefactory',
    videos: [
      { youtubeId: '0Yz_icZ0JJY', title: 'Framing doors, headers, and windows with cold-formed steel', topic: 'openings' },
      { youtubeId: 'XjD6-wjCucw', title: 'Metal stud framing for beginners', topic: 'walls' },
      { youtubeId: 'DuTj8hyr2L0', title: 'How to read metal stud product codes', topic: 'parts' },
      { youtubeId: '4WTXTN-6T0I', title: 'How the steel stud roll-forming process works', topic: 'parts' },
      { youtubeId: 'DrEA-SoVCco', title: 'How to optimize construction with light-gauge steel framing', topic: 'general' },
      { youtubeId: 'P43EvTzg_sA', title: 'Why build with cold-formed steel', topic: 'general' },
    ],
  },
};
