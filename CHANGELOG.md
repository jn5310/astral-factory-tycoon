# Changelog

All notable changes to Astral Factory Tycoon. Versions follow [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-10-30

The "release" update: full English and Korean localization and a lot more to do on every run.

### Added
- **English and Korean** for all text: UI, item and building names, research, missions, radio, help and achievements. The game follows the browser language on first launch, and you can switch on the title screen or in Settings.
- **Title screen** with Continue, a New game setup (mode, difficulty, map seed) and the Daily Challenge.
- **Game modes:** Campaign, Sandbox (everything unlocked, free building) and Daily Challenge (one planet and one twist per UTC day for everyone, with your best score for the day). Daily twists: Swarm, Rich Veins, Solar Age, Meteor Season.
- **Difficulty:** Peaceful, Easy, Normal, Hard and Nightmare, with score multipliers from ×0.25 to ×2.2.
- **Campaign missions:** 24 missions that teach the game step by step, each with a reward and a Mission Control radio line.
- **Commander powers**, unlocked through missions: Orbital Strike (targeted laser), Repair Nanites, Overclock (double factory speed for 20 s) and Cryo Pulse (freeze every alien for 6 s).
- **Random events:** meteor showers that leave rich ore, supply pods you tap to collect, solar flares, dust storms, ore surges and blood moons.
- **Salvage:** killed aliens drop resources into the core, with floating pickup text.
- **Turret veterancy:** turrets start as Rookies and become Veteran, Elite and Ace at 10, 30 and 75 kills, with +15% damage per rank.
- **Boss warning and health bar** for the Leviathan, plus attack alerts with a "View" button and minimap pings.
- **Score and sharing:** score breakdown on the victory and defeat screens, a local top-10 high-score table, and a "Share screenshot" button (Web Share API, or a PNG download).
- **Achievements** (21) and an **alien codex** that fills in as you meet each species. Both are kept across runs.
- **Adaptive music**, generated live, that moves between calm, tense and boss themes, with separate music and effects volume sliders.
- 9 new synthesized sound effects (missions, achievements, orbital strike, freeze, pickups, meteors, rank-ups, boss siren, overclock).
- "Build another" button in the building inspector.
- Run info (mode, difficulty, daily twist) in the menu.
- Open Graph and Twitter card tags for link previews.

### Changed
- Save format version 2 stores the new run state (mode, missions, powers, events, pickups, counters, meteor ore). Version 1 saves still load.
- Settings now store the language and separate music and effects volumes. The old single volume setting carries over to effects.
- At most 3 notifications show at once, so they no longer cover the mission card.
- Korean text wraps between words instead of in the middle of a word.

### Fixed
- Quitting to the title after a defeat now offers "Continue" from the last autosave.
- Starting the Daily Challenge asks before it replaces an existing colony.
- Event banners no longer slide under the minimap and zoom controls on phones.
- The research "Start" button stays visible on short phone screens.

## [1.0.0] - 2026-10-30

First playable release.

- 120×120 seeded Perlin planet with 6 ores, water and rock.
- 30 items, 24 recipes and 29 buildings, including 8 logistics blocks with belt congestion.
- Smart drag builder and blueprints.
- Power grid with generation, consumption and battery gauges, and overload slowdown.
- 35-node research tree across 5 tiers.
- 8 alien species with A* pathfinding, nightly waves, pollution-driven raids and a Leviathan boss every fifth night.
- Ammo and power turrets, walls, and a core gun.
- Rocket silo victory at 1,000 rocket parts.
- Procedural Canvas graphics, Web Audio sound, production statistics chart, minimap, autosave and JSON export and import.
- Deploys to GitHub Pages on every push to `main`.

[1.1.0]: https://github.com/jn5310/astral-factory-tycoon/compare/874fe2b...main
[1.0.0]: https://github.com/jn5310/astral-factory-tycoon/tree/874fe2b
