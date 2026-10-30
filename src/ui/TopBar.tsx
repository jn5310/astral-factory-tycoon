import { useState } from 'react';
import { ROCKET_PARTS_REQUIRED } from '../data/constants';
import { RESEARCH_BY_ID } from '../data/research';
import { isNightPhase, secondsUntilNight } from '../systems/daynight';
import { invEntries } from '../systems/inventory';
import { researchFraction } from '../systems/research';
import { rocketProgress } from '../systems/silo';
import { clock, compact, energy, percent, power } from '../utils/format';
import { researchName } from '../utils/i18n';
import { Button, cx, ItemIcon } from './common';
import { useGame, useGameVersion, useMsg } from './GameContext';
import { IconBiohazard, IconBolt, IconChart, IconFlask, IconMenu, IconMoon, IconPause, IconPlay, IconRocket, IconSun } from './Icons';

export type Overlay = 'none' | 'menu' | 'research' | 'stats' | 'blueprints' | 'help' | 'settings' | 'achievements' | 'codex';

function MiniBar({ label, frac, color }: { label: string; frac: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-7 text-[9px] leading-none text-slate-400">{label}</span>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-800">
        <div className={cx('h-full rounded-full', color)} style={{ width: `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%` }} />
      </div>
    </div>
  );
}

/** Live generation vs consumption vs battery gauge; tap for the detailed breakdown. */
function PowerGauge() {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const [open, setOpen] = useState(false);
  const t = game.world.power.totals;
  const scale = Math.max(t.capacity, t.demand, 1);
  // Speed of the worst overloaded grid; grids with no generator at all are reported separately below.
  let sat = 1;
  for (const n of game.world.power.networks) {
    if (n.demand > 0 && (n.capacity > 0 || n.stored > 0)) sat = Math.min(sat, n.satisfaction);
  }
  const tone =
    t.overloaded > 0 ? (sat >= 0.5 ? 'text-amber-300' : 'text-red-400') : t.starved > 0 || t.unpowered > 0 ? 'text-amber-300' : 'text-emerald-300';
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-900/80 px-2"
        aria-label={m.power.aria(percent(sat))}
        aria-expanded={open}
      >
        <IconBolt className={cx('h-4 w-4', tone)} />
        <div className="flex flex-col gap-0.5">
          <MiniBar label={m.power.gen} frac={t.capacity / scale} color="bg-emerald-400" />
          <MiniBar label={m.power.use} frac={t.demand / scale} color={sat >= 0.999 ? 'bg-orange-400' : 'bg-red-500'} />
          <MiniBar label={m.power.batt} frac={t.storageCap > 0 ? t.stored / t.storageCap : 0} color="bg-cyan-400" />
        </div>
        <span className={cx('w-9 text-right text-xs font-bold', tone)}>{percent(sat)}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-30 w-64 rounded-xl border border-cyan-400/25 bg-slate-950/95 p-3 text-xs shadow-xl">
          <div className="mb-2 font-bold text-cyan-100">{m.power.title}</div>
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1">
            <dt className="text-slate-400">{m.power.generation}</dt>
            <dd className="text-right text-emerald-300">{power(t.generation)}</dd>
            <dt className="text-slate-400">{m.power.capacity}</dt>
            <dd className="text-right">{power(t.capacity)}</dd>
            <dt className="text-slate-400">{m.power.demand}</dt>
            <dd className="text-right text-orange-300">{power(t.demand)}</dd>
            <dt className="text-slate-400">{m.power.battery}</dt>
            <dd className="text-right text-cyan-300">{t.storageCap > 0 ? `${percent(t.stored / t.storageCap)} (${energy(t.stored)})` : m.power.noBattery}</dd>
            <dt className="text-slate-400">{m.power.flow}</dt>
            <dd className="text-right">
              +{power(t.charge)} / -{power(t.discharge)}
            </dd>
            <dt className="text-slate-400">{m.power.networks}</dt>
            <dd className="text-right">{t.networks}</dd>
          </dl>
          {t.overloaded > 0 ? (
            <p className="mt-2 rounded-md bg-red-950/60 p-2 text-red-200">{m.power.overloaded(t.overloaded, percent(sat))}</p>
          ) : (
            <p className="mt-2 rounded-md bg-emerald-950/60 p-2 text-emerald-200">{m.power.ok}</p>
          )}
          {t.starved > 0 && <p className="mt-1 text-amber-300">{m.power.starved(t.starved)}</p>}
          {t.unpowered > 0 && <p className="mt-1 text-amber-300">{m.power.unpowered(t.unpowered)}</p>}
        </div>
      )}
    </div>
  );
}

function DayClock() {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const w = game.world;
  const night = isNightPhase(w.dayPhase);
  return (
    <div className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900/80 px-2 text-xs" aria-live="polite">
      {night ? <IconMoon className={cx('h-4 w-4', w.director.bloodMoon ? 'text-red-400' : 'text-indigo-300')} /> : <IconSun className="h-4 w-4 text-amber-300" />}
      <div className="leading-tight">
        <div className="font-bold">{m.hud.dayLabel(w.day, night)}</div>
        <div className={night ? 'text-red-300' : 'text-slate-400'}>
          {night || w.enemies.length > 0 ? m.hud.enemies(w.enemies.length) : m.hud.untilNight(clock(secondsUntilNight(w.dayPhase)))}
        </div>
      </div>
    </div>
  );
}

function ResourceBar() {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const entries = invEntries(game.world.inventory);
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto text-xs" aria-label={m.hud.coreResources}>
      {entries.length === 0 && <span className="px-1 text-slate-500">{m.hud.coreEmpty}</span>}
      {entries.map(([id, n]) => (
        <span key={id} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-900/85 px-1.5 py-0.5">
          <ItemIcon item={id} size={16} />
          <span className="tabular-nums">{compact(n)}</span>
        </span>
      ))}
    </div>
  );
}

export function TopBar({ onOpen }: { onOpen: (o: Overlay) => void }) {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const w = game.world;
  const current = w.research.current ? RESEARCH_BY_ID.get(w.research.current) : undefined;
  const hasSilo = [...w.buildings.values()].some((b) => b.silo);
  const rocket = rocketProgress(w);
  const pollution = w.pollution.total;
  const open = (o: Overlay): void => {
    game.uiClick();
    onOpen(o);
  };
  return (
    <div className="pointer-events-auto flex flex-col gap-1 bg-linear-to-b from-slate-950/95 to-slate-950/60 px-2 pb-1 pt-[max(env(safe-area-inset-top),0.25rem)]">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button aria-label={m.hud.menu} onClick={() => open('menu')}>
          <IconMenu />
        </Button>
        <DayClock />
        <PowerGauge />
        <button
          type="button"
          onClick={() => game.setPollutionOverlay(!game.showPollution)}
          className={cx(
            'flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-xs',
            game.showPollution ? 'bg-lime-900/70 ring-1 ring-lime-400/60' : 'bg-slate-900/80',
          )}
          aria-pressed={game.showPollution}
          aria-label={m.hud.pollution(compact(Math.round(pollution)))}
        >
          <IconBiohazard className={cx('h-4 w-4', pollution > 6000 ? 'text-red-400' : pollution > 2000 ? 'text-lime-300' : 'text-slate-400')} />
          <span className="tabular-nums">{compact(Math.round(pollution))}</span>
        </button>
        <Button aria-label={m.hud.researchTree} onClick={() => open('research')} className="max-w-44">
          <IconFlask className="h-5 w-5 text-indigo-300" />
          <span className="hidden truncate text-xs sm:inline">{current ? researchName(current.id) : m.hud.research}</span>
          {current && <span className="text-xs text-indigo-200">{percent(researchFraction(w, current.id))}</span>}
        </Button>
        <Button aria-label={m.hud.stats} onClick={() => open('stats')}>
          <IconChart className="h-5 w-5 text-emerald-300" />
        </Button>
        {hasSilo && (
          <span className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-slate-900/80 px-2 text-xs" aria-label={m.hud.rocket}>
            <IconRocket className="h-4 w-4 text-rose-300" />
            {rocket.installed}/{ROCKET_PARTS_REQUIRED}
          </span>
        )}
        <Button aria-label={game.speed === 0 ? m.hud.resume : m.hud.pause} onClick={() => game.togglePause()} variant={game.speed === 0 ? 'active' : 'default'}>
          {game.speed === 0 ? <IconPlay /> : <IconPause />}
        </Button>
        <Button aria-label={m.hud.speed} onClick={() => game.setSpeed(game.speed >= 3 ? 1 : ((game.speed + 1) as 2 | 3))} className="w-12 tabular-nums">
          {Math.max(1, game.speed)}x
        </Button>
      </div>
      <ResourceBar />
    </div>
  );
}
