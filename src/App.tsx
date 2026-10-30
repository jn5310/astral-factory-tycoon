import { useState } from 'react';
import { Game } from './core/Game';
import { getStorage, loadFromStorage } from './core/save';
import { createWorld } from './core/World';
import { randomSeed } from './utils/rng';
import { GameCanvas } from './ui/GameCanvas';
import { GameProvider } from './ui/GameContext';
import { Hud } from './ui/Hud';

/** The saved colony (or a fresh demo planet) sits behind the title screen until the player starts. */
function createGame(): Game {
  const storage = getStorage();
  const saved = storage ? loadFromStorage(storage) : null;
  return new Game(saved ?? createWorld({ seed: randomSeed() }));
}

export default function App() {
  const [game] = useState(createGame);
  return (
    <GameProvider game={game}>
      <main className="fixed inset-0 overflow-hidden bg-[#03050b] font-sans text-slate-100">
        <GameCanvas />
        <Hud />
      </main>
    </GameProvider>
  );
}
