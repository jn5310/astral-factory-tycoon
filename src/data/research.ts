import type { BuildingKind } from './buildings';
import type { ItemId, ItemStack } from './items';
import type { RecipeId } from './recipes';

export type ModifierKey = 'drillSpeed' | 'ammoDamage' | 'laserDamage' | 'buildingHp' | 'generatorOutput';

export interface ResearchEffect {
  key: ModifierKey;
  /** Additive bonus, e.g. 0.2 = +20%. */
  value: number;
}

export const RESEARCH_IDS = [
  'logistics',
  'storage',
  'sorting',
  'glass',
  'circuits',
  'ballistics_1',
  'mining_1',
  'bridge',
  'tunnel',
  'steel',
  'electric_drill',
  'accumulator',
  'shotgun',
  'concrete',
  'silicon',
  'fast_belt',
  'chemistry',
  'cannon',
  'ap_ammo',
  'titanium',
  'repair',
  'engine',
  'laser',
  'slow',
  'alloy',
  'adv_assembly',
  'energy_cell',
  'ballistics_2',
  'rocket_fuel',
  'heat_shield',
  'rocket_part',
  'rocket_silo',
  'mining_2',
  'power_2',
  'defense_matrix',
] as const;

export type ResearchId = (typeof RESEARCH_IDS)[number];

export interface ResearchDef {
  id: ResearchId;
  tier: 1 | 2 | 3 | 4 | 5;
  /** Row inside its tier column (0..6), used by the tech tree layout. */
  row: number;
  cost: readonly ItemStack[];
  prereqs: readonly ResearchId[];
  buildings: readonly BuildingKind[];
  recipes: readonly RecipeId[];
  effects: readonly ResearchEffect[];
}

function node(
  id: ResearchId,
  tier: ResearchDef['tier'],
  row: number,
  cost: [ItemId, number][],
  prereqs: ResearchId[],
  unlock: { buildings?: BuildingKind[]; recipes?: RecipeId[]; effects?: ResearchEffect[] } = {},
): ResearchDef {
  return {
    id,
    tier,
    row,
    cost: cost.map(([item, amount]) => ({ item, amount })),
    prereqs,
    buildings: unlock.buildings ?? [],
    recipes: unlock.recipes ?? [],
    effects: unlock.effects ?? [],
  };
}

/** 5 tiers x 7 nodes = 35 research nodes. */
export const RESEARCH: readonly ResearchDef[] = [
  // ---------- Tier 1: basic industry ----------
  node('logistics', 1, 0, [['iron_plate', 30], ['copper_plate', 20]], [], {
    buildings: ['router'],
  }),
  node('storage', 1, 1, [['iron_plate', 40], ['brick', 20]], [], { buildings: ['container'] }),
  node('sorting', 1, 2, [['iron_plate', 30], ['gear', 15]], [], { buildings: ['sorter'] }),
  node('glass', 1, 3, [['copper_plate', 30], ['stone', 30]], [], { recipes: ['glass'] }),
  node('circuits', 1, 4, [['copper_plate', 40], ['iron_plate', 30], ['copper_wire', 30]], [], {
    recipes: ['circuit'],
  }),
  node('ballistics_1', 1, 5, [['basic_ammo', 30], ['iron_plate', 30]], [], {
    effects: [{ key: 'ammoDamage', value: 0.2 }],
  }),
  node('mining_1', 1, 6, [['iron_plate', 40], ['gear', 20]], [], {
    effects: [{ key: 'drillSpeed', value: 0.2 }],
  }),

  // ---------- Tier 2: automation ----------
  node('bridge', 2, 0, [['gear', 40], ['iron_plate', 50]], ['logistics'], {
    buildings: ['bridge'],
  }),
  node('tunnel', 2, 1, [['gear', 40], ['brick', 40]], ['logistics'], { buildings: ['tunnel'] }),
  node('steel', 2, 2, [['iron_plate', 80], ['coal', 40]], ['mining_1'], { recipes: ['steel'] }),
  node('electric_drill', 2, 3, [['circuit', 30], ['gear', 40]], ['mining_1', 'circuits'], {
    buildings: ['electric_drill'],
  }),
  node('accumulator', 2, 4, [['circuit', 30], ['copper_wire', 60]], ['circuits'], {
    buildings: ['accumulator'],
  }),
  node('shotgun', 2, 5, [['basic_ammo', 50], ['gear', 30]], ['ballistics_1'], {
    buildings: ['shotgun_turret'],
    recipes: ['shotgun_shell'],
  }),
  node('concrete', 2, 6, [['brick', 60], ['glass', 30]], ['storage', 'glass'], {
    buildings: ['titanium_wall'],
    recipes: ['concrete'],
  }),

  // ---------- Tier 3: industry ----------
  node('silicon', 3, 0, [['glass', 50], ['steel', 30]], ['steel', 'glass'], { recipes: ['silicon'] }),
  node('fast_belt', 3, 1, [['steel', 40], ['gear', 60]], ['bridge', 'steel'], {
    buildings: ['fast_conveyor'],
  }),
  node('chemistry', 3, 2, [['steel', 50], ['glass', 50], ['circuit', 40]], ['steel', 'accumulator', 'glass'], {
    buildings: ['chem_plant'],
    recipes: ['explosive', 'battery', 'explosive_ammo'],
  }),
  node('cannon', 3, 3, [['steel', 60], ['circuit', 40]], ['shotgun', 'steel', 'circuits'], {
    buildings: ['cannon_turret'],
  }),
  node('ap_ammo', 3, 4, [['steel', 40], ['basic_ammo', 80]], ['steel', 'ballistics_1'], {
    recipes: ['ap_ammo'],
  }),
  node('titanium', 3, 5, [['steel', 50], ['circuit', 40]], ['electric_drill', 'steel'], {
    recipes: ['titanium_plate'],
  }),
  node('repair', 3, 6, [['circuit', 50], ['concrete', 40]], ['concrete', 'accumulator'], {
    buildings: ['repair_turret'],
  }),

  // ---------- Tier 4: advanced ----------
  node('engine', 4, 0, [['steel', 80], ['gear', 80]], ['fast_belt'], { recipes: ['engine_unit'] }),
  node('laser', 4, 1, [['silicon', 60], ['battery', 40], ['circuit', 60]], ['silicon', 'chemistry'], {
    buildings: ['laser_turret'],
  }),
  node('slow', 4, 2, [['titanium_plate', 50], ['silicon', 40]], ['titanium', 'silicon'], {
    buildings: ['slow_turret'],
  }),
  node('alloy', 4, 3, [['titanium_plate', 60], ['steel', 60]], ['titanium'], { recipes: ['alloy'] }),
  node('adv_assembly', 4, 4, [['circuit', 100], ['silicon', 60], ['engine_unit', 20]], ['engine', 'silicon', 'titanium'], {
    buildings: ['adv_assembler'],
    recipes: ['processor'],
  }),
  node('energy_cell', 4, 5, [['battery', 60], ['silicon', 40]], ['chemistry', 'silicon'], {
    recipes: ['energy_cell'],
  }),
  node('ballistics_2', 4, 6, [['ap_ammo', 60], ['explosive_ammo', 30]], ['ap_ammo', 'cannon', 'chemistry'], {
    effects: [{ key: 'ammoDamage', value: 0.3 }],
  }),

  // ---------- Tier 5: escape ----------
  node('rocket_fuel', 5, 0, [['explosive', 100], ['energy_cell', 40]], ['energy_cell'], {
    recipes: ['rocket_fuel'],
  }),
  node('heat_shield', 5, 1, [['alloy', 80], ['brick', 100]], ['alloy', 'adv_assembly'], {
    recipes: ['heat_shield'],
  }),
  node('rocket_part', 5, 2, [['processor', 60], ['alloy', 60]], ['rocket_fuel', 'heat_shield'], {
    recipes: ['rocket_part'],
  }),
  node('rocket_silo', 5, 3, [['processor', 100], ['energy_cell', 100], ['alloy', 100]], ['rocket_part', 'concrete'], {
    buildings: ['rocket_silo'],
  }),
  node('mining_2', 5, 4, [['engine_unit', 40], ['processor', 20]], ['adv_assembly'], {
    effects: [{ key: 'drillSpeed', value: 0.3 }],
  }),
  node('power_2', 5, 5, [['energy_cell', 60], ['alloy', 40]], ['energy_cell', 'alloy'], {
    effects: [{ key: 'generatorOutput', value: 0.25 }],
  }),
  node('defense_matrix', 5, 6, [['battery', 80], ['processor', 40], ['steel', 100]], ['laser', 'adv_assembly'], {
    effects: [
      { key: 'laserDamage', value: 0.4 },
      { key: 'buildingHp', value: 0.5 },
    ],
  }),
];

export const RESEARCH_BY_ID: ReadonlyMap<string, ResearchDef> = new Map(RESEARCH.map((n) => [n.id, n]));

export function isResearchId(v: unknown): v is ResearchId {
  return typeof v === 'string' && RESEARCH_BY_ID.has(v);
}
