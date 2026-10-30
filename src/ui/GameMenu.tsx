import { useRef } from 'react';
import { MAX_IMPORT_BYTES } from '../data/constants';
import { exportToJSON, getStorage, hasSave, importFromJSON, loadFromStorage } from '../core/save';
import { Button, Modal } from './common';
import { useGame, useGameVersion, useMsg } from './GameContext';
import { IconBook, IconDownload, IconHelp, IconHome, IconSave, IconSettings, IconTrophy, IconUpload } from './Icons';
import type { Overlay } from './TopBar';

export function GameMenu({ onClose, onOpen }: { onClose: () => void; onOpen: (o: Overlay) => void }) {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const t = m.menu;
  const fileRef = useRef<HTMLInputElement>(null);
  const storage = getStorage();
  const run = game.world.settings;

  const ago = (): string => {
    if (!game.lastSaveAt) return t.never;
    const s = Math.round((Date.now() - game.lastSaveAt) / 1000);
    return s < 60 ? t.secondsAgo(s) : t.minutesAgo(Math.floor(s / 60));
  };

  const exportJson = (): void => {
    const blob = new Blob([exportToJSON(game.world)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `astral-factory-day${game.world.day}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    game.pushToast(t.exported, 'success');
  };

  const importJson = async (file: File): Promise<void> => {
    if (file.size > MAX_IMPORT_BYTES) {
      game.pushToast(t.tooBig, 'danger');
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      game.pushToast(t.readFail, 'danger');
      return;
    }
    const world = importFromJSON(text);
    if (!world) {
      game.pushToast(t.notSave, 'danger');
      return;
    }
    game.loadWorld(world);
    game.save();
    game.pushToast(t.imported, 'success');
    onClose();
  };

  const loadSaved = (): void => {
    const world = storage ? loadFromStorage(storage) : null;
    if (!world) {
      game.pushToast(t.noSave, 'warning');
      return;
    }
    game.loadWorld(world);
    game.pushToast(t.loadedLast, 'success');
    onClose();
  };

  return (
    <Modal title={t.title} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <section className="grid grid-cols-2 gap-2">
          <Button
            variant="primary"
            onClick={() => {
              if (game.save()) game.pushToast(t.saved, 'success');
            }}
          >
            <IconSave /> {t.saveNow}
          </Button>
          <Button onClick={loadSaved} disabled={!hasSave(storage)}>
            {t.load}
          </Button>
          <Button onClick={exportJson}>
            <IconDownload /> {t.exportJson}
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <IconUpload /> {t.importJson}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void importJson(f);
            }}
          />
        </section>
        <p className="text-xs text-slate-400">
          <span className="font-semibold text-cyan-100">
            {[
              m.modes[run.mode].name,
              run.mode !== 'sandbox' && m.difficulties[run.difficulty].name,
              run.mutator !== 'none' && `${m.mutators[run.mutator].name}: ${m.mutators[run.mutator].desc}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <br />
          {t.autosave(ago(), game.world.seed)}
        </p>
        <section className="grid grid-cols-2 gap-2">
          <Button onClick={() => onOpen('settings')}>
            <IconSettings /> {t.settings}
          </Button>
          <Button onClick={() => onOpen('help')}>
            <IconHelp /> {t.help}
          </Button>
          <Button onClick={() => onOpen('achievements')}>
            <IconTrophy /> {t.achievements}
          </Button>
          <Button onClick={() => onOpen('codex')}>
            <IconBook /> {t.codex}
          </Button>
        </section>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            onClose();
            game.quitToTitle();
          }}
        >
          <IconHome /> {t.quit}
        </Button>
      </div>
    </Modal>
  );
}
