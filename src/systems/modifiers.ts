import { OVERCLOCK_SPEED } from '../data/abilities';
import { DIFFICULTY, MUTATOR } from '../data/difficulty';
import {
  BLOOD_MOON_SALVAGE_MUL,
  BLOOD_MOON_WAVE_MUL,
  DUST_STORM_SOLAR_MUL,
  ORE_SURGE_MUL,
  SOLAR_FLARE_MUL,
} from '../data/worldEvents';
import type { World } from '../core/World';

/** Temporary and run-wide multipliers from difficulty, daily twists, random events and abilities. */

export function solarMultiplier(world: World): number {
  const effect = world.director.effect?.id;
  const event = effect === 'solarFlare' ? SOLAR_FLARE_MUL : effect === 'dustStorm' ? DUST_STORM_SOLAR_MUL : 1;
  return MUTATOR[world.settings.mutator].solarMul * event;
}

export function drillMultiplier(world: World): number {
  const event = world.director.effect?.id === 'oreSurge' ? ORE_SURGE_MUL : 1;
  return MUTATOR[world.settings.mutator].drillMul * event;
}

/** Speed multiplier for drills, crafters, labs and the silo while Overclock runs. */
export function productionBoost(world: World): number {
  return world.abilities.overclock > 0 ? OVERCLOCK_SPEED : 1;
}

export function salvageMultiplier(world: World): number {
  return MUTATOR[world.settings.mutator].salvageMul * (world.director.bloodMoon ? BLOOD_MOON_SALVAGE_MUL : 1);
}

export function waveMultiplier(world: World): number {
  const d = DIFFICULTY[world.settings.difficulty];
  return d.waveMul * MUTATOR[world.settings.mutator].waveMul * (world.director.bloodMoon ? BLOOD_MOON_WAVE_MUL : 1);
}

export function attacksEnabled(world: World): boolean {
  return DIFFICULTY[world.settings.difficulty].attacks;
}
