import { useRef, useState } from 'react';
import { MAX_IMPORT_BYTES } from '../data/constants';
import { exportToJSON, getStorage, hasSave, importFromJSON, loadFromStorage } from '../core/save';
import { createWorld } from '../core/World';
import { randomSeed } from '../utils/rng';
import { Button, Modal } from './common';
import { useGame, useGameVersion } from './GameContext';
import { IconDownload, IconHelp, IconLayers, IconMute, IconSave, IconUpload, IconVolume } from './Icons';

function timeAgo(ms: number): string {
  if (!ms) return '아직 없음';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}초 전`;
  return `${Math.floor(s / 60)}분 전`;
}

export function GameMenu({ onClose, onHelp }: { onClose: () => void; onHelp: () => void }) {
  const game = useGame();
  useGameVersion();
  const [seed, setSeed] = useState(() => String(randomSeed()));
  const [confirmNew, setConfirmNew] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const storage = getStorage();

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
    game.pushToast('세이브 파일(JSON)을 내보냈습니다', 'success');
  };

  const importJson = async (file: File): Promise<void> => {
    if (file.size > MAX_IMPORT_BYTES) {
      game.pushToast('파일이 너무 큽니다 (최대 20MB)', 'danger');
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      game.pushToast('파일을 읽을 수 없습니다', 'danger');
      return;
    }
    const world = importFromJSON(text);
    if (!world) {
      game.pushToast('올바른 Astral Factory 세이브 파일이 아닙니다', 'danger');
      return;
    }
    game.loadWorld(world);
    game.save();
    game.pushToast('세이브 파일을 불러왔습니다', 'success');
    onClose();
  };

  const loadSaved = (): void => {
    const world = storage ? loadFromStorage(storage) : null;
    if (!world) {
      game.pushToast('불러올 저장 데이터가 없습니다', 'warning');
      return;
    }
    game.loadWorld(world);
    game.pushToast('마지막 저장을 불러왔습니다', 'success');
    onClose();
  };

  const newGame = (): void => {
    const parsed = Number.parseInt(seed, 10);
    const s = Number.isFinite(parsed) ? Math.abs(parsed) % 2147483647 : randomSeed();
    game.loadWorld(createWorld({ seed: s }));
    game.save();
    game.pushToast(`새 행성에 착륙했습니다 (시드 ${s})`, 'success');
    onClose();
  };

  return (
    <Modal title="메뉴" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <section className="grid grid-cols-2 gap-2">
          <Button
            variant="primary"
            onClick={() => {
              if (game.save()) game.pushToast('저장했습니다', 'success');
            }}
          >
            <IconSave /> 지금 저장
          </Button>
          <Button onClick={loadSaved} disabled={!storage || !hasSave(storage)}>
            불러오기
          </Button>
          <Button onClick={exportJson}>
            <IconDownload /> JSON 내보내기
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <IconUpload /> JSON 가져오기
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
          60초마다, 그리고 앱을 벗어날 때 자동 저장됩니다 · 마지막 저장: {timeAgo(game.lastSaveAt)} · 현재 시드 {game.world.seed}
        </p>

        <section className="space-y-2 rounded-xl bg-slate-900/70 p-3">
          <div className="flex items-center gap-2">
            <Button onClick={() => game.setMuted(!game.sound.muted)} aria-label={game.sound.muted ? '소리 켜기' : '소리 끄기'}>
              {game.sound.muted ? <IconMute /> : <IconVolume />}
            </Button>
            <label className="flex flex-1 items-center gap-2 text-xs">
              음량
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={game.sound.volumeLevel}
                onChange={(e) => game.setVolume(Number(e.target.value))}
                className="h-11 flex-1 accent-cyan-400"
              />
            </label>
          </div>
          <Button className="w-full" variant={game.showPollution ? 'active' : 'default'} onClick={() => game.setPollutionOverlay(!game.showPollution)}>
            <IconLayers /> 오염도 지도 {game.showPollution ? '끄기' : '켜기'}
          </Button>
          <Button className="w-full" onClick={onHelp}>
            <IconHelp /> 조작법 · 도움말
          </Button>
        </section>

        <section className="space-y-2 rounded-xl border border-red-500/20 bg-red-950/20 p-3">
          <div className="font-bold text-red-200">새 게임</div>
          <label className="flex items-center gap-2 text-xs">
            맵 시드
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
              inputMode="numeric"
              className="h-11 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm"
              aria-label="맵 시드"
            />
            <Button onClick={() => setSeed(String(randomSeed()))}>무작위</Button>
          </label>
          {confirmNew ? (
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1" onClick={newGame}>
                현재 진행을 버리고 시작
              </Button>
              <Button onClick={() => setConfirmNew(false)}>취소</Button>
            </div>
          ) : (
            <Button variant="danger" className="w-full" onClick={() => setConfirmNew(true)}>
              새 행성에서 시작
            </Button>
          )}
          <p className="text-[11px] text-slate-400">시작 전에 JSON 내보내기로 현재 세이브를 백업할 수 있습니다.</p>
        </section>
      </div>
    </Modal>
  );
}
