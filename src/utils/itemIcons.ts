import { ITEMS, type ItemId } from '../data/items';
import { drawGear, roundRectPath, shade, type Ctx2D } from './draw';

/**
 * Draws a procedural icon for an item centered at (cx, cy) with diameter s, in whatever units the
 * context currently uses. Every item is built from canvas primitives (zero image assets).
 */
export function drawItemIcon(ctx: Ctx2D, id: ItemId, cx: number, cy: number, s: number): void {
  const def = ITEMS[id];
  const r = s / 2;
  const c = def.color;
  const a = def.accent;
  ctx.lineWidth = s * 0.08;
  ctx.strokeStyle = shade(c, -0.55);
  switch (def.shape) {
    case 'ore': {
      ctx.beginPath();
      const pts = [
        [-0.9, -0.2], [-0.5, -0.8], [0.2, -0.9], [0.85, -0.4], [0.9, 0.3], [0.4, 0.85], [-0.4, 0.8], [-0.9, 0.4],
      ];
      pts.forEach(([px, py], i) => {
        const x = cx + (px ?? 0) * r * 0.85;
        const y = cy + (py ?? 0) * r * 0.85;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = a;
      for (const [px, py, pr] of [[-0.3, -0.2, 0.18], [0.35, 0.15, 0.14], [-0.05, 0.45, 0.12]]) {
        ctx.beginPath();
        ctx.arc(cx + (px ?? 0) * r, cy + (py ?? 0) * r, (pr ?? 0.1) * r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.35, cy - r * 0.45, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'sand': {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.25, r * 0.85, r * 0.5, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = a;
      for (const [px, py] of [[-0.4, 0.1], [0.1, -0.05], [0.45, 0.15], [-0.1, 0.3], [0.25, 0.32]]) {
        ctx.fillRect(cx + (px ?? 0) * r, cy + (py ?? 0) * r, r * 0.12, r * 0.12);
      }
      break;
    }
    case 'plate': {
      roundRectPath(ctx, cx - r * 0.8, cy - r * 0.55, r * 1.6, r * 1.1, r * 0.2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(cx - r * 0.6, cy - r * 0.4, r * 1.1, r * 0.18);
      ctx.fillStyle = a;
      ctx.fillRect(cx - r * 0.6, cy + r * 0.2, r * 1.2, r * 0.1);
      break;
    }
    case 'ingot': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.55, cy - r * 0.45);
      ctx.lineTo(cx + r * 0.55, cy - r * 0.45);
      ctx.lineTo(cx + r * 0.9, cy + r * 0.45);
      ctx.lineTo(cx - r * 0.9, cy + r * 0.45);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = a;
      ctx.fillRect(cx - r * 0.45, cy - r * 0.3, r * 0.9, r * 0.14);
      break;
    }
    case 'crystal': {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(ang) * r * 0.85;
        const y = cy + Math.sin(ang) * r * 0.85;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.3, cy - r * 0.4);
      ctx.lineTo(cx + r * 0.1, cy + r * 0.4);
      ctx.stroke();
      break;
    }
    case 'brick': {
      roundRectPath(ctx, cx - r * 0.85, cy - r * 0.5, r * 1.7, r, r * 0.1);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = a;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.85, cy);
      ctx.lineTo(cx + r * 0.85, cy);
      ctx.moveTo(cx, cy - r * 0.5);
      ctx.lineTo(cx, cy);
      ctx.moveTo(cx - r * 0.42, cy);
      ctx.lineTo(cx - r * 0.42, cy + r * 0.5);
      ctx.moveTo(cx + r * 0.42, cy);
      ctx.lineTo(cx + r * 0.42, cy + r * 0.5);
      ctx.stroke();
      break;
    }
    case 'gear':
      drawGear(ctx, cx, cy, r * 0.9, 8, 0.2, c, a);
      break;
    case 'coil': {
      ctx.fillStyle = shade(a, -0.2);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = c;
      ctx.lineWidth = s * 0.1;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * (0.25 + k * 0.2), 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'chip': {
      ctx.fillStyle = a;
      for (let k = -1; k <= 1; k++) {
        ctx.fillRect(cx - r * 0.95, cy + k * r * 0.4 - r * 0.07, r * 1.9, r * 0.14);
        ctx.fillRect(cx + k * r * 0.4 - r * 0.07, cy - r * 0.95, r * 0.14, r * 1.9);
      }
      roundRectPath(ctx, cx - r * 0.65, cy - r * 0.65, r * 1.3, r * 1.3, r * 0.15);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = shade(a, 0.4);
      ctx.fillRect(cx - r * 0.3, cy - r * 0.3, r * 0.6, r * 0.6);
      break;
    }
    case 'cell': {
      roundRectPath(ctx, cx - r * 0.45, cy - r * 0.75, r * 0.9, r * 1.6, r * 0.18);
      ctx.fillStyle = a;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.fillRect(cx - r * 0.35, cy - r * 0.2, r * 0.7, r * 0.85);
      ctx.fillStyle = shade(c, 0.3);
      ctx.fillRect(cx - r * 0.18, cy - r * 0.95, r * 0.36, r * 0.22);
      break;
    }
    case 'engine': {
      roundRectPath(ctx, cx - r * 0.75, cy - r * 0.45, r * 1.5, r * 1.05, r * 0.15);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = a;
      ctx.fillRect(cx - r * 0.55, cy - r * 0.85, r * 0.3, r * 0.45);
      ctx.fillRect(cx + r * 0.25, cy - r * 0.85, r * 0.3, r * 0.45);
      ctx.fillStyle = shade(c, -0.4);
      ctx.fillRect(cx - r * 0.5, cy - r * 0.1, r, r * 0.12);
      ctx.fillRect(cx - r * 0.5, cy + r * 0.2, r, r * 0.12);
      break;
    }
    case 'block': {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.8);
      ctx.lineTo(cx + r * 0.8, cy - r * 0.35);
      ctx.lineTo(cx + r * 0.8, cy + r * 0.45);
      ctx.lineTo(cx, cy + r * 0.85);
      ctx.lineTo(cx - r * 0.8, cy + r * 0.45);
      ctx.lineTo(cx - r * 0.8, cy - r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = shade(c, 0.3);
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.8);
      ctx.lineTo(cx + r * 0.8, cy - r * 0.35);
      ctx.lineTo(cx, cy + r * 0.05);
      ctx.lineTo(cx - r * 0.8, cy - r * 0.35);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'powder': {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.25, cy - r * 0.75);
      ctx.lineTo(cx + r * 0.25, cy - r * 0.75);
      ctx.quadraticCurveTo(cx + r * 0.95, cy + r * 0.1, cx + r * 0.6, cy + r * 0.85);
      ctx.lineTo(cx - r * 0.6, cy + r * 0.85);
      ctx.quadraticCurveTo(cx - r * 0.95, cy + r * 0.1, cx - r * 0.25, cy - r * 0.75);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = a;
      ctx.fillRect(cx - r * 0.3, cy - r * 0.6, r * 0.6, r * 0.14);
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.25, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bullet': {
      ctx.fillStyle = a;
      for (const off of [-0.45, 0.05]) {
        ctx.fillRect(cx + off * r, cy - r * 0.1, r * 0.4, r * 0.85);
      }
      ctx.fillStyle = c;
      for (const off of [-0.45, 0.05]) {
        ctx.beginPath();
        ctx.moveTo(cx + off * r, cy - r * 0.1);
        ctx.lineTo(cx + (off + 0.2) * r, cy - r * 0.85);
        ctx.lineTo(cx + (off + 0.4) * r, cy - r * 0.1);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'shell': {
      roundRectPath(ctx, cx - r * 0.38, cy - r * 0.55, r * 0.76, r * 1.4, r * 0.12);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = a;
      ctx.fillRect(cx - r * 0.38, cy + r * 0.55, r * 0.76, r * 0.3);
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.55, r * 0.38, Math.PI, 0);
      ctx.fillStyle = shade(c, -0.25);
      ctx.fill();
      break;
    }
    case 'canister': {
      roundRectPath(ctx, cx - r * 0.6, cy - r * 0.6, r * 1.2, r * 1.45, r * 0.2);
      ctx.fillStyle = a;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.fillRect(cx - r * 0.45, cy - r * 0.15, r * 0.9, r * 0.5);
      ctx.fillStyle = shade(a, -0.3);
      ctx.fillRect(cx - r * 0.2, cy - r * 0.9, r * 0.4, r * 0.3);
      break;
    }
    case 'hex': {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const x = cx + Math.cos(ang) * r * 0.85;
        const y = cy + Math.sin(ang) * r * 0.85;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = a;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'rocket': {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.95);
      ctx.quadraticCurveTo(cx + r * 0.45, cy - r * 0.4, cx + r * 0.3, cy + r * 0.5);
      ctx.lineTo(cx - r * 0.3, cy + r * 0.5);
      ctx.quadraticCurveTo(cx - r * 0.45, cy - r * 0.4, cx, cy - r * 0.95);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = a;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.3, cy + r * 0.2);
      ctx.lineTo(cx - r * 0.65, cy + r * 0.8);
      ctx.lineTo(cx - r * 0.2, cy + r * 0.55);
      ctx.moveTo(cx + r * 0.3, cy + r * 0.2);
      ctx.lineTo(cx + r * 0.65, cy + r * 0.8);
      ctx.lineTo(cx + r * 0.2, cy + r * 0.55);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.3, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

const SPRITE_PX = 40;
const spriteCache = new Map<ItemId, HTMLCanvasElement>();
const urlCache = new Map<ItemId, string>();

/** Item icon pre-rendered once into a small canvas (drawn many times per frame on belts). */
export function itemSprite(id: ItemId): HTMLCanvasElement {
  let c = spriteCache.get(id);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = SPRITE_PX;
  c.height = SPRITE_PX;
  const g = c.getContext('2d');
  if (g) drawItemIcon(g, id, SPRITE_PX / 2, SPRITE_PX / 2, SPRITE_PX * 0.84);
  spriteCache.set(id, c);
  return c;
}

export function drawItemSprite(ctx: Ctx2D, id: ItemId, x: number, y: number, size: number): void {
  ctx.drawImage(itemSprite(id), x - size / 2, y - size / 2, size, size);
}

/** Data URL of the item icon for <img> tags in the React UI (generated in memory, never fetched). */
export function itemIconUrl(id: ItemId): string {
  let url = urlCache.get(id);
  if (url) return url;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (g) drawItemIcon(g, id, 32, 32, 54);
  url = c.toDataURL();
  urlCache.set(id, url);
  return url;
}
