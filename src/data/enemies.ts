export const ENEMY_TYPES = [
  'rusher',
  'charger',
  'spitter',
  'bomber',
  'flyer',
  'brood',
  'healer',
  'leviathan',
] as const;

export type EnemyType = (typeof ENEMY_TYPES)[number];

export type EnemyBehavior = 'melee' | 'ranged' | 'bomber' | 'flyer' | 'healer' | 'boss';

export interface EnemyDef {
  type: EnemyType;
  name: string;
  hp: number;
  armor: number;
  /** Tiles per second. */
  speed: number;
  damage: number;
  attackInterval: number;
  /** Collision radius in tiles. */
  radius: number;
  behavior: EnemyBehavior;
  flying: boolean;
  /** Ranged attack distance in tiles (ranged / boss). */
  range: number;
  /** Wave budget cost. */
  cost: number;
  /** First night on which this enemy can appear. */
  firstNight: number;
  color: string;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  rusher: {
    type: 'rusher', name: '소형 러셔', hp: 30, armor: 0, speed: 2.6, damage: 6, attackInterval: 0.6, radius: 0.28,
    behavior: 'melee', flying: false, range: 0, cost: 1, firstNight: 1, color: '#fb923c',
  },
  charger: {
    type: 'charger', name: '장갑 돌격병', hp: 220, armor: 6, speed: 1.1, damage: 25, attackInterval: 1.2, radius: 0.45,
    behavior: 'melee', flying: false, range: 0, cost: 4, firstNight: 2, color: '#65a30d',
  },
  spitter: {
    type: 'spitter', name: '산성 원거리 몹', hp: 60, armor: 0, speed: 1.5, damage: 12, attackInterval: 1.8, radius: 0.32,
    behavior: 'ranged', flying: false, range: 5.5, cost: 3, firstNight: 2, color: '#a3e635',
  },
  bomber: {
    type: 'bomber', name: '방어벽 파괴 자폭병', hp: 50, armor: 0, speed: 2, damage: 150, attackInterval: 1, radius: 0.34,
    behavior: 'bomber', flying: false, range: 0, cost: 3, firstNight: 3, color: '#ef4444',
  },
  flyer: {
    type: 'flyer', name: '비행 변종', hp: 45, armor: 0, speed: 3, damage: 8, attackInterval: 0.8, radius: 0.3,
    behavior: 'flyer', flying: true, range: 0, cost: 3, firstNight: 3, color: '#c084fc',
  },
  brood: {
    type: 'brood', name: '군체 분열체', hp: 120, armor: 2, speed: 1.4, damage: 12, attackInterval: 0.9, radius: 0.42,
    behavior: 'melee', flying: false, range: 0, cost: 4, firstNight: 4, color: '#a855f7',
  },
  healer: {
    type: 'healer', name: '재생 촉수', hp: 90, armor: 1, speed: 1.3, damage: 5, attackInterval: 1, radius: 0.36,
    behavior: 'healer', flying: false, range: 3, cost: 4, firstNight: 4, color: '#f472b6',
  },
  leviathan: {
    type: 'leviathan', name: '보스 레비아탄', hp: 4000, armor: 10, speed: 0.7, damage: 120, attackInterval: 1.5, radius: 1.2,
    behavior: 'boss', flying: false, range: 7, cost: 40, firstNight: 5, color: '#be123c',
  },
};

const ENEMY_SET: ReadonlySet<string> = new Set<string>(ENEMY_TYPES);

export function isEnemyType(v: unknown): v is EnemyType {
  return typeof v === 'string' && ENEMY_SET.has(v);
}

/** Damage after armor; armor never reduces a hit below 20%. */
export function armoredDamage(damage: number, armor: number, pierce: number): number {
  const effectiveArmor = Math.max(0, armor - pierce);
  return Math.max(damage * 0.2, damage - effectiveArmor);
}
