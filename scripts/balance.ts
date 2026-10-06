// Balance check. Run with `npm run balance` after changing src/config.ts.
//
// Rough model: the most area a player can mow in one job is
//   speed x width x timeLimit x EFFICIENCY
// where EFFICIENCY (about 0.6) accounts for turning, overlap and dodging.
// That is compared with the area needed for the pass threshold on each map.

import {
  CELL,
  GRADE_MULTIPLIER,
  MAPS,
  PASS_COVERAGE,
  SPEED_TIERS,
  TIER_PRICES,
  WIDTH_TIERS,
} from '../src/config';
import { buildGrid } from '../src/game/grid';

const EFFICIENCY = 0.6;
/** Capacity / need ratio from which a job feels comfortable rather than tight. */
const COMFORTABLE = 1.15;

const gear: [string, number, number][] = [
  ['Base', 0, 0],
  ['Speed 1', 1, 0],
  ['Width 1', 0, 1],
  ['Tier 1 both', 1, 1],
  ['Speed 2, Width 1', 2, 1],
  ['Tier 2 both', 2, 2],
  ['Tier 3 both', 3, 3],
];

function capacity(map: (typeof MAPS)[number], s: number, w: number): number {
  return SPEED_TIERS[s] * WIDTH_TIERS[w] * map.timeLimit * EFFICIENCY;
}

function need(map: (typeof MAPS)[number]): number {
  return buildGrid(map).mowable * CELL * CELL * (PASS_COVERAGE / 100);
}

function verdict(ratio: number): string {
  if (ratio < 0.9) return 'impossible';
  if (ratio < 1) return 'only just (very good play)';
  if (ratio < COMFORTABLE) return 'tight';
  return 'comfortable';
}

console.log(`Efficiency factor ${EFFICIENCY}, pass threshold ${PASS_COVERAGE}%\n`);

for (const map of MAPS) {
  const grid = buildGrid(map);
  const mowableArea = grid.mowable * CELL * CELL;
  console.log(
    `${map.name}: ${map.width} x ${map.height} px, ${map.timeLimit} s, ` +
      `mowable ${Math.round(mowableArea / 1000)}k px² ` +
      `(${Math.round((mowableArea / (map.width * map.height)) * 100)}% of map), ` +
      `need ${Math.round(need(map) / 1000)}k px²`,
  );
  for (const [label, s, w] of gear) {
    const ratio = capacity(map, s, w) / need(map);
    console.log(`  ${label.padEnd(18)} ${ratio.toFixed(2)}x  ${verdict(ratio)}`);
  }
  console.log('');
}

// Economy: how many jobs until tier 2 in both upgrades (what Large needs),
// alternating B and C grades and always playing the best comfortable map.
const tiers = { speed: 0, width: 0 };
let money = 0;
let jobs = 0;
const passed = new Set<string>();
const log: string[] = [];

while ((tiers.speed < 2 || tiers.width < 2) && jobs < 50) {
  const playable = MAPS.filter(
    (m) =>
      (!m.requires || passed.has(m.requires)) &&
      capacity(m, tiers.speed, tiers.width) / need(m) >= COMFORTABLE,
  );
  const map = playable[playable.length - 1] ?? MAPS[0];
  const grade = jobs % 2 === 0 ? 'B' : 'C';
  const pay = Math.round(map.basePayout * GRADE_MULTIPLIER[grade]);
  money += pay;
  jobs++;
  passed.add(map.id);
  let bought = '';
  for (;;) {
    const key = tiers.speed <= tiers.width ? 'speed' : 'width';
    const price = TIER_PRICES[tiers[key] + 1];
    if (tiers[key] >= 2 || money < price) break;
    money -= price;
    tiers[key]++;
    bought += ` -> buy ${key} ${tiers[key]}`;
  }
  log.push(`  job ${jobs}: ${map.name} grade ${grade} +${pay}${bought} (money ${money})`);
}

console.log('Economy (alternating B and C grades):');
console.log(log.join('\n'));
console.log(`\nTier 2 in both upgrades reached after ${jobs} jobs (target: about 5 to 8).`);
