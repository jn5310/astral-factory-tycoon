import type { ItemId } from '../data/items';

export type ParticleKind = 'spark' | 'smoke' | 'flash' | 'debris' | 'acid' | 'ring' | 'heal' | 'exhaust' | 'dust' | 'text';

export interface Particle {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  /** Floating text ('text' kind only), optionally with an item icon. */
  text: string;
  item: ItemId | null;
}

/** Struct-of-objects pool reused for every visual particle (no per-frame allocation). */
export class ParticlePool {
  readonly items: Particle[];
  private cursor = 0;

  constructor(size: number) {
    this.items = Array.from({ length: size }, () => ({
      active: false,
      kind: 'spark' as ParticleKind,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 0.1,
      color: '#ffffff',
      text: '',
      item: null as ItemId | null,
    }));
  }

  spawn(kind: ParticleKind, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string): void {
    const p = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    if (!p) return;
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
    p.text = '';
    p.item = null;
  }

  /** Rising "+3" style label (salvage, pickups). */
  spawnText(x: number, y: number, text: string, color: string, item: ItemId | null = null): void {
    this.spawn('text', x, y, 0, -0.9, 1.3, 0.5, color);
    const p = this.items[(this.cursor - 1 + this.items.length) % this.items.length];
    if (!p) return;
    p.text = text;
    p.item = item;
  }

  update(dt: number): void {
    for (const p of this.items) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'smoke' || p.kind === 'exhaust') {
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.size += dt * 0.35;
      } else if (p.kind === 'text') {
        p.vy *= 0.97;
      } else if (p.kind === 'debris' || p.kind === 'spark') {
        p.vx *= 0.93;
        p.vy *= 0.93;
      }
    }
  }

  clear(): void {
    for (const p of this.items) p.active = false;
  }
}
