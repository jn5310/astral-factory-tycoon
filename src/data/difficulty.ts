export const GAME_MODES = ['standard', 'sandbox', 'daily'] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const DIFFICULTIES = ['peaceful', 'easy', 'normal', 'hard', 'nightmare'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface DifficultyDef {
  /** Night wave budget multiplier (0 = no attacks at all). */
  waveMul: number;
  enemyHpMul: number;
  /** How strongly pollution provokes the aliens. */
  pollutionMul: number;
  /** Starting resources multiplier. */
  startMul: number;
  scoreMul: number;
  attacks: boolean;
}

export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  peaceful: { waveMul: 0, enemyHpMul: 1, pollutionMul: 0, startMul: 1.5, scoreMul: 0.25, attacks: false },
  easy: { waveMul: 0.6, enemyHpMul: 0.8, pollutionMul: 0.6, startMul: 1.3, scoreMul: 0.7, attacks: true },
  normal: { waveMul: 1, enemyHpMul: 1, pollutionMul: 1, startMul: 1, scoreMul: 1, attacks: true },
  hard: { waveMul: 1.4, enemyHpMul: 1.25, pollutionMul: 1.3, startMul: 0.8, scoreMul: 1.5, attacks: true },
  nightmare: { waveMul: 2, enemyHpMul: 1.6, pollutionMul: 1.6, startMul: 0.6, scoreMul: 2.2, attacks: true },
};

/** Daily-challenge twists. 'none' is used by the other modes. */
export const MUTATORS = ['none', 'swarm', 'richVeins', 'solarAge', 'meteorSeason'] as const;
export type Mutator = (typeof MUTATORS)[number];

export interface MutatorDef {
  waveMul: number;
  salvageMul: number;
  drillMul: number;
  solarMul: number;
  /** Random-event interval multiplier (smaller = more events). */
  eventIntervalMul: number;
  meteorWeightMul: number;
}

export const MUTATOR: Record<Mutator, MutatorDef> = {
  none: { waveMul: 1, salvageMul: 1, drillMul: 1, solarMul: 1, eventIntervalMul: 1, meteorWeightMul: 1 },
  swarm: { waveMul: 1.5, salvageMul: 1.6, drillMul: 1, solarMul: 1, eventIntervalMul: 1, meteorWeightMul: 1 },
  richVeins: { waveMul: 1, salvageMul: 1, drillMul: 1.5, solarMul: 1, eventIntervalMul: 1, meteorWeightMul: 1 },
  solarAge: { waveMul: 1, salvageMul: 1, drillMul: 1, solarMul: 1.6, eventIntervalMul: 1, meteorWeightMul: 1 },
  meteorSeason: { waveMul: 1, salvageMul: 1, drillMul: 1, solarMul: 1, eventIntervalMul: 0.5, meteorWeightMul: 4 },
};

export interface GameSettings {
  mode: GameMode;
  difficulty: Difficulty;
  mutator: Mutator;
  /** UTC date (YYYY-MM-DD) of a daily challenge run, otherwise null. */
  dailyKey: string | null;
}

export function defaultSettings(): GameSettings {
  return { mode: 'standard', difficulty: 'normal', mutator: 'none', dailyKey: null };
}

export function isGameMode(v: unknown): v is GameMode {
  return typeof v === 'string' && (GAME_MODES as readonly string[]).includes(v);
}

export function isDifficulty(v: unknown): v is Difficulty {
  return typeof v === 'string' && (DIFFICULTIES as readonly string[]).includes(v);
}

export function isMutator(v: unknown): v is Mutator {
  return typeof v === 'string' && (MUTATORS as readonly string[]).includes(v);
}
