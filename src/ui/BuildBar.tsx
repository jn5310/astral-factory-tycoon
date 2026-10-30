import { useState } from 'react';
import { BUILD_MENU_ORDER, BUILDINGS, CATEGORY_LABEL, type BuildCategory, type BuildingKind } from '../data/buildings';
import { TURRETS } from '../data/turrets';
import { hasResources } from '../systems/placement';
import { isBuildingUnlocked, unlockSource } from '../systems/research';
import { buildingIconUrl } from './buildingIcon';
import { Button, CostList, cx } from './common';
import { useGame, useGameVersion } from './GameContext';
import { IconCopy, IconHand, IconLock, IconRotate, IconTrash, IconX } from './Icons';

const CATEGORIES: readonly BuildCategory[] = ['logistics', 'production', 'power', 'defense', 'science'];
const DIR_LABEL = ['→', '↓', '←', '↑'];

function BuildButton({ kind, active }: { kind: BuildingKind; active: boolean }) {
  const game = useGame();
  const def = BUILDINGS[kind];
  const unlocked = isBuildingUnlocked(game.world, kind);
  const affordable = hasResources(game.world, kind);
  return (
    <button
      type="button"
      onClick={() => {
        game.uiClick();
        if (!unlocked) {
          game.pushToast(`'${unlockSource({ building: kind })?.name ?? '연구'}' 연구가 필요합니다`, 'warning');
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
      aria-label={`${def.name}${unlocked ? (affordable ? '' : ' (자원 부족)') : ' (연구 필요)'}`}
    >
      <img src={buildingIconUrl(kind)} alt="" className="h-9 w-9" draggable={false} />
      <span className="line-clamp-2 text-center">{def.name}</span>
      {!unlocked && <IconLock className="absolute right-1 top-1 h-3.5 w-3.5 text-slate-200" />}
      {unlocked && !affordable && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />}
    </button>
  );
}

function BuildInfo({ kind }: { kind: BuildingKind }) {
  const game = useGame();
  const def = BUILDINGS[kind];
  const tdef = TURRETS[kind];
  return (
    <div className="flex items-start gap-2 px-3 pt-2 text-xs">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <b className="text-sm text-cyan-100">{def.name}</b>
          <span className="text-slate-400">
            {def.size}×{def.size}
          </span>
          {def.power?.use !== undefined && <span className="text-amber-300">소비 {def.power.use}kW</span>}
          {def.power?.gen !== undefined && <span className="text-emerald-300">발전 {def.power.gen}kW</span>}
          {tdef && <span className="text-rose-300">사거리 {tdef.range}</span>}
        </div>
        <p className="mt-0.5 text-slate-400">{def.lineBuild ? `${def.desc} 손가락으로 쭉 드래그하면 연속 설치됩니다.` : def.desc}</p>
        <div className="mt-1">
          <CostList cost={def.cost} have={game.world.inventory} />
        </div>
      </div>
      {def.rotatable && (
        <Button onClick={() => game.build.rotate()} aria-label={`회전 (현재 ${DIR_LABEL[game.build.rotation]})`}>
          <IconRotate />
          <span className="text-base leading-none">{DIR_LABEL[game.build.rotation]}</span>
        </Button>
      )}
      <Button variant="ghost" onClick={() => game.build.setTool({ kind: 'inspect' })} aria-label="건설 취소">
        <IconX />
      </Button>
    </div>
  );
}

function ToolHint({ text }: { text: string }) {
  const game = useGame();
  return (
    <div className="flex items-center gap-2 px-3 pt-2 text-xs text-amber-200">
      <p className="flex-1">{text}</p>
      <Button variant="ghost" onClick={() => game.build.setTool({ kind: 'inspect' })} aria-label="도구 취소">
        <IconX />
      </Button>
    </div>
  );
}

export function BuildBar({ onOpenBlueprints }: { onOpenBlueprints: () => void }) {
  const game = useGame();
  useGameVersion();
  const [cat, setCat] = useState<BuildCategory>('logistics');
  const tool = game.build.tool;
  const kinds = BUILD_MENU_ORDER.filter((k) => BUILDINGS[k].category === cat);
  const activeKind = tool.kind === 'build' ? tool.building : null;
  return (
    <div className="pointer-events-auto border-t border-cyan-400/20 bg-slate-950/92 pb-[env(safe-area-inset-bottom)]">
      {activeKind && <BuildInfo kind={activeKind} />}
      {tool.kind === 'demolish' && <ToolHint text="탭하거나 드래그한 건물을 철거합니다 (비용 50% 환급, 내부 아이템은 코어로)." />}
      {tool.kind === 'blueprintSelect' && <ToolHint text="복사할 공장 영역을 손가락으로 드래그해 선택하세요." />}
      {tool.kind === 'blueprintPaste' && (
        <div className="flex items-center gap-2 px-3 pt-2 text-xs text-cyan-200">
          <p className="flex-1">
            <b>{tool.blueprint.name}</b>: 탭한 위치에 배치 · 한 손가락으로 화면 이동 · 회전 버튼으로 90° 회전
          </p>
          <Button onClick={() => game.build.rotate()} aria-label="청사진 회전">
            <IconRotate />
          </Button>
          <Button variant="ghost" onClick={() => game.build.setTool({ kind: 'inspect' })} aria-label="붙여넣기 취소">
            <IconX />
          </Button>
        </div>
      )}
      <div className="no-scrollbar flex items-center gap-1 overflow-x-auto px-2 pt-1.5">
        <Button
          variant={tool.kind === 'inspect' ? 'active' : 'default'}
          onClick={() => game.build.setTool({ kind: 'inspect' })}
          aria-label="선택/이동 모드"
          aria-pressed={tool.kind === 'inspect'}
        >
          <IconHand />
        </Button>
        <Button
          variant={tool.kind === 'demolish' ? 'danger' : 'default'}
          onClick={() => game.build.setTool(tool.kind === 'demolish' ? { kind: 'inspect' } : { kind: 'demolish' })}
          aria-label="철거 모드"
          aria-pressed={tool.kind === 'demolish'}
        >
          <IconTrash />
        </Button>
        <Button onClick={() => game.build.rotate()} aria-label="회전">
          <IconRotate />
        </Button>
        <Button
          variant={tool.kind === 'blueprintSelect' || tool.kind === 'blueprintPaste' ? 'primary' : 'default'}
          onClick={() => {
            game.uiClick();
            onOpenBlueprints();
          }}
          aria-label="청사진"
        >
          <IconCopy />
        </Button>
        <div className="mx-1 h-7 w-px shrink-0 bg-white/15" />
        {CATEGORIES.map((c) => (
          <Button
            key={c}
            variant={cat === c ? 'primary' : 'ghost'}
            onClick={() => setCat(c)}
            aria-pressed={cat === c}
            className="px-2.5"
          >
            {CATEGORY_LABEL[c]}
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
