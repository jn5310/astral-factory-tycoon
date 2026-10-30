export const ACHIEVEMENT_IDS = [
  'first_blood',
  'exterminator',
  'belt_baron',
  'megawatt',
  'night_owl',
  'untouchable',
  'boss_slayer',
  'scientist',
  'omniscient',
  'escape',
  'speedrun',
  'hardcore',
  'hoarder',
  'industrialist',
  'ace',
  'commander',
  'treasure_hunter',
  'stargazer',
  'smog',
  'daily',
  'storyteller',
] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export function isAchievementId(v: unknown): v is AchievementId {
  return typeof v === 'string' && (ACHIEVEMENT_IDS as readonly string[]).includes(v);
}

/** Thresholds used by the checks (kept here so the UI can show progress). */
export const ACHIEVEMENT_TARGET: Partial<Record<AchievementId, number>> = {
  exterminator: 500,
  belt_baron: 150,
  megawatt: 1000,
  night_owl: 10,
  scientist: 20,
  omniscient: 35,
  speedrun: 25,
  hoarder: 20000,
  industrialist: 10000,
  treasure_hunter: 10,
  smog: 8000,
};
