import type { AbilityId } from '../data/abilities';
import type { BuildingKind } from '../data/buildings';
import type { EnemyType } from '../data/enemies';
import type { ItemId, ItemStack } from '../data/items';
import { en } from '../data/locales/en';
import { ko } from '../data/locales/ko';
import type { Messages } from '../data/locales/types';
import type { RecipeId } from '../data/recipes';
import type { ResearchId } from '../data/research';

export const LANGS = ['en', 'ko'] as const;
export type Lang = (typeof LANGS)[number];

const MESSAGES: Record<Lang, Messages> = { en, ko };

let current: Lang = 'en';
const listeners = new Set<() => void>();

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'ko';
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  for (const cb of listeners) cb();
}

export function onLangChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Strings for the current language. */
export function msg(): Messages {
  return MESSAGES[current];
}

export function messagesFor(lang: Lang): Messages {
  return MESSAGES[lang];
}

/** First supported language in the browser's preference list; English otherwise. */
export function detectLang(preferred: readonly string[]): Lang {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return 'en';
}

export const itemName = (id: ItemId): string => msg().items[id];
export const buildingName = (kind: BuildingKind): string => msg().buildings[kind].name;
export const buildingDesc = (kind: BuildingKind): string => msg().buildings[kind].desc;
export const recipeName = (id: RecipeId): string => msg().recipes[id];
export const researchName = (id: ResearchId): string => msg().research[id].name;
export const enemyName = (type: EnemyType): string => msg().enemies[type].name;
export const abilityName = (id: AbilityId): string => msg().abilities[id].name;

/** How long a radio line stays up. A Hangul syllable takes about as long to read as two Latin letters. */
export function readingMs(text: string): number {
  let units = 0;
  for (const ch of text) units += ch >= '\uac00' && ch <= '\ud7a3' ? 2 : 1;
  return Math.max(6000, units * 70);
}

/** "12 Iron Plate, 3 Gear" style list for toasts. */
export function stacksText(stacks: readonly ItemStack[]): string {
  return stacks.map((s) => `${s.amount} ${itemName(s.item)}`).join(', ');
}
