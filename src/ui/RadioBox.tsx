import { useGame, useGameVersion, useMsg } from './GameContext';
import { IconRadio, IconX } from './Icons';

/** Mission Control transmissions (story beats, event warnings). Tap to dismiss. */
export function RadioBox() {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const r = game.radio;
  if (!r) return null;
  return (
    <div
      key={r.id}
      className="pointer-events-auto flex max-w-xl items-start gap-2 rounded-xl border border-emerald-400/30 bg-slate-950/90 p-2 text-xs text-emerald-50 shadow-lg shadow-black/50 [animation:radio-in_0.25s_ease-out]"
      role="status"
      aria-live="polite"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
        <IconRadio className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">{m.radio.speaker}</div>
        <p className="leading-snug">{r.text}</p>
      </div>
      <button type="button" onClick={() => game.dismissRadio()} className="flex h-9 w-9 shrink-0 items-center justify-center text-slate-400" aria-label={m.common.close}>
        <IconX className="h-4 w-4" />
      </button>
    </div>
  );
}
