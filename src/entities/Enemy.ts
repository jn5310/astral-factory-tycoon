import { ENEMIES, type EnemyType } from '../data/enemies';

export interface Enemy {
  id: number;
  type: EnemyType;
  /** Center position in tile units. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  path: number[] | null;
  pathIdx: number;
  pathVersion: number;
  repathTimer: number;
  /** Goal tile index (core by default, a wall for bombers). */
  goal: number;
  /** Building id the enemy is currently attacking / homing on (0 = none). */
  target: number;
  attackTimer: number;
  abilityTimer: number;
  slowTimer: number;
  slowFactor: number;
  angle: number;
  anim: number;
  hitFlash: number;
  dead: boolean;
}

export function createEnemy(id: number, type: EnemyType, x: number, y: number, hpScale = 1): Enemy {
  const def = ENEMIES[type];
  const hp = Math.round(def.hp * hpScale);
  return {
    id,
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    hp,
    maxHp: hp,
    radius: def.radius,
    path: null,
    pathIdx: 0,
    pathVersion: -1,
    repathTimer: 0,
    goal: -1,
    target: 0,
    attackTimer: def.attackInterval * 0.5,
    abilityTimer: 1 + (id % 7) * 0.3,
    slowTimer: 0,
    slowFactor: 1,
    angle: 0,
    anim: (id * 0.37) % 1,
    hitFlash: 0,
    dead: false,
  };
}
