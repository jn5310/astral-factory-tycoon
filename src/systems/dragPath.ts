import { BUILDINGS, type BuildingKind } from '../data/buildings';
import { dirFromDelta, type Dir, type TileXY } from '../core/types';

export interface LinePlacement {
  x: number;
  y: number;
  rot: Dir;
}

/** 4-connected tiles from a to b along an L (dominant axis first). Includes both ends. */
export function orthoConnect(a: TileXY, b: TileXY): TileXY[] {
  const tiles: TileXY[] = [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const horizFirst = Math.abs(dx) >= Math.abs(dy);
  let x = a.x;
  let y = a.y;
  tiles.push({ x, y });
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  if (horizFirst) {
    while (x !== b.x) {
      x += stepX;
      tiles.push({ x, y });
    }
    while (y !== b.y) {
      y += stepY;
      tiles.push({ x, y });
    }
  } else {
    while (y !== b.y) {
      y += stepY;
      tiles.push({ x, y });
    }
    while (x !== b.x) {
      x += stepX;
      tiles.push({ x, y });
    }
  }
  return tiles;
}

/**
 * Cleans a raw sequence of dragged tiles into a 4-connected path with no duplicates and no
 * backtracking: gaps between samples are bridged with L-segments, and if the path doubles back
 * onto a tile it already used, the loop is trimmed.
 */
export function cleanPath(raw: readonly TileXY[]): TileXY[] {
  const out: TileXY[] = [];
  const indexOf = new Map<string, number>();
  const key = (t: TileXY): string => `${t.x},${t.y}`;
  const pushTile = (t: TileXY): void => {
    const k = key(t);
    const existing = indexOf.get(k);
    if (existing !== undefined) {
      // Trim the loop back to the first time we were here.
      for (let i = out.length - 1; i > existing; i--) {
        const removed = out.pop();
        if (removed) indexOf.delete(key(removed));
      }
      return;
    }
    indexOf.set(k, out.length);
    out.push(t);
  };
  let prev: TileXY | null = null;
  for (const t of raw) {
    if (prev && (Math.abs(t.x - prev.x) > 1 || Math.abs(t.y - prev.y) > 1 || (t.x !== prev.x && t.y !== prev.y))) {
      const bridge = orthoConnect(prev, t);
      for (let i = 1; i < bridge.length; i++) {
        const bt = bridge[i];
        if (bt) pushTile(bt);
      }
    } else {
      pushTile(t);
    }
    prev = t;
  }
  return out;
}

/**
 * Belt placements for a cleaned path: each belt points toward the next tile, so straights and
 * corners drop in one continuous run (the belt renderer derives the curve shape from its feeders).
 * The final belt keeps the previous heading.
 */
export function planBeltPath(raw: readonly TileXY[]): LinePlacement[] {
  const path = cleanPath(raw);
  const placements: LinePlacement[] = [];
  let lastDir: Dir = 0;
  for (let i = 0; i < path.length; i++) {
    const cur = path[i];
    if (!cur) continue;
    const next = path[i + 1];
    let rot: Dir = lastDir;
    if (next) {
      const d = dirFromDelta(next.x - cur.x, next.y - cur.y);
      if (d !== null) rot = d;
    }
    lastDir = rot;
    placements.push({ x: cur.x, y: cur.y, rot });
  }
  // Propagate the first real heading backward so a one-tile start isn't left facing default-east.
  if (placements.length >= 2) {
    const second = placements[1];
    const first = placements[0];
    if (second && first && path[1]) {
      const d = dirFromDelta((path[1]?.x ?? 0) - first.x, (path[1]?.y ?? 0) - first.y);
      if (d !== null) first.rot = d;
    }
  }
  return placements;
}

/** Straight-or-L wall/line path (rotation irrelevant for non-directional kinds). */
export function planLinePath(start: TileXY, end: TileXY, kind: BuildingKind): LinePlacement[] {
  if (!BUILDINGS[kind].lineBuild) return [{ x: start.x, y: start.y, rot: 0 }];
  if (kind === 'wall' || kind === 'titanium_wall') {
    return orthoConnect(start, end).map((t) => ({ x: t.x, y: t.y, rot: 0 as Dir }));
  }
  return planBeltPath(orthoConnect(start, end));
}
