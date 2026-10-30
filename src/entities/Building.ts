import { BUILDINGS, type BuildingKind, isConveyorKind, isCrafterKind } from '../data/buildings';
import type { ItemId } from '../data/items';
import { DEFAULT_RECIPE, type RecipeId } from '../data/recipes';
import { CONTAINER_CAPACITY } from '../data/constants';
import { TURRETS } from '../data/turrets';
import type { Dir, Vec2 } from '../core/types';
import type { Inventory } from '../systems/inventory';

/** Belt render/insert shape: 0 straight, 1 curve fed from the left side, 2 curve fed from the right side. */
export type BeltShape = 0 | 1 | 2;

export interface BeltItem {
  item: ItemId;
  /** 0 = entry edge, 1 = exit edge. Items are kept sorted by pos, descending (index 0 = front). */
  pos: number;
}

export interface BeltState {
  items: BeltItem[];
  shape: BeltShape;
}

export interface SlotState {
  item: ItemId | null;
  timer: number;
  /** Side of the building the item entered from. */
  from: Dir;
}

export interface RouterState {
  slot: SlotState;
  rr: number;
}

export interface SorterState {
  slot: SlotState;
  filter: ItemId | null;
  alt: number;
}

export interface TransitItem {
  item: ItemId;
  /** Remaining travel time (s). */
  t: number;
  /** Total travel time of this hop (s), for rendering. */
  total: number;
}

export interface BridgeState {
  queue: TransitItem[];
  /** Linked bridge id this bridge sends to (0 = none, outputs forward). Recomputed from the map. */
  partner: number;
}

export interface TunnelState {
  mode: 'in' | 'out';
  queue: TransitItem[];
  /** Entrance: linked exit id. Exit: linked entrance id. 0 = unlinked. */
  partner: number;
}

export interface StorageState {
  items: Inventory;
  capacity: number;
}

/** 0 idle, 1 swinging to target with an item, 2 returning to source. */
export type InserterPhase = 0 | 1 | 2;

export interface InserterState {
  phase: InserterPhase;
  progress: number;
  held: ItemId | null;
  filter: ItemId | null;
}

export interface DrillState {
  ore: ItemId | null;
  oreTiles: number;
  progress: number;
  output: number;
}

export interface CrafterState {
  recipe: RecipeId | null;
  progress: number;
  crafting: boolean;
  input: Inventory;
  output: Inventory;
}

export interface GeneratorState {
  fuel: number;
  /** Remaining kJ of the coal currently burning. */
  burn: number;
  /** kW produced last tick (display). */
  output: number;
}

export interface AccumulatorState {
  stored: number;
}

export interface LabState {
  items: Inventory;
  progress: number;
}

export interface SiloState {
  buffer: number;
  installed: number;
  progress: number;
}

export interface TurretState {
  ammoItem: ItemId | null;
  ammo: number;
  cooldown: number;
  angle: number;
  target: number;
  /** Visual: beam strength / muzzle flash 0..1. */
  flash: number;
  /** Kills credited to this turret (veterancy). */
  kills: number;
  beamX: number;
  beamY: number;
}

export interface Building {
  id: number;
  kind: BuildingKind;
  /** Top-left tile. */
  x: number;
  y: number;
  size: number;
  rot: Dir;
  hp: number;
  maxHp: number;
  /** Did work this tick (animation, pollution). */
  active: boolean;
  /** Power wanted this tick in kW. */
  demand: number;
  /** Power satisfaction 0..1 applied this tick. */
  satisfaction: number;
  powerNet: number;
  anim: number;
  dumpIndex: number;
  dumpTimer: number;
  hitFlash: number;
  belt?: BeltState;
  router?: RouterState;
  sorter?: SorterState;
  bridge?: BridgeState;
  tunnel?: TunnelState;
  storage?: StorageState;
  inserter?: InserterState;
  drill?: DrillState;
  crafter?: CrafterState;
  generator?: GeneratorState;
  accumulator?: AccumulatorState;
  lab?: LabState;
  silo?: SiloState;
  turret?: TurretState;
}

export interface BuildingConfig {
  recipe?: RecipeId | null;
  filter?: ItemId | null;
  tunnelMode?: 'in' | 'out';
}

export function createBuilding(
  id: number,
  kind: BuildingKind,
  x: number,
  y: number,
  rot: Dir,
  hpMultiplier = 1,
  config: BuildingConfig = {},
): Building {
  const def = BUILDINGS[kind];
  const maxHp = Math.round(def.hp * hpMultiplier);
  const b: Building = {
    id,
    kind,
    x,
    y,
    size: def.size,
    rot: def.rotatable ? rot : 0,
    hp: maxHp,
    maxHp,
    active: false,
    demand: 0,
    satisfaction: 0,
    powerNet: -1,
    anim: 0,
    dumpIndex: 0,
    dumpTimer: 0,
    hitFlash: 0,
  };
  if (isConveyorKind(kind)) b.belt = { items: [], shape: 0 };
  else if (kind === 'router') b.router = { slot: { item: null, timer: 0, from: 0 }, rr: 0 };
  else if (kind === 'sorter') b.sorter = { slot: { item: null, timer: 0, from: 0 }, filter: config.filter ?? null, alt: 0 };
  else if (kind === 'bridge') b.bridge = { queue: [], partner: 0 };
  else if (kind === 'tunnel') b.tunnel = { mode: config.tunnelMode ?? 'in', queue: [], partner: 0 };
  else if (kind === 'container') b.storage = { items: {}, capacity: CONTAINER_CAPACITY };
  else if (kind === 'inserter') b.inserter = { phase: 0, progress: 0, held: null, filter: config.filter ?? null };
  else if (kind === 'mech_drill' || kind === 'electric_drill') b.drill = { ore: null, oreTiles: 0, progress: 0, output: 0 };
  else if (isCrafterKind(kind)) {
    b.crafter = {
      recipe: config.recipe === undefined ? DEFAULT_RECIPE[kind] : config.recipe,
      progress: 0,
      crafting: false,
      input: {},
      output: {},
    };
  } else if (kind === 'thermal_generator') b.generator = { fuel: 0, burn: 0, output: 0 };
  else if (kind === 'accumulator') b.accumulator = { stored: 0 };
  else if (kind === 'lab') b.lab = { items: {}, progress: 0 };
  else if (kind === 'rocket_silo') b.silo = { buffer: 0, installed: 0, progress: 0 };
  if (TURRETS[kind]) {
    b.turret = { ammoItem: null, ammo: 0, cooldown: 0, angle: -Math.PI / 2, target: 0, flash: 0, kills: 0, beamX: 0, beamY: 0 };
  }
  return b;
}

export function buildingCenter(b: Building): Vec2 {
  return { x: b.x + b.size / 2, y: b.y + b.size / 2 };
}

export function containsTile(b: Building, tx: number, ty: number): boolean {
  return tx >= b.x && ty >= b.y && tx < b.x + b.size && ty < b.y + b.size;
}

export interface PerimeterCell {
  dx: number;
  dy: number;
  /** Outward direction from the building to this cell. */
  dir: Dir;
}

const perimeterCache = new Map<number, PerimeterCell[]>();

/** Cells just outside a size x size footprint, clockwise from the top-left. Relative to the top-left tile. */
export function perimeter(size: number): PerimeterCell[] {
  const cached = perimeterCache.get(size);
  if (cached) return cached;
  const cells: PerimeterCell[] = [];
  for (let i = 0; i < size; i++) cells.push({ dx: i, dy: -1, dir: 3 });
  for (let i = 0; i < size; i++) cells.push({ dx: size, dy: i, dir: 0 });
  for (let i = size - 1; i >= 0; i--) cells.push({ dx: i, dy: size, dir: 1 });
  for (let i = size - 1; i >= 0; i--) cells.push({ dx: -1, dy: i, dir: 2 });
  perimeterCache.set(size, cells);
  return cells;
}
