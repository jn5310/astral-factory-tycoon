import type { Pickup } from '../entities/Pickup';
import { MUTATOR, type GameSettings } from '../data/difficulty';
import type { ItemId, ItemStack } from '../data/items';
import { Ore, Terrain } from '../data/terrain';
import {
  EVENT_INTERVAL_MAX,
  EVENT_INTERVAL_MIN,
  FIRST_EVENT_DELAY,
  METEOR_DAMAGE,
  METEOR_FALL_TIME,
  METEOR_RADIUS,
  PICKUP_FALL_TIME,
  PICKUP_LIFETIME,
  WORLD_EVENTS,
  WORLD_EVENT_IDS,
  type WorldEventId,
} from '../data/worldEvents';
import { buildingAt, inBounds, playSound, pushEvent, radio, toast } from '../core/grid';
import { coreCenter, type World } from '../core/World';
import { msg, stacksText } from '../utils/i18n';
import { damageBuilding, damageEnemy } from './combat';
import { isNightPhase } from './daynight';
import { invAddAll } from './inventory';
import { attacksEnabled } from './modifiers';
import type { Rng } from '../utils/rng';

export interface ActiveEffect {
  id: WorldEventId;
  timeLeft: number;
  total: number;
}

export interface MeteorFall {
  x: number;
  y: number;
  /** Seconds until impact. */
  t: number;
  /** Ore left behind. */
  ore: number;
}

export interface DirectorState {
  /** Seconds until the next random event. */
  timer: number;
  effect: ActiveEffect | null;
  /** Set during the day before a blood-moon night, cleared at dawn. */
  bloodMoon: boolean;
  meteors: MeteorFall[];
}

export function createDirectorState(settings: GameSettings): DirectorState {
  return { timer: FIRST_EVENT_DELAY * MUTATOR[settings.mutator].eventIntervalMul, effect: null, bloodMoon: false, meteors: [] };
}

const MAX_PICKUPS = 2;

/** Events that may start right now. */
export function eligibleEvents(world: World): WorldEventId[] {
  const night = isNightPhase(world.dayPhase);
  return WORLD_EVENT_IDS.filter((id) => {
    const def = WORLD_EVENTS[id];
    if (world.day < def.minDay) return false;
    if (def.dayOnly && night) return false;
    if (def.needsAttacks && !attacksEnabled(world)) return false;
    if (def.duration > 0 && world.director.effect) return false;
    if (id === 'bloodMoon' && world.director.bloodMoon) return false;
    if (id === 'supplyDrop' && world.pickups.length >= MAX_PICKUPS) return false;
    if (id === 'meteor' && world.director.meteors.length > 0) return false;
    return true;
  });
}

export function pickEvent(world: World, rng: Rng): WorldEventId | null {
  const options = eligibleEvents(world);
  if (options.length === 0) return null;
  const meteorMul = MUTATOR[world.settings.mutator].meteorWeightMul;
  const weightOf = (id: WorldEventId): number => WORLD_EVENTS[id].weight * (id === 'meteor' ? meteorMul : 1);
  let total = 0;
  for (const id of options) total += weightOf(id);
  let roll = rng.next() * total;
  for (const id of options) {
    roll -= weightOf(id);
    if (roll <= 0) return id;
  }
  return options[options.length - 1] ?? null;
}

/** A random plain, unoccupied tile between minR and maxR tiles from the core, or null. */
function findOpenTile(world: World, rng: Rng, minR: number, maxR: number): { x: number; y: number } | null {
  const c = coreCenter(world);
  for (let attempt = 0; attempt < 40; attempt++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(minR, maxR);
    const x = Math.floor(c.x + Math.cos(a) * r);
    const y = Math.floor(c.y + Math.sin(a) * r);
    if (!inBounds(world, x, y)) continue;
    if (world.terrain[y * world.width + x] !== Terrain.Plain) continue;
    if (buildingAt(world, x, y)) continue;
    return { x, y };
  }
  return null;
}

/** Cargo grows with research progress so late pods still matter. */
export function rollLoot(world: World, rng: Rng): ItemStack[] {
  const r = world.research.completed.size;
  const pool: [ItemId, number, number][] = [
    ['iron_plate', 40, 80],
    ['copper_plate', 30, 60],
    ['coal', 20, 40],
    ['gear', 15, 30],
  ];
  if (r >= 6) pool.push(['steel', 15, 30], ['circuit', 10, 20]);
  if (r >= 14) pool.push(['battery', 10, 15], ['silicon', 15, 25]);
  if (r >= 22) pool.push(['processor', 5, 10], ['alloy', 8, 12]);
  const scale = 1 + Math.min(2, world.day * 0.05);
  const loot: ItemStack[] = [];
  for (let k = 0; k < 3 && pool.length > 0; k++) {
    const i = rng.int(0, pool.length - 1);
    const [item, lo, hi] = pool.splice(i, 1)[0] ?? ['iron_plate', 10, 10];
    loot.push({ item, amount: Math.round(rng.int(lo, hi) * scale) });
  }
  return loot;
}

export function spawnPickup(world: World, x: number, y: number, loot: ItemStack[]): Pickup {
  const p: Pickup = { id: world.nextPickupId++, x, y, loot, fall: PICKUP_FALL_TIME, life: PICKUP_LIFETIME, landed: false };
  world.pickups.push(p);
  return p;
}

function scheduleMeteors(world: World, rng: Rng): void {
  const count = Math.min(12, 5 + Math.floor(world.day / 2));
  const c = coreCenter(world);
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(6, 28);
    const x = Math.max(1, Math.min(world.width - 2, c.x + Math.cos(a) * r));
    const y = Math.max(1, Math.min(world.height - 2, c.y + Math.sin(a) * r));
    const roll = rng.next();
    const ore = roll < 0.55 ? Ore.Titanium : roll < 0.8 ? Ore.Iron : Ore.Copper;
    world.director.meteors.push({ x, y, t: METEOR_FALL_TIME + i * 0.55 + rng.next() * 0.4, ore });
  }
  world.counters.meteorShowers++;
}

export function triggerEvent(world: World, id: WorldEventId): void {
  const def = WORLD_EVENTS[id];
  const rng = world.rng;
  switch (id) {
    case 'meteor':
      scheduleMeteors(world, rng);
      break;
    case 'supplyDrop': {
      const tile = findOpenTile(world, rng, 8, 24);
      if (!tile) return;
      spawnPickup(world, tile.x + 0.5, tile.y + 0.5, rollLoot(world, rng));
      break;
    }
    case 'bloodMoon':
      world.director.bloodMoon = true;
      break;
    default:
      world.director.effect = { id, timeLeft: def.duration, total: def.duration };
      break;
  }
  radio(world, msg().worldEvents[id].radio);
  playSound(world, id === 'bloodMoon' ? 'siren' : 'alarm', world.width / 2, world.height / 2);
}

/** Meteor impact: damage, then rich ore on every open tile of the crater. */
export function meteorImpact(world: World, m: MeteorFall): void {
  const r = METEOR_RADIUS;
  const seen = new Set<number>();
  for (let y = Math.floor(m.y - r) - 1; y <= Math.ceil(m.y + r); y++) {
    for (let x = Math.floor(m.x - r) - 1; x <= Math.ceil(m.x + r); x++) {
      const b = buildingAt(world, x, y);
      if (b && !seen.has(b.id)) {
        seen.add(b.id);
        if (Math.hypot(b.x + b.size / 2 - m.x, b.y + b.size / 2 - m.y) <= r + b.size / 2) damageBuilding(world, b, METEOR_DAMAGE, 'environment');
      }
      if (!inBounds(world, x, y) || Math.hypot(x + 0.5 - m.x, y + 0.5 - m.y) > r) continue;
      const idx = y * world.width + x;
      if (world.terrain[idx] === Terrain.Water || world.occupancy[idx] !== 0) continue;
      world.ore[idx] = m.ore;
      world.oreEdits.set(idx, m.ore);
      world.terrainEdits.push(idx);
    }
  }
  world.terrainVersion++;
  for (const id of world.enemyTree.queryCircle(m.x, m.y, r + 0.5, [])) {
    const e = world.enemyById.get(id);
    if (e) damageEnemy(world, e, 120, 4);
  }
  if (world.visuals) {
    world.particles.spawn('flash', m.x, m.y, 0, 0, 0.4, 2.2, '#fdba74');
    world.particles.spawn('ring', m.x, m.y, 0, 0, 0.5, 2, '#fed7aa');
    for (let i = 0; i < 18; i++) {
      const a = world.rng.range(0, Math.PI * 2);
      const sp = world.rng.range(1.5, 6);
      world.particles.spawn('debris', m.x, m.y, Math.cos(a) * sp, Math.sin(a) * sp, world.rng.range(0.4, 0.9), 0.16, i % 2 ? '#a8a29e' : '#9fb4ff');
    }
    world.particles.spawn('smoke', m.x, m.y, 0, -0.4, 1.6, 1, '#57534e');
  }
  pushEvent(world, { type: 'shake', strength: 0.55 });
  playSound(world, 'meteor', m.x, m.y);
  // Same text every impact, so the HUD keeps one toast and its "View" follows the latest crater.
  toast(world, msg().toast.meteorImpact, 'info', { x: m.x, y: m.y });
}

export function updateDirector(world: World, dt: number): void {
  const d = world.director;
  if (d.effect) {
    d.effect.timeLeft -= dt;
    if (d.effect.timeLeft <= 0) d.effect = null;
  }
  if (d.meteors.length > 0) {
    for (const m of d.meteors) m.t -= dt;
    const hit = d.meteors.filter((m) => m.t <= 0);
    if (hit.length > 0) {
      d.meteors = d.meteors.filter((m) => m.t > 0);
      for (const m of hit) meteorImpact(world, m);
    }
  }
  d.timer -= dt;
  if (d.timer > 0) return;
  const id = pickEvent(world, world.rng);
  if (id) triggerEvent(world, id);
  d.timer = world.rng.range(EVENT_INTERVAL_MIN, EVENT_INTERVAL_MAX) * MUTATOR[world.settings.mutator].eventIntervalMul;
}

export function updatePickups(world: World, dt: number): void {
  if (world.pickups.length === 0) return;
  let expired = false;
  for (const p of world.pickups) {
    if (p.fall > 0) {
      p.fall -= dt;
      if (p.fall <= 0 && !p.landed) {
        p.landed = true;
        toast(world, msg().toast.pickupLanded, 'info', { x: p.x, y: p.y });
        playSound(world, 'pickup', p.x, p.y);
        if (world.visuals) world.particles.spawn('ring', p.x, p.y, 0, 0, 0.6, 1.6, '#67e8f9');
      }
      continue;
    }
    p.life -= dt;
    if (p.life <= 0) expired = true;
  }
  if (expired) {
    world.pickups = world.pickups.filter((p) => p.life > 0);
    toast(world, msg().toast.pickupExpired, 'warning');
  }
}

/** Landed pod within `radius` tiles of a point. */
export function pickupAt(world: World, x: number, y: number, radius = 1.3): Pickup | undefined {
  return world.pickups.find((p) => p.landed && Math.hypot(p.x - x, p.y - y) <= radius);
}

export function collectPickup(world: World, id: number): boolean {
  const p = world.pickups.find((q) => q.id === id);
  if (!p || !p.landed) return false;
  world.pickups = world.pickups.filter((q) => q.id !== id);
  invAddAll(world.inventory, p.loot);
  world.counters.dropsCollected++;
  toast(world, msg().toast.pickupCollected(stacksText(p.loot)), 'success');
  playSound(world, 'pickup', p.x, p.y);
  if (world.visuals) {
    p.loot.forEach((s, i) => world.particles.spawnText(p.x, p.y - i * 0.55, `+${s.amount}`, '#a5f3fc', s.item));
    world.particles.spawn('ring', p.x, p.y, 0, 0, 0.5, 1.4, '#a5f3fc');
  }
  return true;
}
