import type { BuildingKind } from '../data/buildings';
import type { EnemyType } from '../data/enemies';
import type { MissionId } from '../data/missions';
import type { TileXY } from './types';

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
  | 'craft'
  | 'mission'
  | 'achievement'
  | 'orbital'
  | 'freeze'
  | 'pickup'
  | 'meteor'
  | 'rankUp'
  | 'siren'
  | 'overclock';

export type ToastLevel = 'info' | 'success' | 'warning' | 'danger';

export type GameEvent =
  | { type: 'sound'; sound: SoundName; x: number; y: number }
  /** `focus` adds a "view" button that moves the camera there. */
  | { type: 'toast'; message: string; level: ToastLevel; focus?: TileXY }
  | { type: 'radio'; text: string }
  | { type: 'built'; kind: BuildingKind; x: number; y: number }
  | { type: 'destroyed'; kind: BuildingKind; x: number; y: number }
  | { type: 'enemyKilled'; enemy: EnemyType; x: number; y: number }
  | { type: 'researchComplete'; id: string }
  | { type: 'missionComplete'; id: MissionId }
  | { type: 'rankUp'; buildingId: number; rank: number }
  | { type: 'underAttack'; x: number; y: number }
  | { type: 'bossSpawn'; x: number; y: number }
  | { type: 'nightStart'; night: number }
  | { type: 'dayStart'; day: number }
  | { type: 'launchStart' }
  | { type: 'victory' }
  | { type: 'defeat' }
  | { type: 'shake'; strength: number }
  | { type: 'screenFlash'; color: string };
