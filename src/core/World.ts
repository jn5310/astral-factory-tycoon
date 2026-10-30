import type { Building } from '../entities/Building';
import { createBuilding } from '../entities/Building';
import type { Enemy } from '../entities/Enemy';
import { ParticlePool } from '../entities/Particle';
import type { Pickup } from '../entities/Pickup';
import { ProjectilePool } from '../entities/Projectile';
import { CORE_ITEM_CAPACITY, MAP_SIZE, START_PHASE } from '../data/constants';
import { DIFFICULTY, defaultSettings, type Difficulty, type GameMode, type GameSettings, type Mutator } from '../data/difficulty';
import { ITEM_IDS, type ItemId } from '../data/items';
import { MISSIONS } from '../data/missions';
import type { CrafterKind, RecipeId } from '../data/recipes';
import { RESEARCH_IDS } from '../data/research';
import { Terrain } from '../data/terrain';
import { createAbilityState, type AbilityState } from '../systems/abilities';
import { createDirectorState, type DirectorState } from '../systems/director';
import type { Inventory } from '../systems/inventory';
import { createMissionState, type MissionState } from '../systems/missions';
import { PathService } from '../systems/pathfinding';
import { insertBuilding } from '../systems/placement';
import { createPollution, type PollutionState } from '../systems/pollution';
import { createPowerState, type PowerState } from '../systems/power';
import { Quadtree } from '../systems/quadtree';
import { createResearchState, recomputeModifiers, type ResearchState } from '../systems/research';
import { StatsTracker } from '../systems/stats';
import { generateTerrain } from '../systems/terrain';
import { createWaveState, type WaveState } from '../systems/waves';
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

/** Run statistics used by missions, achievements and the score. */
export interface Counters {
  nightsSurvived: number;
  bossKills: number;
  buildingsLost: number;
  /** Buildings lost during the current night. */
  nightLosses: number;
  /** Attack nights survived without losing a building. */
  cleanNights: number;
  dropsCollected: number;
  meteorShowers: number;
  salvage: number;
  /** Highest generating capacity reached, in kW. */
  peakPower: number;
  launches: number;
  /** Day of the first rocket launch (0 = none yet). */
  launchDay: number;
}

export interface AttackAlert {
  x: number;
  y: number;
  time: number;
}

export type WorldState = 'playing' | 'victory' | 'defeat';

export interface World {
  width: number;
  height: number;
  seed: number;
  settings: GameSettings;
  terrain: Uint8Array;
  ore: Uint8Array;
  /** Ore tiles changed after generation (meteor deposits), so saves can restore them. */
  oreEdits: Map<number, number>;
  /** Tiles whose look changed since the renderer last redrew them. */
  terrainEdits: number[];
  terrainVersion: number;
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
  missions: MissionState;
  abilities: AbilityState;
  director: DirectorState;
  pickups: Pickup[];
  nextPickupId: number;
  counters: Counters;
  alerts: AttackAlert[];
  lastAlertTime: number;
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
  mode?: GameMode;
  difficulty?: Difficulty;
  mutator?: Mutator;
  dailyKey?: string | null;
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

/** Sandbox mode fills the core with this much of every item. */
export const SANDBOX_STOCK = 20000;

export function defaultModifiers(): Modifiers {
  return { drillSpeed: 1, ammoDamage: 1, laserDamage: 1, buildingHp: 1, generatorOutput: 1 };
}

export function createCounters(): Counters {
  return {
    nightsSurvived: 0,
    bossKills: 0,
    buildingsLost: 0,
    nightLosses: 0,
    cleanNights: 0,
    dropsCollected: 0,
    meteorShowers: 0,
    salvage: 0,
    peakPower: 0,
    launches: 0,
    launchDay: 0,
  };
}

export function createWorld(opts: CreateWorldOptions): World {
  const width = opts.width ?? MAP_SIZE;
  const height = opts.height ?? MAP_SIZE;
  const flat = opts.flat ?? false;
  const settings: GameSettings = {
    ...defaultSettings(),
    mode: opts.mode ?? 'standard',
    difficulty: opts.difficulty ?? 'normal',
    mutator: opts.mutator ?? 'none',
    dailyKey: opts.dailyKey ?? null,
  };
  const sandbox = settings.mode === 'sandbox';
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
    settings,
    terrain,
    ore,
    oreEdits: new Map(),
    terrainEdits: [],
    terrainVersion: 0,
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
    missions: createMissionState(!sandbox),
    abilities: createAbilityState(sandbox),
    director: createDirectorState(settings),
    pickups: [],
    nextPickupId: 1,
    counters: createCounters(),
    alerts: [],
    lastAlertTime: -Infinity,
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
    const mul = DIFFICULTY[settings.difficulty].startMul;
    for (const [item, n] of Object.entries(STARTING_INVENTORY) as [ItemId, number][]) {
      world.inventory[item] = Math.round(n * mul);
    }
  }
  if (sandbox) {
    for (const id of RESEARCH_IDS) world.research.completed.add(id);
    recomputeModifiers(world);
    for (const id of ITEM_IDS) world.inventory[id] = Math.min(CORE_ITEM_CAPACITY, SANDBOX_STOCK);
    world.missions.index = MISSIONS.length;
  }
  return world;
}

/** Center of the core (or the map center when there is none). */
export function coreCenter(world: World): TileXY {
  const core = world.buildings.get(world.coreId);
  if (core) return { x: core.x + core.size / 2, y: core.y + core.size / 2 };
  return { x: world.width / 2, y: world.height / 2 };
}
