import { ITEM_IDS, type ItemId, type ItemStack } from '../data/items';

export type Inventory = Partial<Record<ItemId, number>>;

export function invGet(inv: Inventory, item: ItemId): number {
  return inv[item] ?? 0;
}

export function invAdd(inv: Inventory, item: ItemId, n: number): void {
  const next = (inv[item] ?? 0) + n;
  if (next <= 0) delete inv[item];
  else inv[item] = next;
}

/** Removes n items if available. Returns false (and changes nothing) otherwise. */
export function invRemove(inv: Inventory, item: ItemId, n: number): boolean {
  const have = inv[item] ?? 0;
  if (have < n) return false;
  invAdd(inv, item, -n);
  return true;
}

export function invHasAll(inv: Inventory, stacks: readonly ItemStack[], multiplier = 1): boolean {
  return stacks.every((s) => invGet(inv, s.item) >= s.amount * multiplier);
}

export function invRemoveAll(inv: Inventory, stacks: readonly ItemStack[], multiplier = 1): boolean {
  if (!invHasAll(inv, stacks, multiplier)) return false;
  for (const s of stacks) invAdd(inv, s.item, -s.amount * multiplier);
  return true;
}

export function invAddAll(inv: Inventory, stacks: readonly ItemStack[], multiplier = 1): void {
  for (const s of stacks) invAdd(inv, s.item, s.amount * multiplier);
}

export function invTotal(inv: Inventory): number {
  let total = 0;
  for (const id of ITEM_IDS) total += inv[id] ?? 0;
  return total;
}

/** Entries in canonical item order, skipping zeros. */
export function invEntries(inv: Inventory): [ItemId, number][] {
  const out: [ItemId, number][] = [];
  for (const id of ITEM_IDS) {
    const n = inv[id] ?? 0;
    if (n > 0) out.push([id, n]);
  }
  return out;
}

/** Sums stacks that share an item. */
export function mergeStacks(stacks: readonly ItemStack[]): ItemStack[] {
  const inv: Inventory = {};
  for (const s of stacks) invAdd(inv, s.item, s.amount);
  return invEntries(inv).map(([item, amount]) => ({ item, amount }));
}
