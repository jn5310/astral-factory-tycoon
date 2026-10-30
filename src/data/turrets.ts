import type { BuildingKind } from './buildings';
import type { ItemId } from './items';

export interface AmmoDef {
  item: ItemId;
  /** Shots provided by one item. */
  shots: number;
  damageMul: number;
  pierce: number;
}

export type TurretWeapon = 'bullet' | 'pellet' | 'shell' | 'beam' | 'pulse' | 'repair';

export interface TurretDef {
  kind: BuildingKind;
  weapon: TurretWeapon;
  range: number;
  minRange: number;
  fireInterval: number;
  /** Damage per projectile (beam: damage per second, repair: hp per second). */
  damage: number;
  pellets: number;
  spread: number;
  aoe: number;
  projectileSpeed: number;
  targetsAir: boolean;
  targetsGround: boolean;
  /** Ammo turrets only: accepted ammo items. */
  ammo: readonly AmmoDef[];
  /** Max stored shots. */
  magazine: number;
  turnSpeed: number;
  /** Built-in weapon that never needs ammo (core defense only). */
  infiniteAmmo?: boolean;
}

export const TURRETS: Partial<Record<BuildingKind, TurretDef>> = {
  core: {
    kind: 'core', weapon: 'bullet', range: 7.5, minRange: 0, fireInterval: 0.3, damage: 7, pellets: 1, spread: 0.05,
    aoe: 0, projectileSpeed: 24, targetsAir: true, targetsGround: true, ammo: [], magazine: 0, turnSpeed: 8, infiniteAmmo: true,
  },
  mg_turret: {
    kind: 'mg_turret', weapon: 'bullet', range: 8.5, minRange: 0, fireInterval: 0.14, damage: 9, pellets: 1, spread: 0.04,
    aoe: 0, projectileSpeed: 28, targetsAir: true, targetsGround: true,
    ammo: [
      { item: 'basic_ammo', shots: 10, damageMul: 1, pierce: 0 },
      { item: 'ap_ammo', shots: 10, damageMul: 1.8, pierce: 6 },
    ],
    magazine: 200, turnSpeed: 9,
  },
  shotgun_turret: {
    kind: 'shotgun_turret', weapon: 'pellet', range: 6, minRange: 0, fireInterval: 0.9, damage: 10, pellets: 6, spread: 0.45,
    aoe: 0, projectileSpeed: 20, targetsAir: true, targetsGround: true,
    ammo: [{ item: 'shotgun_shell', shots: 6, damageMul: 1, pierce: 2 }],
    magazine: 60, turnSpeed: 6,
  },
  cannon_turret: {
    kind: 'cannon_turret', weapon: 'shell', range: 18, minRange: 3, fireInterval: 2.4, damage: 140, pellets: 1, spread: 0,
    aoe: 2.2, projectileSpeed: 10, targetsAir: false, targetsGround: true,
    ammo: [{ item: 'explosive_ammo', shots: 4, damageMul: 1, pierce: 8 }],
    magazine: 32, turnSpeed: 2.5,
  },
  laser_turret: {
    kind: 'laser_turret', weapon: 'beam', range: 10, minRange: 0, fireInterval: 0, damage: 70, pellets: 0, spread: 0,
    aoe: 0, projectileSpeed: 0, targetsAir: true, targetsGround: true, ammo: [], magazine: 0, turnSpeed: 7,
  },
  slow_turret: {
    kind: 'slow_turret', weapon: 'pulse', range: 7, minRange: 0, fireInterval: 1.4, damage: 6, pellets: 0, spread: 0,
    aoe: 7, projectileSpeed: 0, targetsAir: true, targetsGround: true, ammo: [], magazine: 0, turnSpeed: 0,
  },
  repair_turret: {
    kind: 'repair_turret', weapon: 'repair', range: 8, minRange: 0, fireInterval: 0.5, damage: 30, pellets: 0, spread: 0,
    aoe: 0, projectileSpeed: 0, targetsAir: false, targetsGround: false, ammo: [], magazine: 0, turnSpeed: 0,
  },
};

export const SLOW_FACTOR = 0.5;
export const SLOW_DURATION = 2.2;

/** Kills needed for veterancy ranks 1..3 (Veteran, Elite, Ace). */
export const RANK_KILLS: readonly number[] = [10, 30, 75];
/** Damage bonus per rank. */
export const RANK_DAMAGE_BONUS = 0.15;

export function rankFor(kills: number): number {
  let rank = 0;
  for (const k of RANK_KILLS) if (kills >= k) rank++;
  return rank;
}

export function ammoFor(kind: BuildingKind, item: ItemId): AmmoDef | undefined {
  return TURRETS[kind]?.ammo.find((a) => a.item === item);
}
