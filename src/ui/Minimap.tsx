import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from './common';
import { useGame, useGameVersion, useMsg } from './GameContext';
import { IconMinus, IconPlus, IconTarget } from './Icons';

const MAP_CSS = 128;

/** Top-right radar. Tap or drag on it to move the camera. */
export function Minimap() {
  const game = useGame();
  const m = useMsg();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return undefined;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(MAP_CSS * dpr);
    c.height = Math.round(MAP_CSS * dpr);
    game.attachMinimap(c);
    return () => game.attachMinimap(null);
  }, [game]);
  const moveTo = (e: PointerEvent<HTMLCanvasElement>): void => {
    const r = e.currentTarget.getBoundingClientRect();
    const w = game.world;
    const x = ((e.clientX - r.left) / r.width) * w.width;
    const y = ((e.clientY - r.top) / r.height) * w.height;
    game.camera.centerOn(x, y);
  };
  return (
    <canvas
      ref={ref}
      style={{ width: MAP_CSS, height: MAP_CSS }}
      className="pointer-events-auto touch-none rounded-xl border border-cyan-400/35 bg-black shadow-lg shadow-black/60"
      role="img"
      aria-label={m.hud.minimap}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        moveTo(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons) moveTo(e);
      }}
    />
  );
}

/** Right-side vertical zoom slider with +/- and "back to core" buttons. */
export function ZoomControls() {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const track = useRef<HTMLDivElement>(null);
  const cam = game.camera;
  const lmin = Math.log(cam.minZoom);
  const lmax = Math.log(cam.maxZoom);
  const t = lmax > lmin ? (Math.log(cam.zoom) - lmin) / (lmax - lmin) : 0;
  const zoomBy = (f: number): void => {
    cam.zoomAt(cam.viewport.width / 2, cam.viewport.height / 2, f);
    game.notify();
  };
  const fromPointer = (clientY: number): void => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    const f = 1 - Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    const target = Math.exp(lmin + (lmax - lmin) * f);
    zoomBy(target / cam.zoom);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') zoomBy(1.15);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') zoomBy(1 / 1.15);
    else return;
    e.preventDefault();
  };
  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-slate-950/80 p-1">
      <Button variant="ghost" aria-label={m.hud.zoomIn} onClick={() => zoomBy(1.25)}>
        <IconPlus />
      </Button>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={m.hud.zoom}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(t * 100)}
        className="relative h-32 w-11 touch-none"
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons) fromPointer(e.clientY);
        }}
      >
        <div className="absolute left-1/2 top-0 h-full w-1.5 -translate-x-1/2 rounded-full bg-slate-700" />
        <div
          className="absolute left-1/2 h-6 w-9 -translate-x-1/2 rounded-md border border-cyan-300/70 bg-cyan-500/40"
          style={{ top: `calc(${(1 - t) * 100}% - 12px)` }}
        />
      </div>
      <Button variant="ghost" aria-label={m.hud.zoomOut} onClick={() => zoomBy(1 / 1.25)}>
        <IconMinus />
      </Button>
      <Button variant="ghost" aria-label={m.hud.toCore} onClick={() => game.focusCore()}>
        <IconTarget />
      </Button>
    </div>
  );
}
