# Astral Factory Tycoon

A mobile-first browser game: space-colony factory automation plus tower defense, in the spirit of Mindustry and Factorio.
It uses no image or sound files. Every graphic is drawn on an HTML5 Canvas and every sound is synthesized with the Web Audio API.

**Stack:** TypeScript (strict) · React 19 · HTML5 Canvas 2D · Tailwind CSS 4 · Vite · Vitest

```bash
npm install
npm run dev      # dev server
npm test         # Vitest unit tests (112 tests)
npm run build    # tsc type-check + production build into dist/
```

## Gameplay

Mine ore → automate logistics with belts → defend against alien raids every night → complete 35 research nodes → feed **1,000 rocket parts** into the **orbital escape silo** to launch the rocket and win.

| System | Implementation |
|---|---|
| Map | 120×120 tiles, seeded Perlin fBm terrain (plain, water, rock) with 6 minerals: iron, copper, coal, stone, silicon sand, titanium. A starter area around the core is guaranteed, and every nest is guaranteed a walkable route to the core. |
| Touch controls | One-finger pan, two-finger pinch zoom + pan, vertical zoom slider on the right, minimap tap to jump |
| Smart drag builder | In build mode, dragging a finger detects direction and lays straight belts and corner curves in one stroke. Dragging over existing belts re-aims them. The preview turns red where resources run out. |
| Blueprints | Drag-select an area, name and save it (localStorage), paste it elsewhere with a tap, rotate 90°. Recipes, filters and tunnel modes are kept. |
| Logistics (8) | Conveyor and fast conveyor, router (1:1 splitter), bridge (jumps over belts and water), underground tunnel, filter sorter, storage container, inserter. A blocked front makes the queue behind it back up item by item. |
| Production | 30 items, 24 recipes: ore → plates/glass/brick/steel/silicon → gears/wire/circuits/batteries/engines/alloy → AP/explosive ammo, energy cells, processors, rocket parts |
| Power | Thermal generator (burns coal), solar (daytime only), accumulator (stores surplus), power pole (3-tile supply radius, auto-wires within 8 tiles). Live generation / consumption / battery gauge. An overloaded grid slows every machine on it proportionally. |
| Research | 5 tiers × 7 = 35 nodes, visual tree. Items delivered to labs by belt or inserter drive progress. |
| Enemies (8) | Rusher, armored charger, acid spitter (ranged), wall-breaker bomber, flyer, brood (splits on death), healer, Leviathan boss (every 5th night). Ground units use A* pathfinding. They walk around walls and break through the weakest one when sealed in. |
| Pollution | Working machines emit pollution that spreads across 8×8 chunks. It scales night waves, and polluted nests raid even in daylight. |
| Defense | Ammo turrets fed by belt (machine gun, shotgun, long-range cannon), powered laser and slow turrets, auto-repair turret, stone and reinforced walls, built-in core gun |
| Presentation | Rotating gears, furnace glow, moving belt items, tracers and explosion particles, day/night lighting, Web Audio machine hum and combat sounds |
| Dashboard | Per-minute production/consumption line chart, minimap radar, autosave every 60 s and on page hide, JSON export/import |

## Project layout (per `MASTER_GDD.md`)

```
src/
├── core/       game loop (Game), stepWorld, camera, input, build controller, renderer, minimap, save/load
├── entities/   Building, Enemy, Projectile/Particle (object pools)
├── systems/    belts, logistics, production, power, research, pathfinding (A*), enemy AI, combat,
│               waves, pollution, quadtree, stats, blueprint, drag path, placement, terrain
├── data/       items, recipes, buildings, research tree, enemies, turrets, constants
├── ui/         React HUD (top bar, build bar, inspector, research tree, stats, menus)
├── utils/      math, RNG, Perlin noise, formatters, Web Audio synth, canvas helpers, item icons
├── test/       Vitest suites
└── App.tsx
```

The simulation is a deterministic fixed 60 Hz step (`stepWorld` in `src/core/engine.ts`) that never touches the DOM. The browser loop and the tests drive the same code.

## Tests

`npm test` runs 112 Vitest tests across 8 suites: belt movement and congestion, the logistics blocks, the power balance and grid splitting, recipes and the research tree's data consistency, A* (optimality against a brute-force Dijkstra, no corner cutting, weighted terrain), enemy AI, terrain generation, the drag builder, blueprints, save/load validation, and victory.

## Controls (desktop)

Mouse wheel zoom · drag to pan · **R** rotate · **X** demolish · **B** blueprint · **Space** pause · **Esc** / right-click cancel · **P** pollution overlay
