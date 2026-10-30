import { useMemo, useState } from 'react';
import { LAUNCH_DURATION, ROCKET_PARTS_REQUIRED } from '../data/constants';
import type { ToastLevel } from '../core/events';
import { getStorage, loadFromStorage } from '../core/save';
import { createWorld, type World } from '../core/World';
import { continueAfterVictory, rocketProgress } from '../systems/silo';
import { randomSeed } from '../utils/rng';
import { clock } from '../utils/format';
import { Button, cx, Modal } from './common';
import { useGame, useGameVersion } from './GameContext';
import { IconX } from './Icons';

const TOAST_STYLE: Record<ToastLevel, string> = {
  info: 'border-cyan-400/40 bg-slate-900/95 text-cyan-50',
  success: 'border-emerald-400/50 bg-emerald-950/95 text-emerald-50',
  warning: 'border-amber-400/50 bg-amber-950/95 text-amber-50',
  danger: 'border-red-400/60 bg-red-950/95 text-red-50',
};

export function Toasts() {
  const game = useGame();
  useGameVersion();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1 z-30 flex flex-col items-center gap-1 px-2" aria-live="polite">
      {game.toasts.map((t) => (
        <div key={t.id} className={cx('max-w-md rounded-lg border px-3 py-1.5 text-center text-xs font-medium shadow-lg', TOAST_STYLE[t.level])}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

function nextObjective(w: World): string {
  const kinds = new Set<string>();
  for (const b of w.buildings.values()) kinds.add(b.kind);
  if (!kinds.has('mech_drill') && !kinds.has('electric_drill')) return '① 광맥(색깔 자갈) 위에 기계식 드릴을 지으세요';
  if (!kinds.has('conveyor')) return '② 건설 모드에서 손가락을 쭉 드래그해 드릴 → 코어로 벨트를 까세요';
  if (!kinds.has('furnace')) return '③ 제련로를 지어 광석을 판재로 제련하세요';
  if (!kinds.has('power_pole') || (!kinds.has('thermal_generator') && !kinds.has('solar_panel'))) {
    return '④ 화력 발전기/태양광 + 전신주로 제련로에 전력을 공급하세요';
  }
  if (!kinds.has('mg_turret')) return '⑤ 밤 공습 대비: 기관총 포탑을 짓고 투입기·벨트로 탄약을 넣으세요';
  if (!kinds.has('lab')) return '⑥ 연구소를 짓고 연구 트리에서 연구를 시작하세요';
  if (w.research.completed.size === 0) return '⑦ 연구소에 필요한 아이템을 벨트·투입기로 넣으세요';
  if (!w.research.completed.has('rocket_silo')) return `연구 ${w.research.completed.size}/35 — 최종 목표: '궤도 탈출 발사대' 연구`;
  if (!kinds.has('rocket_silo')) return '궤도 탈출 발사대를 건설하세요';
  return `로켓 부품 ${rocketProgress(w).installed}/${ROCKET_PARTS_REQUIRED} 투입 — 발사하면 승리!`;
}

export function ObjectiveHint() {
  const game = useGame();
  useGameVersion();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="pointer-events-auto flex max-w-[calc(100vw_-_11rem)] items-center gap-1 rounded-lg border border-cyan-400/20 bg-slate-950/80 py-0.5 pl-2 text-[11px] text-cyan-100 sm:max-w-md">
      <span className="line-clamp-2">{nextObjective(game.world)}</span>
      <button type="button" className="flex h-11 w-9 shrink-0 items-center justify-center text-slate-400" onClick={() => setHidden(true)} aria-label="목표 숨기기">
        <IconX className="h-4 w-4" />
      </button>
    </div>
  );
}

export function LaunchBanner() {
  const game = useGame();
  useGameVersion();
  const l = game.world.launch;
  if (!l.active || game.world.state !== 'playing') return null;
  const left = Math.max(0, LAUNCH_DURATION - l.timer);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center">
      <div className="rounded-xl border border-rose-300/60 bg-rose-950/80 px-4 py-2 text-center font-black tracking-wide text-rose-50 shadow-[0_0_30px_rgba(244,63,94,0.5)]">
        궤도 탈출 로켓 발사! T-{left.toFixed(1)}
      </div>
    </div>
  );
}

function Starfield() {
  const stars = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 12) * 0.35}s`,
        duration: `${3 + (i % 5)}s`,
        size: 2 + (i % 3),
        color: ['#fde68a', '#67e8f9', '#f9a8d4', '#ffffff'][i % 4] ?? '#ffffff',
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute bottom-0 rounded-full"
          style={{
            left: s.left,
            width: s.size,
            height: s.size,
            background: s.color,
            animation: `rise ${s.duration} linear ${s.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}

/** Victory (rocket escaped) or defeat (core destroyed) screen. */
export function EndScreen() {
  const game = useGame();
  useGameVersion();
  const w = game.world;
  if (w.state === 'playing') return null;
  const victory = w.state === 'victory';
  const restart = (): void => {
    game.loadWorld(createWorld({ seed: randomSeed() }));
    game.save();
  };
  const reload = (): void => {
    const s = getStorage();
    const saved = s ? loadFromStorage(s) : null;
    if (saved && saved.state === 'playing') game.loadWorld(saved);
    else restart();
  };
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true">
      <div
        className={cx(
          'relative w-full max-w-md overflow-hidden rounded-2xl border p-6 text-center shadow-2xl',
          victory ? 'border-amber-300/60 bg-linear-to-b from-indigo-950 to-slate-950' : 'border-red-500/50 bg-linear-to-b from-red-950 to-slate-950',
        )}
      >
        {victory && <Starfield />}
        <div className="relative">
          <h2 className={cx('text-3xl font-black', victory ? 'text-amber-200' : 'text-red-300')}>{victory ? '궤도 탈출 성공!' : '코어 파괴됨'}</h2>
          <p className="mt-2 text-sm text-slate-300">
            {victory ? '로켓 부품 1,000개로 완성한 로켓이 행성을 떠났습니다. 식민지 개척 완료!' : '외계 생명체가 식민지 코어를 파괴했습니다.'}
          </p>
          <dl className="mx-auto mt-4 grid max-w-xs grid-cols-2 gap-1 text-sm">
            <dt className="text-slate-400">플레이 시간</dt>
            <dd className="text-right">{clock(w.time)}</dd>
            <dt className="text-slate-400">생존 일수</dt>
            <dd className="text-right">{w.day}일</dd>
            <dt className="text-slate-400">막아낸 밤</dt>
            <dd className="text-right">{w.waves.night}</dd>
            <dt className="text-slate-400">처치한 외계 생명체</dt>
            <dd className="text-right">{w.kills}</dd>
            <dt className="text-slate-400">완료한 연구</dt>
            <dd className="text-right">{w.research.completed.size}/35</dd>
          </dl>
          <div className="mt-5 flex flex-col gap-2">
            {victory ? (
              <Button
                variant="primary"
                onClick={() => {
                  continueAfterVictory(w);
                  game.notify();
                }}
              >
                계속 플레이 (자유 모드)
              </Button>
            ) : (
              <Button variant="primary" onClick={reload}>
                마지막 저장 불러오기
              </Button>
            )}
            <Button onClick={restart}>새 행성에서 다시 시작</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Astral Factory Tycoon · 조작법" onClose={onClose}>
      <div className="space-y-3 text-sm leading-relaxed text-slate-200">
        <section>
          <h3 className="font-bold text-cyan-200">목표</h3>
          <p>
            광물 채굴 → 벨트 물류 자동화 → 밤마다 몰려오는 외계 생명체 방어 → 35개 연구 → <b>궤도 탈출 발사대</b>에 로켓 부품 1,000개를 넣어 발사하면
            승리합니다.
          </p>
        </section>
        <section>
          <h3 className="font-bold text-cyan-200">터치 조작</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>한 손가락 드래그: 화면 이동 (선택 모드) · 두 손가락: 핀치 줌 + 이동 · 오른쪽 슬라이더로도 줌</li>
            <li>건설 모드에서 벨트·성벽을 손가락으로 쭉 드래그하면 방향을 자동 감지해 직선과 코너가 한 번에 설치됩니다.</li>
            <li>탭: 건물 선택 → 레시피, 필터, 회전, 철거</li>
            <li>청사진: 영역을 드래그해 복사하고, 원하는 곳을 탭해 통째로 붙여넣습니다.</li>
            <li>PC: 휠 줌 · R 회전 · X 철거 · B 청사진 · Space 일시정지 · Esc 취소 · 우클릭 취소</li>
          </ul>
        </section>
        <section>
          <h3 className="font-bold text-cyan-200">공장 팁</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>드릴·제련로·조립기는 인접한 벨트나 건물로 결과물을 자동 배출합니다. 앞이 막히면 벨트가 순서대로 정체됩니다.</li>
            <li>전력 기계는 전신주 반경(3칸) 안에 있어야 합니다. 발전량이 모자라면 공장 전체가 느려집니다.</li>
            <li>태양광은 낮에만 발전하니 대형 축전지로 밤을 버티세요. 화력 발전기는 석탄을 태웁니다.</li>
            <li>실탄 포탑(기관총·샷건·대포)은 탄약을 벨트·투입기로 공급받아야 쏩니다. 레이저·냉각·수리 포탑은 전력을 씁니다.</li>
            <li>공장을 많이 돌릴수록 오염이 퍼집니다. 오염이 둥지에 닿으면 낮에도 습격이 오고, 밤 공습이 거세집니다.</li>
          </ul>
        </section>
      </div>
    </Modal>
  );
}
