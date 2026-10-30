import { MUTATORS, type Mutator } from '../data/difficulty';

/** UTC calendar day as YYYY-MM-DD, so every player shares the same daily challenge. */
export function dailyKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** FNV-1a hash of the key, folded to a positive 31-bit seed. */
export function dailySeed(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 2147483647;
}

/** Every daily challenge has a twist (never 'none'). */
export function dailyMutator(key: string): Mutator {
  const twists = MUTATORS.filter((m) => m !== 'none');
  return twists[dailySeed(`${key}:twist`) % twists.length] ?? 'swarm';
}
