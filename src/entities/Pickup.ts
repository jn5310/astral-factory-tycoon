import type { ItemStack } from '../data/items';

/** A supply pod dropped from orbit. The player taps it to move its cargo into the core. */
export interface Pickup {
  id: number;
  /** Center in tile units. */
  x: number;
  y: number;
  loot: ItemStack[];
  /** Seconds until it touches down (> 0 while falling). */
  fall: number;
  /** Seconds left before it burns up. */
  life: number;
  landed: boolean;
}
