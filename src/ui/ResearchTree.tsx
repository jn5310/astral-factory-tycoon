import { useState } from 'react';
import { BUILDINGS } from '../data/buildings';
import { ITEMS } from '../data/items';
import { RECIPES } from '../data/recipes';
import { RESEARCH, RESEARCH_BY_ID, type ModifierKey, type ResearchDef } from '../data/research';
import { invGet } from '../systems/inventory';
import { nodeStatus, researchFraction, setCurrentResearch, type NodeStatus } from '../systems/research';
import { percent } from '../utils/format';
import { buildingIconUrl } from './buildingIcon';
import { Button, cx, ItemIcon, Modal, ProgressBar } from './common';
import { useGame, useGameVersion } from './GameContext';

const COL_W = 188;
const ROW_H = 86;
const NODE_W = 164;
const NODE_H = 68;
const PAD = 12;
const HEAD = 30;

const EFFECT_LABEL: Record<ModifierKey, string> = {
  drillSpeed: '드릴 속도',
  ammoDamage: '실탄 포탑 피해',
  laserDamage: '레이저 피해',
  buildingHp: '건물 내구도',
  generatorOutput: '발전량',
};

const STATUS_STYLE: Record<NodeStatus, string> = {
  completed: 'border-emerald-400/70 bg-emerald-900/50 text-emerald-50',
  current: 'border-amber-300 bg-amber-900/50 text-amber-50 shadow-[0_0_14px_rgba(251,191,36,0.35)]',
  available: 'border-cyan-400/60 bg-slate-900 text-cyan-50',
  locked: 'border-white/10 bg-slate-900/60 text-slate-500',
};

const STATUS_LABEL: Record<NodeStatus, string> = {
  completed: '완료',
  current: '연구 중',
  available: '연구 가능',
  locked: '잠김',
};

function nodePos(n: ResearchDef): { x: number; y: number } {
  return { x: PAD + (n.tier - 1) * COL_W, y: PAD + HEAD + n.row * ROW_H };
}

function NodeDetail({ id }: { id: string }) {
  const game = useGame();
  const w = game.world;
  const def = RESEARCH_BY_ID.get(id);
  if (!def) return null;
  const status = nodeStatus(w, id);
  const prog = w.research.progress[id] ?? {};
  const missing = def.prereqs.filter((p) => !w.research.completed.has(p)).map((p) => RESEARCH_BY_ID.get(p)?.name ?? p);
  return (
    <div className="max-h-[38dvh] overflow-y-auto border-t border-white/10 bg-slate-950 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-cyan-100">{def.name}</b>
        <span className="rounded bg-slate-800 px-1.5 text-[11px] text-slate-300">티어 {def.tier}</span>
        <span className="text-[11px] text-slate-400">{STATUS_LABEL[status]}</span>
      </div>
      <p className="mt-1 text-xs text-slate-300">{def.desc}</p>
      <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
        {def.cost.map((c) => {
          const have = status === 'completed' ? c.amount : Math.min(c.amount, invGet(prog, c.item));
          return (
            <div key={c.item} className="rounded-md bg-slate-900 p-1.5 text-xs">
              <div className="flex items-center gap-1">
                <ItemIcon item={c.item} size={18} />
                <span className="truncate">{ITEMS[c.item].name}</span>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <ProgressBar value={have / c.amount} color="bg-indigo-400" className="h-1.5" />
                <span className="shrink-0 tabular-nums text-slate-300">
                  {have}/{c.amount}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-slate-400">해금:</span>
        {def.buildings.map((k) => (
          <span key={k} className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-1.5 py-0.5">
            <img src={buildingIconUrl(k)} alt="" className="h-5 w-5" />
            {BUILDINGS[k].name}
          </span>
        ))}
        {def.recipes.map((r) => (
          <span key={r} className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-1.5 py-0.5">
            <ItemIcon item={RECIPES[r].outputs[0]?.item ?? 'coal'} size={18} />
            {RECIPES[r].name}
          </span>
        ))}
        {def.effects.map((e) => (
          <span key={e.key} className="rounded-md bg-emerald-950/70 px-1.5 py-0.5 text-emerald-200">
            {EFFECT_LABEL[e.key]} +{Math.round(e.value * 100)}%
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {status === 'available' && (
          <Button
            variant="primary"
            onClick={() => {
              game.uiClick('research');
              setCurrentResearch(w, id);
              game.notify();
            }}
          >
            연구 시작
          </Button>
        )}
        {status === 'current' && (
          <>
            <Button
              onClick={() => {
                setCurrentResearch(w, null);
                game.notify();
              }}
            >
              연구 중단 (진행도 유지)
            </Button>
            <span className="text-xs text-amber-200">전력이 연결된 연구소에 위 아이템을 벨트·투입기로 넣으세요.</span>
          </>
        )}
        {status === 'locked' && <span className="text-xs text-slate-400">선행 연구 필요: {missing.join(', ')}</span>}
        {status === 'completed' && <span className="text-xs text-emerald-300">연구 완료</span>}
      </div>
    </div>
  );
}

/** Visual 5-tier, 35-node tech tree with prerequisite links. */
export function ResearchTree({ onClose }: { onClose: () => void }) {
  const game = useGame();
  useGameVersion();
  const w = game.world;
  const [selected, setSelected] = useState<string>(w.research.current ?? RESEARCH[0]?.id ?? '');
  const width = PAD * 2 + 4 * COL_W + NODE_W;
  const height = PAD * 2 + HEAD + 6 * ROW_H + NODE_H;
  const current = w.research.current ? RESEARCH_BY_ID.get(w.research.current) : undefined;
  return (
    <Modal title={`연구 트리 · 완료 ${w.research.completed.size}/35`} onClose={onClose} wide footer={<NodeDetail id={selected} />}>
      <div className="mb-2 rounded-lg bg-slate-900/80 p-2 text-xs">
        {current ? (
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-amber-200">연구 중: {current.name}</span>
            <ProgressBar value={researchFraction(w, current.id)} color="bg-amber-400" />
            <span className="shrink-0 tabular-nums">{percent(researchFraction(w, current.id))}</span>
          </div>
        ) : (
          <span className="text-slate-300">연구할 노드를 선택하세요. 연구소(전력 필요)에 아이템을 넣으면 진행됩니다.</span>
        )}
      </div>
      <div className="overflow-auto overscroll-contain rounded-lg border border-white/5 bg-slate-950">
        <div className="relative" style={{ width, height }}>
          {[1, 2, 3, 4, 5].map((t) => (
            <div key={t} className="absolute text-xs font-bold text-slate-400" style={{ left: PAD + (t - 1) * COL_W, top: PAD }}>
              티어 {t}
            </div>
          ))}
          <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden="true">
            {RESEARCH.flatMap((n) =>
              n.prereqs.map((pid) => {
                const pre = RESEARCH_BY_ID.get(pid);
                if (!pre) return null;
                const a = nodePos(pre);
                const b = nodePos(n);
                const done = w.research.completed.has(pid);
                const d =
                  pre.tier === n.tier
                    ? `M${a.x + NODE_W / 2},${a.y + NODE_H} L${b.x + NODE_W / 2},${b.y}`
                    : `M${a.x + NODE_W},${a.y + NODE_H / 2} C${a.x + NODE_W + 14},${a.y + NODE_H / 2} ${b.x - 14},${b.y + NODE_H / 2} ${b.x},${b.y + NODE_H / 2}`;
                return <path key={`${pid}-${n.id}`} d={d} fill="none" stroke={done ? '#34d399' : '#334155'} strokeWidth={done ? 2 : 1.5} opacity={0.85} />;
              }),
            )}
          </svg>
          {RESEARCH.map((n) => {
            const p = nodePos(n);
            const status = nodeStatus(w, n.id);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  game.uiClick();
                  setSelected(n.id);
                }}
                className={cx(
                  'absolute flex flex-col justify-between rounded-xl border p-1.5 text-left text-[11px] leading-tight transition',
                  STATUS_STYLE[status],
                  selected === n.id && 'ring-2 ring-white/80',
                )}
                style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
                aria-label={`${n.name}: ${STATUS_LABEL[status]}`}
              >
                <span className="line-clamp-1 font-bold">{n.name}</span>
                <span className="flex items-center gap-0.5">
                  {n.buildings.slice(0, 2).map((k) => (
                    <img key={k} src={buildingIconUrl(k)} alt="" className="h-5 w-5" />
                  ))}
                  {n.recipes.slice(0, 3).map((r) => (
                    <ItemIcon key={r} item={RECIPES[r].outputs[0]?.item ?? 'coal'} size={16} />
                  ))}
                  <span className="ml-auto flex gap-0.5 opacity-80">
                    {n.cost.map((c) => (
                      <ItemIcon key={c.item} item={c.item} size={12} />
                    ))}
                  </span>
                </span>
                {status === 'current' ? (
                  <ProgressBar value={researchFraction(w, n.id)} color="bg-amber-300" className="h-1" />
                ) : (
                  <span className="text-[10px] opacity-70">{STATUS_LABEL[status]}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
