import type { Building } from '../entities/Building';
import { BUILDINGS, STARTING_BUILDINGS, type BuildingKind } from '../data/buildings';
import { LAB_ITEM_CAP, LAB_TIME_PER_ITEM } from '../data/constants';
import type { ItemId } from '../data/items';
import type { RecipeId } from '../data/recipes';
import { RESEARCH, RESEARCH_BY_ID, type ResearchDef } from '../data/research';
import { playSound, pushEvent, toast } from '../core/grid';
import type { World } from '../core/World';
import { buildingName, msg, recipeName, researchName } from '../utils/i18n';
import { invAdd, invGet, type Inventory } from './inventory';
import { productionBoost } from './modifiers';

export interface ResearchState {
  completed: Set<string>;
  current: string | null;
  /** Items delivered so far, per research node (kept when switching). */
  progress: Record<string, Inventory>;
}

export function createResearchState(): ResearchState {
  return { completed: new Set(), current: null, progress: {} };
}

const STARTING_RECIPES: readonly RecipeId[] = ['iron_plate', 'copper_plate', 'brick', 'gear', 'copper_wire', 'basic_ammo'];

export function isBuildingUnlocked(world: World, kind: BuildingKind): boolean {
  if (!BUILDINGS[kind].buildable) return false;
  if (STARTING_BUILDINGS.includes(kind)) return true;
  for (const id of world.research.completed) {
    if (RESEARCH_BY_ID.get(id)?.buildings.includes(kind)) return true;
  }
  return false;
}

export function isRecipeUnlocked(world: World, recipe: RecipeId): boolean {
  if (STARTING_RECIPES.includes(recipe)) return true;
  for (const id of world.research.completed) {
    if (RESEARCH_BY_ID.get(id)?.recipes.includes(recipe)) return true;
  }
  return false;
}

/** Which research node unlocks a recipe/building (for UI hints). */
export function unlockSource(target: { recipe?: RecipeId; building?: BuildingKind }): ResearchDef | undefined {
  return RESEARCH.find(
    (n) =>
      (target.recipe !== undefined && n.recipes.includes(target.recipe)) ||
      (target.building !== undefined && n.buildings.includes(target.building)),
  );
}

export type NodeStatus = 'completed' | 'current' | 'available' | 'locked';

export function nodeStatus(world: World, id: string): NodeStatus {
  const r = world.research;
  if (r.completed.has(id)) return 'completed';
  if (r.current === id) return 'current';
  const def = RESEARCH_BY_ID.get(id);
  if (!def) return 'locked';
  return def.prereqs.every((p) => r.completed.has(p)) ? 'available' : 'locked';
}

export function canResearch(world: World, id: string): boolean {
  const s = nodeStatus(world, id);
  return s === 'available' || s === 'current';
}

export function setCurrentResearch(world: World, id: string | null): boolean {
  if (id === null) {
    world.research.current = null;
    return true;
  }
  if (!canResearch(world, id)) return false;
  world.research.current = id;
  return true;
}

/** Items of `item` still missing for the current research, counting items already waiting inside labs. */
export function researchRemaining(world: World, item: ItemId): number {
  const r = world.research;
  if (!r.current) return 0;
  const def = RESEARCH_BY_ID.get(r.current);
  if (!def) return 0;
  const cost = def.cost.find((c) => c.item === item);
  if (!cost) return 0;
  const delivered = invGet(r.progress[r.current] ?? {}, item);
  let buffered = 0;
  for (const b of world.buildings.values()) if (b.lab) buffered += invGet(b.lab.items, item);
  return Math.max(0, cost.amount - delivered - buffered);
}

export function labAccepts(world: World, b: Building, item: ItemId): boolean {
  if (!b.lab) return false;
  if (invGet(b.lab.items, item) >= LAB_ITEM_CAP) return false;
  return researchRemaining(world, item) > 0;
}

/** Progress of a node in 0..1. */
export function researchFraction(world: World, id: string): number {
  const def = RESEARCH_BY_ID.get(id);
  if (!def) return 0;
  if (world.research.completed.has(id)) return 1;
  const prog = world.research.progress[id] ?? {};
  let have = 0;
  let need = 0;
  for (const c of def.cost) {
    have += Math.min(c.amount, invGet(prog, c.item));
    need += c.amount;
  }
  return need > 0 ? have / need : 1;
}

export function recomputeModifiers(world: World): void {
  const m = world.modifiers;
  m.drillSpeed = 1;
  m.ammoDamage = 1;
  m.laserDamage = 1;
  m.buildingHp = 1;
  m.generatorOutput = 1;
  for (const id of world.research.completed) {
    for (const e of RESEARCH_BY_ID.get(id)?.effects ?? []) m[e.key] += e.value;
  }
}

export function completeResearch(world: World, id: string): void {
  const def = RESEARCH_BY_ID.get(id);
  if (!def || world.research.completed.has(id)) return;
  world.research.completed.add(id);
  delete world.research.progress[id];
  if (world.research.current === id) world.research.current = null;
  const oldHp = world.modifiers.buildingHp;
  recomputeModifiers(world);
  if (world.modifiers.buildingHp !== oldHp) {
    const ratio = world.modifiers.buildingHp / oldHp;
    for (const b of world.buildings.values()) {
      b.maxHp = Math.round(b.maxHp * ratio);
      b.hp = Math.min(b.maxHp, Math.round(b.hp * ratio));
    }
  }
  const unlocked = [...def.buildings.map(buildingName), ...def.recipes.map(recipeName)];
  toast(world, msg().toast.researchDone(researchName(def.id), unlocked.join(', ')), 'success');
  pushEvent(world, { type: 'researchComplete', id });
  playSound(world, 'research', world.width / 2, world.height / 2);
}

function checkCompletion(world: World, id: string): void {
  const def = RESEARCH_BY_ID.get(id);
  if (!def) return;
  const prog = world.research.progress[id] ?? {};
  if (def.cost.every((c) => invGet(prog, c.item) >= c.amount)) completeResearch(world, id);
}

/** Labs turn buffered items into research progress at LAB_TIME_PER_ITEM each (scaled by power). */
export function updateLab(world: World, b: Building, dt: number): void {
  const lab = b.lab;
  if (!lab) return;
  const r = world.research;
  const current = r.current;
  const def = current ? RESEARCH_BY_ID.get(current) : undefined;
  b.active = false;
  b.demand = 0;
  if (!current || !def) {
    lab.progress = 0;
    return;
  }
  const prog = (r.progress[current] ??= {});
  const needed = def.cost.find((c) => invGet(lab.items, c.item) > 0 && invGet(prog, c.item) < c.amount);
  if (!needed) {
    lab.progress = 0;
    return;
  }
  b.demand = BUILDINGS.lab.power?.use ?? 0;
  if (b.satisfaction <= 0) return;
  b.active = true;
  lab.progress += (dt * b.satisfaction * productionBoost(world)) / LAB_TIME_PER_ITEM;
  if (lab.progress >= 1) {
    lab.progress -= 1;
    invAdd(lab.items, needed.item, -1);
    invAdd(prog, needed.item, 1);
    world.stats.record('consumed', needed.item, 1);
    checkCompletion(world, current);
  }
}
