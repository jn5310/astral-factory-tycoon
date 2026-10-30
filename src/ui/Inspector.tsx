import type { ReactNode } from 'react';
import type { Building } from '../entities/Building';
import { BUILDINGS, isCrafterKind } from '../data/buildings';
import { BELT_SPACING, LAB_TIME_PER_ITEM, ROCKET_PARTS_REQUIRED } from '../data/constants';
import { ITEM_IDS, type ItemId } from '../data/items';
import { RECIPES, recipesFor } from '../data/recipes';
import { RESEARCH_BY_ID } from '../data/research';
import { RANK_KILLS, TURRETS, rankFor } from '../data/turrets';
import { beltSpeedOf } from '../systems/belts';
import { invEntries, invGet, invTotal } from '../systems/inventory';
import { drillMultiplier, productionBoost } from '../systems/modifiers';
import { drillTime } from '../systems/production';
import { isRecipeUnlocked, researchFraction, unlockSource } from '../systems/research';
import { compact, energy, percent, power } from '../utils/format';
import { buildingName, itemName, researchName } from '../utils/i18n';
import { buildingIconUrl } from './buildingIcon';
import { Button, cx, ItemIcon, ProgressBar } from './common';
import { useGame, useGameVersion, useMsg } from './GameContext';
import { IconCopy, IconRotate, IconTrash, IconX } from './Icons';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="text-right text-slate-100">{children}</span>
    </div>
  );
}

function Contents({ items, empty }: { items: Partial<Record<ItemId, number>>; empty: string }) {
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

/** Item filter picker for sorters and inserters ("none" clears the filter). */
function FilterPicker({ value, onPick }: { value: ItemId | null; onPick: (id: ItemId | null) => void }) {
  const m = useMsg();
  return (
    <div className="mt-1">
      <div className="mb-1 text-xs text-slate-400">{m.inspector.filter(value ? itemName(value) : m.common.none)}</div>
      <div className="grid grid-cols-8 gap-1">
        <button
          type="button"
          onClick={() => onPick(null)}
          className={cx('flex h-11 items-center justify-center rounded-lg border text-[10px]', value === null ? 'border-amber-300 bg-amber-500/20' : 'border-white/10 bg-slate-900')}
          aria-pressed={value === null}
        >
          {m.common.none}
        </button>
        {ITEM_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className={cx('flex h-11 items-center justify-center rounded-lg border', value === id ? 'border-amber-300 bg-amber-500/20' : 'border-white/10 bg-slate-900')}
            aria-pressed={value === id}
            aria-label={itemName(id)}
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
  const m = useMsg();
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
              <span
                key={s.item}
                className={cx('inline-flex items-center gap-1 rounded px-1 py-0.5', invGet(c.input, s.item) >= s.amount ? 'bg-slate-800' : 'bg-red-950/70 text-red-200')}
              >
                <ItemIcon item={s.item} size={18} />
                {invGet(c.input, s.item)}/{s.amount}
              </span>
            ))}
            <span className="text-slate-400">→ {m.common.seconds(rec.time)} →</span>
            {rec.outputs.map((s) => (
              <span key={s.item} className="inline-flex items-center gap-1 rounded bg-emerald-950/60 px-1 py-0.5">
                <ItemIcon item={s.item} size={18} />×{s.amount}
                <span className="text-slate-400">{m.inspector.stock(invGet(c.output, s.item))}</span>
              </span>
            ))}
          </div>
          <ProgressBar value={c.crafting ? c.progress / rec.time : 0} color="bg-amber-400" className="mt-2" />
          <p className="mt-1 text-[11px] text-slate-400">
            {m.inspector.maxRate(compact((60 / rec.time) * (rec.outputs[0]?.amount ?? 1) * productionBoost(game.world)))} ·{' '}
            {c.crafting ? (speed < 0.999 ? m.inspector.slowPower(percent(speed)) : m.inspector.running) : m.inspector.waiting}
          </p>
        </div>
      ) : (
        <p className="text-xs text-amber-300">{m.inspector.chooseRecipe}</p>
      )}
      <div>
        <div className="mb-1 text-xs text-slate-400">{m.inspector.recipes}</div>
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
          {recipesFor(b.kind).map((r) => {
            const unlocked = isRecipeUnlocked(game.world, r.id);
            const out = r.outputs[0]?.item ?? 'coal';
            const active = c.recipe === r.id;
            const source = unlockSource({ recipe: r.id });
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
                title={unlocked ? itemName(out) : m.inspector.recipeNeeds(source ? researchName(source.id) : '?')}
              >
                <ItemIcon item={out} size={24} />
                <span className="line-clamp-1">{itemName(out)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PowerStatus({ b }: { b: Building }) {
  const m = useMsg();
  const spec = BUILDINGS[b.kind].power;
  if (!spec?.use) return null;
  if (b.powerNet < 0) return <p className="mt-1 rounded-md bg-red-950/70 px-2 py-1 text-xs text-red-200">{m.inspector.noPower}</p>;
  if (b.demand > 0 && b.satisfaction < 0.999) {
    return <p className="mt-1 rounded-md bg-amber-950/70 px-2 py-1 text-xs text-amber-200">{m.inspector.lowPower(percent(b.satisfaction), power(b.demand))}</p>;
  }
  return <p className="mt-1 text-xs text-emerald-300">{m.inspector.powerOk(power(spec.use))}</p>;
}

function TurretRank({ b }: { b: Building }) {
  const m = useMsg();
  const kills = b.turret?.kills ?? 0;
  const rank = rankFor(kills);
  const next = RANK_KILLS[rank];
  return (
    <>
      <Row label={m.inspector.rank}>
        <span className={rank >= 3 ? 'font-bold text-amber-300' : ''}>{'★'.repeat(rank) || '·'} {m.ranks[rank]}</span>
      </Row>
      <Row label={m.inspector.kills}>{next !== undefined ? `${kills} · ${m.inspector.nextRank(next - kills)}` : kills}</Row>
    </>
  );
}

function Details({ b }: { b: Building }) {
  const game = useGame();
  const m = useMsg();
  const t = m.inspector;
  const w = game.world;
  if (b.kind === 'core') {
    return (
      <div className="mt-2 text-xs">
        <Row label={t.storedTotal}>{m.common.itemsCount(compact(invTotal(w.inventory)))}</Row>
        <p className="mt-1 text-slate-400">{t.coreDesc}</p>
      </div>
    );
  }
  if (b.belt) {
    const speed = beltSpeedOf(b.kind);
    return (
      <div className="mt-2">
        <Row label={t.carrying}>{b.belt.items.length}</Row>
        <Row label={t.throughput}>{m.common.perSec(compact(speed / BELT_SPACING))}</Row>
        <Row label={t.state}>{b.active ? t.moving : b.belt.items.length > 0 ? t.jammed : m.common.empty}</Row>
      </div>
    );
  }
  if (b.router) return <Row label={t.holding}>{b.router.slot.item ? itemName(b.router.slot.item) : m.common.none}</Row>;
  if (b.sorter) {
    return (
      <div className="mt-2">
        <p className="text-xs text-slate-400">{t.sorterDesc}</p>
        <FilterPicker value={b.sorter.filter} onPick={(id) => game.build.setSelectedFilter(id)} />
      </div>
    );
  }
  if (b.inserter) {
    return (
      <div className="mt-2">
        <Row label={t.holding}>{b.inserter.held ? itemName(b.inserter.held) : m.common.none}</Row>
        <p className="text-xs text-slate-400">{t.inserterDesc}</p>
        <FilterPicker value={b.inserter.filter} onPick={(id) => game.build.setSelectedFilter(id)} />
      </div>
    );
  }
  if (b.bridge) {
    const p = b.bridge.partner ? w.buildings.get(b.bridge.partner) : undefined;
    return (
      <div className="mt-2">
        <Row label={t.link}>{p ? t.bridgeLink(Math.abs(p.x - b.x) + Math.abs(p.y - b.y)) : t.bridgeNone}</Row>
        <Row label={t.inTransit}>{b.bridge.queue.length}</Row>
        <p className="text-xs text-slate-400">{t.bridgeDesc}</p>
      </div>
    );
  }
  if (b.tunnel) {
    const p = b.tunnel.partner ? w.buildings.get(b.tunnel.partner) : undefined;
    return (
      <div className="mt-2">
        <Row label={t.tunnelType}>{b.tunnel.mode === 'in' ? t.entrance : t.exit}</Row>
        <Row label={t.link}>{p ? t.tunnelLink(Math.abs(p.x - b.x) + Math.abs(p.y - b.y), b.tunnel.mode === 'in') : m.common.none}</Row>
        <p className="text-xs text-slate-400">{t.tunnelDesc}</p>
      </div>
    );
  }
  if (b.storage) {
    return (
      <div className="mt-2">
        <Row label={t.capacity}>
          {invTotal(b.storage.items)}/{b.storage.capacity}
        </Row>
        <Contents items={b.storage.items} empty={m.common.empty} />
        <p className="mt-1 text-xs text-slate-400">{t.containerDesc}</p>
      </div>
    );
  }
  if (b.drill) {
    const time = drillTime(b.kind, b.drill.oreTiles, b.size) / (w.modifiers.drillSpeed * drillMultiplier(w));
    const speed = (b.kind === 'electric_drill' ? b.satisfaction : 1) * productionBoost(w);
    return (
      <div className="mt-2">
        <Row label={t.ore}>{b.drill.ore ? itemName(b.drill.ore) : m.common.none}</Row>
        <Row label={t.oreTiles}>
          {b.drill.oreTiles}/{b.size * b.size}
        </Row>
        <Row label={t.mineRate}>{Number.isFinite(time) ? m.common.perMin(compact((60 / time) * speed)) : '-'}</Row>
        <Row label={t.outputWaiting}>{b.drill.output}</Row>
        <p className="text-xs text-slate-400">{t.drillDesc}</p>
      </div>
    );
  }
  if (b.crafter) return <CrafterDetails b={b} />;
  if (b.generator) {
    return (
      <div className="mt-2">
        <Row label={t.fuel}>{b.generator.fuel}/10</Row>
        <Row label={t.output}>{power(b.generator.output)}</Row>
        <Row label={t.burning}>{percent(b.generator.burn / 1200)}</Row>
        <p className="text-xs text-slate-400">{t.generatorDesc}</p>
      </div>
    );
  }
  if (b.kind === 'solar_panel') {
    const cap = (BUILDINGS.solar_panel.power?.gen ?? 0) * w.modifiers.generatorOutput;
    return <Row label={t.maxOutput}>{t.solarNote(power(cap))}</Row>;
  }
  if (b.accumulator) {
    const cap = BUILDINGS.accumulator.power?.storage ?? 1;
    return (
      <div className="mt-2">
        <Row label={t.charge}>{percent(b.accumulator.stored / cap)}</Row>
        <ProgressBar value={b.accumulator.stored / cap} color="bg-emerald-400" />
        <Row label={t.energy}>
          {energy(b.accumulator.stored)} / {energy(cap)}
        </Row>
      </div>
    );
  }
  if (b.kind === 'power_pole') {
    const net = w.power.networks[b.powerNet];
    return (
      <div className="mt-2">
        {net && (
          <>
            <Row label={t.gridGen}>{power(net.generation)}</Row>
            <Row label={t.gridDemand}>{power(net.demand)}</Row>
            <Row label={t.supply}>{percent(net.demand > 0 ? net.satisfaction : 1)}</Row>
            <Row label={t.linked}>{net.consumers.length + net.generators.length + net.accumulators.length}</Row>
          </>
        )}
        <p className="text-xs text-slate-400">{t.poleDesc}</p>
      </div>
    );
  }
  if (b.lab) {
    const cur = w.research.current ? RESEARCH_BY_ID.get(w.research.current) : undefined;
    return (
      <div className="mt-2">
        <Row label={t.labCurrent}>{cur ? researchName(cur.id) : t.labNone}</Row>
        {cur && <ProgressBar value={researchFraction(w, cur.id)} color="bg-indigo-400" />}
        <Row label={t.labSpeed}>{m.common.perMin(compact(60 / LAB_TIME_PER_ITEM))}</Row>
        <Contents items={b.lab.items} empty={t.labEmpty} />
      </div>
    );
  }
  if (b.silo) {
    return (
      <div className="mt-2">
        <Row label={t.rocketParts}>
          {b.silo.installed}/{ROCKET_PARTS_REQUIRED}
        </Row>
        <ProgressBar value={b.silo.installed / ROCKET_PARTS_REQUIRED} color="bg-rose-400" />
        <Row label={t.partsWaiting}>{b.silo.buffer}</Row>
        <p className="text-xs text-slate-400">{t.siloDesc}</p>
      </div>
    );
  }
  const tdef = TURRETS[b.kind];
  if (b.turret && tdef) {
    const ammoTurret = tdef.ammo.length > 0;
    return (
      <div className="mt-2">
        <Row label={t.rangeLabel}>{t.rangeTiles(tdef.range, !tdef.targetsAir)}</Row>
        {ammoTurret ? (
          <>
            <Row label={t.ammo}>{t.ammoLine(b.turret.ammoItem ? itemName(b.turret.ammoItem) : m.common.none, b.turret.ammo, tdef.magazine)}</Row>
            <ProgressBar value={b.turret.ammo / tdef.magazine} color="bg-yellow-400" />
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
              {t.ammoAccepts}
              {tdef.ammo.map((a) => (
                <ItemIcon key={a.item} item={a.item} size={18} />
              ))}
              {t.ammoFeed}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400">{t.energyWeapon}</p>
        )}
        <Row label={t.status}>{b.turret.target ? t.engaging : t.idle}</Row>
        <TurretRank b={b} />
      </div>
    );
  }
  return null;
}

export function Inspector() {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const b = game.build.selected;
  if (!b || game.build.tool.kind !== 'inspect') return null;
  const def = BUILDINGS[b.kind];
  return (
    <section
      className="pointer-events-auto mx-2 mb-2 max-h-[45dvh] overflow-y-auto overscroll-contain rounded-2xl border border-cyan-400/25 bg-slate-950/95 p-3 shadow-2xl shadow-black/60 sm:mx-auto sm:w-[30rem]"
      aria-label={m.inspector.info(buildingName(b.kind))}
    >
      <header className="flex items-center gap-2">
        <img src={buildingIconUrl(b.kind)} alt="" className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-cyan-100">{buildingName(b.kind)}</div>
          <div className="flex items-center gap-2">
            <ProgressBar value={b.hp / b.maxHp} color={b.hp / b.maxHp > 0.5 ? 'bg-emerald-400' : 'bg-red-400'} className="h-1.5" />
            <span className="shrink-0 text-[10px] text-slate-400">
              {Math.ceil(b.hp)}/{b.maxHp}
            </span>
          </div>
        </div>
        {def.buildable && (
          <Button onClick={() => game.build.buildSameAsSelected()} aria-label={m.inspector.buildSame} title={m.inspector.buildSame}>
            <IconCopy />
          </Button>
        )}
        {def.rotatable && (
          <Button onClick={() => game.build.rotate()} aria-label={m.build.rotate}>
            <IconRotate />
          </Button>
        )}
        {b.kind !== 'core' && (
          <Button variant="danger" onClick={() => game.build.demolishSelected()} aria-label={m.build.demolish}>
            <IconTrash />
          </Button>
        )}
        <Button variant="ghost" onClick={() => game.build.deselect()} aria-label={m.common.close}>
          <IconX />
        </Button>
      </header>
      <PowerStatus b={b} />
      <Details b={b} />
    </section>
  );
}
