# HANDOFF_LOG

Session handoff report, as required by `MASTER_GDD.md` §5.

## Completed modules

| Area | Files |
|---|---|
| Engine / loop | `src/core/Game.ts` (rAF loop, fixed 60 Hz step, speed 0-3x, events → sound/toasts, autosave, UI store), `src/core/engine.ts` (`stepWorld`, update order), `src/core/World.ts` |
| Input / camera | `src/core/input.ts` (pointer events: pan, pinch, tap, drag, wheel), `src/core/camera.ts`, `src/core/build.ts` (tools, smart drag, blueprint gestures, preview) |
| Rendering | `src/core/renderer.ts`, `renderBuildings.ts`, `renderUnits.ts`, `terrainLayer.ts`, `minimap.ts`, `src/utils/draw.ts`, `src/utils/itemIcons.ts` |
| Save | `src/core/save.ts`: localStorage save/load, JSON export/import with validation (unknown kinds and items are dropped, size limit 20 MB) |
| Logistics | `src/systems/belts.ts`, `logistics.ts` (8 logistics blocks, inserter, producer dumping) |
| Production | `src/systems/production.ts` (drills, 4 crafter types), `silo.ts` (rocket and victory) |
| Power | `src/systems/power.ts` (pure `computeBalance`, Kruskal pole wiring, per-grid satisfaction), `daynight.ts` |
| Research | `src/systems/research.ts`, `src/data/research.ts` (35 nodes) |
| Enemies / defense | `src/systems/pathfinding.ts` (A*, binary heap, PathService cache and per-tick budget), `enemyAI.ts`, `combat.ts`, `waves.ts`, `pollution.ts`, `quadtree.ts` |
| UI | `src/ui/*` (TopBar, BuildBar, Inspector, ResearchTree, StatsPanel, Minimap/ZoomControls, GameMenu, BlueprintPanel, Overlays) |
| Tests | `src/test/*.test.ts`: 112 tests |
| Deploy | `.github/workflows/deploy-pages.yml`: tests, builds and publishes `dist/` to GitHub Pages on every push to `main` (needs Settings → Pages → Source: GitHub Actions, set once) |

## Open items / next session

- Balance has only been checked in short headless runs and a short browser session. A full playthrough to the rocket launch has not been done. Tune `src/data/*` numbers (wave budget, recipe times, costs) after real play.
- Wall visuals do not connect to neighbouring walls. Belt items are not drawn below zoom 7 (performance cut-off).
- The ambient hum uses one shared audio graph. A per-building positional machine sound would need a voice limit.
- Fonts come from the system. No webfont is bundled (zero-asset rule), so Korean text depends on the device's fonts.
- No E2E test runs in CI. The built app was smoke-tested manually in headless Chromium.

## Data schema

- `localStorage['astral-factory-save-v1']`: `SaveData` (`src/core/save.ts`, `version: 1`). Terrain is not stored; it is regenerated from `seed`.
- `localStorage['astral-factory-blueprints-v1']`: `Blueprint[]` (`src/systems/blueprint.ts`), at most 50 entries.
- `localStorage['astral-factory-settings-v1']`: `{ muted, volume, showPollution }`.
- If `SaveData` changes, bump `SAVE_VERSION` in `src/data/constants.ts`. `deserializeWorld` rejects other versions.
