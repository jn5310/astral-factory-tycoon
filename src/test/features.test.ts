import { describe, expect, it } from 'vitest';
import { createEnemy } from '../entities/Enemy';
import { ABILITIES } from '../data/abilities';
import { ACHIEVEMENT_IDS } from '../data/achievements';
import { MISSIONS } from '../data/missions';
import { Ore } from '../data/terrain';
import { stepWorld } from '../core/engine';
import { exportToJSON, importFromJSON } from '../core/save';
import { emptyProfile, recordScore, sanitizeProfile } from '../core/profile';
import { createWorld } from '../core/World';
import { activateAbility, canUseAbility, unlockAbility } from '../systems/abilities';
import { checkAchievements } from '../systems/achievements';
import { damageEnemy, killEnemy } from '../systems/combat';
import { collectPickup, eligibleEvents, meteorImpact, pickupAt, spawnPickup, triggerEvent } from '../systems/director';
import { rebuildEnemyIndex } from '../systems/enemyAI';
import { completeMission, currentMission, missionProgress, updateMissions } from '../systems/missions';
import { productionBoost, solarMultiplier, waveMultiplier } from '../systems/modifiers';
import { computeScore } from '../systems/score';
import { rankFor } from '../data/turrets';
import { dailyKey, dailyMutator, dailySeed } from '../utils/daily';
import { chordAt, stepEvents } from '../utils/music';
import { endlessGenerator, put, run, setOre, testWorld } from './helpers';

function campaignWorld(): ReturnType<typeof createWorld> {
  const w = createWorld({ seed: 4, width: 40, height: 40, flat: true, withCore: true, startingItems: false });
  w.visuals = false;
  w.waves.triggered = true;
  w.director.timer = 1e9;
  return w;
}

describe('missions', () => {
  it('starts with the first mission and tracks building progress', () => {
    const w = campaignWorld();
    expect(currentMission(w)?.id).toBe('first_drill');
    setOre(w, 4, 4, 2, Ore.Iron);
    setOre(w, 8, 4, 2, Ore.Iron);
    put(w, 'mech_drill', 4, 4);
    expect(missionProgress(w)).toEqual({ current: 1, target: 2 });
    put(w, 'mech_drill', 8, 4);
    updateMissions(w, 1);
    expect(currentMission(w)?.id).toBe('conveyor');
    expect(w.inventory.iron_plate).toBe(40);
    expect(w.events.some((e) => e.type === 'missionComplete')).toBe(true);
  });

  it('counts production goals from the moment the mission starts', () => {
    const w = campaignWorld();
    w.stats.record('produced', 'iron_ore', 500);
    w.missions.index = MISSIONS.findIndex((m) => m.id === 'ore_flow') - 1;
    completeMission(w);
    expect(currentMission(w)?.id).toBe('ore_flow');
    expect(missionProgress(w)?.current).toBe(0);
    w.stats.record('produced', 'iron_ore', 25);
    expect(missionProgress(w)?.current).toBe(25);
  });

  it('unlocks commander powers from mission rewards', () => {
    const w = campaignWorld();
    w.missions.index = MISSIONS.findIndex((m) => m.id === 'first_night');
    w.counters.nightsSurvived = 1;
    updateMissions(w, 1);
    expect(w.abilities.unlocked).toContain('orbital');
  });

  it('skips kill missions in peaceful mode but still grants their unlocks', () => {
    const w = createWorld({ seed: 4, width: 40, height: 40, flat: true, withCore: true, difficulty: 'peaceful' });
    w.visuals = false;
    w.missions.index = MISSIONS.findIndex((m) => m.id === 'hunter');
    updateMissions(w, 1);
    expect(currentMission(w)?.id).toBe('circuits');
    expect(w.abilities.unlocked).toContain('repair');
  });

  it('has no missions in sandbox mode', () => {
    const w = createWorld({ seed: 4, width: 40, height: 40, flat: true, withCore: true, mode: 'sandbox' });
    expect(currentMission(w)).toBeNull();
    expect(w.abilities.unlocked).toHaveLength(4);
    expect(w.research.completed.size).toBe(35);
  });
});

describe('commander powers', () => {
  it('cannot be used while locked or recharging', () => {
    const w = testWorld();
    expect(activateAbility(w, 'repair')).toBe(false);
    unlockAbility(w, 'repair');
    expect(activateAbility(w, 'repair')).toBe(true);
    expect(canUseAbility(w, 'repair')).toBe(false);
    run(w, ABILITIES.repair.cooldown + 0.1);
    expect(canUseAbility(w, 'repair')).toBe(true);
  });

  it('orbital strike lands after a delay and destroys aliens in the blast', () => {
    const w = testWorld();
    unlockAbility(w, 'orbital');
    const near = createEnemy(1, 'charger', 10.5, 10.5);
    const far = createEnemy(2, 'charger', 25.5, 25.5);
    w.enemies.push(near, far);
    rebuildEnemyIndex(w);
    expect(activateAbility(w, 'orbital', { x: 10.5, y: 10.5 })).toBe(true);
    stepWorld(w);
    expect(near.hp).toBe(near.maxHp);
    run(w, ABILITIES.orbital.duration + 0.1);
    expect(near.dead).toBe(true);
    expect(far.hp).toBe(far.maxHp);
    expect(activateAbility(w, 'orbital')).toBe(false);
  });

  it('repair nanites heal every damaged building', () => {
    const w = testWorld();
    unlockAbility(w, 'repair');
    const a = put(w, 'wall', 2, 2);
    const b = put(w, 'wall', 5, 5);
    a.hp = 100;
    b.hp = 10;
    activateAbility(w, 'repair');
    expect(a.hp).toBe(300);
    expect(b.hp).toBe(210);
  });

  it('overclock doubles production speed while it runs', () => {
    const smelted = (overclock: boolean): number => {
      const w = testWorld();
      endlessGenerator(w, 2, 2);
      put(w, 'power_pole', 5, 2);
      const f = put(w, 'furnace', 6, 2);
      if (overclock) {
        unlockAbility(w, 'overclock');
        activateAbility(w, 'overclock');
      }
      let plates = 0;
      for (let t = 0; t < 60 * 16; t++) {
        if (f.crafter) {
          f.crafter.input.iron_ore = 3;
          plates += f.crafter.output.iron_plate ?? 0;
          f.crafter.output = {};
        }
        stepWorld(w);
      }
      return plates;
    };
    const normal = smelted(false);
    const boosted = smelted(true);
    // 20 s of overclock out of 16 s measured: everything runs at 2x.
    expect(boosted).toBeGreaterThanOrEqual(normal * 2 - 1);
  });

  it('cryo pulse freezes every alien in place', () => {
    const w = testWorld(30, { core: true });
    unlockAbility(w, 'cryo');
    const e = createEnemy(1, 'rusher', 3.5, 15.5);
    e.maxHp = e.hp = 1000;
    w.enemies.push(e);
    activateAbility(w, 'cryo');
    const x = e.x;
    run(w, 3);
    expect(e.x).toBe(x);
    run(w, ABILITIES.cryo.duration);
    expect(e.x).not.toBe(x);
  });
});

describe('random events', () => {
  it('only offers events that fit the day, the time and the difficulty', () => {
    const w = campaignWorld();
    w.day = 1;
    expect(eligibleEvents(w)).toEqual(['supplyDrop']);
    w.day = 10;
    w.dayPhase = 0.3;
    expect(eligibleEvents(w)).toContain('bloodMoon');
    w.dayPhase = 0.8;
    expect(eligibleEvents(w)).not.toContain('solarFlare');
    const calm = createWorld({ seed: 1, width: 30, height: 30, flat: true, difficulty: 'peaceful' });
    calm.day = 10;
    calm.dayPhase = 0.3;
    expect(eligibleEvents(calm)).not.toContain('bloodMoon');
  });

  it('supply pods land, can be tapped for their cargo, and count toward missions', () => {
    const w = campaignWorld();
    const pod = spawnPickup(w, 10.5, 10.5, [{ item: 'steel', amount: 25 }]);
    expect(pickupAt(w, 10.5, 10.5)).toBeUndefined();
    run(w, 3);
    expect(pickupAt(w, 10.8, 10.2)?.id).toBe(pod.id);
    expect(collectPickup(w, pod.id)).toBe(true);
    expect(w.inventory.steel).toBe(25);
    expect(w.counters.dropsCollected).toBe(1);
    expect(w.pickups).toHaveLength(0);
  });

  it('meteors damage buildings and leave ore deposits that survive a save', () => {
    const w = createWorld({ seed: 9, width: 40, height: 40, flat: true, withCore: true });
    w.visuals = false;
    const wall = put(w, 'wall', 8, 8);
    meteorImpact(w, { x: 8.5, y: 8.5, t: 0, ore: Ore.Titanium });
    expect(wall.hp).toBeLessThan(wall.maxHp);
    expect(w.ore[7 * 40 + 8]).toBe(Ore.Titanium);
    // The tile under the wall keeps its old ore.
    expect(w.ore[8 * 40 + 8]).toBe(Ore.None);
    const loaded = importFromJSON(exportToJSON(w));
    expect(loaded?.ore[7 * 40 + 8]).toBe(Ore.Titanium);
  });

  it('timed events change solar output, and the blood moon grows the next wave', () => {
    const w = campaignWorld();
    expect(solarMultiplier(w)).toBe(1);
    triggerEvent(w, 'solarFlare');
    expect(solarMultiplier(w)).toBeGreaterThan(2);
    w.director.effect = null;
    triggerEvent(w, 'dustStorm');
    expect(solarMultiplier(w)).toBeLessThan(0.5);
    const base = waveMultiplier(w);
    triggerEvent(w, 'bloodMoon');
    expect(waveMultiplier(w)).toBeCloseTo(base * 1.6);
  });
});

describe('salvage and veterancy', () => {
  it('kills drop salvage into the core', () => {
    const w = campaignWorld();
    const e = createEnemy(1, 'charger', 5, 5);
    w.enemies.push(e);
    killEnemy(w, e);
    expect(w.inventory.iron_plate).toBe(3);
    expect(w.inventory.gear).toBe(1);
    const boss = createEnemy(2, 'leviathan', 5, 5);
    killEnemy(w, boss);
    expect(w.counters.bossKills).toBe(1);
    expect(w.inventory.steel).toBe(25);
  });

  it('turrets earn ranks from the kills they score', () => {
    expect([0, 9, 10, 29, 30, 75].map(rankFor)).toEqual([0, 0, 1, 1, 2, 3]);
    const w = campaignWorld();
    const t = put(w, 'mg_turret', 3, 3);
    for (let i = 0; i < 10; i++) {
      const e = createEnemy(i + 1, 'rusher', 4, 4);
      damageEnemy(w, e, 9999, 0, t.id);
    }
    expect(t.turret?.kills).toBe(10);
    expect(w.events.some((e) => e.type === 'rankUp')).toBe(true);
  });
});

describe('difficulty, modes and the daily challenge', () => {
  it('scales waves by difficulty and turns attacks off in peaceful mode', () => {
    const mk = (difficulty: 'peaceful' | 'easy' | 'normal' | 'nightmare') =>
      createWorld({ seed: 2, width: 30, height: 30, flat: true, difficulty });
    expect(waveMultiplier(mk('peaceful'))).toBe(0);
    expect(waveMultiplier(mk('easy'))).toBeLessThan(waveMultiplier(mk('normal')));
    expect(waveMultiplier(mk('nightmare'))).toBe(2);
    const calm = createWorld({ seed: 8, difficulty: 'peaceful' });
    calm.visuals = false;
    calm.dayPhase = 0.619;
    for (let i = 0; i < 300; i++) stepWorld(calm);
    expect(calm.enemies).toHaveLength(0);
  });

  it('gives sandbox players everything and free building', () => {
    const w = createWorld({ seed: 3, width: 40, height: 40, flat: true, withCore: true, mode: 'sandbox' });
    const before = w.inventory.steel;
    put(w, 'conveyor', 2, 2);
    expect(w.inventory.steel).toBe(before);
    expect(w.inventory.processor).toBeGreaterThan(1000);
  });

  it('builds the same daily challenge for everyone on a given date', () => {
    const key = dailyKey(new Date('2026-10-30T23:59:00Z'));
    expect(key).toBe('2026-10-30');
    expect(dailySeed(key)).toBe(dailySeed('2026-10-30'));
    expect(dailySeed(key)).not.toBe(dailySeed('2026-10-31'));
    expect(dailyMutator(key)).not.toBe('none');
  });

  it('lets overclock and events stack with the base multipliers', () => {
    const w = campaignWorld();
    expect(productionBoost(w)).toBe(1);
    w.abilities.overclock = 5;
    expect(productionBoost(w)).toBe(2);
  });
});

describe('score, achievements and profile', () => {
  it('scores a run and multiplies by difficulty', () => {
    const w = createWorld({ seed: 1, width: 30, height: 30, flat: true, difficulty: 'hard' });
    w.kills = 10;
    w.counters.nightsSurvived = 2;
    const s = computeScore(w);
    expect(s.kills).toBe(100);
    expect(s.nights).toBe(600);
    expect(s.total).toBe(Math.round((100 + 600) * 1.5));
    w.counters.launches = 1;
    w.counters.launchDay = 20;
    expect(computeScore(w).victory).toBe(20000);
    expect(computeScore(w).speed).toBe(5000);
  });

  it('unlocks achievements once and never in sandbox', () => {
    const w = campaignWorld();
    expect(checkAchievements(w, new Set())).toEqual([]);
    w.kills = 1;
    expect(checkAchievements(w, new Set())).toEqual(['first_blood']);
    expect(checkAchievements(w, new Set(['first_blood']))).toEqual([]);
    const sandbox = createWorld({ seed: 1, width: 30, height: 30, flat: true, mode: 'sandbox' });
    sandbox.kills = 1000;
    expect(checkAchievements(sandbox, new Set())).toEqual([]);
    expect(ACHIEVEMENT_IDS.length).toBeGreaterThanOrEqual(20);
  });

  it('keeps a sorted top-10 high score table and the best daily score', () => {
    const p = emptyProfile();
    for (let i = 1; i <= 12; i++) {
      recordScore(p, { score: i * 100, mode: 'standard', difficulty: 'normal', day: i, victory: false, date: '2026-10-30', seed: i }, null);
    }
    expect(p.highScores).toHaveLength(10);
    expect(p.highScores[0]?.score).toBe(1200);
    const rank = recordScore(p, { score: 50, mode: 'daily', difficulty: 'normal', day: 3, victory: false, date: '2026-10-30', seed: 1 }, '2026-10-30');
    expect(rank).toBe(-1);
    expect(p.dailyBest['2026-10-30']).toBe(50);
  });

  it('rebuilds a profile from corrupted storage without crashing', () => {
    const p = sanitizeProfile({
      achievements: { first_blood: 123, fake: 5 },
      seenEnemies: ['rusher', 'dragon', 'rusher'],
      highScores: [{ score: 10, mode: 'standard', difficulty: 'easy', day: 2, victory: true, date: '2026-01-01', seed: 3 }, { score: 'x' }],
      dailyBest: { '2026-01-01': 40, nope: 9 },
      runs: -3,
    });
    expect(p.achievements).toEqual({ first_blood: 123 });
    expect(p.seenEnemies).toEqual(['rusher']);
    expect(p.highScores).toHaveLength(1);
    expect(p.dailyBest).toEqual({ '2026-01-01': 40 });
    expect(p.runs).toBe(0);
    expect(sanitizeProfile('garbage')).toEqual(emptyProfile());
  });
});

describe('saves v2', () => {
  it('round-trips settings, missions, powers, counters, turret kills and pickups', () => {
    const w = createWorld({ seed: 6, difficulty: 'hard', mode: 'daily', mutator: 'swarm', dailyKey: '2026-10-30' });
    w.visuals = false;
    w.missions.index = 5;
    unlockAbility(w, 'cryo');
    w.abilities.cooldown.cryo = 33;
    w.counters.nightsSurvived = 4;
    w.stats.record('produced', 'gear', 77);
    const core = w.buildings.get(w.coreId);
    const t = put(w, 'mg_turret', (core?.x ?? 0) - 3, core?.y ?? 0);
    if (t.turret) t.turret.kills = 31;
    spawnPickup(w, (core?.x ?? 0) + 6.5, (core?.y ?? 0) + 0.5, [{ item: 'circuit', amount: 9 }]);
    const loaded = importFromJSON(exportToJSON(w));
    expect(loaded?.settings).toEqual({ mode: 'daily', difficulty: 'hard', mutator: 'swarm', dailyKey: '2026-10-30' });
    expect(loaded?.missions.index).toBe(5);
    expect(loaded?.abilities.unlocked).toEqual(['cryo']);
    expect(loaded?.abilities.cooldown.cryo).toBe(33);
    expect(loaded?.counters.nightsSurvived).toBe(4);
    expect(loaded?.stats.lifetimeTotal('produced', 'gear')).toBe(77);
    expect(loaded?.buildings.get(t.id)?.turret?.kills).toBe(31);
    expect(loaded?.pickups[0]?.loot).toEqual([{ item: 'circuit', amount: 9 }]);
  });

  it('still loads version-1 saves with default run state', () => {
    const w = createWorld({ seed: 6 });
    const data = JSON.parse(exportToJSON(w)) as Record<string, unknown>;
    data.version = 1;
    for (const k of ['settings', 'missions', 'abilities', 'director', 'pickups', 'counters', 'oreEdits', 'lifetime']) delete data[k];
    const loaded = importFromJSON(JSON.stringify(data));
    expect(loaded).not.toBeNull();
    expect(loaded?.settings.mode).toBe('standard');
    expect(loaded?.missions.index).toBe(0);
    expect(loaded?.buildings.size).toBe(w.buildings.size);
  });
});

describe('adaptive music patterns', () => {
  it('plays a chord at the start of every two bars and drums only when tense', () => {
    const none = (): number => 0.99;
    const calm = stepEvents('calm', 0, none);
    expect(calm.filter((e) => e.kind === 'pad').map((e) => e.midi)).toEqual([...chordAt('calm', 0)]);
    expect(calm.some((e) => e.kind === 'kick')).toBe(false);
    const boss = Array.from({ length: 16 }, (_, s) => stepEvents('boss', s, none)).flat();
    expect(boss.filter((e) => e.kind === 'kick')).toHaveLength(4);
    expect(boss.filter((e) => e.kind === 'snare')).toHaveLength(2);
    expect(chordAt('tense', 32)).not.toEqual(chordAt('tense', 0));
  });
});
