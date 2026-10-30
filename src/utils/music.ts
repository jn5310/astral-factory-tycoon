/**
 * Generative, adaptive soundtrack built entirely from Web Audio oscillators and noise
 * (zero audio files). A lookahead scheduler queues notes ~250 ms ahead; the pattern
 * for each 16th-note step comes from the pure `stepEvents` function below.
 */

export type MusicMood = 'title' | 'calm' | 'tense' | 'boss';

export type NoteKind = 'pad' | 'arp' | 'bass' | 'kick' | 'snare' | 'hat' | 'bell';

export interface NoteEvent {
  kind: NoteKind;
  /** MIDI note number (drums ignore it). */
  midi: number;
  /** Length in steps (16th notes). */
  steps: number;
}

interface MoodDef {
  bpm: number;
  /** One chord per two bars (32 steps), as MIDI notes. */
  chords: readonly (readonly number[])[];
  arp: boolean;
  /** Chance an arpeggio note plays (sparser = calmer). */
  arpDensity: number;
  bass: 'none' | 'eighths' | 'sixteenths';
  drums: 'none' | 'soft' | 'drive';
  bell: boolean;
  padCutoff: number;
}

export const MOODS: Record<MusicMood, MoodDef> = {
  title: {
    bpm: 64,
    chords: [[57, 60, 64], [52, 55, 59], [53, 57, 60], [48, 52, 55, 60]],
    arp: true,
    arpDensity: 0.55,
    bass: 'none',
    drums: 'none',
    bell: true,
    padCutoff: 1100,
  },
  calm: {
    bpm: 76,
    chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]],
    arp: true,
    arpDensity: 0.75,
    bass: 'none',
    drums: 'none',
    bell: true,
    padCutoff: 900,
  },
  tense: {
    bpm: 92,
    chords: [[50, 53, 57], [46, 50, 53], [55, 58, 62], [57, 61, 64]],
    arp: false,
    arpDensity: 0,
    bass: 'eighths',
    drums: 'soft',
    bell: false,
    padCutoff: 650,
  },
  boss: {
    bpm: 118,
    chords: [[52, 55, 59], [53, 57, 60], [52, 55, 59], [50, 54, 57]],
    arp: true,
    arpDensity: 0.9,
    bass: 'sixteenths',
    drums: 'drive',
    bell: false,
    padCutoff: 800,
  },
};

const STEPS_PER_CHORD = 32;

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function chordAt(mood: MusicMood, step: number): readonly number[] {
  const chords = MOODS[mood].chords;
  return chords[Math.floor(step / STEPS_PER_CHORD) % chords.length] ?? [57, 60, 64];
}

/** Notes that start on a given 16th-note step. `rand` returns [0, 1). Pure, for testing. */
export function stepEvents(mood: MusicMood, step: number, rand: () => number): NoteEvent[] {
  const def = MOODS[mood];
  const chord = chordAt(mood, step);
  const root = chord[0] ?? 57;
  const inBar = step % 16;
  const out: NoteEvent[] = [];
  if (step % STEPS_PER_CHORD === 0) for (const n of chord) out.push({ kind: 'pad', midi: n, steps: STEPS_PER_CHORD });
  if (def.arp && step % 2 === 0 && rand() < def.arpDensity) {
    const order = [0, 1, 2, 1];
    const tone = chord[(order[(step / 2) % order.length] ?? 0) % chord.length] ?? root;
    out.push({ kind: 'arp', midi: tone + 12, steps: 2 });
  }
  if (def.bass === 'eighths' && step % 2 === 0) out.push({ kind: 'bass', midi: root - 12 + (inBar === 14 ? 7 : 0), steps: 2 });
  if (def.bass === 'sixteenths') out.push({ kind: 'bass', midi: root - 12 + (step % 4 === 2 ? 12 : 0), steps: 1 });
  if (def.drums === 'soft') {
    if (inBar === 0 || inBar === 8) out.push({ kind: 'kick', midi: 0, steps: 1 });
    if (inBar === 4 || inBar === 12) out.push({ kind: 'hat', midi: 0, steps: 1 });
  } else if (def.drums === 'drive') {
    if (inBar % 4 === 0) out.push({ kind: 'kick', midi: 0, steps: 1 });
    if (inBar === 4 || inBar === 12) out.push({ kind: 'snare', midi: 0, steps: 1 });
    if (inBar % 2 === 1) out.push({ kind: 'hat', midi: 0, steps: 1 });
  }
  if (def.bell && step % (STEPS_PER_CHORD * 2) === 0) out.push({ kind: 'bell', midi: (chord[2] ?? root) + 24, steps: 16 });
  return out;
}

export interface AudioOut {
  ctx: AudioContext;
  bus: AudioNode;
  noise: AudioBuffer | null;
}

const LOOKAHEAD = 0.25;
const FADE = 0.8;

export class MusicEngine {
  private mood: MusicMood | null = null;
  private pending: MusicMood | null | undefined = undefined;
  private switchAt = 0;
  private step = 0;
  private nextTime = 0;
  private gain: GainNode | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly getAudio: () => AudioOut | null) {}

  /** Crossfades to a mood; null fades the music out. */
  setMood(mood: MusicMood | null): void {
    const target = this.pending !== undefined ? this.pending : this.mood;
    if (mood === target) return;
    const audio = this.getAudio();
    if (!audio) return;
    this.ensureStarted(audio);
    const g = this.gain;
    if (!g) return;
    const now = audio.ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(0, now + FADE);
    this.pending = mood;
    this.switchAt = now + FADE;
  }

  private ensureStarted(audio: AudioOut): void {
    if (this.gain) return;
    this.gain = audio.ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(audio.bus);
    this.interval = setInterval(() => this.tick(), 50);
  }

  dispose(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.gain?.disconnect();
    this.gain = null;
  }

  private tick(): void {
    const audio = this.getAudio();
    const g = this.gain;
    if (!audio || !g || audio.ctx.state !== 'running') return;
    const now = audio.ctx.currentTime;
    if (this.pending !== undefined && now >= this.switchAt) {
      this.mood = this.pending;
      this.pending = undefined;
      this.step = 0;
      this.nextTime = now + 0.05;
      if (this.mood) {
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(1, now + 1.5);
      }
    }
    const mood = this.mood;
    if (!mood) return;
    // After the tab was hidden the timer fell behind: skip ahead instead of firing a burst.
    if (this.nextTime < now - 0.1) this.nextTime = now + 0.05;
    const stepLen = 60 / MOODS[mood].bpm / 4;
    while (this.nextTime < now + LOOKAHEAD) {
      for (const ev of stepEvents(mood, this.step, Math.random)) this.play(audio, g, mood, ev, this.nextTime, stepLen);
      this.nextTime += stepLen;
      this.step++;
    }
  }

  private envelope(ctx: AudioContext, out: AudioNode, t: number, peak: number, attack: number, hold: number, release: number): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    g.connect(out);
    return g;
  }

  private osc(ctx: AudioContext, type: OscillatorType, freq: number, t: number, end: number, out: AudioNode, detune = 0): void {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    o.connect(out);
    o.start(t);
    o.stop(end);
  }

  private noiseBurst(audio: AudioOut, t: number, dur: number, filterType: BiquadFilterType, freq: number, peak: number, out: AudioNode): void {
    if (!audio.noise) return;
    const src = audio.ctx.createBufferSource();
    src.buffer = audio.noise;
    const f = audio.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    const g = this.envelope(audio.ctx, out, t, peak, 0.002, 0, dur);
    src.connect(f);
    f.connect(g);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private play(audio: AudioOut, out: AudioNode, mood: MusicMood, ev: NoteEvent, t: number, stepLen: number): void {
    const ctx = audio.ctx;
    const dur = ev.steps * stepLen;
    const f = midiToFreq(ev.midi);
    switch (ev.kind) {
      case 'pad': {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = MOODS[mood].padCutoff;
        lp.connect(out);
        const g = this.envelope(ctx, lp, t, 0.05, Math.min(1.5, dur * 0.3), dur * 0.5, Math.min(2, dur * 0.4));
        this.osc(ctx, 'sawtooth', f, t, t + dur * 1.3, g, -7);
        this.osc(ctx, 'sawtooth', f, t, t + dur * 1.3, g, 7);
        this.osc(ctx, 'triangle', f / 2, t, t + dur * 1.3, g);
        break;
      }
      case 'arp': {
        const g = this.envelope(ctx, out, t, mood === 'boss' ? 0.05 : 0.07, 0.005, 0.02, 0.45);
        this.osc(ctx, mood === 'boss' ? 'square' : 'triangle', f, t, t + 0.6, g);
        break;
      }
      case 'bass': {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = mood === 'boss' ? 700 : 420;
        lp.connect(out);
        const g = this.envelope(ctx, lp, t, 0.12, 0.005, dur * 0.4, dur * 0.5);
        this.osc(ctx, 'sawtooth', f, t, t + dur + 0.1, g);
        break;
      }
      case 'kick': {
        const g = this.envelope(ctx, out, t, 0.35, 0.002, 0.02, 0.25);
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(130, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.35);
        break;
      }
      case 'snare':
        this.noiseBurst(audio, t, 0.16, 'bandpass', 1800, 0.12, out);
        break;
      case 'hat':
        this.noiseBurst(audio, t, 0.04, 'highpass', 7000, mood === 'boss' ? 0.05 : 0.035, out);
        break;
      case 'bell': {
        const g = this.envelope(ctx, out, t, 0.04, 0.01, 0, 2.6);
        this.osc(ctx, 'sine', f, t, t + 3, g);
        this.osc(ctx, 'sine', f * 2.01, t, t + 1.5, g);
        break;
      }
    }
  }
}
