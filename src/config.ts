// All tuning values live here. After changing map sizes, time limits or
// upgrade values, rerun `npm run balance` to check the progression still holds.

export const APP = {
  title: 'Pocket Jobs',
  tagline: 'Quick minigames. Small jobs, big rewards.',
};

// ---------------------------------------------------------------- Hub

export interface Minigame {
  id: string;
  name: string;
  description: string;
  icon: string;
  colour: string;
  playable: boolean;
  /** Page a playable minigame opens. */
  route?: string;
}

export const MINIGAMES: Minigame[] = [
  { id: 'lawn', name: 'Lawn Mower', description: 'Mow the garden against the clock. Mind the flowers!', icon: '🌱', colour: '#c9efb0', playable: true, route: '/lawn' },
  { id: 'pottery', name: 'Pottery Wheel', description: 'Shape and paint your own ceramics. No timer, no pressure.', icon: '🏺', colour: '#f6d9c2', playable: true, route: '/pottery' },
  { id: 'garden', name: 'Garden Planner', description: 'Plant seeds, water them every day and watch them grow.', icon: '🥕', colour: '#ffe0b8', playable: true, route: '/garden' },
  { id: 'recycling', name: 'Recycling Sort', description: 'Sort the rubbish into the right bins.', icon: '♻️', colour: '#bfe6f5', playable: false },
  { id: 'delivery', name: 'Delivery Run', description: 'Drop off parcels before they are late.', icon: '📦', colour: '#f5d9c4', playable: false },
  { id: 'windows', name: 'Window Washer', description: 'Leave every pane streak free.', icon: '🪟', colour: '#e6d4f7', playable: false },
  { id: 'fishing', name: 'Fishing Trip', description: 'Catch dinner at the quiet lake.', icon: '🎣', colour: '#cfdcff', playable: false },
];

// ---------------------------------------------------------------- Lawn Mower

/** Size of one grass cell in px. Map sizes should be multiples of this. */
export const CELL = 8;

export const STARTING_MONEY = 0;

/** Minimum coverage (%) to pass a job and to unlock the "Finish job" button. */
export const PASS_COVERAGE = 80;

/** Score points lost per destroyed flower bed. */
export const BED_PENALTY = 5;

/** Maximum score bonus for finishing early (scaled by the fraction of time left). */
export const MAX_TIME_BONUS = 5;

/** Break between jobs. */
export const COOLDOWN_MS = 15 * 60 * 1000;

/** Presenter tool: money added by the "Add money" button / M key. */
export const PRESENTER_MONEY = 1000;

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/** Minimum score for each grade, best first. Anything lower is an F. */
export const GRADE_THRESHOLDS: [Grade, number][] = [
  ['A', 95],
  ['B', 88],
  ['C', 80],
  ['D', 70],
];

/** Payout = base payout x multiplier. */
export const GRADE_MULTIPLIER: Record<Grade, number> = { A: 1, B: 0.8, C: 0.6, D: 0.4, F: 0 };

/** Grades that count as passing a map (unlocks the next one). */
export const PASSING_GRADES: Grade[] = ['A', 'B', 'C', 'D'];

// Upgrades. Index 0 is the base level, 1 to 3 are the buyable tiers.
export const SPEED_TIERS = [120, 150, 185, 225]; // px per second
export const WIDTH_TIERS = [40, 55, 70, 90]; // cutting width in px
export const TIER_PRICES = [0, 150, 350, 700]; // price of each tier, same for both upgrades

// Maps. Obstacles are rectangles (x, y = top left) or circles (x, y = centre).
export type Obstacle =
  | { type: 'pool' | 'bed' | 'house' | 'shed' | 'fence'; x: number; y: number; w: number; h: number }
  | { type: 'tree'; x: number; y: number; r: number };

export interface MapDef {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  width: number;
  height: number;
  timeLimit: number; // seconds
  basePayout: number;
  recommended: string;
  /** Map that must be passed first. */
  requires?: string;
  start: { x: number; y: number };
  obstacles: Obstacle[];
}

export const MAPS: MapDef[] = [
  {
    id: 'small',
    name: 'Small garden',
    icon: '🏡',
    blurb: 'A tidy back garden with a paddling pool.',
    width: 480,
    height: 704,
    timeLimit: 120,
    basePayout: 100,
    recommended: 'Base gear',
    start: { x: 64, y: 656 },
    obstacles: [
      { type: 'pool', x: 312, y: 72, w: 120, h: 88 },
      { type: 'tree', x: 112, y: 200, r: 28 },
      { type: 'bed', x: 120, y: 440, w: 72, h: 40 },
      { type: 'bed', x: 296, y: 320, w: 72, h: 40 },
      { type: 'bed', x: 216, y: 584, w: 80, h: 40 },
    ],
  },
  {
    id: 'medium',
    name: 'Family lawn',
    icon: '🏠',
    blurb: 'More beds, more trees and a shed in the way.',
    width: 640,
    height: 904,
    timeLimit: 150,
    basePayout: 250,
    recommended: 'Speed 1 or Width 1',
    requires: 'small',
    start: { x: 320, y: 856 },
    obstacles: [
      { type: 'house', x: 200, y: 0, w: 240, h: 120 },
      { type: 'fence', x: 312, y: 120, w: 8, h: 88 },
      { type: 'pool', x: 48, y: 200, w: 136, h: 104 },
      { type: 'shed', x: 520, y: 560, w: 88, h: 80 },
      { type: 'tree', x: 500, y: 220, r: 30 },
      { type: 'tree', x: 120, y: 520, r: 30 },
      { type: 'tree', x: 350, y: 700, r: 26 },
      { type: 'bed', x: 280, y: 328, w: 80, h: 40 },
      { type: 'bed', x: 456, y: 392, w: 40, h: 80 },
      { type: 'bed', x: 64, y: 704, w: 80, h: 40 },
      { type: 'bed', x: 240, y: 520, w: 80, h: 40 },
      { type: 'bed', x: 480, y: 776, w: 80, h: 40 },
    ],
  },
  {
    id: 'large',
    name: 'Grand estate',
    icon: '🏰',
    blurb: 'A huge estate. Bring serious equipment.',
    width: 904,
    height: 1304,
    timeLimit: 180,
    basePayout: 500,
    recommended: 'Speed 2 and Width 2',
    requires: 'medium',
    start: { x: 456, y: 1256 },
    obstacles: [
      { type: 'house', x: 296, y: 0, w: 312, h: 160 },
      { type: 'pool', x: 560, y: 520, w: 216, h: 152 },
      { type: 'fence', x: 776, y: 520, w: 8, h: 152 },
      { type: 'shed', x: 64, y: 1040, w: 104, h: 88 },
      { type: 'tree', x: 140, y: 260, r: 34 },
      { type: 'tree', x: 760, y: 240, r: 32 },
      { type: 'tree', x: 120, y: 540, r: 28 },
      { type: 'tree', x: 240, y: 720, r: 34 },
      { type: 'tree', x: 680, y: 960, r: 34 },
      { type: 'tree', x: 560, y: 1090, r: 30 },
      { type: 'bed', x: 384, y: 240, w: 96, h: 40 },
      { type: 'bed', x: 624, y: 360, w: 96, h: 40 },
      { type: 'bed', x: 360, y: 520, w: 40, h: 96 },
      { type: 'bed', x: 80, y: 824, w: 96, h: 40 },
      { type: 'bed', x: 504, y: 856, w: 96, h: 40 },
      { type: 'bed', x: 792, y: 776, w: 40, h: 96 },
      { type: 'bed', x: 296, y: 984, w: 40, h: 96 },
      { type: 'bed', x: 232, y: 1216, w: 96, h: 40 },
      { type: 'bed', x: 608, y: 1176, w: 96, h: 40 },
    ],
  },
];

export function getMap(id: string): MapDef | undefined {
  return MAPS.find((m) => m.id === id);
}

// ---------------------------------------------------------------- Pottery Wheel

export const POTTERY = {
  /** Number of height slices a pot is made of. */
  rows: 48,
  minRadius: 14,
  maxRadius: 125,
  minHeight: 90,
  maxHeight: 330,
  startRadius: 62,
  startHeight: 170,
  /** How many neighbouring rows follow the finger while shaping. */
  shapeSpread: 4,
  /** Wheel speed in radians per second. */
  spinSpeed: 5,
  /** Colour of unpainted clay. */
  clay: '#c98b62',
  glazes: [
    { name: 'Cream', colour: '#f3e6cf' },
    { name: 'Honey', colour: '#e8b84a' },
    { name: 'Coral', colour: '#e2725b' },
    { name: 'Plum', colour: '#7d4f7a' },
    { name: 'Sky', colour: '#7fb7d9' },
    { name: 'Ocean', colour: '#2f6f9f' },
    { name: 'Sage', colour: '#8fb58a' },
    { name: 'Forest', colour: '#3d7a55' },
    { name: 'Charcoal', colour: '#3b3b40' },
  ],
  /** Brush sizes in rows painted above and below the finger. */
  brushes: [
    { name: 'Fine', rows: 0 },
    { name: 'Medium', rows: 2 },
    { name: 'Wide', rows: 5 },
  ],
  /** Oldest pieces drop off the shelf beyond this number. */
  shelfLimit: 24,
};

// ---------------------------------------------------------------- Garden Planner

export interface PlantType {
  id: string;
  name: string;
  blurb: string;
  /** 0 means the seed is free. */
  seedPrice: number;
  /** Watered days needed to reach full bloom. */
  growDays: number;
  /** Days in a row without water after which the plant dies. */
  dryLimit: number;
  sellPrice: number;
}

export const GARDEN = {
  startingCoins: 0,
  startPlots: 4,
  /** Price of each extra plot, in order. Start plots plus these gives the maximum (12). */
  plotPrices: [40, 70, 100, 140, 180, 230, 290, 360],
  /** Kept plants survive this many times longer without water. */
  keptResilience: 2,
  /** Presenter tool: coins added by the "Add coins" button / M key. */
  presenterCoins: 500,
  plants: [
    { id: 'daisy', name: 'Daisy', blurb: 'Cheerful and easy. Seeds are always free.', seedPrice: 0, growDays: 3, dryLimit: 4, sellPrice: 15 },
    { id: 'tulip', name: 'Tulip', blurb: 'A reliable spring classic.', seedPrice: 30, growDays: 4, dryLimit: 4, sellPrice: 60 },
    { id: 'sunflower', name: 'Sunflower', blurb: 'Grows tall, gets thirsty fast.', seedPrice: 60, growDays: 6, dryLimit: 3, sellPrice: 140 },
    { id: 'cactus', name: 'Cactus', blurb: 'Slow, but shrugs off a dry week.', seedPrice: 80, growDays: 9, dryLimit: 8, sellPrice: 220 },
    { id: 'rose', name: 'Rose', blurb: 'Valuable and delicate. Do not skip a day.', seedPrice: 150, growDays: 7, dryLimit: 2, sellPrice: 350 },
  ] as PlantType[],
};
