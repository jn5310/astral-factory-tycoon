import type { SoundName } from '../core/events';
import type { AudioOut } from './music';

interface SoundConfig {
  minInterval: number;
  volume: number;
}

const CONFIG: Record<SoundName, SoundConfig> = {
  place: { minInterval: 0.03, volume: 0.5 },
  demolish: { minInterval: 0.03, volume: 0.5 },
  mg: { minInterval: 0.05, volume: 0.22 },
  shotgun: { minInterval: 0.1, volume: 0.4 },
  cannon: { minInterval: 0.15, volume: 0.6 },
  laser: { minInterval: 0.08, volume: 0.18 },
  slow: { minInterval: 0.2, volume: 0.3 },
  repair: { minInterval: 0.3, volume: 0.2 },
  explosion: { minInterval: 0.06, volume: 0.5 },
  hit: { minInterval: 0.04, volume: 0.25 },
  enemyDie: { minInterval: 0.05, volume: 0.3 },
  acid: { minInterval: 0.12, volume: 0.25 },
  alarm: { minInterval: 1, volume: 0.5 },
  research: { minInterval: 0.3, volume: 0.5 },
  victory: { minInterval: 1, volume: 0.7 },
  defeat: { minInterval: 1, volume: 0.7 },
  ui: { minInterval: 0.02, volume: 0.3 },
  error: { minInterval: 0.1, volume: 0.4 },
  launch: { minInterval: 1, volume: 0.7 },
  craft: { minInterval: 0.2, volume: 0.15 },
  mission: { minInterval: 0.5, volume: 0.55 },
  achievement: { minInterval: 0.5, volume: 0.6 },
  orbital: { minInterval: 0.3, volume: 0.6 },
  freeze: { minInterval: 0.5, volume: 0.55 },
  pickup: { minInterval: 0.15, volume: 0.5 },
  meteor: { minInterval: 0.08, volume: 0.55 },
  rankUp: { minInterval: 0.3, volume: 0.45 },
  siren: { minInterval: 2, volume: 0.45 },
  overclock: { minInterval: 0.5, volume: 0.5 },
};

/**
 * Procedural sound: every effect is synthesised from oscillators and noise buffers at play time,
 * so the game ships zero audio files (the zero-asset rule). The context is created lazily and must
 * be resumed from a user gesture (browsers block autoplay).
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlayed: Partial<Record<SoundName, number>> = {};
  private humLevel: GainNode | null = null;
  muted = false;
  private sfxVolume = 0.8;
  private musicVolume = 0.5;

  /** Must be called from a user gesture handler to satisfy autoplay policies. */
  resume(): void {
    if (!this.ctx) this.init();
    void this.ctx?.resume();
  }

  private init(): void {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.musicBus.connect(this.master);
    const len = Math.floor(this.ctx.sampleRate * 0.4);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 1;
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxVolume;
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicBus) this.musicBus.gain.value = this.musicVolume;
  }

  get sfxLevel(): number {
    return this.sfxVolume;
  }

  get musicLevel(): number {
    return this.musicVolume;
  }

  /** Context and music bus for the soundtrack (null until audio has been unlocked). */
  audioOut(): AudioOut | null {
    if (!this.ctx || !this.musicBus) return null;
    return { ctx: this.ctx, bus: this.musicBus, noise: this.noiseBuffer };
  }

  /**
   * Continuous factory hum: a filtered sawtooth drone plus band-passed noise, pulsed by a slow LFO.
   * `level` (0..1) follows how many machines are working on screen.
   */
  setAmbience(level: number): void {
    const ctx = this.ctx;
    const master = this.sfxBus;
    if (!ctx || !master || ctx.state !== 'running') return;
    if (!this.humLevel) {
      const levelGain = ctx.createGain();
      levelGain.gain.value = 0;
      const mod = ctx.createGain();
      mod.gain.value = 1;
      const drone = ctx.createOscillator();
      drone.type = 'sawtooth';
      drone.frequency.value = 52;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 170;
      drone.connect(lowpass);
      lowpass.connect(mod);
      const rumble = ctx.createBufferSource();
      rumble.buffer = this.noiseBuffer;
      rumble.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 320;
      band.Q.value = 0.7;
      const rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0.4;
      rumble.connect(band);
      band.connect(rumbleGain);
      rumbleGain.connect(mod);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 2.2;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 0.3;
      lfo.connect(lfoDepth);
      lfoDepth.connect(mod.gain);
      mod.connect(levelGain);
      levelGain.connect(master);
      drone.start();
      rumble.start();
      lfo.start();
      this.humLevel = levelGain;
    }
    const target = Math.max(0, Math.min(1, level)) * 0.06;
    this.humLevel.gain.setTargetAtTime(target, ctx.currentTime, 0.5);
  }

  play(name: SoundName, pan = 0, distanceVolume = 1): void {
    if (this.muted) return;
    if (!this.ctx) this.init();
    const ctx = this.ctx;
    const master = this.sfxBus;
    if (!ctx || !master || ctx.state !== 'running') return;
    const cfg = CONFIG[name];
    const now = ctx.currentTime;
    const last = this.lastPlayed[name] ?? -Infinity;
    if (now - last < cfg.minInterval) return;
    this.lastPlayed[name] = now;

    const out = ctx.createGain();
    out.gain.value = cfg.volume * Math.max(0.05, Math.min(1, distanceVolume));
    const panner = ctx.createStereoPanner?.();
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      out.connect(panner);
      panner.connect(master);
    } else {
      out.connect(master);
    }
    this.synth(name, ctx, out, now);
  }

  private noise(ctx: AudioContext): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    return src;
  }

  private tone(ctx: AudioContext, type: OscillatorType, f0: number, f1: number, t0: number, dur: number, gain: GainNode): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    osc.connect(gain);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  private env(ctx: AudioContext, parent: GainNode, peak: number, attack: number, dur: number, t0: number): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(parent);
    return g;
  }

  private burst(ctx: AudioContext, out: GainNode, t0: number, dur: number, cutoff: number, peak = 1): void {
    const src = this.noise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 0.8;
    const g = this.env(ctx, out, peak, 0.005, dur, t0);
    src.connect(filter);
    filter.connect(g);
    src.start(t0);
    src.stop(t0 + dur);
  }

  private synth(name: SoundName, ctx: AudioContext, out: GainNode, t0: number): void {
    switch (name) {
      case 'mg':
        this.burst(ctx, out, t0, 0.07, 1800, 1);
        this.tone(ctx, 'square', 320, 120, t0, 0.06, this.env(ctx, out, 0.5, 0.004, 0.06, t0));
        break;
      case 'shotgun':
        this.burst(ctx, out, t0, 0.18, 1200, 1);
        this.tone(ctx, 'sawtooth', 180, 60, t0, 0.18, this.env(ctx, out, 0.6, 0.004, 0.18, t0));
        break;
      case 'cannon':
        this.tone(ctx, 'sawtooth', 160, 36, t0, 0.5, this.env(ctx, out, 1, 0.01, 0.5, t0));
        this.burst(ctx, out, t0, 0.3, 500, 0.8);
        break;
      case 'laser':
        this.tone(ctx, 'sawtooth', 900, 1500, t0, 0.12, this.env(ctx, out, 0.5, 0.005, 0.12, t0));
        break;
      case 'slow':
        this.tone(ctx, 'sine', 700, 200, t0, 0.3, this.env(ctx, out, 0.6, 0.02, 0.3, t0));
        break;
      case 'repair':
        this.tone(ctx, 'triangle', 500, 800, t0, 0.2, this.env(ctx, out, 0.5, 0.02, 0.2, t0));
        break;
      case 'explosion':
        this.tone(ctx, 'sawtooth', 120, 28, t0, 0.6, this.env(ctx, out, 1, 0.005, 0.6, t0));
        this.burst(ctx, out, t0, 0.5, 400, 1);
        break;
      case 'hit':
        this.burst(ctx, out, t0, 0.05, 2400, 0.6);
        break;
      case 'enemyDie':
        this.tone(ctx, 'square', 300, 80, t0, 0.18, this.env(ctx, out, 0.6, 0.005, 0.18, t0));
        this.burst(ctx, out, t0, 0.12, 900, 0.5);
        break;
      case 'acid':
        this.tone(ctx, 'sawtooth', 500, 160, t0, 0.2, this.env(ctx, out, 0.4, 0.01, 0.2, t0));
        break;
      case 'alarm':
        this.tone(ctx, 'square', 740, 740, t0, 0.18, this.env(ctx, out, 0.5, 0.02, 0.18, t0));
        this.tone(ctx, 'square', 580, 580, t0 + 0.2, 0.22, this.env(ctx, out, 0.5, 0.02, 0.22, t0 + 0.2));
        break;
      case 'place':
        this.tone(ctx, 'triangle', 420, 640, t0, 0.08, this.env(ctx, out, 0.6, 0.005, 0.08, t0));
        break;
      case 'demolish':
        this.tone(ctx, 'triangle', 500, 200, t0, 0.12, this.env(ctx, out, 0.6, 0.005, 0.12, t0));
        this.burst(ctx, out, t0, 0.1, 800, 0.5);
        break;
      case 'research':
        this.tone(ctx, 'sine', 523, 784, t0, 0.18, this.env(ctx, out, 0.5, 0.01, 0.18, t0));
        this.tone(ctx, 'sine', 659, 988, t0 + 0.12, 0.25, this.env(ctx, out, 0.5, 0.01, 0.25, t0 + 0.12));
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) =>
          this.tone(ctx, 'triangle', f, f, t0 + i * 0.14, 0.3, this.env(ctx, out, 0.6, 0.01, 0.3, t0 + i * 0.14)),
        );
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) =>
          this.tone(ctx, 'sawtooth', f, f * 0.98, t0 + i * 0.18, 0.4, this.env(ctx, out, 0.5, 0.01, 0.4, t0 + i * 0.18)),
        );
        break;
      case 'launch':
        this.tone(ctx, 'sawtooth', 60, 220, t0, 1.6, this.env(ctx, out, 0.9, 0.3, 1.6, t0));
        this.burst(ctx, out, t0, 1.5, 300, 0.6);
        break;
      case 'ui':
        this.tone(ctx, 'sine', 660, 880, t0, 0.05, this.env(ctx, out, 0.4, 0.003, 0.05, t0));
        break;
      case 'error':
        this.tone(ctx, 'square', 200, 160, t0, 0.15, this.env(ctx, out, 0.5, 0.005, 0.15, t0));
        break;
      case 'craft':
        this.tone(ctx, 'triangle', 300, 360, t0, 0.05, this.env(ctx, out, 0.3, 0.004, 0.05, t0));
        break;
      case 'mission':
        [523, 659, 784, 1047, 1319].forEach((f, i) =>
          this.tone(ctx, 'triangle', f, f, t0 + i * 0.07, 0.22, this.env(ctx, out, 0.5, 0.005, 0.22, t0 + i * 0.07)),
        );
        break;
      case 'achievement':
        [784, 988, 1175].forEach((f) => this.tone(ctx, 'sine', f, f, t0, 0.9, this.env(ctx, out, 0.35, 0.01, 0.9, t0)));
        this.tone(ctx, 'sine', 1568, 1568, t0 + 0.15, 0.8, this.env(ctx, out, 0.3, 0.01, 0.8, t0 + 0.15));
        break;
      case 'orbital':
        this.tone(ctx, 'sawtooth', 200, 1800, t0, 1.4, this.env(ctx, out, 0.4, 0.05, 1.4, t0));
        this.tone(ctx, 'sine', 900, 2400, t0, 1.4, this.env(ctx, out, 0.25, 0.05, 1.4, t0));
        break;
      case 'freeze':
        [2093, 1760, 1397, 1175].forEach((f, i) =>
          this.tone(ctx, 'sine', f, f * 0.98, t0 + i * 0.06, 0.6, this.env(ctx, out, 0.3, 0.005, 0.6, t0 + i * 0.06)),
        );
        this.burst(ctx, out, t0, 0.6, 5000, 0.4);
        break;
      case 'pickup':
        this.tone(ctx, 'square', 988, 988, t0, 0.07, this.env(ctx, out, 0.35, 0.003, 0.07, t0));
        this.tone(ctx, 'square', 1319, 1319, t0 + 0.08, 0.2, this.env(ctx, out, 0.35, 0.003, 0.2, t0 + 0.08));
        break;
      case 'meteor':
        this.burst(ctx, out, t0, 0.35, 900, 0.7);
        this.tone(ctx, 'sawtooth', 90, 25, t0, 0.7, this.env(ctx, out, 1, 0.005, 0.7, t0));
        break;
      case 'rankUp':
        this.tone(ctx, 'triangle', 659, 659, t0, 0.12, this.env(ctx, out, 0.45, 0.005, 0.12, t0));
        this.tone(ctx, 'triangle', 988, 988, t0 + 0.12, 0.3, this.env(ctx, out, 0.45, 0.005, 0.3, t0 + 0.12));
        break;
      case 'siren':
        for (let k = 0; k < 3; k++) {
          this.tone(ctx, 'sawtooth', 520, 880, t0 + k * 0.5, 0.25, this.env(ctx, out, 0.3, 0.02, 0.25, t0 + k * 0.5));
          this.tone(ctx, 'sawtooth', 880, 520, t0 + k * 0.5 + 0.25, 0.25, this.env(ctx, out, 0.3, 0.02, 0.25, t0 + k * 0.5 + 0.25));
        }
        break;
      case 'overclock':
        this.tone(ctx, 'square', 110, 880, t0, 0.6, this.env(ctx, out, 0.3, 0.02, 0.6, t0));
        this.tone(ctx, 'sine', 220, 1760, t0, 0.6, this.env(ctx, out, 0.25, 0.02, 0.6, t0));
        break;
      default:
        break;
    }
  }
}
