export const ABILITY_IDS = ['orbital', 'repair', 'overclock', 'cryo'] as const;
export type AbilityId = (typeof ABILITY_IDS)[number];

export interface AbilityDef {
  id: AbilityId;
  /** Seconds before it can be used again. */
  cooldown: number;
  /** Effect length in seconds (0 = instant). */
  duration: number;
  /** Needs a tap on the map to choose where it hits. */
  targeted: boolean;
  radius: number;
  damage: number;
  color: string;
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  // Delay before the beam lands; enemies inside the circle when it hits take full damage at the center.
  orbital: { id: 'orbital', cooldown: 80, duration: 1.5, targeted: true, radius: 4.5, damage: 700, color: '#f97316' },
  repair: { id: 'repair', cooldown: 120, duration: 0, targeted: false, radius: 0, damage: 0, color: '#4ade80' },
  overclock: { id: 'overclock', cooldown: 150, duration: 20, targeted: false, radius: 0, damage: 0, color: '#facc15' },
  cryo: { id: 'cryo', cooldown: 110, duration: 6, targeted: false, radius: 0, damage: 40, color: '#38bdf8' },
};

/** Share of max HP restored by Repair Nanites. */
export const REPAIR_FRACTION = 0.5;
/** Production speed multiplier while Overclock runs. */
export const OVERCLOCK_SPEED = 2;

export function isAbilityId(v: unknown): v is AbilityId {
  return typeof v === 'string' && (ABILITY_IDS as readonly string[]).includes(v);
}
