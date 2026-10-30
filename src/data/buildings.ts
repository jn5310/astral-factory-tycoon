import type { ItemId, ItemStack } from './items';

export const BUILDING_KINDS = [
  'core',
  // Logistics (8)
  'conveyor',
  'fast_conveyor',
  'router',
  'bridge',
  'tunnel',
  'sorter',
  'container',
  'inserter',
  // Production
  'mech_drill',
  'electric_drill',
  'furnace',
  'assembler',
  'chem_plant',
  'adv_assembler',
  // Power
  'thermal_generator',
  'solar_panel',
  'accumulator',
  'power_pole',
  // Science / victory
  'lab',
  'rocket_silo',
  // Defense
  'mg_turret',
  'shotgun_turret',
  'cannon_turret',
  'laser_turret',
  'slow_turret',
  'repair_turret',
  'wall',
  'titanium_wall',
] as const;

export type BuildingKind = (typeof BUILDING_KINDS)[number];

export type BuildCategory = 'logistics' | 'production' | 'power' | 'defense' | 'science';

export interface PowerSpec {
  /** Consumption in kW while working. */
  use?: number;
  /** Max generation in kW. */
  gen?: number;
  /** Storage capacity in kJ (accumulators). */
  storage?: number;
  /** Max charge/discharge rate in kW (accumulators). */
  rate?: number;
}

export interface BuildingDef {
  kind: BuildingKind;
  category: BuildCategory;
  size: number;
  hp: number;
  cost: readonly ItemStack[];
  rotatable: boolean;
  /** Solid buildings block ground enemies (they must break through). */
  solid: boolean;
  /** Can be placed in a line with the smart drag builder. */
  lineBuild: boolean;
  buildable: boolean;
  power?: PowerSpec;
  /** Pollution emitted per second while working. */
  pollution?: number;
  color: string;
  maxCount?: number;
}

function c(...pairs: [ItemId, number][]): ItemStack[] {
  return pairs.map(([item, amount]) => ({ item, amount }));
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  core: {
    kind: 'core', category: 'logistics',
    size: 3, hp: 5000, cost: [], rotatable: false, solid: true, lineBuild: false, buildable: false, color: '#22d3ee',
  },
  conveyor: {
    kind: 'conveyor', category: 'logistics',
    size: 1, hp: 60, cost: c(['iron_plate', 1]), rotatable: true, solid: false, lineBuild: true, buildable: true, color: '#6b7280',
  },
  fast_conveyor: {
    kind: 'fast_conveyor', category: 'logistics',
    size: 1, hp: 90, cost: c(['steel', 1], ['gear', 1]), rotatable: true, solid: false, lineBuild: true, buildable: true, color: '#3b82f6',
  },
  router: {
    kind: 'router', category: 'logistics',
    size: 1, hp: 80, cost: c(['iron_plate', 3], ['copper_plate', 2]), rotatable: false, solid: true, lineBuild: false, buildable: true, color: '#a3a3a3',
  },
  bridge: {
    kind: 'bridge', category: 'logistics',
    size: 1, hp: 80, cost: c(['iron_plate', 6], ['gear', 2]), rotatable: true, solid: false, lineBuild: false, buildable: true, color: '#fbbf24',
  },
  tunnel: {
    kind: 'tunnel', category: 'logistics',
    size: 1, hp: 100, cost: c(['iron_plate', 8], ['brick', 4]), rotatable: true, solid: false, lineBuild: false, buildable: true, color: '#78716c',
  },
  sorter: {
    kind: 'sorter', category: 'logistics',
    size: 1, hp: 80, cost: c(['iron_plate', 2], ['copper_plate', 2]), rotatable: false, solid: true, lineBuild: false, buildable: true, color: '#e879f9',
  },
  container: {
    kind: 'container', category: 'logistics',
    size: 2, hp: 400, cost: c(['iron_plate', 20], ['brick', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true, color: '#a16207',
  },
  inserter: {
    kind: 'inserter', category: 'logistics',
    size: 1, hp: 60, cost: c(['iron_plate', 2], ['gear', 1]), rotatable: true, solid: false, lineBuild: false, buildable: true, color: '#facc15',
  },

  mech_drill: {
    kind: 'mech_drill', category: 'production',
    size: 2, hp: 250, cost: c(['iron_plate', 10], ['copper_plate', 5]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    pollution: 0.6, color: '#a8a29e',
  },
  electric_drill: {
    kind: 'electric_drill', category: 'production',
    size: 2, hp: 320, cost: c(['iron_plate', 20], ['circuit', 5], ['gear', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 90 }, pollution: 1, color: '#60a5fa',
  },
  furnace: {
    kind: 'furnace', category: 'production',
    size: 2, hp: 300, cost: c(['stone', 15], ['iron_plate', 5]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 60 }, pollution: 1.2, color: '#f97316',
  },
  assembler: {
    kind: 'assembler', category: 'production',
    size: 2, hp: 300, cost: c(['iron_plate', 15], ['gear', 5], ['copper_plate', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 75 }, pollution: 0.5, color: '#94a3b8',
  },
  chem_plant: {
    kind: 'chem_plant', category: 'production',
    size: 2, hp: 320, cost: c(['steel', 15], ['glass', 10], ['circuit', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 120 }, pollution: 2, color: '#4ade80',
  },
  adv_assembler: {
    kind: 'adv_assembler', category: 'production',
    size: 3, hp: 450, cost: c(['steel', 20], ['circuit', 15], ['engine_unit', 5], ['titanium_plate', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 180 }, pollution: 1, color: '#2dd4bf',
  },

  thermal_generator: {
    kind: 'thermal_generator', category: 'power',
    size: 2, hp: 300, cost: c(['iron_plate', 15], ['brick', 10], ['copper_plate', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { gen: 300 }, pollution: 2.5, color: '#ef4444',
  },
  solar_panel: {
    kind: 'solar_panel', category: 'power',
    size: 2, hp: 150, cost: c(['copper_plate', 8], ['iron_plate', 4]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { gen: 40 }, color: '#1d4ed8',
  },
  accumulator: {
    kind: 'accumulator', category: 'power',
    size: 2, hp: 250, cost: c(['iron_plate', 10], ['copper_wire', 20], ['circuit', 5]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { storage: 5000, rate: 300 }, color: '#16a34a',
  },
  power_pole: {
    kind: 'power_pole', category: 'power',
    size: 1, hp: 80, cost: c(['iron_plate', 1], ['copper_plate', 2]), rotatable: false, solid: true, lineBuild: false, buildable: true, color: '#d6b37a',
  },

  lab: {
    kind: 'lab', category: 'science',
    size: 2, hp: 300, cost: c(['iron_plate', 20], ['copper_plate', 15], ['gear', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 60 }, color: '#818cf8',
  },
  rocket_silo: {
    kind: 'rocket_silo', category: 'science',
    size: 4, hp: 3000, cost: c(['steel', 300], ['concrete', 300], ['processor', 100], ['alloy', 100], ['energy_cell', 50]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 250 }, pollution: 3, color: '#f8fafc', maxCount: 1,
  },

  mg_turret: {
    kind: 'mg_turret', category: 'defense',
    size: 1, hp: 380, cost: c(['iron_plate', 15], ['copper_plate', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true, color: '#eab308',
  },
  shotgun_turret: {
    kind: 'shotgun_turret', category: 'defense',
    size: 2, hp: 600, cost: c(['iron_plate', 25], ['gear', 10], ['copper_plate', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true, color: '#dc2626',
  },
  cannon_turret: {
    kind: 'cannon_turret', category: 'defense',
    size: 2, hp: 700, cost: c(['steel', 30], ['gear', 20], ['circuit', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true, color: '#f97316',
  },
  laser_turret: {
    kind: 'laser_turret', category: 'defense',
    size: 2, hp: 550, cost: c(['steel', 30], ['circuit', 20], ['battery', 10], ['glass', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 150 }, color: '#f43f5e',
  },
  slow_turret: {
    kind: 'slow_turret', category: 'defense',
    size: 2, hp: 500, cost: c(['titanium_plate', 20], ['circuit', 15], ['glass', 15]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 90 }, color: '#38bdf8',
  },
  repair_turret: {
    kind: 'repair_turret', category: 'defense',
    size: 2, hp: 450, cost: c(['iron_plate', 30], ['circuit', 10], ['copper_wire', 20]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 70 }, color: '#4ade80',
  },
  wall: {
    kind: 'wall', category: 'defense',
    size: 1, hp: 400, cost: c(['stone', 6]), rotatable: false, solid: true, lineBuild: true, buildable: true, color: '#78716c',
  },
  titanium_wall: {
    kind: 'titanium_wall', category: 'defense',
    size: 1, hp: 1200, cost: c(['concrete', 4], ['iron_plate', 2]), rotatable: false, solid: true, lineBuild: true, buildable: true, color: '#94a3b8',
  },
};

const KIND_SET: ReadonlySet<string> = new Set<string>(BUILDING_KINDS);

export function isBuildingKind(v: unknown): v is BuildingKind {
  return typeof v === 'string' && KIND_SET.has(v);
}

export function isConveyorKind(kind: BuildingKind): kind is 'conveyor' | 'fast_conveyor' {
  return kind === 'conveyor' || kind === 'fast_conveyor';
}

export function isCrafterKind(kind: BuildingKind): kind is 'furnace' | 'assembler' | 'chem_plant' | 'adv_assembler' {
  return kind === 'furnace' || kind === 'assembler' || kind === 'chem_plant' || kind === 'adv_assembler';
}

export function isTurretKind(kind: BuildingKind): boolean {
  return (
    kind === 'mg_turret' ||
    kind === 'shotgun_turret' ||
    kind === 'cannon_turret' ||
    kind === 'laser_turret' ||
    kind === 'slow_turret' ||
    kind === 'repair_turret'
  );
}

export function isWallKind(kind: BuildingKind): boolean {
  return kind === 'wall' || kind === 'titanium_wall';
}

/** Buildings unlocked at the start of a new game (everything else needs research). */
export const STARTING_BUILDINGS: readonly BuildingKind[] = [
  'conveyor',
  'mech_drill',
  'furnace',
  'assembler',
  'thermal_generator',
  'solar_panel',
  'power_pole',
  'lab',
  'inserter',
  'mg_turret',
  'wall',
];

export const BUILD_MENU_ORDER: readonly BuildingKind[] = BUILDING_KINDS.filter((k) => k !== 'core');
