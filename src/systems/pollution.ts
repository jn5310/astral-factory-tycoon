import { POLLUTION_CHUNK, POLLUTION_DECAY, POLLUTION_DIFFUSION } from '../data/constants';

export interface PollutionState {
  chunk: number;
  cols: number;
  rows: number;
  values: Float32Array;
  /** Emission accumulated since the last diffusion step. */
  pending: Float32Array;
  timer: number;
  total: number;
}

export function createPollution(width: number, height: number, chunk = POLLUTION_CHUNK): PollutionState {
  const cols = Math.ceil(width / chunk);
  const rows = Math.ceil(height / chunk);
  return {
    chunk,
    cols,
    rows,
    values: new Float32Array(cols * rows),
    pending: new Float32Array(cols * rows),
    timer: 0,
    total: 0,
  };
}

export function chunkIndex(p: PollutionState, x: number, y: number): number {
  const cx = Math.min(p.cols - 1, Math.max(0, Math.floor(x / p.chunk)));
  const cy = Math.min(p.rows - 1, Math.max(0, Math.floor(y / p.chunk)));
  return cy * p.cols + cx;
}

export function emitPollution(p: PollutionState, x: number, y: number, amount: number): void {
  const i = chunkIndex(p, x, y);
  p.pending[i] = (p.pending[i] ?? 0) + amount;
}

export function pollutionAt(p: PollutionState, x: number, y: number): number {
  return p.values[chunkIndex(p, x, y)] ?? 0;
}

/**
 * One diffusion step: every chunk shares `rate` of its pollution with each in-bounds neighbour,
 * then everything decays by `decay`. With decay = 0 the total is conserved.
 */
export function diffusePollution(p: PollutionState, rate = POLLUTION_DIFFUSION, decay = POLLUTION_DECAY): void {
  const { cols, rows, values } = p;
  const next = new Float32Array(values.length);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const v = values[i] ?? 0;
      if (v <= 0) continue;
      let given = 0;
      const share = v * rate;
      if (x > 0) {
        next[i - 1] = (next[i - 1] ?? 0) + share;
        given += share;
      }
      if (x < cols - 1) {
        next[i + 1] = (next[i + 1] ?? 0) + share;
        given += share;
      }
      if (y > 0) {
        next[i - cols] = (next[i - cols] ?? 0) + share;
        given += share;
      }
      if (y < rows - 1) {
        next[i + cols] = (next[i + cols] ?? 0) + share;
        given += share;
      }
      next[i] = (next[i] ?? 0) + v - given;
    }
  }
  let total = 0;
  for (let i = 0; i < next.length; i++) {
    const v = (next[i] ?? 0) * (1 - decay);
    values[i] = v < 0.001 ? 0 : v;
    total += values[i] ?? 0;
  }
  p.total = total;
}

/** Applies pending emission and diffuses once per second. */
export function stepPollution(p: PollutionState, dt: number): void {
  p.timer += dt;
  if (p.timer < 1) return;
  p.timer -= 1;
  for (let i = 0; i < p.values.length; i++) {
    p.values[i] = (p.values[i] ?? 0) + (p.pending[i] ?? 0);
    p.pending[i] = 0;
  }
  diffusePollution(p);
}

export function totalPollution(p: PollutionState): number {
  let t = 0;
  for (let i = 0; i < p.values.length; i++) t += p.values[i] ?? 0;
  return t;
}
