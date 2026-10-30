import type { ItemId, ItemStack } from './items';

/** Buildings that run recipes. */
export type CrafterKind = 'furnace' | 'assembler' | 'chem_plant' | 'adv_assembler';

export const CRAFTER_KINDS: readonly CrafterKind[] = ['furnace', 'assembler', 'chem_plant', 'adv_assembler'];

/** Every crafted item has exactly one recipe, so recipe ids are the output item ids. */
export const RECIPE_IDS = [
  // Furnace (smelting)
  'iron_plate',
  'copper_plate',
  'brick',
  'glass',
  'steel',
  'silicon',
  'titanium_plate',
  'alloy',
  // Assembler
  'gear',
  'copper_wire',
  'basic_ammo',
  'circuit',
  'concrete',
  'shotgun_shell',
  'ap_ammo',
  'explosive_ammo',
  'engine_unit',
  // Chemical plant
  'explosive',
  'battery',
  'energy_cell',
  'rocket_fuel',
  // Advanced assembler
  'processor',
  'heat_shield',
  'rocket_part',
] as const satisfies readonly ItemId[];

export type RecipeId = (typeof RECIPE_IDS)[number];

export interface RecipeDef {
  id: RecipeId;
  building: CrafterKind;
  inputs: readonly ItemStack[];
  outputs: readonly ItemStack[];
  /** Craft time in seconds at 100% speed. */
  time: number;
}

function r(
  id: RecipeId,
  building: CrafterKind,
  inputs: [ItemId, number][],
  outputs: [ItemId, number][],
  time: number,
): RecipeDef {
  return {
    id,
    building,
    inputs: inputs.map(([item, amount]) => ({ item, amount })),
    outputs: outputs.map(([item, amount]) => ({ item, amount })),
    time,
  };
}

export const RECIPES: Record<RecipeId, RecipeDef> = {
  iron_plate: r('iron_plate', 'furnace', [['iron_ore', 1]], [['iron_plate', 1]], 1.6),
  copper_plate: r('copper_plate', 'furnace', [['copper_ore', 1]], [['copper_plate', 1]], 1.6),
  brick: r('brick', 'furnace', [['stone', 2]], [['brick', 1]], 2),
  glass: r('glass', 'furnace', [['sand', 2]], [['glass', 1]], 2),
  steel: r('steel', 'furnace', [['iron_plate', 3], ['coal', 1]], [['steel', 1]], 4),
  silicon: r('silicon', 'furnace', [['sand', 2], ['coal', 1]], [['silicon', 1]], 3),
  titanium_plate: r('titanium_plate', 'furnace', [['titanium_ore', 2], ['coal', 1]], [['titanium_plate', 1]], 3.5),
  alloy: r('alloy', 'furnace', [['titanium_plate', 2], ['steel', 1]], [['alloy', 1]], 5),

  gear: r('gear', 'assembler', [['iron_plate', 2]], [['gear', 1]], 1),
  copper_wire: r('copper_wire', 'assembler', [['copper_plate', 1]], [['copper_wire', 2]], 0.8),
  basic_ammo: r('basic_ammo', 'assembler', [['iron_plate', 1]], [['basic_ammo', 1]], 1),
  circuit: r('circuit', 'assembler', [['iron_plate', 1], ['copper_wire', 3]], [['circuit', 1]], 2),
  concrete: r('concrete', 'assembler', [['brick', 2], ['sand', 1]], [['concrete', 2]], 2.5),
  shotgun_shell: r('shotgun_shell', 'assembler', [['copper_plate', 1], ['iron_plate', 1]], [['shotgun_shell', 1]], 1.5),
  ap_ammo: r('ap_ammo', 'assembler', [['basic_ammo', 1], ['steel', 1]], [['ap_ammo', 1]], 3),
  explosive_ammo: r('explosive_ammo', 'assembler', [['explosive', 1], ['steel', 1]], [['explosive_ammo', 1]], 4),
  engine_unit: r('engine_unit', 'assembler', [['steel', 1], ['gear', 2]], [['engine_unit', 1]], 6),

  explosive: r('explosive', 'chem_plant', [['coal', 1], ['sand', 2]], [['explosive', 1]], 3),
  battery: r('battery', 'chem_plant', [['iron_plate', 1], ['copper_plate', 1], ['coal', 2]], [['battery', 1]], 4),
  energy_cell: r('energy_cell', 'chem_plant', [['battery', 1], ['silicon', 1]], [['energy_cell', 1]], 6),
  rocket_fuel: r('rocket_fuel', 'chem_plant', [['explosive', 1], ['coal', 2]], [['rocket_fuel', 1]], 5),

  processor: r('processor', 'adv_assembler', [['circuit', 2], ['silicon', 2], ['copper_wire', 4]], [['processor', 1]], 8),
  heat_shield: r('heat_shield', 'adv_assembler', [['alloy', 1], ['brick', 2]], [['heat_shield', 1]], 5),
  rocket_part: r('rocket_part', 'adv_assembler', [['processor', 1], ['rocket_fuel', 1], ['heat_shield', 1]], [['rocket_part', 1]], 10),
};

const RECIPE_SET: ReadonlySet<string> = new Set<string>(RECIPE_IDS);

export function isRecipeId(v: unknown): v is RecipeId {
  return typeof v === 'string' && RECIPE_SET.has(v);
}

export function recipesFor(kind: CrafterKind): RecipeDef[] {
  return RECIPE_IDS.map((id) => RECIPES[id]).filter((rec) => rec.building === kind);
}

export const DEFAULT_RECIPE: Record<CrafterKind, RecipeId> = {
  furnace: 'iron_plate',
  assembler: 'gear',
  chem_plant: 'explosive',
  adv_assembler: 'processor',
};
