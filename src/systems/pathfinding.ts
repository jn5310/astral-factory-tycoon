/**
 * A* pathfinding on the tile grid (8-directional, octile heuristic, no corner cutting).
 * Buffers are allocated once per grid size and reused between searches (generation stamps avoid clearing).
 */

export interface PathGrid {
  width: number;
  height: number;
  /** Cost of entering a tile (>= 1). Infinity = impassable. */
  cost(index: number): number;
}

export interface PathOptions {
  allowDiagonal?: boolean;
  maxIterations?: number;
}

/**
 * Min-heap of node indices. Each entry stores its own key, so re-pushing a node with a better
 * score leaves the old entry valid but stale (it pops later and is skipped by the closed check).
 * Equal keys are ordered by `tie` (A* passes h, preferring nodes nearer the goal).
 */
export class BinaryHeap {
  private nodes: number[] = [];
  private keys: number[] = [];
  private ties: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  clear(): void {
    this.nodes.length = 0;
    this.keys.length = 0;
    this.ties.length = 0;
  }

  private less(i: number, key: number, tie: number): boolean {
    const k = this.keys[i] ?? 0;
    return k < key || (k === key && (this.ties[i] ?? 0) < tie);
  }

  push(node: number, key: number, tie = 0): void {
    let i = this.nodes.length;
    this.nodes.push(node);
    this.keys.push(key);
    this.ties.push(tie);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, this.keys[parent] ?? 0, this.ties[parent] ?? 0)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number | undefined {
    const n = this.nodes.length;
    if (n === 0) return undefined;
    const top = this.nodes[0];
    this.swap(0, n - 1);
    this.nodes.pop();
    this.keys.pop();
    this.ties.pop();
    const size = n - 1;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      if (l >= size) break;
      const r = l + 1;
      let child = l;
      if (r < size && this.less(r, this.keys[l] ?? 0, this.ties[l] ?? 0)) child = r;
      if (!this.less(child, this.keys[i] ?? 0, this.ties[i] ?? 0)) break;
      this.swap(i, child);
      i = child;
    }
    return top;
  }

  private swap(a: number, b: number): void {
    const n = this.nodes[a] ?? 0;
    const k = this.keys[a] ?? 0;
    const t = this.ties[a] ?? 0;
    this.nodes[a] = this.nodes[b] ?? 0;
    this.keys[a] = this.keys[b] ?? 0;
    this.ties[a] = this.ties[b] ?? 0;
    this.nodes[b] = n;
    this.keys[b] = k;
    this.ties[b] = t;
  }
}

class SearchBuffers {
  readonly g: Float64Array;
  readonly parent: Int32Array;
  readonly openGen: Uint32Array;
  readonly closedGen: Uint32Array;
  readonly heap: BinaryHeap;
  gen = 0;

  constructor(n: number) {
    this.g = new Float64Array(n);
    this.parent = new Int32Array(n);
    this.openGen = new Uint32Array(n);
    this.closedGen = new Uint32Array(n);
    this.heap = new BinaryHeap();
  }
}

const buffers = new Map<number, SearchBuffers>();

function getBuffers(n: number): SearchBuffers {
  let b = buffers.get(n);
  if (!b) {
    b = new SearchBuffers(n);
    buffers.set(n, b);
  }
  return b;
}

const SQRT2 = Math.SQRT2;
const NX = [1, 0, -1, 0, 1, -1, -1, 1];
const NY = [0, 1, 0, -1, 1, 1, -1, -1];

export function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
}

/**
 * Returns the tile indices from start (inclusive) to goal (inclusive), or null if unreachable.
 * The start tile's own cost is ignored (the unit is already there).
 */
export function findPath(grid: PathGrid, start: number, goal: number, opts: PathOptions = {}): number[] | null {
  const { width, height } = grid;
  const n = width * height;
  if (start < 0 || goal < 0 || start >= n || goal >= n) return null;
  if (start === goal) return [start];
  if (!Number.isFinite(grid.cost(goal))) return null;

  const allowDiagonal = opts.allowDiagonal ?? true;
  const maxIterations = opts.maxIterations ?? n * 4;
  const buf = getBuffers(n);
  buf.gen++;
  if (buf.gen >= 0xffffffff) {
    buf.gen = 1;
    buf.openGen.fill(0);
    buf.closedGen.fill(0);
  }
  const gen = buf.gen;
  const { g, parent, openGen, closedGen, heap } = buf;
  heap.clear();

  const gx = goal % width;
  const gy = (goal / width) | 0;
  const sx = start % width;
  const sy = (start / width) | 0;
  g[start] = 0;
  parent[start] = -1;
  openGen[start] = gen;
  const h0 = octile(sx, sy, gx, gy);
  heap.push(start, h0, h0);

  const dirs = allowDiagonal ? 8 : 4;
  let iterations = 0;
  while (heap.size > 0) {
    if (++iterations > maxIterations) return null;
    const cur = heap.pop();
    if (cur === undefined) break;
    if (closedGen[cur] === gen) continue;
    closedGen[cur] = gen;
    if (cur === goal) {
      const path: number[] = [];
      let p = cur;
      while (p !== -1) {
        path.push(p);
        p = parent[p] ?? -1;
      }
      path.reverse();
      return path;
    }
    const cx = cur % width;
    const cy = (cur / width) | 0;
    const gCur = g[cur] ?? 0;
    for (let d = 0; d < dirs; d++) {
      const dx = NX[d] ?? 0;
      const dy = NY[d] ?? 0;
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (closedGen[ni] === gen) continue;
      const c = grid.cost(ni);
      if (!Number.isFinite(c)) continue;
      let step = c;
      if (d >= 4) {
        // No corner cutting: both orthogonal neighbours must be passable.
        if (!Number.isFinite(grid.cost(cy * width + nx)) || !Number.isFinite(grid.cost(ny * width + cx))) continue;
        step = c * SQRT2;
      }
      const ng = gCur + step;
      if (openGen[ni] === gen && ng >= (g[ni] ?? Infinity)) continue;
      openGen[ni] = gen;
      g[ni] = ng;
      parent[ni] = cur;
      const h = octile(nx, ny, gx, gy);
      heap.push(ni, ng + h, h);
    }
  }
  return null;
}

/** Total cost of a path under the same rules as findPath (start tile excluded). */
export function pathCost(grid: PathGrid, path: readonly number[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] ?? 0;
    const b = path[i] ?? 0;
    const diag = a % grid.width !== b % grid.width && ((a / grid.width) | 0) !== ((b / grid.width) | 0);
    total += grid.cost(b) * (diag ? SQRT2 : 1);
  }
  return total;
}

/**
 * Caches paths per (start, goal) for the current map version and limits how many
 * A* searches run per tick so a wave spawning at once cannot stall a frame.
 */
export class PathService {
  private cache = new Map<number, number[] | null>();
  private version = -1;
  budget = 0;
  searches = 0;

  beginTick(mapVersion: number, budget: number): void {
    if (mapVersion !== this.version) {
      this.cache.clear();
      this.version = mapVersion;
    }
    this.budget = budget;
  }

  /** Returns a path, null if unreachable, or undefined if the search budget is spent (try next tick). */
  request(grid: PathGrid, start: number, goal: number): number[] | null | undefined {
    const key = start * grid.width * grid.height + goal;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    if (this.budget <= 0) return undefined;
    this.budget--;
    this.searches++;
    const path = findPath(grid, start, goal);
    if (this.cache.size > 4000) this.cache.clear();
    this.cache.set(key, path);
    return path;
  }
}
