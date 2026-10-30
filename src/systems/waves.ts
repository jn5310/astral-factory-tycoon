import { createEnemy } from '../entities/Enemy';
import type { TileXY } from '../core/types';
import { ENEMIES, ENEMY_TYPES, type EnemyType } from '../data/enemies';
import { DAY_LENGTH, MAX_ENEMIES } from '../data/constants';
import { coreCenter, type World } from '../core/World';
import { pushEvent, playSound, toast } from '../core/grid';
import { Rng } from '../utils/rng';
import { isNightPhase } from './daynight';
import { pollutionAt } from './pollution';

export { daylightAt, isNightPhase, secondsUntilDawn, secondsUntilNight } from './daynight';

export interface SpawnOrder {
  type: EnemyType;
  count: number;
}

export interface WaveState {
  night: number;
  active: boolean;
  /** Enemies queued to spawn this wave (consumed over time). */
  queue: EnemyType[];
  spawnTimer: number;
  spawnInterval: number;
  /** True once this cycle's wave has been generated (reset at dawn). */
  triggered: boolean;
  lastThreat: number;
  /** Seconds since the last pollution raid check. */
  raidTimer: number;
}

/** Nests soaked in at least this much pollution send raids, day or night. */
export const RAID_THRESHOLD = 4;
export const RAID_INTERVAL = 50;
export const RAID_MAX = 10;

export function createWaveState(): WaveState {
  return {
    night: 0,
    active: false,
    queue: [],
    spawnTimer: 0,
    spawnInterval: 0.8,
    triggered: false,
    lastThreat: 0,
    raidTimer: 0,
  };
}

/**
 * Threat budget for a night: grows with the night number and with accumulated pollution,
 * so a dirty factory is punished harder. Pure for testing.
 */
export function waveBudget(night: number, pollution: number): number {
  const base = 6 + night * night * 1.6 + night * 5;
  const pollutionFactor = 1 + Math.min(3, pollution / 3000);
  return Math.round(base * pollutionFactor);
}

/**
 * Spends the budget on enemy types unlocked by the current night, cheapest-biased but with
 * variety, and adds one Leviathan boss every 5th night. Deterministic given `rng`.
 */
export function composeWave(night: number, budget: number, rng: Rng): SpawnOrder[] {
  const available = ENEMY_TYPES.filter((t) => t !== 'leviathan' && ENEMIES[t].firstNight <= night);
  const counts = new Map<EnemyType, number>();
  let remaining = budget;
  let guard = 0;
  while (remaining > 0 && available.length > 0 && guard++ < 10000) {
    const type = available[rng.int(0, available.length - 1)];
    if (!type) break;
    const cost = ENEMIES[type].cost;
    if (cost > remaining) {
      // Spend the dregs on the cheapest unit so budgets are used up fully.
      const cheapest = available.reduce((a, b) => (ENEMIES[b].cost < ENEMIES[a].cost ? b : a));
      if (ENEMIES[cheapest].cost > remaining) break;
      counts.set(cheapest, (counts.get(cheapest) ?? 0) + 1);
      remaining -= ENEMIES[cheapest].cost;
      continue;
    }
    counts.set(type, (counts.get(type) ?? 0) + 1);
    remaining -= cost;
  }
  const orders: SpawnOrder[] = [];
  if (night % 5 === 0 && night > 0) orders.push({ type: 'leviathan', count: Math.floor(night / 5) });
  for (const type of ENEMY_TYPES) {
    const c = counts.get(type);
    if (c) orders.push({ type, count: c });
  }
  return orders;
}

export function ordersToQueue(orders: readonly SpawnOrder[]): EnemyType[] {
  const queue: EnemyType[] = [];
  for (const o of orders) for (let i = 0; i < o.count; i++) queue.push(o.type);
  return queue;
}

export function waveThreat(orders: readonly SpawnOrder[]): number {
  return orders.reduce((s, o) => s + ENEMIES[o.type].cost * o.count, 0);
}

function startWave(world: World): void {
  const w = world.waves;
  w.night++;
  const budget = waveBudget(w.night, world.pollution.total);
  const orders = composeWave(w.night, budget, world.rng);
  w.queue = ordersToQueue(orders);
  // Shuffle so enemy types arrive mixed, not in neat blocks.
  for (let i = w.queue.length - 1; i > 0; i--) {
    const j = world.rng.int(0, i);
    const tmp = w.queue[i];
    const other = w.queue[j];
    if (tmp !== undefined && other !== undefined) {
      w.queue[i] = other;
      w.queue[j] = tmp;
    }
  }
  w.active = true;
  w.triggered = true;
  w.spawnTimer = 0;
  w.spawnInterval = Math.max(0.25, 0.9 - w.night * 0.05);
  w.lastThreat = waveThreat(orders);
  pushEvent(world, { type: 'nightStart', night: w.night });
  playSound(world, 'alarm', coreCenter(world).x, coreCenter(world).y);
  toast(world, `${w.night}번째 밤: 외계 생명체 공습! (위협도 ${w.lastThreat})`, 'danger');
}

/** Spawns one enemy beside a nest (or a random map edge when the map has none). */
export function spawnAtNest(world: World, type: EnemyType, nest?: TileXY): void {
  if (world.enemies.length >= MAX_ENEMIES) return;
  const picked = nest ?? (world.nests.length > 0 ? world.nests[world.rng.int(0, world.nests.length - 1)] : undefined);
  const base = picked ?? { x: world.rng.int(0, world.width - 1), y: 0 };
  const hpScale = 1 + world.waves.night * 0.08;
  const x = base.x + 0.5 + world.rng.range(-1, 1);
  const y = base.y + 0.5 + world.rng.range(-1, 1);
  world.enemies.push(createEnemy(world.nextEnemyId++, type, x, y, hpScale));
}

/** Pollution that diffuses out to a nest provokes a raid from that nest, even in daylight. */
export function pollutionRaids(world: World): number {
  let sent = 0;
  for (const nest of world.nests) {
    const p = pollutionAt(world.pollution, nest.x, nest.y);
    if (p < RAID_THRESHOLD) continue;
    const size = Math.min(RAID_MAX, Math.floor(p / RAID_THRESHOLD));
    for (let i = 0; i < size; i++) {
      spawnAtNest(world, i % 3 === 2 && world.waves.night >= 2 ? 'spitter' : 'rusher', nest);
    }
    sent += size;
  }
  if (sent > 0) toast(world, `오염에 자극받은 외계 생명체 ${sent}마리가 습격합니다!`, 'warning');
  return sent;
}

/** Drives day/night progression and trickle-spawns the active wave from nests. */
export function updateWaves(world: World, dt: number): void {
  const w = world.waves;
  const prevPhase = world.dayPhase;
  world.dayPhase += dt / DAY_LENGTH;
  while (world.dayPhase >= 1) {
    world.dayPhase -= 1;
    world.day++;
    w.triggered = false;
    pushEvent(world, { type: 'dayStart', day: world.day });
  }
  const night = isNightPhase(world.dayPhase);
  const wasNight = isNightPhase(prevPhase);
  if (night && !wasNight && !w.triggered) startWave(world);

  if (w.active && w.queue.length > 0) {
    w.spawnTimer -= dt;
    while (w.spawnTimer <= 0 && w.queue.length > 0) {
      const type = w.queue.shift();
      if (type) spawnAtNest(world, type);
      w.spawnTimer += w.spawnInterval;
    }
  }
  if (w.active && w.queue.length === 0 && world.enemies.length === 0 && !night) w.active = false;

  w.raidTimer += dt;
  if (w.raidTimer >= RAID_INTERVAL) {
    w.raidTimer = 0;
    pollutionRaids(world);
  }
}
