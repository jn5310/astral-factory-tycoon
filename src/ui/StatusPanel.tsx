import { useState } from 'react';
import { ENEMIES } from '../data/enemies';
import { currentMission, missionProgress, missionTitle } from '../systems/missions';
import { abilityName, enemyName } from '../utils/i18n';
import { cx, ItemIcon, ProgressBar } from './common';
import { useGame, useGameVersion, useMsg } from './GameContext';
import { IconMoon, IconSkull, IconX } from './Icons';

/** Active campaign mission with progress and reward (top-left). */
export function MissionCard() {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const [hidden, setHidden] = useState(false);
  const w = game.world;
  if (w.settings.mode === 'sandbox') return null;
  const def = currentMission(w);
  const progress = missionProgress(w);
  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        className="pointer-events-auto min-h-11 rounded-lg border border-cyan-400/25 bg-slate-950/80 px-3 text-xs font-bold text-cyan-200"
      >
        {m.missions.title} {w.missions.index + 1}
      </button>
    );
  }
  return (
    <div className="pointer-events-auto w-[min(17rem,calc(100vw_-_10.5rem))] rounded-xl border border-cyan-400/25 bg-slate-950/85 p-2 text-[11px] text-cyan-50 shadow-lg shadow-black/40">
      <div className="flex items-center gap-1">
        <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-200">
          {m.missions.title} {Math.min(w.missions.index + 1, 99)}
        </span>
        <button type="button" className="ml-auto flex h-8 w-8 items-center justify-center text-slate-400" onClick={() => setHidden(true)} aria-label={m.missions.hide}>
          <IconX className="h-4 w-4" />
        </button>
      </div>
      {def && progress ? (
        <>
          <p className="mt-0.5 font-semibold leading-snug">{missionTitle(def)}</p>
          <div className="mt-1 flex items-center gap-2">
            <ProgressBar value={progress.current / progress.target} color="bg-cyan-400" className="h-1.5" />
            <span className="shrink-0 tabular-nums text-slate-300">{m.missions.progress(progress.current, progress.target)}</span>
          </div>
          {(def.reward.length > 0 || def.unlock) && (
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
              {m.missions.reward}:
              {def.reward.map((r) => (
                <span key={r.item} className="inline-flex items-center gap-0.5 text-slate-200">
                  <ItemIcon item={r.item} size={14} />
                  {r.amount}
                </span>
              ))}
              {def.unlock && <span className="text-amber-300">{m.missions.unlock(abilityName(def.unlock))}</span>}
            </div>
          )}
        </>
      ) : (
        <p className="mt-0.5 text-slate-300">{m.missions.allDone}</p>
      )}
    </div>
  );
}

/** Running random event and blood-moon warning. */
export function EventChip() {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const d = game.world.director;
  return (
    <div className="flex max-w-[min(17rem,calc(100vw_-_10.5rem))] flex-col items-start gap-1">
      {d.effect && (
        <div className="rounded-lg border border-amber-300/40 bg-amber-950/80 px-2 py-1 text-[11px] font-semibold text-amber-100" role="status">
          {m.eventsUi.active(m.worldEvents[d.effect.id].name, Math.ceil(d.effect.timeLeft))}
          <span className="ml-1 font-normal text-amber-200/80">{m.worldEvents[d.effect.id].desc}</span>
        </div>
      )}
      {d.bloodMoon && (
        <div className="flex items-center gap-1 rounded-lg border border-red-400/50 bg-red-950/85 px-2 py-1 text-[11px] font-semibold text-red-100" role="status">
          <IconMoon className="h-3.5 w-3.5 shrink-0 text-red-400" /> {m.worldEvents.bloodMoon.name} · {m.worldEvents.bloodMoon.desc}
        </div>
      )}
      {d.meteors.length > 0 && (
        <div className="rounded-lg border border-orange-300/40 bg-orange-950/80 px-2 py-1 text-[11px] font-semibold text-orange-100" role="status">
          {m.worldEvents.meteor.name}
        </div>
      )}
    </div>
  );
}

/** Boss health bar while a Leviathan is on the map. */
export function BossBar() {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const bosses = game.world.enemies.filter((e) => e.type === 'leviathan' && !e.dead);
  if (bosses.length === 0) return null;
  const hp = bosses.reduce((s, e) => s + Math.max(0, e.hp), 0);
  const max = bosses.reduce((s, e) => s + e.maxHp, 0);
  const first = bosses[0];
  return (
    <button
      type="button"
      onClick={() => first && game.focus(first.x, first.y)}
      className="pointer-events-auto w-[min(17rem,calc(100vw_-_10.5rem))] rounded-xl border border-rose-500/50 bg-rose-950/85 p-2 text-left shadow-[0_0_20px_rgba(244,63,94,0.35)]"
      aria-label={m.hud.boss(enemyName('leviathan'))}
    >
      <div className="flex items-center gap-1 text-[11px] font-black tracking-wide text-rose-100">
        <IconSkull className="h-4 w-4 text-rose-300" />
        {m.hud.boss(enemyName('leviathan'))}
        {bosses.length > 1 && <span className="text-rose-300">×{bosses.length}</span>}
      </div>
      <div className={cx('mt-1 h-2 w-full overflow-hidden rounded-full bg-rose-950')}>
        <div className="h-full rounded-full bg-linear-to-r from-rose-600 to-orange-400" style={{ width: `${Math.round((hp / Math.max(1, max)) * 100)}%` }} />
      </div>
      <div className="mt-0.5 text-[10px] tabular-nums text-rose-200/80">
        {Math.ceil(hp)} / {Math.round(max)} · {ENEMIES.leviathan.armor} {m.codex.armor}
      </div>
    </button>
  );
}
