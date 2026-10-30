import type { Enemy } from '../entities/Enemy';
import type { Particle } from '../entities/Particle';
import type { Projectile } from '../entities/Projectile';
import { ENEMIES } from '../data/enemies';
import { drawGlow, rgba, shade, type Ctx2D } from '../utils/draw';

const TAU = Math.PI * 2;

function legs(ctx: Ctx2D, r: number, n: number, phase: number, color: string, len = 0.55): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const k = Math.floor(i / 2) - (n / 2 - 1) / 2;
    const swing = Math.sin(phase * 10 + i * 1.7) * 0.3;
    const bx = k * r * 0.5;
    ctx.moveTo(bx, 0);
    ctx.lineTo(bx + swing * r, side * r * (0.9 + len));
  }
  ctx.stroke();
}

function eyes(ctx: Ctx2D, r: number, color: string): void {
  ctx.fillStyle = color;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(r * 0.55, s * r * 0.28, r * 0.13, 0, TAU);
    ctx.fill();
  }
}

/** Procedural alien: each type gets its own silhouette and animation (local frame faces +x). */
export function drawEnemy(ctx: Ctx2D, e: Enemy, time: number, detail: boolean): void {
  const def = ENEMIES[e.type];
  const r = e.radius;
  const body = e.slowTimer > 0 ? shade(def.color, 0.35) : def.color;
  if (!detail) {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(e.x, e.y, Math.max(r, 0.35), 0, TAU);
    ctx.fill();
    return;
  }
  const flying = def.flying;
  if (flying) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(e.x + 0.35, e.y + 0.55, r * 0.9, r * 0.5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  const dark = shade(def.color, -0.45);
  switch (e.type) {
    case 'rusher':
      legs(ctx, r, 6, e.anim, dark, 0.3);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.05, r * 0.75, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(r * 0.9, -r * 0.3);
      ctx.lineTo(r * 1.4, 0);
      ctx.lineTo(r * 0.9, r * 0.3);
      ctx.fill();
      eyes(ctx, r, '#fef08a');
      break;
    case 'charger':
      legs(ctx, r, 6, e.anim * 0.6, dark, 0.2);
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.15, r * 0.95, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = body;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(-r * 0.45 + k * r * 0.42, 0, r * 0.32, r * 0.85, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#d9f99d';
      ctx.beginPath();
      ctx.moveTo(r * 0.95, -r * 0.18);
      ctx.lineTo(r * 1.55, 0);
      ctx.lineTo(r * 0.95, r * 0.18);
      ctx.fill();
      break;
    case 'spitter': {
      legs(ctx, r, 4, e.anim, dark, 0.35);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      const sac = 0.55 + Math.sin(time * 5 + e.id) * 0.1;
      ctx.fillStyle = rgba('#ecfccb', 0.8);
      ctx.beginPath();
      ctx.arc(-r * 0.35, 0, r * sac, 0, TAU);
      ctx.fill();
      eyes(ctx, r, '#14532d');
      break;
    }
    case 'bomber': {
      const pulse = 1 + Math.sin(time * 9 + e.id) * 0.12;
      legs(ctx, r, 4, e.anim, dark, 0.25);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, r * pulse, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba('#fef08a', 0.5 + 0.5 * Math.sin(time * 9 + e.id));
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45 * pulse, 0, TAU);
      ctx.fill();
      break;
    }
    case 'flyer': {
      const flap = Math.sin(e.anim * 3) * 0.6;
      ctx.fillStyle = rgba(shade(def.color, 0.25), 0.85);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.2, 0);
        ctx.quadraticCurveTo(-r * 0.6, s * r * (1.8 + flap), -r * 1.1, s * r * (1.4 + flap));
        ctx.lineTo(r * 0.3, s * r * 0.2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.1, r * 0.45, 0, 0, TAU);
      ctx.fill();
      eyes(ctx, r * 0.8, '#fae8ff');
      break;
    }
    case 'brood':
      legs(ctx, r, 8, e.anim, dark, 0.25);
      ctx.fillStyle = body;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(-r * 0.6 + k * r * 0.6, 0, r * (0.55 + k * 0.1), 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = shade(def.color, 0.4);
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.arc(-r * 0.6 + k * r * 0.3, -r * 0.35, r * 0.08, 0, TAU);
        ctx.fill();
      }
      eyes(ctx, r * 1.1, '#fde68a');
      break;
    case 'healer': {
      ctx.strokeStyle = rgba('#f9a8d4', 0.35 + 0.25 * Math.sin(time * 3 + e.id));
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.arc(0, 0, def.range * 0.35, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = dark;
      ctx.lineWidth = r * 0.18;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = Math.PI + (k - 2) * 0.45;
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(
          Math.cos(a) * r * 1.2 + Math.sin(e.anim * 6 + k) * r * 0.3,
          Math.sin(a) * r * 1.2,
          Math.cos(a) * r * 1.9,
          Math.sin(a) * r * 1.9 + Math.cos(e.anim * 5 + k) * r * 0.3,
        );
      }
      ctx.stroke();
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fdf2f8';
      ctx.fillRect(-r * 0.12, -r * 0.45, r * 0.24, r * 0.9);
      ctx.fillRect(-r * 0.45, -r * 0.12, r * 0.9, r * 0.24);
      break;
    }
    case 'leviathan': {
      // Segmented serpent body trailing behind the head.
      for (let k = 5; k >= 1; k--) {
        const wob = Math.sin(e.anim * 2 - k * 0.8) * r * 0.35;
        ctx.fillStyle = k % 2 ? dark : body;
        ctx.beginPath();
        ctx.arc(-k * r * 0.62, wob, r * (1 - k * 0.11), 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.05, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fecdd3';
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k / 5) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45);
        ctx.lineTo(Math.cos(a + 0.2) * r, Math.sin(a + 0.2) * r);
        ctx.fill();
      }
      eyes(ctx, r, '#fde047');
      break;
    }
  }
  ctx.restore();
  if (e.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, e.hitFlash * 6)})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, TAU);
    ctx.fill();
  }
  if (e.hp < e.maxHp) {
    const w = Math.max(0.6, r * 2.2);
    const y = e.y - r - (flying ? 0.55 : 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - w / 2, y, w, 0.09);
    ctx.fillStyle = e.type === 'leviathan' ? '#f43f5e' : '#ef4444';
    ctx.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 0.09);
  }
}

/** Projectiles glow, so they are drawn in the additive light pass. */
export function drawProjectile(ctx: Ctx2D, p: Projectile): void {
  switch (p.kind) {
    case 'bullet':
    case 'pellet': {
      const speed = Math.hypot(p.vx, p.vy) || 1;
      const len = p.kind === 'bullet' ? 0.55 : 0.3;
      ctx.strokeStyle = p.kind === 'bullet' ? '#fde68a' : '#fca5a5';
      ctx.lineWidth = p.kind === 'bullet' ? 0.07 : 0.09;
      ctx.beginPath();
      ctx.moveTo(p.x - (p.vx / speed) * len, p.y - (p.vy / speed) * len);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      break;
    }
    case 'shell':
    case 'acid': {
      const t = p.totalLife > 0 ? 1 - Math.max(0, p.life) / p.totalLife : 1;
      const dist = Math.hypot(p.tx - p.sx, p.ty - p.sy);
      const height = Math.sin(t * Math.PI) * Math.min(3, 0.6 + dist * 0.25);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.12, 0, TAU);
      ctx.fill();
      const color = p.kind === 'shell' ? '#fb923c' : '#a3e635';
      drawGlow(ctx, p.x, p.y - height, 0.5, color, 0.8);
      ctx.fillStyle = p.kind === 'shell' ? '#fed7aa' : '#ecfccb';
      ctx.beginPath();
      ctx.arc(p.x, p.y - height, p.kind === 'shell' ? 0.14 : 0.11, 0, TAU);
      ctx.fill();
      break;
    }
  }
}

export function isGlowParticle(p: Particle): boolean {
  return p.kind === 'spark' || p.kind === 'flash' || p.kind === 'exhaust';
}

export function drawParticle(ctx: Ctx2D, p: Particle): void {
  const t = p.life / p.maxLife;
  switch (p.kind) {
    case 'spark':
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = t;
      ctx.lineWidth = p.size * 0.6;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    case 'flash':
      drawGlow(ctx, p.x, p.y, p.size * (1.4 - t * 0.4), p.color, t);
      break;
    case 'exhaust':
      drawGlow(ctx, p.x, p.y, p.size * 1.6, p.color, t * 0.8);
      break;
    case 'smoke':
      ctx.fillStyle = p.color;
      ctx.globalAlpha = t * 0.45;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    case 'debris':
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, t * 1.5);
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
      break;
    case 'acid':
    case 'dust':
      ctx.fillStyle = p.color;
      ctx.globalAlpha = t * 0.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    case 'ring':
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = t * 0.8;
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.01, p.size * (1 - t * 0.7)), 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    case 'heal':
      ctx.fillStyle = p.color;
      ctx.globalAlpha = t;
      ctx.fillRect(p.x - p.size * 0.15, p.y - p.size * 0.5, p.size * 0.3, p.size);
      ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.15, p.size, p.size * 0.3);
      ctx.globalAlpha = 1;
      break;
  }
}
