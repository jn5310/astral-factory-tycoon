export const WORLD_EVENT_IDS = ['meteor', 'supplyDrop', 'solarFlare', 'dustStorm', 'oreSurge', 'bloodMoon'] as const;
export type WorldEventId = (typeof WORLD_EVENT_IDS)[number];

export interface WorldEventDef {
  id: WorldEventId;
  weight: number;
  /** Seconds the effect lasts (0 = one-shot). */
  duration: number;
  minDay: number;
  /** Only starts while the sun is up. */
  dayOnly: boolean;
  /** Needs enemy attacks to be enabled. */
  needsAttacks: boolean;
}

export const WORLD_EVENTS: Record<WorldEventId, WorldEventDef> = {
  meteor: { id: 'meteor', weight: 3, duration: 0, minDay: 2, dayOnly: false, needsAttacks: false },
  supplyDrop: { id: 'supplyDrop', weight: 4, duration: 0, minDay: 1, dayOnly: false, needsAttacks: false },
  solarFlare: { id: 'solarFlare', weight: 2, duration: 60, minDay: 2, dayOnly: true, needsAttacks: false },
  dustStorm: { id: 'dustStorm', weight: 2, duration: 60, minDay: 3, dayOnly: false, needsAttacks: false },
  oreSurge: { id: 'oreSurge', weight: 2, duration: 60, minDay: 2, dayOnly: false, needsAttacks: false },
  bloodMoon: { id: 'bloodMoon', weight: 1.5, duration: 0, minDay: 4, dayOnly: true, needsAttacks: true },
};

/** Effect strengths while an event is active. */
export const SOLAR_FLARE_MUL = 2.2;
export const DUST_STORM_SOLAR_MUL = 0.35;
export const ORE_SURGE_MUL = 1.5;
export const BLOOD_MOON_WAVE_MUL = 1.6;
export const BLOOD_MOON_SALVAGE_MUL = 2;

/** First event after this many seconds, then every [min, max] seconds. */
export const FIRST_EVENT_DELAY = 200;
export const EVENT_INTERVAL_MIN = 150;
export const EVENT_INTERVAL_MAX = 250;

/** Supply pods vanish if nobody taps them in time. */
export const PICKUP_LIFETIME = 180;
export const PICKUP_FALL_TIME = 2.4;

export const METEOR_FALL_TIME = 1.2;
export const METEOR_DAMAGE = 70;
export const METEOR_RADIUS = 1.6;

export function isWorldEventId(v: unknown): v is WorldEventId {
  return typeof v === 'string' && (WORLD_EVENT_IDS as readonly string[]).includes(v);
}
