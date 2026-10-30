import { DIFFICULTY } from '../data/difficulty';
import type { World } from '../core/World';

export interface ScoreBreakdown {
  kills: number;
  nights: number;
  research: number;
  production: number;
  missions: number;
  victory: number;
  speed: number;
  multiplier: number;
  total: number;
}

export const SCORE_PER_KILL = 10;
export const SCORE_PER_NIGHT = 300;
export const SCORE_PER_RESEARCH = 250;
export const SCORE_PER_MISSION = 150;
/** One point per this many items produced. */
export const ITEMS_PER_POINT = 20;
export const VICTORY_BONUS = 20000;
/** Bonus per day the rocket launched before day 30. */
export const SPEED_BONUS_PER_DAY = 500;
export const SPEED_PAR_DAY = 30;

export function computeScore(world: World): ScoreBreakdown {
  const c = world.counters;
  const kills = world.kills * SCORE_PER_KILL;
  const nights = c.nightsSurvived * SCORE_PER_NIGHT;
  const research = world.research.completed.size * SCORE_PER_RESEARCH;
  const production = Math.floor(world.stats.lifetimeSum('produced') / ITEMS_PER_POINT);
  const missions = Math.min(world.missions.index, 999) * SCORE_PER_MISSION;
  const won = c.launches > 0;
  const victory = won ? VICTORY_BONUS : 0;
  const speed = won ? Math.max(0, SPEED_PAR_DAY - c.launchDay) * SPEED_BONUS_PER_DAY : 0;
  const multiplier = DIFFICULTY[world.settings.difficulty].scoreMul;
  const total = Math.round((kills + nights + research + production + missions + victory + speed) * multiplier);
  return { kills, nights, research, production, missions, victory, speed, multiplier, total };
}
