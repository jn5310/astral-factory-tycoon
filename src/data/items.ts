/** 30 item types: 6 raw ores -> 7 smelted -> 9 processed -> 8 advanced parts & ammo. */

export const ITEM_IDS = [
  // Tier 0: raw resources (6)
  'iron_ore',
  'copper_ore',
  'coal',
  'stone',
  'sand',
  'titanium_ore',
  // Tier 1: smelting (7)
  'iron_plate',
  'copper_plate',
  'glass',
  'brick',
  'steel',
  'silicon',
  'titanium_plate',
  // Tier 2: processing (9)
  'gear',
  'copper_wire',
  'circuit',
  'battery',
  'engine_unit',
  'alloy',
  'concrete',
  'explosive',
  'basic_ammo',
  // Tier 3: advanced parts & ammo (8)
  'ap_ammo',
  'explosive_ammo',
  'shotgun_shell',
  'energy_cell',
  'processor',
  'rocket_fuel',
  'heat_shield',
  'rocket_part',
] as const;

export type ItemId = (typeof ITEM_IDS)[number];

export type ItemShape =
  | 'ore'
  | 'sand'
  | 'plate'
  | 'ingot'
  | 'crystal'
  | 'brick'
  | 'gear'
  | 'coil'
  | 'chip'
  | 'cell'
  | 'engine'
  | 'block'
  | 'powder'
  | 'bullet'
  | 'shell'
  | 'canister'
  | 'hex'
  | 'rocket';

export interface ItemDef {
  id: ItemId;
  name: string;
  tier: 0 | 1 | 2 | 3;
  color: string;
  accent: string;
  shape: ItemShape;
}

export interface ItemStack {
  item: ItemId;
  amount: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  iron_ore: { id: 'iron_ore', name: '철광석', tier: 0, color: '#8b9bb4', accent: '#4b5568', shape: 'ore' },
  copper_ore: { id: 'copper_ore', name: '구리 광석', tier: 0, color: '#d9823b', accent: '#7c3f12', shape: 'ore' },
  coal: { id: 'coal', name: '석탄', tier: 0, color: '#3a3a40', accent: '#9ca3af', shape: 'ore' },
  stone: { id: 'stone', name: '돌', tier: 0, color: '#a8a08f', accent: '#6b6455', shape: 'ore' },
  sand: { id: 'sand', name: '실리콘 모래', tier: 0, color: '#e8d48c', accent: '#b49a4a', shape: 'sand' },
  titanium_ore: { id: 'titanium_ore', name: '티타늄 광석', tier: 0, color: '#9fb4ff', accent: '#4c5fb0', shape: 'ore' },

  iron_plate: { id: 'iron_plate', name: '철판', tier: 1, color: '#cbd5e1', accent: '#64748b', shape: 'plate' },
  copper_plate: { id: 'copper_plate', name: '구리판', tier: 1, color: '#f59e5b', accent: '#9a4a17', shape: 'plate' },
  glass: { id: 'glass', name: '유리', tier: 1, color: '#a5f3fc', accent: '#0e7490', shape: 'crystal' },
  brick: { id: 'brick', name: '벽돌', tier: 1, color: '#b9583c', accent: '#6b2a17', shape: 'brick' },
  steel: { id: 'steel', name: '강철', tier: 1, color: '#8b98a8', accent: '#334155', shape: 'ingot' },
  silicon: { id: 'silicon', name: '실리콘', tier: 1, color: '#55607e', accent: '#c7d2fe', shape: 'ingot' },
  titanium_plate: { id: 'titanium_plate', name: '티타늄판', tier: 1, color: '#b4c2ff', accent: '#4c5fb0', shape: 'plate' },

  gear: { id: 'gear', name: '기어', tier: 2, color: '#b8c0cc', accent: '#4b5563', shape: 'gear' },
  copper_wire: { id: 'copper_wire', name: '구리선', tier: 2, color: '#ffa94d', accent: '#9a4a17', shape: 'coil' },
  circuit: { id: 'circuit', name: '전자회로', tier: 2, color: '#34d399', accent: '#065f46', shape: 'chip' },
  battery: { id: 'battery', name: '배터리', tier: 2, color: '#facc15', accent: '#713f12', shape: 'cell' },
  engine_unit: { id: 'engine_unit', name: '엔진 유닛', tier: 2, color: '#94a3b8', accent: '#f97316', shape: 'engine' },
  alloy: { id: 'alloy', name: '강화 합금', tier: 2, color: '#c084fc', accent: '#581c87', shape: 'ingot' },
  concrete: { id: 'concrete', name: '콘크리트', tier: 2, color: '#a3a3a3', accent: '#525252', shape: 'block' },
  explosive: { id: 'explosive', name: '폭약', tier: 2, color: '#f87171', accent: '#7f1d1d', shape: 'powder' },
  basic_ammo: { id: 'basic_ammo', name: '일반 탄약', tier: 2, color: '#e8c15a', accent: '#78591c', shape: 'bullet' },

  ap_ammo: { id: 'ap_ammo', name: '철갑탄', tier: 3, color: '#93c5fd', accent: '#1e3a8a', shape: 'bullet' },
  explosive_ammo: { id: 'explosive_ammo', name: '폭발탄', tier: 3, color: '#fb923c', accent: '#7c2d12', shape: 'shell' },
  shotgun_shell: { id: 'shotgun_shell', name: '산탄', tier: 3, color: '#ef4444', accent: '#fde68a', shape: 'shell' },
  energy_cell: { id: 'energy_cell', name: '에너지 셀', tier: 3, color: '#22d3ee', accent: '#164e63', shape: 'cell' },
  processor: { id: 'processor', name: '프로세서', tier: 3, color: '#2dd4bf', accent: '#134e4a', shape: 'chip' },
  rocket_fuel: { id: 'rocket_fuel', name: '로켓 연료', tier: 3, color: '#fbbf24', accent: '#b91c1c', shape: 'canister' },
  heat_shield: { id: 'heat_shield', name: '내열 차폐판', tier: 3, color: '#f97316', accent: '#1f2937', shape: 'hex' },
  rocket_part: { id: 'rocket_part', name: '로켓 부품', tier: 3, color: '#f1f5f9', accent: '#dc2626', shape: 'rocket' },
};

const ITEM_SET: ReadonlySet<string> = new Set<string>(ITEM_IDS);

export function isItemId(v: unknown): v is ItemId {
  return typeof v === 'string' && ITEM_SET.has(v);
}

export function itemName(id: ItemId): string {
  return ITEMS[id].name;
}
