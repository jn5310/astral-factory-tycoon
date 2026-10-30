import { DAY_LENGTH, NIGHT_START } from '../data/constants';
import { smoothstep } from '../utils/math';

const DAWN_END = 0.06;
const DUSK_START = 0.55;

/** Sun strength 0..1 for a cycle phase in [0, 1). Night (0) runs from NIGHT_START to the end of the cycle. */
export function daylightAt(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  if (p < DAWN_END) return smoothstep(0, DAWN_END, p);
  if (p < DUSK_START) return 1;
  if (p < NIGHT_START) return 1 - smoothstep(DUSK_START, NIGHT_START, p);
  return 0;
}

export function isNightPhase(phase: number): boolean {
  const p = ((phase % 1) + 1) % 1;
  return p >= NIGHT_START;
}

/** Seconds until the next night starts (0 while it is night). */
export function secondsUntilNight(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  if (p >= NIGHT_START) return 0;
  return (NIGHT_START - p) * DAY_LENGTH;
}

/** Seconds until the next dawn. */
export function secondsUntilDawn(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  return (1 - p) * DAY_LENGTH;
}
