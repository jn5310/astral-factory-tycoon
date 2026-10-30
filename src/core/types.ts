/** Grid direction. 0 = East, 1 = South, 2 = West, 3 = North (screen space, y grows downward). */
export type Dir = 0 | 1 | 2 | 3;

export const DX: readonly number[] = [1, 0, -1, 0];
export const DY: readonly number[] = [0, 1, 0, -1];

export interface TileXY {
  x: number;
  y: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export function opposite(d: Dir): Dir {
  return ((d + 2) % 4) as Dir;
}

export function rotateCW(d: Dir): Dir {
  return ((d + 1) % 4) as Dir;
}

export function rotateCCW(d: Dir): Dir {
  return ((d + 3) % 4) as Dir;
}

export function isDir(v: unknown): v is Dir {
  return v === 0 || v === 1 || v === 2 || v === 3;
}

/** Direction of a unit step, or null when the delta is not a single orthogonal step. */
export function dirFromDelta(dx: number, dy: number): Dir | null {
  if (dx === 1 && dy === 0) return 0;
  if (dx === 0 && dy === 1) return 1;
  if (dx === -1 && dy === 0) return 2;
  if (dx === 0 && dy === -1) return 3;
  return null;
}

/** Angle in radians for a direction (0 rad = East). */
export function dirAngle(d: Dir): number {
  return (d * Math.PI) / 2;
}
