import { useCallback, useState } from 'react';
import { BlueprintNameDialog, BlueprintPanel } from './BlueprintPanel';
import { BuildBar } from './BuildBar';
import { GameMenu } from './GameMenu';
import { Inspector } from './Inspector';
import { Minimap, ZoomControls } from './Minimap';
import { EndScreen, HelpOverlay, LaunchBanner, ObjectiveHint, Toasts } from './Overlays';
import { ResearchTree } from './ResearchTree';
import { StatsPanel } from './StatsPanel';
import { TopBar, type Overlay } from './TopBar';

/** All React UI layered over the canvas. Only interactive panels take pointer events. */
export function Hud({ firstRun }: { firstRun: boolean }) {
  const [overlay, setOverlay] = useState<Overlay>(firstRun ? 'help' : 'none');
  const close = useCallback(() => setOverlay('none'), []);
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <TopBar onOpen={setOverlay} />
      <div className="relative min-h-0 flex-1">
        <Toasts />
        <div className="absolute left-2 top-2">
          <ObjectiveHint />
        </div>
        <div className="absolute right-2 top-2 flex flex-col items-end gap-2">
          <Minimap />
          <ZoomControls />
        </div>
        <LaunchBanner />
      </div>
      <Inspector />
      <BuildBar onOpenBlueprints={() => setOverlay('blueprints')} />

      {overlay === 'menu' && <GameMenu onClose={close} onHelp={() => setOverlay('help')} />}
      {overlay === 'research' && <ResearchTree onClose={close} />}
      {overlay === 'stats' && <StatsPanel onClose={close} />}
      {overlay === 'blueprints' && <BlueprintPanel onClose={close} />}
      {overlay === 'help' && <HelpOverlay onClose={close} />}
      <BlueprintNameDialog />
      <EndScreen />
    </div>
  );
}
