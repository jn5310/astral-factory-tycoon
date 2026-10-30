import type { BeltItem, BeltShape, Building } from '../entities/Building';
import { isConveyorKind, type BuildingKind } from '../data/buildings';
import { BELT_SPACING, BELT_SPEED, FAST_BELT_SPEED } from '../data/constants';
import type { ItemId } from '../data/items';
import { buildingAt } from '../core/grid';
import { DX, DY, opposite, rotateCCW, rotateCW, type Dir, type Vec2 } from '../core/types';
import type { World } from '../core/World';

export function beltSpeedOf(kind: BuildingKind): number {
  return kind === 'fast_conveyor' ? FAST_BELT_SPEED : BELT_SPEED;
}

/** True when no item on the belt is closer than the spacing to `pos`. */
export function hasGapAt(items: readonly BeltItem[], pos: number, spacing = BELT_SPACING): boolean {
  for (const it of items) if (Math.abs(it.pos - pos) < spacing - 1e-9) return false;
  return true;
}

/** Inserts keeping the descending-pos order (index 0 = front). */
export function insertSorted(items: BeltItem[], item: ItemId, pos: number): void {
  let i = 0;
  while (i < items.length && (items[i]?.pos ?? 0) >= pos) i++;
  items.splice(i, 0, { item, pos });
}

/**
 * Moves every item forward by `step` tiles. The front item stops at the exit edge (pos 1);
 * every other item stops one spacing behind the item in front of it, so a blocked front
 * makes the whole queue compress and stop item by item.
 */
export function advanceBeltItems(items: BeltItem[], step: number, spacing = BELT_SPACING, frontLimit = 1): boolean {
  let moved = false;
  let limit = frontLimit;
  for (const it of items) {
    let np = it.pos + step;
    if (np > limit) np = limit;
    if (np > it.pos) {
      it.pos = np;
      moved = true;
    }
    limit = it.pos - spacing;
  }
  return moved;
}

/**
 * Where an item entering from `fromSide` lands on the belt: from behind (or the fed side of a curve)
 * at the start, side-loading into a straight belt at the middle. Null when coming from the front.
 */
export function beltInsertPos(b: Building, fromSide: Dir): number | null {
  if (fromSide === b.rot) return null;
  if (fromSide === opposite(b.rot)) return 0;
  const fromLeft = fromSide === rotateCCW(b.rot);
  const shape = b.belt?.shape ?? 0;
  if ((shape === 1 && fromLeft) || (shape === 2 && !fromLeft)) return 0;
  return 0.5;
}

export function beltCanAccept(b: Building, fromSide: Dir): boolean {
  const belt = b.belt;
  if (!belt) return false;
  const pos = beltInsertPos(b, fromSide);
  return pos !== null && hasGapAt(belt.items, pos);
}

export function beltInsert(b: Building, item: ItemId, fromSide: Dir): boolean {
  const belt = b.belt;
  if (!belt) return false;
  const pos = beltInsertPos(b, fromSide);
  if (pos === null || !hasGapAt(belt.items, pos)) return false;
  insertSorted(belt.items, item, pos);
  return true;
}

/** Does `src` (a directional output building) push into tile (tx, ty)? */
export function outputsInto(src: Building, tx: number, ty: number): boolean {
  const directional =
    isConveyorKind(src.kind) || src.kind === 'bridge' || (src.kind === 'tunnel' && src.tunnel?.mode === 'out');
  if (!directional) return false;
  return src.x + (DX[src.rot] ?? 0) === tx && src.y + (DY[src.rot] ?? 0) === ty;
}

function beltFeedsFrom(world: World, b: Building, side: Dir): boolean {
  const n = buildingAt(world, b.x + (DX[side] ?? 0), b.y + (DY[side] ?? 0));
  return n !== undefined && isConveyorKind(n.kind) && outputsInto(n, b.x, b.y);
}

/** A belt curves when exactly one side belt feeds it and nothing feeds it from behind. */
export function computeBeltShape(world: World, b: Building): BeltShape {
  if (beltFeedsFrom(world, b, opposite(b.rot))) return 0;
  const left = beltFeedsFrom(world, b, rotateCCW(b.rot));
  const right = beltFeedsFrom(world, b, rotateCW(b.rot));
  if (left && !right) return 1;
  if (right && !left) return 2;
  return 0;
}

/** Belt ids ordered downstream-first (sinks before their feeders) so a moving queue stays compressed. */
export function computeBeltOrder(world: World): number[] {
  const belts: Building[] = [];
  for (const b of world.buildings.values()) if (b.belt) belts.push(b);
  const preds = new Map<number, number[]>();
  const hasNextBelt = new Set<number>();
  for (const b of belts) {
    const next = buildingAt(world, b.x + (DX[b.rot] ?? 0), b.y + (DY[b.rot] ?? 0));
    if (next?.belt && next.id !== b.id && next.rot !== opposite(b.rot)) {
      hasNextBelt.add(b.id);
      const list = preds.get(next.id);
      if (list) list.push(b.id);
      else preds.set(next.id, [b.id]);
    }
  }
  const order: number[] = [];
  const visited = new Set<number>();
  const visitFrom = (root: number): void => {
    const queue = [root];
    visited.add(root);
    for (let qi = 0; qi < queue.length; qi++) {
      const id = queue[qi];
      if (id === undefined) continue;
      order.push(id);
      for (const p of preds.get(id) ?? []) {
        if (!visited.has(p)) {
          visited.add(p);
          queue.push(p);
        }
      }
    }
  };
  for (const b of belts) if (!hasNextBelt.has(b.id)) visitFrom(b.id);
  // Remaining belts form closed loops; start anywhere.
  for (const b of belts) if (!visited.has(b.id)) visitFrom(b.id);
  return order;
}

/** World-space (tile units) position of an item at `pos` along a belt, following curves. */
export function beltItemPosition(b: Building, pos: number, out: Vec2): Vec2 {
  const cx = b.x + 0.5;
  const cy = b.y + 0.5;
  const shape = b.belt?.shape ?? 0;
  const fdx = DX[b.rot] ?? 0;
  const fdy = DY[b.rot] ?? 0;
  if (shape === 0) {
    out.x = cx + fdx * (pos - 0.5);
    out.y = cy + fdy * (pos - 0.5);
    return out;
  }
  const side = shape === 1 ? rotateCCW(b.rot) : rotateCW(b.rot);
  const sdx = DX[side] ?? 0;
  const sdy = DY[side] ?? 0;
  // Arc around the tile corner shared by the entry side and the exit side.
  const px = cx + (fdx + sdx) * 0.5;
  const py = cy + (fdy + sdy) * 0.5;
  const a0 = Math.atan2(-fdy, -fdx); // entry point = corner - front * 0.5
  const a1 = Math.atan2(-sdy, -sdx); // exit point = corner - side * 0.5
  let da = a1 - a0;
  if (da > Math.PI) da -= Math.PI * 2;
  if (da < -Math.PI) da += Math.PI * 2;
  const a = a0 + da * pos;
  out.x = px + Math.cos(a) * 0.5;
  out.y = py + Math.sin(a) * 0.5;
  return out;
}

export function refreshBeltShapes(world: World): void {
  for (const b of world.buildings.values()) if (b.belt) b.belt.shape = computeBeltShape(world, b);
}
