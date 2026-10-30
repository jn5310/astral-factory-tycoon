import { describe, expect, it } from 'vitest';
import { Ore } from '../data/terrain';
import { stepWorld } from '../core/engine';
import { exportToJSON, importFromJSON } from '../core/save';
import { createWorld } from '../core/World';
import { captureBlueprint, isBlueprint, pasteBlueprint, rotateBlueprint } from '../systems/blueprint';
import { cleanPath, planBeltPath } from '../systems/dragPath';
import { createPollution, diffusePollution, emitPollution, stepPollution, totalPollution } from '../systems/pollution';
import { Quadtree } from '../systems/quadtree';
import { StatsTracker } from '../systems/stats';
import { generateTerrain } from '../systems/terrain';
import { composeWave, waveBudget } from '../systems/waves';
import { Rng } from '../utils/rng';
import { put, run, setOre, testWorld } from './helpers';

describe('procedural map', () => {
  it('generates the same 120x120 map for the same seed', () => {
    const a = generateTerrain(1234);
    const b = generateTerrain(1234);
    const c = generateTerrain(4321);
    expect(a.width * a.height).toBe(120 * 120);
    expect(a.terrain).toEqual(b.terrain);
    expect(a.ore).toEqual(b.ore);
    expect(a.terrain).not.toEqual(c.terrain);
  });

  it('contains plain, water and rock plus all six mineral deposits', () => {
    for (const seed of [1, 77, 4242]) {
      const m = generateTerrain(seed);
      const terrains = new Set(m.terrain);
      expect(terrains.size).toBe(3);
      const ores = new Set(m.ore);
      for (const o of [Ore.Iron, Ore.Copper, Ore.Coal, Ore.Stone, Ore.Sand, Ore.Titanium]) expect([seed, o, ores.has(o)]).toEqual([seed, o, true]);
    }
  });

  it('leaves a buildable start area with iron, copper, coal and stone near the core', () => {
    const m = generateTerrain(99);
    const found = new Set<number>();
    for (let y = m.core.y - 9; y <= m.core.y + 11; y++) {
      for (let x = m.core.x - 9; x <= m.core.x + 11; x++) found.add(m.ore[y * m.width + x] ?? 0);
    }
    for (const o of [Ore.Iron, Ore.Copper, Ore.Coal, Ore.Stone]) expect(found.has(o)).toBe(true);
    expect(m.terrain[(m.core.y + 1) * m.width + m.core.x + 1]).toBe(0);
  });
});

describe('smart drag builder', () => {
  it('faces every belt along a straight drag', () => {
    const plan = planBeltPath([{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }]);
    expect(plan.map((p) => p.rot)).toEqual([0, 0, 0]);
  });

  it('turns the corner belt toward the new direction on an L-shaped drag', () => {
    const plan = planBeltPath([{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }]);
    expect(plan.map((p) => [p.x, p.y, p.rot])).toEqual([[1, 1, 0], [2, 1, 1], [2, 2, 1], [2, 3, 1]]);
  });

  it('fills gaps from fast finger movement with an L-shaped run', () => {
    const path = cleanPath([{ x: 0, y: 0 }, { x: 3, y: 2 }]);
    expect(path).toHaveLength(6);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      expect(Math.abs((a?.x ?? 0) - (b?.x ?? 0)) + Math.abs((a?.y ?? 0) - (b?.y ?? 0))).toBe(1);
    }
  });

  it('trims a loop when the drag doubles back over itself', () => {
    const path = cleanPath([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
    expect(path).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
  });

  it('builds a working curved belt from a drag (items turn the corner)', () => {
    const w = testWorld();
    for (const p of planBeltPath([{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }])) {
      put(w, 'conveyor', p.x, p.y, p.rot);
    }
    const box = put(w, 'container', 4, 5);
    w.buildings.get(w.occupancy[2 * w.width + 2] ?? 0)?.belt?.items.push({ item: 'coal', pos: 0 });
    run(w, 6);
    expect(box.storage?.items.coal).toBe(1);
  });
});

describe('blueprints', () => {
  it('copies a layout with its settings and pastes it elsewhere', () => {
    const w = testWorld(40, { core: true });
    w.inventory = { iron_plate: 500, copper_plate: 500, gear: 500, stone: 500 };
    put(w, 'conveyor', 2, 2, 0);
    put(w, 'conveyor', 3, 2, 1);
    put(w, 'assembler', 4, 2, 0, { recipe: 'copper_wire' });
    const bp = captureBlueprint(w, 2, 2, 5, 3);
    expect(bp.parts).toHaveLength(3);
    expect([bp.width, bp.height]).toEqual([4, 2]);
    expect(isBlueprint(JSON.parse(JSON.stringify(bp)))).toBe(true);
    const res = pasteBlueprint(w, bp, 2, 30);
    expect(res).toEqual({ placed: 3, skipped: 0 });
    const copy = w.buildings.get(w.occupancy[30 * w.width + 4] ?? 0);
    expect(copy?.kind).toBe('assembler');
    expect(copy?.crafter?.recipe).toBe('copper_wire');
    expect(w.buildings.get(w.occupancy[30 * w.width + 3] ?? 0)?.rot).toBe(1);
  });

  it('skips parts that do not fit or cannot be afforded', () => {
    const w = testWorld(40, { core: true });
    w.inventory = { iron_plate: 1 };
    put(w, 'conveyor', 2, 2, 0);
    put(w, 'conveyor', 3, 2, 0);
    const bp = captureBlueprint(w, 2, 2, 3, 2);
    expect(pasteBlueprint(w, bp, 2, 2)).toEqual({ placed: 0, skipped: 2 });
    expect(pasteBlueprint(w, bp, 10, 10)).toEqual({ placed: 1, skipped: 1 });
  });

  it('rotates a blueprint a quarter turn, swapping its size and turning every part', () => {
    const w = testWorld();
    put(w, 'conveyor', 2, 2, 0);
    put(w, 'furnace', 3, 2);
    const bp = captureBlueprint(w, 2, 2, 4, 3);
    const r = rotateBlueprint(bp);
    expect([r.width, r.height]).toEqual([bp.height, bp.width]);
    expect(r.parts.find((p) => p.kind === 'conveyor')?.rot).toBe(1);
    const full = rotateBlueprint(rotateBlueprint(rotateBlueprint(r)));
    expect(full.parts.map((p) => [p.kind, p.dx, p.dy, p.rot])).toEqual(bp.parts.map((p) => [p.kind, p.dx, p.dy, p.rot]));
  });
});

describe('save / load', () => {
  it('round-trips buildings, belt items, inventory, research and power state', () => {
    const w = createWorld({ seed: 5 });
    w.visuals = false;
    const core = w.buildings.get(w.coreId);
    const x = (core?.x ?? 0) - 4;
    const y = (core?.y ?? 0) + 5;
    put(w, 'conveyor', x, y, 0);
    w.buildings.get(w.occupancy[y * w.width + x] ?? 0)?.belt?.items.push({ item: 'gear', pos: 0.4 });
    w.research.completed.add('logistics');
    w.research.current = 'storage';
    w.research.progress.storage = { iron_plate: 12 };
    w.inventory.copper_plate = 1234;
    stepWorld(w);
    const loaded = importFromJSON(exportToJSON(w));
    expect(loaded).not.toBeNull();
    if (!loaded) return;
    expect(loaded.buildings.size).toBe(w.buildings.size);
    expect(loaded.inventory.copper_plate).toBe(1234);
    expect([...loaded.research.completed]).toEqual(['logistics']);
    expect(loaded.research.progress.storage).toEqual({ iron_plate: 12 });
    expect(loaded.terrain).toEqual(w.terrain);
    const belt = loaded.buildings.get(loaded.occupancy[y * loaded.width + x] ?? 0);
    expect(belt?.belt?.items[0]?.item).toBe('gear');
    expect(loaded.coreId).toBe(w.coreId);
  });

  it('rejects files that are not saves and drops corrupt entries', () => {
    expect(importFromJSON('not json')).toBeNull();
    expect(importFromJSON('{"version":999}')).toBeNull();
    expect(importFromJSON(JSON.stringify({ version: 1, seed: 1, width: 5000, height: 5, buildings: [] }))).toBeNull();
    const w = createWorld({ seed: 3 });
    const data = JSON.parse(exportToJSON(w)) as { buildings: unknown[]; inventory: Record<string, unknown> };
    data.buildings.push({ id: 999, kind: 'death_ray', x: 1, y: 1, rot: 0, hp: 1 });
    data.inventory = { iron_plate: 5, unobtainium: 9, coal: -3 };
    const loaded = importFromJSON(JSON.stringify(data));
    expect(loaded?.buildings.size).toBe(w.buildings.size);
    expect(loaded?.inventory).toEqual({ iron_plate: 5 });
  });
});

describe('spatial index, pollution, waves and stats', () => {
  it('quadtree circle queries match a brute-force scan', () => {
    const rng = new Rng(9);
    const tree = new Quadtree(0, 0, 100, 100);
    const pts = Array.from({ length: 300 }, (_, i) => ({ id: i, x: rng.range(0, 100), y: rng.range(0, 100) }));
    for (const p of pts) tree.insert(p.id, p.x, p.y);
    for (let k = 0; k < 10; k++) {
      const cx = rng.range(0, 100);
      const cy = rng.range(0, 100);
      const r = rng.range(2, 25);
      const got = tree.queryCircle(cx, cy, r, []).sort((a, b) => a - b);
      const want = pts.filter((p) => Math.hypot(p.x - cx, p.y - cy) <= r).map((p) => p.id);
      expect(got).toEqual(want);
    }
  });

  it('pollution spreads to neighbouring chunks and conserves its total without decay', () => {
    const p = createPollution(40, 40, 8);
    emitPollution(p, 20, 20, 100);
    stepPollution(p, 1);
    expect(totalPollution(p)).toBeCloseTo(100 * (1 - 0.008), 3);
    const q = createPollution(40, 40, 8);
    q.values[12] = 100;
    diffusePollution(q, 0.05, 0);
    expect(totalPollution(q)).toBeCloseTo(100, 4);
    expect(q.values[13]).toBeCloseTo(5, 4);
    expect(q.values[12]).toBeCloseTo(80, 4);
  });

  it('working factories pollute; idle ones do not', () => {
    const w = testWorld();
    setOre(w, 2, 2, 2, Ore.Iron);
    put(w, 'mech_drill', 2, 2);
    put(w, 'container', 4, 2);
    run(w, 5);
    expect(totalPollution(w.pollution)).toBeGreaterThan(0);
    const idle = testWorld();
    put(idle, 'furnace', 2, 2);
    run(idle, 5);
    expect(totalPollution(idle.pollution)).toBe(0);
  });

  it('nightly attacks grow with the night number and with pollution', () => {
    expect(waveBudget(2, 0)).toBeGreaterThan(waveBudget(1, 0));
    expect(waveBudget(3, 6000)).toBeGreaterThan(waveBudget(3, 0) * 2.5);
    expect(waveBudget(3, 1e9)).toBe(waveBudget(3, 12000));
  });

  it('only sends unlocked enemy types and brings the Leviathan on every fifth night', () => {
    const n1 = composeWave(1, waveBudget(1, 0), new Rng(1));
    expect(n1.map((o) => o.type)).toEqual(['rusher']);
    const n5 = composeWave(5, waveBudget(5, 0), new Rng(1));
    expect(n5.find((o) => o.type === 'leviathan')?.count).toBe(1);
    expect(new Set(n5.map((o) => o.type)).size).toBeGreaterThan(3);
    expect(composeWave(4, 100, new Rng(2)).some((o) => o.type === 'leviathan')).toBe(false);
  });

  it('a night spawns its wave from the nests', () => {
    const w = createWorld({ seed: 8 });
    w.visuals = false;
    w.dayPhase = 0.619;
    for (let i = 0; i < 120; i++) stepWorld(w);
    expect(w.waves.night).toBe(1);
    expect(w.enemies.length).toBeGreaterThan(0);
    const nearNest = w.enemies.every((e) => w.nests.some((n) => Math.hypot(n.x - e.x, n.y - e.y) < 12));
    expect(nearNest).toBe(true);
  });

  it('reports per-minute production rates from rolling buckets', () => {
    const s = new StatsTracker(5, 72);
    for (let t = 0; t < 12; t++) {
      s.record('produced', 'gear', 5);
      s.update(5);
    }
    expect(s.ratePerMinute('produced', 'gear')).toBeCloseTo(60, 0);
    expect(s.series('produced', 'gear').length).toBe(13);
    expect(s.total('produced', 'gear')).toBe(60);
  });
});
