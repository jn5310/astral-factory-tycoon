import { useState } from 'react';
import { APP_VERSION } from '../core/Game';
import { getStorage, hasSave } from '../core/save';
import { DIFFICULTIES, type Difficulty } from '../data/difficulty';
import { dailyKey, dailyMutator } from '../utils/daily';
import { integer } from '../utils/format';
import { getLang, LANGS, messagesFor } from '../utils/i18n';
import { randomSeed } from '../utils/rng';
import { Button, cx, Modal, Segmented } from './common';
import { useGame, useGameVersion, useMsg } from './GameContext';
import { IconBook, IconCalendar, IconHelp, IconPlay, IconSettings, IconTrophy } from './Icons';
import type { Overlay } from './TopBar';

function Emblem() {
  return (
    <svg viewBox="0 0 64 64" className="h-20 w-20 drop-shadow-[0_0_18px_rgba(34,211,238,0.55)]" aria-hidden="true">
      <path d="M32 4 56 18v28L32 60 8 46V18z" fill="#05070f" stroke="#22d3ee" strokeWidth="3" />
      <path d="M32 14c6 5 9 12 9 20l-4 9h-10l-4-9c0-8 3-15 9-20z" fill="#e2e8f0" />
      <circle cx="32" cy="29" r="3.5" fill="#38bdf8" />
      <path d="M27 43l-4 7M37 43l4 7" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      <path d="M29 44h6l-3 9z" fill="#f59e0b" />
    </svg>
  );
}

function NewGameSetup({ onClose }: { onClose: () => void }) {
  const game = useGame();
  const m = useMsg();
  const s = m.setup;
  const [mode, setMode] = useState<'standard' | 'sandbox'>('standard');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [seed, setSeed] = useState(() => String(randomSeed()));
  const existing = hasSave(getStorage());
  const start = (): void => {
    const parsed = Number.parseInt(seed, 10);
    game.startNewGame({ mode, difficulty: mode === 'sandbox' ? 'peaceful' : difficulty, seed: Number.isFinite(parsed) ? Math.abs(parsed) % 2147483647 : undefined });
    onClose();
  };
  return (
    <Modal title={s.title} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <section>
          <div className="mb-1 font-bold text-cyan-100">{s.mode}</div>
          <Segmented
            label={s.mode}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'standard', label: m.modes.standard.name },
              { value: 'sandbox', label: m.modes.sandbox.name },
            ]}
          />
          <p className="mt-1 text-xs text-slate-400">{m.modes[mode].desc}</p>
        </section>
        {mode === 'standard' && (
          <section>
            <div className="mb-1 font-bold text-cyan-100">{s.difficulty}</div>
            <Segmented label={s.difficulty} value={difficulty} onChange={setDifficulty} options={DIFFICULTIES.map((d) => ({ value: d, label: m.difficulties[d].name }))} />
            <p className="mt-1 text-xs text-slate-400">{m.difficulties[difficulty].desc}</p>
          </section>
        )}
        <label className="flex items-center gap-2 text-xs">
          <span className="font-bold text-cyan-100">{s.seed}</span>
          <input
            value={seed}
            onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
            inputMode="numeric"
            className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm"
            aria-label={s.seed}
          />
          <Button onClick={() => setSeed(String(randomSeed()))}>{s.random}</Button>
        </label>
        {existing && <p className="rounded-lg bg-amber-950/50 p-2 text-xs text-amber-200">{s.discardWarn}</p>}
        <Button variant="primary" className="w-full text-base" onClick={start}>
          <IconPlay /> {s.start}
        </Button>
      </div>
    </Modal>
  );
}

/** Start screen over the live colony: continue, new game, daily challenge, meta screens. */
export function TitleScreen({ onOpen }: { onOpen: (o: Overlay) => void }) {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const [setup, setSetup] = useState(false);
  const canContinue = hasSave(getStorage()) && game.world.state === 'playing';
  const today = dailyKey(new Date());
  const twist = dailyMutator(today);
  const best = game.profile.dailyBest[today];
  const top = game.profile.highScores.slice(0, 5);
  const open = (o: Overlay): void => {
    game.uiClick();
    onOpen(o);
  };
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 overflow-y-auto bg-linear-to-b from-slate-950/70 via-slate-950/40 to-slate-950/90">
      <div className="absolute right-2 top-[max(env(safe-area-inset-top),0.5rem)] flex gap-1">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => game.setLanguage(l)}
            className={cx(
              'min-h-11 rounded-lg border px-3 text-xs font-bold',
              getLang() === l ? 'border-cyan-300 bg-cyan-500/25 text-cyan-50' : 'border-white/10 bg-slate-900/80 text-slate-300',
            )}
            aria-pressed={getLang() === l}
          >
            {messagesFor(l).langName}
          </button>
        ))}
      </div>
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-5 px-5 py-16 text-center">
        <Emblem />
        <div>
          <h1 className="bg-linear-to-r from-cyan-200 via-sky-300 to-amber-200 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
            ASTRAL FACTORY
          </h1>
          <div className="text-sm font-black tracking-[0.5em] text-amber-300">TYCOON</div>
          <p className="mt-2 text-sm text-slate-300">{m.meta.tagline}</p>
        </div>
        <div className="flex w-full flex-col gap-2">
          {canContinue && (
            <Button variant="primary" className="h-14 w-full text-base" onClick={() => game.continueGame()}>
              <IconPlay /> {m.title.continue}
              <span className="text-xs font-normal text-cyan-100/80">{m.title.continueInfo(game.world.day, m.modes[game.world.settings.mode].name)}</span>
            </Button>
          )}
          <Button variant={canContinue ? 'default' : 'primary'} className="h-12 w-full text-base" onClick={() => setSetup(true)}>
            {m.title.newGame}
          </Button>
          <button
            type="button"
            onClick={() => game.startNewGame({ mode: 'daily', difficulty: 'normal' })}
            className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-amber-300/40 bg-amber-950/50 px-3 py-2 text-left transition active:scale-[0.98]"
          >
            <IconCalendar className="h-6 w-6 shrink-0 text-amber-300" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-amber-100">{m.setup.daily(today)}</span>
              <span className="block text-xs text-amber-200/80">
                {m.setup.mutator}: {m.mutators[twist].name} · {m.mutators[twist].desc}
              </span>
              <span className="block text-[11px] text-slate-400">{best !== undefined ? m.setup.dailyBest(integer(best)) : m.setup.dailyNone}</span>
            </span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => open('achievements')}>
              <IconTrophy /> {m.menu.achievements}
            </Button>
            <Button onClick={() => open('codex')}>
              <IconBook /> {m.menu.codex}
            </Button>
            <Button onClick={() => open('settings')}>
              <IconSettings /> {m.menu.settings}
            </Button>
            <Button onClick={() => open('help')}>
              <IconHelp /> {m.menu.help}
            </Button>
          </div>
        </div>
        <section className="w-full rounded-xl border border-white/10 bg-slate-950/70 p-3 text-left text-xs">
          <div className="mb-1 font-bold text-cyan-100">{m.score.highScores}</div>
          {top.length === 0 ? (
            <p className="text-slate-500">{m.score.none}</p>
          ) : (
            <ol className="space-y-0.5">
              {top.map((h, i) => (
                <li key={`${h.date}-${h.score}-${i}`} className="flex items-center gap-2">
                  <span className="w-4 text-slate-500">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-300">
                    {m.score.entry(m.modes[h.mode].name, m.difficulties[h.difficulty].name, h.day, h.victory)}
                  </span>
                  <span className="font-bold tabular-nums text-amber-200">{integer(h.score)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <p className="text-[11px] text-slate-500">
          {m.title.version(APP_VERSION)} · {m.title.footer}
        </p>
      </div>
      {setup && <NewGameSetup onClose={() => setSetup(false)} />}
    </div>
  );
}
