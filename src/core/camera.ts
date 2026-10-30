import { clamp } from '../utils/math';
import type { TileXY, Vec2 } from './types';

export interface Viewport {
  width: number;
  height: number;
  dpr: number;
}

/** Camera maps world tile coordinates to CSS pixels. `zoom` = pixels per tile. */
export class Camera {
  /** World-space tile coordinate at the screen center. */
  x = 0;
  y = 0;
  zoom = 24;
  minZoom = 4;
  maxZoom = 64;
  viewport: Viewport = { width: 800, height: 600, dpr: 1 };

  constructor(private mapWidth: number, private mapHeight: number) {
    this.x = mapWidth / 2;
    this.y = mapHeight / 2;
  }

  setViewport(width: number, height: number, dpr: number): void {
    this.viewport.width = width;
    this.viewport.height = height;
    this.viewport.dpr = dpr;
    this.clampToBounds();
  }

  worldToScreen(wx: number, wy: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
    out.x = (wx - this.x) * this.zoom + this.viewport.width / 2;
    out.y = (wy - this.y) * this.zoom + this.viewport.height / 2;
    return out;
  }

  screenToWorld(sx: number, sy: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
    out.x = (sx - this.viewport.width / 2) / this.zoom + this.x;
    out.y = (sy - this.viewport.height / 2) / this.zoom + this.y;
    return out;
  }

  screenToTile(sx: number, sy: number): TileXY {
    const w = this.screenToWorld(sx, sy);
    return { x: Math.floor(w.x), y: Math.floor(w.y) };
  }

  panByPixels(dxPx: number, dyPx: number): void {
    this.x -= dxPx / this.zoom;
    this.y -= dyPx / this.zoom;
    this.clampToBounds();
  }

  /** Zooms toward a screen anchor so the world point under the finger stays put. */
  zoomAt(sx: number, sy: number, factor: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clampToBounds();
  }

  setZoom(zoom: number): void {
    this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
    this.clampToBounds();
  }

  centerOn(wx: number, wy: number): void {
    this.x = wx;
    this.y = wy;
    this.clampToBounds();
  }

  /** Keeps at least part of the map on screen (allows a small margin past the edge). */
  clampToBounds(): void {
    const margin = 4;
    this.x = clamp(this.x, -margin, this.mapWidth + margin);
    this.y = clamp(this.y, -margin, this.mapHeight + margin);
    // Don't allow zooming out so far the map is a dot.
    const fitZoom = Math.min(this.viewport.width, this.viewport.height) / (this.mapWidth + 8);
    this.minZoom = Math.max(2, Math.min(12, fitZoom));
    this.zoom = clamp(this.zoom, this.minZoom, this.maxZoom);
  }

  /** Visible tile rectangle, clamped to the map, for culling during render. */
  visibleTileBounds(): { x0: number; y0: number; x1: number; y1: number } {
    const tl = this.screenToWorld(0, 0);
    const br = this.screenToWorld(this.viewport.width, this.viewport.height);
    return {
      x0: Math.max(0, Math.floor(tl.x) - 1),
      y0: Math.max(0, Math.floor(tl.y) - 1),
      x1: Math.min(this.mapWidth - 1, Math.ceil(br.x) + 1),
      y1: Math.min(this.mapHeight - 1, Math.ceil(br.y) + 1),
    };
  }
}
