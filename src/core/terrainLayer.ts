import { Ore, ORE_COLOR, Terrain } from '../data/terrain';
import { hash2, rgba, shade } from '../utils/draw';
import type { World } from './World';

/** Pixels per tile in the pre-rendered terrain texture. */
export const TERRAIN_PX = 16;

const PLAIN = '#262b36';
const WATER = '#0f3352';
const ROCK = '#4a4038';

function terrainAt(world: World, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return -1;
  return world.terrain[y * world.width + x] ?? -1;
}

/**
 * Renders the static map (terrain + ore deposits) once into an offscreen canvas. The world renderer
 * then blits only the visible part each frame, so terrain costs one drawImage per frame.
 */
export function buildTerrainCanvas(world: World): HTMLCanvasElement {
  const T = TERRAIN_PX;
  const canvas = document.createElement('canvas');
  canvas.width = world.width * T;
  canvas.height = world.height * T;
  const g = canvas.getContext('2d');
  if (!g) return canvas;

  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) drawTerrainTile(g, world, x, y);
  }
  return canvas;
}

/** Paints one tile (ground + ore) into the terrain texture. Used for the initial bake and meteor craters. */
export function drawTerrainTile(g: CanvasRenderingContext2D, world: World, x: number, y: number): void {
  const T = TERRAIN_PX;
  const seed = world.seed;
  const t = terrainAt(world, x, y);
  const px = x * T;
  const py = y * T;
  const n = hash2(x, y, seed);
  if (t === Terrain.Water) {
    const deep = hash2(x >> 2, y >> 2, seed + 1) * 0.12;
    g.fillStyle = shade(WATER, -deep);
    g.fillRect(px, py, T, T);
    if (n < 0.35) {
      g.fillStyle = 'rgba(125, 211, 252, 0.10)';
      g.fillRect(px + 3, py + 4 + Math.floor(n * 20), 8, 1);
    }
    // Foam where the water meets land.
    g.fillStyle = 'rgba(186, 230, 253, 0.22)';
    if (terrainAt(world, x, y - 1) !== Terrain.Water && terrainAt(world, x, y - 1) !== -1) g.fillRect(px, py, T, 2);
    if (terrainAt(world, x, y + 1) !== Terrain.Water && terrainAt(world, x, y + 1) !== -1) g.fillRect(px, py + T - 2, T, 2);
    if (terrainAt(world, x - 1, y) !== Terrain.Water && terrainAt(world, x - 1, y) !== -1) g.fillRect(px, py, 2, T);
    if (terrainAt(world, x + 1, y) !== Terrain.Water && terrainAt(world, x + 1, y) !== -1) g.fillRect(px + T - 2, py, 2, T);
  } else if (t === Terrain.Rock) {
    g.fillStyle = shade(ROCK, (n - 0.5) * 0.16);
    g.fillRect(px, py, T, T);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(px + 2 + Math.floor(n * 8), py + 3, 1, 6);
    g.fillRect(px + 4, py + 9 + Math.floor(n * 4), 7, 1);
    g.fillStyle = 'rgba(255,255,255,0.07)';
    g.fillRect(px + 1, py + 1, T - 2, 2);
    // Ridge shadow onto lower plain ground gives the rock some height.
    if (terrainAt(world, x, y + 1) === Terrain.Plain) {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(px, py + T - 3, T, 3);
    }
  } else {
    g.fillStyle = shade(PLAIN, (n - 0.5) * 0.12);
    g.fillRect(px, py, T, T);
    g.fillStyle = 'rgba(255,255,255,0.035)';
    g.fillRect(px + Math.floor(n * 12), py + Math.floor(hash2(y, x, seed) * 12), 2, 2);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(px + Math.floor(hash2(x, y, seed + 7) * 13), py + Math.floor(hash2(x, y, seed + 9) * 13), 2, 1);
  }

  const ore = world.ore[y * world.width + x] ?? Ore.None;
  if (ore !== Ore.None) {
    const color = ORE_COLOR[ore] ?? '#ffffff';
    g.fillStyle = rgba(color, 0.12);
    g.fillRect(px, py, T, T);
    const count = 4 + Math.floor(n * 3);
    for (let k = 0; k < count; k++) {
      const ox = 2 + Math.floor(hash2(x * 7 + k, y, seed + 13) * (T - 6));
      const oy = 2 + Math.floor(hash2(x, y * 7 + k, seed + 17) * (T - 6));
      const sz = 2 + Math.floor(hash2(x + k, y + k, seed + 19) * 3);
      g.fillStyle = shade(color, -0.35);
      g.fillRect(ox + px, oy + py + 1, sz, sz);
      g.fillStyle = color;
      g.fillRect(ox + px, oy + py, sz, sz);
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fillRect(ox + px, oy + py, 1, 1);
    }
  }
}

/** 1 pixel per tile, for the minimap. */
export function buildMinimapBase(world: World): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = world.width;
  canvas.height = world.height;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  const img = g.createImageData(world.width, world.height);
  const colors: Record<number, [number, number, number]> = {
    [Terrain.Plain]: [38, 43, 54],
    [Terrain.Water]: [16, 58, 96],
    [Terrain.Rock]: [84, 72, 62],
  };
  const oreRgb = (hex: string): [number, number, number] => {
    const v = Number.parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };
  for (let i = 0; i < world.width * world.height; i++) {
    const ore = world.ore[i] ?? 0;
    const base = ore ? oreRgb(ORE_COLOR[ore] ?? '#ffffff') : (colors[world.terrain[i] ?? 0] ?? [0, 0, 0]);
    const k = ore ? 0.75 : 1;
    img.data[i * 4] = Math.round(base[0] * k);
    img.data[i * 4 + 1] = Math.round(base[1] * k);
    img.data[i * 4 + 2] = Math.round(base[2] * k);
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return canvas;
}
