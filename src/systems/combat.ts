import type { Building } from '../entities/Building';
import { buildingCenter } from '../entities/Building';
import { createEnemy, type Enemy } from '../entities/Enemy';
import type { Projectile } from '../entities/Projectile';
import { BUILDINGS } from '../data/buildings';
import { MAX_ENEMIES } from '../data/constants';
import { armoredDamage, ENEMIES } from '../data/enemies';
import { SLOW_DURATION, SLOW_FACTOR, TURRETS, ammoFor, type TurretDef } from '../data/turrets';
import { buildingAt, playSound, pushEvent } from '../core/grid';
import { angleDiff, clamp, distSq, distToRect, segmentDistSq } from '../utils/math';
import type { World } from '../core/World';
import { removeBuilding } from './placement';

const scratch: number[] = [];
/** Powered turrets draw this share of their rating while they have nothing to do. */
const IDLE_POWER = 0.1;
const ACID_SPEED = 7;
const BROOD_SPLIT = 3;

export function damageEnemy(world: World, e: Enemy, dmg: number, pierce = 0): void {
  if (e.dead) return;
  e.hp -= armoredDamage(dmg, ENEMIES[e.type].armor, pierce);
  e.hitFlash = 0.12;
  if (e.hp <= 0) killEnemy(world, e);
}

export function killEnemy(world: World, e: Enemy): void {
  if (e.dead) return;
  e.dead = true;
  world.kills++;
  pushEvent(world, { type: 'enemyKilled', enemy: e.type, x: e.x, y: e.y });
  if (e.type === 'brood') {
    // The brood splits into rushers when it dies.
    for (let i = 0; i < BROOD_SPLIT && world.enemies.length < MAX_ENEMIES; i++) {
      const a = (i / BROOD_SPLIT) * Math.PI * 2;
      world.enemies.push(createEnemy(world.nextEnemyId++, 'rusher', e.x + Math.cos(a) * 0.4, e.y + Math.sin(a) * 0.4));
    }
  }
  if (world.visuals) {
    const def = ENEMIES[e.type];
    const boss = e.type === 'leviathan';
    for (let i = 0; i < (boss ? 40 : 8); i++) {
      const a = world.rng.range(0, Math.PI * 2);
      const sp = world.rng.range(1, 5) * (boss ? 2 : 1);
      world.particles.spawn('debris', e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, world.rng.range(0.3, 0.7), def.radius * 0.5, def.color);
    }
    world.particles.spawn('ring', e.x, e.y, 0, 0, 0.3, e.radius * 1.5, def.color);
    if (boss) pushEvent(world, { type: 'shake', strength: 1 });
  }
  playSound(world, 'enemyDie', e.x, e.y);
}

export function damageBuilding(world: World, b: Building, dmg: number): void {
  if (dmg <= 0 || b.hp <= 0) return;
  b.hp -= dmg;
  b.hitFlash = 0.1;
  if (b.hp > 0) return;
  if (world.visuals) {
    const c = buildingCenter(b);
    for (let i = 0; i < 14; i++) {
      const a = world.rng.range(0, Math.PI * 2);
      const sp = world.rng.range(1, 6);
      world.particles.spawn('debris', c.x, c.y, Math.cos(a) * sp, Math.sin(a) * sp, world.rng.range(0.3, 0.8), 0.18, BUILDINGS[b.kind].color);
    }
    world.particles.spawn('flash', c.x, c.y, 0, 0, 0.25, b.size * 0.8, '#f97316');
    world.particles.spawn('smoke', c.x, c.y, 0, -0.4, 1.2, b.size * 0.4, '#44403c');
  }
  playSound(world, 'explosion', b.x + b.size / 2, b.y + b.size / 2);
  if (b.kind === 'core') {
    b.hp = 0;
    if (world.state === 'playing') {
      world.state = 'defeat';
      pushEvent(world, { type: 'defeat' });
      playSound(world, 'defeat', b.x + b.size / 2, b.y + b.size / 2);
    }
    return;
  }
  removeBuilding(world, b.id, { refund: false, silent: true });
  pushEvent(world, { type: 'destroyed', kind: b.kind, x: b.x, y: b.y });
}

export function healBuilding(b: Building, amount: number): void {
  if (b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + amount);
}

export function applySlow(e: Enemy, factor = SLOW_FACTOR, duration = SLOW_DURATION): void {
  e.slowFactor = Math.min(e.slowFactor, factor);
  e.slowTimer = Math.max(e.slowTimer, duration);
}

/** Nearest enemy within [minRange, range] the turret may hit (air/ground filter). The boss is favoured. */
export function acquireTarget(world: World, b: Building, def: TurretDef): Enemy | null {
  const c = buildingCenter(b);
  const ids = world.enemyTree.queryCircle(c.x, c.y, def.range, scratch);
  let best: Enemy | null = null;
  let bestScore = Infinity;
  const minSq = def.minRange * def.minRange;
  for (const id of ids) {
    const e = world.enemyById.get(id);
    if (!e || e.dead) continue;
    const flying = ENEMIES[e.type].flying;
    if (flying ? !def.targetsAir : !def.targetsGround) continue;
    const d2 = distSq(c.x, c.y, e.x, e.y);
    if (d2 < minSq) continue;
    const score = d2 * (e.type === 'leviathan' ? 0.6 : 1);
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

/** Turns the turret toward a point; returns true once roughly aligned. */
function rotateToward(b: Building, tx: number, ty: number, turnSpeed: number, dt: number): boolean {
  const t = b.turret;
  if (!t) return false;
  const c = buildingCenter(b);
  const desired = Math.atan2(ty - c.y, tx - c.x);
  const diff = angleDiff(t.angle, desired);
  const step = turnSpeed * dt;
  if (turnSpeed <= 0 || Math.abs(diff) <= step) {
    t.angle = desired;
    return true;
  }
  t.angle += Math.sign(diff) * step;
  return Math.abs(diff) < 0.12;
}

function muzzle(world: World, b: Building): void {
  if (!world.visuals || !b.turret) return;
  const c = buildingCenter(b);
  const r = b.size * 0.55;
  world.particles.spawn('flash', c.x + Math.cos(b.turret.angle) * r, c.y + Math.sin(b.turret.angle) * r, 0, 0, 0.07, 0.3, '#fde68a');
}

function fireBullet(world: World, b: Building, def: TurretDef, damageMul: number, pierce: number): void {
  const t = b.turret;
  if (!t) return;
  const c = buildingCenter(b);
  const pellets = def.weapon === 'pellet' ? def.pellets : 1;
  for (let i = 0; i < pellets; i++) {
    const p = world.projectiles.acquire();
    const ang = t.angle + (world.rng.next() - 0.5) * def.spread;
    p.kind = def.weapon === 'pellet' ? 'pellet' : 'bullet';
    p.x = p.px = p.sx = c.x;
    p.y = p.py = p.sy = c.y;
    p.vx = Math.cos(ang) * def.projectileSpeed;
    p.vy = Math.sin(ang) * def.projectileSpeed;
    p.life = def.range / def.projectileSpeed + 0.05;
    p.totalLife = p.life;
    p.damage = def.damage * damageMul * world.modifiers.ammoDamage;
    p.pierce = pierce;
    p.lastHit = 0;
    p.aoe = 0;
    p.hitsAir = def.targetsAir;
    p.hitsGround = def.targetsGround;
  }
  muzzle(world, b);
}

function fireShell(world: World, b: Building, def: TurretDef, target: Enemy, pierce: number): void {
  const c = buildingCenter(b);
  const p = world.projectiles.acquire();
  const travel = Math.hypot(target.x - c.x, target.y - c.y) / def.projectileSpeed;
  p.kind = 'shell';
  p.x = p.px = p.sx = c.x;
  p.y = p.py = p.sy = c.y;
  // Lead the target by half its current velocity over the flight time.
  p.tx = target.x + target.vx * travel * 0.5;
  p.ty = target.y + target.vy * travel * 0.5;
  p.vx = 0;
  p.vy = 0;
  p.life = travel;
  p.totalLife = travel;
  p.damage = def.damage * world.modifiers.ammoDamage;
  p.pierce = pierce;
  p.aoe = def.aoe;
  p.hitsAir = def.targetsAir;
  p.hitsGround = def.targetsGround;
  muzzle(world, b);
}

/** Ranged enemies lob an acid glob that lands on the target building after a short flight. */
export function fireAcid(world: World, e: Enemy, target: Building, damage: number, splash: number): void {
  const p = world.projectiles.acquire();
  const tx = target.x + target.size / 2;
  const ty = target.y + target.size / 2;
  const travel = Math.max(0.15, Math.hypot(tx - e.x, ty - e.y) / ACID_SPEED);
  p.kind = 'acid';
  p.x = p.px = p.sx = e.x;
  p.y = p.py = p.sy = e.y;
  p.tx = tx;
  p.ty = ty;
  p.vx = 0;
  p.vy = 0;
  p.life = travel;
  p.totalLife = travel;
  p.damage = damage;
  p.pierce = 0;
  p.aoe = splash;
  p.hitsAir = false;
  p.hitsGround = false;
  playSound(world, 'acid', e.x, e.y);
}

/** Ammo turrets fire only while loaded: each shot spends one round delivered by belt or inserter. */
function updateAmmoTurret(world: World, b: Building, def: TurretDef, dt: number): void {
  const t = b.turret;
  if (!t) return;
  t.cooldown -= dt;
  const target = acquireTarget(world, b, def);
  t.target = target?.id ?? 0;
  if (!target) return;
  const aligned = rotateToward(b, target.x, target.y, def.turnSpeed, dt);
  if ((t.ammo <= 0 && !def.infiniteAmmo) || !aligned || t.cooldown > 0) return;
  const ammoDef = t.ammoItem ? ammoFor(b.kind, t.ammoItem) : undefined;
  if (def.weapon === 'shell') fireShell(world, b, def, target, ammoDef?.pierce ?? 0);
  else fireBullet(world, b, def, ammoDef?.damageMul ?? 1, ammoDef?.pierce ?? 0);
  if (!def.infiniteAmmo) {
    t.ammo--;
    if (t.ammo <= 0) t.ammoItem = null;
  }
  t.cooldown = def.fireInterval;
  t.flash = 1;
  b.active = true;
  playSound(world, def.weapon === 'shell' ? 'cannon' : def.weapon === 'pellet' ? 'shotgun' : 'mg', b.x, b.y);
}

/** Laser: continuous beam powered from the grid; damage scales with power satisfaction. */
function updateBeamTurret(world: World, b: Building, def: TurretDef, dt: number): void {
  const t = b.turret;
  if (!t) return;
  const target = acquireTarget(world, b, def);
  t.target = target?.id ?? 0;
  b.demand = (BUILDINGS[b.kind].power?.use ?? 0) * (target ? 1 : IDLE_POWER);
  if (!target || b.satisfaction <= 0) return;
  rotateToward(b, target.x, target.y, def.turnSpeed, dt);
  damageEnemy(world, target, def.damage * world.modifiers.laserDamage * b.satisfaction * dt, 999);
  t.beamX = target.x;
  t.beamY = target.y;
  t.flash = 1;
  b.active = true;
  if (world.tick % 8 === 0) playSound(world, 'laser', b.x, b.y);
  if (world.visuals && world.tick % 3 === 0) {
    world.particles.spawn('spark', target.x, target.y, (world.rng.next() - 0.5) * 3, (world.rng.next() - 0.5) * 3, 0.2, 0.1, '#fb7185');
  }
}

/** Slow turret: periodic cold pulse that slows and lightly damages everything in range. */
function updateSlowTurret(world: World, b: Building, def: TurretDef, dt: number): void {
  const t = b.turret;
  if (!t) return;
  const c = buildingCenter(b);
  const ids = world.enemyTree.queryCircle(c.x, c.y, def.range, scratch);
  b.demand = (BUILDINGS[b.kind].power?.use ?? 0) * (ids.length > 0 ? 1 : IDLE_POWER);
  t.cooldown -= dt;
  if (b.satisfaction <= 0 || t.cooldown > 0 || ids.length === 0) return;
  for (const id of ids) {
    const e = world.enemyById.get(id);
    if (!e || e.dead) continue;
    applySlow(e);
    damageEnemy(world, e, def.damage * b.satisfaction, 0);
  }
  t.cooldown = def.fireInterval;
  t.flash = 1;
  b.active = true;
  playSound(world, 'slow', b.x, b.y);
  if (world.visuals) world.particles.spawn('ring', c.x, c.y, 0, 0, 0.45, def.range, '#38bdf8');
}

/** Repair turret: heals the most damaged building in range. */
function updateRepairTurret(world: World, b: Building, def: TurretDef, dt: number): void {
  const t = b.turret;
  if (!t) return;
  const c = buildingCenter(b);
  let best: Building | null = null;
  let worst = 1;
  for (const other of world.buildings.values()) {
    if (other.id === b.id || other.hp >= other.maxHp) continue;
    if (distToRect(c.x, c.y, other.x, other.y, other.size, other.size) > def.range) continue;
    const ratio = other.hp / other.maxHp;
    if (ratio < worst) {
      worst = ratio;
      best = other;
    }
  }
  b.demand = (BUILDINGS[b.kind].power?.use ?? 0) * (best ? 1 : IDLE_POWER);
  if (!best || b.satisfaction <= 0) return;
  healBuilding(best, def.damage * b.satisfaction * dt);
  t.beamX = best.x + best.size / 2;
  t.beamY = best.y + best.size / 2;
  t.flash = 1;
  b.active = true;
  if (world.tick % 20 === 0) playSound(world, 'repair', b.x, b.y);
  if (world.visuals && world.tick % 10 === 0) world.particles.spawn('heal', t.beamX, t.beamY, 0, -1, 0.5, 0.2, '#4ade80');
}

export function updateTurret(world: World, b: Building, dt: number): void {
  const def = TURRETS[b.kind];
  const t = b.turret;
  if (!def || !t) return;
  b.active = false;
  t.flash = Math.max(0, t.flash - dt * 5);
  if (def.weapon === 'beam') updateBeamTurret(world, b, def, dt);
  else if (def.weapon === 'pulse') updateSlowTurret(world, b, def, dt);
  else if (def.weapon === 'repair') updateRepairTurret(world, b, def, dt);
  else updateAmmoTurret(world, b, def, dt);
}

function explode(world: World, p: Projectile): void {
  const ids = world.enemyTree.queryCircle(p.x, p.y, p.aoe, scratch);
  for (const id of ids) {
    const e = world.enemyById.get(id);
    if (!e || e.dead) continue;
    if (ENEMIES[e.type].flying ? !p.hitsAir : !p.hitsGround) continue;
    const falloff = 1 - clamp(Math.hypot(e.x - p.x, e.y - p.y) / p.aoe, 0, 1) * 0.6;
    damageEnemy(world, e, p.damage * falloff, p.pierce);
  }
  if (world.visuals) {
    world.particles.spawn('flash', p.x, p.y, 0, 0, 0.3, p.aoe, '#fb923c');
    world.particles.spawn('ring', p.x, p.y, 0, 0, 0.35, p.aoe, '#fdba74');
    for (let i = 0; i < 16; i++) {
      const a = world.rng.range(0, Math.PI * 2);
      const sp = world.rng.range(1, 6);
      world.particles.spawn('spark', p.x, p.y, Math.cos(a) * sp, Math.sin(a) * sp, world.rng.range(0.2, 0.5), 0.12, i % 2 ? '#fbbf24' : '#f87171');
    }
    world.particles.spawn('smoke', p.x, p.y, 0, -0.5, 0.9, p.aoe * 0.5, '#44403c');
  }
  pushEvent(world, { type: 'shake', strength: 0.35 });
  playSound(world, 'explosion', p.x, p.y);
}

function acidImpact(world: World, p: Projectile): void {
  if (p.aoe > 0) {
    const seen = new Set<number>();
    for (let y = Math.floor(p.ty - p.aoe); y <= Math.ceil(p.ty + p.aoe); y++) {
      for (let x = Math.floor(p.tx - p.aoe); x <= Math.ceil(p.tx + p.aoe); x++) {
        const b = buildingAt(world, x, y);
        if (!b || seen.has(b.id)) continue;
        seen.add(b.id);
        if (distToRect(p.tx, p.ty, b.x, b.y, b.size, b.size) <= p.aoe) damageBuilding(world, b, p.damage);
      }
    }
  } else {
    const b = buildingAt(world, Math.floor(p.tx), Math.floor(p.ty));
    if (b) damageBuilding(world, b, p.damage);
  }
  if (world.visuals) {
    for (let i = 0; i < 6; i++) {
      const a = world.rng.range(0, Math.PI * 2);
      world.particles.spawn('acid', p.tx, p.ty, Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0.4, 0.12, '#a3e635');
    }
  }
}

/** Moves projectiles and resolves hits: bullets pierce along their line, shells and acid land after an arc. */
export function updateProjectiles(world: World, dt: number): void {
  for (const p of world.projectiles.items) {
    if (!p.active) continue;
    p.px = p.x;
    p.py = p.y;
    p.life -= dt;
    if (p.kind === 'shell' || p.kind === 'acid') {
      const t = p.totalLife > 0 ? clamp(1 - p.life / p.totalLife, 0, 1) : 1;
      p.x = p.sx + (p.tx - p.sx) * t;
      p.y = p.sy + (p.ty - p.sy) * t;
      if (p.life <= 0) {
        p.active = false;
        if (p.kind === 'shell') explode(world, p);
        else acidImpact(world, p);
      }
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }
    // Swept test over this tick's segment: fast rounds would otherwise skip past small enemies.
    const mx = (p.px + p.x) / 2;
    const my = (p.py + p.y) / 2;
    const half = Math.hypot(p.x - p.px, p.y - p.py) / 2;
    const ids = world.enemyTree.queryCircle(mx, my, half + 1.4, scratch);
    for (const id of ids) {
      const e = world.enemyById.get(id);
      if (!e || e.dead || e.id === p.lastHit) continue;
      if (ENEMIES[e.type].flying ? !p.hitsAir : !p.hitsGround) continue;
      const r = e.radius + 0.15;
      if (segmentDistSq(p.px, p.py, p.x, p.y, e.x, e.y) > r * r) continue;
      p.lastHit = e.id;
      damageEnemy(world, e, p.damage, p.pierce);
      if (world.visuals) world.particles.spawn('spark', p.x, p.y, -p.vx * 0.05, -p.vy * 0.05, 0.12, 0.1, '#fde68a');
      if (p.pierce > 0) {
        p.pierce--;
        p.damage *= 0.8;
      } else {
        p.active = false;
        break;
      }
    }
  }
}
