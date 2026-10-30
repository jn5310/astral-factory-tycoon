import { BUILDINGS } from '../data/buildings';
import { ENEMIES } from '../data/enemies';
import type { Camera } from './camera';
import { buildMinimapBase } from './terrainLayer';
import type { World } from './World';

/** Radar view: terrain/ore base image, buildings, nests, enemies and the camera rectangle. */
export class MinimapRenderer {
  private base: HTMLCanvasElement | null = null;
  private baseWorld: World | null = null;
  private baseVersion = -1;
  private time = 0;
  showPollution = false;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  draw(world: World, camera: Camera, dt: number): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    this.time += dt;
    if (this.baseWorld !== world || this.baseVersion !== world.terrainVersion) {
      this.base = buildMinimapBase(world);
      this.baseWorld = world;
      this.baseVersion = world.terrainVersion;
    }
    const size = Math.min(this.canvas.width, this.canvas.height);
    const s = size / Math.max(world.width, world.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#020409';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.base) ctx.drawImage(this.base, 0, 0, world.width * s, world.height * s);

    if (this.showPollution) {
      const p = world.pollution;
      for (let i = 0; i < p.values.length; i++) {
        const v = p.values[i] ?? 0;
        if (v < 0.2) continue;
        ctx.fillStyle = `rgba(132,204,22,${Math.min(0.55, 0.08 + v / 30)})`;
        ctx.fillRect((i % p.cols) * p.chunk * s, Math.floor(i / p.cols) * p.chunk * s, p.chunk * s, p.chunk * s);
      }
    }
    for (const b of world.buildings.values()) {
      ctx.fillStyle = b.belt ? '#9ca3af' : BUILDINGS[b.kind].color;
      ctx.fillRect(b.x * s, b.y * s, Math.max(1, b.size * s), Math.max(1, b.size * s));
    }
    const blink = Math.sin(this.time * 4) > 0;
    for (const n of world.nests) {
      ctx.fillStyle = blink ? '#c084fc' : '#7e22ce';
      ctx.beginPath();
      ctx.arc((n.x + 0.5) * s, (n.y + 0.5) * s, Math.max(2.5, 2 * s), 0, Math.PI * 2);
      ctx.fill();
    }
    const dot = Math.max(2, s * 1.2);
    for (const e of world.enemies) {
      ctx.fillStyle = e.type === 'leviathan' ? '#fb7185' : ENEMIES[e.type].flying ? '#f0abfc' : '#ef4444';
      const r = e.type === 'leviathan' ? dot * 2 : dot;
      ctx.fillRect(e.x * s - r / 2, e.y * s - r / 2, r, r);
    }
    for (const p of world.pickups) {
      if (!p.landed) continue;
      ctx.fillStyle = blink ? '#67e8f9' : '#ecfeff';
      ctx.fillRect(p.x * s - dot, p.y * s - dot, dot * 2, dot * 2);
    }
    // Recent attacks ping as expanding red rings for a few seconds.
    for (const a of world.alerts) {
      const age = world.time - a.time;
      if (age > 6) continue;
      ctx.strokeStyle = `rgba(248,113,113,${1 - age / 6})`;
      ctx.lineWidth = Math.max(1, size / 120);
      ctx.beginPath();
      ctx.arc(a.x * s, a.y * s, (2 + ((age * 6) % 8)) * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    const tl = camera.screenToWorld(0, 0);
    const br = camera.screenToWorld(camera.viewport.width, camera.viewport.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(1, size / 140);
    ctx.strokeRect(tl.x * s, tl.y * s, (br.x - tl.x) * s, (br.y - tl.y) * s);
  }
}
