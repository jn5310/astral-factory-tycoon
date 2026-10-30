/** Canvas drawing helpers shared by the world renderer, the minimap and UI icons. */

export type Ctx2D = CanvasRenderingContext2D;

export function roundRectPath(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function fillRoundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Gear outline: `teeth` square teeth around radius r, rotated by `angle`. */
export function gearPath(ctx: Ctx2D, cx: number, cy: number, r: number, teeth: number, angle: number, depth = 0.24): void {
  const steps = teeth * 4;
  const step = (Math.PI * 2) / steps;
  ctx.beginPath();
  for (let i = 0; i < steps; i++) {
    const a = angle + i * step;
    const k = i % 4;
    const rad = k === 1 || k === 2 ? r : r * (1 - depth);
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawGear(ctx: Ctx2D, cx: number, cy: number, r: number, teeth: number, angle: number, fill: string, hub: string): void {
  gearPath(ctx, cx, cy, r, teeth, angle);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = hub;
  ctx.fill();
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return [255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Mixes a hex color toward white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amount < 0 ? 0 : 255;
  const p = Math.min(1, Math.abs(amount));
  const mix = (c: number): number => Math.round(c + (t - c) * p);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

const glowCache = new Map<string, HTMLCanvasElement>();

/** Pre-rendered radial glow sprite per color; drawing it with 'lighter' composite is far cheaper than shadowBlur. */
export function glowSprite(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, rgba(color, 1));
    grad.addColorStop(0.25, rgba(color, 0.55));
    grad.addColorStop(0.6, rgba(color, 0.15));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  glowCache.set(color, c);
  return c;
}

export function drawGlow(ctx: Ctx2D, x: number, y: number, radius: number, color: string, alpha: number): void {
  if (alpha <= 0.01 || radius <= 0) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

/** Cheap deterministic hash in [0, 1) for per-tile decoration. */
export function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
