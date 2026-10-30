import { useState } from 'react';
import { getStorage } from '../core/save';
import { blueprintCost, loadBlueprints, saveBlueprints, type Blueprint } from '../systems/blueprint';
import { buildingIconUrl } from './buildingIcon';
import { Button, CostList, Modal } from './common';
import { useGame, useGameVersion } from './GameContext';
import { IconCopy, IconTrash } from './Icons';

function readList(): Blueprint[] {
  const s = getStorage();
  return s ? loadBlueprints(s) : [];
}

function writeList(list: readonly Blueprint[]): void {
  const s = getStorage();
  if (s) saveBlueprints(s, list);
}

function Preview({ bp }: { bp: Blueprint }) {
  const kinds = [...new Set(bp.parts.map((p) => p.kind))].slice(0, 6);
  return (
    <div className="flex items-center gap-0.5">
      {kinds.map((k) => (
        <img key={k} src={buildingIconUrl(k)} alt="" className="h-6 w-6" />
      ))}
    </div>
  );
}

/** Saved factory layouts: copy an area, then paste it anywhere (with its recipes and filters). */
export function BlueprintPanel({ onClose }: { onClose: () => void }) {
  const game = useGame();
  useGameVersion();
  const [list, setList] = useState<Blueprint[]>(readList);
  const persist = (next: Blueprint[]): void => {
    setList(next);
    writeList(next);
  };
  return (
    <Modal title="청사진 (Blueprint)" onClose={onClose}>
      <Button
        variant="primary"
        className="w-full"
        onClick={() => {
          game.build.setTool({ kind: 'blueprintSelect' });
          onClose();
        }}
      >
        <IconCopy /> 새 청사진: 복사할 영역 드래그
      </Button>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">저장된 청사진이 없습니다. 자주 쓰는 공장 배치를 영역 선택으로 저장해 보세요.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {list.map((bp, i) => (
            <li key={`${bp.name}-${i}`} className="rounded-xl border border-white/10 bg-slate-900/80 p-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-cyan-100">{bp.name}</div>
                  <div className="text-xs text-slate-400">
                    건물 {bp.parts.length}개 · {bp.width}×{bp.height}
                  </div>
                </div>
                <Preview bp={bp} />
              </div>
              <div className="mt-2">
                <CostList cost={blueprintCost(bp)} have={game.world.inventory} />
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => {
                    game.build.setTool({ kind: 'blueprintPaste', blueprint: bp });
                    onClose();
                  }}
                >
                  붙여넣기
                </Button>
                <Button variant="danger" aria-label={`${bp.name} 삭제`} onClick={() => persist(list.filter((_, k) => k !== i))}>
                  <IconTrash />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Shown after an area capture: name the blueprint, save it, and start pasting. */
export function BlueprintNameDialog() {
  const game = useGame();
  useGameVersion();
  const [name, setName] = useState('');
  const bp = game.pendingBlueprint;
  if (!bp) return null;
  const close = (): void => {
    game.pendingBlueprint = null;
    setName('');
    game.notify();
  };
  const save = (): void => {
    const list = readList();
    const named: Blueprint = { ...bp, name: name.trim().slice(0, 40) || `청사진 ${list.length + 1}` };
    writeList([named, ...list]);
    game.pendingBlueprint = null;
    setName('');
    game.build.setTool({ kind: 'blueprintPaste', blueprint: named });
    game.pushToast(`'${named.name}' 저장됨 · 탭해서 붙여넣으세요`, 'success');
  };
  return (
    <Modal title="청사진 저장" onClose={close}>
      <p className="text-sm text-slate-300">
        건물 {bp.parts.length}개 ({bp.width}×{bp.height})를 복사했습니다.
      </p>
      <div className="mt-2">
        <CostList cost={blueprintCost(bp)} have={game.world.inventory} />
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
        }}
        placeholder="청사진 이름 (예: 철판 제련 라인)"
        maxLength={40}
        className="mt-3 h-11 w-full rounded-lg border border-white/10 bg-slate-900 px-3 text-sm"
        aria-label="청사진 이름"
        autoFocus
      />
      <div className="mt-3 flex gap-2">
        <Button variant="primary" className="flex-1" onClick={save}>
          저장 후 붙여넣기
        </Button>
        <Button onClick={close}>취소</Button>
      </div>
    </Modal>
  );
}
