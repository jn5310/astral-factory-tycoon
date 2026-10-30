import type { Blueprint } from '../systems/blueprint';
import type { BuildController } from './build';
import type { Camera } from './camera';
import type { TileXY } from './types';

interface PointerSample {
  x: number;
  y: number;
}

const TAP_SLOP = 9;

export interface InputCallbacks {
  onBlueprintCaptured?: (bp: Blueprint) => void;
  onInteract?: () => void;
}

/**
 * Translates pointer events into camera and build actions.
 * One finger pans (inspect) or builds (any build tool); two fingers pinch-zoom and pan together.
 */
export class InputController {
  private pointers = new Map<number, PointerSample>();
  private mode: 'idle' | 'pan' | 'build' | 'pinch' = 'idle';
  private panLast: PointerSample = { x: 0, y: 0 };
  private downScreen: PointerSample = { x: 0, y: 0 };
  private movedDist = 0;
  private pinchDist = 0;
  private pinchMid: PointerSample = { x: 0, y: 0 };
  private canvas: HTMLElement | null = null;

  constructor(
    private camera: Camera,
    private build: BuildController,
    private callbacks: InputCallbacks = {},
  ) {}

  attach(canvas: HTMLElement): void {
    this.canvas = canvas;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  detach(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    canvas.removeEventListener('pointerdown', this.onDown);
    canvas.removeEventListener('pointermove', this.onMove);
    canvas.removeEventListener('pointerup', this.onUp);
    canvas.removeEventListener('pointercancel', this.onUp);
    canvas.removeEventListener('pointerleave', this.onLeave);
    canvas.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas = null;
  }

  private localPos(e: PointerEvent | WheelEvent): PointerSample {
    const rect = (this.canvas as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private tileAt(p: PointerSample): TileXY {
    return this.camera.screenToTile(p.x, p.y);
  }

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const p = this.localPos(e);
    const factor = Math.exp(-e.deltaY * 0.0012);
    this.camera.zoomAt(p.x, p.y, factor);
    this.build.setHover(this.tileAt(p));
  };

  private onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button === 2) {
      // Right click cancels the active tool (desktop convenience).
      this.build.setTool({ kind: 'inspect' });
      return;
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = this.localPos(e);
    this.pointers.set(e.pointerId, p);
    this.callbacks.onInteract?.();

    if (this.pointers.size === 2) {
      // Second finger: abort any build gesture and start pinch.
      if (this.mode === 'build') this.build.abortGesture();
      this.mode = 'pinch';
      this.beginPinch();
      return;
    }
    if (this.pointers.size !== 1) return;

    this.downScreen = p;
    this.movedDist = 0;
    this.build.setHover(this.tileAt(p));
    // Middle mouse always pans, even with a build tool selected.
    if (this.build.consumesDrag() && !(e.pointerType === 'mouse' && e.button === 1)) {
      this.mode = 'build';
      this.build.pointerDown(this.tileAt(p));
    } else {
      this.mode = 'pan';
      this.panLast = p;
    }
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.localPos(e);
    if (!this.pointers.has(e.pointerId)) {
      // Mouse hover without a button held: update the build preview only.
      if (this.pointers.size === 0) this.build.setHover(this.tileAt(p));
      return;
    }
    this.pointers.set(e.pointerId, p);

    if (this.mode === 'pinch') {
      this.updatePinch();
      return;
    }
    this.movedDist = Math.max(this.movedDist, Math.hypot(p.x - this.downScreen.x, p.y - this.downScreen.y));
    this.build.setHover(this.tileAt(p));
    if (this.mode === 'pan') {
      this.camera.panByPixels(p.x - this.panLast.x, p.y - this.panLast.y);
      this.panLast = p;
    } else if (this.mode === 'build') {
      if (this.movedDist > TAP_SLOP) this.build.pointerDrag(this.tileAt(p));
    }
  };

  private onUp = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId) ?? this.localPos(e);
    this.pointers.delete(e.pointerId);

    if (this.mode === 'pinch') {
      if (this.pointers.size === 1) {
        // Drop back to panning with the remaining finger.
        const remaining = [...this.pointers.values()][0];
        if (remaining) {
          this.mode = 'pan';
          this.panLast = remaining;
          this.downScreen = remaining;
          this.movedDist = TAP_SLOP + 1;
        }
      } else if (this.pointers.size === 0) {
        this.mode = 'idle';
      }
      return;
    }

    if (this.pointers.size === 0) {
      if (this.mode === 'build') {
        const captured = this.build.pointerUp(this.tileAt(p));
        if (captured) this.callbacks.onBlueprintCaptured?.(captured);
      } else if (this.mode === 'pan' && this.movedDist <= TAP_SLOP) {
        // A tap in inspect mode selects/paste.
        const captured = this.build.pointerUp(this.tileAt(p));
        if (captured) this.callbacks.onBlueprintCaptured?.(captured);
      }
      this.mode = 'idle';
    }
  };

  private onLeave = (): void => {
    if (this.pointers.size === 0) this.build.setHover(null);
  };

  private beginPinch(): void {
    const pts = [...this.pointers.values()];
    const a = pts[0];
    const b = pts[1];
    if (!a || !b) return;
    this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    this.pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private updatePinch(): void {
    const pts = [...this.pointers.values()];
    const a = pts[0];
    const b = pts[1];
    if (!a || !b) return;
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.camera.zoomAt(mid.x, mid.y, dist / this.pinchDist);
    this.camera.panByPixels(mid.x - this.pinchMid.x, mid.y - this.pinchMid.y);
    this.pinchDist = dist;
    this.pinchMid = mid;
  }
}
