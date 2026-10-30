import { describe, expect, it } from 'vitest';
import { BuildController, centeredOrigin } from '../core/build';
import { buildingAt } from '../core/grid';
import { put, testWorld } from './helpers';

function drag(ctrl: BuildController, tiles: { x: number; y: number }[]): ReturnType<BuildController['pointerUp']> {
  const [first, ...rest] = tiles;
  if (!first) return null;
  ctrl.pointerDown(first);
  for (const t of rest) ctrl.pointerDrag(t);
  return ctrl.pointerUp(rest[rest.length - 1] ?? first);
}

describe('build controller gestures', () => {
  it('a tap places one building centered on the finger', () => {
    const w = testWorld();
    w.inventory = { stone: 100, iron_plate: 100 };
    const ctrl = new BuildController(w);
    ctrl.setTool({ kind: 'build', building: 'furnace' });
    drag(ctrl, [{ x: 10, y: 10 }]);
    const f = buildingAt(w, 10, 10);
    expect(f?.kind).toBe('furnace');
    expect([f?.x, f?.y]).toEqual([centeredOrigin({ x: 10, y: 10 }, 2).x, 10]);
    expect(w.inventory).toEqual({ stone: 85, iron_plate: 95 });
  });

  it('a second finger landing (pinch) cancels the gesture without building anything', () => {
    const w = testWorld();
    w.inventory = { iron_plate: 100 };
    const ctrl = new BuildController(w);
    ctrl.setTool({ kind: 'build', building: 'conveyor' });
    ctrl.pointerDown({ x: 3, y: 3 });
    ctrl.pointerDrag({ x: 4, y: 3 });
    ctrl.abortGesture();
    ctrl.setTool({ kind: 'build', building: 'power_pole' });
    ctrl.pointerDown({ x: 8, y: 8 });
    ctrl.abortGesture();
    expect(w.buildings.size).toBe(0);
    expect(w.inventory.iron_plate).toBe(100);
  });

  it('one continuous drag lays straight belts and turns the corner automatically', () => {
    const w = testWorld();
    w.inventory = { iron_plate: 100 };
    const ctrl = new BuildController(w);
    ctrl.setTool({ kind: 'build', building: 'conveyor' });
    drag(ctrl, [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }]);
    expect(w.buildings.size).toBe(5);
    expect(buildingAt(w, 3, 2)?.rot).toBe(0);
    expect(buildingAt(w, 4, 2)?.rot).toBe(1);
    expect(buildingAt(w, 4, 4)?.rot).toBe(1);
    expect(w.inventory.iron_plate).toBe(95);
    // The next tap continues in the direction the drag ended with.
    expect(ctrl.rotation).toBe(1);
  });

  it('dragging over existing belts re-aims them for free', () => {
    const w = testWorld();
    w.inventory = { iron_plate: 10 };
    const ctrl = new BuildController(w);
    put(w, 'conveyor', 5, 5, 3);
    ctrl.setTool({ kind: 'build', building: 'conveyor' });
    drag(ctrl, [{ x: 5, y: 5 }, { x: 6, y: 5 }]);
    expect(buildingAt(w, 5, 5)?.rot).toBe(0);
    expect(w.inventory.iron_plate).toBe(9);
  });

  it('the preview shows where a long drag runs out of resources', () => {
    const w = testWorld();
    w.inventory = { iron_plate: 2 };
    const ctrl = new BuildController(w);
    ctrl.setTool({ kind: 'build', building: 'conveyor' });
    ctrl.pointerDown({ x: 1, y: 1 });
    for (let x = 2; x <= 4; x++) ctrl.pointerDrag({ x, y: 1 });
    expect(ctrl.preview().cells.map((c) => c.ok)).toEqual([true, true, false, false]);
    ctrl.pointerUp({ x: 4, y: 1 });
    expect(w.buildings.size).toBe(2);
  });

  it('demolish drags remove every building they cross and refund half the cost', () => {
    const w = testWorld();
    w.inventory = {};
    for (let x = 2; x <= 5; x++) put(w, 'wall', x, 2);
    const ctrl = new BuildController(w);
    ctrl.setTool({ kind: 'demolish' });
    drag(ctrl, [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }]);
    expect(w.buildings.size).toBe(1);
    expect(w.inventory.stone).toBe(9);
  });

  it('selecting an area captures a blueprint and a tap pastes it centered', () => {
    const w = testWorld(40);
    w.inventory = { iron_plate: 100, stone: 100 };
    put(w, 'conveyor', 2, 2, 0);
    put(w, 'wall', 3, 3);
    const ctrl = new BuildController(w);
    ctrl.setTool({ kind: 'blueprintSelect' });
    const bp = drag(ctrl, [{ x: 1, y: 1 }, { x: 3, y: 2 }, { x: 4, y: 4 }]);
    expect(bp?.parts).toHaveLength(2);
    if (!bp) return;
    ctrl.setTool({ kind: 'blueprintPaste', blueprint: bp });
    ctrl.pointerUp({ x: 20, y: 20 });
    expect(buildingAt(w, 20, 20)?.kind).toBe('conveyor');
    expect(buildingAt(w, 21, 21)?.kind).toBe('wall');
  });

  it('tapping in inspect mode selects the building under the finger', () => {
    const w = testWorld();
    const wall = put(w, 'wall', 6, 6);
    const ctrl = new BuildController(w);
    ctrl.pointerUp({ x: 6, y: 6 });
    expect(ctrl.selectedId).toBe(wall.id);
    ctrl.pointerUp({ x: 1, y: 1 });
    expect(ctrl.selectedId).toBe(0);
  });
});
