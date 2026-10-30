import type { Building, BuildingConfig } from '../entities/Building';
import { BUILDINGS, type BuildingKind, isBuildingKind } from '../data/buildings';
import { BLUEPRINT_KEY } from '../data/constants';
import { isItemId, type ItemStack } from '../data/items';
import { isRecipeId } from '../data/recipes';
import { mergeStacks } from './inventory';
import { canPlace, placeBuilding } from './placement';
import { playSound } from '../core/grid';
import { isDir, rotateCW, type Dir, type TileXY } from '../core/types';
import type { World } from '../core/World';

export interface BlueprintPart {
  kind: BuildingKind;
  dx: number;
  dy: number;
  rot: Dir;
  recipe?: string | null;
  filter?: string | null;
  tunnelMode?: 'in' | 'out';
}

export interface Blueprint {
  name: string;
  width: number;
  height: number;
  parts: BlueprintPart[];
}

function configOf(b: Building): Pick<BlueprintPart, 'recipe' | 'filter' | 'tunnelMode'> {
  const out: Pick<BlueprintPart, 'recipe' | 'filter' | 'tunnelMode'> = {};
  if (b.crafter) out.recipe = b.crafter.recipe;
  if (b.sorter) out.filter = b.sorter.filter;
  if (b.inserter) out.filter = b.inserter.filter;
  if (b.tunnel) out.tunnelMode = b.tunnel.mode;
  return out;
}

/** Captures every building whose top-left tile lies within the selection rectangle (inclusive). */
export function captureBlueprint(world: World, ax: number, ay: number, bx: number, by: number, name = 'Blueprint'): Blueprint {
  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  const minY = Math.min(ay, by);
  const maxY = Math.max(ay, by);
  const seen = new Set<number>();
  const parts: BlueprintPart[] = [];
  let originX = Infinity;
  let originY = Infinity;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const id = world.occupancy[y * world.width + x] ?? 0;
      if (id === 0 || seen.has(id)) continue;
      const b = world.buildings.get(id);
      if (!b || b.kind === 'core') continue;
      if (b.x < minX || b.y < minY || b.x + b.size - 1 > maxX || b.y + b.size - 1 > maxY) continue;
      seen.add(id);
      originX = Math.min(originX, b.x);
      originY = Math.min(originY, b.y);
      parts.push({ kind: b.kind, dx: b.x, dy: b.y, rot: b.rot, ...configOf(b) });
    }
  }
  if (!Number.isFinite(originX)) {
    originX = 0;
    originY = 0;
  }
  let width = 0;
  let height = 0;
  for (const p of parts) {
    p.dx -= originX;
    p.dy -= originY;
    width = Math.max(width, p.dx + BUILDINGS[p.kind].size);
    height = Math.max(height, p.dy + BUILDINGS[p.kind].size);
  }
  return { name, width, height, parts };
}

/** Rotates a blueprint 90° clockwise around its bounding box. */
export function rotateBlueprint(bp: Blueprint): Blueprint {
  const parts = bp.parts.map((p) => {
    const size = BUILDINGS[p.kind].size;
    // (dx, dy) top-left maps so the part stays inside the rotated box.
    const ndx = bp.height - p.dy - size;
    const ndy = p.dx;
    return { ...p, dx: ndx, dy: ndy, rot: rotateCW(p.rot) };
  });
  return { name: bp.name, width: bp.height, height: bp.width, parts };
}

export function blueprintCost(bp: Blueprint): ItemStack[] {
  const stacks: ItemStack[] = [];
  for (const p of bp.parts) for (const s of BUILDINGS[p.kind].cost) stacks.push(s);
  return mergeStacks(stacks);
}

export interface PastePlan {
  tiles: { part: BlueprintPart; x: number; y: number; ok: boolean }[];
  placeable: number;
  total: number;
}

/** Previews a paste at origin (ox, oy): which parts would land validly. */
export function planPaste(world: World, bp: Blueprint, ox: number, oy: number): PastePlan {
  const tiles = bp.parts.map((part) => {
    const x = ox + part.dx;
    const y = oy + part.dy;
    return { part, x, y, ok: canPlace(world, part.kind, x, y).ok };
  });
  return { tiles, placeable: tiles.filter((t) => t.ok).length, total: tiles.length };
}

export interface PasteResult {
  placed: number;
  skipped: number;
}

/** Places every affordable, valid part of a blueprint. Parts that don't fit or aren't affordable are skipped. */
export function pasteBlueprint(world: World, bp: Blueprint, ox: number, oy: number): PasteResult {
  let placed = 0;
  let skipped = 0;
  for (const part of bp.parts) {
    const config: BuildingConfig = {};
    if (part.recipe !== undefined && (part.recipe === null || isRecipeId(part.recipe))) config.recipe = part.recipe;
    if (part.filter !== undefined) config.filter = part.filter && isItemId(part.filter) ? part.filter : null;
    if (part.tunnelMode !== undefined) config.tunnelMode = part.tunnelMode;
    const res = placeBuilding(world, part.kind, ox + part.dx, oy + part.dy, part.rot, { silent: true, config });
    if (res.ok) placed++;
    else skipped++;
  }
  if (placed > 0) playSound(world, 'place', ox, oy);
  return { placed, skipped };
}

// --- Validation & persistence (localStorage) ---

export function isBlueprint(v: unknown): v is Blueprint {
  if (typeof v !== 'object' || v === null) return false;
  const bp = v as Record<string, unknown>;
  if (typeof bp.name !== 'string' || !Array.isArray(bp.parts)) return false;
  return bp.parts.every((p) => {
    if (typeof p !== 'object' || p === null) return false;
    const part = p as Record<string, unknown>;
    return (
      isBuildingKind(part.kind) &&
      typeof part.dx === 'number' &&
      typeof part.dy === 'number' &&
      isDir(part.rot)
    );
  });
}

export function sanitizeBlueprint(bp: Blueprint): Blueprint {
  const parts = bp.parts.filter((p) => isBuildingKind(p.kind) && BUILDINGS[p.kind].buildable);
  let width = 0;
  let height = 0;
  for (const p of parts) {
    width = Math.max(width, p.dx + BUILDINGS[p.kind].size);
    height = Math.max(height, p.dy + BUILDINGS[p.kind].size);
  }
  return { name: bp.name.slice(0, 40), width, height, parts };
}

export function loadBlueprints(storage: Storage): Blueprint[] {
  try {
    const raw = storage.getItem(BLUEPRINT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBlueprint).map(sanitizeBlueprint);
  } catch {
    return [];
  }
}

export function saveBlueprints(storage: Storage, blueprints: readonly Blueprint[]): void {
  try {
    storage.setItem(BLUEPRINT_KEY, JSON.stringify(blueprints.slice(0, 50)));
  } catch {
    // Storage full or unavailable: blueprints simply won't persist this session.
  }
}

export function blueprintFootprint(bp: Blueprint): TileXY[] {
  const tiles: TileXY[] = [];
  for (const p of bp.parts) {
    const size = BUILDINGS[p.kind].size;
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) tiles.push({ x: p.dx + dx, y: p.dy + dy });
  }
  return tiles;
}
