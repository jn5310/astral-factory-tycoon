import { ABILITIES, ABILITY_IDS, REPAIR_FRACTION, type AbilityId } from '../data/abilities';
import { playSound, pushEvent, toast } from '../core/grid';
import type { TileXY } from '../core/types';
import type { World } from '../core/World';
import { msg } from '../utils/i18n';
import { damageEnemy, healBuilding } from './combat';

export interface Strike {
  x: number;
  y: number;
  /** Seconds until impact. */
  t: number;
}

export interface AbilityState {
  unlocked: AbilityId[];
  cooldown: Record<AbilityId, number>;
  /** Seconds of Overclock left. */
  overclock: number;
  strikes: Strike[];
  /** Powers used at least once this run (achievement). */
  used: AbilityId[];
}

export function createAbilityState(allUnlocked: boolean): AbilityState {
  return {
    unlocked: allUnlocked ? [...ABILITY_IDS] : [],
    cooldown: { orbital: 0, repair: 0, overclock: 0, cryo: 0 },
    overclock: 0,
    strikes: [],
    used: [],
  };
}

export function isAbilityUnlocked(world: World, id: AbilityId): boolean {
  return world.abilities.unlocked.includes(id);
}

/** Returns true when the power was newly unlocked. */
export function unlockAbility(world: World, id: AbilityId): boolean {
  if (isAbilityUnlocked(world, id)) return false;
  world.abilities.unlocked.push(id);
  return true;
}

export function canUseAbility(world: World, id: AbilityId): boolean {
  return world.state === 'playing' && isAbilityUnlocked(world, id) && world.abilities.cooldown[id] <= 0;
}

function strikeImpact(world: World, s: Strike): void {
  const def = ABILITIES.orbital;
  const ids = world.enemyTree.queryCircle(s.x, s.y, def.radius, []);
  for (const id of ids) {
    const e = world.enemyById.get(id);
    if (!e || e.dead) continue;
    const d = Math.hypot(e.x - s.x, e.y - s.y);
    // Full damage at the center, half at the rim; armor is ignored (pierce 99).
    damageEnemy(world, e, def.damage * (1 - 0.5 * Math.min(1, d / def.radius)), 99);
  }
  if (world.visuals) {
    world.particles.spawn('flash', s.x, s.y, 0, 0, 0.5, def.radius * 1.4, '#fb923c');
    world.particles.spawn('ring', s.x, s.y, 0, 0, 0.6, def.radius, '#fde68a');
    for (let i = 0; i < 40; i++) {
      const a = world.rng.range(0, Math.PI * 2);
      const sp = world.rng.range(2, 10);
      world.particles.spawn('spark', s.x, s.y, Math.cos(a) * sp, Math.sin(a) * sp, world.rng.range(0.3, 0.8), 0.16, i % 3 ? '#fdba74' : '#fef3c7');
    }
    world.particles.spawn('smoke', s.x, s.y, 0, -0.6, 1.4, def.radius * 0.6, '#44403c');
  }
  pushEvent(world, { type: 'shake', strength: 1 });
  playSound(world, 'explosion', s.x, s.y);
}

/** Uses a commander power. Targeted powers need `target`. Returns false if it is locked or recharging. */
export function activateAbility(world: World, id: AbilityId, target?: TileXY): boolean {
  if (!canUseAbility(world, id)) return false;
  const def = ABILITIES[id];
  const a = world.abilities;
  switch (id) {
    case 'orbital':
      if (!target) return false;
      a.strikes.push({ x: target.x, y: target.y, t: def.duration });
      toast(world, msg().toast.orbitalFired, 'info');
      playSound(world, 'orbital', target.x, target.y);
      break;
    case 'repair': {
      let healed = 0;
      for (const b of world.buildings.values()) {
        if (b.hp >= b.maxHp) continue;
        healBuilding(b, b.maxHp * REPAIR_FRACTION);
        healed++;
        if (world.visuals && healed <= 60) world.particles.spawn('heal', b.x + b.size / 2, b.y + b.size / 2, 0, -1.4, 0.8, 0.3, '#4ade80');
      }
      toast(world, msg().toast.repairDone(healed), 'success');
      playSound(world, 'repair', world.width / 2, world.height / 2);
      pushEvent(world, { type: 'screenFlash', color: '#4ade80' });
      break;
    }
    case 'overclock':
      a.overclock = def.duration;
      toast(world, msg().toast.overclockOn, 'success');
      playSound(world, 'overclock', world.width / 2, world.height / 2);
      pushEvent(world, { type: 'screenFlash', color: '#facc15' });
      break;
    case 'cryo': {
      let frozen = 0;
      for (const e of world.enemies) {
        if (e.dead) continue;
        e.slowFactor = 0;
        e.slowTimer = Math.max(e.slowTimer, def.duration);
        damageEnemy(world, e, def.damage, 99);
        frozen++;
        if (world.visuals && frozen <= 80) world.particles.spawn('ring', e.x, e.y, 0, 0, 0.5, e.radius * 2, '#bae6fd');
      }
      toast(world, msg().toast.cryoOn(frozen), 'success');
      playSound(world, 'freeze', world.width / 2, world.height / 2);
      pushEvent(world, { type: 'screenFlash', color: '#38bdf8' });
      break;
    }
  }
  a.cooldown[id] = def.cooldown;
  if (!a.used.includes(id)) a.used.push(id);
  return true;
}

export function updateAbilities(world: World, dt: number): void {
  const a = world.abilities;
  for (const id of ABILITY_IDS) if (a.cooldown[id] > 0) a.cooldown[id] = Math.max(0, a.cooldown[id] - dt);
  if (a.overclock > 0) a.overclock = Math.max(0, a.overclock - dt);
  if (a.strikes.length === 0) return;
  for (const s of a.strikes) s.t -= dt;
  const landed = a.strikes.filter((s) => s.t <= 0);
  if (landed.length === 0) return;
  a.strikes = a.strikes.filter((s) => s.t > 0);
  for (const s of landed) strikeImpact(world, s);
}

/** True while the given enemy is frozen solid by a cryo pulse. */
export function isFrozen(e: { slowFactor: number; slowTimer: number }): boolean {
  return e.slowFactor <= 0 && e.slowTimer > 0;
}

