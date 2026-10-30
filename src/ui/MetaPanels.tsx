import { ACHIEVEMENT_IDS, ACHIEVEMENT_TARGET } from '../data/achievements';
import { ENEMIES, ENEMY_TYPES } from '../data/enemies';
import { achievementProgress } from '../systems/achievements';
import { compact } from '../utils/format';
import { getLang } from '../utils/i18n';
import { cx, ItemIcon, Modal, ProgressBar } from './common';
import { enemyIconUrl } from './enemyIcon';
import { useGame, useGameVersion, useMsg } from './GameContext';
import { IconLock, IconTrophy } from './Icons';

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString(getLang() === 'ko' ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

export function AchievementsPanel({ onClose }: { onClose: () => void }) {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const unlocked = game.profile.achievements;
  const count = ACHIEVEMENT_IDS.filter((id) => unlocked[id]).length;
  const inRun = game.screen === 'playing' && game.world.settings.mode !== 'sandbox';
  return (
    <Modal title={`${m.achievementsUi.title} · ${m.achievementsUi.count(count, ACHIEVEMENT_IDS.length)}`} onClose={onClose}>
      <ProgressBar value={count / ACHIEVEMENT_IDS.length} color="bg-amber-400" />
      <p className="mt-2 text-xs text-slate-400">{m.achievementsUi.sandboxNote}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {ACHIEVEMENT_IDS.map((id) => {
          const at = unlocked[id];
          const target = ACHIEVEMENT_TARGET[id];
          const progress = inRun && target && id !== 'speedrun' ? achievementProgress(game.world, id) : 0;
          return (
            <li
              key={id}
              className={cx(
                'flex items-start gap-2 rounded-xl border p-2',
                at ? 'border-amber-300/50 bg-amber-950/40' : 'border-white/10 bg-slate-900/70',
              )}
            >
              <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', at ? 'bg-amber-400/25 text-amber-300' : 'bg-slate-800 text-slate-500')}>
                {at ? <IconTrophy className="h-5 w-5" /> : <IconLock className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className={cx('text-sm font-bold', at ? 'text-amber-100' : 'text-slate-200')}>{m.achievements[id].name}</div>
                <div className="text-xs text-slate-400">{m.achievements[id].desc}</div>
                {at ? (
                  <div className="mt-0.5 text-[10px] text-amber-300/80">{m.achievementsUi.unlockedOn(formatDate(at))}</div>
                ) : (
                  target !== undefined &&
                  progress > 0 && (
                    <div className="mt-1 flex items-center gap-2">
                      <ProgressBar value={progress / target} color="bg-cyan-400" className="h-1.5" />
                      <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                        {compact(Math.min(progress, target))}/{compact(target)}
                      </span>
                    </div>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

export function CodexPanel({ onClose }: { onClose: () => void }) {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const c = m.codex;
  const seen = new Set(game.profile.seenEnemies);
  return (
    <Modal title={`${c.title} · ${c.count(seen.size, ENEMY_TYPES.length)}`} onClose={onClose} wide>
      <ul className="grid gap-2 sm:grid-cols-2">
        {ENEMY_TYPES.map((type) => {
          const def = ENEMIES[type];
          const known = seen.has(type);
          return (
            <li key={type} className={cx('flex gap-3 rounded-xl border p-2', known ? 'border-rose-400/30 bg-slate-900/80' : 'border-white/10 bg-slate-900/50')}>
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-950">
                <img
                  src={enemyIconUrl(type)}
                  alt=""
                  className={cx('h-20 w-20', !known && 'opacity-60 brightness-0')}
                  draggable={false}
                />
              </div>
              <div className="min-w-0 flex-1 text-xs">
                <div className="text-sm font-bold text-rose-100">{known ? m.enemies[type].name : c.unknown}</div>
                <p className="text-slate-400">{known ? m.enemies[type].desc : c.unknownHint}</p>
                {known && (
                  <dl className="mt-1 grid grid-cols-3 gap-x-2 text-[11px]">
                    <dt className="text-slate-500">{c.hp}</dt>
                    <dt className="text-slate-500">{c.armor}</dt>
                    <dt className="text-slate-500">{c.speed}</dt>
                    <dd>{def.hp}</dd>
                    <dd>{def.armor}</dd>
                    <dd>{def.speed}</dd>
                    <dt className="text-slate-500">{c.damage}</dt>
                    <dt className="text-slate-500">{c.range}</dt>
                    <dt className="text-slate-500">{def.flying ? c.flying : c.ground}</dt>
                    <dd>{def.damage}</dd>
                    <dd>{def.range || '-'}</dd>
                    <dd>{c.firstNight(def.firstNight)}</dd>
                  </dl>
                )}
                {known && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                    {c.salvage}:
                    {def.salvage.map((s) => (
                      <span key={s.item} className="inline-flex items-center gap-0.5 text-slate-200">
                        <ItemIcon item={s.item} size={14} />
                        {s.amount}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
