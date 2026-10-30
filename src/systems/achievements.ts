import { ABILITY_IDS } from '../data/abilities';
import { ACHIEVEMENT_IDS, ACHIEVEMENT_TARGET, type AchievementId } from '../data/achievements';
import { MISSIONS } from '../data/missions';
import { RANK_KILLS } from '../data/turrets';
import type { World } from '../core/World';
import { invTotal } from './inventory';

/** Achievements are earned in campaign and daily runs, never in sandbox. */
export function achievementsEnabled(world: World): boolean {
  return world.settings.mode !== 'sandbox';
}

function countBelts(world: World): number {
  let n = 0;
  for (const b of world.buildings.values()) if (b.belt) n++;
  return n;
}

function bestTurretKills(world: World): number {
  let best = 0;
  for (const b of world.buildings.values()) if (b.turret && b.kind !== 'core') best = Math.max(best, b.turret.kills);
  return best;
}

/** Current progress value for achievements that have a numeric target. */
export function achievementProgress(world: World, id: AchievementId): number {
  switch (id) {
    case 'exterminator':
      return world.kills;
    case 'belt_baron':
      return countBelts(world);
    case 'megawatt':
      return Math.floor(world.counters.peakPower);
    case 'night_owl':
      return world.counters.nightsSurvived;
    case 'scientist':
    case 'omniscient':
      return world.research.completed.size;
    case 'hoarder':
      return invTotal(world.inventory);
    case 'industrialist':
      return world.stats.lifetimeSum('produced');
    case 'treasure_hunter':
      return world.counters.dropsCollected;
    case 'smog':
      return Math.floor(world.pollution.total);
    default:
      return 0;
  }
}

export function isAchieved(world: World, id: AchievementId): boolean {
  const c = world.counters;
  const target = ACHIEVEMENT_TARGET[id] ?? 1;
  switch (id) {
    case 'first_blood':
      return world.kills >= 1;
    case 'untouchable':
      return c.cleanNights >= 1;
    case 'boss_slayer':
      return c.bossKills >= 1;
    case 'escape':
      return c.launches >= 1;
    case 'speedrun':
      return c.launchDay > 0 && c.launchDay < target;
    case 'hardcore':
      return c.launches >= 1 && (world.settings.difficulty === 'hard' || world.settings.difficulty === 'nightmare');
    case 'ace':
      return bestTurretKills(world) >= (RANK_KILLS[RANK_KILLS.length - 1] ?? 75);
    case 'commander':
      return ABILITY_IDS.every((a) => world.abilities.used.includes(a));
    case 'stargazer':
      return c.meteorShowers >= 1;
    case 'daily':
      return world.settings.mode === 'daily' && world.state !== 'playing';
    case 'storyteller':
      return world.settings.mode !== 'sandbox' && world.missions.index >= MISSIONS.length;
    default:
      return achievementProgress(world, id) >= target;
  }
}

/** Achievements reached in this world that are not in `unlocked` yet. */
export function checkAchievements(world: World, unlocked: ReadonlySet<AchievementId>): AchievementId[] {
  if (!achievementsEnabled(world)) return [];
  return ACHIEVEMENT_IDS.filter((id) => !unlocked.has(id) && isAchieved(world, id));
}
