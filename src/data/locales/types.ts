import type { AbilityId } from '../abilities';
import type { AchievementId } from '../achievements';
import type { BuildCategory, BuildingKind } from '../buildings';
import type { Difficulty, GameMode, Mutator } from '../difficulty';
import type { EnemyType } from '../enemies';
import type { ItemId } from '../items';
import type { MissionId } from '../missions';
import type { RecipeId } from '../recipes';
import type { ModifierKey, ResearchId } from '../research';
import type { WorldEventId } from '../worldEvents';

export interface NamedText {
  name: string;
  desc: string;
}

export type NodeStatusKey = 'completed' | 'current' | 'available' | 'locked';

/**
 * Every player-facing string. Each locale implements this interface, so a missing or extra
 * translation is a compile error. Strings with values are formatter functions.
 */
export interface Messages {
  langName: string;
  meta: { title: string; tagline: string; description: string };

  items: Record<ItemId, string>;
  buildings: Record<BuildingKind, NamedText>;
  categories: Record<BuildCategory, string>;
  recipes: Record<RecipeId, string>;
  research: Record<ResearchId, NamedText>;
  enemies: Record<EnemyType, NamedText>;
  abilities: Record<AbilityId, NamedText>;
  worldEvents: Record<WorldEventId, NamedText & { radio: string }>;
  achievements: Record<AchievementId, NamedText>;
  missionRadio: Record<MissionId, string>;
  modes: Record<GameMode, NamedText>;
  difficulties: Record<Difficulty, NamedText>;
  mutators: Record<Mutator, NamedText>;
  /** Turret veterancy rank names, index = rank 0..3. */
  ranks: readonly [string, string, string, string];

  common: {
    close: string;
    cancel: string;
    back: string;
    none: string;
    empty: string;
    view: string;
    locked: string;
    seconds: (n: number) => string;
    perMin: (value: string) => string;
    perSec: (value: string) => string;
    itemsCount: (value: string) => string;
  };

  hud: {
    menu: string;
    dayLabel: (day: number, night: boolean) => string;
    enemies: (n: number) => string;
    untilNight: (time: string) => string;
    research: string;
    researchTree: string;
    stats: string;
    pause: string;
    resume: string;
    speed: string;
    coreResources: string;
    coreEmpty: string;
    rocket: string;
    pollution: (value: string) => string;
    minimap: string;
    zoomIn: string;
    zoomOut: string;
    zoom: string;
    toCore: string;
    canvas: string;
    boss: (name: string) => string;
  };

  power: {
    title: string;
    gen: string;
    use: string;
    batt: string;
    aria: (pct: string) => string;
    generation: string;
    capacity: string;
    demand: string;
    battery: string;
    noBattery: string;
    flow: string;
    networks: string;
    ok: string;
    overloaded: (grids: number, pct: string) => string;
    starved: (grids: number) => string;
    unpowered: (buildings: number) => string;
  };

  build: {
    select: string;
    demolish: string;
    rotate: string;
    rotateDir: (arrow: string) => string;
    blueprints: string;
    cancelBuild: string;
    cancelTool: string;
    needResearch: (name: string) => string;
    buttonAria: (name: string, unlocked: boolean, affordable: boolean) => string;
    consumes: (kw: number) => string;
    generates: (kw: number) => string;
    range: (tiles: number) => string;
    dragHint: string;
    demolishHint: string;
    selectHint: string;
    pasteHint: (name: string) => string;
    pasteRotate: string;
    pasteCancel: string;
    targetHint: (name: string) => string;
    targetCancel: string;
  };

  reasons: {
    notBuildable: string;
    needResearch: string;
    unique: string;
    outOfBounds: string;
    overlap: string;
    water: string;
    needOre: string;
    needOreMech: string;
    lacking: string;
    lineFailed: string;
    recipeLocked: string;
  };

  inspector: {
    info: (name: string) => string;
    buildSame: string;
    storedTotal: string;
    coreDesc: string;
    carrying: string;
    throughput: string;
    state: string;
    moving: string;
    jammed: string;
    holding: string;
    sorterDesc: string;
    filter: (name: string) => string;
    inserterDesc: string;
    link: string;
    bridgeLink: (tiles: number) => string;
    bridgeNone: string;
    inTransit: string;
    bridgeDesc: string;
    tunnelType: string;
    entrance: string;
    exit: string;
    tunnelLink: (tiles: number, fromEntrance: boolean) => string;
    tunnelDesc: string;
    capacity: string;
    containerDesc: string;
    ore: string;
    oreTiles: string;
    mineRate: string;
    outputWaiting: string;
    drillDesc: string;
    recipes: string;
    chooseRecipe: string;
    stock: (n: number) => string;
    maxRate: (value: string) => string;
    running: string;
    slowPower: (pct: string) => string;
    waiting: string;
    recipeNeeds: (name: string) => string;
    fuel: string;
    output: string;
    burning: string;
    generatorDesc: string;
    maxOutput: string;
    solarNote: (kw: string) => string;
    charge: string;
    energy: string;
    gridGen: string;
    gridDemand: string;
    supply: string;
    linked: string;
    poleDesc: string;
    labCurrent: string;
    labNone: string;
    labSpeed: string;
    labEmpty: string;
    rocketParts: string;
    partsWaiting: string;
    siloDesc: string;
    rangeLabel: string;
    rangeTiles: (tiles: number, groundOnly: boolean) => string;
    ammo: string;
    ammoLine: (name: string, current: number, max: number) => string;
    ammoAccepts: string;
    ammoFeed: string;
    energyWeapon: string;
    status: string;
    engaging: string;
    idle: string;
    rank: string;
    kills: string;
    nextRank: (kills: number) => string;
    noPower: string;
    lowPower: (pct: string, kw: string) => string;
    powerOk: (kw: string) => string;
  };

  researchUi: {
    title: (done: number) => string;
    current: (name: string) => string;
    pickHint: string;
    tier: (n: number) => string;
    status: Record<NodeStatusKey, string>;
    unlocks: string;
    start: string;
    stop: string;
    feedHint: string;
    needs: (list: string) => string;
    done: string;
    effects: Record<ModifierKey, string>;
  };

  stats: {
    title: string;
    empty: string;
    legendNote: string;
    itemCol: string;
    producedCol: string;
    consumedCol: string;
    netCol: string;
    stockCol: string;
    ago: (minutes: string) => string;
    now: string;
    chart: string;
  };

  menu: {
    title: string;
    saveNow: string;
    saved: string;
    load: string;
    exportJson: string;
    importJson: string;
    exported: string;
    imported: string;
    notSave: string;
    tooBig: string;
    readFail: string;
    noSave: string;
    loadedLast: string;
    autosave: (ago: string, seed: number) => string;
    never: string;
    secondsAgo: (n: number) => string;
    minutesAgo: (n: number) => string;
    settings: string;
    achievements: string;
    codex: string;
    help: string;
    quit: string;
    saveFailed: string;
  };

  settings: {
    title: string;
    language: string;
    mute: string;
    unmute: string;
    music: string;
    sfx: string;
    pollutionMap: (shown: boolean) => string;
  };

  setup: {
    title: string;
    mode: string;
    difficulty: string;
    seed: string;
    random: string;
    start: string;
    discardWarn: string;
    daily: (date: string) => string;
    dailyBest: (score: string) => string;
    dailyNone: string;
    mutator: string;
    seedLocked: string;
    landed: (seed: number) => string;
  };

  title: {
    continue: string;
    continueInfo: (day: number, mode: string) => string;
    newGame: string;
    daily: string;
    footer: string;
    version: (v: string) => string;
  };

  blueprint: {
    title: string;
    newCapture: string;
    empty: string;
    size: (count: number, w: number, h: number) => string;
    paste: string;
    remove: (name: string) => string;
    saveTitle: string;
    copied: (count: number, w: number, h: number) => string;
    placeholder: string;
    nameAria: string;
    saveAndPaste: string;
    savedToast: (name: string) => string;
    defaultName: (n: number) => string;
    pasteFailed: string;
    pasted: (placed: number, skipped: number) => string;
    emptySelection: string;
  };

  help: {
    title: string;
    goalTitle: string;
    goal: string;
    controlsTitle: string;
    controls: readonly string[];
    tipsTitle: string;
    tips: readonly string[];
  };

  end: {
    victory: string;
    victoryDesc: string;
    defeat: string;
    defeatDesc: string;
    playTime: string;
    days: string;
    nights: string;
    kills: string;
    research: string;
    keepPlaying: string;
    loadLast: string;
    newGame: string;
    toTitle: string;
    newRecord: string;
  };

  score: {
    title: string;
    kills: string;
    nights: string;
    research: string;
    production: string;
    missions: string;
    victory: string;
    speed: string;
    multiplier: (difficulty: string) => string;
    total: string;
    highScores: string;
    none: string;
    entry: (mode: string, difficulty: string, day: number, victory: boolean) => string;
  };

  share: {
    button: string;
    text: (score: string, day: number, victory: boolean) => string;
    shared: string;
    downloaded: string;
    failed: string;
  };

  toast: {
    researchDone: (name: string, unlocks: string) => string;
    nightStart: (night: number, threat: number) => string;
    raid: (n: number) => string;
    launch: string;
    underAttack: string;
    missionDone: (title: string, reward: string) => string;
    abilityUnlocked: (name: string) => string;
    achievement: (name: string) => string;
    newSpecies: (name: string) => string;
    pickupCollected: (loot: string) => string;
    pickupLanded: string;
    pickupExpired: string;
    rankUp: (building: string, rank: string) => string;
    bossIncoming: (name: string) => string;
    abilityCooldown: (name: string, seconds: number) => string;
    repairDone: (n: number) => string;
    overclockOn: string;
    cryoOn: (n: number) => string;
    orbitalFired: string;
    meteorImpact: string;
  };

  missions: {
    title: string;
    progress: (current: number, target: number) => string;
    allDone: string;
    hide: string;
    reward: string;
    unlock: (name: string) => string;
    build: (n: number, name: string) => string;
    produce: (n: number, name: string) => string;
    research: (n: number) => string;
    kills: (n: number) => string;
    nights: (n: number) => string;
    power: (kw: number) => string;
    bossKills: (n: number) => string;
    collect: (n: number) => string;
    launch: string;
  };

  abilityUi: {
    bar: string;
    ready: string;
    cooldown: (seconds: number) => string;
    locked: string;
    lockedHint: string;
    active: (seconds: number) => string;
  };

  eventsUi: {
    active: (name: string, seconds: number) => string;
    bloodMoon: string;
  };

  achievementsUi: {
    title: string;
    count: (n: number, total: number) => string;
    unlockedOn: (date: string) => string;
    sandboxNote: string;
  };

  codex: {
    title: string;
    count: (n: number, total: number) => string;
    unknown: string;
    unknownHint: string;
    hp: string;
    armor: string;
    speed: string;
    damage: string;
    range: string;
    flying: string;
    ground: string;
    firstNight: (n: number) => string;
    salvage: string;
  };

  radio: {
    speaker: string;
    intro: string;
    dawn: (day: number) => string;
  };
}
