// Garden rules and economy check. Run with `npm run garden-check` after changing GARDEN in src/config.ts.
import assert from 'node:assert/strict';
import { GARDEN } from '../src/config';
import { condition, isDead, isMature, needsWater, newPlant, nextPlotPrice, water } from '../src/garden/logic';

// ---- rules
for (const type of GARDEN.plants) {
  // Watered every day: blooms on exactly the growDays-th watering.
  const p = newPlant(type.id, 100);
  for (let d = 0; d < type.growDays; d++) {
    assert.equal(isMature(p), false);
    assert.equal(needsWater(p, 100 + d), true);
    assert.equal(water(p, 100 + d), true);
    assert.equal(water(p, 100 + d), false, 'only one watering per day counts');
  }
  assert.equal(isMature(p), true, `${type.name} should be mature`);

  // Never watered again: alive through dryLimit - 1 missed days, dead after dryLimit.
  const last = p.lastWatered;
  assert.equal(isDead(p, last + type.dryLimit), false, `${type.name} dies too early`);
  assert.equal(isDead(p, last + type.dryLimit + 1), true, `${type.name} should be dead`);
  assert.equal(condition(p, last + type.dryLimit + 1), 'Dead');
  assert.equal(water(p, last + type.dryLimit + 1), false, 'dead plants cannot be watered');

  // Kept plants last twice as long.
  const kept = { ...p, kept: true };
  assert.equal(isDead(kept, last + type.dryLimit * GARDEN.keptResilience), false);
  assert.equal(isDead(kept, last + type.dryLimit * GARDEN.keptResilience + 1), true);

  // A missed day costs no growth already made, and watering resets the dry counter.
  const q = newPlant(type.id, 200);
  water(q, 200);
  if (type.dryLimit > 1) {
    assert.equal(water(q, 202), true);
    assert.equal(condition(q, 202), 'Healthy');
  }
}
assert.equal(nextPlotPrice(GARDEN.startPlots), GARDEN.plotPrices[0]);
assert.equal(nextPlotPrice(GARDEN.startPlots + GARDEN.plotPrices.length), null);
console.log('Rules: all checks passed.\n');

// ---- plants
console.log('Plant            seed  days  dies after  sells  profit/day');
for (const t of GARDEN.plants) {
  const perDay = (t.sellPrice - t.seedPrice) / t.growDays;
  console.log(
    `${t.name.padEnd(15)} ${String(t.seedPrice).padStart(5)} ${String(t.growDays).padStart(5)} ${String(t.dryLimit).padStart(8)} dry ${String(t.sellPrice).padStart(6)} ${perDay.toFixed(1).padStart(8)}`,
  );
}

// ---- economy: a player who waters every day, sells everything, plants the most
// profitable seed they can afford and buys a plot whenever they can still afford seeds after.
let coins = GARDEN.startingCoins;
let plots: ({ type: (typeof GARDEN.plants)[number]; left: number } | null)[] = Array(GARDEN.startPlots).fill(null);
const profit = (t: (typeof GARDEN.plants)[number]) => (t.sellPrice - t.seedPrice) / t.growDays;
const byProfit = [...GARDEN.plants].sort((a, b) => profit(b) - profit(a));
const firsts = new Map<string, number>();

console.log('\nEconomy (waters daily, sells everything):');
for (let day = 1; day <= 30; day++) {
  plots = plots.map((p) => {
    if (!p) return null;
    p.left--;
    if (p.left > 0) return p;
    coins += p.type.sellPrice;
    return null;
  });
  for (;;) {
    const price = nextPlotPrice(plots.length);
    if (price === null || coins < price + 30) break;
    coins -= price;
    plots.push(null);
  }
  plots = plots.map((p) => {
    if (p) return p;
    const type = byProfit.find((t) => t.seedPrice <= coins)!;
    coins -= type.seedPrice;
    if (!firsts.has(type.name)) firsts.set(type.name, day);
    return { type, left: type.growDays };
  });
  if (day % 5 === 0) console.log(`  day ${String(day).padStart(2)}: ${plots.length} plots, ${coins} coins`);
}
console.log('\nFirst planted on day:', [...firsts].map(([n, d]) => `${n} ${d}`).join(', '));
