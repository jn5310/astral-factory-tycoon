# HANDOFF_LOG

`MASTER_GDD.md` §5에 따른 인수인계 문서입니다. 다음 세션은 이 문서, `MASTER_GDD.md`, `.kiro/steering/ponytail.md` 순서로 읽고 시작하세요.

- 마지막 갱신: 2026-10-30 (Kiro)
- 현재 버전: **1.1.0** (`package.json`의 `version`, `src/core/Game.ts`의 `APP_VERSION`)
- 상태: 1.1.0 배포 완료, 개발 일시 중단. 다음 후보 작업은 광고 수익화(§6)이며 사용자 결정 대기 중입니다.

## 목차
0. [한눈에 보기](#0-한눈에-보기)
1. [다음 세션 시작 체크리스트](#1-다음-세션-시작-체크리스트)
2. [완료된 모듈](#2-완료된-모듈-gdd-5-1)
3. [아키텍처와 설계 결정](#3-아키텍처와-설계-결정)
4. [데이터 스키마](#4-데이터-스키마-gdd-5-3)
5. [남은 태스크와 알려진 이슈](#5-남은-태스크와-알려진-이슈-gdd-5-2)
6. [광고 수익화 계획 (보류)](#6-광고-수익화-계획-보류)
7. [출시와 버전 관리 절차](#7-출시와-버전-관리-절차)
8. [Kiro 샌드박스 작업 메모](#8-kiro-샌드박스-작업-메모)
9. [작업 이력](#9-작업-이력)

---

## 0. 한눈에 보기

| 항목 | 값 |
|---|---|
| 라이브 주소 | https://jn5310.github.io/astral-factory-tycoon/ (`main`에 푸시할 때마다 자동 배포) |
| 저장소 | https://github.com/jn5310/astral-factory-tycoon (public) |
| 기본 브랜치 | `main`. 1.1.0 머지 커밋은 `412ee1d`이고 CI와 Pages 배포 모두 성공 |
| 스택 | TypeScript strict, React 19, Canvas 2D, Web Audio, Tailwind CSS 4, Vite 7, Vitest 3 |
| 런타임 의존성 | `react`, `react-dom`뿐 (GDD §2: 새 패키지 추가 금지) |
| 테스트 | 147개, 10개 스위트, 전부 통과 |
| 빌드 크기 (1.1.0) | JS 562 KB (gzip 175 KB), CSS 53 KB (gzip 9 KB). 이미지·오디오 파일 0개 |
| 언어 | 영어, 한국어. 첫 실행 시 브라우저 언어를 따름 |
| 문서 | `README.md`(영어), `README.ko.md`, `CHANGELOG.md`, `docs/STORE_LISTING.md`, 이 파일 |

---

## 1. 다음 세션 시작 체크리스트

1. **규칙 확인:** `MASTER_GDD.md`를 따릅니다(새 패키지 금지, `any` 금지, 이미지·오디오 파일 금지, 버튼 최소 44px, 디렉터리 구조 준수). `.kiro/steering/ponytail.md`는 최소 변경 원칙과, 답변 끝에 확인 못 한 것과 위험을 1~2줄로 적는 규칙입니다.
2. **브랜치:** `main`에 직접 커밋하지 말고 새 브랜치를 만든 뒤 PR을 엽니다. PR 머지는 사용자가 합니다.
3. **로컬 실행:** Node.js 22에서
   ```bash
   npm install
   npm run dev      # 개발 서버
   npm test         # Vitest
   npm run build    # tsc 타입 검사 + vite build → dist/
   ```
4. **CI:** `.github/workflows/ci.yml`은 모든 브랜치에서 설치, 테스트, 빌드를 하고 `dist` 아티팩트(7일 보관)를 올립니다. `.github/workflows/deploy-pages.yml`은 `main` 푸시 때 테스트, 빌드 후 Pages에 배포합니다.
5. **어디를 고치나 (자주 하는 작업):**

| 하려는 일 | 수정할 곳 |
|---|---|
| 화면 문구 추가·수정 | `src/data/locales/types.ts`(`Messages`) → `en.ts`, `ko.ts` 둘 다. 키가 다르거나 빈 문자열이면 `src/test/i18n.test.ts`가 실패 |
| 언어 추가 | 로케일 파일 추가 후 `src/utils/i18n.ts`의 `LANGS`, `MESSAGES`, `isLang` 등록, 타이틀·설정의 언어 버튼은 `LANGS`를 자동으로 따름 |
| 밸런스 수치 | §2.3 표의 파일 |
| 건물 추가 | `src/data/buildings.ts`(정의), 로케일 `buildings`, `src/core/renderBuildings.ts`(그리기), `src/ui/buildingIcon.ts`(아이콘), 필요하면 `src/systems/placement.ts`, 연구 해금은 `src/data/research.ts` |
| 아이템·레시피 추가 | `src/data/items.ts`, `src/data/recipes.ts`, `src/utils/itemIcons.ts`, 로케일 `items`/`recipes` |
| 적 추가 | `src/data/enemies.ts`, `src/systems/enemyAI.ts`, `src/core/renderUnits.ts`, `src/ui/enemyIcon.ts`, 로케일 `enemies` |
| 임무 추가 | `src/data/missions.ts`(`MISSION_IDS`, `MISSIONS`), 새 목표 종류는 `src/systems/missions.ts`, 로케일 `missionRadio`와 `missions` |
| 업적 추가 | `src/data/achievements.ts`, `src/systems/achievements.ts`(`isAchieved`, `achievementProgress`), 로케일 `achievements` |
| 무작위 이벤트 추가 | `src/data/worldEvents.ts`, `src/systems/director.ts`(`triggerEvent`), 효과는 `src/systems/modifiers.ts`, 연출은 `src/core/renderer.ts`, 로케일 `worldEvents` |
| 사령관 능력 추가 | `src/data/abilities.ts`, `src/systems/abilities.ts`, `src/ui/AbilityBar.tsx`, 해금 임무는 `src/data/missions.ts`의 `unlock` |
| 효과음 추가 | `src/core/events.ts`의 `SoundName`, `src/utils/sound.ts`의 합성 정의, 전역 소리면 `Game.ts`의 `GLOBAL_SOUNDS` |
| 저장 항목 추가 | `src/core/save.ts`(`SaveData`, `serializeWorld`, `deserializeWorld`/`restoreRunState`). §4.5 규칙 참고 |

---

## 2. 완료된 모듈 (GDD §5-1)

### 2.1 파일별 역할

| 영역 | 파일 |
|---|---|
| 엔진·루프 | `src/core/Game.ts`: rAF 루프, 60 Hz 고정 스텝, 속도 0~3배, 타이틀/플레이 화면 전환, 새 게임·이어하기·타이틀로, 이벤트 → 효과음/토스트/무전 처리, 자동 저장, 프로필(업적·도감·점수), 음악 분위기, React용 구독 스토어. `src/core/engine.ts`: `stepWorld`(업데이트 순서). `src/core/World.ts`: 월드 상태와 `createWorld` |
| 입력·카메라 | `src/core/input.ts`(포인터: 이동, 핀치, 탭, 드래그, 휠, 우클릭 취소), `src/core/camera.ts`, `src/core/build.ts`(도구 선택, 스마트 드래그, 청사진, 보급 캡슐 탭, 사령관 능력 조준, 미리보기) |
| 렌더링 | `src/core/renderer.ts`(지형, 건물, 유닛, 유성·보급 캡슐, 모래 폭풍·붉은 달 연출, 조준 원, 떠오르는 글자, 흔들림·섬광), `renderBuildings.ts`, `renderUnits.ts`, `terrainLayer.ts`, `minimap.ts`(공격 알림 핑), `src/utils/draw.ts` |
| 아이콘 | `src/utils/itemIcons.ts`, `src/ui/buildingIcon.ts`, `src/ui/enemyIcon.ts`: 실행 중 캔버스로 그려 data URL로 만듦(제로 에셋) |
| 저장·프로필 | `src/core/save.ts`(세이브 v2, v1 호환, JSON 내보내기·가져오기 검증, 20 MB 제한), `src/core/profile.ts`(업적, 도감, 최고 기록, 일일 최고, 불러올 때 정제) |
| 물류 | `src/systems/belts.ts`, `logistics.ts`(물류 블록 8종, 투입기, 생산 건물 배출) |
| 생산 | `src/systems/production.ts`(드릴, 제작 건물 4종), `silo.ts`(로켓 조립, 발사, 승리, 승리 후 자유 플레이) |
| 전력 | `src/systems/power.ts`(순수 함수 `computeBalance`, 크루스칼 전신주 연결, 전력망별 공급률), `daynight.ts` |
| 연구 | `src/systems/research.ts`, `src/data/research.ts`(35개 노드) |
| 적·방어 | `src/systems/pathfinding.ts`(A*, 이진 힙, 경로 캐시와 틱당 예산), `enemyAI.ts`, `combat.ts`(전리품, 포탑 진급, 공격 알림), `waves.ts`, `pollution.ts`, `quadtree.ts` |
| 1.1 런 기능 | `src/systems/missions.ts`, `abilities.ts`, `director.ts`(무작위 이벤트, 유성, 보급 캡슐), `modifiers.ts`(난이도·일일 변수·이벤트·오버클럭 배율), `achievements.ts`, `score.ts`, `src/data/difficulty.ts`, `src/utils/daily.ts` |
| 다국어 | `src/data/locales/types.ts`, `en.ts`, `ko.ts`, `src/utils/i18n.ts`(`msg()`, 언어 감지, 이름 헬퍼, `readingMs`) |
| 오디오 | `src/utils/sound.ts`(효과음 29종 합성, 음악·효과음 볼륨 분리), `src/utils/music.ts`(생성형 음악: title, calm, tense, boss) |
| 공유 | `src/utils/share.ts`(캔버스 + 캡션으로 PNG 생성, Web Share API, 안 되면 다운로드) |
| UI | `src/ui/` 아래: `TitleScreen`, `TopBar`, `BuildBar`, `Inspector`, `ResearchTree`, `StatsPanel`, `Minimap`(+줌 컨트롤), `GameMenu`, `SettingsPanel`, `BlueprintPanel`, `StatusPanel`(임무 카드, 보스 바, 이벤트 칩), `AbilityBar`, `RadioBox`, `MetaPanels`(업적, 도감), `Overlays`(토스트, 발사 배너, 승리·패배 화면, 도움말), `Hud`(배치), `common.tsx`(Button, Modal, Segmented, ProgressBar 등), `GameContext.tsx`(`useGame`, `useGameVersion`, `useMsg`) |
| 테스트 | `src/test/`: belts 19, build 8, defense 7, features 27, i18n 8, logistics 10, pathfinding 18, power 16, recipes 14, systems 20 (합계 147), 공용 `helpers.ts` |
| 배포 | `.github/workflows/ci.yml`, `.github/workflows/deploy-pages.yml`. `vite.config.ts`의 `base: './'` 덕분에 같은 빌드가 어느 정적 호스팅에서나 동작 |

### 2.2 게임 콘텐츠 목록

- **지도:** 120×120, 시드 기반 펄린 지형(평지, 물, 암반), 광물 6종(철, 구리, 석탄, 돌, 실리콘 모래, 티타늄). 코어 주변 시작 구역과 둥지→코어 경로를 보장합니다.
- **아이템 30종, 레시피 24종, 건물 29종**(코어 포함). 물류 블록 8종, 포탑 6종(기관총, 샷건, 장거리 대포, 레이저, 냉각, 수리), 성벽 2종, 코어 기관포.
- **연구:** 5단계 × 7 = 35개 노드.
- **적 8종:** rusher, charger, spitter, bomber, flyer, brood(죽으면 분열), healer, leviathan(5번째 밤마다 보스).
- **모드 3종:** `standard`(캠페인), `sandbox`(전부 해금, 무료 건설, 아이템 20,000개씩, 공격 없음, 기록 없음), `daily`(UTC 날짜 기반, 보통 난이도 고정).
- **난이도 5단계:** peaceful, easy, normal, hard, nightmare.
- **일일 변수 4종:** swarm, richVeins, solarAge, meteorSeason (`none`은 다른 모드용).
- **임무 24개** 순서와 해금: first_drill, conveyor, ore_flow, smelter, power_on, plates, defense, **first_night(궤도 폭격)**, lab, research_2, gears, **hunter(긴급 수리)**, circuits, scavenger, steel, **nights_5(오버클럭)**, research_10, power_grid, titanium, **boss(냉각 펄스)**, processors, research_25, silo, escape. 평화 난이도에서는 처치 목표 임무를 건너뛰되 해금은 줍니다.
- **사령관 능력 4종:** orbital, repair, overclock, cryo.
- **무작위 이벤트 6종:** meteor, supplyDrop, solarFlare, dustStorm, oreSurge, bloodMoon.
- **업적 21개:** first_blood, exterminator, belt_baron, megawatt, night_owl, untouchable, boss_slayer, scientist, omniscient, escape, speedrun, hardcore, hoarder, industrialist, ace, commander, treasure_hunter, stargazer, smog, daily, storyteller.
- **포탑 계급 4단계:** Rookie(신병), Veteran(베테랑), Elite(정예), Ace(에이스).

### 2.3 밸런스 수치와 위치

| 수치 | 값 | 파일 |
|---|---|---|
| 하루 길이 / 밤 시작 / 시작 시각 | 360초 / 위상 0.62(밤 약 137초) / 위상 0.08 | `src/data/constants.ts` |
| 승리 조건 | 로켓 부품 1,000개, 발사 카운트다운 9초 | `src/data/constants.ts` |
| 자동 저장 | 60초마다 + 탭 숨김·페이지 이탈 시 | `src/data/constants.ts`, `Game.ts` |
| 웨이브 예산 | `(6 + 1.6n² + 5n) × (1 + min(3, 오염/3000))` × 난이도 × 일일 변수 × 붉은 달 | `src/systems/waves.ts` `waveBudget`, `modifiers.ts` |
| 보스 | n번째 밤이 5의 배수면 레비아탄 `n/5`마리 | `src/systems/waves.ts` `composeWave` |
| 오염 습격 | 둥지 오염 4 이상이면 50초마다 최대 10마리 | `src/systems/waves.ts` |
| 난이도 | 웨이브 배율 0 / 0.6 / 1 / 1.4 / 2, 적 체력 1 / 0.8 / 1 / 1.25 / 1.6, 시작 자원 1.5 / 1.3 / 1 / 0.8 / 0.6, 점수 배율 0.25 / 0.7 / 1 / 1.5 / 2.2 | `src/data/difficulty.ts` |
| 일일 변수 | swarm 웨이브 ×1.5, 전리품 ×1.6 · richVeins 드릴 ×1.5 · solarAge 태양광 ×1.6 · meteorSeason 이벤트 간격 ×0.5, 유성 가중치 ×4 | `src/data/difficulty.ts` |
| 사령관 능력 | 궤도 폭격 쿨타임 80초(반경 4.5, 피해 700, 1.5초 뒤 착탄) · 긴급 수리 120초(체력 50% 회복) · 오버클럭 150초(20초간 생산 2배) · 냉각 펄스 110초(6초 빙결, 피해 40) | `src/data/abilities.ts` |
| 이벤트 | 첫 이벤트 200초, 이후 150~250초 간격. 가중치: 유성 3, 보급 4, 태양 폭풍 2, 모래 폭풍 2, 광맥 활성화 2, 붉은 달 1.5. 지속 이벤트 60초. 태양 폭풍 ×2.2, 모래 폭풍 ×0.35, 광맥 ×1.5, 붉은 달 웨이브 ×1.6, 전리품 ×2 | `src/data/worldEvents.ts` |
| 유성우 | `min(12, 5 + day/2)`개, 피해 70, 반경 1.6. 광맥은 티타늄 55%, 철 25%, 구리 20% | `src/systems/director.ts`, `worldEvents.ts` |
| 보급 캡슐 | 동시에 최대 2개, 180초 뒤 소멸. 내용물은 연구 수와 날짜에 비례 | `src/systems/director.ts` `rollLoot` |
| 포탑 진급 | 10 / 30 / 75킬, 계급당 피해 +15% | `src/data/turrets.ts` |
| 점수 | 처치 10, 밤 300, 연구 250, 임무 150, 생산 20개당 1, 탈출 20,000, 30일 전 발사 시 하루당 500, 마지막에 난이도 배율 | `src/systems/score.ts` |
| 업적 목표 | exterminator 500, belt_baron 150, megawatt 1000 kW, night_owl 10, scientist 20, omniscient 35, speedrun 25일 전, hoarder 20,000, industrialist 10,000, treasure_hunter 10, smog 8,000 | `src/data/achievements.ts` |

---

## 3. 아키텍처와 설계 결정

### 3.1 흐름
- **시뮬레이션:** `stepWorld(world)`가 1/60초 고정 스텝으로 결정적으로 진행되고 DOM을 건드리지 않습니다. 순서는 웨이브 → 적 이동 → 이벤트(director) → 능력 → 전력 → 생산 → 물류 → 포탑 → 투사체 → 오염 → 보급 캡슐이고, 그 뒤 임무, 발사, 파티클, 통계를 갱신합니다. 임무와 발사는 승리 후에도 돌아서 마지막 "탈출" 임무가 완료됩니다. 브라우저 루프와 테스트가 같은 코드를 씁니다.
- **이벤트 큐:** 시스템은 `world.events`에 `GameEvent`(`src/core/events.ts`)를 넣기만 합니다. `Game.drainEvents()`가 매 프레임 이를 비우면서 효과음, 토스트, 무전, 화면 흔들림, 승리·패배를 처리합니다. 헬퍼는 `src/core/grid.ts`의 `toast`, `radio`, `playSound`, `pushEvent`입니다.
- **UI 스토어:** `Game`이 `subscribe`/`getVersion`/`notify`를 가진 작은 스토어 역할을 합니다. React는 `useGameVersion()`(useSyncExternalStore)으로 다시 그립니다. Zustand 같은 외부 상태 라이브러리는 쓰지 않습니다.
- **`world.visuals`:** 테스트에서는 꺼서 파티클 생성을 생략합니다.

### 3.2 설계 결정과 이유
- **다국어:** 직접 만든 `Messages` 인터페이스(문자열 또는 포맷 함수)를 씁니다. 패키지 추가가 금지라 i18next 같은 라이브러리는 쓰지 않았습니다. 시스템이 토스트나 무전을 만들 때 그 시점의 `msg()`로 문장을 완성합니다. 그래서 언어를 바꿔도 이미 떠 있는 토스트는 이전 언어로 남습니다(사소함).
- **세이브 v2:** 새 항목은 전부 선택 항목이고 `MIN_SAVE_VERSION = 1`이라 기존 세이브가 깨지지 않습니다.
- **유성 광맥:** 지형은 시드로 다시 만들기 때문에, 유성이 바꾼 칸만 `world.oreEdits`에 저장해 불러올 때 다시 적용합니다.
- **사령관 능력은 임무로 해금:** 연구 트리를 GDD 사양대로 35개로 유지하려고 연구 노드를 늘리지 않았습니다.
- **업적·도감·최고 기록은 프로필 단위:** 시뮬레이션이 아니라 `Game.updateMeta()`(1초마다)와 `Game.finishRun()`에서 처리합니다. 샌드박스는 아무것도 기록하지 않습니다.
- **일일 도전:** `dailyKey`는 UTC 날짜(YYYY-MM-DD), 시드는 날짜의 FNV-1a 해시, 변수는 `날짜:twist` 해시로 고릅니다. 모든 플레이어가 같은 날 같은 행성을 받습니다.
- **세이브 슬롯은 하나:** 새 게임 설정 창에는 덮어쓰기 경고가 있고, 일일 도전 버튼은 세이브가 있으면 확인 창을 먼저 띄웁니다.
- **패배 후 타이틀로:** 패배한 식민지는 자동 저장하지 않으므로, 타이틀로 나갈 때 마지막 자동 저장을 다시 불러와 "이어하기"를 보여 줍니다(`Game.quitToTitle`).
- **기록은 식민지당 한 번:** `finishRun`은 `recordedWorld`로 같은 월드의 중복 기록을 막습니다.
- **토스트:** 같은 문구는 하나로 합치고(시간 연장, "보기" 위치 갱신) 최대 3개까지 띄웁니다.
- **무전:** 표시 시간은 `readingMs`로 정합니다. 한글 음절은 라틴 문자 2개로 쳐서 계산하고, 최소 6초입니다. 패널이 열려 있으면(`Game.panelOpen`, `Hud`가 설정) 시간이 흐르지 않습니다.
- **한국어 줄바꿈:** `src/index.css`의 `:lang(ko) { word-break: keep-all; overflow-wrap: break-word; }`. `Game.applyDocumentLanguage()`가 `<html lang>`을 바꿉니다.
- **폰트:** 웹폰트를 넣지 않고 시스템 폰트 스택(`--font-sans`: system-ui, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR 등)을 씁니다.
- **음악:** 오디오 파일 없이 Web Audio로 생성합니다. 분위기는 `Game.moodFor()`가 고릅니다(레비아탄이 있으면 boss, 밤 웨이브 중이거나 적 6마리 이상이면 tense).
- **공유:** 서버 없이 브라우저에서 PNG를 만들고 Web Share API를 씁니다. 지원하지 않으면 파일로 내려받습니다.
- **GitHub Pages:** 별도 배포 워크플로를 씁니다. Pages 활성화 API는 에이전트 토큰으로 403이 나서 사용자가 Settings → Pages → Source: GitHub Actions를 직접 켰습니다(1회).

---

## 4. 데이터 스키마 (GDD §5-3)

모든 데이터는 브라우저 `localStorage`에 있습니다.

### 4.1 `astral-factory-save-v1`: 세이브 (`SaveData`, `src/core/save.ts`)
- 현재 `version: 2`. 키 이름의 `v1`은 처음 정한 이름일 뿐이고, 실제 버전은 내용의 `version` 필드입니다.
- 지형은 저장하지 않고 `seed`로 다시 만듭니다.
- v1부터 있던 필드: `seed`, `width`, `height`, `time`, `day`, `dayPhase`, `kills`, `nextId`, `nextEnemyId`, `inventory`, `research`(`completed`, `current`, `progress`), `waves`(`night`, `triggered`, `active`), `pollution`(청크 값 배열), `launch`, `lastRecipe`, `buildings[]`, `enemies[]`.
- v2에서 추가된 선택 필드:
  - `settings`: `{ mode, difficulty, mutator, dailyKey }`
  - `missions`: `{ index, baseline }`
  - `abilities`: `{ unlocked[], cooldown{}, overclock, used[] }`
  - `director`: `{ timer, effect | null, bloodMoon }`. 떨어지는 중인 유성은 저장하지 않습니다.
  - `pickups[]`: 보급 캡슐, 최대 8개까지 복원
  - `counters`: `nightsSurvived`, `bossKills`, `buildingsLost`, `nightLosses`, `cleanNights`, `dropsCollected`, `meteorShowers`, `salvage`, `peakPower`, `launches`, `launchDay`
  - `oreEdits`: `[칸 인덱스, 광물 번호][]`
  - `lifetime`: `{ produced, consumed }` (누적 생산·소비 통계)
  - `buildings[].turret.kills` (포탑 진급용)
- **저장하지 않는 것:** `world.state`(불러오면 항상 `playing`, 승리 후 세이브는 자유 플레이로 이어짐), 투사체, 파티클, 떨어지는 중인 유성, 경로 캐시.

### 4.2 `astral-factory-profile-v1`: 프로필 (`Profile`, `src/core/profile.ts`)
- `achievements`: 업적 id → 달성 시각(ms)
- `seenEnemies`: 도감에 기록된 적 종류
- `highScores`: 상위 10개 `{ score, mode, difficulty, day, victory, date, seed }`
- `dailyBest`: `YYYY-MM-DD` → 그날 최고 점수, 최근 60일치
- `runs`: 시작한 게임 수(0이면 첫 실행이라 도움말을 자동으로 엶), `wins`
- 불러올 때 `sanitizeProfile`이 잘못된 값을 버립니다.

### 4.3 `astral-factory-settings-v1`: 설정
- `{ lang, muted, sfxVolume, musicVolume, showPollution }`
- 1.0의 `volume` 값은 `sfxVolume`으로 읽습니다.

### 4.4 `astral-factory-blueprints-v1`: 청사진
- `Blueprint[]` (`src/systems/blueprint.ts`), 최대 50개.

### 4.5 스키마를 바꿀 때 규칙
- 새 세이브 필드는 선택 필드로 추가하고 `restoreRunState`에서 없을 때 기본값을 유지합니다.
- 형식이 호환되지 않게 바뀔 때만 `src/data/constants.ts`의 `SAVE_VERSION`을 올리고, 가능하면 `MIN_SAVE_VERSION`은 유지합니다. 플레이어 세이브를 잃지 않는 것이 우선입니다.
- `src/test/features.test.ts`의 "saves v2" 테스트(v2 왕복, v1 불러오기)를 함께 갱신합니다.
- 가져오기(JSON import)는 신뢰할 수 없는 입력이라 크기 제한과 값 검증을 유지해야 합니다.

---

## 5. 남은 태스크와 알려진 이슈 (GDD §5-2)

### 5.1 아직 검증하지 못한 것 (큰 홍보 전에 권장)
- **밸런스:** 헤드리스 실행과 짧은 브라우저 테스트만 했습니다. 난이도별로 로켓 발사까지 끝까지 플레이해 본 적이 없습니다. §2.3 수치를 실제 플레이 후 조정하세요.
- **소리:** 헤드리스 브라우저에서 오류만 확인했고 실제 기기로 들어 보지 않았습니다.
- **한국어 화면:** 샌드박스에 한글 폰트가 없어서 대체 폰트(나눔고딕)를 주입해 확인했습니다. 실제 기기에서는 시스템 폰트를 씁니다.
- **실기기:** iOS Safari, Android Chrome 실기기에서는 확인하지 않았습니다(헤드리스 Chromium 모바일 에뮬레이션만).

### 5.2 저장소 관리
- **lockfile 없음:** 샌드박스가 npm 레지스트리에 접속하지 못해 `package-lock.json`이 없습니다. CI는 `package.json` 범위 안의 최신 버전을 설치합니다. npm이 되는 환경에서 `npm install` 후 lockfile을 커밋하고 CI를 `npm ci`로 바꾸는 걸 권합니다.
- **라이선스 없음:** 사용자가 정해야 합니다.
- **E2E 테스트 없음:** CI에는 단위 테스트만 있습니다. Playwright를 넣으려면 개발 의존성 추가라 GDD 규칙상 사용자 허락이 필요합니다.

### 5.3 알려진 사소한 이슈
- 도움말 창이 열려 있어도 게임 시간은 흐릅니다(무전만 멈춤).
- 같은 일일 도전을 패배 후 이어하기로 다시 하면 점수가 여러 번 기록될 수 있습니다(의도적으로 관대하게 둠).
- `finishRun`이 같은 월드에 두 번 불리면 두 번째 호출이 `result.rank`를 -1로 덮어써서 "신기록!"이 사라집니다. 실제 게임에서는 패배·승리 이벤트가 한 번만 나와 발생하지 않습니다(개발자 도구로 이벤트를 넣을 때만 재현).
- 언어를 바꿔도 이미 떠 있는 토스트와 무전은 이전 언어로 남습니다.
- 성벽 그래픽이 옆 성벽과 이어지지 않습니다. 줌 7 미만에서는 성능을 위해 벨트 위 아이템을 그리지 않습니다.
- 링크 미리보기용 `og:image`가 없습니다. 크롤러는 JS를 실행하지 않아 이미지 파일이 필요한데, 제로 에셋 규칙과 충돌합니다. 넣으려면 사용자가 예외를 허락해야 합니다.

### 5.4 백로그 (하지 않은 기능)
- §6 광고 수익화
- PWA(홈 화면 설치, 오프라인), 세이브 슬롯 여러 개(일일 도전 전용 슬롯), 온라인 리더보드, 게임패드, 도움말 중 일시정지

---

## 6. 광고 수익화 계획 (보류)

사용자가 "해외 대상으로 배포해 트래픽이 늘면 광고 수익을 얻고 싶다"고 했고, 조사와 계획까지만 하고 구현은 보류했습니다. 아래 사실은 **2026-10-30에 검색 결과 요약으로 확인한 것**입니다(공식 페이지는 샌드박스에서 403으로 직접 열리지 않았음). 약관과 수익 배분은 바뀌므로 진행 전에 다시 확인하세요.

### 6.1 사용자가 정해야 할 것
1. 경로: 포털 우선, 자체 사이트 우선, 또는 둘 다(추천: 둘 다, 포털 지원을 먼저)
2. 도메인 이름과 구입 여부
3. 보상형 광고의 보상 종류(아래 후보 중 선택, 밸런스에 영향)
4. 방문자 분석 도구를 넣을지 여부(넣으면 "추적 없음" 문구와 개인정보처리방침이 바뀜)

### 6.2 경로 A: 웹게임 포털
- **Poki:** 포털 사용자 수익은 나누고, 즐겨찾기·검색·SNS 등으로 직접 온 사용자의 수익은 100% 개발자 몫 ([Poki](https://developers.poki.com/guide/working-with-poki)). 이미 다른 웹 플랫폼에 있는 게임에는 수익 배분 대신 1회 라이선스비를 제안할 수 있음 ([Poki](https://developers.poki.com/guide/revenue-deal-types)). **다른 포털보다 먼저 지원**하는 게 유리합니다.
- **CrazyGames:** Basic Launch는 광고와 수익이 없고 SDK가 선택 사항. 지표가 좋으면 SDK를 연동한 Full Launch에서 광고 수익 ([CrazyGames](https://docs.crazygames.com/requirements/intro/), [정리](https://playgama.com/blog/business-faqs/what-are-the-differences-between-crazygames-basic-launch-and/)).
- **GameDistribution:** 순수익의 33%, 지급 기준 €100으로 알려짐 ([정리](https://playgama.com/blog/business-faqs/poki-vs-crazygames-vs-gamedistribution-revenue-share/)).
- 포털이 광고, 동의 팝업, 심사를 처리하지만 포털마다 SDK 연동이 따로 필요합니다.

### 6.3 경로 B: 자체 사이트 + Google AdSense
- **게임 내 광고:** AdSense "H5 게임 광고"(전면 + 보상형, Ad Placement API의 `adBreak()`/`adConfig()`) ([Google](https://developers.google.com/ad-placement/apis)). 베타라 신청서 제출 후 승인 필요 ([AdSense](https://support.google.com/adsense/answer/1705831?hl=pt-br)).
- **도메인:** ads.txt를 루트 도메인에 둬야 하는데 ([AdSense](https://support.google.com/adsense/answer/9785052)), 지금 주소는 루트를 쓸 수 없는 프로젝트 페이지입니다 ([Stack Overflow](https://stackoverflow.com/questions/69243354/can-i-use-adsense-with-github-pages/76695110)). 자체 도메인을 권합니다.
- **호스팅:** GitHub Pages는 온라인 비즈니스용 무료 호스팅으로 쓰는 것을 금지합니다 ([GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)). 광고 몇 개가 붙은 개인 게임이 해당하는지는 애매합니다. Cloudflare Pages 무료 플랜은 상업적 이용이 허용됩니다 ([Cloudflare 커뮤니티](https://community.cloudflare.com/t/is-commercial-use-allowed-on-the-free-plan-for-pages-functions-kv/971058/2)).
- **동의 팝업:** EEA·영국·스위스 사용자에게 광고하려면 Google 인증 CMP(TCF 연동)가 필수입니다(2024-01-16부터) ([AdSense](https://support.google.com/adsense/answer/7670013?hl=en)). Google 자체 CMP로 충족 가능하고 미국 주별 안내도 지원합니다 ([AdSense](https://support.google.com/adsense/answer/16918505?hl=en)).
- **심사:** 화면 하나뿐인 게임 사이트는 "가치 낮은 콘텐츠"로 거절되기 쉽습니다 ([AdSense 커뮤니티](https://support.google.com/adsense/community-guide/241032356/how-can-you-solve-the-low-value-content-adsense-disapproval-challenge)). 개인정보처리방침, 공략 가이드, 업데이트 기록 같은 텍스트 페이지를 함께 둡니다.
- **사용자 몫:** AdSense 계정(본인 인증, 세금 정보, 지급 계좌), H5 광고 신청, 도메인 구입·연결.

### 6.4 구현 설계 (승인되면 이대로)
1. **광고 모듈** `src/utils/ads.ts`: `showInterstitial(placement)`, `showRewarded(placement): Promise<boolean>`. 공급자는 빌드 변수 `VITE_ADS`(`none` | `adsense` | `poki` | `crazygames`)로 고르고 기본값은 `none`(아무것도 안 함). SDK 스크립트는 켰을 때만 동적으로 불러오고, 불러오기에 실패해도 게임은 그대로 돌아가야 합니다. 같은 코드로 포털별 빌드를 뽑습니다.
2. **광고 중 처리:** 시작 전에 `Game.setSpeed(0)`과 음소거, 끝나면 이전 상태로 복원(Ad Placement API의 `beforeAd`/`afterAd`, 포털 SDK의 해당 콜백).
3. **보상형 광고 후보:** 보급 캡슐 즉시 호출, 사령관 능력 쿨타임 즉시 충전, 패배 시 코어 1회 부활(런당 1회), 임무 보상 2배. 버튼은 플레이어가 누를 때만 광고가 나옵니다.
4. **전면 광고:** 승리·패배 화면 뒤, 새 게임 시작 전, 타이틀로 나갈 때만. 밤 웨이브나 보스전 중에는 금지하고 최소 간격(예: 3분)을 둡니다.
5. **배너:** 넣는다면 타이틀 화면에만. 게임 화면 위에 겹치지 않게 합니다(오클릭 유도는 정책 위반).
6. **정적 파일:** `public/privacy.html`(영어·한국어 개인정보처리방침), `public/ads.txt`(AdSense 쓸 때). Vite가 `public/`을 `dist/` 루트로 복사합니다. 이미지·오디오가 아니므로 제로 에셋 규칙과 충돌하지 않습니다.
7. **설정 화면:** 유럽 사용자가 동의를 다시 바꿀 수 있는 "개인정보 설정" 버튼.
8. **테스트:** `VITE_ADS=none`일 때 아무 일도 없는지, 보상 콜백이 성공했을 때만 보상을 주는지, 전면 광고 간격 제한.

### 6.5 광고를 넣으면 반드시 같이 고칠 문구
지금은 "광고 없음, 추적 없음"을 여러 곳에서 약속하고 있어서, 광고를 켜는 순간 사실과 달라집니다.
- `src/data/locales/en.ts`, `ko.ts`의 `title.footer`("No ads, no tracking..." / "광고도, 추적도 없습니다...")
- `README.md`, `README.ko.md`: 소개 문단의 "no ads, no tracking", **Privacy** / **개인정보** 섹션
- `docs/STORE_LISTING.md`: Price 줄, 기능 목록의 "no ads and no tracking", 긴 설명 마지막 문단, Content rating notes, Privacy statement(영어·한국어)
- `CHANGELOG.md`에 새 버전 항목, 앱 버전 올리기(§7)

---

## 7. 출시와 버전 관리 절차

1. 브랜치에서 작업하고 PR을 엽니다. CI(테스트 + 빌드)가 통과해야 합니다.
2. 버전을 올릴 때는 **두 곳**을 같이 바꿉니다: `package.json`의 `version`, `src/core/Game.ts`의 `APP_VERSION`(타이틀 화면에 표시). `CHANGELOG.md`에 항목을 추가합니다.
3. 사용자가 PR을 머지하면 `deploy-pages.yml`이 자동으로 GitHub Pages에 배포합니다(1분 안팎).
4. itch.io 같은 포털 업로드: `docs/STORE_LISTING.md`의 "Publishing the HTML5 build on itch.io" 절차를 따릅니다. CI의 `dist` 아티팩트를 그대로 압축해 올리면 됩니다. 사이트마다 localStorage가 따로라 세이브는 공유되지 않습니다(JSON 내보내기·가져오기로 옮김).
5. 스토어 소개 문구, 태그, 스크린샷 목록, 개인정보 문구는 `docs/STORE_LISTING.md`에 영어·한국어로 있습니다.

---

## 8. Kiro 샌드박스 작업 메모

다음 세션도 Kiro 웹 샌드박스라면 아래 제약이 그대로일 가능성이 큽니다.

- **npm 레지스트리 차단(403):** `npm install`이 안 됩니다. 테스트는 `timeout 600 bun test src/test`(저장소 폴더에서)로 돌릴 수 있습니다. bun이 `vitest` import를 그대로 처리합니다.
- **타입 검사:** 이전 세션은 저장소 밖 `/projects/sandbox/verify/`에 `tsconfig.json`(UI 제외)과 `tsconfig.app.json`(UI 포함, React 타입을 GitHub API로 받아 둠)을 만들어 `tsc -p ...`로 검사했습니다. 새 샌드박스에는 없으니, 가장 쉬운 방법은 **브랜치에 푸시해 CI를 기준으로 삼는 것**입니다.
- **CI 결과와 빌드 받기:** `gh run list`는 호스트 설정 문제로 실패하므로 REST API를 씁니다.
  ```bash
  SHA=$(git rev-parse HEAD)
  gh api "repos/jn5310/astral-factory-tycoon/actions/runs?head_sha=$SHA" --jq '.workflow_runs[] | {id, name, conclusion}'
  ART=$(gh api repos/jn5310/astral-factory-tycoon/actions/runs/<RUN_ID>/artifacts --jq '.artifacts[0].id')
  gh api repos/jn5310/astral-factory-tycoon/actions/artifacts/$ART/zip > dist.zip
  python3 -c "import zipfile; zipfile.ZipFile('dist.zip').extractall('dist')"
  ```
- **PR 만들기:** `gh pr create`는 동작하지 않습니다. `gh api repos/jn5310/astral-factory-tycoon/pulls -f title=... -F body=@파일 -f head=브랜치 -f base=main`을 씁니다.
- **브라우저 스모크 테스트(Playwright 파워, `browser_run_code_unsafe`):**
  - `browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale: 'en-US' 또는 'ko-KR' })`로 만들고, `ctx.route('http://astral.test/**', ...)`에서 `route.fulfill({ path: dist경로 + 요청경로 })`로 받은 빌드를 서빙합니다.
  - 이 실행 환경에는 `require`, `URL`이 없으니 문자열 처리로 경로를 자릅니다.
  - 다음 호출에서는 `page.context().browser().contexts()`의 마지막 컨텍스트 페이지를 꺼내 `bringToFront()` 해야 화면이 갱신됩니다.
  - `Game` 인스턴스는 `#root`의 `__reactContainer$...` 파이버를 따라가 `memoizedProps.game`을 찾아 `window.__game`에 둡니다(`addInitScript`로 헬퍼 주입).
  - 한글 폰트가 없어서 한글이 네모로 보입니다. `gh api -H "Accept: application/vnd.github.raw" repos/google/fonts/contents/ofl/nanumgothic/NanumGothic-Regular.ttf`로 폰트를 받아 라우트로 서빙하고, `@font-face`로 등록한 뒤 font-family 맨 앞에 두면 보입니다(뒤에 두면 여전히 네모).
  - 스크린샷은 `/projects/sandbox/.kiro/artifacts/screenshots/`에 저장되는데, 파일 읽기가 몇 초에서 수십 초 늦게 반영됩니다.
  - 모달 안 버튼은 `getByRole('dialog').getByRole('button', ...)`로 좁혀야 합니다(무전 상자의 닫기 버튼과 이름이 같음).
- **웹 접근:** github.io, AdSense 도움말, Poki, CrazyGames 문서는 `web_fetch`가 403이라 검색 결과 요약만 쓸 수 있었습니다.

---

## 9. 작업 이력

| 시점 | 내용 |
|---|---|
| PR #1 (`786adbc`) | 1.0.0: 게임 전체 구현(지도, 물류, 생산, 전력, 연구, 적, 방어, 오염, 저장, UI, 테스트 112개), Ponytail 스티어링 파일 추가 |
| PR #2 (`874fe2b`) | GitHub Pages 자동 배포 워크플로. 사용자가 Pages를 Actions 방식으로 활성화 |
| PR #3 (`412ee1d`) | 1.1.0: 영어·한국어, 타이틀 화면, 모드·난이도·일일 도전, 임무 24개, 사령관 능력 4종, 무작위 이벤트 6종, 전리품·진급, 보스 바, 점수·공유, 업적·도감, 생성형 음악, 세이브 v2, 문서(README 2종, CHANGELOG, 스토어 자료). 실제 화면 테스트로 찾은 문제 수정(이벤트 칩 겹침, 일일 도전 덮어쓰기 확인, 한국어 줄바꿈, 무전 시간, 연구 버튼 위치 등). 테스트 147개 |
| 이번 PR | 이 인수인계 문서 정리(한국어), 광고 수익화 조사와 계획 기록 |
