import type { Building, BuildingConfig } from '../entities/Building';
import { createBuilding } from '../entities/Building';
import { BUILDINGS, type BuildingKind, isConveyorKind, isCrafterKind } from '../data/buildings';
import type { ItemId } from '../data/items';
import { Terrain } from '../data/terrain';
import { buildingAt, inBounds, markMapChanged, playSound, pushEvent } from '../core/grid';
import type { Dir, TileXY } from '../core/types';
import type { World } from '../core/World';
import { invAdd, invAddAll, invHasAll } from './inventory';
import { autoTunnelMode } from './logistics';
import { computeDrillOre } from './production';
import { msg } from '../utils/i18n';
import { isBuildingUnlocked } from './research';

export interface PlacementCheck {
  ok: boolean;
  reason?: string;
}

/** Writes the building's id into every occupancy tile it covers. Assumes the area is free. */
export function insertBuilding(world: World, b: Building): void {
  world.buildings.set(b.id, b);
  for (let dy = 0; dy < b.size; dy++) {
    for (let dx = 0; dx < b.size; dx++) {
      const x = b.x + dx;
      const y = b.y + dy;
      if (inBounds(world, x, y)) world.occupancy[y * world.width + x] = b.id;
    }
  }
}

function clearOccupancy(world: World, b: Building): void {
  for (let dy = 0; dy < b.size; dy++) {
    for (let dx = 0; dx < b.size; dx++) {
      const x = b.x + dx;
      const y = b.y + dy;
      const idx = y * world.width + x;
      if (inBounds(world, x, y) && world.occupancy[idx] === b.id) world.occupancy[idx] = 0;
    }
  }
}

/** Water is unbuildable (bridges jump over it). Rock is buildable but impassable for ground enemies. */
export function terrainBuildable(world: World, x: number, y: number): boolean {
  return world.terrain[y * world.width + x] !== Terrain.Water;
}

export function countKind(world: World, kind: BuildingKind): number {
  let n = 0;
  for (const b of world.buildings.values()) if (b.kind === kind) n++;
  return n;
}

/** Full placement validation: bounds, terrain, overlap, research, unique-building caps. */
export function canPlace(world: World, kind: BuildingKind, x: number, y: number): PlacementCheck {
  const def = BUILDINGS[kind];
  if (!def.buildable) return { ok: false, reason: msg().reasons.notBuildable };
  if (!isBuildingUnlocked(world, kind)) return { ok: false, reason: msg().reasons.needResearch };
  if (def.maxCount !== undefined && countKind(world, kind) >= def.maxCount) {
    return { ok: false, reason: msg().reasons.unique };
  }
  for (let dy = 0; dy < def.size; dy++) {
    for (let dx = 0; dx < def.size; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (!inBounds(world, tx, ty)) return { ok: false, reason: msg().reasons.outOfBounds };
      if (world.occupancy[ty * world.width + tx] !== 0) return { ok: false, reason: msg().reasons.overlap };
      if (!terrainBuildable(world, tx, ty)) return { ok: false, reason: msg().reasons.water };
    }
  }
  if (kind === 'mech_drill' || kind === 'electric_drill') {
    if (computeDrillOre(world, x, y, def.size, kind).count === 0) {
      return { ok: false, reason: kind === 'mech_drill' ? msg().reasons.needOreMech : msg().reasons.needOre };
    }
  }
  return { ok: true };
}

export function hasResources(world: World, kind: BuildingKind): boolean {
  return invHasAll(world.inventory, BUILDINGS[kind].cost);
}

export interface PlaceResult {
  ok: boolean;
  building?: Building;
  reason?: string;
}

/**
 * Validates, pays the cost, and places a building.
 * `free` skips the cost (blueprint preview already paid, or sandbox).
 */
export function placeBuilding(
  world: World,
  kind: BuildingKind,
  x: number,
  y: number,
  rot: Dir,
  opts: { free?: boolean; silent?: boolean; config?: BuildingConfig } = {},
): PlaceResult {
  const check = canPlace(world, kind, x, y);
  if (!check.ok) return { ok: false, reason: check.reason };
  const free = opts.free === true || world.settings.mode === 'sandbox';
  if (!free && !hasResources(world, kind)) return { ok: false, reason: msg().reasons.lacking };
  if (!free) {
    for (const s of BUILDINGS[kind].cost) invAdd(world.inventory, s.item, -s.amount);
  }
  const config: BuildingConfig = { ...opts.config };
  if (kind === 'tunnel' && config.tunnelMode === undefined) config.tunnelMode = autoTunnelMode(world, x, y, rot);
  if (isCrafterKind(kind) && config.recipe === undefined && world.lastRecipe[kind]) config.recipe = world.lastRecipe[kind];
  const b = createBuilding(world.nextId++, kind, x, y, rot, world.modifiers.buildingHp, config);
  assignDrillOre(world, b);
  insertBuilding(world, b);
  markMapChanged(world);
  if (!opts.silent) {
    playSound(world, 'place', x + b.size / 2, y + b.size / 2);
    pushEvent(world, { type: 'built', kind, x, y });
  }
  return { ok: true, building: b };
}

/** Drills cache the dominant ore under their footprint (ores never deplete). */
export function assignDrillOre(world: World, b: Building): void {
  if (!b.drill) return;
  const o = computeDrillOre(world, b.x, b.y, b.size, b.kind);
  b.drill.ore = o.ore;
  b.drill.oreTiles = o.count;
}

/** Drag-building over an existing belt of the same kind re-aims it (free) instead of failing. */
export function placeOrReaim(world: World, kind: BuildingKind, x: number, y: number, rot: Dir): PlaceResult {
  const existing = buildingAt(world, x, y);
  if (existing && existing.kind === kind && isConveyorKind(kind)) {
    if (existing.rot !== rot) {
      existing.rot = rot;
      markMapChanged(world);
    }
    return { ok: true, building: existing };
  }
  return placeBuilding(world, kind, x, y, rot);
}

/** Refund fraction when demolishing (half, rounded down). */
export const REFUND_RATIO = 0.5;

export function refundFor(kind: BuildingKind): { item: ItemId; amount: number }[] {
  return BUILDINGS[kind].cost
    .map((s) => ({ item: s.item, amount: Math.floor(s.amount * REFUND_RATIO) }))
    .filter((s) => s.amount > 0);
}

/** Removes a building, returns partial resources, and spills a container's contents back to the core. */
export function removeBuilding(world: World, id: number, opts: { refund?: boolean; silent?: boolean } = {}): boolean {
  const b = world.buildings.get(id);
  if (!b || b.kind === 'core') return false;
  clearOccupancy(world, b);
  world.buildings.delete(id);
  if (opts.refund !== false) invAddAll(world.inventory, refundFor(b.kind));
  // Return stored / buffered items so demolishing never silently destroys resources.
  if (b.storage) for (const [item, n] of Object.entries(b.storage.items)) invAdd(world.inventory, item as ItemId, n ?? 0);
  if (b.crafter) {
    for (const [item, n] of Object.entries(b.crafter.input)) invAdd(world.inventory, item as ItemId, n ?? 0);
    for (const [item, n] of Object.entries(b.crafter.output)) invAdd(world.inventory, item as ItemId, n ?? 0);
  }
  markMapChanged(world);
  if (!opts.silent) {
    playSound(world, 'demolish', b.x + b.size / 2, b.y + b.size / 2);
    pushEvent(world, { type: 'destroyed', kind: b.kind, x: b.x, y: b.y });
  }
  return true;
}

/** Rotates a building in place (conveyors/inserters/bridges/tunnels). */
export function rotateBuilding(world: World, id: number, delta: 1 | -1 = 1): boolean {
  const b = world.buildings.get(id);
  if (!b || !BUILDINGS[b.kind].rotatable) return false;
  b.rot = (((b.rot + delta) % 4) + 4) % 4 as Dir;
  if (b.kind === 'tunnel' && b.tunnel) b.tunnel.mode = autoTunnelMode(world, b.x, b.y, b.rot);
  markMapChanged(world);
  return true;
}

/** Enemy-facing: can a ground unit path through this tile, and at what extra cost? */
export function tileBlocked(world: World, x: number, y: number): boolean {
  if (!inBounds(world, x, y)) return true;
  const t = world.terrain[y * world.width + x];
  if (t === Terrain.Water || t === Terrain.Rock) return true;
  const b = buildingAt(world, x, y);
  return b !== undefined && BUILDINGS[b.kind].solid;
}

export function neighborConveyor(world: World, x: number, y: number): Building | undefined {
  const b = buildingAt(world, x, y);
  return b && isConveyorKind(b.kind) ? b : undefined;
}

export function tilesOf(b: Building): TileXY[] {
  const out: TileXY[] = [];
  for (let dy = 0; dy < b.size; dy++) for (let dx = 0; dx < b.size; dx++) out.push({ x: b.x + dx, y: b.y + dy });
  return out;
}
