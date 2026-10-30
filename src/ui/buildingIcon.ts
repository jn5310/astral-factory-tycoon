import { createBuilding } from '../entities/Building';
import { BUILDINGS, type BuildingKind } from '../data/buildings';
import { drawBelt, drawBuilding, type DrawCtx } from '../core/renderBuildings';

const cache = new Map<BuildingKind, string>();

/** Renders a building with the in-game drawing code into a data URL for the HUD (no image files). */
export function buildingIconUrl(kind: BuildingKind): string {
  const hit = cache.get(kind);
  if (hit) return hit;
  const px = 96;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const g = canvas.getContext('2d');
  if (g) {
    const size = BUILDINGS[kind].size;
    const scale = px / (size + 0.2);
    g.setTransform(scale, 0, 0, scale, 0.1 * scale, 0.1 * scale);
    const b = createBuilding(0, kind, 0, 0, 0);
    b.active = true;
    b.anim = 0.35;
    if (b.turret) b.turret.angle = -Math.PI / 4;
    if (b.drill) b.drill.ore = 'iron_ore';
    if (b.accumulator) b.accumulator.stored = 3500;
    if (b.generator) b.generator.fuel = 4;
    if (b.silo) b.silo.installed = 650;
    if (b.tunnel) b.tunnel.partner = 1;
    const dc: DrawCtx = { time: 0.4, detail: 2, daylight: 1, launchTimer: -1 };
    if (b.belt) drawBelt(g, b, dc);
    else drawBuilding(g, b, dc);
  }
  const url = canvas.toDataURL();
  cache.set(kind, url);
  return url;
}
