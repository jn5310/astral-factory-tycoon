import { useMemo, useState } from 'react';
import { LAUNCH_DURATION } from '../data/constants';
import type { ToastLevel } from '../core/events';
import { getStorage, loadFromStorage } from '../core/save';
import { continueAfterVictory } from '../systems/silo';
import { clock, integer } from '../utils/format';
import { shareScreenshot } from '../utils/share';
import { Button, cx, Modal } from './common';
import { useGame, useGameVersion, useMsg } from './GameContext';
import { IconShare } from './Icons';

const TOAST_STYLE: Record<ToastLevel, string> = {
  info: 'border-cyan-400/40 bg-slate-900/95 text-cyan-50',
  success: 'border-emerald-400/50 bg-emerald-950/95 text-emerald-50',
  warning: 'border-amber-400/50 bg-amber-950/95 text-amber-50',
  danger: 'border-red-400/60 bg-red-950/95 text-red-50',
};

export function Toasts() {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1 z-30 flex flex-col items-center gap-1 px-2" aria-live="polite">
      {game.toasts.map((t) => (
        <div key={t.id} className={cx('flex max-w-md items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-lg', TOAST_STYLE[t.level])}>
          <span className="text-center">{t.message}</span>
          {t.focus && (
            <button
              type="button"
              className="pointer-events-auto min-h-9 shrink-0 rounded-md bg-white/15 px-2 font-bold"
              onClick={() => t.focus && game.focus(t.focus.x, t.focus.y)}
            >
              {m.common.view}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function LaunchBanner() {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const l = game.world.launch;
  if (!l.active || game.world.state !== 'playing') return null;
  const left = Math.max(0, LAUNCH_DURATION - l.timer);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center">
      <div className="rounded-xl border border-rose-300/60 bg-rose-950/80 px-4 py-2 text-center font-black tracking-wide text-rose-50 shadow-[0_0_30px_rgba(244,63,94,0.5)]">
        {m.toast.launch} T-{left.toFixed(1)}
      </div>
    </div>
  );
}

function Starfield() {
  const stars = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 12) * 0.35}s`,
        duration: `${3 + (i % 5)}s`,
        size: 2 + (i % 3),
        color: ['#fde68a', '#67e8f9', '#f9a8d4', '#ffffff'][i % 4] ?? '#ffffff',
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute bottom-0 rounded-full"
          style={{ left: s.left, width: s.size, height: s.size, background: s.color, animation: `rise ${s.duration} linear ${s.delay} infinite` }}
        />
      ))}
    </div>
  );
}

function ScoreTable() {
  const game = useGame();
  const m = useMsg();
  const r = game.result;
  if (!r) return null;
  const s = r.score;
  const rows: [string, number][] = [
    [m.score.kills, s.kills],
    [m.score.nights, s.nights],
    [m.score.research, s.research],
    [m.score.production, s.production],
    [m.score.missions, s.missions],
    [m.score.victory, s.victory],
    [m.score.speed, s.speed],
  ];
  return (
    <div className="mx-auto mt-3 max-w-xs rounded-xl bg-black/30 p-3 text-sm">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-bold text-cyan-100">{m.score.title}</span>
        {r.rank === 0 && <span className="animate-pulse text-xs font-black text-amber-300">{m.end.newRecord}</span>}
      </div>
      <dl className="grid grid-cols-2 gap-y-0.5 text-xs">
        {rows
          .filter(([, v]) => v > 0)
          .map(([label, v]) => (
            <div key={label} className="contents">
              <dt className="text-slate-400">{label}</dt>
              <dd className="text-right tabular-nums">{integer(v)}</dd>
            </div>
          ))}
        <dt className="text-slate-400">{m.score.multiplier(m.difficulties[game.world.settings.difficulty].name)}</dt>
        <dd className="text-right tabular-nums">×{s.multiplier}</dd>
      </dl>
      <div className="mt-2 flex items-baseline justify-between border-t border-white/10 pt-2">
        <span className="font-bold">{m.score.total}</span>
        <span className="text-2xl font-black tabular-nums text-amber-200">{integer(s.total)}</span>
      </div>
    </div>
  );
}

/** Victory (rocket escaped) or defeat (core destroyed) screen with score and sharing. */
export function EndScreen() {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const [shareState, setShareState] = useState('');
  const w = game.world;
  if (w.state === 'playing' || game.screen !== 'playing') return null;
  const victory = w.state === 'victory';
  const reload = (): void => {
    const s = getStorage();
    const saved = s ? loadFromStorage(s) : null;
    if (saved && saved.state === 'playing') game.loadWorld(saved);
    else game.quitToTitle();
  };
  const share = async (): Promise<void> => {
    const source = game.snapshotSource();
    if (!source) return;
    const total = integer(game.result?.score.total ?? 0);
    const outcome = await shareScreenshot(
      source,
      m.meta.title,
      [victory ? m.end.victory : m.end.defeat, `${m.end.days} ${w.day} · ${m.end.kills} ${w.kills} · ${m.score.total} ${total}`],
      m.share.text(total, w.day, victory),
    );
    setShareState(outcome === 'shared' ? m.share.shared : outcome === 'downloaded' ? m.share.downloaded : m.share.failed);
  };
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4" role="dialog" aria-modal="true">
      <div
        className={cx(
          'relative w-full max-w-md overflow-hidden rounded-2xl border p-6 text-center shadow-2xl',
          victory ? 'border-amber-300/60 bg-linear-to-b from-indigo-950 to-slate-950' : 'border-red-500/50 bg-linear-to-b from-red-950 to-slate-950',
        )}
      >
        {victory && <Starfield />}
        <div className="relative">
          <h2 className={cx('text-3xl font-black', victory ? 'text-amber-200' : 'text-red-300')}>{victory ? m.end.victory : m.end.defeat}</h2>
          <p className="mt-2 text-sm text-slate-300">{victory ? m.end.victoryDesc : m.end.defeatDesc}</p>
          <dl className="mx-auto mt-4 grid max-w-xs grid-cols-2 gap-1 text-sm">
            <dt className="text-slate-400">{m.end.playTime}</dt>
            <dd className="text-right">{clock(w.time)}</dd>
            <dt className="text-slate-400">{m.end.days}</dt>
            <dd className="text-right">{w.day}</dd>
            <dt className="text-slate-400">{m.end.nights}</dt>
            <dd className="text-right">{w.counters.nightsSurvived}</dd>
            <dt className="text-slate-400">{m.end.kills}</dt>
            <dd className="text-right">{w.kills}</dd>
            <dt className="text-slate-400">{m.end.research}</dt>
            <dd className="text-right">{w.research.completed.size}/35</dd>
          </dl>
          <ScoreTable />
          <div className="mt-5 flex flex-col gap-2">
            <Button onClick={() => void share()}>
              <IconShare /> {m.share.button}
            </Button>
            {shareState && <p className="text-xs text-emerald-300">{shareState}</p>}
            {victory ? (
              <Button
                variant="primary"
                onClick={() => {
                  continueAfterVictory(w);
                  game.dismissResult();
                }}
              >
                {m.end.keepPlaying}
              </Button>
            ) : (
              <Button variant="primary" onClick={reload}>
                {m.end.loadLast}
              </Button>
            )}
            <Button onClick={() => game.quitToTitle()}>{m.end.toTitle}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HelpOverlay({ onClose }: { onClose: () => void }) {
  const m = useMsg();
  const h = m.help;
  return (
    <Modal title={h.title} onClose={onClose}>
      <div className="space-y-3 text-sm leading-relaxed text-slate-200">
        <section>
          <h3 className="font-bold text-cyan-200">{h.goalTitle}</h3>
          <p>{h.goal}</p>
        </section>
        <section>
          <h3 className="font-bold text-cyan-200">{h.controlsTitle}</h3>
          <ul className="list-disc space-y-1 pl-5">
            {h.controls.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="font-bold text-cyan-200">{h.tipsTitle}</h3>
          <ul className="list-disc space-y-1 pl-5">
            {h.tips.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
