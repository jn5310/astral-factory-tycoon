import { ITEM_IDS, type ItemId } from '../data/items';
import type { Inventory } from './inventory';

export type StatKind = 'produced' | 'consumed';

/**
 * Rolling production/consumption history in fixed time buckets.
 * Rates are reported as items per minute over a sliding 60 s window.
 */
export class StatsTracker {
  readonly bucketSeconds: number;
  readonly maxBuckets: number;
  private produced: Inventory[] = [];
  private consumed: Inventory[] = [];
  private timer = 0;

  constructor(bucketSeconds = 5, maxBuckets = 72) {
    this.bucketSeconds = bucketSeconds;
    this.maxBuckets = maxBuckets;
    this.produced.push({});
    this.consumed.push({});
  }

  record(kind: StatKind, item: ItemId, n = 1): void {
    const list = kind === 'produced' ? this.produced : this.consumed;
    const bucket = list[list.length - 1];
    if (!bucket) return;
    bucket[item] = (bucket[item] ?? 0) + n;
  }

  update(dt: number): void {
    this.timer += dt;
    while (this.timer >= this.bucketSeconds) {
      this.timer -= this.bucketSeconds;
      this.produced.push({});
      this.consumed.push({});
      if (this.produced.length > this.maxBuckets) {
        this.produced.shift();
        this.consumed.shift();
      }
    }
  }

  get bucketCount(): number {
    return this.produced.length;
  }

  /** Items per minute over the last 60 s (or the available history if shorter). */
  ratePerMinute(kind: StatKind, item: ItemId): number {
    const list = kind === 'produced' ? this.produced : this.consumed;
    return this.rateEndingAt(list, item, list.length - 1, true);
  }

  private rateEndingAt(list: Inventory[], item: ItemId, end: number, includePartial: boolean): number {
    const window = Math.max(1, Math.round(60 / this.bucketSeconds));
    let sum = 0;
    let seconds = 0;
    for (let i = end; i >= 0 && i > end - window; i--) {
      sum += list[i]?.[item] ?? 0;
      seconds += i === list.length - 1 && includePartial ? this.timer : this.bucketSeconds;
    }
    if (seconds <= 0) return 0;
    return (sum / Math.max(seconds, this.bucketSeconds)) * 60;
  }

  /** Per-minute rate after each completed bucket (oldest first), for the line graph. */
  series(kind: StatKind, item: ItemId): number[] {
    const list = kind === 'produced' ? this.produced : this.consumed;
    const out: number[] = [];
    for (let i = 0; i < list.length - 1; i++) out.push(this.rateEndingAt(list, item, i, false));
    out.push(this.rateEndingAt(list, item, list.length - 1, true));
    return out;
  }

  /** Total items over the whole retained history. */
  total(kind: StatKind, item: ItemId): number {
    const list = kind === 'produced' ? this.produced : this.consumed;
    let sum = 0;
    for (const b of list) sum += b[item] ?? 0;
    return sum;
  }

  /** Items with any recorded activity, most produced first. */
  activeItems(): ItemId[] {
    return ITEM_IDS.filter((id) => this.total('produced', id) > 0 || this.total('consumed', id) > 0).sort(
      (a, b) => this.total('produced', b) - this.total('produced', a),
    );
  }
}
