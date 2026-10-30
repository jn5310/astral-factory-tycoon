import { useState } from 'react';
import type { ItemId } from '../data/items';
import { invGet } from '../systems/inventory';
import { compact } from '../utils/format';
import { cx, ItemIcon, Modal } from './common';
import { itemName } from '../utils/i18n';
import { useGame, useGameVersion, useMsg } from './GameContext';

const COLORS = ['#22d3ee', '#f59e0b', '#a78bfa', '#4ade80', '#f472b6'];
const W = 640;
const H = 220;
const PAD = { l: 40, r: 10, t: 12, b: 24 };

interface Series {
  id: ItemId;
  color: string;
  produced: number[];
  consumed: number[];
}

/** Line chart of items per minute: solid = produced, dashed = consumed. */
function Chart({ series, bucketSeconds }: { series: readonly Series[]; bucketSeconds: number }) {
  const m = useMsg();
  const n = Math.max(2, ...series.map((s) => s.produced.length));
  let max = 1;
  for (const s of series) for (const v of [...s.produced, ...s.consumed]) max = Math.max(max, v);
  max = Math.ceil(max * 1.1);
  const x = (i: number, len: number): number => PAD.l + ((i + (n - len)) / (n - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number): number => H - PAD.b - (v / max) * (H - PAD.t - PAD.b);
  const line = (vals: readonly number[]): string => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i, vals.length).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const minutes = ((n - 1) * bucketSeconds) / 60;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-lg bg-slate-900/70" role="img" aria-label={m.stats.chart}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} stroke="#334155" strokeDasharray="4 4" />
          <text x={PAD.l - 6} y={y(max * f) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
            {compact(Math.round(max * f))}
          </text>
        </g>
      ))}
      <text x={PAD.l} y={H - 6} fontSize="11" fill="#94a3b8">
        {m.stats.ago(minutes.toFixed(1))}
      </text>
      <text x={W - PAD.r} y={H - 6} fontSize="11" fill="#94a3b8" textAnchor="end">
        {m.stats.now}
      </text>
      {series.map((s) => (
        <g key={s.id}>
          <path d={line(s.consumed)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray="6 4" opacity={0.75} />
          <path d={line(s.produced)} fill="none" stroke={s.color} strokeWidth={2.5} />
        </g>
      ))}
    </svg>
  );
}

export function StatsPanel({ onClose }: { onClose: () => void }) {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const stats = game.world.stats;
  const items = stats.activeItems();
  const [picked, setPicked] = useState<ItemId[] | null>(null);
  const selected = (picked ?? items.slice(0, 3)).filter((id) => items.includes(id));
  const series: Series[] = selected.map((id, i) => ({
    id,
    color: COLORS[i % COLORS.length] ?? '#ffffff',
    produced: stats.series('produced', id),
    consumed: stats.series('consumed', id),
  }));
  const toggle = (id: ItemId): void => {
    const base = picked ?? items.slice(0, 3);
    setPicked(base.includes(id) ? base.filter((x) => x !== id) : [...base, id].slice(-COLORS.length));
  };
  return (
    <Modal title={m.stats.title} onClose={onClose} wide>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{m.stats.empty}</p>
      ) : (
        <>
          <Chart series={series} bucketSeconds={stats.bucketSeconds} />
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {series.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1">
                <span className="inline-block h-1 w-4 rounded" style={{ background: s.color }} />
                {itemName(s.id)}
              </span>
            ))}
            <span className="text-slate-400">{m.stats.legendNote}</span>
          </div>
          <table className="mt-3 w-full text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="py-1 text-left font-normal">{m.stats.itemCol}</th>
                <th className="py-1 text-right font-normal">{m.stats.producedCol}</th>
                <th className="py-1 text-right font-normal">{m.stats.consumedCol}</th>
                <th className="py-1 text-right font-normal">{m.stats.netCol}</th>
                <th className="py-1 text-right font-normal">{m.stats.stockCol}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((id) => {
                const p = stats.ratePerMinute('produced', id);
                const c = stats.ratePerMinute('consumed', id);
                const on = selected.includes(id);
                return (
                  <tr
                    key={id}
                    onClick={() => toggle(id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggle(id);
                      }
                    }}
                    tabIndex={0}
                    className={cx('h-11 cursor-pointer border-t border-white/5 focus:outline focus:outline-cyan-400', on && 'bg-cyan-950/40')}
                    aria-selected={on}
                  >
                    <td className="py-1">
                      <span className="inline-flex items-center gap-1.5">
                        <ItemIcon item={id} size={18} />
                        {itemName(id)}
                      </span>
                    </td>
                    <td className="text-right tabular-nums text-emerald-300">{compact(Math.round(p))}</td>
                    <td className="text-right tabular-nums text-orange-300">{compact(Math.round(c))}</td>
                    <td className={cx('text-right tabular-nums', p - c >= 0 ? 'text-slate-200' : 'text-red-300')}>
                      {p - c >= 0 ? '+' : ''}
                      {compact(Math.round(p - c))}
                    </td>
                    <td className="text-right tabular-nums">{compact(invGet(game.world.inventory, id))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  );
}
