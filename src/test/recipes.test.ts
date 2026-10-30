import { describe, expect, it } from 'vitest';
import { BUILDINGS, STARTING_BUILDINGS, type BuildingKind } from '../data/buildings';
import { ITEM_IDS, ITEMS, type ItemId } from '../data/items';
import { CRAFTER_KINDS, RECIPE_IDS, RECIPES, recipesFor, type RecipeId } from '../data/recipes';
import { RESEARCH, RESEARCH_BY_ID } from '../data/research';
import { Ore } from '../data/terrain';
import { createWorld } from '../core/World';
import { inputCap } from '../systems/logistics';
import { setRecipe } from '../systems/production';
import { isBuildingUnlocked, labAccepts, setCurrentResearch } from '../systems/research';
import { tryInsert } from '../systems/logistics';
import { stepWorld } from '../core/engine';
import { endlessGenerator, put, run, setOre, testWorld, ticks } from './helpers';

const RAW: ReadonlySet<ItemId> = new Set(['iron_ore', 'copper_ore', 'coal', 'stone', 'sand', 'titanium_ore']);
const STARTING_RECIPES: readonly RecipeId[] = ['iron_plate', 'copper_plate', 'brick', 'gear', 'copper_wire', 'basic_ammo'];

/** Items producible with the given recipes from raw ores (fixed point). */
function producible(recipes: ReadonlySet<RecipeId>): Set<ItemId> {
  const have = new Set<ItemId>(RAW);
  for (let changed = true; changed; ) {
    changed = false;
    for (const id of recipes) {
      const rec = RECIPES[id];
      if (rec.inputs.every((s) => have.has(s.item))) {
        for (const o of rec.outputs) {
          if (!have.has(o.item)) {
            have.add(o.item);
            changed = true;
          }
        }
      }
    }
  }
  return have;
}

/** Research ids reachable through prerequisites, including the node itself. */
function closure(id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop() ?? '';
    if (out.has(cur)) continue;
    out.add(cur);
    for (const p of RESEARCH_BY_ID.get(cur)?.prereqs ?? []) stack.push(p);
  }
  return out;
}

describe('item and recipe data', () => {
  it('defines exactly 30 items, each with a matching definition', () => {
    expect(ITEM_IDS).toHaveLength(30);
    expect(new Set(ITEM_IDS).size).toBe(30);
    for (const id of ITEM_IDS) expect(ITEMS[id].id).toBe(id);
  });

  it('has 6 raw ores and a recipe for every other item', () => {
    const crafted = new Set(RECIPE_IDS.flatMap((r) => RECIPES[r].outputs.map((o) => o.item)));
    for (const id of ITEM_IDS) expect(crafted.has(id)).toBe(!RAW.has(id));
    expect(ITEM_IDS.filter((i) => ITEMS[i].tier === 0)).toHaveLength(6);
  });

  it('uses only valid items, positive amounts and positive craft times', () => {
    for (const id of RECIPE_IDS) {
      const r = RECIPES[id];
      expect(r.time).toBeGreaterThan(0);
      for (const s of [...r.inputs, ...r.outputs]) {
        expect(ITEM_IDS).toContain(s.item);
        expect(s.amount).toBeGreaterThan(0);
      }
    }
  });

  it('builds every item from raw ores through a multi-tier tree', () => {
    const all = producible(new Set(RECIPE_IDS));
    expect(all.size).toBe(30);
    // Ingredients are never of a higher tier than the product (no cycles back down the tree).
    for (const id of RECIPE_IDS) {
      const r = RECIPES[id];
      const outTier = ITEMS[r.outputs[0]?.item ?? 'coal'].tier;
      for (const s of r.inputs) expect(ITEMS[s.item].tier).toBeLessThanOrEqual(outTier);
    }
    // The victory part sits at the top: it needs tier-3 parts, which need tier-2 parts.
    expect(RECIPES.rocket_part.inputs.every((s) => ITEMS[s.item].tier === 3)).toBe(true);
  });

  it('gives every crafting building its own recipe list', () => {
    for (const kind of CRAFTER_KINDS) {
      const list = recipesFor(kind);
      expect(list.length).toBeGreaterThan(0);
      for (const r of list) expect(r.building).toBe(kind);
    }
    expect(recipesFor('furnace').map((r) => r.id)).toContain('steel');
  });

  it('buffers three crafts worth of each ingredient', () => {
    expect(inputCap(RECIPES.circuit, 'copper_wire')).toBe(9);
    expect(inputCap(RECIPES.circuit, 'coal')).toBe(0);
  });
});

describe('crafting in the simulation', () => {
  it('smelts iron ore into iron plates at the recipe rate', () => {
    const w = testWorld();
    endlessGenerator(w, 2, 2);
    put(w, 'power_pole', 5, 2);
    const f = put(w, 'furnace', 6, 2);
    let plates = 0;
    for (let t = 0; t < ticks(16.05); t++) {
      if (f.crafter) {
        f.crafter.input.iron_ore = 3;
        plates += f.crafter.output.iron_plate ?? 0;
        f.crafter.output = {};
      }
      stepWorld(w);
    }
    expect(plates).toBe(10);
  });

  it('does not craft steel until both iron plates and coal are present', () => {
    const w = testWorld();
    endlessGenerator(w, 2, 2);
    put(w, 'power_pole', 5, 2);
    const f = put(w, 'furnace', 6, 2, 0, { recipe: 'steel' });
    if (f.crafter) f.crafter.input = { iron_plate: 9 };
    run(w, 10);
    expect(f.crafter?.output.steel).toBeUndefined();
    tryInsert(w, f, 'coal', 2);
    run(w, 4.2);
    expect(f.crafter?.output.steel).toBe(1);
    expect(f.crafter?.input).toEqual({ iron_plate: 6 });
  });

  it('chains drill -> furnace -> assembler into gears without any belts', () => {
    const w = testWorld();
    setOre(w, 2, 2, 2, Ore.Iron);
    put(w, 'mech_drill', 2, 2);
    put(w, 'furnace', 4, 2);
    put(w, 'assembler', 6, 2, 0, { recipe: 'gear' });
    const box = put(w, 'container', 8, 2);
    put(w, 'power_pole', 5, 5);
    endlessGenerator(w, 2, 5);
    run(w, 60);
    expect(box.storage?.items.gear ?? 0).toBeGreaterThanOrEqual(6);
    expect(w.stats.total('produced', 'iron_plate')).toBeGreaterThanOrEqual(14);
  });

  it('returns buffered ingredients to the core when the recipe changes', () => {
    const w = testWorld(30, { core: true });
    const f = put(w, 'furnace', 2, 2);
    if (f.crafter) f.crafter.input = { iron_ore: 3 };
    expect(setRecipe(w, f, 'brick')).toBe(true);
    expect(f.crafter?.input).toEqual({});
    expect(w.inventory.iron_ore).toBe(3);
    expect(setRecipe(w, f, 'gear')).toBe(false);
  });
});

describe('research tree', () => {
  it('has 35 nodes in 5 tiers of 7', () => {
    expect(RESEARCH).toHaveLength(35);
    for (let tier = 1; tier <= 5; tier++) expect(RESEARCH.filter((n) => n.tier === tier)).toHaveLength(7);
    expect(new Set(RESEARCH.map((n) => `${n.tier}:${n.row}`)).size).toBe(35);
  });

  it('only depends on existing earlier nodes, so the tree has no cycles and flows left to right', () => {
    for (const n of RESEARCH) {
      for (const p of n.prereqs) {
        const pre = RESEARCH_BY_ID.get(p);
        expect(pre).toBeDefined();
        if (!pre) continue;
        // Earlier tier, or the same tier column but a row above (drawn as a vertical link).
        expect(pre.tier < n.tier || (pre.tier === n.tier && pre.row < n.row)).toBe(true);
      }
    }
    for (const n of RESEARCH) expect(closure(n.id).size).toBeLessThanOrEqual(RESEARCH.length);
  });

  it('never asks for an item the player cannot make yet', () => {
    const startItems = producible(new Set(STARTING_RECIPES));
    for (const kind of STARTING_BUILDINGS) for (const s of BUILDINGS[kind].cost) expect(startItems.has(s.item)).toBe(true);
    for (const n of RESEARCH) {
      const known = closure(n.id);
      const recipes = new Set<RecipeId>(STARTING_RECIPES);
      const buildings = new Set<BuildingKind>(STARTING_BUILDINGS);
      for (const id of known) {
        for (const r of RESEARCH_BY_ID.get(id)?.recipes ?? []) recipes.add(r);
        for (const b of RESEARCH_BY_ID.get(id)?.buildings ?? []) buildings.add(b);
      }
      // A recipe only counts once its crafting building is available too.
      const usable = (rs: Set<RecipeId>, bs: Set<BuildingKind>): Set<RecipeId> =>
        new Set([...rs].filter((r) => bs.has(RECIPES[r].building)));
      const recipesBefore = new Set([...recipes].filter((r) => !n.recipes.includes(r)));
      const buildingsBefore = new Set([...buildings].filter((b) => !n.buildings.includes(b)));
      const before = producible(usable(recipesBefore, buildingsBefore));
      for (const s of n.cost) expect([n.id, s.item, before.has(s.item)]).toEqual([n.id, s.item, true]);
      const after = producible(usable(recipes, buildings));
      for (const b of n.buildings) for (const s of BUILDINGS[b].cost) expect([b, s.item, after.has(s.item)]).toEqual([b, s.item, true]);
    }
  });

  it('a lab consumes delivered items and completes research, unlocking its building', () => {
    const w = createWorld({ seed: 1, width: 24, height: 24, flat: true, withCore: false, startingItems: false });
    w.visuals = false;
    w.waves.triggered = true;
    expect(isBuildingUnlocked(w, 'router')).toBe(false);
    endlessGenerator(w, 2, 2);
    put(w, 'power_pole', 5, 2);
    const lab = put(w, 'lab', 6, 2);
    expect(setCurrentResearch(w, 'logistics')).toBe(true);
    expect(setCurrentResearch(w, 'fast_belt')).toBe(false);
    for (let t = 0; t < ticks(40) && !w.research.completed.has('logistics'); t++) {
      for (const item of ['iron_plate', 'copper_plate'] as const) if (labAccepts(w, lab, item)) tryInsert(w, lab, item, 2);
      stepWorld(w);
    }
    expect(w.research.completed.has('logistics')).toBe(true);
    expect(w.research.current).toBeNull();
    expect(isBuildingUnlocked(w, 'router')).toBe(true);
    expect(w.stats.total('consumed', 'iron_plate')).toBe(30);
  });
});
