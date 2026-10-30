import { createBuilding, type Building, type BuildingConfig, type TransitItem } from '../entities/Building';
import { createEnemy } from '../entities/Enemy';
import { isBuildingKind } from '../data/buildings';
import { MAX_IMPORT_BYTES, SAVE_KEY, SAVE_VERSION } from '../data/constants';
import { isEnemyType } from '../data/enemies';
import { isItemId, type ItemId } from '../data/items';
import { isRecipeId } from '../data/recipes';
import { isResearchId } from '../data/research';
import { createWorld, defaultModifiers, type World } from './World';
import { assignDrillOre, insertBuilding } from '../systems/placement';
import { recomputeModifiers } from '../systems/research';
import type { Inventory } from '../systems/inventory';
import { isDir } from './types';

export interface SaveData {
  version: number;
  seed: number;
  width: number;
  height: number;
  time: number;
  day: number;
  dayPhase: number;
  kills: number;
  nextId: number;
  nextEnemyId: number;
  inventory: Inventory;
  research: { completed: string[]; current: string | null; progress: Record<string, Inventory> };
  waves: { night: number; triggered: boolean; active: boolean };
  pollution: number[];
  launch: { active: boolean; timer: number; siloId: number };
  lastRecipe: Record<string, string>;
  buildings: SaveBuilding[];
  enemies: SaveEnemy[];
}

interface SaveBuilding {
  id: number;
  kind: string;
  x: number;
  y: number;
  rot: number;
  hp: number;
  belt?: [string, number][];
  storage?: Inventory;
  crafter?: { recipe: string | null; progress: number; crafting: boolean; input: Inventory; output: Inventory };
  drill?: { ore: string | null; output: number; progress: number };
  generator?: { fuel: number; burn: number };
  accumulator?: number;
  lab?: { items: Inventory; progress: number };
  silo?: { buffer: number; installed: number; progress: number };
  turret?: { ammoItem: string | null; ammo: number };
  sorter?: { filter: string | null; alt: number };
  inserter?: { phase: number; progress: number; held: string | null; filter: string | null };
  router?: { item: string | null; timer: number; from: number; rr: number };
  bridge?: [string, number, number][];
  tunnel?: { mode: 'in' | 'out'; queue: [string, number, number][] };
}

interface SaveEnemy {
  type: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

function cleanInventory(v: unknown): Inventory {
  const out: Inventory = {};
  if (typeof v !== 'object' || v === null) return out;
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (isItemId(k) && typeof n === 'number' && Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
  }
  return out;
}

function serializeBuilding(b: Building): SaveBuilding {
  const sb: SaveBuilding = { id: b.id, kind: b.kind, x: b.x, y: b.y, rot: b.rot, hp: Math.round(b.hp) };
  if (b.belt) sb.belt = b.belt.items.map((it) => [it.item, it.pos]);
  if (b.storage) sb.storage = { ...b.storage.items };
  if (b.crafter) {
    sb.crafter = {
      recipe: b.crafter.recipe,
      progress: b.crafter.progress,
      crafting: b.crafter.crafting,
      input: { ...b.crafter.input },
      output: { ...b.crafter.output },
    };
  }
  if (b.drill) sb.drill = { ore: b.drill.ore, output: b.drill.output, progress: b.drill.progress };
  if (b.generator) sb.generator = { fuel: b.generator.fuel, burn: b.generator.burn };
  if (b.accumulator) sb.accumulator = b.accumulator.stored;
  if (b.lab) sb.lab = { items: { ...b.lab.items }, progress: b.lab.progress };
  if (b.silo) sb.silo = { buffer: b.silo.buffer, installed: b.silo.installed, progress: b.silo.progress };
  if (b.turret) sb.turret = { ammoItem: b.turret.ammoItem, ammo: b.turret.ammo };
  if (b.sorter) sb.sorter = { filter: b.sorter.filter, alt: b.sorter.alt };
  if (b.inserter) {
    sb.inserter = { phase: b.inserter.phase, progress: b.inserter.progress, held: b.inserter.held, filter: b.inserter.filter };
  }
  if (b.router) sb.router = { item: b.router.slot.item, timer: b.router.slot.timer, from: b.router.slot.from, rr: b.router.rr };
  if (b.bridge) sb.bridge = b.bridge.queue.map((q) => [q.item, q.t, q.total]);
  if (b.tunnel) sb.tunnel = { mode: b.tunnel.mode, queue: b.tunnel.queue.map((q) => [q.item, q.t, q.total]) };
  return sb;
}

export function serializeWorld(world: World): SaveData {
  const lastRecipe: Record<string, string> = {};
  for (const [k, v] of Object.entries(world.lastRecipe)) if (v) lastRecipe[k] = v;
  return {
    version: SAVE_VERSION,
    seed: world.seed,
    width: world.width,
    height: world.height,
    time: world.time,
    day: world.day,
    dayPhase: world.dayPhase,
    kills: world.kills,
    nextId: world.nextId,
    nextEnemyId: world.nextEnemyId,
    inventory: { ...world.inventory },
    research: {
      completed: [...world.research.completed],
      current: world.research.current,
      progress: world.research.progress,
    },
    waves: { night: world.waves.night, triggered: world.waves.triggered, active: world.waves.active },
    pollution: Array.from(world.pollution.values),
    launch: { ...world.launch },
    lastRecipe,
    buildings: [...world.buildings.values()].map(serializeBuilding),
    enemies: world.enemies
      .filter((e) => !e.dead)
      .map((e) => ({ type: e.type, x: e.x, y: e.y, hp: Math.round(e.hp), maxHp: Math.round(e.maxHp) })),
  };
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function restoreBuilding(world: World, sb: SaveBuilding): void {
  if (!isBuildingKind(sb.kind)) return;
  if (typeof sb.x !== 'number' || typeof sb.y !== 'number') return;
  const rot = isDir(sb.rot) ? sb.rot : 0;
  const config: BuildingConfig = {};
  if (sb.crafter && (sb.crafter.recipe === null || isRecipeId(sb.crafter.recipe))) config.recipe = sb.crafter.recipe;
  if (sb.sorter) config.filter = sb.sorter.filter && isItemId(sb.sorter.filter) ? sb.sorter.filter : null;
  if (sb.inserter) config.filter = sb.inserter.filter && isItemId(sb.inserter.filter) ? sb.inserter.filter : null;
  if (sb.tunnel && (sb.tunnel.mode === 'in' || sb.tunnel.mode === 'out')) config.tunnelMode = sb.tunnel.mode;
  const b = createBuilding(sb.id, sb.kind, sb.x, sb.y, rot, world.modifiers.buildingHp, config);
  b.hp = Math.max(1, Math.min(b.maxHp, num(sb.hp, b.maxHp)));
  const transit = (arr: unknown): TransitItem[] =>
    Array.isArray(arr)
      ? arr
          .filter((q): q is [string, number, number] => Array.isArray(q) && isItemId(q[0]))
          .map((q) => ({ item: q[0] as ItemId, t: num(q[1], 0), total: num(q[2], 0) }))
      : [];

  if (b.belt && Array.isArray(sb.belt)) {
    b.belt.items = sb.belt
      .filter((it): it is [string, number] => Array.isArray(it) && isItemId(it[0]))
      .map((it) => ({ item: it[0] as ItemId, pos: Math.max(0, Math.min(1, num(it[1], 0))) }))
      .sort((a, c) => c.pos - a.pos);
  }
  if (b.storage && sb.storage) b.storage.items = cleanInventory(sb.storage);
  if (b.crafter && sb.crafter) {
    b.crafter.progress = num(sb.crafter.progress, 0);
    b.crafter.crafting = !!sb.crafter.crafting;
    b.crafter.input = cleanInventory(sb.crafter.input);
    b.crafter.output = cleanInventory(sb.crafter.output);
  }
  if (b.drill && sb.drill) {
    b.drill.output = Math.max(0, Math.floor(num(sb.drill.output, 0)));
    b.drill.progress = num(sb.drill.progress, 0);
  }
  if (b.generator && sb.generator) {
    b.generator.fuel = Math.max(0, num(sb.generator.fuel, 0));
    b.generator.burn = Math.max(0, num(sb.generator.burn, 0));
  }
  if (b.accumulator && typeof sb.accumulator === 'number') b.accumulator.stored = Math.max(0, sb.accumulator);
  if (b.lab && sb.lab) {
    b.lab.items = cleanInventory(sb.lab.items);
    b.lab.progress = num(sb.lab.progress, 0);
  }
  if (b.silo && sb.silo) {
    b.silo.buffer = Math.max(0, Math.floor(num(sb.silo.buffer, 0)));
    b.silo.installed = Math.max(0, Math.floor(num(sb.silo.installed, 0)));
    b.silo.progress = num(sb.silo.progress, 0);
  }
  if (b.turret && sb.turret) {
    b.turret.ammoItem = sb.turret.ammoItem && isItemId(sb.turret.ammoItem) ? sb.turret.ammoItem : null;
    b.turret.ammo = Math.max(0, Math.floor(num(sb.turret.ammo, 0)));
  }
  if (b.sorter && sb.sorter) b.sorter.alt = sb.sorter.alt === 1 ? 1 : 0;
  if (b.inserter && sb.inserter) {
    b.inserter.phase = sb.inserter.phase === 1 ? 1 : sb.inserter.phase === 2 ? 2 : 0;
    b.inserter.progress = Math.max(0, Math.min(1, num(sb.inserter.progress, 0)));
    b.inserter.held = sb.inserter.held && isItemId(sb.inserter.held) ? sb.inserter.held : null;
  }
  if (b.router && sb.router) {
    b.router.slot.item = sb.router.item && isItemId(sb.router.item) ? sb.router.item : null;
    b.router.slot.timer = num(sb.router.timer, 0);
    b.router.slot.from = isDir(sb.router.from) ? sb.router.from : 0;
    b.router.rr = num(sb.router.rr, 0) % 4;
  }
  if (b.bridge) b.bridge.queue = transit(sb.bridge);
  if (b.tunnel && sb.tunnel) b.tunnel.queue = transit(sb.tunnel.queue);
  // Overlapping / out-of-bounds buildings from a corrupt file are silently dropped.
  for (let dy = 0; dy < b.size; dy++) {
    for (let dx = 0; dx < b.size; dx++) {
      const x = b.x + dx;
      const y = b.y + dy;
      if (x < 0 || y < 0 || x >= world.width || y >= world.height) return;
      if (world.occupancy[y * world.width + x] !== 0) return;
    }
  }
  assignDrillOre(world, b);
  insertBuilding(world, b);
}

/** Rebuilds a World from save data. Returns null when the data is not a usable save. */
export function deserializeWorld(data: unknown): World | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Partial<SaveData>;
  if (d.version !== SAVE_VERSION) return null;
  if (typeof d.seed !== 'number' || typeof d.width !== 'number' || typeof d.height !== 'number') return null;
  if (d.width < 8 || d.width > 512 || d.height < 8 || d.height > 512) return null;
  if (!Array.isArray(d.buildings)) return null;

  const world = createWorld({ seed: d.seed, width: d.width, height: d.height, withCore: false, startingItems: false });
  world.time = num(d.time, 0);
  world.day = Math.max(1, Math.floor(num(d.day, 1)));
  world.dayPhase = ((num(d.dayPhase, 0) % 1) + 1) % 1;
  world.kills = Math.max(0, Math.floor(num(d.kills, 0)));
  world.inventory = cleanInventory(d.inventory);

  if (d.research && typeof d.research === 'object') {
    const completed = Array.isArray(d.research.completed) ? d.research.completed.filter(isResearchId) : [];
    world.research.completed = new Set(completed);
    world.research.current = d.research.current && isResearchId(d.research.current) ? d.research.current : null;
    const progress: Record<string, Inventory> = {};
    if (d.research.progress && typeof d.research.progress === 'object') {
      for (const [k, v] of Object.entries(d.research.progress)) if (isResearchId(k)) progress[k] = cleanInventory(v);
    }
    world.research.progress = progress;
  }
  world.modifiers = defaultModifiers();
  recomputeModifiers(world);

  // Rebuild the core first so it occupies its tiles before others.
  const buildings = [...d.buildings].sort((a, b) => (a.kind === 'core' ? -1 : b.kind === 'core' ? 1 : 0));
  for (const sb of buildings) {
    if (typeof sb !== 'object' || sb === null) continue;
    restoreBuilding(world, sb as SaveBuilding);
  }
  for (const b of world.buildings.values()) if (b.kind === 'core') world.coreId = b.id;

  let maxId = 0;
  for (const b of world.buildings.values()) maxId = Math.max(maxId, b.id);
  world.nextId = Math.max(num(d.nextId, 1), maxId + 1);

  if (d.waves) {
    world.waves.night = Math.max(0, Math.floor(num(d.waves.night, 0)));
    world.waves.triggered = !!d.waves.triggered;
    world.waves.active = !!d.waves.active;
  }
  if (Array.isArray(d.pollution) && d.pollution.length === world.pollution.values.length) {
    for (let i = 0; i < d.pollution.length; i++) world.pollution.values[i] = Math.max(0, num(d.pollution[i], 0));
  }
  if (d.launch) {
    world.launch.active = !!d.launch.active;
    world.launch.timer = num(d.launch.timer, 0);
    world.launch.siloId = Math.floor(num(d.launch.siloId, 0));
  }
  if (d.lastRecipe && typeof d.lastRecipe === 'object') {
    for (const [k, v] of Object.entries(d.lastRecipe)) {
      if ((k === 'furnace' || k === 'assembler' || k === 'chem_plant' || k === 'adv_assembler') && isRecipeId(v)) {
        world.lastRecipe[k] = v;
      }
    }
  }
  if (Array.isArray(d.enemies)) {
    for (const se of d.enemies) {
      if (!se || !isEnemyType(se.type)) continue;
      const e = createEnemy(world.nextEnemyId++, se.type, num(se.x, 0), num(se.y, 0));
      e.maxHp = Math.max(1, Math.floor(num(se.maxHp, e.maxHp)));
      e.hp = Math.max(1, Math.min(e.maxHp, Math.floor(num(se.hp, e.hp))));
      world.enemies.push(e);
    }
  }
  world.nextEnemyId = Math.max(num(d.nextEnemyId, 1), world.nextEnemyId);
  world.logisticsDirty = true;
  world.power.dirty = true;
  world.mapVersion++;
  return world;
}

/** localStorage, or null when the browser blocks it (private mode, disabled storage). */
export function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function exportToJSON(world: World): string {
  return JSON.stringify(serializeWorld(world));
}

/** Parses an exported save file, enforcing a size cap before parsing untrusted input. */
export function importFromJSON(text: string): World | null {
  if (text.length > MAX_IMPORT_BYTES) return null;
  try {
    return deserializeWorld(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

export function saveToStorage(world: World, storage: Storage): boolean {
  try {
    storage.setItem(SAVE_KEY, exportToJSON(world));
    return true;
  } catch {
    return false;
  }
}

export function loadFromStorage(storage: Storage): World | null {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    return deserializeWorld(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function hasSave(storage: Storage): boolean {
  try {
    return storage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSave(storage: Storage): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
