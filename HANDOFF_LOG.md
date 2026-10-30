# HANDOFF_LOG

Session handoff report, as required by `MASTER_GDD.md` §5. Current version: **1.1.0**.

## Completed modules

| Area | Files |
|---|---|
| Engine / loop | `src/core/Game.ts` (rAF loop, fixed 60 Hz step, speed 0-3x, title/playing screens, new game / continue / quit, events → sound/toasts/radio, autosave, meta profile, music mood, UI store), `src/core/engine.ts` (`stepWorld`, update order), `src/core/World.ts` |
| Input / camera | `src/core/input.ts` (pointer events: pan, pinch, tap, drag, wheel), `src/core/camera.ts`, `src/core/build.ts` (tools, smart drag, blueprint gestures, supply pod taps, commander power targeting, preview) |
| Rendering | `src/core/renderer.ts` (map, events, meteors, pickups, dust, blood moon tint, targeting ring, floating text), `renderBuildings.ts`, `renderUnits.ts`, `terrainLayer.ts`, `minimap.ts` (alert pings), `src/utils/draw.ts`, `src/utils/itemIcons.ts` |
| Save / profile | `src/core/save.ts` (save v2 with v1 fallback, JSON export/import with validation, 20 MB cap), `src/core/profile.ts` (achievements, codex, high scores, daily best; sanitized on load) |
| Logistics | `src/systems/belts.ts`, `logistics.ts` (8 logistics blocks, inserter, producer dumping) |
| Production | `src/systems/production.ts` (drills, 4 crafter types), `silo.ts` (rocket, victory, free play after a win) |
| Power | `src/systems/power.ts` (pure `computeBalance`, Kruskal pole wiring, per-grid satisfaction), `daynight.ts` |
| Research | `src/systems/research.ts`, `src/data/research.ts` (35 nodes) |
| Enemies / defense | `src/systems/pathfinding.ts` (A*, binary heap, PathService cache and per-tick budget), `enemyAI.ts`, `combat.ts` (salvage, turret ranks, attack alerts), `waves.ts`, `pollution.ts`, `quadtree.ts` |
| Run features (1.1) | `src/systems/missions.ts` + `src/data/missions.ts` (24 missions), `abilities.ts` + `data/abilities.ts` (4 commander powers), `director.ts` + `data/worldEvents.ts` (6 random events, meteors, supply pods), `modifiers.ts` (difficulty, daily twist, event and overclock multipliers), `achievements.ts` + `data/achievements.ts` (21), `score.ts`, `data/difficulty.ts` (3 modes, 5 difficulties, 5 twists), `src/utils/daily.ts` (UTC date seed and twist) |
| Localization (1.1) | `src/data/locales/types.ts` (`Messages`), `en.ts`, `ko.ts`; runtime and name helpers in `src/utils/i18n.ts` |
| Audio | `src/utils/sound.ts` (synthesized effects, music/effects buses), `src/utils/music.ts` (generative music: title, calm, tense, boss) |
| UI | `src/ui/*`: TitleScreen, TopBar, BuildBar, Inspector, ResearchTree, StatsPanel, Minimap/ZoomControls, GameMenu, SettingsPanel, BlueprintPanel, StatusPanel (mission card, boss bar, event chips), AbilityBar, RadioBox, MetaPanels (achievements, codex), Overlays (toasts, end screen with score and share, help) |
| Sharing | `src/utils/share.ts` (captioned PNG from the canvas, Web Share API with download fallback) |
| Tests | `src/test/*.test.ts`: 147 tests in 10 suites |
| Deploy | `.github/workflows/deploy-pages.yml`: tests, builds and publishes `dist/` to GitHub Pages on every push to `main`. `.github/workflows/ci.yml` tests and builds every branch and uploads `dist` as an artifact. |
| Docs | `README.md`, `README.ko.md`, `CHANGELOG.md`, `docs/STORE_LISTING.md` (EN/KO store copy, privacy statement, itch.io steps) |

## Data schema

All keys live in `localStorage`.

- `astral-factory-save-v1`: `SaveData` (`src/core/save.ts`), `version: 2`. Terrain is not stored; it is regenerated from `seed`, and meteor craters are replayed from `oreEdits`. Version 2 adds optional `settings`, `missions`, `abilities`, `director`, `pickups`, `counters`, `oreEdits`, `lifetime`, and `turret.kills`. `MIN_SAVE_VERSION` is 1, so version 1 saves load with default run state. If `SaveData` changes again, bump `SAVE_VERSION` in `src/data/constants.ts` and keep the new fields optional.
- `astral-factory-profile-v1`: `Profile` (`src/core/profile.ts`): `achievements` (id → unlock time in ms), `seenEnemies`, `highScores` (top 10), `dailyBest` (YYYY-MM-DD → score, the 60 most recent days played), `runs`, `wins`. Sandbox runs record nothing.
- `astral-factory-settings-v1`: `{ lang, muted, sfxVolume, musicVolume, showPollution }`. A 1.0 `volume` value is read as `sfxVolume`.
- `astral-factory-blueprints-v1`: `Blueprint[]` (`src/systems/blueprint.ts`), at most 50 entries.

There is one save slot. New game and the Daily Challenge both replace it, and both ask first when a save exists.

## How to verify

- `npm test` and `npm run build` must pass with 0 errors (CI runs both on every push).
- `src/test/i18n.test.ts` fails if a locale is missing a key, has an empty string, or if Hangul is left in the English locale.
- Manual smoke test used for 1.1: phone viewport (390×844, touch) in English and Korean: title, campaign start with the help sheet, mission 1 by real taps, supply pod tap, orbital strike, meteor shower, dust storm, blood moon, Leviathan boss bar, defeat → title → Continue, victory → keep playing, sandbox start, Korean HUD, inspector, research tree, menu, achievements, codex, settings and stats.

## Open items / next session

- Balance has only been checked in headless runs and short browser sessions. Nobody has played a full run to the rocket launch on each difficulty. Tune the numbers in `src/data/*` (wave budget, mission rewards, event timing, costs) after real play.
- Audio was only checked for errors in headless Chromium, not listened to on a device.
- Korean layout was checked with a stand-in font (Nanum Gothic) in the sandbox. Real devices use Apple SD Gothic Neo, Malgun Gothic or Noto Sans KR from the font stack in `src/index.css`.
- There is no `package-lock.json` (the sandbox could not reach the npm registry). CI installs the newest versions that match the ranges in `package.json`. Commit a lockfile from a machine with npm access to pin them.
- No license file. Choose one before others reuse the code.
- Not done: PWA manifest / offline install, online leaderboards, more save slots, gamepad support.
- Wall visuals do not connect to neighbouring walls. Belt items are not drawn below zoom 7 (performance cut-off).
- No E2E test runs in CI. The built app was smoke-tested manually in headless Chromium.
