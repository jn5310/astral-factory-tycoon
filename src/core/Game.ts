import { AUTOSAVE_INTERVAL, MAX_STEPS_PER_FRAME, SETTINGS_KEY, SIM_DT } from '../data/constants';
import { isCrafterKind } from '../data/buildings';
import type { Blueprint } from '../systems/blueprint';
import { SoundEngine } from '../utils/sound';
import { BuildController } from './build';
import { Camera } from './camera';
import { stepWorld } from './engine';
import type { SoundName, ToastLevel } from './events';
import { InputController } from './input';
import { MinimapRenderer } from './minimap';
import { Renderer } from './renderer';
import { getStorage, saveToStorage } from './save';
import { coreCenter, type World } from './World';

export interface Toast {
  id: number;
  message: string;
  level: ToastLevel;
  expires: number;
}

export type GameSpeed = 0 | 1 | 2 | 3;

interface Settings {
  muted: boolean;
  volume: number;
  showPollution: boolean;
}

/** Sounds that are not positional (UI / global alerts). */
const GLOBAL_SOUNDS: ReadonlySet<SoundName> = new Set<SoundName>(['alarm', 'research', 'victory', 'defeat', 'launch', 'ui', 'error']);

/**
 * Owns the running game: fixed-timestep simulation driven by requestAnimationFrame, rendering,
 * input, sound, autosave, and a tiny subscribe/version store the React HUD reads from.
 */
export class Game {
  world: World;
  readonly camera: Camera;
  readonly build: BuildController;
  readonly sound = new SoundEngine();
  speed: GameSpeed = 1;
  toasts: Toast[] = [];
  /** Set when a blueprint selection finished; the HUD asks for a name. */
  pendingBlueprint: Blueprint | null = null;
  lastSaveAt = 0;
  fps = 60;
  showPollution = false;
  private renderer: Renderer | null = null;
  private minimap: MinimapRenderer | null = null;
  private input: InputController | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private uiTimer = 0;
  private autosaveTimer = 0;
  private ambienceTimer = 0;
  private minimapTimer = 0;
  private version = 0;
  private nextToastId = 1;
  private saveWarned = false;
  private readonly listeners = new Set<() => void>();

  constructor(world: World) {
    this.world = world;
    this.camera = new Camera(world.width, world.height);
    this.build = new BuildController(world);
    this.build.subscribe(() => this.notify());
    this.loadSettings();
    this.focusCore();
  }

  // --- React store ---------------------------------------------------------

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  getVersion = (): number => this.version;

  notify(): void {
    this.version++;
    for (const cb of this.listeners) cb();
  }

  // --- Lifecycle -----------------------------------------------------------

  mount(canvas: HTMLCanvasElement): void {
    if (this.canvas === canvas) return;
    this.unmount();
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.renderer.showPollution = this.showPollution;
    this.input = new InputController(this.camera, this.build, {
      onBlueprintCaptured: (bp) => {
        this.pendingBlueprint = bp;
        this.notify();
      },
      onInteract: () => this.sound.resume(),
    });
    this.input.attach(canvas);
    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      // Cap the backing store resolution: phones with dpr 3 would otherwise render 9x the pixels.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.camera.setViewport(rect.width, rect.height, dpr);
      this.renderer?.resize(rect.width, rect.height, dpr);
    };
    resize();
    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(canvas);
    window.addEventListener('keydown', this.onKey);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  unmount(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.input?.detach();
    this.input = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    this.renderer = null;
    this.canvas = null;
  }

  attachMinimap(canvas: HTMLCanvasElement | null): void {
    this.minimap = canvas ? new MinimapRenderer(canvas) : null;
    if (this.minimap) this.minimap.showPollution = this.showPollution;
  }

  /** Replaces the running world (new game / load / import). */
  loadWorld(world: World): void {
    this.world = world;
    this.build.setWorld(world);
    this.pendingBlueprint = null;
    this.toasts = [];
    this.acc = 0;
    this.autosaveTimer = 0;
    this.focusCore();
    this.notify();
  }

  focusCore(): void {
    const c = coreCenter(this.world);
    this.camera.setZoom(26);
    this.camera.centerOn(c.x, c.y);
  }

  setSpeed(speed: GameSpeed): void {
    this.speed = speed;
    this.notify();
  }

  togglePause(): void {
    this.setSpeed(this.speed === 0 ? 1 : 0);
  }

  setPollutionOverlay(on: boolean): void {
    this.showPollution = on;
    if (this.renderer) this.renderer.showPollution = on;
    if (this.minimap) this.minimap.showPollution = on;
    this.saveSettings();
    this.notify();
  }

  setMuted(muted: boolean): void {
    this.sound.setMuted(muted);
    this.saveSettings();
    this.notify();
  }

  setVolume(v: number): void {
    this.sound.setVolume(v);
    this.saveSettings();
    this.notify();
  }

  /** Plays a UI click (also unlocks audio on the first tap). */
  uiClick(sound: SoundName = 'ui'): void {
    this.sound.resume();
    this.sound.play(sound);
  }

  save(): boolean {
    const s = getStorage();
    if (!s) return false;
    const ok = saveToStorage(this.world, s);
    if (ok) {
      this.lastSaveAt = Date.now();
      this.saveWarned = false;
    } else if (!this.saveWarned) {
      this.saveWarned = true;
      this.pushToast('저장 공간이 부족해 자동 저장에 실패했습니다. JSON 내보내기를 이용하세요.', 'danger');
    }
    this.notify();
    return ok;
  }

  pushToast(message: string, level: ToastLevel = 'info'): void {
    const now = performance.now();
    const existing = this.toasts.find((t) => t.message === message);
    if (existing) {
      existing.expires = now + 3500;
      return;
    }
    this.toasts.push({ id: this.nextToastId++, message, level, expires: now + 3500 });
    if (this.toasts.length > 4) this.toasts.shift();
    this.notify();
  }

  // --- Loop ----------------------------------------------------------------

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.25, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (dt > 0) this.fps = this.fps * 0.95 + (1 / dt) * 0.05;

    if (this.speed > 0) {
      this.acc += dt * this.speed;
      const maxSteps = MAX_STEPS_PER_FRAME * this.speed;
      let steps = 0;
      while (this.acc >= SIM_DT && steps < maxSteps) {
        stepWorld(this.world);
        this.acc -= SIM_DT;
        steps++;
      }
      // A device that cannot keep up drops the backlog instead of spiralling.
      if (steps >= maxSteps) this.acc = 0;
    }
    this.drainEvents();
    this.renderer?.render(this.world, this.camera, this.build, dt);

    this.minimapTimer += dt;
    if (this.minimapTimer >= 0.1) {
      this.minimap?.draw(this.world, this.camera, this.minimapTimer);
      this.minimapTimer = 0;
    }
    this.ambienceTimer += dt;
    if (this.ambienceTimer >= 0.5) {
      this.ambienceTimer = 0;
      this.updateAmbience();
    }
    if (this.speed > 0 && this.world.state === 'playing') {
      this.autosaveTimer += dt;
      if (this.autosaveTimer >= AUTOSAVE_INTERVAL) {
        this.autosaveTimer = 0;
        this.save();
      }
    }
    this.uiTimer += dt;
    if (this.uiTimer >= 0.125) {
      this.uiTimer = 0;
      const t = performance.now();
      if (this.toasts.some((x) => x.expires <= t)) this.toasts = this.toasts.filter((x) => x.expires > t);
      this.notify();
    }
  };

  /** Machine hum follows the number of working machines on screen; crafting adds an occasional clank. */
  private updateAmbience(): void {
    if (this.speed === 0) {
      this.sound.setAmbience(0);
      return;
    }
    const b = this.camera.visibleTileBounds();
    let active = 0;
    let crafting = false;
    for (const bd of this.world.buildings.values()) {
      if (!bd.active || bd.belt) continue;
      if (bd.x < b.x0 || bd.y < b.y0 || bd.x > b.x1 || bd.y > b.y1) continue;
      active++;
      if (isCrafterKind(bd.kind)) crafting = true;
    }
    this.sound.setAmbience(Math.min(1, active / 20));
    if (crafting) this.sound.play('craft', 0, 0.6);
  }

  private playWorldSound(name: SoundName, x: number, y: number): void {
    if (GLOBAL_SOUNDS.has(name)) {
      this.sound.play(name);
      return;
    }
    const { width, height } = this.camera.viewport;
    const s = this.camera.worldToScreen(x, y);
    const outX = Math.max(0, Math.abs(s.x - width / 2) - width / 2);
    const outY = Math.max(0, Math.abs(s.y - height / 2) - height / 2);
    const off = Math.hypot(outX, outY);
    const vol = off <= 0 ? 1 : 1 - off / (Math.max(width, height) * 0.6);
    if (vol < 0.05) return;
    const zoomVol = Math.min(1, Math.max(0.35, this.camera.zoom / 28));
    const pan = Math.max(-1, Math.min(1, (s.x / Math.max(1, width)) * 2 - 1)) * 0.7;
    this.sound.play(name, pan, vol * zoomVol);
  }

  private drainEvents(): void {
    const events = this.world.events;
    if (events.length === 0) return;
    let important = false;
    for (const e of events) {
      switch (e.type) {
        case 'sound':
          this.playWorldSound(e.sound, e.x, e.y);
          break;
        case 'toast':
          this.pushToast(e.message, e.level);
          break;
        case 'shake':
          this.renderer?.addShake(e.strength);
          break;
        case 'victory':
          this.save();
          important = true;
          break;
        case 'defeat':
          // Keep the last good autosave so "load last save" restores a playable colony.
          important = true;
          break;
        case 'researchComplete':
        case 'nightStart':
        case 'dayStart':
        case 'launchStart':
          important = true;
          break;
        default:
          break;
      }
    }
    events.length = 0;
    if (important) this.notify();
  }

  // --- Browser events ------------------------------------------------------

  private onKey = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    switch (e.key) {
      case 'r':
      case 'R':
        this.build.rotate(e.shiftKey ? -1 : 1);
        break;
      case 'Escape':
      case 'q':
      case 'Q':
        this.build.setTool({ kind: 'inspect' });
        this.build.deselect();
        break;
      case 'x':
      case 'X':
      case 'Delete':
        this.build.setTool({ kind: 'demolish' });
        break;
      case 'b':
      case 'B':
        this.build.setTool({ kind: 'blueprintSelect' });
        break;
      case ' ':
        e.preventDefault();
        this.togglePause();
        break;
      case '+':
      case '=':
        this.camera.zoomAt(this.camera.viewport.width / 2, this.camera.viewport.height / 2, 1.2);
        break;
      case '-':
        this.camera.zoomAt(this.camera.viewport.width / 2, this.camera.viewport.height / 2, 1 / 1.2);
        break;
      case 'p':
      case 'P':
        this.setPollutionOverlay(!this.showPollution);
        break;
      default:
        return;
    }
    this.notify();
  };

  private onVisibility = (): void => {
    if (document.visibilityState === 'hidden' && this.world.state === 'playing') this.save();
  };

  private onPageHide = (): void => {
    if (this.world.state === 'playing') this.save();
  };

  private loadSettings(): void {
    try {
      const raw = getStorage()?.getItem(SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Partial<Settings>;
      if (typeof s.muted === 'boolean') this.sound.setMuted(s.muted);
      if (typeof s.volume === 'number' && Number.isFinite(s.volume)) this.sound.setVolume(s.volume);
      if (typeof s.showPollution === 'boolean') this.showPollution = s.showPollution;
    } catch {
      // Corrupt settings are ignored; defaults apply.
    }
  }

  private saveSettings(): void {
    const settings: Settings = { muted: this.sound.muted, volume: this.sound.volumeLevel, showPollution: this.showPollution };
    try {
      getStorage()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Settings are a convenience; failing to persist them is harmless.
    }
  }
}
