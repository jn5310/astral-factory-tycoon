import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { Game } from '../core/Game';

const GameContext = createContext<Game | null>(null);

export function GameProvider({ game, children }: { game: Game; children: ReactNode }) {
  return <GameContext.Provider value={game}>{children}</GameContext.Provider>;
}

export function useGame(): Game {
  const game = useContext(GameContext);
  if (!game) throw new Error('useGame must be used inside <GameProvider>');
  return game;
}

/** Re-renders the caller whenever the game publishes a UI update (about 8 times a second, plus on actions). */
export function useGameVersion(): number {
  const game = useGame();
  return useSyncExternalStore(game.subscribe, game.getVersion, game.getVersion);
}
