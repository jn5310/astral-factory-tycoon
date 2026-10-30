import type { Building } from '../entities/Building';
import { Terrain } from '../data/terrain';
import type { GameEvent, SoundName, ToastLevel } from './events';
import type { TileXY } from './types';
import type { World } from './World';

export function inBounds(w: World, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < w.width && y < w.height;
}

export function tileIndex(w: World, x: number, y: number): number {
  return y * w.width + x;
}

export function buildingAt(w: World, x: number, y: number): Building | undefined {
  if (x < 0 || y < 0 || x >= w.width || y >= w.height) return undefined;
  const id = w.occupancy[y * w.width + x] ?? 0;
  return id === 0 ? undefined : w.buildings.get(id);
}

export function buildingAtIndex(w: World, idx: number): Building | undefined {
  const id = w.occupancy[idx] ?? 0;
  return id === 0 ? undefined : w.buildings.get(id);
}

export function terrainAt(w: World, x: number, y: number): number {
  if (!inBounds(w, x, y)) return Terrain.Rock;
  return w.terrain[y * w.width + x] ?? Terrain.Rock;
}

export function oreAt(w: World, x: number, y: number): number {
  if (!inBounds(w, x, y)) return 0;
  return w.ore[y * w.width + x] ?? 0;
}

export function pushEvent(w: World, e: GameEvent): void {
  // Bound the queue so a headless world (tests) never grows without limit.
  if (w.events.length < 512) w.events.push(e);
}

export function playSound(w: World, sound: SoundName, x: number, y: number): void {
  pushEvent(w, { type: 'sound', sound, x, y });
}

export function toast(w: World, message: string, level: ToastLevel = 'info', focus?: TileXY): void {
  pushEvent(w, focus ? { type: 'toast', message, level, focus } : { type: 'toast', message, level });
}

/** A Mission Control transmission shown in the radio box. */
export function radio(w: World, text: string): void {
  pushEvent(w, { type: 'radio', text });
}

/** Marks that buildings changed: paths, belt order, links and power must be recomputed. */
export function markMapChanged(w: World): void {
  w.mapVersion++;
  w.logisticsDirty = true;
  w.power.dirty = true;
}
