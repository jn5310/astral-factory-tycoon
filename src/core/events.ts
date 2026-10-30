import type { BuildingKind } from '../data/buildings';
import type { EnemyType } from '../data/enemies';

export type SoundName =
  | 'place'
  | 'demolish'
  | 'mg'
  | 'shotgun'
  | 'cannon'
  | 'laser'
  | 'slow'
  | 'repair'
  | 'explosion'
  | 'hit'
  | 'enemyDie'
  | 'acid'
  | 'alarm'
  | 'research'
  | 'victory'
  | 'defeat'
  | 'ui'
  | 'error'
  | 'launch'
  | 'craft';

export type ToastLevel = 'info' | 'success' | 'warning' | 'danger';

export type GameEvent =
  | { type: 'sound'; sound: SoundName; x: number; y: number }
  | { type: 'toast'; message: string; level: ToastLevel }
  | { type: 'built'; kind: BuildingKind; x: number; y: number }
  | { type: 'destroyed'; kind: BuildingKind; x: number; y: number }
  | { type: 'enemyKilled'; enemy: EnemyType; x: number; y: number }
  | { type: 'researchComplete'; id: string }
  | { type: 'nightStart'; night: number }
  | { type: 'dayStart'; day: number }
  | { type: 'launchStart' }
  | { type: 'victory' }
  | { type: 'defeat' }
  | { type: 'shake'; strength: number };
