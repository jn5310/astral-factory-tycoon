import { useEffect, useRef } from 'react';
import { useGame, useMsg } from './GameContext';

/** The world canvas. The Game owns the render loop; React only provides the element. */
export function GameCanvas() {
  const game = useGame();
  const m = useMsg();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    game.mount(canvas);
    return () => game.unmount();
  }, [game]);
  return <canvas ref={ref} className="absolute inset-0 block h-full w-full touch-none" aria-label={m.hud.canvas} />;
}
