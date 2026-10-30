import type { Building, TransitItem } from '../entities/Building';
import { perimeter } from '../entities/Building';
import { isConveyorKind, isCrafterKind } from '../data/buildings';
import {
  BRIDGE_CAPACITY,
  BRIDGE_RANGE,
  BRIDGE_TIME_PER_TILE,
  CORE_ITEM_CAPACITY,
  CRAFTER_OUTPUT_CAP,
  DUMP_INTERVAL,
  GENERATOR_FUEL_CAP,
  INSERTER_SWING,
  ROUTER_DELAY,
  SILO_BUFFER,
  SORTER_DELAY,
  TUNNEL_RANGE,
  TUNNEL_SPEED,
  BELT_SPACING,
} from '../data/constants';
import { ITEM_IDS, type ItemId } from '../data/items';
import { RECIPES, type RecipeDef } from '../data/recipes';
import { TURRETS, ammoFor } from '../data/turrets';
import { buildingAt } from '../core/grid';
import { DX, DY, opposite, rotateCCW, rotateCW, type Dir } from '../core/types';
import type { World } from '../core/World';
import {
  advanceBeltItems,
  beltCanAccept,
  beltInsert,
  beltInsertPos,
  beltSpeedOf,
  computeBeltOrder,
  refreshBeltShapes,
} from './belts';
import { invAdd, invGet, invTotal } from './inventory';
import { labAccepts } from './research';

// ---------------------------------------------------------------------------
// Acceptance rules
// ---------------------------------------------------------------------------

/** Max buffered units of one ingredient: three crafts' worth. */
export function inputCap(rec: RecipeDef, item: ItemId): number {
  const s = rec.inputs.find((i) => i.item === item);
  return s ? s.amount * 3 : 0;
}

export function crafterAccepts(b: Building, item: ItemId): boolean {
  const c = b.crafter;
  if (!c?.recipe) return false;
  const rec = RECIPES[c.recipe];
  const cap = inputCap(rec, item);
  return cap > 0 && invGet(c.input, item) < cap;
}

export function turretAccepts(b: Building, item: ItemId): boolean {
  const t = b.turret;
  if (!t) return false;
  const ammo = ammoFor(b.kind, item);
  if (!ammo) return false;
  if (t.ammo > 0 && t.ammoItem !== item) return false;
  return t.ammo + ammo.shots <= (TURRETS[b.kind]?.magazine ?? 0);
}

function tunnelCapacity(world: World, b: Building): number {
  const partner = world.buildings.get(b.tunnel?.partner ?? 0);
  if (!partner) return 0;
  const d = Math.abs(partner.x - b.x) + Math.abs(partner.y - b.y);
  return Math.floor(d / BELT_SPACING) + 1;
}

function tunnelTravelTime(world: World, b: Building): number {
  const partner = world.buildings.get(b.tunnel?.partner ?? 0);
  if (!partner) return 0;
  const d = Math.abs(partner.x - b.x) + Math.abs(partner.y - b.y);
  return d / TUNNEL_SPEED;
}

function bridgeTravelTime(world: World, b: Building): number {
  const partner = world.buildings.get(b.bridge?.partner ?? 0);
  if (!partner) return 0.05;
  const d = Math.abs(partner.x - b.x) + Math.abs(partner.y - b.y);
  return d * BRIDGE_TIME_PER_TILE;
}

/**
 * Can `b` take `item` arriving from its `fromSide` (the direction from b toward the source)?
 * Pure check; tryInsert performs the transfer.
 */
export function canAccept(world: World, b: Building, item: ItemId, fromSide: Dir): boolean {
  if (b.belt) return beltCanAccept(b, fromSide);
  switch (b.kind) {
    case 'core':
      return invGet(world.inventory, item) < CORE_ITEM_CAPACITY;
    case 'router':
      return b.router !== undefined && b.router.slot.item === null;
    case 'sorter':
      return b.sorter !== undefined && b.sorter.slot.item === null;
    case 'bridge':
      return b.bridge !== undefined && fromSide !== b.rot && b.bridge.queue.length < BRIDGE_CAPACITY;
    case 'tunnel': {
      const t = b.tunnel;
      if (!t || t.mode !== 'in' || t.partner === 0 || fromSide === b.rot) return false;
      if (t.queue.length >= tunnelCapacity(world, b)) return false;
      const last = t.queue[t.queue.length - 1];
      // Keep belt spacing inside the tunnel.
      return !last || last.total - last.t >= BELT_SPACING / TUNNEL_SPEED - 1e-9;
    }
    case 'container':
      return b.storage !== undefined && invTotal(b.storage.items) < b.storage.capacity;
    case 'thermal_generator':
      return item === 'coal' && b.generator !== undefined && b.generator.fuel < GENERATOR_FUEL_CAP;
    case 'lab':
      return labAccepts(world, b, item);
    case 'rocket_silo':
      return item === 'rocket_part' && b.silo !== undefined && b.silo.buffer < SILO_BUFFER && !world.launch.active;
    default:
      if (isCrafterKind(b.kind)) return crafterAccepts(b, item);
      if (b.turret) return turretAccepts(b, item);
      return false;
  }
}

export function tryInsert(world: World, b: Building, item: ItemId, fromSide: Dir): boolean {
  if (b.belt) return beltInsert(b, item, fromSide);
  if (!canAccept(world, b, item, fromSide)) return false;
  switch (b.kind) {
    case 'core':
      invAdd(world.inventory, item, 1);
      return true;
    case 'router':
      if (!b.router) return false;
      b.router.slot.item = item;
      b.router.slot.timer = ROUTER_DELAY;
      b.router.slot.from = fromSide;
      return true;
    case 'sorter':
      if (!b.sorter) return false;
      b.sorter.slot.item = item;
      b.sorter.slot.timer = SORTER_DELAY;
      b.sorter.slot.from = fromSide;
      return true;
    case 'bridge': {
      if (!b.bridge) return false;
      const total = bridgeTravelTime(world, b);
      b.bridge.queue.push({ item, t: total, total });
      return true;
    }
    case 'tunnel': {
      if (!b.tunnel) return false;
      const total = tunnelTravelTime(world, b);
      b.tunnel.queue.push({ item, t: total, total });
      return true;
    }
    case 'container':
      if (!b.storage) return false;
      invAdd(b.storage.items, item, 1);
      return true;
    case 'thermal_generator':
      if (!b.generator) return false;
      b.generator.fuel++;
      return true;
    case 'lab':
      if (!b.lab) return false;
      invAdd(b.lab.items, item, 1);
      return true;
    case 'rocket_silo':
      if (!b.silo) return false;
      b.silo.buffer++;
      return true;
    default:
      if (b.crafter) {
        invAdd(b.crafter.input, item, 1);
        return true;
      }
      if (b.turret) {
        const ammo = ammoFor(b.kind, item);
        if (!ammo) return false;
        if (b.turret.ammo <= 0) b.turret.ammoItem = item;
        b.turret.ammo += ammo.shots;
        world.stats.record('consumed', item, 1);
        return true;
      }
      return false;
  }
}

// ---------------------------------------------------------------------------
// Dumping (producers push output into neighbours, round-robin)
// ---------------------------------------------------------------------------

/** Tries every neighbour of `b` once, starting after the last successful one. */
export function dumpItem(world: World, b: Building, item: ItemId): boolean {
  const cells = perimeter(b.size);
  const n = cells.length;
  for (let k = 0; k < n; k++) {
    const idx = (b.dumpIndex + k) % n;
    const cell = cells[idx];
    if (!cell) continue;
    const target = buildingAt(world, b.x + cell.dx, b.y + cell.dy);
    if (!target || target.id === b.id) continue;
    if (tryInsert(world, target, item, opposite(cell.dir))) {
      b.dumpIndex = (idx + 1) % n;
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Taking (inserters)
// ---------------------------------------------------------------------------

function storageTake(
  inv: Partial<Record<ItemId, number>>,
  accepts: (item: ItemId) => boolean,
  filter: ItemId | null,
): ItemId | null {
  if (filter) {
    if (invGet(inv, filter) > 0 && accepts(filter)) {
      invAdd(inv, filter, -1);
      return filter;
    }
    return null;
  }
  for (const id of ITEM_IDS) {
    if (invGet(inv, id) > 0 && accepts(id)) {
      invAdd(inv, id, -1);
      return id;
    }
  }
  return null;
}

/**
 * Removes and returns one item from `source` that `target` accepts from `fromSide` (respecting the filter).
 * Inserters only pick items the target can use, so they never jam holding something useless.
 */
export function takeForInserter(
  world: World,
  source: Building,
  target: Building,
  fromSide: Dir,
  filter: ItemId | null,
): ItemId | null {
  const accepts = (item: ItemId): boolean =>
    (filter === null || item === filter) && canAccept(world, target, item, fromSide);
  if (source.belt) {
    const items = source.belt.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it && accepts(it.item)) {
        items.splice(i, 1);
        return it.item;
      }
    }
    return null;
  }
  if (source.kind === 'core') return storageTake(world.inventory, accepts, filter);
  if (source.storage) return storageTake(source.storage.items, accepts, filter);
  if (source.crafter) return storageTake(source.crafter.output, accepts, filter);
  if (source.drill) {
    const ore = source.drill.ore;
    if (ore && source.drill.output > 0 && accepts(ore)) {
      source.drill.output--;
      return ore;
    }
    return null;
  }
  const slot = source.router?.slot ?? source.sorter?.slot;
  if (slot?.item && accepts(slot.item)) {
    const item = slot.item;
    slot.item = null;
    return item;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-building updates
// ---------------------------------------------------------------------------

function neighbor(world: World, b: Building, d: Dir): Building | undefined {
  return buildingAt(world, b.x + (DX[d] ?? 0), b.y + (DY[d] ?? 0));
}

export function updateBelt(world: World, b: Building, dt: number): void {
  const belt = b.belt;
  if (!belt) return;
  const items = belt.items;
  if (items.length === 0) {
    b.active = false;
    return;
  }
  const target = neighbor(world, b, b.rot);
  const front = items[0];
  if (front && front.pos >= 1 && target && tryInsert(world, target, front.item, opposite(b.rot))) items.shift();
  // When feeding the start of the next belt, stop one spacing behind its last item so a jam
  // never stacks two items on the shared tile edge.
  let frontLimit = 1;
  if (target?.belt && beltInsertPos(target, opposite(b.rot)) === 0) {
    const last = target.belt.items[target.belt.items.length - 1];
    if (last) frontLimit = Math.min(1, 1 + last.pos - BELT_SPACING);
  }
  b.active = advanceBeltItems(items, beltSpeedOf(b.kind) * dt, BELT_SPACING, frontLimit);
}

/** Router: holds one item, then hands it to the next accepting side (never back where it came from). */
export function updateRouter(world: World, b: Building, dt: number): void {
  const r = b.router;
  if (!r || r.slot.item === null) {
    b.active = false;
    return;
  }
  r.slot.timer -= dt;
  if (r.slot.timer > 0) return;
  for (let k = 0; k < 4; k++) {
    const d = ((r.rr + k) % 4) as Dir;
    if (d === r.slot.from) continue;
    const target = neighbor(world, b, d);
    if (target && tryInsert(world, target, r.slot.item, opposite(d))) {
      r.slot.item = null;
      r.rr = (d + 1) % 4;
      b.active = true;
      return;
    }
  }
}

/** Sorter: the filter item keeps going straight, everything else turns left/right (alternating). */
export function updateSorter(world: World, b: Building, dt: number): void {
  const s = b.sorter;
  if (!s || s.slot.item === null) {
    b.active = false;
    return;
  }
  s.slot.timer -= dt;
  if (s.slot.timer > 0) return;
  const travel = opposite(s.slot.from);
  const item = s.slot.item;
  const candidates: Dir[] =
    s.filter !== null && item === s.filter
      ? [travel]
      : s.alt === 0
        ? [rotateCCW(travel), rotateCW(travel)]
        : [rotateCW(travel), rotateCCW(travel)];
  for (const d of candidates) {
    const target = neighbor(world, b, d);
    if (target && tryInsert(world, target, item, opposite(d))) {
      s.slot.item = null;
      if (candidates.length > 1) s.alt = d === candidates[0] ? 1 - s.alt : s.alt;
      b.active = true;
      return;
    }
  }
}

function tickQueue(queue: TransitItem[], dt: number): void {
  for (const q of queue) if (q.t > 0) q.t = Math.max(0, q.t - dt);
}

/** Bridge: items fly to the linked bridge; an unlinked bridge outputs forward. */
export function updateBridge(world: World, b: Building, dt: number): void {
  const br = b.bridge;
  if (!br) return;
  tickQueue(br.queue, dt);
  b.active = br.queue.length > 0;
  const front = br.queue[0];
  if (!front || front.t > 0) return;
  const partner = br.partner ? world.buildings.get(br.partner) : undefined;
  if (partner?.bridge) {
    if (partner.bridge.queue.length < BRIDGE_CAPACITY) {
      br.queue.shift();
      const total = bridgeTravelTime(world, partner);
      partner.bridge.queue.push({ item: front.item, t: partner.bridge.partner ? total : 0, total });
    }
    return;
  }
  const target = neighbor(world, b, b.rot);
  if (target && target.id !== br.partner && tryInsert(world, target, front.item, opposite(b.rot))) br.queue.shift();
}

/** Tunnel entrance carries items underground to its exit, which outputs forward. */
export function updateTunnel(world: World, b: Building, dt: number): void {
  const tu = b.tunnel;
  if (!tu) return;
  tickQueue(tu.queue, dt);
  b.active = tu.queue.length > 0;
  const front = tu.queue[0];
  if (!front || front.t > 0) return;
  if (tu.mode === 'in') {
    const exit = world.buildings.get(tu.partner);
    if (exit?.tunnel && exit.tunnel.queue.length < 2) {
      tu.queue.shift();
      exit.tunnel.queue.push({ item: front.item, t: 0, total: 0 });
    }
    return;
  }
  const target = neighbor(world, b, b.rot);
  if (target && tryInsert(world, target, front.item, opposite(b.rot))) tu.queue.shift();
}

/** Inserter: pick from the tile behind, swing, drop into the tile in front. */
export function updateInserter(world: World, b: Building, dt: number): void {
  const ins = b.inserter;
  if (!ins) return;
  const back = opposite(b.rot);
  const source = neighbor(world, b, back);
  const target = neighbor(world, b, b.rot);
  const fromSide = opposite(b.rot);
  b.active = ins.phase !== 0;
  if (ins.phase === 0) {
    if (!source || !target || source.id === target.id) return;
    const item = takeForInserter(world, source, target, fromSide, ins.filter);
    if (item) {
      ins.held = item;
      ins.phase = 1;
      ins.progress = 0;
    }
    return;
  }
  ins.progress = Math.min(1, ins.progress + dt / INSERTER_SWING);
  if (ins.progress < 1) return;
  if (ins.phase === 1) {
    if (!ins.held) {
      ins.phase = 2;
      ins.progress = 0;
      return;
    }
    if (target && tryInsert(world, target, ins.held, fromSide)) {
      ins.held = null;
      ins.phase = 2;
      ins.progress = 0;
    }
    return;
  }
  ins.phase = 0;
  ins.progress = 0;
}

/** Dumps finished crafter output to neighbours. */
export function dumpCrafterOutput(world: World, b: Building, dt: number): void {
  const c = b.crafter;
  if (!c) return;
  b.dumpTimer -= dt;
  if (b.dumpTimer > 0) return;
  for (const id of ITEM_IDS) {
    if (invGet(c.output, id) <= 0) continue;
    if (dumpItem(world, b, id)) {
      invAdd(c.output, id, -1);
      b.dumpTimer = DUMP_INTERVAL;
      return;
    }
  }
  b.dumpTimer = DUMP_INTERVAL;
}

export function crafterOutputFull(b: Building, rec: RecipeDef): boolean {
  const c = b.crafter;
  if (!c) return true;
  return rec.outputs.some((o) => invGet(c.output, o.item) + o.amount > CRAFTER_OUTPUT_CAP);
}

// ---------------------------------------------------------------------------
// Links (bridges / tunnels)
// ---------------------------------------------------------------------------

export function refreshLinks(world: World): void {
  for (const b of world.buildings.values()) {
    if (b.bridge) {
      b.bridge.partner = 0;
      for (let k = 1; k <= BRIDGE_RANGE; k++) {
        const n = buildingAt(world, b.x + (DX[b.rot] ?? 0) * k, b.y + (DY[b.rot] ?? 0) * k);
        if (n?.bridge && n.rot !== opposite(b.rot)) {
          b.bridge.partner = n.id;
          break;
        }
      }
    }
    if (b.tunnel) b.tunnel.partner = 0;
  }
  for (const b of world.buildings.values()) {
    const tu = b.tunnel;
    if (!tu || tu.mode !== 'in') continue;
    for (let k = 1; k <= TUNNEL_RANGE; k++) {
      const n = buildingAt(world, b.x + (DX[b.rot] ?? 0) * k, b.y + (DY[b.rot] ?? 0) * k);
      if (n?.tunnel && n.rot === b.rot) {
        if (n.tunnel.mode === 'out' && n.tunnel.partner === 0) {
          tu.partner = n.id;
          n.tunnel.partner = b.id;
        }
        break;
      }
    }
  }
}

/** Finds the tunnel mode a new tunnel at (x, y) facing `rot` should take: exit if an unpaired entrance is behind it. */
export function autoTunnelMode(world: World, x: number, y: number, rot: Dir): 'in' | 'out' {
  const back = opposite(rot);
  for (let k = 1; k <= TUNNEL_RANGE; k++) {
    const n = buildingAt(world, x + (DX[back] ?? 0) * k, y + (DY[back] ?? 0) * k);
    if (n?.tunnel && n.rot === rot) return n.tunnel.mode === 'in' ? 'out' : 'in';
  }
  return 'in';
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export function refreshLogistics(world: World): void {
  refreshBeltShapes(world);
  refreshLinks(world);
  world.beltOrder = computeBeltOrder(world);
  world.logisticsDirty = false;
}

export function updateLogistics(world: World, dt: number): void {
  if (world.logisticsDirty) refreshLogistics(world);
  for (const id of world.beltOrder) {
    const b = world.buildings.get(id);
    if (b) updateBelt(world, b, dt);
  }
  for (const b of world.buildings.values()) {
    if (isConveyorKind(b.kind)) continue;
    switch (b.kind) {
      case 'router':
        updateRouter(world, b, dt);
        break;
      case 'sorter':
        updateSorter(world, b, dt);
        break;
      case 'bridge':
        updateBridge(world, b, dt);
        break;
      case 'tunnel':
        updateTunnel(world, b, dt);
        break;
      case 'inserter':
        updateInserter(world, b, dt);
        break;
      default:
        break;
    }
  }
}
