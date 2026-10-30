import type { Building } from '../entities/Building';
import type { Enemy } from '../entities/Enemy';
import { BUILDINGS, isTurretKind, isWallKind } from '../data/buildings';
import { ENEMIES } from '../data/enemies';
import { PATH_BUDGET_PER_TICK } from '../data/constants';
import { Terrain } from '../data/terrain';
import { buildingAt, pushEvent } from '../core/grid';
import { coreCenter, type World } from '../core/World';
import { clamp, distToRect } from '../utils/math';
import type { PathGrid } from './pathfinding';
import { damageBuilding, fireAcid } from './combat';

/**
 * Extra A* cost for stepping through a solid building. Enemies walk around walls,
 * but when every route is walled they break through where it is cheapest (weakest wall).
 */
export const BARRIER_BASE = 8;
export const BARRIER_HP_SCALE = 50;

const STUCK_TIME = 0.8;
const REPATH_COOLDOWN = 0.5;

/** A* step cost for ground enemies. Water and rock are impassable; the core is the destination. */
export function groundEnterCost(world: World, idx: number): number {
  const t = world.terrain[idx];
  if (t === Terrain.Water || t === Terrain.Rock) return Infinity;
  const id = world.occupancy[idx] ?? 0;
  if (id !== 0) {
    const b = world.buildings.get(id);
    if (b && b.kind !== 'core' && BUILDINGS[b.kind].solid) return BARRIER_BASE + b.hp / BARRIER_HP_SCALE;
  }
  return 1;
}

export function createGroundGrid(world: World): PathGrid {
  return { width: world.width, height: world.height, cost: (i: number) => groundEnterCost(world, i) };
}

/** Can a ground body stand on this world position? (terrain + solid buildings) */
export function groundBlockedAt(world: World, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) return true;
  const idx = ty * world.width + tx;
  const t = world.terrain[idx];
  if (t === Terrain.Water || t === Terrain.Rock) return true;
  const b = buildingAt(world, tx, ty);
  return b !== undefined && BUILDINGS[b.kind].solid;
}

export function coreGoalTile(world: World): number {
  const core = world.buildings.get(world.coreId);
  if (!core) return Math.floor(world.height / 2) * world.width + Math.floor(world.width / 2);
  const c = Math.floor(core.size / 2);
  return (core.y + c) * world.width + (core.x + c);
}

/** Wall-breaker bombers aim for the closest reachable wall; everyone else aims for the core. */
export function chooseGoal(world: World, e: Enemy): number {
  if (e.type === 'bomber') {
    let best = -1;
    let bestD = Infinity;
    for (const b of world.buildings.values()) {
      if (!isWallKind(b.kind)) continue;
      const idx = b.y * world.width + b.x;
      if (world.terrain[idx] !== Terrain.Plain) continue;
      const d = (b.x + 0.5 - e.x) ** 2 + (b.y + 0.5 - e.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = idx;
      }
    }
    if (best >= 0) return best;
  }
  return coreGoalTile(world);
}

/** Rebuilds the per-tick enemy spatial index (quadtree + id map). */
export function rebuildEnemyIndex(world: World): void {
  world.enemyTree.clear();
  world.enemyById.clear();
  for (const e of world.enemies) {
    if (e.dead) continue;
    world.enemyById.set(e.id, e);
    world.enemyTree.insert(e.id, e.x, e.y);
  }
}

/** Distance from the enemy's center to the nearest edge of a building footprint. */
export function distToBuilding(e: Enemy, b: Building): number {
  return distToRect(e.x, e.y, b.x, b.y, b.size, b.size);
}

/** Closest building within `radius` that passes `accept`. */
function nearestBuilding(world: World, e: Enemy, radius: number, accept: (b: Building) => boolean): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  const r = Math.ceil(radius) + 1;
  const ex = Math.floor(e.x);
  const ey = Math.floor(e.y);
  const seen = scratchSeen;
  seen.clear();
  for (let y = ey - r; y <= ey + r; y++) {
    for (let x = ex - r; x <= ex + r; x++) {
      const b = buildingAt(world, x, y);
      if (!b || seen.has(b.id)) continue;
      seen.add(b.id);
      if (!accept(b)) continue;
      const d = distToBuilding(e, b);
      if (d <= radius && d < bestD) {
        bestD = d;
        best = b;
      }
    }
  }
  return best;
}

const scratchSeen = new Set<number>();
const scratchIds: number[] = [];
const sep = { x: 0, y: 0 };

function isSolid(b: Building): boolean {
  return BUILDINGS[b.kind].solid;
}

/** Soft push away from overlapping neighbours so a horde spreads out instead of stacking. */
function separation(world: World, e: Enemy, out: { x: number; y: number }): void {
  out.x = 0;
  out.y = 0;
  const ids = world.enemyTree.queryCircle(e.x, e.y, e.radius + 1.3, scratchIds);
  const flying = ENEMIES[e.type].flying;
  for (const id of ids) {
    if (id === e.id) continue;
    const o = world.enemyById.get(id);
    if (!o || ENEMIES[o.type].flying !== flying) continue;
    const dx = e.x - o.x;
    const dy = e.y - o.y;
    const d2 = dx * dx + dy * dy;
    const min = e.radius + o.radius;
    if (d2 > 1e-6 && d2 < min * min) {
      const d = Math.sqrt(d2);
      const push = (min - d) / min;
      out.x += (dx / d) * push;
      out.y += (dy / d) * push;
    }
  }
}

/** Moves with axis-separated collision so ground units slide along walls and never cross water/rock. */
function moveGround(world: World, e: Enemy, vx: number, vy: number, dt: number): void {
  const probe = e.radius * 0.6;
  const nx = e.x + vx * dt;
  if (!groundBlockedAt(world, nx + Math.sign(vx) * probe, e.y)) e.x = nx;
  const ny = e.y + vy * dt;
  if (!groundBlockedAt(world, e.x, ny + Math.sign(vy) * probe)) e.y = ny;
  e.vx = vx;
  e.vy = vy;
  if (vx !== 0 || vy !== 0) e.angle = Math.atan2(vy, vx);
}

function meleeHit(world: World, e: Enemy, b: Building, dt: number): void {
  const def = ENEMIES[e.type];
  e.attackTimer -= dt;
  e.anim += dt * 5;
  e.vx = 0;
  e.vy = 0;
  e.angle = Math.atan2(b.y + b.size / 2 - e.y, b.x + b.size / 2 - e.x);
  if (e.attackTimer > 0) return;
  e.attackTimer = def.attackInterval;
  damageBuilding(world, b, def.damage);
  if (world.visuals) {
    const cx = clamp(e.x, b.x, b.x + b.size);
    const cy = clamp(e.y, b.y, b.y + b.size);
    world.particles.spawn('spark', cx, cy, (world.rng.next() - 0.5) * 3, (world.rng.next() - 0.5) * 3, 0.2, 0.12, def.color);
  }
}

/** Suicide blast: heavy damage to every building in radius, then the bomber is gone. */
export function bomberExplode(world: World, e: Enemy): void {
  const def = ENEMIES[e.type];
  const r = 2.2;
  const seen = new Set<number>();
  for (let y = Math.floor(e.y - r) - 1; y <= Math.ceil(e.y + r); y++) {
    for (let x = Math.floor(e.x - r) - 1; x <= Math.ceil(e.x + r); x++) {
      const b = buildingAt(world, x, y);
      if (!b || seen.has(b.id)) continue;
      seen.add(b.id);
      const d = distToBuilding(e, b);
      if (d <= r) damageBuilding(world, b, def.damage * (1 - (d / r) * 0.6));
    }
  }
  if (world.visuals) {
    world.particles.spawn('flash', e.x, e.y, 0, 0, 0.35, r, '#ef4444');
    world.particles.spawn('ring', e.x, e.y, 0, 0, 0.4, r, '#fca5a5');
    for (let i = 0; i < 22; i++) {
      const a = world.rng.range(0, Math.PI * 2);
      const sp = world.rng.range(2, 7);
      world.particles.spawn('spark', e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, world.rng.range(0.2, 0.5), 0.14, '#fca5a5');
    }
  }
  pushEvent(world, { type: 'sound', sound: 'explosion', x: e.x, y: e.y });
  pushEvent(world, { type: 'shake', strength: 0.5 });
  e.hp = 0;
  e.dead = true;
  world.kills++;
}

function updateHealer(world: World, e: Enemy, dt: number): void {
  e.abilityTimer -= dt;
  if (e.abilityTimer > 0) return;
  e.abilityTimer = 1.5;
  const ids = world.enemyTree.queryCircle(e.x, e.y, ENEMIES[e.type].range, scratchIds);
  for (const id of ids) {
    const o = world.enemyById.get(id);
    if (!o || o.dead || o.id === e.id || o.hp >= o.maxHp) continue;
    o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.08);
    if (world.visuals) world.particles.spawn('heal', o.x, o.y - 0.3, 0, -1.2, 0.5, 0.14, '#f472b6');
  }
}

/** Leviathan: periodic shockwave that hits every building near it. */
function updateBossAbility(world: World, e: Enemy, dt: number): void {
  e.abilityTimer -= dt;
  if (e.abilityTimer > 0) return;
  e.abilityTimer = 4;
  const r = 3.5;
  let hit = false;
  const seen = new Set<number>();
  for (let y = Math.floor(e.y - r) - 1; y <= Math.ceil(e.y + r); y++) {
    for (let x = Math.floor(e.x - r) - 1; x <= Math.ceil(e.x + r); x++) {
      const b = buildingAt(world, x, y);
      if (!b || seen.has(b.id)) continue;
      seen.add(b.id);
      if (distToBuilding(e, b) <= r) {
        damageBuilding(world, b, ENEMIES.leviathan.damage);
        hit = true;
      }
    }
  }
  if (hit && world.visuals) {
    world.particles.spawn('ring', e.x, e.y, 0, 0, 0.6, r, '#be123c');
    pushEvent(world, { type: 'shake', strength: 0.7 });
  }
}

/**
 * Keeps an A* path to the goal. Paths are requested through the shared PathService, which caches
 * them per map version and caps searches per tick; when the budget is spent the enemy keeps
 * following its stale path and asks again next tick.
 */
function ensurePath(world: World, e: Enemy, grid: PathGrid, dt: number): void {
  e.repathTimer -= dt;
  const stale = e.path === null || e.pathVersion !== world.mapVersion;
  if (!stale || e.repathTimer > 0) return;
  const tx = clamp(Math.floor(e.x), 0, world.width - 1);
  const ty = clamp(Math.floor(e.y), 0, world.height - 1);
  const goal = chooseGoal(world, e);
  const path = world.paths.request(grid, ty * world.width + tx, goal);
  if (path === undefined) return;
  e.goal = goal;
  e.path = path;
  e.pathIdx = path && path.length > 1 ? 1 : 0;
  e.pathVersion = world.mapVersion;
  e.repathTimer = REPATH_COOLDOWN;
}

/** Next waypoint (tile center) along the path, skipping ones already reached. */
function nextWaypoint(world: World, e: Enemy, out: { x: number; y: number }): boolean {
  const path = e.path;
  if (!path) return false;
  while (e.pathIdx < path.length) {
    const idx = path[e.pathIdx] ?? 0;
    const px = (idx % world.width) + 0.5;
    const py = Math.floor(idx / world.width) + 0.5;
    if (Math.hypot(px - e.x, py - e.y) < 0.4 && e.pathIdx < path.length - 1) {
      e.pathIdx++;
      continue;
    }
    out.x = px;
    out.y = py;
    return true;
  }
  return false;
}

/** The solid building occupying the next few path tiles, if any (the thing in the way). */
function pathBlocker(world: World, e: Enemy): Building | null {
  const path = e.path;
  if (!path) return null;
  for (let k = e.pathIdx; k < Math.min(path.length, e.pathIdx + 3); k++) {
    const id = world.occupancy[path[k] ?? 0] ?? 0;
    const b = id ? world.buildings.get(id) : undefined;
    if (b && isSolid(b)) return b;
  }
  return null;
}

const waypoint = { x: 0, y: 0 };
const stuckTimers = new WeakMap<Enemy, { x: number; y: number; t: number }>();

function updateStuck(e: Enemy, dt: number): boolean {
  let s = stuckTimers.get(e);
  if (!s) {
    s = { x: e.x, y: e.y, t: 0 };
    stuckTimers.set(e, s);
  }
  if (Math.hypot(e.x - s.x, e.y - s.y) > 0.25) {
    s.x = e.x;
    s.y = e.y;
    s.t = 0;
    return false;
  }
  s.t += dt;
  return s.t > STUCK_TIME;
}

function updateFlyer(world: World, e: Enemy, dt: number, speed: number): void {
  const target = nearestBuilding(world, e, e.radius + 0.4, () => true);
  if (target) {
    meleeHit(world, e, target, dt);
    return;
  }
  // Home on the nearest turret within 12 tiles (they shoot flyers down), otherwise the core.
  const turret = nearestBuilding(world, e, 12, (b) => isTurretKind(b.kind));
  const goal = turret ? { x: turret.x + turret.size / 2, y: turret.y + turret.size / 2 } : coreCenter(world);
  separation(world, e, sep);
  const dx = goal.x - e.x;
  const dy = goal.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.vx = (dx / d + sep.x * 0.6) * speed;
  e.vy = (dy / d + sep.y * 0.6) * speed;
  e.x = clamp(e.x + e.vx * dt, 0.1, world.width - 0.1);
  e.y = clamp(e.y + e.vy * dt, 0.1, world.height - 0.1);
  e.angle = Math.atan2(e.vy, e.vx);
  e.anim += dt * 8;
}

export function updateEnemy(world: World, e: Enemy, grid: PathGrid, dt: number): void {
  if (e.dead) return;
  const def = ENEMIES[e.type];
  if (e.slowTimer > 0) {
    e.slowTimer -= dt;
    if (e.slowTimer <= 0) e.slowFactor = 1;
  }
  if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
  const speed = def.speed * e.slowFactor;

  if (e.type === 'healer') updateHealer(world, e, dt);
  if (e.type === 'leviathan') updateBossAbility(world, e, dt);

  if (def.flying) {
    updateFlyer(world, e, dt, speed);
    return;
  }

  if (def.behavior === 'bomber' && nearestBuilding(world, e, e.radius + 0.35, isSolid)) {
    bomberExplode(world, e);
    return;
  }

  // Ranged units stop at range and lob acid at the closest structure (turrets and walls first).
  if (def.behavior === 'ranged' || def.behavior === 'boss') {
    const target =
      nearestBuilding(world, e, def.range, (b) => isTurretKind(b.kind) || isWallKind(b.kind)) ??
      nearestBuilding(world, e, def.range, () => true);
    if (target) {
      e.attackTimer -= dt;
      e.vx = 0;
      e.vy = 0;
      e.angle = Math.atan2(target.y + target.size / 2 - e.y, target.x + target.size / 2 - e.x);
      if (e.attackTimer <= 0) {
        e.attackTimer = def.attackInterval;
        fireAcid(world, e, target, def.damage, e.type === 'leviathan' ? 1.6 : 0);
      }
      separation(world, e, sep);
      moveGround(world, e, sep.x * speed, sep.y * speed, dt);
      e.vx = 0;
      e.vy = 0;
      return;
    }
  }

  ensurePath(world, e, grid, dt);

  // Melee: hit whatever blocks the path, the core, turrets in reach, or anything when stuck.
  const reach = e.radius + 0.45;
  const stuck = updateStuck(e, dt);
  const blocker = pathBlocker(world, e);
  let target: Building | null = null;
  if (blocker && distToBuilding(e, blocker) <= reach) target = blocker;
  if (!target) target = nearestBuilding(world, e, reach, (b) => b.kind === 'core' || isTurretKind(b.kind));
  if (!target && stuck) target = nearestBuilding(world, e, reach + 0.4, isSolid);
  if (target) {
    meleeHit(world, e, target, dt);
    return;
  }

  separation(world, e, sep);
  let gx: number;
  let gy: number;
  if (nextWaypoint(world, e, waypoint)) {
    gx = waypoint.x;
    gy = waypoint.y;
  } else {
    const core = coreCenter(world);
    gx = core.x;
    gy = core.y;
  }
  const dx = gx - e.x;
  const dy = gy - e.y;
  const d = Math.hypot(dx, dy) || 1;
  moveGround(world, e, (dx / d + sep.x * 0.7) * speed, (dy / d + sep.y * 0.7) * speed, dt);
  if (stuck) e.pathVersion = -1;
  e.anim += dt * speed * 1.5;
  e.x = clamp(e.x, 0.05, world.width - 0.05);
  e.y = clamp(e.y, 0.05, world.height - 0.05);
}

export function updateEnemies(world: World, dt: number): void {
  world.paths.beginTick(world.mapVersion, PATH_BUDGET_PER_TICK);
  const grid = createGroundGrid(world);
  for (const e of world.enemies) updateEnemy(world, e, grid, dt);
  // Remove the dead after everyone moved so indices stay valid during the loop.
  if (world.enemies.some((e) => e.dead)) world.enemies = world.enemies.filter((e) => !e.dead);
}
