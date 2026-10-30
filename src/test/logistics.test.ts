import { describe, expect, it } from 'vitest';
import { CONTAINER_CAPACITY } from '../data/constants';
import type { ItemId } from '../data/items';
import { Ore } from '../data/terrain';
import { canAccept, tryInsert } from '../systems/logistics';
import { canPlace } from '../systems/placement';
import { computeDrillOre } from '../systems/production';
import { beltItemCount, beltLine, put, repeat, run, runFeeding, setOre, stored, testWorld } from './helpers';

describe('router (1:1 splitter)', () => {
  it('splits one input evenly between two outputs', () => {
    const w = testWorld();
    const input = beltLine(w, 2, 10, 3, 0);
    put(w, 'router', 5, 10);
    beltLine(w, 5, 9, 1, 3);
    const north = put(w, 'container', 5, 7);
    beltLine(w, 5, 11, 1, 1);
    const south = put(w, 'container', 5, 12);
    const fed = runFeeding(w, input[0], repeat('iron_ore', 40), 20);
    run(w, 3);
    expect(fed).toBe(40);
    expect(stored(north)).toBe(20);
    expect(stored(south)).toBe(20);
  });

  it('never sends items back toward the belt that fed it', () => {
    const w = testWorld();
    const input = beltLine(w, 2, 10, 3, 0);
    const router = put(w, 'router', 5, 10);
    const east = put(w, 'container', 6, 10);
    runFeeding(w, input[0], repeat('coal', 10), 10);
    run(w, 2);
    expect(stored(east)).toBe(10);
    expect(beltItemCount(input)).toBe(0);
    expect(router.router?.slot.item).toBeNull();
  });
});

describe('filter sorter', () => {
  it('passes the filter item straight and diverts everything else to the sides', () => {
    const w = testWorld();
    const input = beltLine(w, 2, 10, 3, 0);
    put(w, 'sorter', 5, 10, 0, { filter: 'copper_ore' });
    beltLine(w, 6, 10, 1, 0);
    const straight = put(w, 'container', 7, 10);
    beltLine(w, 5, 9, 1, 3);
    const left = put(w, 'container', 5, 7);
    beltLine(w, 5, 11, 1, 1);
    const right = put(w, 'container', 5, 12);
    const mixed: ItemId[] = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 'copper_ore' : 'iron_ore'));
    runFeeding(w, input[0], mixed, 20);
    run(w, 3);
    expect(straight.storage?.items).toEqual({ copper_ore: 10 });
    expect(left.storage?.items.copper_ore).toBeUndefined();
    expect(right.storage?.items.copper_ore).toBeUndefined();
    expect(stored(left) + stored(right)).toBe(10);
    // Non-filter items alternate between the two sides.
    expect(stored(left)).toBe(5);
  });
});

describe('bridge and tunnel', () => {
  it('bridges carry a line across another belt without mixing the two', () => {
    const w = testWorld();
    const input = beltLine(w, 1, 10, 2, 0);
    put(w, 'bridge', 3, 10, 0);
    put(w, 'bridge', 6, 10, 0);
    const east = put(w, 'container', 7, 10);
    const cross = beltLine(w, 5, 6, 8, 1);
    const south = put(w, 'container', 5, 14);
    let crossFed = 0;
    let fed = 0;
    for (let t = 0; t < 60 * 20; t++) {
      if (fed < 10 && tryInsert(w, input[0], 'iron_ore', 2)) fed++;
      if (crossFed < 10 && tryInsert(w, cross[0], 'coal', 3)) crossFed++;
      run(w, 1 / 60);
    }
    expect(east.storage?.items).toEqual({ iron_ore: 10 });
    expect(south.storage?.items).toEqual({ coal: 10 });
  });

  it('a second tunnel facing the same way becomes the exit, and items travel underground', () => {
    const w = testWorld();
    const input = beltLine(w, 1, 10, 2, 0);
    const entrance = put(w, 'tunnel', 3, 10, 0);
    const exit = put(w, 'tunnel', 7, 10, 0);
    // Anything may be built over the tunnel.
    put(w, 'wall', 5, 10);
    const box = put(w, 'container', 8, 10);
    run(w, 0.1);
    expect(entrance.tunnel?.mode).toBe('in');
    expect(exit.tunnel?.mode).toBe('out');
    expect(entrance.tunnel?.partner).toBe(exit.id);
    runFeeding(w, input[0], repeat('stone', 8), 12);
    expect(stored(box)).toBe(8);
  });
});

describe('storage and inserters', () => {
  it('a container accepts items up to its capacity and then refuses', () => {
    const w = testWorld();
    const box = put(w, 'container', 5, 5);
    for (let i = 0; i < CONTAINER_CAPACITY; i++) tryInsert(w, box, 'stone', 2);
    expect(stored(box)).toBe(CONTAINER_CAPACITY);
    expect(canAccept(w, box, 'stone', 2)).toBe(false);
    expect(tryInsert(w, box, 'coal', 2)).toBe(false);
  });

  it('an inserter only moves the ingredients the target machine can use', () => {
    const w = testWorld();
    const box = put(w, 'container', 2, 5);
    if (box.storage) box.storage.items = { iron_ore: 10, coal: 10 };
    put(w, 'inserter', 4, 5, 0);
    const furnace = put(w, 'furnace', 5, 5);
    run(w, 10);
    // Unpowered furnace: its buffer fills to three crafts of iron ore, coal is never picked.
    expect(furnace.crafter?.input).toEqual({ iron_ore: 3 });
    expect(box.storage?.items).toEqual({ iron_ore: 7, coal: 10 });
  });

  it('an inserter with a filter moves only the filtered item', () => {
    const w = testWorld();
    const a = put(w, 'container', 2, 5);
    if (a.storage) a.storage.items = { iron_ore: 5, copper_ore: 5 };
    put(w, 'inserter', 4, 5, 0, { filter: 'copper_ore' });
    const b = put(w, 'container', 5, 5);
    run(w, 10);
    expect(b.storage?.items).toEqual({ copper_ore: 5 });
    expect(a.storage?.items).toEqual({ iron_ore: 5 });
  });
});

describe('drills', () => {
  it('a mechanical drill on ore pushes ore straight into an adjacent core', () => {
    const w = testWorld(30, { core: true });
    setOre(w, 12, 14, 2, Ore.Iron);
    put(w, 'mech_drill', 12, 14);
    run(w, 9);
    expect(w.inventory.iron_ore ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('only electric drills can mine titanium, and drills need ore underneath', () => {
    const w = testWorld();
    setOre(w, 5, 5, 2, Ore.Titanium);
    expect(computeDrillOre(w, 5, 5, 2, 'mech_drill').count).toBe(0);
    expect(computeDrillOre(w, 5, 5, 2, 'electric_drill')).toEqual({ ore: 'titanium_ore', count: 4 });
    expect(canPlace(w, 'mech_drill', 5, 5).ok).toBe(false);
    expect(canPlace(w, 'electric_drill', 5, 5).ok).toBe(true);
    expect(canPlace(w, 'electric_drill', 10, 10).ok).toBe(false);
  });
});
