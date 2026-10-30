import type { Building } from '../entities/Building';
import { ABILITIES, type AbilityId } from '../data/abilities';
import { BUILDINGS, type BuildingKind, isConveyorKind, isCrafterKind } from '../data/buildings';
import type { ItemId } from '../data/items';
import type { RecipeId } from '../data/recipes';
import { activateAbility } from '../systems/abilities';
import { captureBlueprint, pasteBlueprint, planPaste, rotateBlueprint, type Blueprint } from '../systems/blueprint';
import { collectPickup, pickupAt } from '../systems/director';
import { planBeltPath, type LinePlacement } from '../systems/dragPath';
import { invGet } from '../systems/inventory';
import { canPlace, placeBuilding, placeOrReaim, removeBuilding, rotateBuilding } from '../systems/placement';
import { setRecipe } from '../systems/production';
import { msg } from '../utils/i18n';
import { buildingAt, playSound, toast } from './grid';
import type { Dir, TileXY } from './types';
import type { World } from './World';

export type Tool =
  | { kind: 'inspect' }
  | { kind: 'build'; building: BuildingKind }
  | { kind: 'demolish' }
  | { kind: 'blueprintSelect' }
  | { kind: 'blueprintPaste'; blueprint: Blueprint }
  | { kind: 'target'; ability: AbilityId };

export interface PreviewCell {
  x: number;
  y: number;
  rot: Dir;
  kind: BuildingKind;
  ok: boolean;
}

export interface Preview {
  cells: PreviewCell[];
  /** Selection rectangle (inclusive tiles) while capturing a blueprint. */
  rect?: { x0: number; y0: number; x1: number; y1: number };
  /** Tiles that will be demolished. */
  demolish?: TileXY[];
  /** Area a targeted power will hit. */
  target?: { x: number; y: number; radius: number; color: string };
}

type DragMode = 'none' | 'line' | 'paint' | 'demolish' | 'select';

/** Top-left tile for a building of `size` centered on the touched tile. */
export function centeredOrigin(tile: TileXY, size: number): TileXY {
  const off = Math.floor((size - 1) / 2);
  return { x: tile.x - off, y: tile.y - off };
}

/**
 * Owns the active tool, rotation and selection, and turns pointer gestures (already converted to
 * tiles by the input layer) into placements. The renderer reads `preview()`; React reads the rest.
 */
export class BuildController {
  tool: Tool = { kind: 'inspect' };
  rotation: Dir = 0;
  selectedId = 0;
  hover: TileXY | null = null;
  private dragMode: DragMode = 'none';
  private dragTiles: TileXY[] = [];
  private dragStart: TileXY | null = null;
  private lastPaint: TileXY | null = null;
  private listeners = new Set<() => void>();

  constructor(private world: World) {}

  setWorld(world: World): void {
    this.world = world;
    this.selectedId = 0;
    this.tool = { kind: 'inspect' };
    this.cancelDrag();
    this.emit();
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit(): void {
    for (const cb of this.listeners) cb();
  }

  setTool(tool: Tool): void {
    this.tool = tool;
    if (tool.kind !== 'inspect') this.selectedId = 0;
    this.cancelDrag();
    this.emit();
  }

  toggleBuild(building: BuildingKind): void {
    if (this.tool.kind === 'build' && this.tool.building === building) this.setTool({ kind: 'inspect' });
    else this.setTool({ kind: 'build', building });
  }

  /** Rotates the placement direction, the paste blueprint, or the selected building. */
  rotate(delta: 1 | -1 = 1): void {
    this.rotation = ((((this.rotation + delta) % 4) + 4) % 4) as Dir;
    if (this.tool.kind === 'blueprintPaste') {
      let bp = this.tool.blueprint;
      for (let i = 0; i < (delta === 1 ? 1 : 3); i++) bp = rotateBlueprint(bp);
      this.tool = { kind: 'blueprintPaste', blueprint: bp };
    } else if (this.tool.kind === 'inspect' && this.selectedId) {
      rotateBuilding(this.world, this.selectedId, delta);
    }
    this.emit();
  }

  get selected(): Building | undefined {
    return this.selectedId ? this.world.buildings.get(this.selectedId) : undefined;
  }

  select(id: number): void {
    this.selectedId = id;
    this.emit();
  }

  deselect(): void {
    if (!this.selectedId) return;
    this.selectedId = 0;
    this.emit();
  }

  demolishSelected(): void {
    const b = this.selected;
    if (b && b.kind !== 'core') removeBuilding(this.world, b.id);
    this.selectedId = 0;
    this.emit();
  }

  /** "Build another": same kind, same facing, and crafters copy the selected recipe. */
  buildSameAsSelected(): void {
    const b = this.selected;
    if (!b || !BUILDINGS[b.kind].buildable) return;
    if (b.crafter?.recipe && isCrafterKind(b.kind)) this.world.lastRecipe[b.kind] = b.crafter.recipe;
    this.rotation = b.rot;
    this.setTool({ kind: 'build', building: b.kind });
  }

  /** True when a one-finger drag edits the map; false when it should pan the camera. */
  consumesDrag(): boolean {
    return this.tool.kind === 'build' || this.tool.kind === 'demolish' || this.tool.kind === 'blueprintSelect';
  }

  setSelectedRecipe(recipe: RecipeId | null): void {
    const b = this.selected;
    if (b?.crafter && !setRecipe(this.world, b, recipe)) toast(this.world, msg().reasons.recipeLocked, 'warning');
    this.emit();
  }

  setSelectedFilter(filter: ItemId | null): void {
    const b = this.selected;
    if (b?.sorter) b.sorter.filter = filter;
    else if (b?.inserter) b.inserter.filter = filter;
    this.emit();
  }

  // --- Gestures ---

  /**
   * Starts a gesture. Nothing is built or demolished yet: that happens on release (tap) or once the
   * finger starts dragging, so a second finger arriving for a pinch can still cancel it.
   */
  pointerDown(tile: TileXY): void {
    this.dragStart = tile;
    this.lastPaint = null;
    if (this.tool.kind === 'build') {
      if (BUILDINGS[this.tool.building].lineBuild) {
        this.dragMode = 'line';
        this.dragTiles = [tile];
      } else {
        this.dragMode = 'paint';
      }
    } else if (this.tool.kind === 'demolish') {
      this.dragMode = 'demolish';
    } else if (this.tool.kind === 'blueprintSelect') {
      this.dragMode = 'select';
      this.dragTiles = [tile, tile];
    }
    this.emit();
  }

  pointerDrag(tile: TileXY): void {
    if (this.dragMode === 'paint' || this.dragMode === 'demolish') {
      // The first drag event also applies the tile the finger started on.
      if (this.lastPaint === null && this.dragStart) this.applyAt(this.dragStart, true);
      if (!this.lastPaint || this.lastPaint.x !== tile.x || this.lastPaint.y !== tile.y) this.applyAt(tile, false);
      return;
    }
    const same = this.lastPaint !== null && this.lastPaint.x === tile.x && this.lastPaint.y === tile.y;
    if (this.dragMode === 'line') {
      if (!same) this.dragTiles.push(tile);
    } else if (this.dragMode === 'select') {
      this.dragTiles[1] = tile;
    }
    this.lastPaint = tile;
  }

  private applyAt(tile: TileXY, report: boolean): void {
    if (this.dragMode === 'paint' && this.tool.kind === 'build') this.placeAt(this.tool.building, tile, report);
    else if (this.dragMode === 'demolish') this.demolishAt(tile);
    this.lastPaint = tile;
  }

  /**
   * Ends a gesture (or handles a tap when no drag was started). Returns a blueprint when a
   * selection drag captured buildings.
   */
  pointerUp(tile: TileXY): Blueprint | null {
    let captured: Blueprint | null = null;
    if (this.dragMode === 'line' && this.tool.kind === 'build') {
      this.commitLine(this.tool.building);
    } else if ((this.dragMode === 'paint' || this.dragMode === 'demolish') && this.lastPaint === null) {
      this.applyAt(this.dragStart ?? tile, true);
    } else if (this.dragMode === 'select') {
      const a = this.dragStart ?? tile;
      const b = this.dragTiles[1] ?? tile;
      captured = captureBlueprint(this.world, a.x, a.y, b.x, b.y, msg().blueprint.defaultName(1));
      if (captured.parts.length === 0) {
        captured = null;
        toast(this.world, msg().blueprint.emptySelection, 'warning');
      }
    } else if (this.dragMode === 'none') {
      this.tap(tile);
    }
    this.cancelDrag();
    this.emit();
    return captured;
  }

  private tap(tile: TileXY): void {
    const tool = this.tool;
    if (tool.kind === 'blueprintPaste') {
      this.commitPaste(tile);
    } else if (tool.kind === 'target') {
      if (activateAbility(this.world, tool.ability, { x: tile.x + 0.5, y: tile.y + 0.5 })) this.tool = { kind: 'inspect' };
    } else if (tool.kind === 'inspect') {
      // Supply pods sit on the ground and take priority over the building selection.
      const pod = pickupAt(this.world, tile.x + 0.5, tile.y + 0.5);
      if (pod) {
        collectPickup(this.world, pod.id);
        return;
      }
      this.selectedId = buildingAt(this.world, tile.x, tile.y)?.id ?? 0;
    }
  }

  /** Drops an in-progress gesture without committing it (e.g. a second finger landed). */
  abortGesture(): void {
    this.cancelDrag();
    this.emit();
  }

  private cancelDrag(): void {
    this.dragMode = 'none';
    this.dragTiles = [];
    this.dragStart = null;
    this.lastPaint = null;
  }

  private placeAt(kind: BuildingKind, tile: TileXY, report: boolean): void {
    const o = centeredOrigin(tile, BUILDINGS[kind].size);
    const res = placeBuilding(this.world, kind, o.x, o.y, this.rotation);
    if (!res.ok && report && res.reason) {
      toast(this.world, res.reason, 'warning');
      playSound(this.world, 'error', o.x, o.y);
    }
  }

  private demolishAt(tile: TileXY): void {
    const b = buildingAt(this.world, tile.x, tile.y);
    if (b && b.kind !== 'core') removeBuilding(this.world, b.id);
  }

  private linePlacements(): LinePlacement[] {
    const placements = planBeltPath(this.dragTiles);
    // A tap without dragging keeps the chosen rotation instead of the default heading.
    const only = placements[0];
    if (placements.length === 1 && only) only.rot = this.rotation;
    return placements;
  }

  private commitLine(kind: BuildingKind): void {
    const placements = this.linePlacements();
    let placed = 0;
    let lastReason = '';
    for (const p of placements) {
      const res = placeOrReaim(this.world, kind, p.x, p.y, p.rot);
      if (res.ok) placed++;
      else lastReason = res.reason ?? '';
    }
    // Remember the heading the drag ended with, so the next tap continues the line.
    const end = placements[placements.length - 1];
    if (end && placements.length > 1) this.rotation = end.rot;
    if (placed === 0 && lastReason) {
      toast(this.world, lastReason, 'warning');
      playSound(this.world, 'error', this.dragStart?.x ?? 0, this.dragStart?.y ?? 0);
    }
  }

  private pasteOrigin(tile: TileXY, bp: Blueprint): TileXY {
    return { x: tile.x - Math.floor((bp.width - 1) / 2), y: tile.y - Math.floor((bp.height - 1) / 2) };
  }

  private commitPaste(tile: TileXY): void {
    if (this.tool.kind !== 'blueprintPaste') return;
    const o = this.pasteOrigin(tile, this.tool.blueprint);
    const res = pasteBlueprint(this.world, this.tool.blueprint, o.x, o.y);
    if (res.placed === 0) toast(this.world, msg().blueprint.pasteFailed, 'warning');
    else toast(this.world, msg().blueprint.pasted(res.placed, res.skipped), 'success');
  }

  // --- Preview for the renderer ---

  setHover(tile: TileXY | null): void {
    this.hover = tile;
  }

  preview(): Preview {
    const world = this.world;
    const tool = this.tool;
    if (tool.kind === 'build') {
      const kind = tool.building;
      const def = BUILDINGS[kind];
      let placements: LinePlacement[];
      if (this.dragMode === 'line') placements = this.linePlacements();
      else if (this.hover) {
        const o = centeredOrigin(this.hover, def.size);
        placements = [{ x: o.x, y: o.y, rot: this.rotation }];
      } else placements = [];
      // Track affordability cumulatively so a long drag shows where the resources run out.
      const free = world.settings.mode === 'sandbox';
      const budget = new Map<ItemId, number>();
      for (const s of def.cost) budget.set(s.item, invGet(world.inventory, s.item));
      const cells = placements.map((p) => {
        const existing = buildingAt(world, p.x, p.y);
        if (existing && existing.kind === kind && isConveyorKind(kind)) return { ...p, kind, ok: true };
        let ok = canPlace(world, kind, p.x, p.y).ok;
        if (ok && !free) {
          ok = def.cost.every((s) => (budget.get(s.item) ?? 0) >= s.amount);
          if (ok) for (const s of def.cost) budget.set(s.item, (budget.get(s.item) ?? 0) - s.amount);
        }
        return { ...p, kind, ok };
      });
      return { cells };
    }
    if (tool.kind === 'blueprintPaste' && this.hover) {
      const o = this.pasteOrigin(this.hover, tool.blueprint);
      const plan = planPaste(world, tool.blueprint, o.x, o.y);
      return { cells: plan.tiles.map((t) => ({ x: t.x, y: t.y, rot: t.part.rot, kind: t.part.kind, ok: t.ok })) };
    }
    if (tool.kind === 'blueprintSelect') {
      const a = this.dragMode === 'select' ? this.dragStart : this.hover;
      const b = this.dragMode === 'select' ? this.dragTiles[1] : this.hover;
      if (a && b) return { cells: [], rect: { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) } };
    }
    if (tool.kind === 'demolish' && this.hover) return { cells: [], demolish: [this.hover] };
    if (tool.kind === 'target' && this.hover) {
      const def = ABILITIES[tool.ability];
      return { cells: [], target: { x: this.hover.x + 0.5, y: this.hover.y + 0.5, radius: def.radius, color: def.color } };
    }
    return { cells: [] };
  }
}
