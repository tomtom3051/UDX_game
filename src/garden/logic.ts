// Garden rules. Pure functions of the plant and the current day, so nothing has to
// run in the background: a plant's state is worked out whenever the garden is opened.
import { GARDEN, type PlantType } from '../config';

export interface Plant {
  type: string;
  /** Number of days this plant has been watered, capped at the type's growDays. */
  growth: number;
  /** Day index of the last watering. A fresh seed counts as watered the day before planting. */
  lastWatered: number;
  /** Fully grown plants the player chose to keep as decoration. */
  kept: boolean;
}

export type Condition = 'Healthy' | 'Thirsty' | 'Wilting' | 'Withered' | 'Dead';

export function plantType(id: string): PlantType {
  return GARDEN.plants.find((p) => p.id === id) ?? GARDEN.plants[0];
}

export function newPlant(type: string, today: number): Plant {
  return { type, growth: 0, lastWatered: today - 1, kept: false };
}

/** Full days that passed without water. Today does not count until it is over. */
export function dryDays(plant: Plant, today: number): number {
  return Math.max(0, today - plant.lastWatered - 1);
}

export function dryLimit(plant: Plant): number {
  return plantType(plant.type).dryLimit * (plant.kept ? GARDEN.keptResilience : 1);
}

export function isDead(plant: Plant, today: number): boolean {
  return dryDays(plant, today) >= dryLimit(plant);
}

export function isMature(plant: Plant): boolean {
  return plant.growth >= plantType(plant.type).growDays;
}

export function needsWater(plant: Plant, today: number): boolean {
  return !isDead(plant, today) && plant.lastWatered < today;
}

/** 0 is perfectly healthy, 1 is dead. Drives the wilting look. */
export function decay(plant: Plant, today: number): number {
  return Math.min(1, dryDays(plant, today) / dryLimit(plant));
}

export function condition(plant: Plant, today: number): Condition {
  const d = decay(plant, today);
  if (d >= 1) return 'Dead';
  if (d === 0) return 'Healthy';
  if (d < 0.5) return 'Thirsty';
  if (d < 0.8) return 'Wilting';
  return 'Withered';
}

/** Waters the plant for today. A watered day is one day of growth. Returns false if nothing happened. */
export function water(plant: Plant, today: number): boolean {
  if (!needsWater(plant, today)) return false;
  plant.lastWatered = today;
  if (!isMature(plant)) plant.growth++;
  return true;
}

/** Price of the next plot, or null when the garden is at its maximum size. */
export function nextPlotPrice(ownedPlots: number): number | null {
  return GARDEN.plotPrices[ownedPlots - GARDEN.startPlots] ?? null;
}
