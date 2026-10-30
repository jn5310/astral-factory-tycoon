import type { ItemId } from './items';

export const Terrain = {
  Plain: 0,
  Water: 1,
  Rock: 2,
} as const;
export type TerrainType = (typeof Terrain)[keyof typeof Terrain];

export const Ore = {
  None: 0,
  Iron: 1,
  Copper: 2,
  Coal: 3,
  Stone: 4,
  Sand: 5,
  Titanium: 6,
} as const;
export type OreType = (typeof Ore)[keyof typeof Ore];

export const ORE_ITEM: Record<number, ItemId | undefined> = {
  [Ore.Iron]: 'iron_ore',
  [Ore.Copper]: 'copper_ore',
  [Ore.Coal]: 'coal',
  [Ore.Stone]: 'stone',
  [Ore.Sand]: 'sand',
  [Ore.Titanium]: 'titanium_ore',
};

export const ORE_NAME: Record<number, string> = {
  [Ore.None]: '없음',
  [Ore.Iron]: '철',
  [Ore.Copper]: '구리',
  [Ore.Coal]: '석탄',
  [Ore.Stone]: '돌',
  [Ore.Sand]: '실리콘 모래',
  [Ore.Titanium]: '티타늄',
};

export const TERRAIN_NAME: Record<number, string> = {
  [Terrain.Plain]: '평지',
  [Terrain.Water]: '물',
  [Terrain.Rock]: '암석 지대',
};

/** Minimap / terrain base colors. */
export const TERRAIN_COLOR: Record<number, string> = {
  [Terrain.Plain]: '#2a2f3a',
  [Terrain.Water]: '#123a5c',
  [Terrain.Rock]: '#4a4038',
};

export const ORE_COLOR: Record<number, string> = {
  [Ore.Iron]: '#8b9bb4',
  [Ore.Copper]: '#d9823b',
  [Ore.Coal]: '#18181b',
  [Ore.Stone]: '#b5ab97',
  [Ore.Sand]: '#e8d48c',
  [Ore.Titanium]: '#9fb4ff',
};
