import { MAP_SIZE } from '../data/constants';
import { Ore, Terrain } from '../data/terrain';
import type { TileXY } from '../core/types';
import { Perlin } from '../utils/perlin';
import { findPath } from './pathfinding';
import { Rng } from '../utils/rng';

export interface GeneratedMap {
  width: number;
  height: number;
  terrain: Uint8Array;
  ore: Uint8Array;
  nests: TileXY[];
  core: TileXY;
}

interface OreBand {
  ore: number;
  /** Which minerals compete for the same low/high noise band. */
  seedOffset: number;
  threshold: number;
  scale: number;
  /** Bias toward map edges (0 = anywhere, 1 = only far from center). */
  edgeBias: number;
  rare: boolean;
}

const ORE_BANDS: readonly OreBand[] = [
  { ore: Ore.Iron, seedOffset: 11, threshold: 0.62, scale: 0.09, edgeBias: 0, rare: false },
  { ore: Ore.Copper, seedOffset: 23, threshold: 0.64, scale: 0.1, edgeBias: 0, rare: false },
  { ore: Ore.Coal, seedOffset: 37, threshold: 0.66, scale: 0.11, edgeBias: 0.15, rare: false },
  { ore: Ore.Sand, seedOffset: 53, threshold: 0.68, scale: 0.12, edgeBias: 0.1, rare: false },
  { ore: Ore.Titanium, seedOffset: 71, threshold: 0.74, scale: 0.13, edgeBias: 0.55, rare: true },
];

/**
 * Procedural map: fBm elevation + moisture pick plain/water/rock, separate ore-field noise scatters
 * six minerals into clustered deposits, and a guaranteed starter patch of iron, copper, coal and
 * stone surrounds the core so a fresh game is always playable.
 */
export function generateTerrain(seed: number, width = MAP_SIZE, height = MAP_SIZE): GeneratedMap {
  const elevation = new Perlin(seed);
  const moisture = new Perlin(seed ^ 0x51ed270b);
  const rock = new Perlin(seed ^ 0x1b56c4f9);
  const terrain = new Uint8Array(width * height);
  const ore = new Uint8Array(width * height);
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.hypot(cx, cy);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const e = elevation.fbm(x * 0.045, y * 0.045, 5);
      const m = moisture.fbm(x * 0.06 + 100, y * 0.06 + 100, 3);
      const r = rock.fbm(x * 0.08 - 50, y * 0.08 - 50, 4);
      let t: number = Terrain.Plain;
      if (e < -0.34 && m > -0.1) t = Terrain.Water;
      else if (r > 0.42 || e > 0.5) t = Terrain.Rock;
      terrain[i] = t;
    }
  }

  // Ore fields: each band uses its own noise; higher noise => denser deposit.
  for (const band of ORE_BANDS) {
    const noise = new Perlin(seed + band.seedOffset * 2654435761);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (terrain[i] === Terrain.Water) continue;
        if (ore[i] !== Ore.None) continue;
        const n = noise.fbm(x * band.scale, y * band.scale, 3) * 0.5 + 0.5;
        const edge = Math.hypot(x - cx, y - cy) / maxDist;
        const bias = 1 - band.edgeBias + band.edgeBias * edge * 1.6;
        if (n * bias > band.threshold) {
          // Titanium only in rock, as a risk/reward resource.
          if (band.rare && terrain[i] !== Terrain.Rock) continue;
          ore[i] = band.ore;
        }
      }
    }
  }

  // Stone appears on rocky ground that has no other ore.
  const stoneNoise = new Perlin(seed ^ 0x2fab19c7);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (ore[i] !== Ore.None) continue;
      if (terrain[i] === Terrain.Rock && stoneNoise.fbm(x * 0.1, y * 0.1, 2) > 0.1) ore[i] = Ore.Stone;
    }
  }

  const core: TileXY = { x: Math.round(cx) - 1, y: Math.round(cy) - 1 };
  carveStart(terrain, ore, width, height, core, seed);
  // Noise alone can miss a mineral on some seeds; these stamped deposits guarantee every map is winnable.
  const rng = new Rng(seed ^ 0x3c6ef372);
  const scale = Math.min(width, height) / MAP_SIZE;
  stampDeposits(terrain, ore, width, height, rng, Ore.Sand, 2, 15 * scale, 28 * scale, false);
  stampDeposits(terrain, ore, width, height, rng, Ore.Titanium, 3, 26 * scale, 44 * scale, true);

  const nests = placeNests(seed, width, height, terrain, core);
  connectNests(terrain, width, height, core, nests);
  return { width, height, terrain, ore, nests, core };
}

/** Tiles reachable from `start` over plain ground (4-connected flood fill). */
export function floodPlain(terrain: Uint8Array, width: number, height: number, start: number): Uint8Array {
  const seen = new Uint8Array(width * height);
  const stack = [start];
  seen[start] = 1;
  while (stack.length > 0) {
    const i = stack.pop() ?? 0;
    const x = i % width;
    const y = (i / width) | 0;
    const next = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1];
    for (const n of next) {
      if (n < 0 || seen[n] || terrain[n] !== Terrain.Plain) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }
  return seen;
}

/**
 * Guarantees every nest can walk to the core: an unreachable nest gets a 4-connected trail carved
 * through the cheapest water/rock (so enemy A* never fails on a fresh map).
 */
function connectNests(terrain: Uint8Array, width: number, height: number, core: TileXY, nests: readonly TileXY[]): void {
  const start = (core.y + 1) * width + core.x + 1;
  let reached = floodPlain(terrain, width, height, start);
  const grid = { width, height, cost: (i: number) => (terrain[i] === Terrain.Plain ? 1 : 6) };
  for (const nest of nests) {
    const ni = nest.y * width + nest.x;
    if (reached[ni]) continue;
    const trail = findPath(grid, ni, start, { allowDiagonal: false });
    if (!trail) continue;
    for (const i of trail) terrain[i] = Terrain.Plain;
    reached = floodPlain(terrain, width, height, start);
  }
}

/** Paints `count` round deposits of `kind` at random angles between minR and maxR from the center. */
function stampDeposits(
  terrain: Uint8Array,
  ore: Uint8Array,
  width: number,
  height: number,
  rng: Rng,
  kind: number,
  count: number,
  minR: number,
  maxR: number,
  rocky: boolean,
): void {
  const cx = width / 2;
  const cy = height / 2;
  for (let k = 0; k < count; k++) {
    const ang = ((k + rng.next()) / count) * Math.PI * 2;
    const r = rng.range(minR, maxR);
    const px = Math.round(cx + Math.cos(ang) * r);
    const py = Math.round(cy + Math.sin(ang) * r);
    const rad = 2 + rng.next() * 1.2;
    for (let y = Math.floor(py - rad); y <= Math.ceil(py + rad); y++) {
      for (let x = Math.floor(px - rad); x <= Math.ceil(px + rad); x++) {
        if (x < 0 || y < 0 || x >= width || y >= height || Math.hypot(x - px, y - py) > rad) continue;
        const i = y * width + x;
        terrain[i] = rocky ? Terrain.Rock : Terrain.Plain;
        ore[i] = kind;
      }
    }
  }
}

/** Clears a plain build area around the core and guarantees four starter resource patches. */
function carveStart(
  terrain: Uint8Array,
  ore: Uint8Array,
  width: number,
  height: number,
  core: TileXY,
  seed: number,
): void {
  const ccx = core.x + 1;
  const ccy = core.y + 1;
  for (let y = ccy - 9; y <= ccy + 9; y++) {
    for (let x = ccx - 9; x <= ccx + 9; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      if (Math.hypot(x - ccx, y - ccy) > 9) continue;
      const i = y * width + x;
      terrain[i] = Terrain.Plain;
      ore[i] = Ore.None;
    }
  }
  const patches: { ore: number; ang: number }[] = [
    { ore: Ore.Iron, ang: -Math.PI / 2 },
    { ore: Ore.Copper, ang: 0 },
    { ore: Ore.Coal, ang: Math.PI / 2 },
    { ore: Ore.Stone, ang: Math.PI },
  ];
  const rng = new Rng(seed ^ 0x77ab);
  for (const patch of patches) {
    const d = 6.5;
    const px = Math.round(ccx + Math.cos(patch.ang) * d);
    const py = Math.round(ccy + Math.sin(patch.ang) * d);
    const radius = 2 + rng.next();
    for (let y = py - 3; y <= py + 3; y++) {
      for (let x = px - 3; x <= px + 3; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (Math.hypot(x - px, y - py) > radius) continue;
        const i = y * width + x;
        terrain[i] = Terrain.Plain;
        ore[i] = patch.ore;
      }
    }
  }
}

/** Enemy nests ring the map edges; each is a 3x3 cleared tile the player can see on the minimap. */
function placeNests(seed: number, width: number, height: number, terrain: Uint8Array, core: TileXY): TileXY[] {
  const rng = new Rng(seed ^ 0x5bd1e995);
  const nests: TileXY[] = [];
  const count = 6;
  const ccx = core.x + 1;
  const ccy = core.y + 1;
  for (let k = 0; k < count; k++) {
    const ang = (k / count) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const radius = Math.min(width, height) * 0.42;
    const nx = Math.round(width / 2 + Math.cos(ang) * radius);
    const ny = Math.round(height / 2 + Math.sin(ang) * radius);
    const x = Math.max(2, Math.min(width - 3, nx));
    const y = Math.max(2, Math.min(height - 3, ny));
    if (Math.hypot(x - ccx, y - ccy) < 20) continue;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const i = (y + dy) * width + (x + dx);
        if (i >= 0 && i < terrain.length) terrain[i] = Terrain.Plain;
      }
    }
    nests.push({ x, y });
  }
  return nests;
}
