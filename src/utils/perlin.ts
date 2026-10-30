import { Rng } from './rng';

const GRAD: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [Math.SQRT1_2, Math.SQRT1_2],
  [-Math.SQRT1_2, Math.SQRT1_2],
  [Math.SQRT1_2, -Math.SQRT1_2],
  [-Math.SQRT1_2, -Math.SQRT1_2],
];

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Seeded 2D Perlin gradient noise. Output is roughly in [-1, 1]. */
export class Perlin {
  private readonly perm = new Uint8Array(512);

  constructor(seed: number) {
    const rng = new Rng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const tmp = p[i] ?? 0;
      p[i] = p[j] ?? 0;
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255] ?? 0;
  }

  private grad(hash: number, x: number, y: number): number {
    const g = GRAD[hash & 7] ?? GRAD[0];
    if (!g) return 0;
    return g[0] * x + g[1] * y;
  }

  noise(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const perm = this.perm;
    const aa = perm[(perm[X] ?? 0) + Y] ?? 0;
    const ab = perm[(perm[X] ?? 0) + Y + 1] ?? 0;
    const ba = perm[(perm[X + 1] ?? 0) + Y] ?? 0;
    const bb = perm[(perm[X + 1] ?? 0) + Y + 1] ?? 0;
    const u = fade(xf);
    const v = fade(yf);
    const x1 = this.grad(aa, xf, yf) + u * (this.grad(ba, xf - 1, yf) - this.grad(aa, xf, yf));
    const x2 = this.grad(ab, xf, yf - 1) + u * (this.grad(bb, xf - 1, yf - 1) - this.grad(ab, xf, yf - 1));
    return (x1 + v * (x2 - x1)) * 1.41;
  }

  /** Fractal Brownian motion, normalized to roughly [-1, 1]. */
  fbm(x: number, y: number, octaves: number, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}
