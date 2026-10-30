import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { ItemId, ItemStack } from '../data/items';
import type { Inventory } from '../systems/inventory';
import { compact } from '../utils/format';
import { itemName, msg } from '../utils/i18n';
import { itemIconUrl } from '../utils/itemIcons';
import { IconX } from './Icons';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

type Variant = 'default' | 'primary' | 'danger' | 'ghost' | 'active';

const VARIANTS: Record<Variant, string> = {
  default: 'border border-white/10 bg-slate-800/80 text-slate-100 hover:bg-slate-700/80',
  primary: 'border border-cyan-300/50 bg-cyan-500/25 text-cyan-50 hover:bg-cyan-500/35',
  danger: 'border border-red-400/40 bg-red-500/20 text-red-100 hover:bg-red-500/30',
  ghost: 'text-slate-300 hover:bg-white/10',
  active: 'border border-amber-300/70 bg-amber-500/25 text-amber-50',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** Every button keeps a 44px minimum touch target (mobile-first rule from the GDD). */
export function Button({ variant = 'default', className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex min-h-11 min-w-11 shrink-0 select-none items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export function ItemIcon({ item, size = 20, className }: { item: ItemId; size?: number; className?: string }) {
  return (
    <img
      src={itemIconUrl(item)}
      width={size}
      height={size}
      alt={itemName(item)}
      title={itemName(item)}
      draggable={false}
      className={cx('inline-block shrink-0', className)}
    />
  );
}

/** Item cost chips; red when the core does not hold enough. */
export function CostList({ cost, have, multiplier = 1 }: { cost: readonly ItemStack[]; have?: Inventory; multiplier?: number }) {
  return (
    <div className="flex flex-wrap gap-1">
      {cost.map((s) => {
        const need = s.amount * multiplier;
        const ok = !have || (have[s.item] ?? 0) >= need;
        return (
          <span
            key={s.item}
            className={cx(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs',
              ok ? 'bg-slate-800/90 text-slate-200' : 'bg-red-950/80 text-red-300',
            )}
          >
            <ItemIcon item={s.item} size={16} />
            {compact(need)}
          </span>
        );
      })}
    </div>
  );
}

export function ProgressBar({ value, color = 'bg-cyan-400', className }: { value: number; color?: string; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100);
  return (
    <div
      className={cx('h-2 w-full overflow-hidden rounded-full bg-slate-800', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className={cx('h-full rounded-full transition-[width] duration-200', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** Bottom sheet on phones, centered dialog on larger screens. Escape or a tap outside closes it. */
export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cx(
          'flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-cyan-400/25 bg-slate-950/95 shadow-2xl shadow-black sm:rounded-2xl',
          wide ? 'sm:max-w-5xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 py-1 pl-4 pr-1">
          <h2 className="text-base font-bold text-cyan-100">{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label={msg().common.close}>
            <IconX />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-3 sm:p-4">{children}</div>
        {footer}
      </div>
    </div>
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** Row of mutually exclusive choices (radio group semantics). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-11 rounded-lg border px-3 text-sm font-semibold transition active:scale-95',
            value === o.value ? 'border-cyan-300 bg-cyan-500/25 text-cyan-50' : 'border-white/10 bg-slate-900 text-slate-300',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
