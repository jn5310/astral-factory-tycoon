import type { ReactNode } from 'react';
import type { Building } from '../entities/Building';
import { BUILDINGS, isCrafterKind } from '../data/buildings';
import { BELT_SPACING, LAB_TIME_PER_ITEM, ROCKET_PARTS_REQUIRED } from '../data/constants';
import { ITEM_IDS, ITEMS, type ItemId } from '../data/items';
import { RECIPES, recipesFor } from '../data/recipes';
import { RESEARCH_BY_ID } from '../data/research';
import { TURRETS } from '../data/turrets';
import { beltSpeedOf } from '../systems/belts';
import { invEntries, invGet, invTotal } from '../systems/inventory';
import { drillTime } from '../systems/production';
import { isRecipeUnlocked, researchFraction, unlockSource } from '../systems/research';
import { compact, energy, percent, power } from '../utils/format';
import { buildingIconUrl } from './buildingIcon';
import { Button, cx, ItemIcon, ProgressBar } from './common';
import { useGame, useGameVersion } from './GameContext';
import { IconRotate, IconTrash, IconX } from './Icons';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="text-right text-slate-100">{children}</span>
    </div>
  );
}

function Contents({ items, empty = '비어 있음' }: { items: Partial<Record<ItemId, number>>; empty?: string }) {
  const list = invEntries(items);
  if (list.length === 0) return <p className="text-xs text-slate-500">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1">
      {list.map(([id, n]) => (
        <span key={id} className="inline-flex items-center gap-1 rounded-md bg-slate-800/90 px-1.5 py-0.5 text-xs">
          <ItemIcon item={id} size={16} />
          {compact(n)}
        </span>
      ))}
    </div>
  );
}

/** Item filter picker for sorters and inserters ("없음" clears the filter). */
function FilterPicker({ value, onPick }: { value: ItemId | null; onPick: (id: ItemId | null) => void }) {
  return (
    <div className="mt-1">
      <div className="mb-1 text-xs text-slate-400">필터 아이템: {value ? ITEMS[value].name : '없음'}</div>
      <div className="grid grid-cols-8 gap-1">
        <button
          type="button"
          onClick={() => onPick(null)}
          className={cx('flex h-11 items-center justify-center rounded-lg border text-[10px]', value === null ? 'border-amber-300 bg-amber-500/20' : 'border-white/10 bg-slate-900')}
          aria-pressed={value === null}
        >
          없음
        </button>
        {ITEM_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className={cx('flex h-11 items-center justify-center rounded-lg border', value === id ? 'border-amber-300 bg-amber-500/20' : 'border-white/10 bg-slate-900')}
            aria-pressed={value === id}
            aria-label={ITEMS[id].name}
          >
            <ItemIcon item={id} size={24} />
          </button>
        ))}
      </div>
    </div>
  );
}

function CrafterDetails({ b }: { b: Building }) {
  const game = useGame();
  const c = b.crafter;
  if (!c || !isCrafterKind(b.kind)) return null;
  const rec = c.recipe ? RECIPES[c.recipe] : null;
  const speed = b.satisfaction;
  return (
    <div className="mt-2 space-y-2">
      {rec ? (
        <div className="rounded-lg bg-slate-900/80 p-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {rec.inputs.map((s) => (
              <span key={s.item} className={cx('inline-flex items-center gap-1 rounded px-1 py-0.5', invGet(c.input, s.item) >= s.amount ? 'bg-slate-800' : 'bg-red-950/70 text-red-200')}>
                <ItemIcon item={s.item} size={18} />
                {invGet(c.input, s.item)}/{s.amount}
              </span>
            ))}
            <span className="text-slate-400">→ {rec.time}초 →</span>
            {rec.outputs.map((s) => (
              <span key={s.item} className="inline-flex items-center gap-1 rounded bg-emerald-950/60 px-1 py-0.5">
                <ItemIcon item={s.item} size={18} />×{s.amount}
                <span className="text-slate-400">(보관 {invGet(c.output, s.item)})</span>
              </span>
            ))}
          </div>
          <ProgressBar value={c.crafting ? c.progress / rec.time : 0} color="bg-amber-400" className="mt-2" />
          <p className="mt-1 text-[11px] text-slate-400">
            최대 {compact((60 / rec.time) * (rec.outputs[0]?.amount ?? 1))}개/분 ·{' '}
            {c.crafting ? (speed < 0.999 ? `전력 부족으로 ${percent(speed)} 속도` : '가동 중') : '재료 대기 중 (벨트/투입기로 재료를 넣으세요)'}
          </p>
        </div>
      ) : (
        <p className="text-xs text-amber-300">레시피를 선택하세요.</p>
      )}
      <div>
        <div className="mb-1 text-xs text-slate-400">레시피</div>
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
          {recipesFor(b.kind).map((r) => {
            const unlocked = isRecipeUnlocked(game.world, r.id);
            const out = r.outputs[0]?.item ?? 'coal';
            const active = c.recipe === r.id;
            return (
              <button
                key={r.id}
                type="button"
                disabled={!unlocked}
                onClick={() => {
                  game.uiClick();
                  game.build.setSelectedRecipe(r.id);
                }}
                className={cx(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border p-1 text-[10px] leading-tight',
                  active ? 'border-amber-300 bg-amber-500/20' : 'border-white/10 bg-slate-900',
                  !unlocked && 'opacity-35',
                )}
                aria-pressed={active}
                title={unlocked ? r.name : `'${unlockSource({ recipe: r.id })?.name ?? '연구'}' 연구 필요`}
              >
                <ItemIcon item={out} size={24} />
                <span className="line-clamp-1">{ITEMS[out].name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PowerStatus({ b }: { b: Building }) {
  const spec = BUILDINGS[b.kind].power;
  if (!spec?.use) return null;
  if (b.powerNet < 0) {
    return <p className="mt-1 rounded-md bg-red-950/70 px-2 py-1 text-xs text-red-200">전력 연결 안 됨 — 전신주 반경(3칸) 안에 두세요.</p>;
  }
  if (b.demand > 0 && b.satisfaction < 0.999) {
    return (
      <p className="mt-1 rounded-md bg-amber-950/70 px-2 py-1 text-xs text-amber-200">
        전력 부족: {percent(b.satisfaction)} 속도로 가동 중 (소비 {power(b.demand)})
      </p>
    );
  }
  return <p className="mt-1 text-xs text-emerald-300">전력 정상 · 최대 소비 {power(spec.use)}</p>;
}

function Details({ b }: { b: Building }) {
  const game = useGame();
  const w = game.world;
  if (b.kind === 'core') {
    return (
      <div className="mt-2 text-xs">
        <Row label="저장된 아이템">{compact(invTotal(w.inventory))}개</Row>
        <p className="mt-1 text-slate-400">모든 벨트·드릴이 코어로 아이템을 보낼 수 있습니다. 코어의 자동 포탑이 가까운 적을 쏩니다. 코어가 파괴되면 패배합니다.</p>
      </div>
    );
  }
  if (b.belt) {
    const speed = beltSpeedOf(b.kind);
    return (
      <div className="mt-2">
        <Row label="운반 중">{b.belt.items.length}개</Row>
        <Row label="최대 처리량">{compact(speed / BELT_SPACING)}개/초</Row>
        <Row label="상태">{b.active ? '이동 중' : b.belt.items.length > 0 ? '정체 (앞이 막힘)' : '비어 있음'}</Row>
      </div>
    );
  }
  if (b.router) return <Row label="보관 중">{b.router.slot.item ? ITEMS[b.router.slot.item].name : '없음'}</Row>;
  if (b.sorter) {
    return (
      <div className="mt-2">
        <p className="text-xs text-slate-400">필터 아이템은 직진하고, 나머지는 좌/우로 번갈아 보냅니다.</p>
        <FilterPicker value={b.sorter.filter} onPick={(id) => game.build.setSelectedFilter(id)} />
      </div>
    );
  }
  if (b.inserter) {
    return (
      <div className="mt-2">
        <Row label="집은 아이템">{b.inserter.held ? ITEMS[b.inserter.held].name : '없음'}</Row>
        <p className="text-xs text-slate-400">뒤쪽 칸에서 앞쪽 건물이 받을 수 있는 아이템만 옮깁니다.</p>
        <FilterPicker value={b.inserter.filter} onPick={(id) => game.build.setSelectedFilter(id)} />
      </div>
    );
  }
  if (b.bridge) {
    const p = b.bridge.partner ? w.buildings.get(b.bridge.partner) : undefined;
    return (
      <div className="mt-2">
        <Row label="연결">{p ? `${Math.abs(p.x - b.x) + Math.abs(p.y - b.y)}칸 앞 다리` : '없음 (앞으로 출력)'}</Row>
        <Row label="이동 중">{b.bridge.queue.length}개</Row>
        <p className="text-xs text-slate-400">바라보는 방향 4칸 안의 다리로 아이템을 넘깁니다. 중간에 벨트나 물이 있어도 됩니다.</p>
      </div>
    );
  }
  if (b.tunnel) {
    const p = b.tunnel.partner ? w.buildings.get(b.tunnel.partner) : undefined;
    return (
      <div className="mt-2">
        <Row label="종류">{b.tunnel.mode === 'in' ? '입구' : '출구'}</Row>
        <Row label="연결">{p ? `${Math.abs(p.x - b.x) + Math.abs(p.y - b.y)}칸 떨어진 ${b.tunnel.mode === 'in' ? '출구' : '입구'}` : '없음'}</Row>
        <p className="text-xs text-slate-400">입구 앞쪽 5칸 안에 같은 방향 터널을 지으면 출구가 됩니다.</p>
      </div>
    );
  }
  if (b.storage) {
    return (
      <div className="mt-2">
        <Row label="용량">
          {invTotal(b.storage.items)}/{b.storage.capacity}
        </Row>
        <Contents items={b.storage.items} />
        <p className="mt-1 text-xs text-slate-400">투입기로 아이템을 꺼낼 수 있습니다.</p>
      </div>
    );
  }
  if (b.drill) {
    const time = drillTime(b.kind, b.drill.oreTiles, b.size) / w.modifiers.drillSpeed;
    const speed = b.kind === 'electric_drill' ? b.satisfaction : 1;
    return (
      <div className="mt-2">
        <Row label="채굴 광물">{b.drill.ore ? ITEMS[b.drill.ore].name : '없음'}</Row>
        <Row label="광맥 타일">
          {b.drill.oreTiles}/{b.size * b.size}
        </Row>
        <Row label="채굴 속도">{Number.isFinite(time) ? `${compact((60 / time) * speed)}개/분` : '-'}</Row>
        <Row label="출력 대기">{b.drill.output}개</Row>
        <p className="text-xs text-slate-400">인접한 벨트·건물로 광석을 자동 배출합니다.</p>
      </div>
    );
  }
  if (b.crafter) return <CrafterDetails b={b} />;
  if (b.generator) {
    return (
      <div className="mt-2">
        <Row label="석탄 연료">{b.generator.fuel}/10</Row>
        <Row label="현재 출력">{power(b.generator.output)}</Row>
        <Row label="연소 중인 석탄">{percent(b.generator.burn / 1200)}</Row>
        <p className="text-xs text-slate-400">석탄 1개 = 1.2MJ. 벨트·투입기·드릴로 석탄을 넣으세요.</p>
      </div>
    );
  }
  if (b.kind === 'solar_panel') {
    const cap = (BUILDINGS.solar_panel.power?.gen ?? 0) * w.modifiers.generatorOutput;
    return <Row label="최대 출력">{power(cap)} (낮에만, 밤 0kW)</Row>;
  }
  if (b.accumulator) {
    const cap = BUILDINGS.accumulator.power?.storage ?? 1;
    return (
      <div className="mt-2">
        <Row label="충전율">{percent(b.accumulator.stored / cap)}</Row>
        <ProgressBar value={b.accumulator.stored / cap} color="bg-emerald-400" />
        <Row label="저장 에너지">
          {energy(b.accumulator.stored)} / {energy(cap)}
        </Row>
      </div>
    );
  }
  if (b.kind === 'power_pole') {
    const net = w.power.networks[b.powerNet];
    return (
      <div className="mt-2">
        {net ? (
          <>
            <Row label="전력망 발전량">{power(net.generation)}</Row>
            <Row label="전력망 소비량">{power(net.demand)}</Row>
            <Row label="공급률">{percent(net.demand > 0 ? net.satisfaction : 1)}</Row>
            <Row label="연결 건물">{net.consumers.length + net.generators.length + net.accumulators.length}개</Row>
          </>
        ) : null}
        <p className="text-xs text-slate-400">반경 3칸 안의 건물에 전력을 공급하고, 8칸 안의 전신주와 자동 연결됩니다.</p>
      </div>
    );
  }
  if (b.lab) {
    const cur = w.research.current ? RESEARCH_BY_ID.get(w.research.current) : undefined;
    return (
      <div className="mt-2">
        <Row label="현재 연구">{cur ? cur.name : '없음 (연구 트리에서 선택)'}</Row>
        {cur && <ProgressBar value={researchFraction(w, cur.id)} color="bg-indigo-400" />}
        <Row label="처리 속도">{compact(60 / LAB_TIME_PER_ITEM)}개/분</Row>
        <Contents items={b.lab.items} empty="투입된 아이템 없음" />
      </div>
    );
  }
  if (b.silo) {
    return (
      <div className="mt-2">
        <Row label="로켓 부품">
          {b.silo.installed}/{ROCKET_PARTS_REQUIRED}
        </Row>
        <ProgressBar value={b.silo.installed / ROCKET_PARTS_REQUIRED} color="bg-rose-400" />
        <Row label="대기 중 부품">{b.silo.buffer}</Row>
        <p className="text-xs text-slate-400">로켓 부품 1,000개를 벨트로 투입하면 로켓이 발사되고 승리합니다.</p>
      </div>
    );
  }
  const tdef = TURRETS[b.kind];
  if (b.turret && tdef) {
    const ammoTurret = tdef.ammo.length > 0;
    return (
      <div className="mt-2">
        <Row label="사거리">{tdef.range}칸{tdef.targetsAir ? '' : ' (지상 전용)'}</Row>
        {ammoTurret ? (
          <>
            <Row label="탄약">
              {b.turret.ammoItem ? ITEMS[b.turret.ammoItem].name : '없음'} · {b.turret.ammo}/{tdef.magazine}발
            </Row>
            <ProgressBar value={b.turret.ammo / tdef.magazine} color="bg-yellow-400" />
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
              사용 탄약:
              {tdef.ammo.map((a) => (
                <ItemIcon key={a.item} item={a.item} size={18} />
              ))}
              (벨트·투입기로 공급)
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400">탄약 없이 전력으로 작동합니다.</p>
        )}
        <Row label="상태">{b.turret.target ? '교전 중' : '대기'}</Row>
      </div>
    );
  }
  return null;
}

export function Inspector() {
  const game = useGame();
  useGameVersion();
  const b = game.build.selected;
  if (!b || game.build.tool.kind !== 'inspect') return null;
  const def = BUILDINGS[b.kind];
  return (
    <section
      className="pointer-events-auto mx-2 mb-2 max-h-[45dvh] overflow-y-auto overscroll-contain rounded-2xl border border-cyan-400/25 bg-slate-950/95 p-3 shadow-2xl shadow-black/60 sm:mx-auto sm:w-[30rem]"
      aria-label={`${def.name} 정보`}
    >
      <header className="flex items-center gap-2">
        <img src={buildingIconUrl(b.kind)} alt="" className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-cyan-100">{def.name}</div>
          <div className="flex items-center gap-2">
            <ProgressBar value={b.hp / b.maxHp} color={b.hp / b.maxHp > 0.5 ? 'bg-emerald-400' : 'bg-red-400'} className="h-1.5" />
            <span className="shrink-0 text-[10px] text-slate-400">
              {Math.ceil(b.hp)}/{b.maxHp}
            </span>
          </div>
        </div>
        {def.rotatable && (
          <Button onClick={() => game.build.rotate()} aria-label="회전">
            <IconRotate />
          </Button>
        )}
        {b.kind !== 'core' && (
          <Button variant="danger" onClick={() => game.build.demolishSelected()} aria-label="철거">
            <IconTrash />
          </Button>
        )}
        <Button variant="ghost" onClick={() => game.build.deselect()} aria-label="닫기">
          <IconX />
        </Button>
      </header>
      <PowerStatus b={b} />
      <Details b={b} />
    </section>
  );
}
