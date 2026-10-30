import type { AbilityId } from './abilities';
import type { BuildingKind } from './buildings';
import type { ItemId, ItemStack } from './items';

export type MissionGoal =
  | { kind: 'build'; building: BuildingKind; count: number }
  /** Counted from the moment the mission starts. */
  | { kind: 'produce'; item: ItemId; count: number }
  | { kind: 'research'; count: number }
  /** Counted from the moment the mission starts. */
  | { kind: 'kills'; count: number }
  | { kind: 'nights'; count: number }
  /** Peak generation capacity in kW. */
  | { kind: 'power'; kw: number }
  | { kind: 'bossKills'; count: number }
  | { kind: 'collect'; count: number }
  | { kind: 'launch' };

export const MISSION_IDS = [
  'first_drill',
  'conveyor',
  'ore_flow',
  'smelter',
  'power_on',
  'plates',
  'defense',
  'first_night',
  'lab',
  'research_2',
  'gears',
  'hunter',
  'circuits',
  'scavenger',
  'steel',
  'nights_5',
  'research_10',
  'power_grid',
  'titanium',
  'boss',
  'processors',
  'research_25',
  'silo',
  'escape',
] as const;

export type MissionId = (typeof MISSION_IDS)[number];

export interface MissionDef {
  id: MissionId;
  goal: MissionGoal;
  reward: readonly ItemStack[];
  unlock?: AbilityId;
}

function m(id: MissionId, goal: MissionGoal, reward: [ItemId, number][], unlock?: AbilityId): MissionDef {
  return { id, goal, reward: reward.map(([item, amount]) => ({ item, amount })), unlock };
}

/** The story chain; doubles as the tutorial. One mission is active at a time. */
export const MISSIONS: readonly MissionDef[] = [
  m('first_drill', { kind: 'build', building: 'mech_drill', count: 2 }, [['iron_plate', 40], ['copper_plate', 20]]),
  m('conveyor', { kind: 'build', building: 'conveyor', count: 12 }, [['iron_plate', 30]]),
  m('ore_flow', { kind: 'produce', item: 'iron_ore', count: 40 }, [['copper_plate', 30], ['coal', 20]]),
  m('smelter', { kind: 'build', building: 'furnace', count: 2 }, [['stone', 40]]),
  m('power_on', { kind: 'power', kw: 100 }, [['coal', 40], ['iron_plate', 30]]),
  m('plates', { kind: 'produce', item: 'iron_plate', count: 40 }, [['gear', 20], ['copper_wire', 20]]),
  m('defense', { kind: 'build', building: 'mg_turret', count: 2 }, [['basic_ammo', 80]]),
  m('first_night', { kind: 'nights', count: 1 }, [['iron_plate', 120], ['copper_plate', 60]], 'orbital'),
  m('lab', { kind: 'build', building: 'lab', count: 1 }, [['copper_plate', 50]]),
  m('research_2', { kind: 'research', count: 2 }, [['iron_plate', 80], ['gear', 30]]),
  m('gears', { kind: 'produce', item: 'gear', count: 60 }, [['brick', 40], ['stone', 60]]),
  m('hunter', { kind: 'kills', count: 30 }, [['basic_ammo', 120]], 'repair'),
  m('circuits', { kind: 'produce', item: 'circuit', count: 40 }, [['copper_wire', 80], ['iron_plate', 60]]),
  m('scavenger', { kind: 'collect', count: 1 }, [['steel', 20]]),
  m('steel', { kind: 'produce', item: 'steel', count: 50 }, [['coal', 80], ['iron_plate', 100]]),
  m('nights_5', { kind: 'nights', count: 5 }, [['steel', 40], ['circuit', 20]], 'overclock'),
  m('research_10', { kind: 'research', count: 10 }, [['circuit', 40], ['steel', 40]]),
  m('power_grid', { kind: 'power', kw: 600 }, [['battery', 20]]),
  m('titanium', { kind: 'produce', item: 'titanium_plate', count: 60 }, [['steel', 60], ['glass', 40]]),
  m('boss', { kind: 'bossKills', count: 1 }, [['alloy', 20], ['processor', 10]], 'cryo'),
  m('processors', { kind: 'produce', item: 'processor', count: 30 }, [['energy_cell', 20]]),
  m('research_25', { kind: 'research', count: 25 }, [['alloy', 40], ['processor', 20]]),
  m('silo', { kind: 'build', building: 'rocket_silo', count: 1 }, [['heat_shield', 20], ['rocket_fuel', 20], ['processor', 20]]),
  m('escape', { kind: 'launch' }, []),
];


/** Goals that need enemies; they are skipped (keeping their unlocks) when attacks are off. */
export function needsEnemies(goal: MissionGoal): boolean {
  return goal.kind === 'kills' || goal.kind === 'bossKills';
}
