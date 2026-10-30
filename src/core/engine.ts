import type { Building } from '../entities/Building';
import { isCrafterKind } from '../data/buildings';
import { MAX_STEPS_PER_FRAME, SIM_DT } from '../data/constants';
import { updateEnemies, rebuildEnemyIndex } from '../systems/enemyAI';
import { updateLogistics } from '../systems/logistics';
import { stepPollution } from '../systems/pollution';
import { updatePower } from '../systems/power';
import { updateCrafter, updateDrill } from '../systems/production';
import { updateLab } from '../systems/research';
import { updateProjectiles, updateTurret } from '../systems/combat';
import { updateLaunch, updateSilo } from '../systems/silo';
import { updateWaves } from '../systems/waves';
import type { World } from './World';

/** One building's production/science update (producers only; logistics & turrets run in their own passes). */
function updateProducer(world: World, b: Building, dt: number): void {
  if (b.drill) updateDrill(world, b, dt);
  else if (isCrafterKind(b.kind)) updateCrafter(world, b, dt);
  else if (b.lab) updateLab(world, b, dt);
  else if (b.silo) updateSilo(world, b, dt);
}

/**
 * Advances the whole simulation by one fixed step. Deterministic given the world state and `dt`.
 * This is the single source of truth for game logic and is driven both by the render loop and tests.
 *
 * Order matters: power is solved first (consumers read last step's demand and this step's supply),
 * producers then craft at their granted speed and push output, logistics move items, enemies advance,
 * and turrets fire at the enemies' new positions.
 */
export function stepWorld(world: World, dt: number = SIM_DT): void {
  if (world.state === 'playing') {
    updateWaves(world, dt);
    rebuildEnemyIndex(world);
    updateEnemies(world, dt);
    rebuildEnemyIndex(world);

    updatePower(world, dt);
    for (const b of world.buildings.values()) updateProducer(world, b, dt);
    updateLogistics(world, dt);

    for (const b of world.buildings.values()) if (b.turret) updateTurret(world, b, dt);
    updateProjectiles(world, dt);

    stepPollution(world.pollution, dt);
  }
  updateLaunch(world, dt);
  world.particles.update(dt);
  world.stats.update(dt);
  world.time += dt;
  world.tick++;
}

/** Runs `n` fixed steps. Returning the world is convenient for tests. */
export function runTicks(world: World, n: number, dt: number = SIM_DT): World {
  for (let i = 0; i < n; i++) stepWorld(world, dt);
  return world;
}

/** Runs enough fixed steps to cover `seconds` of simulated time. */
export function runSeconds(world: World, seconds: number, dt: number = SIM_DT): World {
  return runTicks(world, Math.round(seconds / dt), dt);
}

export { SIM_DT, MAX_STEPS_PER_FRAME };
