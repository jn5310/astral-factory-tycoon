import { useState } from 'react';
import { BUILD_MENU_ORDER, BUILDINGS, type BuildCategory, type BuildingKind } from '../data/buildings';
import { TURRETS } from '../data/turrets';
import { hasResources } from '../systems/placement';
import { isBuildingUnlocked, unlockSource } from '../systems/research';
import { abilityName, buildingDesc, buildingName, researchName } from '../utils/i18n';
import { buildingIconUrl } from './buildingIcon';
import { Button, CostList, cx } from './common';
import { useGame, useGameVersion, useMsg } from './GameContext';
import { IconCopy, IconHand, IconLock, IconRotate, IconTrash, IconX } from './Icons';

const CATEGORIES: readonly BuildCategory[] = ['logistics', 'production', 'power', 'defense', 'science'];
const DIR_LABEL = ['→', '↓', '←', '↑'];

function BuildButton({ kind, active }: { kind: BuildingKind; active: boolean }) {
  const game = useGame();
  const m = useMsg();
  const unlocked = isBuildingUnlocked(game.world, kind);
  const affordable = game.world.settings.mode === 'sandbox' || hasResources(game.world, kind);
  return (
    <button
      type="button"
      onClick={() => {
        game.uiClick();
        if (!unlocked) {
          const source = unlockSource({ building: kind });
          game.pushToast(m.build.needResearch(source ? researchName(source.id) : m.hud.research), 'warning');
          return;
        }
        game.build.toggleBuild(kind);
      }}
      className={cx(
        'relative flex h-[72px] w-[66px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 text-[10px] leading-tight transition active:scale-95',
        active ? 'border-cyan-300 bg-cyan-500/25 shadow-[0_0_12px_rgba(34,211,238,0.35)]' : 'border-white/10 bg-slate-900/85',
        !unlocked && 'opacity-40',
        unlocked && !affordable && !active && 'opacity-70',
      )}
      aria-pressed={active}
      aria-label={m.build.buttonAria(buildingName(kind), unlocked, affordable)}
    >
      <img src={buildingIconUrl(kind)} alt="" className="h-9 w-9" draggable={false} />
      <span className="line-clamp-2 text-center">{buildingName(kind)}</span>
      {!unlocked && <IconLock className="absolute right-1 top-1 h-3.5 w-3.5 text-slate-200" />}
      {unlocked && !affordable && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />}
    </button>
  );
}

function BuildInfo({ kind }: { kind: BuildingKind }) {
  const game = useGame();
  const m = useMsg();
  const def = BUILDINGS[kind];
  const tdef = TURRETS[kind];
  return (
    <div className="flex items-start gap-2 px-3 pt-2 text-xs">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <b className="text-sm text-cyan-100">{buildingName(kind)}</b>
          <span className="text-slate-400">
            {def.size}×{def.size}
          </span>
          {def.power?.use !== undefined && <span className="text-amber-300">{m.build.consumes(def.power.use)}</span>}
          {def.power?.gen !== undefined && <span className="text-emerald-300">{m.build.generates(def.power.gen)}</span>}
          {tdef && <span className="text-rose-300">{m.build.range(tdef.range)}</span>}
        </div>
        <p className="mt-0.5 text-slate-400">{def.lineBuild ? `${buildingDesc(kind)} ${m.build.dragHint}` : buildingDesc(kind)}</p>
        <div className="mt-1">
          <CostList cost={def.cost} have={game.world.settings.mode === 'sandbox' ? undefined : game.world.inventory} />
        </div>
      </div>
      {def.rotatable && (
        <Button onClick={() => game.build.rotate()} aria-label={m.build.rotateDir(DIR_LABEL[game.build.rotation] ?? '→')}>
          <IconRotate />
          <span className="text-base leading-none">{DIR_LABEL[game.build.rotation]}</span>
        </Button>
      )}
      <Button variant="ghost" onClick={() => game.build.setTool({ kind: 'inspect' })} aria-label={m.build.cancelBuild}>
        <IconX />
      </Button>
    </div>
  );
}

function ToolHint({ text, cancelLabel, tone = 'text-amber-200' }: { text: string; cancelLabel: string; tone?: string }) {
  const game = useGame();
  return (
    <div className={cx('flex items-center gap-2 px-3 pt-2 text-xs', tone)}>
      <p className="flex-1">{text}</p>
      <Button variant="ghost" onClick={() => game.build.setTool({ kind: 'inspect' })} aria-label={cancelLabel}>
        <IconX />
      </Button>
    </div>
  );
}

export function BuildBar({ onOpenBlueprints }: { onOpenBlueprints: () => void }) {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const [cat, setCat] = useState<BuildCategory>('logistics');
  const tool = game.build.tool;
  const kinds = BUILD_MENU_ORDER.filter((k) => BUILDINGS[k].category === cat);
  const activeKind = tool.kind === 'build' ? tool.building : null;
  return (
    <div className="pointer-events-auto border-t border-cyan-400/20 bg-slate-950/92 pb-[env(safe-area-inset-bottom)]">
      {activeKind && <BuildInfo kind={activeKind} />}
      {tool.kind === 'demolish' && <ToolHint text={m.build.demolishHint} cancelLabel={m.build.cancelTool} />}
      {tool.kind === 'blueprintSelect' && <ToolHint text={m.build.selectHint} cancelLabel={m.build.cancelTool} />}
      {tool.kind === 'target' && <ToolHint text={m.build.targetHint(abilityName(tool.ability))} cancelLabel={m.build.targetCancel} tone="text-orange-200" />}
      {tool.kind === 'blueprintPaste' && (
        <div className="flex items-center gap-2 px-3 pt-2 text-xs text-cyan-200">
          <p className="flex-1">{m.build.pasteHint(tool.blueprint.name)}</p>
          <Button onClick={() => game.build.rotate()} aria-label={m.build.pasteRotate}>
            <IconRotate />
          </Button>
          <Button variant="ghost" onClick={() => game.build.setTool({ kind: 'inspect' })} aria-label={m.build.pasteCancel}>
            <IconX />
          </Button>
        </div>
      )}
      <div className="no-scrollbar flex items-center gap-1 overflow-x-auto px-2 pt-1.5">
        <Button
          variant={tool.kind === 'inspect' ? 'active' : 'default'}
          onClick={() => game.build.setTool({ kind: 'inspect' })}
          aria-label={m.build.select}
          aria-pressed={tool.kind === 'inspect'}
        >
          <IconHand />
        </Button>
        <Button
          variant={tool.kind === 'demolish' ? 'danger' : 'default'}
          onClick={() => game.build.setTool(tool.kind === 'demolish' ? { kind: 'inspect' } : { kind: 'demolish' })}
          aria-label={m.build.demolish}
          aria-pressed={tool.kind === 'demolish'}
        >
          <IconTrash />
        </Button>
        <Button onClick={() => game.build.rotate()} aria-label={m.build.rotate}>
          <IconRotate />
        </Button>
        <Button
          variant={tool.kind === 'blueprintSelect' || tool.kind === 'blueprintPaste' ? 'primary' : 'default'}
          onClick={() => {
            game.uiClick();
            onOpenBlueprints();
          }}
          aria-label={m.build.blueprints}
        >
          <IconCopy />
        </Button>
        <div className="mx-1 h-7 w-px shrink-0 bg-white/15" />
        {CATEGORIES.map((c) => (
          <Button key={c} variant={cat === c ? 'primary' : 'ghost'} onClick={() => setCat(c)} aria-pressed={cat === c} className="px-2.5">
            {m.categories[c]}
          </Button>
        ))}
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-2 py-1.5">
        {kinds.map((k) => (
          <BuildButton key={k} kind={k} active={activeKind === k} />
        ))}
      </div>
    </div>
  );
}
