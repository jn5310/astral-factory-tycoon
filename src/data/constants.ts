/** Global tuning constants. All distances are in tiles, all times in seconds, power in kW, energy in kJ. */

export const MAP_SIZE = 120;
export const SIM_DT = 1 / 60;
export const MAX_STEPS_PER_FRAME = 10;

// Logistics
export const BELT_SPACING = 0.25;
export const BELT_SPEED = 1.6;
export const FAST_BELT_SPEED = 3.2;
export const ROUTER_DELAY = 0.06;
export const SORTER_DELAY = 0.04;
export const BRIDGE_RANGE = 4;
export const BRIDGE_CAPACITY = 8;
export const BRIDGE_TIME_PER_TILE = 0.12;
export const TUNNEL_RANGE = 5;
export const TUNNEL_SPEED = 2.4;
export const INSERTER_SWING = 0.42;
export const DUMP_INTERVAL = 0.05;
export const CONTAINER_CAPACITY = 400;
export const CORE_ITEM_CAPACITY = 50000;

// Production
export const DRILL_OUTPUT_CAP = 10;
export const CRAFTER_OUTPUT_CAP = 20;
export const MECH_DRILL_TIME = 2.6;
export const ELECTRIC_DRILL_TIME = 1.1;
export const LAB_TIME_PER_ITEM = 0.4;
export const LAB_ITEM_CAP = 10;

// Power
export const POLE_SUPPLY_RADIUS = 3;
export const POLE_WIRE_REACH = 8;
export const COAL_ENERGY = 1200;
export const GENERATOR_FUEL_CAP = 10;

// Day / night
export const DAY_LENGTH = 360;
export const NIGHT_START = 0.62;
export const START_PHASE = 0.08;

// Victory
export const ROCKET_PARTS_REQUIRED = 1000;
export const SILO_BUFFER = 20;
export const SILO_ASSEMBLY_TIME = 0.25;
export const LAUNCH_DURATION = 9;

// Pollution
export const POLLUTION_CHUNK = 8;
export const POLLUTION_DIFFUSION = 0.03;
export const POLLUTION_DECAY = 0.008;

// Enemies
export const MAX_ENEMIES = 400;
export const PATH_BUDGET_PER_TICK = 6;

// Saves
export const SAVE_KEY = 'astral-factory-save-v1';
export const BLUEPRINT_KEY = 'astral-factory-blueprints-v1';
export const SETTINGS_KEY = 'astral-factory-settings-v1';
export const SAVE_VERSION = 1;
export const AUTOSAVE_INTERVAL = 60;
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
