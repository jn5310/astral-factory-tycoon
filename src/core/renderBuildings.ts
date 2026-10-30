import type { Building } from '../entities/Building';
import { BUILDINGS } from '../data/buildings';
import { CONTAINER_CAPACITY, ROCKET_PARTS_REQUIRED } from '../data/constants';
import { ITEMS } from '../data/items';
import { RECIPES } from '../data/recipes';
import { TURRETS } from '../data/turrets';
import { drawGear, fillRoundRect, roundRectPath, rgba, shade, type Ctx2D } from '../utils/draw';
import { drawItemSprite } from '../utils/itemIcons';
import { invTotal } from '../systems/inventory';
import { dirAngle } from './types';

export interface DrawCtx {
  /** Render clock in seconds. */
  time: number;
  /** 0 = far zoom (flat blocks), 1 = normal, 2 = close-up. */
  detail: 0 | 1 | 2;
  daylight: number;
  /** Seconds since launch start, or -1 when no rocket is launching from this silo. */
  launchTimer: number;
}

const TAU = Math.PI * 2;

/** Beveled machine frame covering the building footprint (call after translating to the top-left). */
function frame(ctx: Ctx2D, s: number, base: string, edge: string): void {
  fillRoundRect(ctx, 0.05, 0.05, s - 0.1, s - 0.1, 0.14, shade(edge, -0.45));
  fillRoundRect(ctx, 0.09, 0.09, s - 0.18, s - 0.18, 0.12, edge);
  fillRoundRect(ctx, 0.15, 0.15, s - 0.3, s - 0.3, 0.1, base);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(0.18, 0.17, s - 0.36, 0.06);
}

function bolts(ctx: Ctx2D, s: number, color: string): void {
  ctx.fillStyle = color;
  const o = 0.24;
  for (const [x, y] of [[o, o], [s - o, o], [o, s - o], [s - o, s - o]]) {
    ctx.beginPath();
    ctx.arc(x ?? 0, y ?? 0, 0.05, 0, TAU);
    ctx.fill();
  }
}

function progressBar(ctx: Ctx2D, x: number, y: number, w: number, frac: number, color: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, 0.07);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), 0.07);
}

function arrow(ctx: Ctx2D, cx: number, cy: number, rot: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.6, -size * 0.75);
  ctx.lineTo(-size * 0.25, 0);
  ctx.lineTo(-size * 0.6, size * 0.75);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Belts (ground layer)
// ---------------------------------------------------------------------------

function chevron(ctx: Ctx2D, x: number, y: number, heading: number): void {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  const p = (lx: number, ly: number): [number, number] => [x + lx * c - ly * s, y + lx * s + ly * c];
  const [ax, ay] = p(-0.13, -0.19);
  const [bx, by] = p(0.02, 0);
  const [cx2, cy2] = p(-0.13, 0.19);
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx2, cy2);
}

export function drawBelt(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  const fast = b.kind === 'fast_conveyor';
  const rail = fast ? '#3b82f6' : '#5b6474';
  const bed = fast ? '#141d33' : '#1a1e27';
  const shape = b.belt?.shape ?? 0;
  ctx.save();
  ctx.translate(b.x + 0.5, b.y + 0.5);
  ctx.rotate(dirAngle(b.rot));
  if (shape === 2) ctx.scale(1, -1);
  const speed = fast ? 3.2 : 1.6;
  const moving = b.active || (b.belt?.items.length ?? 0) === 0;
  const off = moving ? (dc.time * speed) % 0.5 : 0.25;
  ctx.strokeStyle = fast ? 'rgba(147,197,253,0.5)' : 'rgba(156,163,175,0.32)';
  ctx.lineWidth = 0.07;
  if (shape === 0) {
    ctx.fillStyle = bed;
    ctx.fillRect(-0.5, -0.4, 1, 0.8);
    ctx.fillStyle = rail;
    ctx.fillRect(-0.5, -0.46, 1, 0.09);
    ctx.fillRect(-0.5, 0.37, 1, 0.09);
    if (dc.detail > 0) {
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const x = -0.38 + off + (k - 1) * 0.5;
        if (x > -0.45 && x < 0.48) chevron(ctx, x, 0, 0);
      }
      ctx.stroke();
    }
  } else {
    // Quarter annulus around the shared corner: enters on the left edge, leaves on the front edge.
    ctx.fillStyle = bed;
    ctx.beginPath();
    ctx.arc(0.5, -0.5, 0.9, Math.PI / 2, Math.PI);
    ctx.arc(0.5, -0.5, 0.1, Math.PI, Math.PI / 2, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rail;
    ctx.lineWidth = 0.09;
    ctx.beginPath();
    ctx.arc(0.5, -0.5, 0.915, Math.PI / 2, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0.5, -0.5, 0.085, Math.PI / 2, Math.PI);
    ctx.stroke();
    if (dc.detail > 0) {
      ctx.strokeStyle = fast ? 'rgba(147,197,253,0.5)' : 'rgba(156,163,175,0.32)';
      ctx.lineWidth = 0.07;
      ctx.beginPath();
      const arcLen = Math.PI / 4;
      for (let k = 0; k < 2; k++) {
        const along = off + k * 0.5;
        if (along >= arcLen) continue;
        const a = Math.PI - (along / arcLen) * (Math.PI / 2);
        chevron(ctx, 0.5 + Math.cos(a) * 0.5, -0.5 + Math.sin(a) * 0.5, Math.atan2(-Math.cos(a), Math.sin(a)));
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Logistics blocks
// ---------------------------------------------------------------------------

function drawRouter(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  frame(ctx, 1, '#2b303b', '#8b93a1');
  ctx.save();
  ctx.translate(0.5, 0.5);
  if (b.active) ctx.rotate(dc.time * 6);
  ctx.fillStyle = '#c0c6d0';
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0.3, 0);
    ctx.lineTo(0.18, -0.09);
    ctx.lineTo(0.18, 0.09);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const held = b.router?.slot.item;
  if (held && dc.detail > 0) drawItemSprite(ctx, held, 0.5, 0.5, 0.36);
}

function drawSorter(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  frame(ctx, 1, '#2a1630', '#e879f9');
  const filter = b.sorter?.filter;
  if (filter && dc.detail > 0) {
    drawItemSprite(ctx, filter, 0.5, 0.5, 0.5);
  } else {
    ctx.strokeStyle = 'rgba(232,121,249,0.6)';
    ctx.lineWidth = 0.05;
    ctx.setLineDash([0.08, 0.06]);
    ctx.strokeRect(0.32, 0.32, 0.36, 0.36);
    ctx.setLineDash([]);
  }
  const held = b.sorter?.slot.item;
  if (held && dc.detail > 1) drawItemSprite(ctx, held, 0.78, 0.22, 0.22);
}

function drawBridge(ctx: Ctx2D, b: Building): void {
  fillRoundRect(ctx, 0.07, 0.07, 0.86, 0.86, 0.18, '#3b2f12');
  fillRoundRect(ctx, 0.16, 0.16, 0.68, 0.68, 0.14, '#b7861a');
  fillRoundRect(ctx, 0.26, 0.26, 0.48, 0.48, 0.1, '#fbbf24');
  arrow(ctx, 0.5, 0.5, dirAngle(b.rot), 0.2, '#422006');
  const n = b.bridge?.queue.length ?? 0;
  ctx.fillStyle = '#fef3c7';
  for (let k = 0; k < Math.min(n, 4); k++) ctx.fillRect(0.2 + k * 0.16, 0.86, 0.1, 0.05);
}

function drawTunnel(ctx: Ctx2D, b: Building): void {
  const out = b.tunnel?.mode === 'out';
  fillRoundRect(ctx, 0.06, 0.06, 0.88, 0.88, 0.14, '#292524');
  fillRoundRect(ctx, 0.12, 0.12, 0.76, 0.76, 0.12, '#57534e');
  ctx.save();
  ctx.translate(0.5, 0.5);
  ctx.rotate(dirAngle(b.rot));
  // The dark mouth faces where items enter (back for an entrance, front for an exit).
  const mx = out ? 0.12 : -0.12;
  ctx.fillStyle = '#0c0a09';
  ctx.beginPath();
  ctx.ellipse(mx, 0, 0.2, 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = out ? '#22c55e' : '#f59e0b';
  ctx.fillRect(-0.36, -0.36, 0.72, 0.06);
  ctx.fillRect(-0.36, 0.3, 0.72, 0.06);
  ctx.restore();
  arrow(ctx, 0.5, 0.5, dirAngle(b.rot), 0.15, out ? '#bbf7d0' : '#fde68a');
  if (!b.tunnel?.partner) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0.82, 0.18, 0.08, 0, TAU);
    ctx.fill();
  }
}

function drawContainer(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  const s = b.size;
  frame(ctx, s, '#5b3d17', '#a16207');
  if (dc.detail > 0) {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.05;
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(0.2, 0.15 + (k * (s - 0.3)) / 4);
      ctx.lineTo(s - 0.2, 0.15 + (k * (s - 0.3)) / 4);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(253,230,138,0.35)';
    ctx.beginPath();
    ctx.moveTo(0.25, 0.25);
    ctx.lineTo(s - 0.25, s - 0.25);
    ctx.moveTo(s - 0.25, 0.25);
    ctx.lineTo(0.25, s - 0.25);
    ctx.stroke();
  }
  bolts(ctx, s, '#d6d3d1');
  const fill = b.storage ? invTotal(b.storage.items) / (b.storage.capacity || CONTAINER_CAPACITY) : 0;
  progressBar(ctx, 0.25, s - 0.32, s - 0.5, fill, fill > 0.95 ? '#f87171' : '#facc15');
}

function drawInserter(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  const ins = b.inserter;
  ctx.save();
  ctx.translate(0.5, 0.5);
  ctx.rotate(dirAngle(b.rot));
  fillRoundRect(ctx, -0.32, -0.32, 0.64, 0.64, 0.12, '#3f3f46');
  ctx.fillStyle = '#facc15';
  ctx.fillRect(-0.32, -0.32, 0.64, 0.07);
  ctx.fillRect(-0.32, 0.25, 0.64, 0.07);
  const p = ins?.progress ?? 0;
  const theta = ins?.phase === 1 ? Math.PI * (1 - p) : ins?.phase === 2 ? Math.PI * p : Math.PI;
  const hx = Math.cos(theta) * 0.4;
  const hy = -Math.sin(theta) * 0.24;
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#a16207';
  ctx.beginPath();
  ctx.arc(0, 0, 0.11, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e4e4e7';
  ctx.fillRect(hx - 0.06, hy - 0.06, 0.12, 0.12);
  if (ins?.held && dc.detail > 0) drawItemSprite(ctx, ins.held, hx, hy, 0.3);
  ctx.restore();
  if (ins?.filter && dc.detail > 1) drawItemSprite(ctx, ins.filter, 0.82, 0.18, 0.2);
}

// ---------------------------------------------------------------------------
// Production
// ---------------------------------------------------------------------------

function drawDrill(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  const s = b.size;
  const electric = b.kind === 'electric_drill';
  frame(ctx, s, electric ? '#172a46' : '#44403c', electric ? '#60a5fa' : '#a8a29e');
  const ore = b.drill?.ore;
  if (ore) {
    ctx.fillStyle = ITEMS[ore].color;
    for (const [x, y] of [[0.22, 0.22], [s - 0.36, 0.22], [0.22, s - 0.36], [s - 0.36, s - 0.36]]) ctx.fillRect(x ?? 0, y ?? 0, 0.14, 0.14);
  }
  const angle = (b.anim * (electric ? 7 : 3.5)) % TAU;
  drawGear(ctx, s / 2, s / 2, s * 0.3, electric ? 8 : 6, angle, electric ? '#93c5fd' : '#d6d3d1', '#1c1917');
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(-angle * 1.5);
  ctx.fillStyle = electric ? '#1d4ed8' : '#78716c';
  ctx.fillRect(-0.05, -s * 0.16, 0.1, s * 0.32);
  ctx.restore();
  if (dc.detail > 0 && (b.drill?.output ?? 0) > 0) progressBar(ctx, 0.25, s - 0.3, s - 0.5, (b.drill?.output ?? 0) / 10, '#a3e635');
}

function recipeIcon(ctx: Ctx2D, b: Building, x: number, y: number, size: number): void {
  const rec = b.crafter?.recipe;
  if (!rec) return;
  const out = RECIPES[rec].outputs[0];
  if (!out) return;
  fillRoundRect(ctx, x - size * 0.6, y - size * 0.6, size * 1.2, size * 1.2, size * 0.2, 'rgba(0,0,0,0.45)');
  drawItemSprite(ctx, out.item, x, y, size);
}

function craftProgress(b: Building): number {
  const c = b.crafter;
  if (!c?.recipe || !c.crafting) return 0;
  return c.progress / RECIPES[c.recipe].time;
}

function drawFurnace(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  const s = b.size;
  frame(ctx, s, '#4a1d0f', '#b45309');
  if (dc.detail > 0) {
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.04;
    for (let row = 0; row < 5; row++) {
      const y = 0.2 + row * 0.3;
      ctx.beginPath();
      ctx.moveTo(0.18, y);
      ctx.lineTo(s - 0.18, y);
      ctx.stroke();
      for (let col = 0; col < 4; col++) {
        const x = 0.2 + col * 0.42 + (row % 2) * 0.21;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 0.3);
        ctx.stroke();
      }
    }
  }
  // Chimney
  fillRoundRect(ctx, s - 0.62, 0.12, 0.34, 0.5, 0.06, '#292524');
  // Mouth with fire
  roundRectPath(ctx, 0.45, s - 0.85, s - 0.9, 0.55, 0.14);
  ctx.fillStyle = '#1c1917';
  ctx.fill();
  if (b.active) {
    const flick = 0.75 + Math.sin(dc.time * 17 + b.id) * 0.15 + Math.sin(dc.time * 7.3 + b.id * 3) * 0.1;
    ctx.fillStyle = rgba('#f97316', flick);
    roundRectPath(ctx, 0.52, s - 0.72, s - 1.04, 0.38, 0.12);
    ctx.fill();
    ctx.fillStyle = rgba('#fde047', flick * 0.9);
    roundRectPath(ctx, 0.7, s - 0.6, s - 1.4, 0.22, 0.08);
    ctx.fill();
  }
  if (dc.detail > 0) recipeIcon(ctx, b, 0.48, 0.48, 0.42);
  progressBar(ctx, 0.25, s - 0.24, s - 0.5, craftProgress(b), '#fb923c');
}

function drawAssembler(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  const s = b.size;
  frame(ctx, s, '#1e293b', '#64748b');
  const a = (b.anim * 2.2) % TAU;
  drawGear(ctx, 0.72, 0.82, 0.42, 10, a, '#94a3b8', '#334155');
  drawGear(ctx, 1.33, 1.26, 0.3, 7, -a * (10 / 7) + 0.2, '#cbd5e1', '#334155');
  if (dc.detail > 0) recipeIcon(ctx, b, s - 0.48, 0.48, 0.42);
  progressBar(ctx, 0.25, s - 0.24, s - 0.5, craftProgress(b), '#38bdf8');
}

function drawChemPlant(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  const s = b.size;
  frame(ctx, s, '#0f2a1a', '#22c55e');
  const rec = b.crafter?.recipe;
  const liquid = rec ? ITEMS[RECIPES[rec].outputs[0]?.item ?? 'coal'].color : '#4ade80';
  for (const [cx, cy] of [[0.66, 0.78], [1.34, 1.18]]) {
    const x = cx ?? 0;
    const y = cy ?? 0;
    ctx.fillStyle = '#052e16';
    ctx.beginPath();
    ctx.arc(x, y, 0.38, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(liquid, 0.85);
    ctx.beginPath();
    ctx.arc(x, y, 0.3, 0, TAU);
    ctx.fill();
    if (b.active && dc.detail > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let k = 0; k < 3; k++) {
        const t = (dc.time * 0.9 + k / 3 + b.id * 0.13) % 1;
        ctx.beginPath();
        ctx.arc(x + Math.sin(k * 2.1 + dc.time) * 0.12, y + 0.2 - t * 0.4, 0.04 + 0.02 * k, 0, TAU);
        ctx.fill();
      }
    }
  }
  ctx.strokeStyle = '#86efac';
  ctx.lineWidth = 0.08;
  ctx.beginPath();
  ctx.moveTo(0.9, 0.95);
  ctx.lineTo(1.1, 1.02);
  ctx.stroke();
  if (dc.detail > 0) recipeIcon(ctx, b, s - 0.48, 0.48, 0.38);
  progressBar(ctx, 0.25, s - 0.24, s - 0.5, craftProgress(b), '#4ade80');
}

function drawAdvAssembler(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  const s = b.size;
  frame(ctx, s, '#0f2f2d', '#2dd4bf');
  const a = (b.anim * 1.6) % TAU;
  drawGear(ctx, s / 2, s / 2, 0.75, 14, a, '#5eead4', '#134e4a');
  for (const [x, y, k] of [[0.5, 0.5, 0], [s - 0.5, 0.5, 1], [0.5, s - 0.5, 2], [s - 0.5, s - 0.5, 3]]) {
    drawGear(ctx, x ?? 0, y ?? 0, 0.26, 6, -a * 2.5 + (k ?? 0), '#99f6e4', '#134e4a');
  }
  if (b.active) {
    const blink = (Math.sin(dc.time * 6 + b.id) + 1) / 2;
    ctx.fillStyle = rgba('#a7f3d0', 0.4 + blink * 0.6);
    ctx.fillRect(s / 2 - 0.08, 0.2, 0.16, 0.1);
  }
  if (dc.detail > 0) recipeIcon(ctx, b, s / 2, s / 2, 0.5);
  progressBar(ctx, 0.3, s - 0.26, s - 0.6, craftProgress(b), '#2dd4bf');
}

// ---------------------------------------------------------------------------
// Power
// ---------------------------------------------------------------------------

function drawGenerator(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  const s = b.size;
  frame(ctx, s, '#2a0b0b', '#dc2626');
  fillRoundRect(ctx, 0.35, 0.55, s - 0.7, s - 0.95, 0.12, '#140707');
  if (b.active) {
    const f = 0.7 + Math.sin(dc.time * 19 + b.id) * 0.2;
    ctx.fillStyle = rgba('#f97316', f);
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const x = 0.5 + k * 0.27;
      const h = 0.35 + Math.sin(dc.time * 11 + k * 1.7 + b.id) * 0.12;
      ctx.moveTo(x - 0.1, s - 0.45);
      ctx.quadraticCurveTo(x, s - 0.45 - h, x + 0.1, s - 0.45);
    }
    ctx.fill();
  }
  for (const x of [0.3, s - 0.48]) fillRoundRect(ctx, x, 0.14, 0.18, 0.32, 0.05, '#3f3f46');
  const fuel = b.generator?.fuel ?? 0;
  ctx.fillStyle = '#a3a3a3';
  for (let k = 0; k < Math.min(fuel, 10); k++) ctx.fillRect(0.28 + k * 0.145, s - 0.3, 0.1, 0.08);
  if (fuel === 0 && (b.generator?.burn ?? 0) <= 0 && Math.floor(dc.time * 2) % 2 === 0) {
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.arc(s - 0.3, 0.3, 0.09, 0, TAU);
    ctx.fill();
  }
}

function drawSolar(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  const s = b.size;
  fillRoundRect(ctx, 0.05, 0.05, s - 0.1, s - 0.1, 0.1, '#334155');
  for (let cy = 0; cy < 2; cy++) {
    for (let cx = 0; cx < 2; cx++) {
      const x = 0.14 + cx * 0.88;
      const y = 0.14 + cy * 0.88;
      fillRoundRect(ctx, x, y, 0.84, 0.84, 0.06, '#1e3a8a');
      if (dc.detail > 0) {
        ctx.strokeStyle = 'rgba(147,197,253,0.25)';
        ctx.lineWidth = 0.025;
        ctx.beginPath();
        for (let k = 1; k < 3; k++) {
          ctx.moveTo(x + (k * 0.84) / 3, y);
          ctx.lineTo(x + (k * 0.84) / 3, y + 0.84);
          ctx.moveTo(x, y + (k * 0.84) / 3);
          ctx.lineTo(x + 0.84, y + (k * 0.84) / 3);
        }
        ctx.stroke();
      }
    }
  }
  // Sun sheen sweeps across while generating.
  if (dc.daylight > 0.05) {
    const t = (dc.time * 0.25 + b.id * 0.17) % 1;
    ctx.fillStyle = `rgba(191,219,254,${0.22 * dc.daylight})`;
    ctx.beginPath();
    ctx.moveTo(t * s * 1.6 - 0.4, 0.1);
    ctx.lineTo(t * s * 1.6, 0.1);
    ctx.lineTo(t * s * 1.6 - 0.5, s - 0.1);
    ctx.lineTo(t * s * 1.6 - 0.9, s - 0.1);
    ctx.closePath();
    ctx.fill();
  }
}

function drawAccumulator(ctx: Ctx2D, b: Building): void {
  const s = b.size;
  frame(ctx, s, '#04210f', '#16a34a');
  const cap = BUILDINGS.accumulator.power?.storage ?? 1;
  const frac = (b.accumulator?.stored ?? 0) / cap;
  for (let k = 0; k < 3; k++) {
    const x = 0.3 + k * 0.5;
    fillRoundRect(ctx, x, 0.35, 0.38, s - 0.7, 0.08, '#022c22');
    const h = (s - 0.82) * frac;
    ctx.fillStyle = frac > 0.15 ? '#4ade80' : '#f87171';
    ctx.fillRect(x + 0.06, s - 0.41 - h, 0.26, h);
    ctx.fillStyle = '#bbf7d0';
    ctx.fillRect(x + 0.12, 0.27, 0.14, 0.08);
  }
}

function drawPole(ctx: Ctx2D, b: Building): void {
  fillRoundRect(ctx, 0.3, 0.3, 0.4, 0.4, 0.08, '#44403c');
  ctx.fillStyle = '#a16207';
  ctx.fillRect(0.44, 0.16, 0.12, 0.62);
  ctx.fillStyle = '#d6b37a';
  ctx.fillRect(0.18, 0.2, 0.64, 0.1);
  ctx.fillStyle = b.powerNet >= 0 ? '#e0f2fe' : '#9ca3af';
  for (const x of [0.22, 0.5, 0.78]) {
    ctx.beginPath();
    ctx.arc(x, 0.2, 0.05, 0, TAU);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Science / victory
// ---------------------------------------------------------------------------

function drawLab(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  const s = b.size;
  frame(ctx, s, '#1b1840', '#818cf8');
  const grad = ctx.createRadialGradient(s / 2 - 0.15, s / 2 - 0.15, 0.05, s / 2, s / 2, 0.62);
  grad.addColorStop(0, '#c7d2fe');
  grad.addColorStop(1, '#3730a3');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, 0.55, 0, TAU);
  ctx.fill();
  if (b.active) {
    ctx.fillStyle = '#e0e7ff';
    for (let k = 0; k < 3; k++) {
      const a = dc.time * 2.4 + (k * TAU) / 3;
      ctx.beginPath();
      ctx.arc(s / 2 + Math.cos(a) * 0.68, s / 2 + Math.sin(a) * 0.38, 0.07, 0, TAU);
      ctx.fill();
    }
  }
  progressBar(ctx, 0.25, s - 0.24, s - 0.5, b.lab?.progress ?? 0, '#a5b4fc');
}

function drawRocket(ctx: Ctx2D, cx: number, baseY: number, h: number, built: number): void {
  // Ghost outline of the whole rocket, solid for the assembled part.
  const w = 0.62;
  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx, baseY - h);
    ctx.quadraticCurveTo(cx + w, baseY - h * 0.7, cx + w * 0.75, baseY);
    ctx.lineTo(cx - w * 0.75, baseY);
    ctx.quadraticCurveTo(cx - w, baseY - h * 0.7, cx, baseY - h);
    ctx.closePath();
  };
  shape();
  ctx.strokeStyle = 'rgba(148,163,184,0.6)';
  ctx.lineWidth = 0.04;
  ctx.setLineDash([0.1, 0.08]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (built <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 2, baseY - h * built, 4, h * built + 0.01);
  ctx.clip();
  shape();
  ctx.fillStyle = '#e2e8f0';
  ctx.fill();
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(cx - w, baseY - h * 0.28, w * 2, 0.16);
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(cx, baseY - h * 0.62, 0.14, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#991b1b';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.75, baseY);
  ctx.lineTo(cx - w * 1.3, baseY + 0.35);
  ctx.lineTo(cx - w * 0.5, baseY - 0.3);
  ctx.moveTo(cx + w * 0.75, baseY);
  ctx.lineTo(cx + w * 1.3, baseY + 0.35);
  ctx.lineTo(cx + w * 0.5, baseY - 0.3);
  ctx.fill();
  ctx.restore();
}

function drawSilo(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  const s = b.size;
  fillRoundRect(ctx, 0.05, 0.05, s - 0.1, s - 0.1, 0.2, '#111827');
  // Hazard stripes around the pad
  ctx.save();
  roundRectPath(ctx, 0.12, 0.12, s - 0.24, s - 0.24, 0.16);
  ctx.clip();
  ctx.fillStyle = '#facc15';
  for (let k = -8; k < 16; k++) {
    ctx.beginPath();
    ctx.moveTo(k * 0.5, 0);
    ctx.lineTo(k * 0.5 + 0.25, 0);
    ctx.lineTo(k * 0.5 + 0.25 - s, s);
    ctx.lineTo(k * 0.5 - s, s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  fillRoundRect(ctx, 0.4, 0.4, s - 0.8, s - 0.8, 0.3, '#1f2937');
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 0.06;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, 1.2, 0, TAU);
  ctx.stroke();
  const installed = b.silo?.installed ?? 0;
  let lift = 0;
  if (dc.launchTimer >= 0) lift = Math.max(0, dc.launchTimer - 3) ** 2 * 1.5;
  drawRocket(ctx, s / 2, s / 2 + 1.25 - lift, 2.9, Math.min(1, installed / ROCKET_PARTS_REQUIRED));
  if (dc.launchTimer >= 0 && dc.launchTimer < 3) {
    ctx.fillStyle = `rgba(253,224,71,${0.3 + 0.3 * Math.sin(dc.time * 20)})`;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2 + 1.3, 0.5 + dc.launchTimer * 0.2, 0, TAU);
    ctx.fill();
  }
  progressBar(ctx, 0.4, s - 0.3, s - 0.8, installed / ROCKET_PARTS_REQUIRED, '#f8fafc');
}

// ---------------------------------------------------------------------------
// Defense
// ---------------------------------------------------------------------------

function turretBase(ctx: Ctx2D, s: number, rim: string): void {
  const c = s / 2;
  const r = s * 0.46;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const x = c + Math.cos(a) * r;
    const y = c + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#18181b';
  ctx.fill();
  ctx.strokeStyle = rim;
  ctx.lineWidth = 0.07;
  ctx.stroke();
}

function drawTurret(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  const s = b.size;
  const def = BUILDINGS[b.kind];
  const t = b.turret;
  const tdef = TURRETS[b.kind];
  turretBase(ctx, s, def.color);
  const c = s / 2;
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(t?.angle ?? 0);
  const recoil = (t?.flash ?? 0) * 0.08 * s;
  switch (b.kind) {
    case 'mg_turret':
      ctx.fillStyle = '#a1a1aa';
      ctx.fillRect(0.05 - recoil, -0.12, 0.42, 0.07);
      ctx.fillRect(0.05 - recoil, 0.05, 0.42, 0.07);
      fillRoundRect(ctx, -0.22, -0.2, 0.36, 0.4, 0.08, '#ca8a04');
      break;
    case 'shotgun_turret':
      ctx.fillStyle = '#71717a';
      for (const y of [-0.28, -0.07, 0.14]) ctx.fillRect(0.2 - recoil, y, 0.6, 0.14);
      fillRoundRect(ctx, -0.45, -0.42, 0.75, 0.84, 0.14, '#b91c1c');
      break;
    case 'cannon_turret':
      ctx.fillStyle = '#52525b';
      ctx.fillRect(0.1 - recoil, -0.14, 0.95, 0.28);
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(0.85 - recoil, -0.18, 0.2, 0.36);
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(0, 0, 0.45, 0, TAU);
      ctx.fill();
      break;
    case 'laser_turret':
      ctx.fillStyle = '#9f1239';
      ctx.beginPath();
      ctx.arc(0, 0, 0.42, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.moveTo(0.75, 0);
      ctx.lineTo(0.2, -0.16);
      ctx.lineTo(0.2, 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe4e6';
      ctx.beginPath();
      ctx.arc(0.1, 0, 0.12, 0, TAU);
      ctx.fill();
      break;
    case 'slow_turret': {
      ctx.rotate(-(t?.angle ?? 0) + dc.time * 0.6);
      ctx.fillStyle = '#0c4a6e';
      ctx.beginPath();
      ctx.arc(0, 0, 0.55, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 0.07;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 0.45, Math.sin(a) * 0.45);
      }
      ctx.stroke();
      break;
    }
    case 'repair_turret':
      ctx.rotate(-(t?.angle ?? 0));
      fillRoundRect(ctx, -0.5, -0.5, 1, 1, 0.2, '#14532d');
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(-0.12, -0.38, 0.24, 0.76);
      ctx.fillRect(-0.38, -0.12, 0.76, 0.24);
      break;
    case 'core':
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(0.05 - recoil, -0.06, 0.55, 0.12);
      ctx.fillStyle = '#155e75';
      ctx.beginPath();
      ctx.arc(0, 0, 0.26, 0, TAU);
      ctx.fill();
      break;
    default:
      break;
  }
  ctx.restore();
  // Ammo gauge for ammo turrets; blink red when empty.
  if (tdef && tdef.ammo.length > 0 && t) {
    const frac = t.ammo / tdef.magazine;
    if (t.ammo <= 0) {
      if (Math.floor(dc.time * 2.5) % 2 === 0) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(s - 0.22, 0.22, 0.09, 0, TAU);
        ctx.fill();
      }
    } else {
      progressBar(ctx, 0.2, s - 0.18, s - 0.4, frac, t.ammoItem ? ITEMS[t.ammoItem].color : '#facc15');
    }
  }
}

function drawWall(ctx: Ctx2D, b: Building): void {
  const ratio = b.hp / b.maxHp;
  if (b.kind === 'titanium_wall') {
    fillRoundRect(ctx, 0.03, 0.03, 0.94, 0.94, 0.08, '#334155');
    fillRoundRect(ctx, 0.1, 0.1, 0.8, 0.8, 0.06, '#94a3b8');
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0.1, 0.46, 0.8, 0.08);
    ctx.fillStyle = '#e2e8f0';
    for (const [x, y] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
      ctx.beginPath();
      ctx.arc(x ?? 0, y ?? 0, 0.05, 0, TAU);
      ctx.fill();
    }
  } else {
    fillRoundRect(ctx, 0.03, 0.03, 0.94, 0.94, 0.06, '#44403c');
    ctx.fillStyle = '#78716c';
    ctx.fillRect(0.08, 0.08, 0.4, 0.38);
    ctx.fillRect(0.52, 0.08, 0.4, 0.38);
    ctx.fillRect(0.08, 0.54, 0.22, 0.38);
    ctx.fillRect(0.34, 0.54, 0.4, 0.38);
    ctx.fillRect(0.78, 0.54, 0.14, 0.38);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0.08, 0.08, 0.84, 0.05);
  }
  if (ratio < 0.66) {
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(0.2, 0.15);
    ctx.lineTo(0.45, 0.45);
    ctx.lineTo(0.35, 0.7);
    if (ratio < 0.33) {
      ctx.moveTo(0.8, 0.2);
      ctx.lineTo(0.55, 0.5);
      ctx.lineTo(0.7, 0.85);
    }
    ctx.stroke();
  }
}

function drawCore(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  const s = b.size;
  frame(ctx, s, '#082f49', '#0891b2');
  const c = s / 2;
  const pulse = 0.5 + Math.sin(dc.time * 2.2) * 0.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    const x = c + Math.cos(a) * 1.05;
    const y = c + Math.sin(a) * 1.05;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#0e7490';
  ctx.fill();
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 0.06;
  ctx.stroke();
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(dc.time * 0.8);
  ctx.strokeStyle = rgba('#a5f3fc', 0.7);
  ctx.lineWidth = 0.08;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.arc(0, 0, 0.75, (k * TAU) / 3, (k * TAU) / 3 + 1.2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = rgba('#cffafe', 0.6 + pulse * 0.4);
  ctx.beginPath();
  ctx.arc(c, c, 0.32 + pulse * 0.05, 0, TAU);
  ctx.fill();
  drawTurret(ctx, b, dc);
}

/** Draws any non-belt building in world units. Belts use drawBelt (ground layer). */
export function drawBuilding(ctx: Ctx2D, b: Building, dc: DrawCtx): void {
  if (dc.detail === 0) {
    const def = BUILDINGS[b.kind];
    ctx.fillStyle = def.color;
    ctx.fillRect(b.x + 0.08, b.y + 0.08, b.size - 0.16, b.size - 0.16);
    return;
  }
  ctx.save();
  ctx.translate(b.x, b.y);
  switch (b.kind) {
    case 'core':
      drawCore(ctx, b, dc);
      break;
    case 'router':
      drawRouter(ctx, b, dc);
      break;
    case 'sorter':
      drawSorter(ctx, b, dc);
      break;
    case 'bridge':
      drawBridge(ctx, b);
      break;
    case 'tunnel':
      drawTunnel(ctx, b);
      break;
    case 'container':
      drawContainer(ctx, b, dc);
      break;
    case 'inserter':
      drawInserter(ctx, b, dc);
      break;
    case 'mech_drill':
    case 'electric_drill':
      drawDrill(ctx, b, dc);
      break;
    case 'furnace':
      drawFurnace(ctx, b, dc);
      break;
    case 'assembler':
      drawAssembler(ctx, b, dc);
      break;
    case 'chem_plant':
      drawChemPlant(ctx, b, dc);
      break;
    case 'adv_assembler':
      drawAdvAssembler(ctx, b, dc);
      break;
    case 'thermal_generator':
      drawGenerator(ctx, b, dc);
      break;
    case 'solar_panel':
      drawSolar(ctx, b, dc);
      break;
    case 'accumulator':
      drawAccumulator(ctx, b);
      break;
    case 'power_pole':
      drawPole(ctx, b);
      break;
    case 'lab':
      drawLab(ctx, b, dc);
      break;
    case 'rocket_silo':
      drawSilo(ctx, b, dc);
      break;
    case 'wall':
    case 'titanium_wall':
      drawWall(ctx, b);
      break;
    default:
      if (b.turret) drawTurret(ctx, b, dc);
      break;
  }
  if (b.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, b.hitFlash * 5)})`;
    ctx.fillRect(0, 0, b.size, b.size);
  }
  ctx.restore();
}

/** Light emitted by a building for the additive glow pass: [color, radius, intensity] or null. */
export function buildingLight(b: Building, time: number): [string, number, number] | null {
  switch (b.kind) {
    case 'core':
      return ['#22d3ee', 3.4, 0.55 + Math.sin(time * 2.2) * 0.1];
    case 'furnace':
      return b.active ? ['#f97316', 2.1, 0.75 + Math.sin(time * 17 + b.id) * 0.12] : null;
    case 'thermal_generator':
      return b.active ? ['#ef4444', 2.3, 0.8 + Math.sin(time * 19 + b.id) * 0.12] : null;
    case 'electric_drill':
      return b.active ? ['#60a5fa', 1.4, 0.35] : null;
    case 'chem_plant':
      return b.active ? ['#4ade80', 1.6, 0.45] : null;
    case 'adv_assembler':
      return b.active ? ['#2dd4bf', 2.2, 0.5] : null;
    case 'lab':
      return b.active ? ['#818cf8', 1.8, 0.55] : null;
    case 'rocket_silo':
      return b.active ? ['#f8fafc', 3, 0.35] : null;
    case 'accumulator':
      return b.active ? ['#22c55e', 1.2, 0.3] : null;
    case 'slow_turret':
      return ['#38bdf8', 1.3, 0.25 + (b.turret?.flash ?? 0) * 0.5];
    default:
      if (b.turret && (b.turret.flash ?? 0) > 0.05) return ['#fde68a', 1.2, b.turret.flash * 0.6];
      return null;
  }
}
