import type { Building } from '../entities/Building';
import { BUILDINGS, type BuildingKind } from '../data/buildings';
import { DRILL_OUTPUT_CAP, DUMP_INTERVAL, ELECTRIC_DRILL_TIME, MECH_DRILL_TIME } from '../data/constants';
import type { ItemId } from '../data/items';
import { RECIPES, type RecipeId } from '../data/recipes';
import { Ore, ORE_ITEM } from '../data/terrain';
import { oreAt } from '../core/grid';
import type { World } from '../core/World';
import { invAdd, invAddAll, invEntries, invHasAll, invRemoveAll } from './inventory';
import { crafterOutputFull, dumpCrafterOutput, dumpItem } from './logistics';
import { drillMultiplier, productionBoost } from './modifiers';
import { emitPollution } from './pollution';
import { isRecipeUnlocked } from './research';

export interface DrillOre {
  ore: ItemId | null;
  count: number;
}

/** Dominant minable ore under a drill footprint (mechanical drills cannot mine titanium). */
export function computeDrillOre(world: World, x: number, y: number, size: number, kind: BuildingKind): DrillOre {
  const counts = new Map<number, number>();
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const o = oreAt(world, x + dx, y + dy);
      if (o === Ore.None) continue;
      if (o === Ore.Titanium && kind === 'mech_drill') continue;
      counts.set(o, (counts.get(o) ?? 0) + 1);
    }
  }
  let best = 0;
  let bestCount = 0;
  for (const [o, n] of counts) {
    if (n > bestCount || (n === bestCount && o < best)) {
      best = o;
      bestCount = n;
    }
  }
  return { ore: ORE_ITEM[best] ?? null, count: bestCount };
}

/** Seconds per ore for a drill with `oreTiles` matching tiles, before power/research multipliers. */
export function drillTime(kind: BuildingKind, oreTiles: number, size: number): number {
  const base = kind === 'electric_drill' ? ELECTRIC_DRILL_TIME : MECH_DRILL_TIME;
  if (oreTiles <= 0) return Infinity;
  return base * ((size * size) / oreTiles);
}

export function updateDrill(world: World, b: Building, dt: number): void {
  const d = b.drill;
  if (!d) return;
  b.active = false;
  b.demand = 0;
  if (d.ore && d.oreTiles > 0 && d.output < DRILL_OUTPUT_CAP) {
    const electric = b.kind === 'electric_drill';
    let speed = productionBoost(world);
    if (electric) {
      b.demand = BUILDINGS[b.kind].power?.use ?? 0;
      speed *= b.satisfaction;
    }
    if (speed > 0) {
      b.active = true;
      const time = drillTime(b.kind, d.oreTiles, b.size) / (world.modifiers.drillSpeed * drillMultiplier(world));
      d.progress += (dt * speed) / time;
      while (d.progress >= 1 && d.output < DRILL_OUTPUT_CAP) {
        d.progress -= 1;
        d.output++;
        world.stats.record('produced', d.ore, 1);
      }
      if (d.output >= DRILL_OUTPUT_CAP) d.progress = Math.min(d.progress, 0.999);
      emitPollution(world.pollution, b.x, b.y, (BUILDINGS[b.kind].pollution ?? 0) * dt * speed);
      b.anim += dt * speed;
    }
  }
  if (d.ore && d.output > 0) {
    b.dumpTimer -= dt;
    if (b.dumpTimer <= 0) {
      b.dumpTimer = DUMP_INTERVAL;
      if (dumpItem(world, b, d.ore)) d.output--;
    }
  }
}

/** Crafter: consume inputs at the start of a cycle, emit outputs at the end, speed scaled by power. */
export function updateCrafter(world: World, b: Building, dt: number): void {
  const c = b.crafter;
  if (!c) return;
  b.active = false;
  b.demand = 0;
  const rec = c.recipe ? RECIPES[c.recipe] : null;
  if (rec) {
    // Only start (and consume ingredients) while the machine has power, so a dead grid never eats inputs.
    if (!c.crafting) {
      if (b.satisfaction > 0 && !crafterOutputFull(b, rec) && invHasAll(c.input, rec.inputs)) {
        invRemoveAll(c.input, rec.inputs);
        for (const s of rec.inputs) world.stats.record('consumed', s.item, s.amount);
        // Keep the overshoot of the previous craft so back-to-back crafts run at the exact recipe rate.
        c.crafting = true;
      } else {
        c.progress = 0;
      }
    }
    if (c.crafting) {
      b.demand = BUILDINGS[b.kind].power?.use ?? 0;
      if (b.satisfaction > 0) {
        const speed = b.satisfaction * productionBoost(world);
        b.active = true;
        c.progress += dt * speed;
        b.anim += dt * speed;
        emitPollution(world.pollution, b.x, b.y, (BUILDINGS[b.kind].pollution ?? 0) * dt * b.satisfaction);
        if (c.progress >= rec.time) {
          invAddAll(c.output, rec.outputs);
          for (const s of rec.outputs) world.stats.record('produced', s.item, s.amount);
          c.crafting = false;
          c.progress -= rec.time;
        }
      }
    }
  }
  dumpCrafterOutput(world, b, dt);
}

/**
 * Changes a crafter's recipe. Buffered ingredients the new recipe cannot use (and the inputs of an
 * interrupted craft) go back to the core so nothing is lost.
 */
export function setRecipe(world: World, b: Building, recipe: RecipeId | null): boolean {
  const c = b.crafter;
  if (!c) return false;
  if (recipe !== null) {
    const rec = RECIPES[recipe];
    if (rec.building !== b.kind || !isRecipeUnlocked(world, recipe)) return false;
  }
  if (c.recipe === recipe) return true;
  if (c.crafting && c.recipe) invAddAll(world.inventory, RECIPES[c.recipe].inputs);
  const keep = recipe ? RECIPES[recipe].inputs.map((s) => s.item) : [];
  for (const [item, n] of invEntries(c.input)) {
    if (!keep.includes(item)) {
      invAdd(world.inventory, item, n);
      invAdd(c.input, item, -n);
    }
  }
  c.recipe = recipe;
  c.crafting = false;
  c.progress = 0;
  if (recipe && (b.kind === 'furnace' || b.kind === 'assembler' || b.kind === 'chem_plant' || b.kind === 'adv_assembler')) {
    world.lastRecipe[b.kind] = recipe;
  }
  return true;
}
