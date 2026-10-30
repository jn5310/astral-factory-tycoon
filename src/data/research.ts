import type { BuildingKind } from './buildings';
import type { ItemId, ItemStack } from './items';
import type { RecipeId } from './recipes';

export type ModifierKey = 'drillSpeed' | 'ammoDamage' | 'laserDamage' | 'buildingHp' | 'generatorOutput';

export interface ResearchEffect {
  key: ModifierKey;
  /** Additive bonus, e.g. 0.2 = +20%. */
  value: number;
}

export interface ResearchDef {
  id: string;
  name: string;
  desc: string;
  tier: 1 | 2 | 3 | 4 | 5;
  /** Row inside its tier column (0..6), used by the tech tree layout. */
  row: number;
  cost: readonly ItemStack[];
  prereqs: readonly string[];
  buildings: readonly BuildingKind[];
  recipes: readonly RecipeId[];
  effects: readonly ResearchEffect[];
}

function node(
  id: string,
  name: string,
  desc: string,
  tier: ResearchDef['tier'],
  row: number,
  cost: [ItemId, number][],
  prereqs: string[],
  unlock: { buildings?: BuildingKind[]; recipes?: RecipeId[]; effects?: ResearchEffect[] } = {},
): ResearchDef {
  return {
    id,
    name,
    desc,
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
  node('logistics', '기초 물류', '분배기(1:1 분배) 해금', 1, 0, [['iron_plate', 30], ['copper_plate', 20]], [], {
    buildings: ['router'],
  }),
  node('storage', '창고 시스템', '창고 컨테이너 해금', 1, 1, [['iron_plate', 40], ['brick', 20]], [], { buildings: ['container'] }),
  node('sorting', '아이템 분류', '필터 분류기 해금', 1, 2, [['iron_plate', 30], ['gear', 15]], [], { buildings: ['sorter'] }),
  node('glass', '유리 제련', '유리 레시피 해금', 1, 3, [['copper_plate', 30], ['stone', 30]], [], { recipes: ['glass'] }),
  node('circuits', '전자 회로', '전자회로 레시피 해금', 1, 4, [['copper_plate', 40], ['iron_plate', 30], ['copper_wire', 30]], [], {
    recipes: ['circuit'],
  }),
  node('ballistics_1', '탄도학 I', '실탄 포탑 피해 +20%', 1, 5, [['basic_ammo', 30], ['iron_plate', 30]], [], {
    effects: [{ key: 'ammoDamage', value: 0.2 }],
  }),
  node('mining_1', '채굴 효율 I', '드릴 속도 +20%', 1, 6, [['iron_plate', 40], ['gear', 20]], [], {
    effects: [{ key: 'drillSpeed', value: 0.2 }],
  }),

  // ---------- Tier 2: automation ----------
  node('bridge', '교차 다리', '벨트 위를 점프하는 다리 해금', 2, 0, [['gear', 40], ['iron_plate', 50]], ['logistics'], {
    buildings: ['bridge'],
  }),
  node('tunnel', '지하 터널 벨트', '지하 터널 벨트 해금', 2, 1, [['gear', 40], ['brick', 40]], ['logistics'], { buildings: ['tunnel'] }),
  node('steel', '강철 제련', '강철 레시피 해금', 2, 2, [['iron_plate', 80], ['coal', 40]], ['mining_1'], { recipes: ['steel'] }),
  node('electric_drill', '전기 드릴', '전기 드릴 해금(티타늄 채굴)', 2, 3, [['circuit', 30], ['gear', 40]], ['mining_1', 'circuits'], {
    buildings: ['electric_drill'],
  }),
  node('accumulator', '대형 축전지', '축전지 해금', 2, 4, [['circuit', 30], ['copper_wire', 60]], ['circuits'], {
    buildings: ['accumulator'],
  }),
  node('shotgun', '샷건 포탑', '샷건 포탑 + 산탄 해금', 2, 5, [['basic_ammo', 50], ['gear', 30]], ['ballistics_1'], {
    buildings: ['shotgun_turret'],
    recipes: ['shotgun_shell'],
  }),
  node('concrete', '콘크리트 성벽', '콘크리트 + 강화 성벽 해금', 2, 6, [['brick', 60], ['glass', 30]], ['storage', 'glass'], {
    buildings: ['titanium_wall'],
    recipes: ['concrete'],
  }),

  // ---------- Tier 3: industry ----------
  node('silicon', '실리콘 제련', '실리콘 레시피 해금', 3, 0, [['glass', 50], ['steel', 30]], ['steel', 'glass'], { recipes: ['silicon'] }),
  node('fast_belt', '고속 컨베이어', '고속 컨베이어 해금', 3, 1, [['steel', 40], ['gear', 60]], ['bridge', 'steel'], {
    buildings: ['fast_conveyor'],
  }),
  node('chemistry', '화학 공정', '화학 공장 + 폭약·배터리·폭발탄 해금', 3, 2, [['steel', 50], ['glass', 50], ['circuit', 40]], ['steel', 'accumulator', 'glass'], {
    buildings: ['chem_plant'],
    recipes: ['explosive', 'battery', 'explosive_ammo'],
  }),
  node('cannon', '장거리 대포', '장거리 대포 해금(탄약: 폭발탄)', 3, 3, [['steel', 60], ['circuit', 40]], ['shotgun', 'steel', 'circuits'], {
    buildings: ['cannon_turret'],
  }),
  node('ap_ammo', '철갑탄', '철갑탄 레시피 해금', 3, 4, [['steel', 40], ['basic_ammo', 80]], ['steel', 'ballistics_1'], {
    recipes: ['ap_ammo'],
  }),
  node('titanium', '티타늄 가공', '티타늄판 레시피 해금', 3, 5, [['steel', 50], ['circuit', 40]], ['electric_drill', 'steel'], {
    recipes: ['titanium_plate'],
  }),
  node('repair', '자동 수리 포탑', '자동 수리 포탑 해금', 3, 6, [['circuit', 50], ['concrete', 40]], ['concrete', 'accumulator'], {
    buildings: ['repair_turret'],
  }),

  // ---------- Tier 4: advanced ----------
  node('engine', '엔진 유닛', '엔진 유닛 레시피 해금', 4, 0, [['steel', 80], ['gear', 80]], ['fast_belt'], { recipes: ['engine_unit'] }),
  node('laser', '레이저 포탑', '레이저 포탑 해금', 4, 1, [['silicon', 60], ['battery', 40], ['circuit', 60]], ['silicon', 'chemistry'], {
    buildings: ['laser_turret'],
  }),
  node('slow', '냉각 포탑', '냉각(슬로우) 포탑 해금', 4, 2, [['titanium_plate', 50], ['silicon', 40]], ['titanium', 'silicon'], {
    buildings: ['slow_turret'],
  }),
  node('alloy', '강화 합금', '강화 합금 레시피 해금', 4, 3, [['titanium_plate', 60], ['steel', 60]], ['titanium'], { recipes: ['alloy'] }),
  node('adv_assembly', '정밀 조립', '정밀 조립기 + 프로세서 해금', 4, 4, [['circuit', 100], ['silicon', 60], ['engine_unit', 20]], ['engine', 'silicon', 'titanium'], {
    buildings: ['adv_assembler'],
    recipes: ['processor'],
  }),
  node('energy_cell', '에너지 셀', '에너지 셀 레시피 해금', 4, 5, [['battery', 60], ['silicon', 40]], ['chemistry', 'silicon'], {
    recipes: ['energy_cell'],
  }),
  node('ballistics_2', '탄도학 II', '실탄 포탑 피해 +30%', 4, 6, [['ap_ammo', 60], ['explosive_ammo', 30]], ['ap_ammo', 'cannon', 'chemistry'], {
    effects: [{ key: 'ammoDamage', value: 0.3 }],
  }),

  // ---------- Tier 5: escape ----------
  node('rocket_fuel', '로켓 연료', '로켓 연료 레시피 해금', 5, 0, [['explosive', 100], ['energy_cell', 40]], ['energy_cell'], {
    recipes: ['rocket_fuel'],
  }),
  node('heat_shield', '내열 차폐', '내열 차폐판 레시피 해금', 5, 1, [['alloy', 80], ['brick', 100]], ['alloy', 'adv_assembly'], {
    recipes: ['heat_shield'],
  }),
  node('rocket_part', '로켓 부품', '로켓 부품 레시피 해금', 5, 2, [['processor', 60], ['alloy', 60]], ['rocket_fuel', 'heat_shield'], {
    recipes: ['rocket_part'],
  }),
  node('rocket_silo', '궤도 탈출 발사대', '최종 목표: 로켓 발사대 해금', 5, 3, [['processor', 100], ['energy_cell', 100], ['alloy', 100]], ['rocket_part', 'concrete'], {
    buildings: ['rocket_silo'],
  }),
  node('mining_2', '채굴 효율 II', '드릴 속도 +30%', 5, 4, [['engine_unit', 40], ['processor', 20]], ['adv_assembly'], {
    effects: [{ key: 'drillSpeed', value: 0.3 }],
  }),
  node('power_2', '고효율 발전', '발전량 +25%', 5, 5, [['energy_cell', 60], ['alloy', 40]], ['energy_cell', 'alloy'], {
    effects: [{ key: 'generatorOutput', value: 0.25 }],
  }),
  node('defense_matrix', '방어 매트릭스', '레이저 피해 +40%, 건물 내구도 +50%', 5, 6, [['battery', 80], ['processor', 40], ['steel', 100]], ['laser', 'adv_assembly'], {
    effects: [
      { key: 'laserDamage', value: 0.4 },
      { key: 'buildingHp', value: 0.5 },
    ],
  }),
];

export const RESEARCH_BY_ID: ReadonlyMap<string, ResearchDef> = new Map(RESEARCH.map((n) => [n.id, n]));

export function isResearchId(v: unknown): v is string {
  return typeof v === 'string' && RESEARCH_BY_ID.has(v);
}
