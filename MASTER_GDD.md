[MASTER GDD & AI HANDOFF SPECIFICATION]
프로젝트 명: [Astral Factory Tycoon]

문서 버전: v1.0.0

목적: 본 문서는 다수의 AI 에이전트 및 세션 간 협업 시 코드 일관성, 아키텍처 무결성, 모바일 UX 표준을 유지하기 위한 절대적인 규칙(System Law)을 정의합니다.

1. 프로젝트 코어 아이덴티티 및 핵심 루프 (Core Identity & Loop)
장르 및 플랫폼: 모바일 퍼스트 웹 게임 (TypeScript + HTML5 Canvas + React + Tailwind CSS)

핵심 재미 (Core Loop): [예: 자원 채굴 ➔ 벨트 물류 자동화 ➔ 공장 방어 디펜스 ➔ 우주선 탈출]

디자인 철학: 외부 에러를 원천 차단하는 제로-에셋(Zero-Asset) 원칙, 스마트폰 터치 중심의 직관적인 UX.

2. 절대적인 기술 스택 및 라이브러리 규정 (Tech Stack)
모든 AI는 새로운 패키지를 임의로 추가할 수 없으며, 아래 명시된 스택 내에서만 코드를 작성해야 합니다.

프레임워크 / 뷰: React 18+ (Functional Components + Hooks)

언어: TypeScript (Strict Mode 활성화, any 타입 사용 전면 금지)

스타일링: Tailwind CSS (모바일 반응형 스타일 강제)

렌더링 및 사운드: HTML5 Canvas API (2D Context), Web Audio API (외부 오디오 파일 로드 금지, 코드로 사운드 합성)

상태 및 저장소: React Context/Zustand (선택), LocalStorage / IndexedDB (영구 세이브)

테스트: Vitest (핵심 비즈니스 로직 단위 테스트 필수)

3. 표준 디렉토리 구조 (Directory Structure Standard)
모든 AI는 코드를 생성할 때 아래 폴더 구조를 엄격히 준수해야 합니다. 파일을 임의의 위치에 생성하거나 중구난방으로 퍼트릴 수 없습니다.

Plaintext
src/
├── core/          # 게임 루프, 씬 매니저, 입력 매니저 등 핵심 엔진
├── entities/      # 플레이어, 몬스터, 건물, 아이템 등 개별 오브젝트 클래스/로직
├── systems/       # 물리 충돌(Quadtree), 물류 흐름, 길찾기(A*), 전력망 계산 등 시스템 로직
├── data/          # 카드, 아이템, 레시피, 몬스터 스탯 등 대용량 정적 데이터 (JSON/TS)
├── ui/            # React 기반 모바일 HUD, 팝업, 메뉴 컴포넌트
├── utils/         # 수학 연산, 포맷터, 사운드 합성 유틸리티
├── test/          # Vitest 단위 테스트 파일 모음
└── App.tsx        # 진입점 및 씬 라우터
4. 코딩 컨벤션 및 에러 방지 규칙 (Coding & Anti-Error Rules)
제로-에셋 안전장치: 이미지(png, jpg)나 오디오(mp3) 파일 경로를 직접 불러와서 발생하는 404 Not Found 에러를 방지하기 위해, 모든 그래픽은 Canvas형 도형/네온 효과로 대체하고 사운드는 Web Audio API 코드로만 구현할 것.

모바일 퍼스트 UX: 모든 UI 버튼은 터치 영역 확보를 위해 최소 높이 44px 이상을 유지하고, 모바일 브라우저에서 스크롤 밀림이나 핀치 줌 확장이 일어나지 않도록 터치 이벤트를 철저히 제어할 것.

타입 엄격성: any 타입 사용을 금지하며, 인터페이스(interface)나 타입(type)을 반드시 정의하여 데이터 구조의 무결성을 보장할 것.

성능 최적화: 렌더링 루프(requestAnimationFrame) 내에서 불필요한 객체 생성을 막고, 대규모 객체 관리 시 오브젝트 풀링(Object Pooling)이나 공간 분할 알고리즘을 적용할 것.

5. 인수인계 및 버전 관리 규칙 (Handoff & State Protocol)
다른 AI 세션으로 작업을 이어받을 때, 이전 AI는 반드시 아래 항목을 포함한 작업 요약 리포트(HANDOFF_LOG.md)를 프로젝트에 남겨야 합니다.

완료된 모ジュール: 이번 세션에서 구현이 완료된 파일과 기능 목록.

진행 중이거나 남은 태스크: 아직 해결하지 못한 버그나 다음 세션에서 구현해야 할 기능 목록.

데이터 스키마 변경 사항: 저장소(LocalStorage) 구조나 타입 정의가 바뀐 부분이 있다면 명시.
