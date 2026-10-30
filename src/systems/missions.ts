import { MISSIONS, needsEnemies, type MissionDef, type MissionGoal } from '../data/missions';
import { playSound, pushEvent, radio, toast } from '../core/grid';
import type { World } from '../core/World';
import { abilityName, buildingName, itemName, msg, stacksText } from '../utils/i18n';
import { invAddAll } from './inventory';
import { attacksEnabled } from './modifiers';
import { unlockAbility } from './abilities';

export interface MissionState {
  /** Index into MISSIONS of the active mission (MISSIONS.length = all done). */
  index: number;
  /** Counter value when the active mission started (for cumulative goals). */
  baseline: number;
  timer: number;
}

const CHECK_INTERVAL = 0.5;

export function createMissionState(active: boolean): MissionState {
  return { index: active ? 0 : MISSIONS.length, baseline: 0, timer: 0 };
}

export function currentMission(world: World): MissionDef | null {
  return MISSIONS[world.missions.index] ?? null;
}

export function missionTarget(goal: MissionGoal): number {
  switch (goal.kind) {
    case 'power':
      return goal.kw;
    case 'launch':
      return 1;
    default:
      return goal.count;
  }
}

/** Raw counter a goal is measured by. */
export function goalValue(world: World, goal: MissionGoal): number {
  switch (goal.kind) {
    case 'build': {
      let n = 0;
      for (const b of world.buildings.values()) if (b.kind === goal.building) n++;
      return n;
    }
    case 'produce':
      return world.stats.lifetimeTotal('produced', goal.item);
    case 'research':
      return world.research.completed.size;
    case 'kills':
      return world.kills;
    case 'nights':
      return world.counters.nightsSurvived;
    case 'power':
      return Math.floor(world.counters.peakPower);
    case 'bossKills':
      return world.counters.bossKills;
    case 'collect':
      return world.counters.dropsCollected;
    case 'launch':
      return world.counters.launches;
  }
}

function isCumulative(goal: MissionGoal): boolean {
  return goal.kind === 'produce' || goal.kind === 'kills';
}

export function missionProgress(world: World): { current: number; target: number } | null {
  const def = currentMission(world);
  if (!def) return null;
  const target = missionTarget(def.goal);
  const raw = goalValue(world, def.goal) - (isCumulative(def.goal) ? world.missions.baseline : 0);
  return { current: Math.max(0, Math.min(target, raw)), target };
}

export function missionTitle(def: MissionDef): string {
  const t = msg().missions;
  const g = def.goal;
  switch (g.kind) {
    case 'build':
      return t.build(g.count, buildingName(g.building));
    case 'produce':
      return t.produce(g.count, itemName(g.item));
    case 'research':
      return t.research(g.count);
    case 'kills':
      return t.kills(g.count);
    case 'nights':
      return t.nights(g.count);
    case 'power':
      return t.power(g.kw);
    case 'bossKills':
      return t.bossKills(g.count);
    case 'collect':
      return t.collect(g.count);
    case 'launch':
      return t.launch;
  }
}

function startMission(world: World): void {
  const def = currentMission(world);
  world.missions.baseline = def && isCumulative(def.goal) ? goalValue(world, def.goal) : 0;
}

/** Finishes the active mission: reward, unlock, radio line, next mission. */
export function completeMission(world: World, skipped = false): void {
  const def = currentMission(world);
  if (!def) return;
  if (!skipped) {
    invAddAll(world.inventory, def.reward);
    toast(world, msg().toast.missionDone(missionTitle(def), stacksText(def.reward)), 'success');
    radio(world, msg().missionRadio[def.id]);
    playSound(world, 'mission', world.width / 2, world.height / 2);
    pushEvent(world, { type: 'missionComplete', id: def.id });
  }
  // A skipped mission (no enemies in peaceful mode) still grants its unlock so no power is lost.
  if (def.unlock && unlockAbility(world, def.unlock) && !skipped) {
    toast(world, msg().toast.abilityUnlocked(abilityName(def.unlock)), 'success');
  }
  world.missions.index++;
  startMission(world);
}

export function updateMissions(world: World, dt: number): void {
  const m = world.missions;
  if (m.index >= MISSIONS.length) return;
  m.timer += dt;
  if (m.timer < CHECK_INTERVAL) return;
  m.timer = 0;
  // Resolve several at once if they were already satisfied (e.g. after loading a save).
  for (let guard = 0; guard < MISSIONS.length; guard++) {
    const def = currentMission(world);
    if (!def) return;
    if (needsEnemies(def.goal) && !attacksEnabled(world)) {
      completeMission(world, true);
      continue;
    }
    const p = missionProgress(world);
    if (!p || p.current < p.target) return;
    completeMission(world);
  }
}
