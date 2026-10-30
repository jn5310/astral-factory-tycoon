import { isAchievementId, type AchievementId } from '../data/achievements';
import { isDifficulty, isGameMode, type Difficulty, type GameMode } from '../data/difficulty';
import { isEnemyType, type EnemyType } from '../data/enemies';

/** Progress that outlives a single colony: achievements, codex, high scores. */
export interface HighScore {
  score: number;
  mode: GameMode;
  difficulty: Difficulty;
  day: number;
  victory: boolean;
  /** YYYY-MM-DD */
  date: string;
  seed: number;
}

export interface Profile {
  /** Achievement id -> unlock time (ms since epoch). */
  achievements: Partial<Record<AchievementId, number>>;
  seenEnemies: EnemyType[];
  highScores: HighScore[];
  /** Best daily-challenge score per YYYY-MM-DD. */
  dailyBest: Record<string, number>;
  runs: number;
  wins: number;
}

export const PROFILE_KEY = 'astral-factory-profile-v1';
export const MAX_HIGH_SCORES = 10;
const MAX_DAILY_ENTRIES = 60;

export function emptyProfile(): Profile {
  return { achievements: {}, seenEnemies: [], highScores: [], dailyBest: {}, runs: 0, wins: 0 };
}

function count(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** Rebuilds a profile from untrusted JSON, dropping anything malformed. */
export function sanitizeProfile(data: unknown): Profile {
  const p = emptyProfile();
  if (typeof data !== 'object' || data === null) return p;
  const d = data as Record<string, unknown>;
  if (typeof d.achievements === 'object' && d.achievements !== null) {
    for (const [k, v] of Object.entries(d.achievements as Record<string, unknown>)) {
      if (isAchievementId(k) && typeof v === 'number' && Number.isFinite(v)) p.achievements[k] = v;
    }
  }
  if (Array.isArray(d.seenEnemies)) p.seenEnemies = [...new Set(d.seenEnemies.filter(isEnemyType))];
  if (Array.isArray(d.highScores)) {
    for (const raw of d.highScores) {
      if (typeof raw !== 'object' || raw === null) continue;
      const h = raw as Record<string, unknown>;
      if (!isGameMode(h.mode) || !isDifficulty(h.difficulty) || typeof h.date !== 'string') continue;
      p.highScores.push({
        score: count(h.score),
        mode: h.mode,
        difficulty: h.difficulty,
        day: count(h.day),
        victory: h.victory === true,
        date: h.date.slice(0, 10),
        seed: count(h.seed),
      });
    }
    p.highScores.sort((a, b) => b.score - a.score);
    p.highScores = p.highScores.slice(0, MAX_HIGH_SCORES);
  }
  if (typeof d.dailyBest === 'object' && d.dailyBest !== null) {
    for (const [k, v] of Object.entries(d.dailyBest as Record<string, unknown>)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) p.dailyBest[k] = count(v);
    }
  }
  p.runs = count(d.runs);
  p.wins = count(d.wins);
  return p;
}

export function loadProfile(storage: Storage | null): Profile {
  if (!storage) return emptyProfile();
  try {
    const raw = storage.getItem(PROFILE_KEY);
    return raw ? sanitizeProfile(JSON.parse(raw) as unknown) : emptyProfile();
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(storage: Storage | null, profile: Profile): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

/**
 * Adds a finished run to the high-score table (and the daily best for daily runs).
 * Returns its rank in the table (0-based) or -1 when it did not place.
 */
export function recordScore(profile: Profile, entry: HighScore, dailyKey: string | null): number {
  if (dailyKey) {
    profile.dailyBest[dailyKey] = Math.max(profile.dailyBest[dailyKey] ?? 0, entry.score);
    const keys = Object.keys(profile.dailyBest).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_DAILY_ENTRIES))) delete profile.dailyBest[k];
  }
  const table = [...profile.highScores, entry].sort((a, b) => b.score - a.score).slice(0, MAX_HIGH_SCORES);
  profile.highScores = table;
  return table.indexOf(entry);
}
