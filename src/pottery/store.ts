import { POTTERY } from '../config';
import type { Pot } from './pot';

const KEY = 'pocket-jobs-pottery-v1';

export type Step = 'shape' | 'paint';

interface PotterySave {
  /** Piece on the wheel right now, so leaving never loses progress. */
  current: { pot: Pot; step: Step } | null;
  shelf: Pot[];
}

function load(): PotterySave {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { current: null, shelf: [], ...JSON.parse(raw) };
  } catch {
    // Corrupt or unavailable storage: start with an empty studio.
  }
  return { current: null, shelf: [] };
}

export const studio: PotterySave = load();

export function persistStudio(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(studio));
  } catch {
    // The demo still works without storage.
  }
}

export function putOnShelf(pot: Pot): void {
  studio.shelf.unshift(pot);
  studio.shelf.length = Math.min(studio.shelf.length, POTTERY.shelfLimit);
  studio.current = null;
  persistStudio();
}

export function removeFromShelf(id: string): void {
  studio.shelf = studio.shelf.filter((p) => p.id !== id);
  persistStudio();
}
