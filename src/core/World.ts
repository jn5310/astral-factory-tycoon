import type { Building } from '../entities/Building';
import { createBuilding } from '../entities/Building';
import type { Enemy } from '../entities/Enemy';
import { ParticlePool } from '../entities/Particle';
import { ProjectilePool } from '../entities/Projectile';
import { MAP_SIZE, START_PHASE } from '../data/constants';
import type { CrafterKind, RecipeId } from '../data/recipes';
import { Terrain } from '../data/terrain';
import type { Inventory } from '../systems/inventory';
import { PathService } from '../systems/pathfinding';
import { createPollution, type PollutionState } from '../systems/pollution';
import { createPowerState, type PowerState } from '../systems/power';
import { Quadtree } from '../systems/quadtree';
import { createResearchState, type ResearchState } from '../systems/research';
import { StatsTracker } from '../systems/stats';
import { generateTerrain } from '../systems/terrain';
import { createWaveState, type WaveState } from '../systems/waves';
import { insertBuilding } from '../systems/placement';
import { Rng } from '../utils/rng';
import type { GameEvent } from './events';
import type { TileXY } from './types';

export interface Modifiers {
  drillSpeed: number;
  ammoDamage: number;
  laserDamage: number;
  buildingHp: number;
  generatorOutput: number;
}

export interface LaunchState {
  active: boolean;
  timer: number;
  siloId: number;
}

export type WorldState = 'playing' | 'victory' | 'defeat';

export interface World {
  width: number;
  height: number;
  seed: number;
  terrain: Uint8Array;
  ore: Uint8Array;
  /** Building id per tile (0 = empty). */
  occupancy: Int32Array;
  buildings: Map<number, Building>;
  nextId: number;
  /** Core storage = the player's resources. */
  inventory: Inventory;
  coreId: number;
  nests: TileXY[];
  time: number;
  tick: number;
  /** 0..1 position in the day/night cycle. */
  dayPhase: number;
  day: number;
  enemies: Enemy[];
  /** Rebuilt each tick for O(1) lookup by projectiles/turrets. */
  enemyById: Map<number, Enemy>;
  nextEnemyId: number;
  projectiles: ProjectilePool;
  particles: ParticlePool;
  research: ResearchState;
  power: PowerState;
  pollution: PollutionState;
  waves: WaveState;
  stats: StatsTracker;
  modifiers: Modifiers;
  /** Incremented whenever buildings change; invalidates cached paths. */
  mapVersion: number;
  logisticsDirty: boolean;
  /** Belt ids, downstream belts first. */
  beltOrder: number[];
  events: GameEvent[];
  state: WorldState;
  rng: Rng;
  lastRecipe: Partial<Record<CrafterKind, RecipeId>>;
  paths: PathService;
  enemyTree: Quadtree;
  launch: LaunchState;
  kills: number;
  /** Visual only: disables particle spawning in headless tests when false. */
  visuals: boolean;
}

export interface CreateWorldOptions {
  seed: number;
  width?: number;
  height?: number;
  /** All-plain map without ores (unit tests). */
  flat?: boolean;
  /** Place the colony core (default true for generated maps, false for flat maps). */
  withCore?: boolean;
  /** Give the default starting resources (default true for generated maps). */
  startingItems?: boolean;
}

export const STARTING_INVENTORY: Inventory = {
  iron_plate: 220,
  copper_plate: 140,
  stone: 120,
  gear: 40,
  coal: 40,
  copper_wire: 30,
  brick: 30,
  basic_ammo: 60,
};

export function defaultModifiers(): Modifiers {
  return { drillSpeed: 1, ammoDamage: 1, laserDamage: 1, buildingHp: 1, generatorOutput: 1 };
}

export function createWorld(opts: CreateWorldOptions): World {
  const width = opts.width ?? MAP_SIZE;
  const height = opts.height ?? MAP_SIZE;
  const flat = opts.flat ?? false;
  let terrain: Uint8Array;
  let ore: Uint8Array;
  let nests: TileXY[];
  let coreTile: TileXY;
  if (flat) {
    terrain = new Uint8Array(width * height).fill(Terrain.Plain);
    ore = new Uint8Array(width * height);
    nests = [];
    coreTile = { x: Math.floor(width / 2) - 1, y: Math.floor(height / 2) - 1 };
  } else {
    const gen = generateTerrain(opts.seed, width, height);
    terrain = gen.terrain;
    ore = gen.ore;
    nests = gen.nests;
    coreTile = gen.core;
  }
  const world: World = {
    width,
    height,
    seed: opts.seed,
    terrain,
    ore,
    occupancy: new Int32Array(width * height),
    buildings: new Map(),
    nextId: 1,
    inventory: {},
    coreId: 0,
    nests,
    time: 0,
    tick: 0,
    dayPhase: START_PHASE,
    day: 1,
    enemies: [],
    enemyById: new Map(),
    nextEnemyId: 1,
    projectiles: new ProjectilePool(600),
    particles: new ParticlePool(2400),
    research: createResearchState(),
    power: createPowerState(),
    pollution: createPollution(width, height),
    waves: createWaveState(),
    stats: new StatsTracker(),
    modifiers: defaultModifiers(),
    mapVersion: 0,
    logisticsDirty: true,
    beltOrder: [],
    events: [],
    state: 'playing',
    rng: new Rng(opts.seed ^ 0x9e3779b9),
    lastRecipe: {},
    paths: new PathService(),
    enemyTree: new Quadtree(-4, -4, width + 8, height + 8),
    launch: { active: false, timer: 0, siloId: 0 },
    kills: 0,
    visuals: true,
  };
  const withCore = opts.withCore ?? !flat;
  if (withCore) {
    const core = createBuilding(world.nextId++, 'core', coreTile.x, coreTile.y, 0);
    insertBuilding(world, core);
    world.coreId = core.id;
  }
  if (opts.startingItems ?? !flat) {
    world.inventory = { ...STARTING_INVENTORY };
  }
  return world;
}

/** Center of the core (or the map center when there is none). */
export function coreCenter(world: World): TileXY {
  const core = world.buildings.get(world.coreId);
  if (core) return { x: core.x + core.size / 2, y: core.y + core.size / 2 };
  return { x: world.width / 2, y: world.height / 2 };
}
