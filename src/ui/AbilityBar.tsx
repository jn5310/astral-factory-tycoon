import type { ReactNode } from 'react';
import { ABILITIES, ABILITY_IDS, type AbilityId } from '../data/abilities';
import { activateAbility, canUseAbility, isAbilityUnlocked } from '../systems/abilities';
import { abilityName } from '../utils/i18n';
import { cx } from './common';
import { useGame, useGameVersion, useMsg } from './GameContext';
import { IconGauge, IconLock, IconSatellite, IconSnowflake, IconWrench } from './Icons';

const ICON: Record<AbilityId, (p: { className?: string }) => ReactNode> = {
  orbital: IconSatellite,
  repair: IconWrench,
  overclock: IconGauge,
  cryo: IconSnowflake,
};

/** Commander powers with a radial cooldown sweep (bottom-left of the map). */
export function AbilityBar() {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const w = game.world;
  if (w.abilities.unlocked.length === 0) return null;
  return (
    <div className="pointer-events-auto flex gap-1.5" role="toolbar" aria-label={m.abilityUi.bar}>
      {ABILITY_IDS.map((id) => {
        const def = ABILITIES[id];
        const unlocked = isAbilityUnlocked(w, id);
        const cd = w.abilities.cooldown[id];
        const ready = canUseAbility(w, id);
        const targeting = game.build.tool.kind === 'target' && game.build.tool.ability === id;
        const active = id === 'overclock' && w.abilities.overclock > 0;
        const frac = unlocked ? 1 - cd / def.cooldown : 0;
        const Icon = ICON[id];
        const label = `${abilityName(id)}: ${!unlocked ? m.abilityUi.locked : ready ? m.abilityUi.ready : m.abilityUi.cooldown(Math.ceil(cd))}`;
        return (
          <button
            key={id}
            type="button"
            disabled={!unlocked}
            aria-label={label}
            title={unlocked ? `${abilityName(id)} · ${m.abilities[id].desc}` : m.abilityUi.lockedHint}
            onClick={() => {
              game.uiClick();
              if (!ready) {
                game.pushToast(m.toast.abilityCooldown(abilityName(id), Math.ceil(cd)), 'warning');
                return;
              }
              if (def.targeted) game.build.setTool(targeting ? { kind: 'inspect' } : { kind: 'target', ability: id });
              else activateAbility(w, id);
              game.notify();
            }}
            className={cx(
              'relative flex h-13 w-13 items-center justify-center rounded-full border-2 transition active:scale-90 disabled:opacity-35',
              targeting ? 'border-white' : ready ? 'border-white/40' : 'border-white/10',
              ready && !targeting && 'shadow-[0_0_14px_var(--glow)]',
            )}
            style={{
              background: unlocked
                ? `conic-gradient(${def.color}cc ${frac * 360}deg, rgba(15,23,42,0.92) 0deg)`
                : 'rgba(15,23,42,0.92)',
              ['--glow' as string]: `${def.color}88`,
            }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/90">
              {unlocked ? <Icon className={cx('h-5 w-5', ready ? 'text-white' : 'text-slate-400')} /> : <IconLock className="h-4 w-4 text-slate-400" />}
            </span>
            {unlocked && !ready && (
              <span className="absolute -bottom-1 rounded bg-slate-950/95 px-1 text-[10px] font-bold tabular-nums text-slate-200">{Math.ceil(cd)}</span>
            )}
            {active && (
              <span className="absolute -top-1 rounded bg-yellow-400 px-1 text-[10px] font-bold text-slate-950">{Math.ceil(w.abilities.overclock)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
