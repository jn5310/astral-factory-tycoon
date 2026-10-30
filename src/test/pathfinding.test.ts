import { describe, expect, it } from 'vitest';
import { createEnemy } from '../entities/Enemy';
import { Terrain } from '../data/terrain';
import { stepWorld } from '../core/engine';
import { createWorld } from '../core/World';
import { BARRIER_BASE, chooseGoal, coreGoalTile, createGroundGrid, groundEnterCost, rebuildEnemyIndex } from '../systems/enemyAI';
import { BinaryHeap, findPath, octile, PathService, pathCost, type PathGrid } from '../systems/pathfinding';
import { Rng } from '../utils/rng';
import { put, testWorld, ticks } from './helpers';

/** Grid from ASCII rows: '.' = 1, '#' = wall, digits = that step cost. */
function gridFrom(rows: string[]): PathGrid & { at(x: number, y: number): number } {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const costs: number[] = [];
  for (const row of rows) for (const ch of row) costs.push(ch === '#' ? Infinity : ch === '.' ? 1 : Number(ch));
  return { width, height, cost: (i) => costs[i] ?? Infinity, at: (x, y) => y * width + x };
}

function randomGrid(seed: number, size: number): PathGrid {
  const rng = new Rng(seed);
  const costs = Array.from({ length: size * size }, () => {
    const r = rng.next();
    return r < 0.22 ? Infinity : r < 0.4 ? 1 + rng.int(1, 8) : 1;
  });
  costs[0] = 1;
  costs[size * size - 1] = 1;
  return { width: size, height: size, cost: (i) => costs[i] ?? Infinity };
}

/** Reference Dijkstra with the same movement rules (8 directions, no corner cutting). */
function dijkstra(grid: PathGrid, start: number, goal: number): number {
  const n = grid.width * grid.height;
  const dist = new Array<number>(n).fill(Infinity);
  const done = new Array<boolean>(n).fill(false);
  dist[start] = 0;
  for (;;) {
    let cur = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (dist[i] ?? Infinity) < Infinity && (cur < 0 || (dist[i] ?? 0) < (dist[cur] ?? 0))) cur = i;
    if (cur < 0) return Infinity;
    if (cur === goal) return dist[cur] ?? Infinity;
    done[cur] = true;
    const cx = cur % grid.width;
    const cy = Math.floor(cur / grid.width);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
        const ni = ny * grid.width + nx;
        const c = grid.cost(ni);
        if (!Number.isFinite(c)) continue;
        if (dx && dy && (!Number.isFinite(grid.cost(cy * grid.width + nx)) || !Number.isFinite(grid.cost(ny * grid.width + cx)))) continue;
        const nd = (dist[cur] ?? 0) + c * (dx && dy ? Math.SQRT2 : 1);
        if (nd < (dist[ni] ?? Infinity)) dist[ni] = nd;
      }
    }
  }
}

describe('A* search', () => {
  it('walks a straight corridor in N steps', () => {
    const g = gridFrom(['.........']);
    const path = findPath(g, 0, 8);
    expect(path).toHaveLength(9);
    expect(pathCost(g, path ?? [])).toBe(8);
  });

  it('cuts diagonally across open ground at octile cost', () => {
    const g = gridFrom(['.....', '.....', '.....', '.....', '.....']);
    const path = findPath(g, g.at(0, 0), g.at(4, 4));
    expect(path).toHaveLength(5);
    expect(pathCost(g, path ?? [])).toBeCloseTo(4 * Math.SQRT2);
  });

  it('routes around a wall', () => {
    const g = gridFrom(['.....', '.###.', '.#...', '.#.#.', '...#.']);
    const path = findPath(g, g.at(2, 2), g.at(0, 0)) ?? [];
    expect(path.length).toBeGreaterThan(0);
    for (const i of path) expect(Number.isFinite(g.cost(i))).toBe(true);
    expect(path[path.length - 1]).toBe(g.at(0, 0));
  });

  it('never squeezes diagonally between two touching walls', () => {
    const g = gridFrom(['.#.', '#..', '...']);
    const path = findPath(g, g.at(0, 0), g.at(2, 0));
    expect(path).toBeNull();
  });

  it('returns null when the goal cannot be reached', () => {
    const g = gridFrom(['..#..', '..#..', '..#..']);
    expect(findPath(g, g.at(0, 1), g.at(4, 1))).toBeNull();
    expect(findPath(g, g.at(0, 1), g.at(2, 1))).toBeNull();
  });

  it('returns just the start when already at the goal', () => {
    const g = gridFrom(['...']);
    expect(findPath(g, 1, 1)).toEqual([1]);
  });

  it('takes a cheaper detour instead of crossing expensive ground', () => {
    const g = gridFrom(['.....', '.999.', '.....']);
    const path = findPath(g, g.at(0, 1), g.at(4, 1)) ?? [];
    expect(path).not.toContain(g.at(2, 1));
    expect(pathCost(g, path)).toBeLessThan(9);
  });

  it('crosses expensive ground when every detour costs more', () => {
    const g = gridFrom(['#####', '..3..', '#####']);
    const path = findPath(g, g.at(0, 1), g.at(4, 1)) ?? [];
    expect(path).toContain(g.at(2, 1));
    expect(pathCost(g, path)).toBe(6);
  });

  it('finds optimal paths: same cost as an exhaustive Dijkstra on random weighted grids', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const g = randomGrid(seed, 14);
      const goal = 14 * 14 - 1;
      const path = findPath(g, 0, goal);
      const best = dijkstra(g, 0, goal);
      if (!Number.isFinite(best)) expect(path).toBeNull();
      else expect(pathCost(g, path ?? [])).toBeCloseTo(best, 9);
    }
  });

  it('uses an admissible heuristic (octile never overestimates on open ground)', () => {
    const g = gridFrom(Array.from({ length: 9 }, () => '.........'));
    const rng = new Rng(3);
    for (let k = 0; k < 20; k++) {
      const ax = rng.int(0, 8);
      const ay = rng.int(0, 8);
      const bx = rng.int(0, 8);
      const by = rng.int(0, 8);
      const cost = pathCost(g, findPath(g, g.at(ax, ay), g.at(bx, by)) ?? []);
      expect(octile(ax, ay, bx, by)).toBeLessThanOrEqual(cost + 1e-9);
      expect(cost).toBeCloseTo(octile(ax, ay, bx, by), 9);
    }
  });

  it('pops heap entries in ascending score order', () => {
    const score = [5, 3, 9, 1, 7, 3];
    const heap = new BinaryHeap();
    score.forEach((s, i) => heap.push(i, s));
    // A stale entry for node 2 with a better key must not break the ordering of the others.
    heap.push(2, 0.5);
    const out: number[] = [];
    for (let v = heap.pop(); v !== undefined; v = heap.pop()) out.push(v);
    expect(out.map((v, k) => (k === 0 ? 0.5 : score[v]))).toEqual([0.5, 1, 3, 3, 5, 7, 9]);
  });

  it('caches paths per map version and limits searches per tick', () => {
    const g = gridFrom(['......', '......']);
    const svc = new PathService();
    svc.beginTick(0, 1);
    const first = svc.request(g, 0, 5);
    expect(first).toHaveLength(6);
    expect(svc.request(g, 0, 5)).toBe(first);
    expect(svc.request(g, 6, 11)).toBeUndefined();
    svc.beginTick(1, 1);
    expect(svc.request(g, 0, 5)).not.toBe(first);
    expect(svc.searches).toBe(2);
  });
});

describe('enemy pathing on the game map', () => {
  it('treats water and rock as impassable and walls as breakable, expensive ground', () => {
    const w = testWorld(20);
    w.terrain[0] = Terrain.Water;
    w.terrain[1] = Terrain.Rock;
    const wall = put(w, 'wall', 5, 5);
    put(w, 'conveyor', 6, 5);
    expect(groundEnterCost(w, 0)).toBe(Infinity);
    expect(groundEnterCost(w, 1)).toBe(Infinity);
    expect(groundEnterCost(w, 5 * 20 + 5)).toBe(BARRIER_BASE + 400 / 50);
    expect(groundEnterCost(w, 5 * 20 + 6)).toBe(1);
    // A damaged wall is cheaper to break through, so A* prefers weak spots.
    wall.hp = 50;
    expect(groundEnterCost(w, 5 * 20 + 5)).toBe(BARRIER_BASE + 1);
  });

  it('ground enemies walk around a wall line and attack the core', () => {
    const w = testWorld(40, { core: true });
    for (let y = 12; y <= 28; y++) put(w, 'wall', 12, y);
    // Armoured charger: the core's built-in gun cannot kill it before it arrives.
    const enemy = createEnemy(w.nextEnemyId++, 'charger', 4.5, 20.5);
    w.enemies.push(enemy);
    const core = w.buildings.get(w.coreId);
    let touchedWall = false;
    for (let t = 0; t < ticks(60) && (core?.hp ?? 0) >= (core?.maxHp ?? 0); t++) {
      stepWorld(w);
      for (const i of enemy.path ?? []) if (w.buildings.get(w.occupancy[i] ?? 0)?.kind === 'wall') touchedWall = true;
    }
    expect(core?.hp).toBeLessThan(core?.maxHp ?? 0);
    expect(touchedWall).toBe(false);
    expect([...w.buildings.values()].filter((b) => b.kind === 'wall')).toHaveLength(17);
  });

  it('breaks through the weakest wall when the core is sealed in', () => {
    const w = testWorld(30, { core: true });
    // Ring of walls around the core (core occupies 14..16); one segment is badly damaged.
    let weak = 0;
    for (let x = 12; x <= 18; x++) {
      for (let y = 12; y <= 18; y++) {
        if (x !== 12 && x !== 18 && y !== 12 && y !== 18) continue;
        const wall = put(w, 'wall', x, y);
        if (x === 12 && y === 15) {
          wall.hp = 20;
          weak = wall.id;
        }
      }
    }
    w.enemies.push(createEnemy(w.nextEnemyId++, 'charger', 3.5, 15.5));
    for (let t = 0; t < ticks(30) && w.buildings.has(weak); t++) stepWorld(w);
    expect(w.buildings.has(weak)).toBe(false);
  });

  it('wall-breaker bombers aim for the closest wall, everyone else for the core', () => {
    const w = testWorld(30, { core: true });
    put(w, 'wall', 5, 5);
    const near = put(w, 'wall', 8, 20);
    const bomber = createEnemy(1, 'bomber', 6.5, 22.5);
    const rusher = createEnemy(2, 'rusher', 6.5, 22.5);
    expect(chooseGoal(w, bomber)).toBe(near.y * w.width + near.x);
    expect(chooseGoal(w, rusher)).toBe(coreGoalTile(w));
  });

  it('every nest on a generated map has a walkable A* route to the core', () => {
    for (const seed of [11, 2024, 98765]) {
      const w = createWorld({ seed });
      const grid = createGroundGrid(w);
      expect(w.nests.length).toBeGreaterThan(0);
      for (const nest of w.nests) {
        const path = findPath(grid, nest.y * w.width + nest.x, coreGoalTile(w));
        expect(path).not.toBeNull();
        for (const i of path ?? []) expect(w.terrain[i]).toBe(Terrain.Plain);
      }
    }
  });

  it('keeps spatial lookups in sync with the live enemy list', () => {
    const w = testWorld();
    w.enemies.push(createEnemy(1, 'rusher', 3, 3), createEnemy(2, 'flyer', 10, 10));
    rebuildEnemyIndex(w);
    expect(w.enemyById.size).toBe(2);
    expect(w.enemyTree.queryCircle(3, 3, 1, [])).toEqual([1]);
  });
});
