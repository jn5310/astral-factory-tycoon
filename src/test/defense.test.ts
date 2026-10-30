import { describe, expect, it } from 'vitest';
import { createEnemy } from '../entities/Enemy';
import { LAUNCH_DURATION, ROCKET_PARTS_REQUIRED } from '../data/constants';
import { ENEMIES } from '../data/enemies';
import { stepWorld } from '../core/engine';
import { createWorld } from '../core/World';
import { canAccept, tryInsert } from '../systems/logistics';
import { applySlow } from '../systems/combat';
import { continueAfterVictory } from '../systems/silo';
import { pollutionAt } from '../systems/pollution';
import { pollutionRaids, RAID_THRESHOLD } from '../systems/waves';
import { beltLine, endlessGenerator, put, run, testWorld } from './helpers';

describe('turrets and defense', () => {
  it('ammo turrets stay silent until ammo arrives by belt, then shoot', () => {
    const w = testWorld(30);
    const turret = put(w, 'mg_turret', 12, 12);
    const enemy = createEnemy(1, 'charger', 15.5, 15.5);
    w.enemies.push(enemy);
    run(w, 2);
    expect(enemy.hp).toBe(enemy.maxHp);
    const feed = beltLine(w, 8, 12, 4, 0);
    feed[0]?.belt?.items.push({ item: 'basic_ammo', pos: 0 });
    run(w, 4);
    expect(turret.turret?.ammoItem === 'basic_ammo' || (turret.turret?.ammo ?? 0) < 10).toBe(true);
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
  });

  it('turrets only load ammo they can fire', () => {
    const w = testWorld();
    const mg = put(w, 'mg_turret', 5, 5);
    const cannon = put(w, 'cannon_turret', 8, 5);
    expect(canAccept(w, mg, 'basic_ammo', 2)).toBe(true);
    expect(canAccept(w, mg, 'explosive_ammo', 2)).toBe(false);
    expect(canAccept(w, cannon, 'explosive_ammo', 2)).toBe(true);
    expect(canAccept(w, cannon, 'iron_plate', 2)).toBe(false);
    tryInsert(w, mg, 'ap_ammo', 2);
    // A loaded magazine refuses a different ammo type until it is spent.
    expect(canAccept(w, mg, 'basic_ammo', 2)).toBe(false);
  });

  it('laser turrets burn power, not ammo, and do nothing without it', () => {
    const fight = (powered: boolean): number => {
      const w = testWorld(30);
      put(w, 'power_pole', 11, 11);
      put(w, 'laser_turret', 12, 12);
      if (powered) endlessGenerator(w, 9, 9);
      const enemy = createEnemy(1, 'charger', 15.5, 15.5);
      w.enemies.push(enemy);
      run(w, 2);
      return enemy.hp / enemy.maxHp;
    };
    expect(fight(false)).toBe(1);
    expect(fight(true)).toBeLessThan(0.7);
  });

  it('slow pulses cut enemy speed in half for a while', () => {
    const e = createEnemy(1, 'rusher', 5, 5);
    applySlow(e);
    expect(e.slowFactor).toBe(0.5);
    const w = testWorld(30);
    w.enemies.push(e);
    run(w, 0.5);
    const moved = Math.hypot(e.x - 5, e.y - 5);
    // Unslowed it would cover speed * 0.5 s; slowed, about half of that.
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(ENEMIES.rusher.speed * 0.5 * 0.5 + 0.05);
  });

  it('the core defends itself against a lone rusher', () => {
    const w = testWorld(30, { core: true });
    const e = createEnemy(1, 'rusher', 7.5, 15.5);
    w.enemies.push(e);
    run(w, 12);
    expect(e.dead || w.enemies.length === 0).toBe(true);
    expect(w.kills).toBe(1);
  });
});

describe('pollution raids', () => {
  it('nests soaked in pollution send attackers even in daylight', () => {
    const w = createWorld({ seed: 21 });
    w.visuals = false;
    const nest = w.nests[0];
    expect(nest).toBeDefined();
    if (!nest) return;
    expect(pollutionRaids(w)).toBe(0);
    const p = w.pollution;
    p.values[Math.floor(nest.y / p.chunk) * p.cols + Math.floor(nest.x / p.chunk)] = RAID_THRESHOLD * 3;
    expect(pollutionAt(p, nest.x, nest.y)).toBe(RAID_THRESHOLD * 3);
    expect(pollutionRaids(w)).toBe(3);
    expect(w.enemies).toHaveLength(3);
  });
});

describe('orbital escape (victory)', () => {
  it('only accepts rocket parts, and 1,000 installed parts launch the rocket and win', () => {
    const w = testWorld(40);
    endlessGenerator(w, 2, 2);
    put(w, 'power_pole', 5, 2);
    const silo = put(w, 'rocket_silo', 6, 2);
    expect(canAccept(w, silo, 'processor', 2)).toBe(false);
    if (silo.silo) silo.silo.installed = ROCKET_PARTS_REQUIRED - 2;
    expect(tryInsert(w, silo, 'rocket_part', 2)).toBe(true);
    run(w, 1);
    expect(w.launch.active).toBe(false);
    tryInsert(w, silo, 'rocket_part', 2);
    run(w, 1);
    expect(silo.silo?.installed).toBe(ROCKET_PARTS_REQUIRED);
    expect(w.launch.active).toBe(true);
    expect(w.state).toBe('playing');
    for (let t = 0; t < 60 * (LAUNCH_DURATION + 1) && w.state === 'playing'; t++) stepWorld(w);
    expect(w.state).toBe('victory');
    expect(w.events.some((e) => e.type === 'victory')).toBe(true);
    continueAfterVictory(w);
    expect(w.state).toBe('playing');
    expect(silo.silo?.installed).toBe(0);
  });
});
