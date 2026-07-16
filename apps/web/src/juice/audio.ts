/**
 * The Ancient Games sound world: everything is synthesized in Web Audio —
 * no samples, no licensing, ~zero bundle cost. The voice is a kalimba
 * (thumb piano): sine tine + faint inharmonic overtone, echoed into a soft
 * feedback delay. SFX ride an A-major pentatonic scale so every sow is a
 * little rising melody; background music is a slow generative random walk,
 * so it never repeats — and each "track" is a different mood of the same
 * instrument: scale, tempo, register, density, and (for rain) a noise bed.
 */

export interface MusicStyle {
  id: string;
  name: string;
  hint: string;
  scale: number[];
  bpm: number;
  /** Probability of a melody note on each eighth. */
  density: number;
  noteDur: number;
  overtoneRatio: number;
  bass: Array<{ stepMod: number; at: number; midi: number; vel: number; dur: number }>;
  rainBed?: boolean;
}

export const MUSIC_STYLES: MusicStyle[] = [
  {
    id: 'sunrise',
    name: 'Morning sun',
    hint: 'warm & bright',
    scale: [57, 59, 61, 64, 66, 69, 71, 73, 76, 78],
    bpm: 72,
    density: 0.24,
    noteDur: 1.6,
    overtoneRatio: 4.05,
    bass: [
      { stepMod: 32, at: 0, midi: 45, vel: 0.5, dur: 3.2 },
      { stepMod: 32, at: 16, midi: 52, vel: 0.35, dur: 2.6 },
    ],
  },
  {
    id: 'dusk',
    name: 'Dusk fire',
    hint: 'low & slow',
    scale: [50, 53, 55, 57, 60, 62, 65, 67, 69],
    bpm: 58,
    density: 0.18,
    noteDur: 2.2,
    overtoneRatio: 3.2,
    bass: [
      { stepMod: 32, at: 0, midi: 38, vel: 0.55, dur: 4 },
      { stepMod: 32, at: 20, midi: 45, vel: 0.3, dur: 3 },
    ],
  },
  {
    id: 'rain',
    name: 'Soft rain',
    hint: 'sparse & misty',
    scale: [64, 67, 69, 71, 74, 76, 79, 81],
    bpm: 66,
    density: 0.1,
    noteDur: 2.6,
    overtoneRatio: 5.1,
    bass: [{ stepMod: 64, at: 0, midi: 52, vel: 0.3, dur: 4 }],
    rainBed: true,
  },
];

export type MusicId = 'off' | (typeof MUSIC_STYLES)[number]['id'];

const SFX_KEY = 'ag-sfx';
const MUSIC_KEY = 'ag-music';

/** A-major pentatonic for gameplay SFX. */
const SFX_SCALE = [57, 59, 61, 64, 66, 69, 71, 73, 76, 78, 81, 83, 85];

function hz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

class AudioEngine {
  sfxOn: boolean;
  musicId: MusicId;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private delaySend: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicTimer: number | null = null;
  private rainNodes: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private nextNoteTime = 0;
  private musicStep = 0;
  private walk = 4;

  constructor() {
    const sfx = typeof localStorage !== 'undefined' ? localStorage.getItem(SFX_KEY) : null;
    const music = typeof localStorage !== 'undefined' ? localStorage.getItem(MUSIC_KEY) : null;
    this.sfxOn = sfx !== '0';
    // Music is opt-in: starting a soundtrack on a user's first click is
    // presumptuous on the web. SFX default on, music defaults off.
    this.musicId =
      music === 'off' || MUSIC_STYLES.some((s) => s.id === music) ? (music as MusicId) : 'off';
  }

  private style(): MusicStyle | null {
    return MUSIC_STYLES.find((s) => s.id === this.musicId) ?? null;
  }

  /** Call from the first user gesture — browsers gate audio behind one. */
  unlock(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    if (this.musicId !== 'off') this.startMusic();
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    localStorage.setItem(SFX_KEY, on ? '1' : '0');
  }

  setMusic(id: MusicId): void {
    this.musicId = id;
    localStorage.setItem(MUSIC_KEY, id);
    this.stopMusic();
    if (id !== 'off') this.startMusic();
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof AudioContext === 'undefined') return null;
    const ctx = new AudioContext();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    // Soft echo shared by everything — the "room" the kalimba lives in.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.31;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const delayTone = ctx.createBiquadFilter();
    delayTone.type = 'lowpass';
    delayTone.frequency.value = 2200;
    delay.connect(delayTone);
    delayTone.connect(feedback);
    feedback.connect(delay);
    const delayOut = ctx.createGain();
    delayOut.gain.value = 0.5;
    delayTone.connect(delayOut);
    delayOut.connect(this.master);
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 1;
    this.delaySend.connect(delay);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.3;
    this.musicBus.connect(this.master);
    this.musicBus.connect(this.delaySend);

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });

    return ctx;
  }

  /** One kalimba tine: fundamental + faint inharmonic overtone. */
  private pluck(
    midi: number,
    opts: { when?: number; vel?: number; dur?: number; music?: boolean; overtone?: number } = {},
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.delaySend) return;
    const { vel = 0.5, dur = 1.1, music = false, overtone = 4.05 } = opts;
    const when = opts.when ?? ctx.currentTime;
    const out = music && this.musicBus ? this.musicBus : this.master;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vel, when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0004, when + dur);
    gain.connect(out);
    if (!music) {
      const send = ctx.createGain();
      send.gain.value = 0.35;
      gain.connect(send);
      send.connect(this.delaySend);
    }

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = hz(midi);
    osc.connect(gain);
    osc.start(when);
    osc.stop(when + dur + 0.05);

    const shimmer = ctx.createGain();
    shimmer.gain.setValueAtTime(0, when);
    shimmer.gain.linearRampToValueAtTime(vel * 0.12, when + 0.004);
    shimmer.gain.exponentialRampToValueAtTime(0.0004, when + 0.18);
    shimmer.connect(out);
    const ot = ctx.createOscillator();
    ot.type = 'sine';
    ot.frequency.value = hz(midi) * overtone;
    ot.connect(shimmer);
    ot.start(when);
    ot.stop(when + 0.25);
  }

  /* ===== Gameplay SFX ===== */

  /** Dry hand-scoop of seeds: a short breath of filtered noise. */
  scoop(): void {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const dur = 0.14;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.value = 0.22;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  /** One seed landing — the i-th step of a sow climbs the scale. */
  plinkStep(i: number): void {
    if (!this.sfxOn) return;
    const idx = Math.min(3 + i, SFX_SCALE.length - 1);
    this.pluck(SFX_SCALE[idx]!, { vel: 0.4, dur: 0.9 });
  }

  /** A seed landing in your own store: deeper, rounder, longer. */
  bong(): void {
    if (!this.sfxOn) return;
    this.pluck(52, { vel: 0.6, dur: 1.6 });
  }

  /** Capture: a fast high sparkle. */
  shimmer(): void {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    [76, 81, 85].forEach((m, i) => this.pluck(m, { when: t + i * 0.055, vel: 0.38, dur: 0.7 }));
  }

  extraTurn(): void {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.pluck(71, { when: t, vel: 0.4, dur: 0.6 });
    this.pluck(76, { when: t + 0.09, vel: 0.45, dur: 0.9 });
  }

  jingle(kind: 'win' | 'lose' | 'draw'): void {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    const phrase =
      kind === 'win' ? [64, 69, 73, 76, 81] : kind === 'lose' ? [64, 61, 59, 57] : [64, 66, 64];
    const gap = kind === 'lose' ? 0.22 : 0.13;
    phrase.forEach((m, i) =>
      this.pluck(m, { when: t + i * gap, vel: 0.5, dur: i === phrase.length - 1 ? 1.8 : 1 }),
    );
  }

  /* ===== Generative background music ===== */

  private startMusic(): void {
    const ctx = this.ensure();
    const style = this.style();
    if (!ctx || !style || this.musicTimer != null) return;
    this.nextNoteTime = ctx.currentTime + 0.2;
    this.musicStep = 0;
    this.walk = Math.floor(style.scale.length / 2);
    if (style.rainBed) this.startRain();
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 160);
  }

  private stopMusic(): void {
    if (this.musicTimer != null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.rainNodes) {
      this.rainNodes.gain.gain.linearRampToValueAtTime(0, (this.ctx?.currentTime ?? 0) + 0.4);
      const src = this.rainNodes.src;
      setTimeout(() => src.stop(), 500);
      this.rainNodes = null;
    }
  }

  private startRain(): void {
    const ctx = this.ensure();
    if (!ctx || !this.musicBus || this.rainNodes) return;
    const seconds = 2;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 850;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 1.2);
    src.connect(lp);
    lp.connect(gain);
    gain.connect(this.musicBus);
    src.start();
    this.rainNodes = { src, gain };
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    const style = this.style();
    if (!ctx || !style) return;
    const sixteenth = 60 / style.bpm / 4;
    while (this.nextNoteTime < ctx.currentTime + 0.45) {
      const step = this.musicStep++;
      const t = this.nextNoteTime;
      this.nextNoteTime += sixteenth;

      for (const b of style.bass) {
        if (step % b.stepMod === b.at) {
          this.pluck(b.midi, { when: t, vel: b.vel, dur: b.dur, music: true, overtone: style.overtoneRatio });
        }
      }

      // Sparse melody: a lazy random walk on the style's scale.
      if (step % 2 === 0 && Math.random() < style.density) {
        const drift = [-2, -1, 1, 1, 2][Math.floor(Math.random() * 5)]!;
        this.walk = Math.max(0, Math.min(style.scale.length - 1, this.walk + drift));
        this.pluck(style.scale[this.walk]!, {
          when: t,
          vel: 0.15 + Math.random() * 0.08,
          dur: style.noteDur,
          music: true,
          overtone: style.overtoneRatio,
        });
        if (Math.random() < 0.25) {
          const above = Math.min(this.walk + 2, style.scale.length - 1);
          this.pluck(style.scale[above]!, {
            when: t + sixteenth,
            vel: 0.09,
            dur: style.noteDur * 0.8,
            music: true,
            overtone: style.overtoneRatio,
          });
        }
      }
    }
  }
}

export const audio = new AudioEngine();
