import { useCallback, useEffect, useState } from 'react';
import { AbilityBar } from './AbilityBar';
import { BlueprintNameDialog, BlueprintPanel } from './BlueprintPanel';
import { BuildBar } from './BuildBar';
import { useGame, useGameVersion } from './GameContext';
import { GameMenu } from './GameMenu';
import { Inspector } from './Inspector';
import { AchievementsPanel, CodexPanel } from './MetaPanels';
import { Minimap, ZoomControls } from './Minimap';
import { EndScreen, HelpOverlay, LaunchBanner, Toasts } from './Overlays';
import { RadioBox } from './RadioBox';
import { ResearchTree } from './ResearchTree';
import { SettingsPanel } from './SettingsPanel';
import { StatsPanel } from './StatsPanel';
import { BossBar, EventChip, MissionCard } from './StatusPanel';
import { TitleScreen } from './TitleScreen';
import { TopBar, type Overlay } from './TopBar';

function Overlays({ overlay, setOverlay }: { overlay: Overlay; setOverlay: (o: Overlay) => void }) {
  const close = useCallback(() => setOverlay('none'), [setOverlay]);
  return (
    <>
      {overlay === 'menu' && <GameMenu onClose={close} onOpen={setOverlay} />}
      {overlay === 'research' && <ResearchTree onClose={close} />}
      {overlay === 'stats' && <StatsPanel onClose={close} />}
      {overlay === 'blueprints' && <BlueprintPanel onClose={close} />}
      {overlay === 'help' && <HelpOverlay onClose={close} />}
      {overlay === 'settings' && <SettingsPanel onClose={close} />}
      {overlay === 'achievements' && <AchievementsPanel onClose={close} />}
      {overlay === 'codex' && <CodexPanel onClose={close} />}
    </>
  );
}

/** All React UI layered over the canvas. Only interactive panels take pointer events. */
export function Hud() {
  const game = useGame();
  useGameVersion();
  const [overlay, setOverlay] = useState<Overlay>('none');
  useEffect(() => {
    if (game.pendingHelp && game.screen === 'playing') {
      game.pendingHelp = false;
      setOverlay('help');
    }
  });
  useEffect(() => {
    game.panelOpen = overlay !== 'none';
  }, [game, overlay]);
  if (game.screen === 'title') {
    return (
      <div className="pointer-events-none absolute inset-0">
        <TitleScreen onOpen={setOverlay} />
        <Toasts />
        <Overlays overlay={overlay} setOverlay={setOverlay} />
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <TopBar onOpen={setOverlay} />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Toasts />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1.5">
          <MissionCard />
          <BossBar />
          <EventChip />
        </div>
        <div className="absolute right-2 top-2 flex flex-col items-end gap-2">
          <Minimap />
          <ZoomControls />
        </div>
        <LaunchBanner />
        <div className="absolute inset-x-2 bottom-2 flex flex-col items-start gap-2">
          <AbilityBar />
          <RadioBox />
        </div>
      </div>
      <Inspector />
      <BuildBar onOpenBlueprints={() => setOverlay('blueprints')} />
      <Overlays overlay={overlay} setOverlay={setOverlay} />
      <BlueprintNameDialog />
      <EndScreen />
    </div>
  );
}
