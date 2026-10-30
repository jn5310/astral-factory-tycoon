import { describe, expect, it } from 'vitest';
import type { Building } from '../entities/Building';
import { COAL_ENERGY } from '../data/constants';
import { stepWorld } from '../core/engine';
import type { World } from '../core/World';
import { daylightAt } from '../systems/daynight';
import { computeBalance, poleCovers, polesConnected, rebuildPowerNetworks } from '../systems/power';
import { endlessGenerator, put, run, testWorld, ticks } from './helpers';

const base = { demand: 0, solar: 0, thermal: 0, stored: 0, storageCap: 0, maxRate: 0, dt: 1 };

/** Keeps a furnace stocked with ore and its output empty so it crafts continuously. */
function runStockedFurnaces(w: World, furnaces: readonly Building[], seconds: number): number {
  let plates = 0;
  for (let t = 0; t < ticks(seconds); t++) {
    for (const f of furnaces) {
      if (!f.crafter) continue;
      f.crafter.input.iron_ore = 3;
      plates += f.crafter.output.iron_plate ?? 0;
      f.crafter.output = {};
    }
    stepWorld(w);
  }
  return plates;
}

describe('power balance (pure)', () => {
  it('fully satisfies demand and charges batteries with the surplus', () => {
    const r = computeBalance({ ...base, demand: 100, thermal: 300, storageCap: 5000, maxRate: 300 });
    expect(r.satisfaction).toBe(1);
    expect(r.charge).toBe(200);
    expect(r.thermalUsed).toBe(300);
  });

  it('scales every consumer by generation / demand when overloaded', () => {
    const r = computeBalance({ ...base, demand: 400, thermal: 100 });
    expect(r.satisfaction).toBeCloseTo(0.25);
    expect(r.supplied).toBe(100);
    expect(r.discharge).toBe(0);
  });

  it('drains accumulators to cover a deficit', () => {
    const r = computeBalance({ ...base, demand: 300, solar: 100, stored: 5000, storageCap: 5000, maxRate: 300 });
    expect(r.discharge).toBe(200);
    expect(r.satisfaction).toBe(1);
  });

  it('limits discharge by the accumulator rate', () => {
    const r = computeBalance({ ...base, demand: 1000, stored: 5000, storageCap: 5000, maxRate: 300 });
    expect(r.discharge).toBe(300);
    expect(r.satisfaction).toBeCloseTo(0.3);
  });

  it('limits charging by the room left in storage', () => {
    const r = computeBalance({ ...base, demand: 0, solar: 400, stored: 4950, storageCap: 5000, maxRate: 300 });
    expect(r.charge).toBe(50);
  });

  it('limits discharge to the energy actually stored this tick', () => {
    const r = computeBalance({ ...base, demand: 300, stored: 2, storageCap: 5000, maxRate: 300, dt: 0.01 });
    expect(r.discharge).toBeCloseTo(200);
    expect(r.satisfaction).toBeCloseTo(2 / 3);
  });

  it('reports no power on a dead grid and full power on an idle live grid', () => {
    expect(computeBalance({ ...base }).satisfaction).toBe(0);
    expect(computeBalance({ ...base, solar: 10 }).satisfaction).toBe(1);
  });

  it('prefers solar over thermal so coal is only burned for the remainder', () => {
    const r = computeBalance({ ...base, demand: 150, solar: 100, thermal: 300 });
    expect(r.solarUsed).toBe(100);
    expect(r.thermalUsed).toBe(50);
  });
});

describe('day / night and solar', () => {
  it('gives full sun at midday and none at night', () => {
    expect(daylightAt(0.3)).toBe(1);
    expect(daylightAt(0.8)).toBe(0);
    expect(daylightAt(0.03)).toBeGreaterThan(0);
    expect(daylightAt(0.03)).toBeLessThan(1);
  });

  it('solar panels only produce while the sun is up', () => {
    const w = testWorld();
    put(w, 'power_pole', 10, 10);
    put(w, 'solar_panel', 8, 8);
    w.dayPhase = 0.3;
    stepWorld(w);
    expect(w.power.totals.capacity).toBeCloseTo(40);
    w.dayPhase = 0.8;
    stepWorld(w);
    expect(w.power.totals.capacity).toBe(0);
  });
});

describe('power networks', () => {
  it('joins poles within wire reach and keeps distant poles separate', () => {
    const w = testWorld(40);
    const a = put(w, 'power_pole', 2, 2);
    const b = put(w, 'power_pole', 8, 2);
    const c = put(w, 'power_pole', 25, 2);
    rebuildPowerNetworks(w);
    expect(w.power.networks).toHaveLength(2);
    expect(a.powerNet).toBe(b.powerNet);
    expect(c.powerNet).not.toBe(a.powerNet);
    expect(w.power.wires).toEqual([[a.id, b.id]]);
    expect(polesConnected(a, b)).toBe(true);
    expect(polesConnected(b, c)).toBe(false);
  });

  it('powers only buildings inside a pole supply area', () => {
    const w = testWorld();
    const pole = put(w, 'power_pole', 10, 10);
    const near = put(w, 'furnace', 12, 12);
    const far = put(w, 'furnace', 16, 16);
    expect(poleCovers(pole, near)).toBe(true);
    expect(poleCovers(pole, far)).toBe(false);
    endlessGenerator(w, 7, 7);
    runStockedFurnaces(w, [near, far], 1);
    expect(near.powerNet).toBeGreaterThanOrEqual(0);
    expect(far.powerNet).toBe(-1);
    expect(near.satisfaction).toBe(1);
    expect(far.satisfaction).toBe(0);
  });

  it('slows the whole factory in proportion to the shortage when overloaded', () => {
    const plates = (panels: number): number => {
      const w = testWorld();
      w.dayPhase = 0.2;
      put(w, 'power_pole', 10, 10);
      const furnaces = [put(w, 'furnace', 8, 8), put(w, 'furnace', 11, 8)];
      const spots: [number, number][] = [[8, 11], [11, 11], [13, 8]];
      for (let i = 0; i < panels; i++) {
        const [x, y] = spots[i] ?? [0, 0];
        put(w, 'solar_panel', x, y);
      }
      return runStockedFurnaces(w, furnaces, 32);
    };
    const full = plates(3);
    const third = plates(1);
    expect(full).toBeGreaterThanOrEqual(38);
    expect(third / full).toBeGreaterThan(0.28);
    expect(third / full).toBeLessThan(0.38);
  });

  it('a thermal generator burns coal for the energy it delivers and stops when empty', () => {
    const w = testWorld();
    put(w, 'power_pole', 10, 10);
    const gen = put(w, 'thermal_generator', 8, 8);
    if (gen.generator) gen.generator.fuel = 2;
    const furnace = put(w, 'furnace', 11, 8);
    // 60 kW furnace => one coal lasts COAL_ENERGY / 60 = 20 s.
    runStockedFurnaces(w, [furnace], 30);
    expect(gen.generator?.fuel).toBe(0);
    expect(gen.generator?.burn).toBeGreaterThan(COAL_ENERGY * 0.4);
    expect(gen.generator?.burn).toBeLessThan(COAL_ENERGY * 0.6);
    runStockedFurnaces(w, [furnace], 15);
    expect(furnace.satisfaction).toBe(0);
    expect(w.stats.total('consumed', 'coal')).toBe(2);
  });

  it('accumulators bank surplus by day and keep the factory running at night', () => {
    const w = testWorld();
    w.dayPhase = 0.1;
    put(w, 'power_pole', 10, 10);
    const furnace = put(w, 'furnace', 8, 8);
    put(w, 'solar_panel', 11, 8);
    put(w, 'solar_panel', 8, 11);
    put(w, 'solar_panel', 11, 11);
    const acc = put(w, 'accumulator', 13, 10);
    runStockedFurnaces(w, [furnace], 30);
    // 120 kW solar - 60 kW furnace = 60 kW surplus for 30 s.
    expect(acc.accumulator?.stored).toBeGreaterThan(1700);
    expect(acc.accumulator?.stored).toBeLessThan(1850);
    const banked = acc.accumulator?.stored ?? 0;
    w.dayPhase = 0.8;
    runStockedFurnaces(w, [furnace], 10);
    expect(furnace.satisfaction).toBe(1);
    expect(acc.accumulator?.stored).toBeCloseTo(banked - 600, -1);
    expect(w.power.totals.discharge).toBeCloseTo(60);
  });

  it('an unpowered machine never starts a craft or consumes its ingredients', () => {
    const w = testWorld();
    const furnace = put(w, 'furnace', 5, 5);
    if (furnace.crafter) furnace.crafter.input = { iron_ore: 3 };
    run(w, 5);
    expect(furnace.crafter?.input).toEqual({ iron_ore: 3 });
    expect(furnace.crafter?.crafting).toBe(false);
  });
});
