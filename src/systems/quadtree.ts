/**
 * Point quadtree for broad-phase queries (turret targeting, projectile hits, enemy separation).
 * Rebuilt every tick; nodes are pooled and reused, so clear() + insert() allocate nothing in steady state.
 */

interface QuadNode {
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  /** Indices into the point arrays. */
  points: number[];
  /** Child node indices (-1 = leaf). */
  children: [number, number, number, number];
}

const NODE_CAPACITY = 8;
const MAX_DEPTH = 8;

export class Quadtree {
  private nodes: QuadNode[] = [];
  private used = 0;
  private ids: number[] = [];
  private xs: number[] = [];
  private ys: number[] = [];
  private count = 0;
  private readonly x: number;
  private readonly y: number;
  private readonly w: number;
  private readonly h: number;

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.clear();
  }

  get size(): number {
    return this.count;
  }

  clear(): void {
    this.used = 0;
    this.count = 0;
    this.allocNode(this.x, this.y, this.w, this.h, 0);
  }

  private allocNode(x: number, y: number, w: number, h: number, depth: number): number {
    const idx = this.used++;
    let node = this.nodes[idx];
    if (!node) {
      node = { x, y, w, h, depth, points: [], children: [-1, -1, -1, -1] };
      this.nodes[idx] = node;
    } else {
      node.x = x;
      node.y = y;
      node.w = w;
      node.h = h;
      node.depth = depth;
      node.points.length = 0;
      node.children[0] = -1;
      node.children[1] = -1;
      node.children[2] = -1;
      node.children[3] = -1;
    }
    return idx;
  }

  insert(id: number, x: number, y: number): void {
    const p = this.count++;
    this.ids[p] = id;
    this.xs[p] = x;
    this.ys[p] = y;
    this.insertPoint(0, p);
  }

  private childFor(node: QuadNode, x: number, y: number): number {
    const midX = node.x + node.w / 2;
    const midY = node.y + node.h / 2;
    const q = (x >= midX ? 1 : 0) + (y >= midY ? 2 : 0);
    return node.children[q as 0 | 1 | 2 | 3];
  }

  private insertPoint(nodeIdx: number, p: number): void {
    let idx = nodeIdx;
    for (;;) {
      const node = this.nodes[idx];
      if (!node) return;
      if (node.children[0] === -1) {
        node.points.push(p);
        if (node.points.length > NODE_CAPACITY && node.depth < MAX_DEPTH) this.split(idx);
        return;
      }
      idx = this.childFor(node, this.xs[p] ?? 0, this.ys[p] ?? 0);
    }
  }

  private split(nodeIdx: number): void {
    const node = this.nodes[nodeIdx];
    if (!node) return;
    const hw = node.w / 2;
    const hh = node.h / 2;
    const d = node.depth + 1;
    const c0 = this.allocNode(node.x, node.y, hw, hh, d);
    const c1 = this.allocNode(node.x + hw, node.y, hw, hh, d);
    const c2 = this.allocNode(node.x, node.y + hh, hw, hh, d);
    const c3 = this.allocNode(node.x + hw, node.y + hh, hw, hh, d);
    // allocNode may have grown the array; re-read the node reference.
    const n = this.nodes[nodeIdx];
    if (!n) return;
    n.children[0] = c0;
    n.children[1] = c1;
    n.children[2] = c2;
    n.children[3] = c3;
    const pts = n.points.slice();
    n.points.length = 0;
    for (const p of pts) {
      const child = this.childFor(n, this.xs[p] ?? 0, this.ys[p] ?? 0);
      const cn = this.nodes[child];
      if (cn) cn.points.push(p);
    }
  }

  /** Collects ids of points within radius r of (x, y) into out (cleared first). */
  queryCircle(x: number, y: number, r: number, out: number[]): number[] {
    out.length = 0;
    const r2 = r * r;
    const stack = [0];
    while (stack.length > 0) {
      const idx = stack.pop();
      if (idx === undefined) break;
      const node = this.nodes[idx];
      if (!node) continue;
      // Reject nodes whose box is farther than r.
      const cx = Math.max(node.x, Math.min(x, node.x + node.w));
      const cy = Math.max(node.y, Math.min(y, node.y + node.h));
      const ddx = cx - x;
      const ddy = cy - y;
      if (ddx * ddx + ddy * ddy > r2) continue;
      if (node.children[0] === -1) {
        for (const p of node.points) {
          const px = (this.xs[p] ?? 0) - x;
          const py = (this.ys[p] ?? 0) - y;
          if (px * px + py * py <= r2) out.push(this.ids[p] ?? -1);
        }
      } else {
        stack.push(node.children[0], node.children[1], node.children[2], node.children[3]);
      }
    }
    return out;
  }
}
