import type { Building } from '../entities/Building';
import { BUILDINGS } from '../data/buildings';
import { COAL_ENERGY, POLE_SUPPLY_RADIUS, POLE_WIRE_REACH } from '../data/constants';
import { buildingAt } from '../core/grid';
import type { World } from '../core/World';
import { daylightAt } from './daynight';

export interface PowerNetwork {
  id: number;
  poles: number[];
  consumers: number[];
  generators: number[];
  accumulators: number[];
  demand: number;
  generation: number;
  capacity: number;
  stored: number;
  storageCap: number;
  satisfaction: number;
  charge: number;
  discharge: number;
}

export interface PowerTotals {
  demand: number;
  generation: number;
  capacity: number;
  stored: number;
  storageCap: number;
  satisfaction: number;
  charge: number;
  discharge: number;
  networks: number;
  unpowered: number;
}

export interface PowerState {
  networks: PowerNetwork[];
  /** Pole wire connections (pairs of pole ids) for rendering. */
  wires: [number, number][];
  dirty: boolean;
  totals: PowerTotals;
}

export function createPowerState(): PowerState {
  return {
    networks: [],
    wires: [],
    dirty: true,
    totals: {
      demand: 0,
      generation: 0,
      capacity: 0,
      stored: 0,
      storageCap: 0,
      satisfaction: 1,
      charge: 0,
      discharge: 0,
      networks: 0,
      unpowered: 0,
    },
  };
}

export function isPowerEntity(b: Building): boolean {
  const p = BUILDINGS[b.kind].power;
  return p !== undefined && (p.use !== undefined || p.gen !== undefined || p.storage !== undefined);
}

export function poleCenter(p: Building): { x: number; y: number } {
  return { x: p.x + 0.5, y: p.y + 0.5 };
}

/** Two poles connect when their centers are within wire reach. */
export function polesConnected(a: Building, b: Building, reach = POLE_WIRE_REACH): boolean {
  const ca = poleCenter(a);
  const cb = poleCenter(b);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y) <= reach + 1e-9;
}

/** True when any tile of b lies inside the pole's square supply area. */
export function poleCovers(pole: Building, b: Building, radius = POLE_SUPPLY_RADIUS): boolean {
  const minX = pole.x - radius;
  const maxX = pole.x + radius;
  const minY = pole.y - radius;
  const maxY = pole.y + radius;
  return b.x <= maxX && b.x + b.size - 1 >= minX && b.y <= maxY && b.y + b.size - 1 >= minY;
}

class UnionFind {
  private parent: Map<number, number> = new Map();

  find(a: number): number {
    let p = this.parent.get(a) ?? a;
    if (p !== a) {
      p = this.find(p);
      this.parent.set(a, p);
    }
    return p;
  }

  union(a: number, b: number): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    this.parent.set(ra, rb);
    return true;
  }
}

/** Rebuilds networks: poles linked by wires (minimum spanning forest), buildings joined by supply area. */
export function rebuildPowerNetworks(world: World): void {
  const poles: Building[] = [];
  for (const b of world.buildings.values()) {
    b.powerNet = -1;
    if (b.kind === 'power_pole') poles.push(b);
  }
  // Candidate wire pairs, shortest first (Kruskal) so the drawn wires form a tidy spanning forest.
  const pairs: { a: Building; b: Building; d: number }[] = [];
  for (let i = 0; i < poles.length; i++) {
    const a = poles[i];
    if (!a) continue;
    for (let j = i + 1; j < poles.length; j++) {
      const b = poles[j];
      if (!b) continue;
      if (Math.abs(a.x - b.x) > POLE_WIRE_REACH || Math.abs(a.y - b.y) > POLE_WIRE_REACH) continue;
      if (polesConnected(a, b)) pairs.push({ a, b, d: Math.hypot(a.x - b.x, a.y - b.y) });
    }
  }
  pairs.sort((p, q) => p.d - q.d || p.a.id - q.a.id || p.b.id - q.b.id);
  const uf = new UnionFind();
  const wires: [number, number][] = [];
  for (const p of pairs) if (uf.union(p.a.id, p.b.id)) wires.push([p.a.id, p.b.id]);

  const netByRoot = new Map<number, PowerNetwork>();
  const networks: PowerNetwork[] = [];
  const sortedPoles = [...poles].sort((a, b) => a.id - b.id);
  for (const pole of sortedPoles) {
    const root = uf.find(pole.id);
    let net = netByRoot.get(root);
    if (!net) {
      net = {
        id: networks.length,
        poles: [],
        consumers: [],
        generators: [],
        accumulators: [],
        demand: 0,
        generation: 0,
        capacity: 0,
        stored: 0,
        storageCap: 0,
        satisfaction: 0,
        charge: 0,
        discharge: 0,
      };
      netByRoot.set(root, net);
      networks.push(net);
    }
    net.poles.push(pole.id);
    pole.powerNet = net.id;
  }
  // Assign powered buildings to the network of the first (lowest id) pole that covers them.
  const r = POLE_SUPPLY_RADIUS;
  for (const pole of sortedPoles) {
    const net = networks[pole.powerNet];
    if (!net) continue;
    for (let y = pole.y - r; y <= pole.y + r; y++) {
      for (let x = pole.x - r; x <= pole.x + r; x++) {
        const b = buildingAt(world, x, y);
        if (!b || b.powerNet !== -1 || !isPowerEntity(b)) continue;
        b.powerNet = net.id;
        const spec = BUILDINGS[b.kind].power;
        if (spec?.gen !== undefined) net.generators.push(b.id);
        else if (spec?.storage !== undefined) net.accumulators.push(b.id);
        else net.consumers.push(b.id);
      }
    }
  }
  world.power.networks = networks;
  world.power.wires = wires;
  world.power.dirty = false;
}

export interface BalanceInput {
  demand: number;
  solar: number;
  thermal: number;
  stored: number;
  storageCap: number;
  maxRate: number;
  dt: number;
}

export interface BalanceResult {
  satisfaction: number;
  /** kW delivered to consumers. */
  supplied: number;
  solarUsed: number;
  thermalUsed: number;
  /** kW flowing into accumulators. */
  charge: number;
  /** kW drawn from accumulators. */
  discharge: number;
}

/**
 * Pure power balance for one network and one tick.
 * Surplus charges accumulators (rate- and capacity-limited); deficits drain them.
 * Satisfaction = supplied / demand, which every consumer uses as its speed multiplier.
 */
export function computeBalance(input: BalanceInput): BalanceResult {
  const { demand, solar, thermal, stored, storageCap, maxRate, dt } = input;
  const gen = Math.max(0, solar) + Math.max(0, thermal);
  let charge = 0;
  let discharge = 0;
  let used: number;
  let satisfaction: number;
  if (demand <= gen) {
    const room = dt > 0 ? Math.max(0, storageCap - stored) / dt : 0;
    charge = Math.min(gen - demand, maxRate, room);
    used = demand + charge;
    // With nothing drawing power, report whether a newly started consumer would get any.
    satisfaction = demand > 0 || gen > 0 || stored > 0 ? 1 : 0;
  } else {
    const available = dt > 0 ? Math.max(0, stored) / dt : 0;
    discharge = Math.min(demand - gen, maxRate, available);
    used = gen;
    satisfaction = demand > 0 ? (gen + discharge) / demand : 1;
  }
  const solarUsed = Math.min(Math.max(0, solar), used);
  const thermalUsed = Math.max(0, used - solarUsed);
  return {
    satisfaction: Math.min(1, satisfaction),
    supplied: Math.min(demand, gen + discharge),
    solarUsed,
    thermalUsed,
    charge,
    discharge,
  };
}

export function thermalAvailable(b: Building): boolean {
  const g = b.generator;
  return g !== undefined && (g.burn > 0 || g.fuel > 0);
}

export function generatorCapacity(world: World, b: Building): number {
  const gen = BUILDINGS[b.kind].power?.gen ?? 0;
  const mul = world.modifiers.generatorOutput;
  if (b.kind === 'solar_panel') return gen * mul * daylightAt(world.dayPhase);
  if (b.kind === 'thermal_generator') return thermalAvailable(b) ? gen * mul : 0;
  return 0;
}

/** Burns fuel for the energy a thermal generator delivered this tick. */
export function burnFuel(world: World, b: Building, energyKJ: number): void {
  const g = b.generator;
  if (!g) return;
  g.burn -= energyKJ;
  while (g.burn <= 0 && g.fuel > 0) {
    g.fuel--;
    g.burn += COAL_ENERGY;
    world.stats.record('consumed', 'coal', 1);
  }
  if (g.burn < 0) g.burn = 0;
}

export function updatePower(world: World, dt: number): void {
  if (world.power.dirty) rebuildPowerNetworks(world);
  const totals = world.power.totals;
  totals.demand = 0;
  totals.generation = 0;
  totals.capacity = 0;
  totals.stored = 0;
  totals.storageCap = 0;
  totals.charge = 0;
  totals.discharge = 0;
  totals.networks = world.power.networks.length;
  totals.unpowered = 0;

  for (const b of world.buildings.values()) {
    if (b.powerNet !== -1) continue;
    b.satisfaction = 0;
    if (b.demand > 0) {
      totals.unpowered++;
      totals.demand += b.demand;
    }
  }

  for (const net of world.power.networks) {
    let demand = 0;
    for (const id of net.consumers) demand += world.buildings.get(id)?.demand ?? 0;
    let solar = 0;
    let thermal = 0;
    const thermals: Building[] = [];
    for (const id of net.generators) {
      const g = world.buildings.get(id);
      if (!g) continue;
      const cap = generatorCapacity(world, g);
      if (g.kind === 'solar_panel') solar += cap;
      else {
        thermal += cap;
        if (cap > 0) thermals.push(g);
      }
      if (g.generator) g.generator.output = 0;
    }
    let stored = 0;
    let storageCap = 0;
    let maxRate = 0;
    const accs: Building[] = [];
    for (const id of net.accumulators) {
      const a = world.buildings.get(id);
      if (!a?.accumulator) continue;
      const spec = BUILDINGS[a.kind].power;
      stored += a.accumulator.stored;
      storageCap += spec?.storage ?? 0;
      maxRate += spec?.rate ?? 0;
      accs.push(a);
    }
    const res = computeBalance({ demand, solar, thermal, stored, storageCap, maxRate, dt });

    // Spread thermal load proportionally to each generator's capacity.
    if (thermal > 0 && res.thermalUsed > 0) {
      for (const g of thermals) {
        const share = (generatorCapacity(world, g) / thermal) * res.thermalUsed;
        if (g.generator) g.generator.output = share;
        g.active = share > 0.01;
        burnFuel(world, g, share * dt);
      }
    } else {
      for (const g of thermals) g.active = false;
    }
    for (const id of net.generators) {
      const g = world.buildings.get(id);
      if (g?.kind === 'solar_panel') g.active = generatorCapacity(world, g) > 0.5;
    }

    // Charge accumulators by free space, discharge by stored energy.
    if (res.charge > 0) {
      const free = storageCap - stored;
      for (const a of accs) {
        if (!a.accumulator) continue;
        const cap = BUILDINGS[a.kind].power?.storage ?? 0;
        const share = free > 0 ? (cap - a.accumulator.stored) / free : 0;
        a.accumulator.stored = Math.min(cap, a.accumulator.stored + res.charge * dt * share);
      }
    } else if (res.discharge > 0 && stored > 0) {
      for (const a of accs) {
        if (!a.accumulator) continue;
        const share = a.accumulator.stored / stored;
        a.accumulator.stored = Math.max(0, a.accumulator.stored - res.discharge * dt * share);
      }
    }
    for (const a of accs) a.active = res.charge > 0 || res.discharge > 0;

    for (const id of net.consumers) {
      const c = world.buildings.get(id);
      if (c) c.satisfaction = res.satisfaction;
    }

    net.demand = demand;
    net.generation = res.solarUsed + res.thermalUsed;
    net.capacity = solar + thermal;
    net.stored = accs.reduce((s, a) => s + (a.accumulator?.stored ?? 0), 0);
    net.storageCap = storageCap;
    net.satisfaction = res.satisfaction;
    net.charge = res.charge;
    net.discharge = res.discharge;

    totals.demand += demand;
    totals.generation += net.generation;
    totals.capacity += net.capacity;
    totals.stored += net.stored;
    totals.storageCap += storageCap;
    totals.charge += res.charge;
    totals.discharge += res.discharge;
  }
  let supplied = 0;
  for (const net of world.power.networks) supplied += net.demand * net.satisfaction;
  totals.satisfaction = totals.demand > 0 ? supplied / totals.demand : 1;
}
