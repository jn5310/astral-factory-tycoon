import { describe, expect, it } from 'vitest';
import type { BeltItem } from '../entities/Building';
import { BELT_SPACING, BELT_SPEED } from '../data/constants';
import { stepWorld } from '../core/engine';
import {
  advanceBeltItems,
  beltInsertPos,
  beltItemPosition,
  computeBeltOrder,
  computeBeltShape,
  hasGapAt,
  insertSorted,
} from '../systems/belts';
import { refreshLogistics } from '../systems/logistics';
import { removeBuilding } from '../systems/placement';
import { beltItemCount, beltLine, put, repeat, run, runFeeding, stored, testWorld, ticks } from './helpers';

function items(...pos: number[]): BeltItem[] {
  return pos.map((p) => ({ item: 'coal', pos: p }));
}

describe('belt item physics', () => {
  it('moves a lone item forward by speed * dt', () => {
    const list = items(0.2);
    advanceBeltItems(list, 0.1);
    expect(list[0]?.pos).toBeCloseTo(0.3);
  });

  it('stops the front item at the exit edge', () => {
    const list = items(0.95);
    advanceBeltItems(list, 0.2);
    expect(list[0]?.pos).toBe(1);
  });

  it('stops the item behind exactly one spacing behind a stopped front item', () => {
    const list = items(1, 0.6);
    advanceBeltItems(list, 0.5);
    expect(list[1]?.pos).toBeCloseTo(1 - BELT_SPACING);
  });

  it('compresses a blocked queue item by item until it is fully packed', () => {
    const list = items(0.6, 0.3, 0);
    advanceBeltItems(list, 0.2);
    // Front moved freely; the others also had room.
    expect(list.map((i) => i.pos)).toEqual([0.8, 0.5, 0.2].map((v) => expect.closeTo(v, 6)));
    for (let k = 0; k < 20; k++) advanceBeltItems(list, 0.2);
    expect(list[0]?.pos).toBe(1);
    expect(list[1]?.pos).toBeCloseTo(0.75);
    expect(list[2]?.pos).toBeCloseTo(0.5);
  });

  it('reports no movement once the queue is jammed', () => {
    const list = items(1, 0.75, 0.5);
    expect(advanceBeltItems(list, 0.1)).toBe(false);
  });

  it('honours a front limit below the exit edge (the next belt is backed up)', () => {
    const list = items(0.5);
    advanceBeltItems(list, 1, BELT_SPACING, 0.8);
    expect(list[0]?.pos).toBeCloseTo(0.8);
  });

  it('detects whether there is room at a position', () => {
    const list = items(0.5);
    expect(hasGapAt(list, 0.6)).toBe(false);
    expect(hasGapAt(list, 0.25)).toBe(true);
    expect(hasGapAt(list, 0.75)).toBe(true);
  });

  it('keeps items sorted front-first when inserting', () => {
    const list = items(0.9, 0.1);
    insertSorted(list, 'stone', 0.5);
    expect(list.map((i) => i.pos)).toEqual([0.9, 0.5, 0.1]);
    expect(list[1]?.item).toBe('stone');
  });
});

describe('belt insertion and shapes', () => {
  it('accepts from behind at 0, from the sides at 0.5, and never from the front', () => {
    const w = testWorld();
    const b = put(w, 'conveyor', 5, 5, 0);
    expect(beltInsertPos(b, 2)).toBe(0);
    expect(beltInsertPos(b, 3)).toBe(0.5);
    expect(beltInsertPos(b, 1)).toBe(0.5);
    expect(beltInsertPos(b, 0)).toBeNull();
  });

  it('turns into a curve when fed only from one side, taking items at its start', () => {
    const w = testWorld();
    put(w, 'conveyor', 5, 4, 1);
    const corner = put(w, 'conveyor', 5, 5, 0);
    expect(computeBeltShape(w, corner)).toBe(1);
    refreshLogistics(w);
    expect(corner.belt?.shape).toBe(1);
    expect(beltInsertPos(corner, 3)).toBe(0);
  });

  it('stays straight when fed from behind and the side at once', () => {
    const w = testWorld();
    put(w, 'conveyor', 4, 5, 0);
    put(w, 'conveyor', 5, 4, 1);
    const merge = put(w, 'conveyor', 5, 5, 0);
    expect(computeBeltShape(w, merge)).toBe(0);
  });

  it('orders belt updates downstream first', () => {
    const w = testWorld();
    const line = beltLine(w, 2, 2, 4, 0);
    const order = computeBeltOrder(w);
    const idx = line.map((b) => order.indexOf(b.id));
    expect(idx[3]).toBeLessThan(idx[2] ?? -1);
    expect(idx[2]).toBeLessThan(idx[1] ?? -1);
    expect(idx[1]).toBeLessThan(idx[0] ?? -1);
  });

  it('places items edge to edge on a straight belt', () => {
    const w = testWorld();
    const b = put(w, 'conveyor', 2, 3, 0);
    const out = { x: 0, y: 0 };
    expect(beltItemPosition(b, 0, out)).toEqual({ x: 2, y: 3.5 });
    expect(beltItemPosition(b, 1, out)).toEqual({ x: 3, y: 3.5 });
  });

  it('places items along the arc of a curved belt', () => {
    const w = testWorld();
    put(w, 'conveyor', 5, 4, 1);
    const corner = put(w, 'conveyor', 5, 5, 0);
    refreshLogistics(w);
    const start = beltItemPosition(corner, 0, { x: 0, y: 0 });
    const end = beltItemPosition(corner, 1, { x: 0, y: 0 });
    expect(start.x).toBeCloseTo(5.5);
    expect(start.y).toBeCloseTo(5);
    expect(end.x).toBeCloseTo(6);
    expect(end.y).toBeCloseTo(5.5);
  });
});

describe('belt transport in the simulation', () => {
  it('carries an item down a line into the core', () => {
    const w = testWorld(30, { core: true });
    const line = beltLine(w, 5, 15, 9, 0);
    line[0]?.belt?.items.push({ item: 'iron_plate', pos: 0 });
    run(w, 9 / BELT_SPEED + 1);
    expect(w.inventory.iron_plate).toBe(1);
    expect(beltItemCount(line)).toBe(0);
  });

  it('backs up a blocked line item by item without losing anything', () => {
    const w = testWorld();
    const line = beltLine(w, 5, 5, 3, 0);
    put(w, 'wall', 8, 5);
    const fed = runFeeding(w, line[0], repeat('coal', 20), 20);
    expect(beltItemCount(line)).toBe(fed);
    // Last belt: packed from the exit edge back, one spacing apart.
    expect(line[2]?.belt?.items.map((i) => i.pos)).toEqual([1, 0.75, 0.5, 0.25, 0].map((v) => expect.closeTo(v, 6)));
    // Every belt holds 4 items per tile of length plus the shared edge item.
    expect(fed).toBe(13);
    for (const b of line) expect(b.active).toBe(false);
  });

  it('resumes and drains once the blockage is replaced by a container', () => {
    const w = testWorld();
    const line = beltLine(w, 5, 5, 3, 0);
    const wall = put(w, 'wall', 8, 5);
    const fed = runFeeding(w, line[0], repeat('coal', 20), 20);
    removeBuilding(w, wall.id, { refund: false, silent: true });
    const box = put(w, 'container', 8, 5);
    run(w, 6);
    expect(stored(box)).toBe(fed);
    expect(beltItemCount(line)).toBe(0);
  });

  it('moves items twice as fast on fast conveyors', () => {
    const timeToCross = (kind: 'conveyor' | 'fast_conveyor'): number => {
      const w = testWorld();
      const line = beltLine(w, 2, 2, 6, 0, kind);
      const box = put(w, 'container', 8, 2);
      line[0]?.belt?.items.push({ item: 'stone', pos: 0 });
      for (let t = 1; t < ticks(30); t++) {
        stepWorld(w);
        if (stored(box) === 1) return t;
      }
      return Infinity;
    };
    const slow = timeToCross('conveyor');
    const fast = timeToCross('fast_conveyor');
    expect(slow / fast).toBeGreaterThan(1.8);
    expect(slow / fast).toBeLessThan(2.2);
  });

  it('merges a side-loading line into the main line', () => {
    const w = testWorld();
    const main = beltLine(w, 2, 6, 6, 0);
    const side = beltLine(w, 4, 3, 3, 1);
    const box = put(w, 'container', 8, 6);
    let fedMain = 0;
    let fedSide = 0;
    for (let t = 0; t < ticks(30); t++) {
      if (fedMain < 6 && main[0]?.belt && main[0].belt.items.every((i) => i.pos >= BELT_SPACING)) {
        main[0].belt.items.push({ item: 'coal', pos: 0 });
        fedMain++;
      }
      if (fedSide < 6 && side[0]?.belt && side[0].belt.items.every((i) => i.pos >= BELT_SPACING)) {
        side[0].belt.items.push({ item: 'stone', pos: 0 });
        fedSide++;
      }
      stepWorld(w);
    }
    expect(box.storage?.items.coal).toBe(6);
    expect(box.storage?.items.stone).toBe(6);
  });
});
