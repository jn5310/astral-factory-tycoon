# Astral Factory Tycoon

**Build the factory. Survive the night. Escape the planet.**

A mobile-first browser game that mixes factory automation and tower defense, in the spirit of Mindustry and Factorio. You land on the alien world Astra IV, mine ore, automate production with belts, hold off the swarms that attack every night, and launch an escape rocket built from 1,000 parts.

The game ships no image or sound files. Every graphic is drawn on an HTML5 Canvas, and every sound effect and music track is synthesized live with the Web Audio API.

**▶ Play in your browser:** https://jn5310.github.io/astral-factory-tycoon/
Works on phones and desktops. Free, no ads, no tracking, no account. English and Korean (한국어).

[한국어 README](README.ko.md) · [Changelog](CHANGELOG.md) · [Store listing copy](docs/STORE_LISTING.md)

## Features

**Factory and logistics**
- 120×120 seeded planet with 6 ores (iron, copper, coal, stone, silicon sand, titanium), water and rock.
- 30 items and 24 recipes, from ore to plates, gears, circuits, batteries, processors and rocket parts.
- 8 logistics blocks: conveyor, fast conveyor, router, bridge, underground tunnel, filter sorter, storage container and inserter. A blocked belt backs up item by item.
- Smart drag builder: drag a finger and it lays straight belts and corners in one stroke.
- Blueprints: copy an area, name it, paste it anywhere, rotate it.
- Power grid with thermal generators, solar panels, accumulators and poles. An overloaded grid slows every machine on it.
- A 35-node research tree across 5 tiers.

**Defense**
- 8 alien species, from packs of rushers to the Leviathan boss that comes every fifth night, with A* pathfinding that walks around walls and breaks through the weakest one.
- 6 turret types plus walls. Bullet turrets need ammo delivered by belt; lasers, cryo and repair turrets run on power.
- Pollution spreads from your machines. When it reaches a nest, the aliens raid even in daylight.
- Turrets earn ranks (Rookie, Veteran, Elite, Ace) from their kills, and each rank adds 15% damage.
- Killed aliens drop salvage into the core.

**Campaign and replay**
- 24-mission campaign that doubles as the tutorial, with Mission Control radio lines and rewards.
- 4 commander powers unlocked through missions: Orbital Strike, Repair Nanites, Overclock and Cryo Pulse.
- 6 random events: meteor showers that leave rich ore, supply pods you tap to collect, solar flares, dust storms, ore surges and blood moons.
- 3 modes: Campaign, Sandbox (everything unlocked, free building) and a Daily Challenge (same planet and twist for everyone that day).
- 5 difficulties from Peaceful to Nightmare, with score multipliers.
- Score breakdown, local top-10 high scores, best daily score and a "share screenshot" button.
- 21 achievements and an alien codex that fills in as you meet new species.
- Adaptive music that shifts between calm, tense and boss themes.
- Autosave every 60 seconds and when you leave the page, plus JSON export and import.

## Controls

| Action | Touch | Desktop |
|---|---|---|
| Move the map | One-finger drag in select mode | Drag |
| Zoom | Pinch, or the slider on the right | Mouse wheel, `+` / `-` |
| Build a line | Pick a building, then drag | Same |
| Inspect, set recipes and filters | Tap a building | Click |
| Rotate | Rotate button | `R` (`Shift+R` reverses) |
| Demolish | Trash button, then tap or drag | `X` |
| Blueprint | Blueprint button, then drag over an area | `B` |
| Pause | Pause button | `Space` |
| Cancel | Hand (select) button | `Esc`, right-click |
| Pollution map | Tap the pollution readout in the top bar | `P` |

## Run it locally

Requires Node.js 22.

```bash
npm install
npm run dev      # dev server
npm test         # Vitest unit tests (147 tests in 10 suites)
npm run build    # type-check + production build into dist/
```

`dist/` uses relative paths (`base: './'`), so the same build runs on GitHub Pages, itch.io or any static host. Every push to `main` is tested, built and deployed to GitHub Pages by `.github/workflows/deploy-pages.yml`.

**Stack:** TypeScript (strict) · React 19 · HTML5 Canvas 2D · Tailwind CSS 4 · Vite · Vitest. No other runtime dependencies.

## Project layout

```
src/
├── core/       game loop (Game), stepWorld, camera, input, build controller, renderer, minimap, save/load, profile
├── entities/   Building, Enemy, Projectile/Particle (object pools), Pickup
├── systems/    belts, logistics, production, power, research, pathfinding (A*), enemy AI, combat, waves,
│               pollution, missions, commander powers, random events (director), achievements, score, ...
├── data/       items, recipes, buildings, research, enemies, turrets, missions, events, difficulty, locales/
├── ui/         React HUD (title screen, top bar, build bar, inspector, research tree, panels, overlays)
├── utils/      i18n, math, RNG, Perlin noise, formatters, Web Audio sound and music, share, daily seed
└── test/       Vitest suites
```

The simulation is a deterministic fixed 60 Hz step (`stepWorld` in `src/core/engine.ts`) that never touches the DOM. The browser loop and the tests drive the same code.

## Localization

All player-facing text lives in `src/data/locales/`. `types.ts` defines the `Messages` interface, and `en.ts` and `ko.ts` implement it. Entries are plain strings or small formatter functions, so plurals and word order stay correct in each language. The game picks the browser language on first launch, and the choice can be changed on the title screen or in Settings.

To add a language: copy `en.ts`, translate it, register it in `LANGS` and `MESSAGES` in `src/utils/i18n.ts`, and add it to `isLang`. The test suite checks that every locale has exactly the same keys and no empty strings.

## Tests

`npm test` runs 147 tests across 10 suites. They cover belt movement and congestion, every logistics block, the power balance and grid splitting, recipe and research data consistency, A* (optimality against brute-force Dijkstra, no corner cutting, weighted terrain), enemy AI, terrain generation, the drag builder, blueprints, save/load validation including v1 saves, missions, commander powers, random events, salvage and ranks, difficulty and the daily challenge, score, achievements and the profile, adaptive music patterns, and both locales.

## Privacy

The game makes no network requests after it loads. It has no analytics, ads or accounts. Saves, settings, high scores and achievements stay in your browser's localStorage. Clearing site data deletes them, so use **Menu → Export JSON** to keep a backup.
