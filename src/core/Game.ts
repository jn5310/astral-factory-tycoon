import { AUTOSAVE_INTERVAL, MAX_STEPS_PER_FRAME, SETTINGS_KEY, SIM_DT } from '../data/constants';
import { isCrafterKind } from '../data/buildings';
import type { Difficulty, GameMode } from '../data/difficulty';
import type { Blueprint } from '../systems/blueprint';
import { checkAchievements } from '../systems/achievements';
import { isNightPhase } from '../systems/daynight';
import { computeScore, type ScoreBreakdown } from '../systems/score';
import { dailyKey, dailyMutator, dailySeed } from '../utils/daily';
import { detectLang, enemyName, getLang, isLang, msg, readingMs, setLang, type Lang } from '../utils/i18n';
import { MusicEngine, type MusicMood } from '../utils/music';
import { randomSeed } from '../utils/rng';
import { SoundEngine } from '../utils/sound';
import { BuildController } from './build';
import { Camera } from './camera';
import { stepWorld } from './engine';
import type { SoundName, ToastLevel } from './events';
import { InputController } from './input';
import { MinimapRenderer } from './minimap';
import { loadProfile, recordScore, saveProfile, type Profile } from './profile';
import { Renderer } from './renderer';
import { getStorage, loadFromStorage, saveToStorage } from './save';
import type { TileXY } from './types';
import { coreCenter, createWorld, type World } from './World';

export interface Toast {
  id: number;
  message: string;
  level: ToastLevel;
  expires: number;
  focus?: TileXY;
}

export interface RadioMessage {
  id: number;
  text: string;
  expires: number;
}

export interface RunResult {
  score: ScoreBreakdown;
  /** Place in the high-score table (0-based), -1 when it did not place or was not recorded. */
  rank: number;
  victory: boolean;
}

export type GameSpeed = 0 | 1 | 2 | 3;
export type Screen = 'title' | 'playing';

export interface NewGameOptions {
  mode: GameMode;
  difficulty: Difficulty;
  seed?: number;
}

interface Settings {
  lang: Lang;
  muted: boolean;
  sfxVolume: number;
  musicVolume: number;
  showPollution: boolean;
}

/** Sounds that are not positional (UI / global alerts). */
const GLOBAL_SOUNDS: ReadonlySet<SoundName> = new Set<SoundName>([
  'alarm',
  'research',
  'victory',
  'defeat',
  'launch',
  'ui',
  'error',
  'mission',
  'achievement',
  'siren',
  'overclock',
  'freeze',
]);

export const APP_VERSION = '1.1.0';

function readSettings(): Partial<Settings> {
  try {
    const raw = getStorage()?.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const s = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Settings> = {};
    if (isLang(s.lang)) out.lang = s.lang;
    if (typeof s.muted === 'boolean') out.muted = s.muted;
    if (typeof s.sfxVolume === 'number' && Number.isFinite(s.sfxVolume)) out.sfxVolume = s.sfxVolume;
    // v1.0 stored a single "volume".
    else if (typeof s.volume === 'number' && Number.isFinite(s.volume)) out.sfxVolume = s.volume;
    if (typeof s.musicVolume === 'number' && Number.isFinite(s.musicVolume)) out.musicVolume = s.musicVolume;
    if (typeof s.showPollution === 'boolean') out.showPollution = s.showPollution;
    return out;
  } catch {
    return {};
  }
}

/** Applies the language before React renders (called from main.tsx). */
export function initLanguage(): Lang {
  const saved = readSettings().lang;
  const lang = saved ?? detectLang(typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []);
  setLang(lang);
  applyDocumentLanguage();
  return lang;
}

function applyDocumentLanguage(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = getLang();
  document.title = `${msg().meta.title} · ${msg().meta.tagline}`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', msg().meta.description);
}

/**
 * Owns the running game: fixed-timestep simulation driven by requestAnimationFrame, rendering,
 * input, sound and music, autosave, the meta profile, and a tiny subscribe/version store the
 * React HUD reads from.
 */
export class Game {
  world: World;
  readonly camera: Camera;
  readonly build: BuildController;
  readonly sound = new SoundEngine();
  readonly music: MusicEngine;
  profile: Profile;
  screen: Screen = 'title';
  speed: GameSpeed = 0;
  toasts: Toast[] = [];
  radio: RadioMessage | null = null;
  result: RunResult | null = null;
  /** Set when a blueprint selection finished; the HUD asks for a name. */
  pendingBlueprint: Blueprint | null = null;
  /** Ask the HUD to open the how-to-play sheet once (first ever run). */
  pendingHelp = false;
  /** Set by the HUD while a panel covers the map; the radio line waits instead of expiring unseen. */
  panelOpen = false;
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
  private metaTimer = 0;
  private minimapTimer = 0;
  private version = 0;
  private nextToastId = 1;
  private nextRadioId = 1;
  private radioQueue: string[] = [];
  private recordedWorld: World | null = null;
  private saveWarned = false;
  private readonly listeners = new Set<() => void>();

  constructor(world: World) {
    this.world = world;
    this.camera = new Camera(world.width, world.height);
    this.build = new BuildController(world);
    this.build.subscribe(() => this.notify());
    this.music = new MusicEngine(() => this.sound.audioOut());
    this.profile = loadProfile(getStorage());
    this.applySettings(readSettings());
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
      onInteract: () => this.unlockAudio(),
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

  /** The world canvas, for screenshots. */
  snapshotSource(): HTMLCanvasElement | null {
    return this.canvas;
  }

  /** Audio can only start inside a user gesture. */
  unlockAudio(): void {
    this.sound.resume();
    this.updateMusic();
  }

  // --- Screens and runs ----------------------------------------------------

  /** Replaces the running world (new game / load / import). */
  loadWorld(world: World): void {
    this.world = world;
    this.build.setWorld(world);
    this.pendingBlueprint = null;
    this.toasts = [];
    this.radio = null;
    this.radioQueue = [];
    this.result = null;
    this.acc = 0;
    this.autosaveTimer = 0;
    this.focusCore();
    this.notify();
  }

  startNewGame(opts: NewGameOptions): void {
    let world: World;
    if (opts.mode === 'daily') {
      const key = dailyKey(new Date());
      world = createWorld({ seed: dailySeed(key), mode: 'daily', difficulty: 'normal', mutator: dailyMutator(key), dailyKey: key });
    } else {
      world = createWorld({ seed: opts.seed ?? randomSeed(), mode: opts.mode, difficulty: opts.difficulty });
    }
    this.pendingHelp = this.profile.runs === 0;
    this.profile.runs++;
    saveProfile(getStorage(), this.profile);
    this.loadWorld(world);
    this.save();
    this.screen = 'playing';
    this.speed = 1;
    if (world.settings.mode !== 'sandbox') this.queueRadio(msg().radio.intro);
    this.pushToast(msg().setup.landed(world.seed), 'success');
    this.unlockAudio();
    this.notify();
  }

  continueGame(): void {
    this.screen = 'playing';
    this.speed = 1;
    this.focusCore();
    this.unlockAudio();
    this.notify();
  }

  quitToTitle(): void {
    if (this.world.state === 'playing') this.save();
    else {
      // A lost colony is never autosaved, so the last save is still playable: offer it as "Continue".
      const storage = getStorage();
      const saved = storage ? loadFromStorage(storage) : null;
      if (saved && saved.state === 'playing') this.loadWorld(saved);
    }
    this.build.setTool({ kind: 'inspect' });
    this.screen = 'title';
    this.speed = 0;
    this.result = null;
    this.updateMusic();
    this.notify();
  }

  dismissResult(): void {
    this.result = null;
    this.notify();
  }

  focusCore(): void {
    const c = coreCenter(this.world);
    this.camera.setZoom(26);
    this.camera.centerOn(c.x, c.y);
  }

  focus(x: number, y: number): void {
    this.camera.centerOn(x, y);
    this.notify();
  }

  setSpeed(speed: GameSpeed): void {
    this.speed = speed;
    this.notify();
  }

  togglePause(): void {
    if (this.screen !== 'playing') return;
    this.setSpeed(this.speed === 0 ? 1 : 0);
  }

  // --- Settings ------------------------------------------------------------

  private applySettings(s: Partial<Settings>): void {
    if (s.muted !== undefined) this.sound.setMuted(s.muted);
    if (s.sfxVolume !== undefined) this.sound.setSfxVolume(s.sfxVolume);
    if (s.musicVolume !== undefined) this.sound.setMusicVolume(s.musicVolume);
    if (s.showPollution !== undefined) this.showPollution = s.showPollution;
  }

  setLanguage(lang: Lang): void {
    setLang(lang);
    applyDocumentLanguage();
    this.saveSettings();
    this.notify();
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

  setSfxVolume(v: number): void {
    this.sound.setSfxVolume(v);
    this.saveSettings();
    this.notify();
  }

  setMusicVolume(v: number): void {
    this.sound.setMusicVolume(v);
    this.saveSettings();
    this.notify();
  }

  private saveSettings(): void {
    const settings: Settings = {
      lang: getLang(),
      muted: this.sound.muted,
      sfxVolume: this.sound.sfxLevel,
      musicVolume: this.sound.musicLevel,
      showPollution: this.showPollution,
    };
    try {
      getStorage()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Settings are a convenience; failing to persist them is harmless.
    }
  }

  /** Plays a UI click (also unlocks audio on the first tap). */
  uiClick(sound: SoundName = 'ui'): void {
    this.unlockAudio();
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
      this.pushToast(msg().menu.saveFailed, 'danger');
    }
    this.notify();
    return ok;
  }

  pushToast(message: string, level: ToastLevel = 'info', focus?: TileXY): void {
    const now = performance.now();
    const existing = this.toasts.find((t) => t.message === message);
    if (existing) {
      existing.expires = now + 4000;
      if (focus) existing.focus = focus;
      return;
    }
    this.toasts.push({ id: this.nextToastId++, message, level, expires: now + 4000, focus });
    if (this.toasts.length > 3) this.toasts.shift();
    this.notify();
  }

  queueRadio(text: string): void {
    if (this.radio?.text === text || this.radioQueue.includes(text)) return;
    this.radioQueue.push(text);
    if (!this.radio) this.nextRadio();
  }

  dismissRadio(): void {
    this.radio = null;
    this.nextRadio();
    this.notify();
  }

  private nextRadio(): void {
    const text = this.radioQueue.shift();
    if (text === undefined) return;
    this.radio = { id: this.nextRadioId++, text, expires: performance.now() + readingMs(text) };
    this.notify();
  }

  // --- Loop ----------------------------------------------------------------

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.25, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (dt > 0) this.fps = this.fps * 0.95 + (1 / dt) * 0.05;

    if (this.screen === 'playing' && this.speed > 0) {
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
    } else if (this.screen === 'title') {
      // Slow drift over the colony behind the title screen.
      this.camera.panByPixels(-dt * 14, 0);
      const c = coreCenter(this.world);
      if (Math.abs(this.camera.x - c.x) > 30) this.camera.centerOn(c.x - 20, this.camera.y);
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
    this.metaTimer += dt;
    if (this.metaTimer >= 1) {
      this.metaTimer = 0;
      this.updateMeta();
      this.updateMusic();
    }
    if (this.screen === 'playing' && this.speed > 0 && this.world.state === 'playing') {
      this.autosaveTimer += dt;
      if (this.autosaveTimer >= AUTOSAVE_INTERVAL) {
        this.autosaveTimer = 0;
        this.save();
      }
    }
    if (this.panelOpen && this.radio) this.radio.expires += dt * 1000;
    this.uiTimer += dt;
    if (this.uiTimer >= 0.125) {
      this.uiTimer = 0;
      const t = performance.now();
      if (this.toasts.some((x) => x.expires <= t)) this.toasts = this.toasts.filter((x) => x.expires > t);
      if (this.radio && this.radio.expires <= t) {
        this.radio = null;
        this.nextRadio();
      }
      this.notify();
    }
  };

  /** Achievements and codex discoveries are profile-wide, so they are checked here, not in the sim. */
  private updateMeta(): void {
    if (this.screen !== 'playing') return;
    let changed = false;
    const unlocked = new Set(Object.keys(this.profile.achievements) as (keyof Profile['achievements'])[]);
    for (const id of checkAchievements(this.world, unlocked)) {
      this.profile.achievements[id] = Date.now();
      this.pushToast(msg().toast.achievement(msg().achievements[id].name), 'success');
      this.sound.play('achievement');
      changed = true;
    }
    const seen = new Set(this.profile.seenEnemies);
    for (const e of this.world.enemies) {
      if (seen.has(e.type)) continue;
      seen.add(e.type);
      this.profile.seenEnemies.push(e.type);
      this.pushToast(msg().toast.newSpecies(enemyName(e.type)), 'info', { x: e.x, y: e.y });
      changed = true;
    }
    if (changed) saveProfile(getStorage(), this.profile);
  }

  private moodFor(): MusicMood {
    if (this.screen === 'title') return 'title';
    const w = this.world;
    if (w.enemies.some((e) => e.type === 'leviathan')) return 'boss';
    if ((isNightPhase(w.dayPhase) && w.waves.active) || w.enemies.length >= 6) return 'tense';
    return 'calm';
  }

  private updateMusic(): void {
    this.music.setMood(this.moodFor());
  }

  /** Records the finished run once per colony (high scores, daily best, wins). */
  private finishRun(victory: boolean): void {
    const world = this.world;
    const score = computeScore(world);
    let rank = -1;
    if (this.recordedWorld !== world && world.settings.mode !== 'sandbox') {
      this.recordedWorld = world;
      rank = recordScore(
        this.profile,
        {
          score: score.total,
          mode: world.settings.mode,
          difficulty: world.settings.difficulty,
          day: world.day,
          victory,
          date: dailyKey(new Date()),
          seed: world.seed,
        },
        world.settings.dailyKey,
      );
      if (victory) this.profile.wins++;
    }
    this.updateMeta();
    saveProfile(getStorage(), this.profile);
    this.result = { score, rank, victory };
    this.notify();
  }

  /** Machine hum follows the number of working machines on screen; crafting adds an occasional clank. */
  private updateAmbience(): void {
    if (this.speed === 0 || this.screen !== 'playing') {
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
          if (this.screen === 'playing') this.playWorldSound(e.sound, e.x, e.y);
          break;
        case 'toast':
          this.pushToast(e.message, e.level, e.focus);
          break;
        case 'radio':
          this.queueRadio(e.text);
          break;
        case 'shake':
          this.renderer?.addShake(e.strength);
          break;
        case 'screenFlash':
          this.renderer?.flash(e.color);
          break;
        case 'victory':
          this.save();
          this.finishRun(true);
          important = true;
          break;
        case 'defeat':
          // Keep the last good autosave so "load last save" restores a playable colony.
          this.finishRun(false);
          important = true;
          break;
        case 'researchComplete':
        case 'missionComplete':
        case 'nightStart':
        case 'dayStart':
        case 'launchStart':
        case 'bossSpawn':
        case 'rankUp':
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
    if (this.screen !== 'playing') return;
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
    if (document.visibilityState === 'hidden' && this.screen === 'playing' && this.world.state === 'playing') this.save();
  };

  private onPageHide = (): void => {
    if (this.screen === 'playing' && this.world.state === 'playing') this.save();
  };
}
