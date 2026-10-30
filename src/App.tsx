import { useState } from 'react';
import { Game } from './core/Game';
import { getStorage, loadFromStorage } from './core/save';
import { createWorld } from './core/World';
import { randomSeed } from './utils/rng';
import { GameCanvas } from './ui/GameCanvas';
import { GameProvider } from './ui/GameContext';
import { Hud } from './ui/Hud';

function createGame(): { game: Game; firstRun: boolean } {
  const storage = getStorage();
  const saved = storage ? loadFromStorage(storage) : null;
  return { game: new Game(saved ?? createWorld({ seed: randomSeed() })), firstRun: saved === null };
}

export default function App() {
  const [{ game, firstRun }] = useState(createGame);
  return (
    <GameProvider game={game}>
      <main className="fixed inset-0 overflow-hidden bg-[#03050b] font-sans text-slate-100">
        <GameCanvas />
        <Hud firstRun={firstRun} />
      </main>
    </GameProvider>
  );
}
