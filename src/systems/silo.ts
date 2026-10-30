import type { Building } from '../entities/Building';
import { BUILDINGS } from '../data/buildings';
import { LAUNCH_DURATION, ROCKET_PARTS_REQUIRED, SILO_ASSEMBLY_TIME } from '../data/constants';
import { playSound, pushEvent, toast } from '../core/grid';
import type { World } from '../core/World';

/** Assembles buffered rocket parts into the rocket; 1,000 parts start the launch. */
export function updateSilo(world: World, b: Building, dt: number): void {
  const s = b.silo;
  if (!s) return;
  b.active = false;
  b.demand = 0;
  if (world.launch.active) return;
  if (s.buffer > 0 && s.installed < ROCKET_PARTS_REQUIRED) {
    b.demand = BUILDINGS.rocket_silo.power?.use ?? 0;
    if (b.satisfaction > 0) {
      b.active = true;
      b.anim += dt;
      s.progress += (dt * b.satisfaction) / SILO_ASSEMBLY_TIME;
      while (s.progress >= 1 && s.buffer > 0 && s.installed < ROCKET_PARTS_REQUIRED) {
        s.progress -= 1;
        s.buffer--;
        s.installed++;
        world.stats.record('consumed', 'rocket_part', 1);
      }
      if (s.buffer === 0) s.progress = 0;
    }
  }
  if (s.installed >= ROCKET_PARTS_REQUIRED) startLaunch(world, b);
}

export function startLaunch(world: World, b: Building): void {
  if (world.launch.active || world.state !== 'playing') return;
  world.launch.active = true;
  world.launch.timer = 0;
  world.launch.siloId = b.id;
  pushEvent(world, { type: 'launchStart' });
  playSound(world, 'launch', b.x + b.size / 2, b.y + b.size / 2);
  toast(world, '로켓 조립 완료! 궤도 탈출 카운트다운 시작!', 'success');
}

export function updateLaunch(world: World, dt: number): void {
  const l = world.launch;
  if (!l.active) return;
  l.timer += dt;
  const silo = world.buildings.get(l.siloId);
  if (silo && world.visuals) {
    const cx = silo.x + silo.size / 2;
    const rise = Math.max(0, l.timer - 3);
    const y = silo.y + silo.size / 2 - rise * rise * 1.5;
    for (let i = 0; i < 3; i++) {
      world.particles.spawn(
        'exhaust',
        cx + (world.rng.next() - 0.5) * 0.8,
        y + 1.2,
        (world.rng.next() - 0.5) * 2,
        2 + world.rng.next() * 3,
        1.2 + world.rng.next(),
        0.3 + world.rng.next() * 0.4,
        world.rng.next() < 0.5 ? '#fbbf24' : '#f97316',
      );
    }
    if (world.tick % 6 === 0) pushEvent(world, { type: 'shake', strength: Math.min(1, 0.2 + l.timer / LAUNCH_DURATION) });
  }
  if (l.timer >= LAUNCH_DURATION && world.state === 'playing') {
    world.state = 'victory';
    if (silo?.silo) silo.silo.installed = 0;
    l.active = false;
    pushEvent(world, { type: 'victory' });
    playSound(world, 'victory', world.width / 2, world.height / 2);
  }
}

/** After a win the colony keeps running in free play; the silo starts a new rocket from zero. */
export function continueAfterVictory(world: World): void {
  if (world.state !== 'victory') return;
  world.state = 'playing';
  world.launch.active = false;
  world.launch.timer = 0;
}

export function rocketProgress(world: World): { installed: number; required: number } {
  let installed = 0;
  for (const b of world.buildings.values()) if (b.silo) installed = Math.max(installed, b.silo.installed);
  return { installed, required: ROCKET_PARTS_REQUIRED };
}
