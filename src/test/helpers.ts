import type { Building, BuildingConfig } from '../entities/Building';
import type { BuildingKind } from '../data/buildings';
import { SIM_DT } from '../data/constants';
import type { ItemId } from '../data/items';
import { RESEARCH } from '../data/research';
import { stepWorld } from '../core/engine';
import { createWorld, type World } from '../core/World';
import { DX, DY, opposite, type Dir } from '../core/types';
import { beltInsert } from '../systems/belts';
import { invTotal } from '../systems/inventory';
import { placeBuilding } from '../systems/placement';

/**
 * Headless flat test world: no terrain features, no nests, every building/recipe unlocked
 * (research flags only, so modifiers stay at 1.0), and no night wave in the first day cycle.
 */
export function testWorld(size = 32, opts: { core?: boolean } = {}): World {
  const w = createWorld({ seed: 7, width: size, height: size, flat: true, withCore: opts.core ?? false });
  w.visuals = false;
  w.waves.triggered = true;
  for (const n of RESEARCH) w.research.completed.add(n.id);
  return w;
}

/** Places a building through the real placement rules (free of cost); throws when placement is invalid. */
export function put(w: World, kind: BuildingKind, x: number, y: number, rot: Dir = 0, config: BuildingConfig = {}): Building {
  const res = placeBuilding(w, kind, x, y, rot, { free: true, silent: true, config });
  if (!res.ok || !res.building) throw new Error(`cannot place ${kind} at ${x},${y}: ${res.reason ?? '?'}`);
  return res.building;
}

/** `n` belts starting at (x, y) and stepping in direction `rot`, all facing `rot`. */
export function beltLine(w: World, x: number, y: number, n: number, rot: Dir, kind: BuildingKind = 'conveyor'): Building[] {
  const out: Building[] = [];
  for (let i = 0; i < n; i++) out.push(put(w, kind, x + (DX[rot] ?? 0) * i, y + (DY[rot] ?? 0) * i, rot));
  return out;
}

export function setOre(w: World, x: number, y: number, size: number, ore: number): void {
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) w.ore[(y + dy) * w.width + (x + dx)] = ore;
}

/** Thermal generator that never runs out of fuel (300 kW). */
export function endlessGenerator(w: World, x: number, y: number): Building {
  const g = put(w, 'thermal_generator', x, y);
  if (g.generator) {
    g.generator.fuel = 10;
    g.generator.burn = 1e12;
  }
  return g;
}

export function ticks(seconds: number): number {
  return Math.round(seconds / SIM_DT);
}

export function run(w: World, seconds: number): void {
  for (let i = 0, n = ticks(seconds); i < n; i++) stepWorld(w);
}

/** Simulates while pushing `items` (in order) onto the back of `belt` whenever there is room. Returns how many were fed. */
export function runFeeding(w: World, belt: Building, items: readonly ItemId[], seconds: number): number {
  let fed = 0;
  for (let i = 0, n = ticks(seconds); i < n; i++) {
    const next = items[fed];
    if (next && beltInsert(belt, next, opposite(belt.rot))) fed++;
    stepWorld(w);
  }
  return fed;
}

export function stored(b: Building): number {
  return b.storage ? invTotal(b.storage.items) : 0;
}

export function repeat<T>(value: T, n: number): T[] {
  return Array.from({ length: n }, () => value);
}

export function beltItemCount(belts: readonly Building[]): number {
  return belts.reduce((s, b) => s + (b.belt?.items.length ?? 0), 0);
}
