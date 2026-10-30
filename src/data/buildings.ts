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

export const CATEGORY_LABEL: Record<BuildCategory, string> = {
  logistics: '물류',
  production: '생산',
  power: '전력',
  defense: '방어',
  science: '연구',
};

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
  name: string;
  desc: string;
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
    kind: 'core', name: '식민지 코어', desc: '모든 자원이 모이는 본부. 파괴되면 패배합니다.', category: 'logistics',
    size: 3, hp: 5000, cost: [], rotatable: false, solid: true, lineBuild: false, buildable: false, color: '#22d3ee',
  },
  conveyor: {
    kind: 'conveyor', name: '컨베이어 벨트', desc: '아이템을 초당 6.4개 운반합니다. 드래그로 연속 설치.', category: 'logistics',
    size: 1, hp: 60, cost: c(['iron_plate', 1]), rotatable: true, solid: false, lineBuild: true, buildable: true, color: '#6b7280',
  },
  fast_conveyor: {
    kind: 'fast_conveyor', name: '고속 컨베이어', desc: '일반 벨트의 2배 속도(초당 12.8개).', category: 'logistics',
    size: 1, hp: 90, cost: c(['steel', 1], ['gear', 1]), rotatable: true, solid: false, lineBuild: true, buildable: true, color: '#3b82f6',
  },
  router: {
    kind: 'router', name: '분배기', desc: '들어온 방향을 제외한 출구로 1:1 번갈아 분배합니다.', category: 'logistics',
    size: 1, hp: 80, cost: c(['iron_plate', 3], ['copper_plate', 2]), rotatable: false, solid: true, lineBuild: false, buildable: true, color: '#a3a3a3',
  },
  bridge: {
    kind: 'bridge', name: '교차 다리', desc: '바라보는 방향 4칸 이내의 다리로 아이템을 점프시킵니다.', category: 'logistics',
    size: 1, hp: 80, cost: c(['iron_plate', 6], ['gear', 2]), rotatable: true, solid: false, lineBuild: false, buildable: true, color: '#fbbf24',
  },
  tunnel: {
    kind: 'tunnel', name: '지하 터널 벨트', desc: '입구→출구(5칸 이내)로 지하 운송. 위에 무엇이든 지을 수 있습니다.', category: 'logistics',
    size: 1, hp: 100, cost: c(['iron_plate', 8], ['brick', 4]), rotatable: true, solid: false, lineBuild: false, buildable: true, color: '#78716c',
  },
  sorter: {
    kind: 'sorter', name: '필터 분류기', desc: '필터 아이템은 직진, 나머지는 좌/우로 보냅니다.', category: 'logistics',
    size: 1, hp: 80, cost: c(['iron_plate', 2], ['copper_plate', 2]), rotatable: false, solid: true, lineBuild: false, buildable: true, color: '#e879f9',
  },
  container: {
    kind: 'container', name: '창고 컨테이너', desc: '아이템 400개 저장. 투입기로 꺼낼 수 있습니다.', category: 'logistics',
    size: 2, hp: 400, cost: c(['iron_plate', 20], ['brick', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true, color: '#a16207',
  },
  inserter: {
    kind: 'inserter', name: '투입기', desc: '뒤쪽 칸에서 아이템을 집어 앞쪽 칸에 넣습니다.', category: 'logistics',
    size: 1, hp: 60, cost: c(['iron_plate', 2], ['gear', 1]), rotatable: true, solid: false, lineBuild: false, buildable: true, color: '#facc15',
  },

  mech_drill: {
    kind: 'mech_drill', name: '기계식 드릴', desc: '전력 없이 광석 채굴(티타늄 불가).', category: 'production',
    size: 2, hp: 250, cost: c(['iron_plate', 10], ['copper_plate', 5]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    pollution: 0.6, color: '#a8a29e',
  },
  electric_drill: {
    kind: 'electric_drill', name: '전기 드릴', desc: '2.4배 빠른 채굴, 티타늄 채굴 가능. 90kW.', category: 'production',
    size: 2, hp: 320, cost: c(['iron_plate', 20], ['circuit', 5], ['gear', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 90 }, pollution: 1, color: '#60a5fa',
  },
  furnace: {
    kind: 'furnace', name: '제련로', desc: '광석을 판재로 제련. 60kW.', category: 'production',
    size: 2, hp: 300, cost: c(['stone', 15], ['iron_plate', 5]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 60 }, pollution: 1.2, color: '#f97316',
  },
  assembler: {
    kind: 'assembler', name: '조립기', desc: '기어·회로·탄약 등을 조립. 75kW.', category: 'production',
    size: 2, hp: 300, cost: c(['iron_plate', 15], ['gear', 5], ['copper_plate', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 75 }, pollution: 0.5, color: '#94a3b8',
  },
  chem_plant: {
    kind: 'chem_plant', name: '화학 공장', desc: '폭약·배터리·연료 합성. 120kW.', category: 'production',
    size: 2, hp: 320, cost: c(['steel', 15], ['glass', 10], ['circuit', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 120 }, pollution: 2, color: '#4ade80',
  },
  adv_assembler: {
    kind: 'adv_assembler', name: '정밀 조립기', desc: '프로세서·로켓 부품 생산. 180kW.', category: 'production',
    size: 3, hp: 450, cost: c(['steel', 20], ['circuit', 15], ['engine_unit', 5], ['titanium_plate', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 180 }, pollution: 1, color: '#2dd4bf',
  },

  thermal_generator: {
    kind: 'thermal_generator', name: '화력 발전기', desc: '석탄을 태워 최대 300kW 발전.', category: 'power',
    size: 2, hp: 300, cost: c(['iron_plate', 15], ['brick', 10], ['copper_plate', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { gen: 300 }, pollution: 2.5, color: '#ef4444',
  },
  solar_panel: {
    kind: 'solar_panel', name: '태양광 패널', desc: '낮에만 최대 40kW 발전.', category: 'power',
    size: 2, hp: 150, cost: c(['copper_plate', 8], ['iron_plate', 4]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { gen: 40 }, color: '#1d4ed8',
  },
  accumulator: {
    kind: 'accumulator', name: '대형 축전지', desc: '남는 전력 5MJ 저장, 최대 300kW 충·방전.', category: 'power',
    size: 2, hp: 250, cost: c(['iron_plate', 10], ['copper_wire', 20], ['circuit', 5]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { storage: 5000, rate: 300 }, color: '#16a34a',
  },
  power_pole: {
    kind: 'power_pole', name: '전신주', desc: '반경 3칸에 전력 공급, 8칸 내 전신주와 자동 연결.', category: 'power',
    size: 1, hp: 80, cost: c(['iron_plate', 1], ['copper_plate', 2]), rotatable: false, solid: true, lineBuild: false, buildable: true, color: '#d6b37a',
  },

  lab: {
    kind: 'lab', name: '연구소', desc: '벨트로 들어온 아이템을 소모해 연구를 진행. 60kW.', category: 'science',
    size: 2, hp: 300, cost: c(['iron_plate', 20], ['copper_plate', 15], ['gear', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 60 }, color: '#818cf8',
  },
  rocket_silo: {
    kind: 'rocket_silo', name: '궤도 탈출 발사대', desc: '로켓 부품 1,000개를 투입하면 로켓 발사 → 승리!', category: 'science',
    size: 4, hp: 3000, cost: c(['steel', 300], ['concrete', 300], ['processor', 100], ['alloy', 100], ['energy_cell', 50]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 250 }, pollution: 3, color: '#f8fafc', maxCount: 1,
  },

  mg_turret: {
    kind: 'mg_turret', name: '기관총 포탑', desc: '일반 탄약/철갑탄 사용. 지상·공중 공격.', category: 'defense',
    size: 1, hp: 380, cost: c(['iron_plate', 15], ['copper_plate', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true, color: '#eab308',
  },
  shotgun_turret: {
    kind: 'shotgun_turret', name: '샷건 포탑', desc: '산탄 사용. 근거리 다수 탄환.', category: 'defense',
    size: 2, hp: 600, cost: c(['iron_plate', 25], ['gear', 10], ['copper_plate', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true, color: '#dc2626',
  },
  cannon_turret: {
    kind: 'cannon_turret', name: '장거리 대포', desc: '폭발탄 사용. 사거리 18, 광역 피해(지상 전용).', category: 'defense',
    size: 2, hp: 700, cost: c(['steel', 30], ['gear', 20], ['circuit', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true, color: '#f97316',
  },
  laser_turret: {
    kind: 'laser_turret', name: '레이저 포탑', desc: '전력 150kW 소모. 지속 광선.', category: 'defense',
    size: 2, hp: 550, cost: c(['steel', 30], ['circuit', 20], ['battery', 10], ['glass', 10]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 150 }, color: '#f43f5e',
  },
  slow_turret: {
    kind: 'slow_turret', name: '냉각(슬로우) 포탑', desc: '전력 90kW. 주변 적을 50% 감속.', category: 'defense',
    size: 2, hp: 500, cost: c(['titanium_plate', 20], ['circuit', 15], ['glass', 15]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 90 }, color: '#38bdf8',
  },
  repair_turret: {
    kind: 'repair_turret', name: '자동 수리 포탑', desc: '전력 70kW. 반경 8칸 건물 자동 수리.', category: 'defense',
    size: 2, hp: 450, cost: c(['iron_plate', 30], ['circuit', 10], ['copper_wire', 20]), rotatable: false, solid: true, lineBuild: false, buildable: true,
    power: { use: 70 }, color: '#4ade80',
  },
  wall: {
    kind: 'wall', name: '방어 성벽', desc: '적의 진로를 막는 돌 성벽. 드래그로 연속 설치.', category: 'defense',
    size: 1, hp: 400, cost: c(['stone', 6]), rotatable: false, solid: true, lineBuild: true, buildable: true, color: '#78716c',
  },
  titanium_wall: {
    kind: 'titanium_wall', name: '강화 성벽', desc: '콘크리트 성벽(내구도 1,200). 드래그로 연속 설치.', category: 'defense',
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
