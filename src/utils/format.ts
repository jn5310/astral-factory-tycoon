/** Compact number: 1234 -> "1.2k", 2_500_000 -> "2.5M". */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs < 1000) return Number.isInteger(n) ? String(n) : n.toFixed(1);
  if (abs < 1_000_000) return `${(n / 1000).toFixed(abs < 10_000 ? 1 : 0)}k`;
  if (abs < 1_000_000_000) return `${(n / 1_000_000).toFixed(abs < 10_000_000 ? 1 : 0)}M`;
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}

export function integer(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** kW with a sensible unit: 950 -> "950kW", 1500 -> "1.5MW". */
export function power(kw: number): string {
  if (Math.abs(kw) < 1000) return `${Math.round(kw)}kW`;
  return `${(kw / 1000).toFixed(1)}MW`;
}

/** kJ energy store: 5000 -> "5.0MJ". */
export function energy(kj: number): string {
  if (Math.abs(kj) < 1000) return `${Math.round(kj)}kJ`;
  return `${(kj / 1000).toFixed(1)}MJ`;
}

export function rate(perMin: number): string {
  return `${compact(perMin)}/분`;
}

export function percent(frac: number): string {
  return `${Math.round(frac * 100)}%`;
}

/** Seconds -> "m:ss". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
