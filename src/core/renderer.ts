import type { Building } from '../entities/Building';
import { createBuilding } from '../entities/Building';
import { BUILDINGS, isConveyorKind, type BuildingKind } from '../data/buildings';
import { POLE_SUPPLY_RADIUS, POLE_WIRE_REACH } from '../data/constants';
import { ENEMIES } from '../data/enemies';
import { TURRETS } from '../data/turrets';
import { beltItemPosition } from '../systems/belts';
import { daylightAt } from '../systems/daynight';
import { drawGlow, type Ctx2D } from '../utils/draw';
import { drawItemSprite } from '../utils/itemIcons';
import type { BuildController, PreviewCell } from './build';
import type { Camera } from './camera';
import { buildingLight, drawBelt, drawBuilding, type DrawCtx } from './renderBuildings';
import { drawEnemy, drawParticle, drawProjectile, isGlowParticle } from './renderUnits';
import { buildTerrainCanvas, TERRAIN_PX } from './terrainLayer';
import { DX, DY, dirFromDelta, opposite, rotateCCW, type Dir } from './types';
import type { World } from './World';

interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const TAU = Math.PI * 2;

function isPowerKind(kind: BuildingKind): boolean {
  const p = BUILDINGS[kind].power;
  return kind === 'power_pole' || p !== undefined;
}

/**
 * Draws one frame: static terrain texture, ground logistics, belt items, buildings, units,
 * night darkness, an additive light pass (machine glow, muzzle flashes, beams, explosions),
 * then UI overlays (status icons, selection, build preview). Everything is drawn in tile units.
 */
export class Renderer {
  private readonly ctx: Ctx2D;
  private terrain: HTMLCanvasElement | null = null;
  private terrainWorld: World | null = null;
  private readonly visible: Building[] = [];
  private readonly ghosts = new Map<BuildingKind, Building>();
  private readonly dc: DrawCtx = { time: 0, detail: 1, daylight: 1, launchTimer: -1 };
  private readonly scratch = { x: 0, y: 0 };
  private shake = 0;
  showPollution = false;
  time = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not supported in this browser');
    this.ctx = ctx;
  }

  addShake(strength: number): void {
    this.shake = Math.min(1.2, Math.max(this.shake, strength));
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  }

  render(world: World, camera: Camera, build: BuildController, dt: number): void {
    const ctx = this.ctx;
    const { width: vw, height: vh, dpr } = camera.viewport;
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    if (this.terrainWorld !== world) {
      this.terrain = buildTerrainCanvas(world);
      this.terrainWorld = world;
      this.ghosts.clear();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#03050b';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const amp = this.shake * this.shake * 9;
    const sx = amp ? (Math.random() - 0.5) * amp : 0;
    const sy = amp ? (Math.random() - 0.5) * amp : 0;
    const z = camera.zoom;
    ctx.setTransform(z * dpr, 0, 0, z * dpr, (vw / 2 - camera.x * z + sx) * dpr, (vh / 2 - camera.y * z + sy) * dpr);

    const bounds = camera.visibleTileBounds();
    const { x0, y0, x1, y1 } = bounds;
    const detail: 0 | 1 | 2 = z < 9 ? 0 : z < 30 ? 1 : 2;
    const daylight = daylightAt(world.dayPhase);
    const dc = this.dc;
    dc.time = this.time;
    dc.detail = detail;
    dc.daylight = daylight;
    dc.launchTimer = -1;

    if (this.terrain) {
      const T = TERRAIN_PX;
      ctx.imageSmoothingEnabled = z < T;
      ctx.drawImage(this.terrain, x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
      ctx.imageSmoothingEnabled = true;
    }
    ctx.strokeStyle = 'rgba(34,211,238,0.35)';
    ctx.lineWidth = 2 / z;
    ctx.strokeRect(0, 0, world.width, world.height);

    this.drawNests(world);
    if (this.showPollution) this.drawPollution(world, bounds);
    if (build.tool.kind !== 'inspect' && z >= 12) this.drawGrid(bounds, z);

    const vis = this.visible;
    vis.length = 0;
    for (const b of world.buildings.values()) {
      if (b.x + b.size < x0 || b.y + b.size < y0 || b.x > x1 + 1 || b.y > y1 + 1) continue;
      vis.push(b);
    }

    // Ground layer: belts, then the items riding on them.
    for (const b of vis) {
      if (!b.belt) continue;
      if (detail === 0) {
        ctx.fillStyle = b.kind === 'fast_conveyor' ? '#1e3a8a' : '#3f4552';
        ctx.fillRect(b.x + 0.1, b.y + 0.1, 0.8, 0.8);
      } else drawBelt(ctx, b, dc);
    }
    if (z >= 7) {
      const size = 0.46;
      for (const b of vis) {
        if (!b.belt) continue;
        for (const it of b.belt.items) {
          const p = beltItemPosition(b, it.pos, this.scratch);
          drawItemSprite(ctx, it.item, p.x, p.y, size);
        }
      }
    }

    for (const b of vis) {
      if (b.belt) continue;
      dc.launchTimer = b.silo && world.launch.active && world.launch.siloId === b.id ? world.launch.timer : -1;
      drawBuilding(ctx, b, dc);
    }
    dc.launchTimer = -1;
    this.drawBridgeTransit(world, vis, detail);
    this.drawWires(world, bounds, z);

    const inView = (x: number, y: number, m: number): boolean => x > x0 - m && x < x1 + 1 + m && y > y0 - m && y < y1 + 1 + m;
    for (const e of world.enemies) if (!ENEMIES[e.type].flying && inView(e.x, e.y, 2)) drawEnemy(ctx, e, this.time, detail > 0);
    for (const e of world.enemies) if (ENEMIES[e.type].flying && inView(e.x, e.y, 2)) drawEnemy(ctx, e, this.time, detail > 0);
    for (const p of world.particles.items) if (p.active && !isGlowParticle(p) && inView(p.x, p.y, 3)) drawParticle(ctx, p);

    // Night: darken everything, then add light additively so machines and gunfire shine.
    const dark = (1 - daylight) * 0.62;
    if (dark > 0.01) {
      ctx.fillStyle = `rgba(3,6,22,${dark})`;
      ctx.fillRect(x0 - 2, y0 - 2, x1 - x0 + 5, y1 - y0 + 5);
    }
    ctx.globalCompositeOperation = 'lighter';
    const boost = 0.3 + dark * 1.1;
    for (const b of vis) {
      const light = buildingLight(b, this.time);
      if (light) drawGlow(ctx, b.x + b.size / 2, b.y + b.size / 2, light[1], light[0], light[2] * boost);
    }
    for (const n of world.nests) drawGlow(ctx, n.x + 0.5, n.y + 0.5, 3, '#a855f7', 0.25 + dark * 0.4);
    this.drawBeams(vis);
    for (const p of world.projectiles.items) if (p.active && inView(p.x, p.y, 2)) drawProjectile(ctx, p);
    for (const p of world.particles.items) if (p.active && isGlowParticle(p) && inView(p.x, p.y, 3)) drawParticle(ctx, p);
    ctx.globalCompositeOperation = 'source-over';

    this.drawStatus(vis, detail);
    this.drawSelection(world, build);
    this.drawPreview(world, build, z);
  }

  private drawNests(world: World): void {
    const ctx = this.ctx;
    for (const n of world.nests) {
      const cx = n.x + 0.5;
      const cy = n.y + 0.5;
      const pulse = 1 + Math.sin(this.time * 2 + n.x) * 0.06;
      ctx.fillStyle = '#2e1065';
      ctx.beginPath();
      ctx.arc(cx, cy, 1.75 * pulse, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#6b21a8';
      ctx.lineWidth = 0.18;
      ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + Math.sin(this.time * 0.7 + k) * 0.15;
        ctx.moveTo(cx + Math.cos(a) * 1.2, cy + Math.sin(a) * 1.2);
        ctx.quadraticCurveTo(cx + Math.cos(a + 0.3) * 2.1, cy + Math.sin(a + 0.3) * 2.1, cx + Math.cos(a) * 2.7, cy + Math.sin(a) * 2.7);
      }
      ctx.stroke();
      ctx.fillStyle = '#7e22ce';
      ctx.beginPath();
      ctx.arc(cx, cy, 1.15 * pulse, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e9d5ff';
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU + this.time * 0.3;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 0.5, cy + Math.sin(a) * 0.5, 0.18 + 0.04 * Math.sin(this.time * 3 + k), 0, TAU);
        ctx.fill();
      }
    }
  }

  private drawPollution(world: World, b: Bounds): void {
    const ctx = this.ctx;
    const p = world.pollution;
    const c0 = Math.max(0, Math.floor(b.x0 / p.chunk));
    const c1 = Math.min(p.cols - 1, Math.floor(b.x1 / p.chunk));
    const r0 = Math.max(0, Math.floor(b.y0 / p.chunk));
    const r1 = Math.min(p.rows - 1, Math.floor(b.y1 / p.chunk));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const v = p.values[r * p.cols + c] ?? 0;
        if (v < 0.2) continue;
        ctx.fillStyle = `rgba(132,204,22,${Math.min(0.45, 0.05 + v / 40)})`;
        ctx.fillRect(c * p.chunk, r * p.chunk, p.chunk, p.chunk);
      }
    }
  }

  private drawGrid(b: Bounds, z: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1 / z;
    ctx.beginPath();
    for (let x = b.x0; x <= b.x1 + 1; x++) {
      ctx.moveTo(x, b.y0);
      ctx.lineTo(x, b.y1 + 1);
    }
    for (let y = b.y0; y <= b.y1 + 1; y++) {
      ctx.moveTo(b.x0, y);
      ctx.lineTo(b.x1 + 1, y);
    }
    ctx.stroke();
  }

  private drawBridgeTransit(world: World, vis: readonly Building[], detail: number): void {
    const ctx = this.ctx;
    for (const b of vis) {
      const br = b.bridge;
      if (!br?.partner) continue;
      const partner = world.buildings.get(br.partner);
      if (!partner) continue;
      const ax = b.x + 0.5;
      const ay = b.y + 0.5;
      const bx = partner.x + 0.5;
      const by = partner.y + 0.5;
      ctx.strokeStyle = 'rgba(251,191,36,0.55)';
      ctx.lineWidth = 0.06;
      ctx.setLineDash([0.15, 0.12]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - 0.7, bx, by);
      ctx.stroke();
      ctx.setLineDash([]);
      if (detail === 0) continue;
      for (const q of br.queue) {
        const f = q.total > 0 ? 1 - q.t / q.total : 1;
        const x = ax + (bx - ax) * f;
        const y = ay + (by - ay) * f - Math.sin(f * Math.PI) * 0.35;
        drawItemSprite(ctx, q.item, x, y, 0.42);
      }
    }
  }

  private drawWires(world: World, b: Bounds, z: number): void {
    const ctx = this.ctx;
    ctx.lineWidth = Math.max(0.035, 1.2 / z);
    for (const [ida, idb] of world.power.wires) {
      const pa = world.buildings.get(ida);
      const pb = world.buildings.get(idb);
      if (!pa || !pb) continue;
      const minX = Math.min(pa.x, pb.x);
      const maxX = Math.max(pa.x, pb.x);
      const minY = Math.min(pa.y, pb.y);
      const maxY = Math.max(pa.y, pb.y);
      if (maxX < b.x0 - 1 || minX > b.x1 + 1 || maxY < b.y0 - 1 || minY > b.y1 + 1) continue;
      const net = world.power.networks[pa.powerNet];
      const sat = net?.satisfaction ?? 0;
      ctx.strokeStyle = sat >= 0.999 ? 'rgba(125,211,252,0.75)' : sat > 0 ? 'rgba(251,191,36,0.8)' : 'rgba(120,120,130,0.6)';
      const ax = pa.x + 0.5;
      const ay = pa.y + 0.2;
      const bx = pb.x + 0.5;
      const by = pb.y + 0.2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 0.45, bx, by);
      ctx.stroke();
    }
  }

  private drawBeams(vis: readonly Building[]): void {
    const ctx = this.ctx;
    for (const b of vis) {
      const t = b.turret;
      if (!t || t.flash <= 0.05) continue;
      const cx = b.x + b.size / 2;
      const cy = b.y + b.size / 2;
      if (b.kind === 'laser_turret' && t.target) {
        const w = 0.1 + Math.sin(this.time * 40) * 0.03;
        ctx.strokeStyle = 'rgba(244,63,94,0.45)';
        ctx.lineWidth = w * 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(t.beamX, t.beamY);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,228,230,0.95)';
        ctx.lineWidth = w;
        ctx.stroke();
        drawGlow(ctx, t.beamX, t.beamY, 0.6, '#f43f5e', 0.9);
      } else if (b.kind === 'repair_turret') {
        ctx.strokeStyle = 'rgba(74,222,128,0.6)';
        ctx.lineWidth = 0.08;
        ctx.setLineDash([0.2, 0.15]);
        ctx.lineDashOffset = -this.time * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(t.beamX, t.beamY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }
    }
  }

  private drawStatus(vis: readonly Building[], detail: number): void {
    const ctx = this.ctx;
    for (const b of vis) {
      if (b.hp < b.maxHp && b.kind !== 'core') {
        const w = b.size * 0.8;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(b.x + (b.size - w) / 2, b.y - 0.18, w, 0.1);
        const f = Math.max(0, b.hp / b.maxHp);
        ctx.fillStyle = f > 0.5 ? '#4ade80' : f > 0.25 ? '#facc15' : '#ef4444';
        ctx.fillRect(b.x + (b.size - w) / 2, b.y - 0.18, w * f, 0.1);
      }
      if (detail > 0 && b.demand > 0 && b.satisfaction < 0.999) {
        const off = b.satisfaction <= 0;
        if (off && Math.floor(this.time * 2) % 2 === 1) continue;
        const x = b.x + b.size - 0.28;
        const y = b.y + 0.28;
        ctx.fillStyle = off ? '#ef4444' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(x, y, 0.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.moveTo(x + 0.03, y - 0.15);
        ctx.lineTo(x - 0.09, y + 0.02);
        ctx.lineTo(x, y + 0.02);
        ctx.lineTo(x - 0.03, y + 0.15);
        ctx.lineTo(x + 0.09, y - 0.02);
        ctx.lineTo(x, y - 0.02);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  private drawRange(cx: number, cy: number, r: number, color: string): void {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.06;
    ctx.setLineDash([0.3, 0.2]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawPoleArea(x: number, y: number, strong: boolean): void {
    const ctx = this.ctx;
    const r = POLE_SUPPLY_RADIUS;
    ctx.fillStyle = strong ? 'rgba(250,204,21,0.12)' : 'rgba(250,204,21,0.06)';
    ctx.fillRect(x - r, y - r, r * 2 + 1, r * 2 + 1);
    ctx.strokeStyle = strong ? 'rgba(250,204,21,0.7)' : 'rgba(250,204,21,0.3)';
    ctx.lineWidth = 0.05;
    ctx.strokeRect(x - r, y - r, r * 2 + 1, r * 2 + 1);
    if (strong) this.drawRange(x + 0.5, y + 0.5, POLE_WIRE_REACH, 'rgba(125,211,252,0.45)');
  }

  private drawSelection(world: World, build: BuildController): void {
    const ctx = this.ctx;
    const tool = build.tool;
    // Power coverage is shown whenever the player is placing anything that uses the grid.
    if (tool.kind === 'build' && isPowerKind(tool.building)) {
      for (const b of world.buildings.values()) if (b.kind === 'power_pole') this.drawPoleArea(b.x, b.y, false);
    }
    const sel = build.selected;
    if (!sel) return;
    const pulse = 0.6 + Math.sin(this.time * 5) * 0.3;
    ctx.strokeStyle = `rgba(34,211,238,${pulse})`;
    ctx.lineWidth = 0.08;
    ctx.strokeRect(sel.x - 0.05, sel.y - 0.05, sel.size + 0.1, sel.size + 0.1);
    const cx = sel.x + sel.size / 2;
    const cy = sel.y + sel.size / 2;
    const tdef = TURRETS[sel.kind];
    if (tdef) {
      this.drawRange(cx, cy, tdef.range, sel.kind === 'repair_turret' ? 'rgba(74,222,128,0.6)' : 'rgba(248,113,113,0.6)');
      if (tdef.minRange > 0) this.drawRange(cx, cy, tdef.minRange, 'rgba(248,113,113,0.3)');
    }
    if (sel.kind === 'power_pole') this.drawPoleArea(sel.x, sel.y, true);
    const partner = sel.tunnel?.partner ? world.buildings.get(sel.tunnel.partner) : undefined;
    if (partner) {
      ctx.strokeStyle = 'rgba(253,230,138,0.8)';
      ctx.lineWidth = 0.08;
      ctx.setLineDash([0.12, 0.12]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(partner.x + 0.5, partner.y + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private ghost(kind: BuildingKind): Building {
    let g = this.ghosts.get(kind);
    if (!g) {
      g = createBuilding(0, kind, 0, 0, 0);
      g.active = true;
      this.ghosts.set(kind, g);
    }
    return g;
  }

  /** Curve shape for a previewed belt, from the previous cell of the drag path. */
  private ghostShape(cells: readonly PreviewCell[], i: number): 0 | 1 | 2 {
    const cur = cells[i];
    const prev = cells[i - 1];
    if (!cur || !prev) return 0;
    if (prev.x + (DX[prev.rot] ?? 0) !== cur.x || prev.y + (DY[prev.rot] ?? 0) !== cur.y) return 0;
    const from = dirFromDelta(prev.x - cur.x, prev.y - cur.y);
    if (from === null || from === opposite(cur.rot)) return 0;
    return from === rotateCCW(cur.rot) ? 1 : 2;
  }

  private drawPreview(world: World, build: BuildController, z: number): void {
    const ctx = this.ctx;
    const preview = build.preview();
    const dc = this.dc;
    preview.cells.forEach((cell, i) => {
      const g = this.ghost(cell.kind);
      g.x = cell.x;
      g.y = cell.y;
      g.rot = cell.rot as Dir;
      ctx.globalAlpha = 0.6;
      if (g.belt) {
        g.belt.shape = this.ghostShape(preview.cells, i);
        drawBelt(ctx, g, dc);
      } else drawBuilding(ctx, g, dc);
      ctx.globalAlpha = 1;
      ctx.fillStyle = cell.ok ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.38)';
      ctx.fillRect(cell.x, cell.y, g.size, g.size);
      ctx.strokeStyle = cell.ok ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.95)';
      ctx.lineWidth = Math.max(0.04, 1.5 / z);
      ctx.strokeRect(cell.x + 0.02, cell.y + 0.02, g.size - 0.04, g.size - 0.04);
      if (BUILDINGS[cell.kind].rotatable && !isConveyorKind(cell.kind)) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        const ax = cell.x + 0.5 + (DX[cell.rot] ?? 0) * 0.62;
        const ay = cell.y + 0.5 + (DY[cell.rot] ?? 0) * 0.62;
        ctx.beginPath();
        ctx.arc(ax, ay, 0.1, 0, TAU);
        ctx.fill();
      }
    });
    const last = preview.cells[preview.cells.length - 1];
    if (last && preview.cells.length === 1) {
      const tdef = TURRETS[last.kind];
      const size = BUILDINGS[last.kind].size;
      if (tdef) this.drawRange(last.x + size / 2, last.y + size / 2, tdef.range, 'rgba(248,113,113,0.5)');
      if (last.kind === 'power_pole') this.drawPoleArea(last.x, last.y, true);
    }
    if (preview.rect) {
      const r = preview.rect;
      ctx.fillStyle = 'rgba(34,211,238,0.12)';
      ctx.fillRect(r.x0, r.y0, r.x1 - r.x0 + 1, r.y1 - r.y0 + 1);
      ctx.strokeStyle = 'rgba(34,211,238,0.9)';
      ctx.lineWidth = 0.07;
      ctx.setLineDash([0.25, 0.15]);
      ctx.strokeRect(r.x0, r.y0, r.x1 - r.x0 + 1, r.y1 - r.y0 + 1);
      ctx.setLineDash([]);
    }
    for (const t of preview.demolish ?? []) {
      const b = world.buildings.get(world.occupancy[t.y * world.width + t.x] ?? 0);
      const x = b ? b.x : t.x;
      const y = b ? b.y : t.y;
      const s = b ? b.size : 1;
      ctx.fillStyle = b && b.kind !== 'core' ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.12)';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = 'rgba(248,113,113,0.95)';
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(x + 0.2, y + 0.2);
      ctx.lineTo(x + s - 0.2, y + s - 0.2);
      ctx.moveTo(x + s - 0.2, y + 0.2);
      ctx.lineTo(x + 0.2, y + s - 0.2);
      ctx.stroke();
    }
  }
}
