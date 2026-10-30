export type ProjectileKind = 'bullet' | 'pellet' | 'shell' | 'acid';

export interface Projectile {
  active: boolean;
  kind: ProjectileKind;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  /** Seconds left before it expires (bullets) or lands (shells / acid). */
  life: number;
  totalLife: number;
  damage: number;
  pierce: number;
  /** Last enemy id hit (piercing rounds must not hit it again next tick). */
  lastHit: number;
  /** Building id of the turret that fired (kill credit), 0 = none. */
  owner: number;
  aoe: number;
  hitsAir: boolean;
  hitsGround: boolean;
  /** Landing point for shells and acid. */
  tx: number;
  ty: number;
  sx: number;
  sy: number;
}

function blank(): Projectile {
  return {
    active: false,
    kind: 'bullet',
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    life: 0,
    totalLife: 0,
    damage: 0,
    pierce: 0,
    lastHit: 0,
    owner: 0,
    aoe: 0,
    hitsAir: true,
    hitsGround: true,
    tx: 0,
    ty: 0,
    sx: 0,
    sy: 0,
  };
}

/** Fixed-size object pool: projectiles are recycled instead of allocated every shot. */
export class ProjectilePool {
  readonly items: Projectile[];
  private cursor = 0;

  constructor(size: number) {
    this.items = Array.from({ length: size }, blank);
  }

  /** Returns a free projectile, or recycles the oldest slot when the pool is exhausted. */
  acquire(): Projectile {
    const n = this.items.length;
    for (let i = 0; i < n; i++) {
      const idx = (this.cursor + i) % n;
      const p = this.items[idx];
      if (p && !p.active) {
        this.cursor = (idx + 1) % n;
        p.active = true;
        return p;
      }
    }
    const p = this.items[this.cursor] ?? blank();
    this.cursor = (this.cursor + 1) % n;
    p.active = true;
    return p;
  }

  activeCount(): number {
    let n = 0;
    for (const p of this.items) if (p.active) n++;
    return n;
  }

  clear(): void {
    for (const p of this.items) p.active = false;
  }
}
