'use client';

import { useEffect, useRef } from 'react';

import { supabaseClient } from '@/lib/supabaseClient';

type Mode = 'idle' | 'running' | 'paused' | 'over';

type Pipe = {
  x: number;
  top: number;
  bottom: number;
  passed: boolean;
  seed: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  size: number;
  hue: number;
};

type HistoryEntry = {
  score: number;
  name: string;
  playedAt: number;
};

type VoiceFilter = {
  type?: BiquadFilterType;
  frequency?: number;
  q?: number;
};

type AmbientVoice = {
  type?: OscillatorType;
  frequency?: number;
  detune?: number;
  sweepFrequency?: number;
  sweepDepth?: number;
  vibratoFrequency?: number;
  vibratoDepth?: number;
  vibratoVariance?: number;
  filter?: VoiceFilter;
  panDepth?: number;
  panOffset?: number;
  panFrequency?: number;
  gain?: number;
};

type AmbientLevels = {
  idle?: number;
  running?: number;
  gameover?: number;
};

type AmbientProfile = {
  voices?: AmbientVoice[];
  filter?: VoiceFilter;
  levels?: AmbientLevels;
  transitionTime?: number;
  voiceGain?: number;
  panDepth?: number;
  panFrequency?: number;
};

type FlapProfile = {
  type?: OscillatorType;
  startFreq?: number;
  peakFreq?: number;
  endFreq?: number;
  peakTime?: number;
  endTime?: number;
  filterType?: BiquadFilterType;
  filterFrequency?: number;
  filterQ?: number;
  attack?: number;
  maxGain?: number;
  decay?: number;
  minGain?: number;
  endGain?: number;
};

type ScoreProfile = {
  highType?: OscillatorType;
  lowType?: OscillatorType;
  highStart?: number;
  highMid?: number;
  highEnd?: number;
  highMidTime?: number;
  highEndTime?: number;
  lowStart?: number;
  lowEnd?: number;
  lowEndTime?: number;
  shimmerGain?: number;
  delayTime?: number;
  feedbackGain?: number;
  attack?: number;
  maxGain?: number;
  release?: number;
  minGain?: number;
  endGain?: number;
};

type GameOverProfile = {
  type?: OscillatorType;
  startFreq?: number;
  endFreq?: number;
  duration?: number;
  filterType?: BiquadFilterType;
  filterStart?: number;
  filterEnd?: number;
  attack?: number;
  maxGain?: number;
  release?: number;
  noiseAmount?: number;
  noiseDuration?: number;
  noiseDecay?: number;
  minGain?: number;
  endGain?: number;
};

type AudioProfile = {
  ambient?: AmbientProfile;
  flap?: FlapProfile;
  score?: ScoreProfile;
  gameover?: GameOverProfile;
};

type Theme = {
  id: string;
  label: string;
  emoji: string;
  accentColor: string;
  particleHue: (pulse: number, index: number) => number;
  drawBackground: (ctx: CanvasRenderingContext2D, pulse: number, width: number, height: number) => void;
  drawPipe: (
    ctx: CanvasRenderingContext2D,
    pipe: Pipe,
    height: number,
    pulse: number,
    pipeWidth: number
  ) => void;
  drawBird: (ctx: CanvasRenderingContext2D, pulse: number, radius: number) => void;
  audioProfile?: AudioProfile;
};

type AmbientInstance = {
  osc: OscillatorNode;
  filter: BiquadFilterNode;
  voiceGain: GainNode;
  sweepLfo: OscillatorNode | null;
  vibrato: OscillatorNode | null;
  panLfo: OscillatorNode | null;
};

const STORAGE_KEY = 'flappy-dopamine-best-score';
const NAME_STORAGE_KEY = 'flappy-dopamine-player-name';
const HISTORY_LIMIT = 12;
const DPR_LIMIT = 2.5;

const DEFAULT_AUDIO_PROFILE: Required<AudioProfile> = {
  ambient: {
    voices: [
      {
        type: 'sawtooth',
        frequency: 96,
        detune: -14,
        sweepFrequency: 0.05,
        sweepDepth: 180,
        vibratoFrequency: 0.9,
        vibratoDepth: 7.2,
        filter: { type: 'lowpass', frequency: 560, q: 12 },
        panDepth: 0.75,
      },
      {
        type: 'sawtooth',
        frequency: 162,
        detune: 9,
        sweepFrequency: 0.035,
        sweepDepth: 150,
        vibratoFrequency: 1,
        vibratoDepth: 5.5,
        filter: { type: 'lowpass', frequency: 580, q: 11 },
        panDepth: 0.7,
      },
      {
        type: 'sawtooth',
        frequency: 224,
        detune: 16,
        sweepFrequency: 0.045,
        sweepDepth: 170,
        vibratoFrequency: 0.95,
        vibratoDepth: 8.4,
        filter: { type: 'lowpass', frequency: 600, q: 12 },
        panDepth: 0.7,
      },
    ],
    filter: { type: 'lowpass', frequency: 560, q: 12 },
    levels: { idle: 0.35, running: 0.85, gameover: 0.2 },
    transitionTime: 0.9,
  },
  flap: {
    type: 'triangle',
    startFreq: 360,
    peakFreq: 880,
    endFreq: 220,
    peakTime: 0.08,
    endTime: 0.34,
    filterType: 'bandpass',
    filterFrequency: 720,
    filterQ: 8,
    attack: 0.02,
    maxGain: 0.45,
    decay: 0.4,
  },
  score: {
    highType: 'sine',
    lowType: 'triangle',
    highStart: 640,
    highMid: 960,
    highEnd: 1280,
    highMidTime: 0.12,
    highEndTime: 0.22,
    lowStart: 280,
    lowEnd: 420,
    lowEndTime: 0.18,
    shimmerGain: 0.26,
    delayTime: 0.24,
    feedbackGain: 0.3,
    attack: 0.02,
    maxGain: 0.5,
    release: 0.6,
  },
  gameover: {
    type: 'sawtooth',
    startFreq: 520,
    endFreq: 140,
    duration: 1.2,
    filterType: 'lowpass',
    filterStart: 1400,
    filterEnd: 220,
    attack: 0.04,
    maxGain: 0.55,
    release: 1.1,
    noiseAmount: 0.4,
    noiseDuration: 0.6,
    noiseDecay: 0.5,
  },
};

function cloneVoice(voice: AmbientVoice | undefined): AmbientVoice {
  if (!voice) {
    return {};
  }
  const cloned: AmbientVoice = { ...voice };
  if (voice.filter) {
    cloned.filter = { ...voice.filter };
  }
  return cloned;
}

function mergeAudioProfile(themeProfile?: AudioProfile): Required<AudioProfile> {
  const overrides = themeProfile ?? {};
  const ambientOverride = overrides.ambient ?? {};
  const ambient: AmbientProfile = {
    ...DEFAULT_AUDIO_PROFILE.ambient,
    ...ambientOverride,
  };
  ambient.levels = {
    ...DEFAULT_AUDIO_PROFILE.ambient.levels,
    ...(ambientOverride.levels ?? {}),
  };
  ambient.filter = {
    ...DEFAULT_AUDIO_PROFILE.ambient.filter,
    ...(ambientOverride.filter ?? {}),
  };
  const sourceVoices = (ambientOverride.voices && ambientOverride.voices.length
    ? ambientOverride.voices
    : DEFAULT_AUDIO_PROFILE.ambient.voices) ?? [];
  ambient.voices = sourceVoices.map((voice) => cloneVoice(voice));

  return {
    ambient,
    flap: { ...DEFAULT_AUDIO_PROFILE.flap, ...(overrides.flap ?? {}) },
    score: { ...DEFAULT_AUDIO_PROFILE.score, ...(overrides.score ?? {}) },
    gameover: { ...DEFAULT_AUDIO_PROFILE.gameover, ...(overrides.gameover ?? {}) },
  };
}

class AudioController {
  private ctx: (AudioContext & { resume?: () => Promise<void> }) | null = null;

  private master: GainNode | null = null;

  private ambientGain: GainNode | null = null;

  private ambientVoices: AmbientInstance[] = [];

  private profile: Required<AudioProfile> = mergeAudioProfile();

  private readonly masterLevel = 0.3;

  private muted = false;

  constructor(
    private readonly getTheme: () => Theme,
    private readonly getMode: () => Mode,
  ) {}

  ensureContext() {
    if (typeof window === 'undefined') {
      return;
    }
    const AudioContextClass = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AudioContextClass) {
      return;
    }
    if (!this.ctx) {
      this.ctx = new AudioContextClass();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.masterLevel;
      this.master.connect(this.ctx.destination);
    } else if (this.ctx.state === 'suspended') {
      void this.ctx.resume?.();
    }
    this.profile = mergeAudioProfile(this.getTheme().audioProfile);
    this.refreshProfile(true);
  }

  dispose() {
    if (this.ctx) {
      this.disposeAmbientPad();
      if (this.master) {
        this.master.disconnect();
      }
      this.ctx.close?.();
      this.ctx = null;
      this.master = null;
      this.ambientGain = null;
    }
  }

  setTheme(theme: Theme, immediate = false) {
    this.profile = mergeAudioProfile(theme.audioProfile);
    if (this.ctx && this.master) {
      this.refreshProfile(immediate);
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.value = muted ? 0 : this.masterLevel;
    }
  }

  isMuted() {
    return this.muted;
  }

  handleModeChange(immediate = false) {
    this.updateAmbientState(immediate);
  }

  playFlap() {
    if (!this.ctx || !this.master) {
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const settings = this.profile.flap;

    const osc = ctx.createOscillator();
    osc.type = settings.type ?? 'triangle';
    const startFreq = settings.startFreq ?? 360;
    const peakFreq = settings.peakFreq ?? startFreq * 2.4;
    const endFreq = settings.endFreq ?? startFreq / 1.6;
    const peakTime = settings.peakTime ?? 0.08;
    const endTime = settings.endTime ?? settings.decay ?? 0.4;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(peakFreq, now + peakTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + endTime);

    const filter = ctx.createBiquadFilter();
    filter.type = settings.filterType ?? 'bandpass';
    filter.frequency.value = settings.filterFrequency ?? 720;
    filter.Q.value = settings.filterQ ?? 8;

    const gain = ctx.createGain();
    const attack = settings.attack ?? 0.02;
    const maxGain = settings.maxGain ?? 0.45;
    const decay = settings.decay ?? 0.4;

    gain.gain.setValueAtTime(settings.minGain ?? 0.0001, now);
    gain.gain.linearRampToValueAtTime(maxGain, now + attack);
    gain.gain.exponentialRampToValueAtTime(settings.endGain ?? 0.0001, now + decay);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    osc.start(now);
    osc.stop(now + Math.max(decay, 0.5));
  }

  playScore() {
    if (!this.ctx || !this.master) {
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const settings = this.profile.score;

    const shimmer = ctx.createGain();
    shimmer.gain.value = settings.shimmerGain ?? 0.26;
    shimmer.connect(this.master);

    const highs = ctx.createOscillator();
    highs.type = settings.highType ?? 'sine';
    highs.frequency.setValueAtTime(settings.highStart ?? 640, now);
    if (settings.highMid) {
      highs.frequency.linearRampToValueAtTime(settings.highMid, now + (settings.highMidTime ?? 0.12));
    }
    if (settings.highEnd) {
      highs.frequency.linearRampToValueAtTime(settings.highEnd, now + (settings.highEndTime ?? 0.22));
    }

    const lows = ctx.createOscillator();
    lows.type = settings.lowType ?? 'triangle';
    lows.frequency.setValueAtTime(settings.lowStart ?? 280, now);
    lows.frequency.linearRampToValueAtTime(settings.lowEnd ?? 420, now + (settings.lowEndTime ?? 0.18));

    const gain = ctx.createGain();
    const attack = settings.attack ?? 0.02;
    const maxGain = settings.maxGain ?? 0.5;
    const release = settings.release ?? 0.6;

    gain.gain.setValueAtTime(settings.minGain ?? 0.0001, now);
    gain.gain.linearRampToValueAtTime(maxGain, now + attack);
    gain.gain.exponentialRampToValueAtTime(settings.endGain ?? 0.0001, now + release);

    const delay = ctx.createDelay();
    delay.delayTime.value = settings.delayTime ?? 0.24;
    const feedback = ctx.createGain();
    feedback.gain.value = settings.feedbackGain ?? 0.3;
    delay.connect(feedback);
    feedback.connect(delay);

    highs.connect(gain);
    lows.connect(gain);
    gain.connect(shimmer);
    gain.connect(delay);
    delay.connect(shimmer);

    const stopTime = now + Math.max(release, 0.5);
    highs.start(now);
    highs.stop(stopTime);
    lows.start(now);
    lows.stop(stopTime);
  }

  playGameOver() {
    if (!this.ctx || !this.master) {
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const settings = this.profile.gameover;

    const osc = ctx.createOscillator();
    osc.type = settings.type ?? 'sawtooth';
    const duration = settings.duration ?? Math.max(settings.release ?? 1.1, 1.1);
    osc.frequency.setValueAtTime(settings.startFreq ?? 520, now);
    osc.frequency.exponentialRampToValueAtTime(settings.endFreq ?? 140, now + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = settings.filterType ?? 'lowpass';
    filter.frequency.setValueAtTime(settings.filterStart ?? 1400, now);
    filter.frequency.exponentialRampToValueAtTime(settings.filterEnd ?? 220, now + duration);

    const gain = ctx.createGain();
    const attack = settings.attack ?? 0.04;
    const maxGain = settings.maxGain ?? 0.55;
    const release = settings.release ?? duration;

    gain.gain.setValueAtTime(settings.minGain ?? 0.0001, now);
    gain.gain.linearRampToValueAtTime(maxGain, now + attack);
    gain.gain.exponentialRampToValueAtTime(settings.endGain ?? 0.0001, now + release);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    if (settings.noiseAmount) {
      const noiseDuration = settings.noiseDuration ?? 0.6;
      const noiseBuffer = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * noiseDuration), ctx.sampleRate);
      const channel = noiseBuffer.getChannelData(0);
      for (let i = 0; i < channel.length; i += 1) {
        const fade = 1 - i / channel.length;
        channel[i] = (Math.random() * 2 - 1) * fade;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(settings.minGain ?? 0.0001, now);
      noiseGain.gain.linearRampToValueAtTime(settings.noiseAmount, now + 0.02);
      const noiseDecay = settings.noiseDecay ?? 0.5;
      noiseGain.gain.exponentialRampToValueAtTime(settings.endGain ?? 0.0001, now + noiseDecay);
      noise.connect(noiseGain);
      noiseGain.connect(this.master);
      noise.start(now);
      noise.stop(now + noiseDuration);
    }

    osc.start(now);
    osc.stop(now + duration);
  }

  private refreshProfile(immediate = false) {
    if (!this.ctx || !this.master) {
      return;
    }
    this.createAmbientPad(this.profile.ambient ?? DEFAULT_AUDIO_PROFILE.ambient);
    this.updateAmbientState(immediate);
  }

  private disposeAmbientPad() {
    if (!this.ctx) {
      this.ambientVoices = [];
      return;
    }
    const now = this.ctx.currentTime;
    for (const voice of this.ambientVoices) {
      if (voice.voiceGain) {
        voice.voiceGain.gain.setTargetAtTime(0.0001, now, 0.2);
      }
      voice.osc.stop(now + 0.35);
      voice.filter.disconnect();
      if (voice.sweepLfo) {
        voice.sweepLfo.stop(now + 0.35);
      }
      if (voice.vibrato) {
        voice.vibrato.stop(now + 0.35);
      }
      if (voice.panLfo) {
        voice.panLfo.stop(now + 0.35);
      }
    }
    this.ambientVoices = [];
  }

  private createAmbientPad(ambientProfile: AmbientProfile) {
    if (!this.ctx || !this.master) {
      return;
    }
    if (!this.ambientGain) {
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0;
      this.ambientGain.connect(this.master);
    }

    this.disposeAmbientPad();

    const ctx = this.ctx;
    const voices = ((ambientProfile.voices && ambientProfile.voices.length
      ? ambientProfile.voices
      : DEFAULT_AUDIO_PROFILE.ambient.voices) ?? []) as AmbientVoice[];
    const voiceCount = voices.length || 1;

    this.ambientVoices = voices.map((voiceConfig) => {
      const config = cloneVoice(voiceConfig);
      const osc = ctx.createOscillator();
      osc.type = config.type ?? 'sawtooth';
      const baseFrequency = config.frequency ?? 220;
      osc.frequency.value = baseFrequency;
      if (config.detune !== undefined) {
        osc.detune.value = config.detune;
      }

      const filter = ctx.createBiquadFilter();
      const filterConfig = config.filter ?? ambientProfile.filter ?? DEFAULT_AUDIO_PROFILE.ambient.filter ?? { type: 'lowpass', frequency: 560, q: 12 };
      filter.type = filterConfig.type ?? 'lowpass';
      filter.frequency.value = filterConfig.frequency ?? 560;
      filter.Q.value = filterConfig.q ?? 12;

      let sweepLfo: OscillatorNode | null = null;
      const sweepFrequency = config.sweepFrequency ?? 0;
      if (sweepFrequency) {
        sweepLfo = ctx.createOscillator();
        sweepLfo.frequency.value = sweepFrequency;
        const sweepDepth = ctx.createGain();
        sweepDepth.gain.value = config.sweepDepth ?? 160;
        sweepLfo.connect(sweepDepth);
        sweepDepth.connect(filter.frequency);
        sweepLfo.start();
      }

      let vibrato: OscillatorNode | null = null;
      const vibratoFrequency = config.vibratoFrequency ?? 0;
      if (vibratoFrequency) {
        vibrato = ctx.createOscillator();
        const variance = config.vibratoVariance ?? 0.35;
        vibrato.frequency.value = vibratoFrequency + (Math.random() - 0.5) * variance;
        const vibratoDepth = ctx.createGain();
        vibratoDepth.gain.value = config.vibratoDepth ?? 6;
        vibrato.connect(vibratoDepth);
        vibratoDepth.connect(osc.frequency);
        vibrato.start();
      }

      let output: AudioNode = filter;
      let panLfo: OscillatorNode | null = null;
      if (ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        const panOffset = config.panOffset ?? -0.6 + Math.random() * 1.2;
        panner.pan.value = panOffset;
        output.connect(panner);
        output = panner;

        const panDepth = config.panDepth ?? ambientProfile.panDepth ?? 0.75;
        const panFrequency = config.panFrequency ?? ambientProfile.panFrequency ?? 0.03;
        if (panDepth > 0 && panFrequency > 0) {
          panLfo = ctx.createOscillator();
          panLfo.frequency.value = panFrequency;
          const panGain = ctx.createGain();
          panGain.gain.value = panDepth;
          panLfo.connect(panGain);
          panGain.connect(panner.pan);
          panLfo.start();
        }
      }

      const voiceGain = ctx.createGain();
      const gainValue = config.gain ?? ambientProfile.voiceGain ?? 0.24 / voiceCount;
      voiceGain.gain.value = gainValue;
      output.connect(voiceGain);
      voiceGain.connect(this.ambientGain!);

      osc.connect(filter);
      osc.start();

      return {
        osc,
        filter,
        voiceGain,
        sweepLfo,
        vibrato,
        panLfo,
      };
    });
  }

  private updateAmbientState(immediate = false) {
    if (!this.ctx || !this.ambientGain) {
      return;
    }
    const now = this.ctx.currentTime;
    const levels = {
      ...(DEFAULT_AUDIO_PROFILE.ambient.levels ?? {}),
      ...(this.profile.ambient.levels ?? {}),
    };
    const transition = this.profile.ambient.transitionTime ?? DEFAULT_AUDIO_PROFILE.ambient.transitionTime ?? 0.9;

    let target = levels.idle ?? 0.35;
    const mode = this.getMode();
    if (mode === 'running') {
      target = levels.running ?? target;
    } else if (mode === 'over') {
      target = levels.gameover ?? target;
    }

    this.ambientGain.gain.cancelScheduledValues(now);
    if (immediate) {
      this.ambientGain.gain.setValueAtTime(target, now);
    } else {
      this.ambientGain.gain.setTargetAtTime(target, now, transition);
    }
  }
}

const THEME_SWITCH_INTERVAL = 2;

const THEMES: Theme[] = [
  {
    id: 'neon',
    label: 'Néon Pulse',
    emoji: '⚡',
    accentColor: '#ff67ff',
    particleHue(pulse, index) {
      return (pulse * 90 + index * 45) % 360;
    },
    drawBackground(ctx, pulse, w, h) {
      ctx.save();
      const time = pulse * 0.8;
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, `hsl(${(time * 60) % 360}, 85%, 55%)`);
      gradient.addColorStop(0.5, `hsl(${(time * 90 + 120) % 360}, 80%, 45%)`);
      gradient.addColorStop(1, `hsl(${(time * 120 + 240) % 360}, 90%, 35%)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      const layers = 6;
      for (let i = 0; i < layers; i += 1) {
        ctx.beginPath();
        const amplitude = 40 + i * 14;
        const frequency = 0.006 + i * 0.002;
        const speed = 0.6 + i * 0.25;
        const offset = Math.sin(time * speed + i * 0.8) * 100;
        const hue = (time * 80 + i * 60) % 360;
        ctx.strokeStyle = `hsla(${hue}, 90%, 65%, ${0.08 + i * 0.06})`;
        ctx.lineWidth = 8;

        ctx.moveTo(-100, h / 2);
        for (let x = -100; x <= w + 100; x += 18) {
          const y = h / 2 + Math.sin(x * frequency + time * speed) * amplitude + offset;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      ctx.restore();
    },
    drawPipe(ctx, pipe, h, pulse, pipeWidth) {
      ctx.save();
      const baseHue = (pulse * 50 + pipe.seed * 360) % 360;
      const gradientTop = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipeWidth, pipe.top);
      gradientTop.addColorStop(0, `hsla(${baseHue}, 80%, 70%, 0.95)`);
      gradientTop.addColorStop(1, `hsla(${(baseHue + 60) % 360}, 80%, 40%, 0.95)`);
      ctx.fillStyle = gradientTop;
      ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);

      const gradientBottom = ctx.createLinearGradient(pipe.x, pipe.bottom, pipe.x + pipeWidth, h);
      gradientBottom.addColorStop(0, `hsla(${(baseHue + 60) % 360}, 90%, 50%, 0.95)`);
      gradientBottom.addColorStop(1, `hsla(${(baseHue + 180) % 360}, 90%, 35%, 0.95)`);
      ctx.fillStyle = gradientBottom;
      ctx.fillRect(pipe.x, pipe.bottom, pipeWidth, h - pipe.bottom);

      ctx.fillStyle = `hsla(${baseHue}, 90%, 65%, 0.25)`;
      ctx.fillRect(pipe.x - 12, 0, 12, h);
      ctx.restore();
    },
    drawBird(ctx, pulse, radius) {
      ctx.save();
      const scale = radius / 24;
      ctx.scale(scale, scale);

      const hue = (pulse * 120) % 360;
      const radial = ctx.createRadialGradient(0, -8, 6, 0, 0, 24);
      radial.addColorStop(0, `hsla(${hue}, 90%, 75%, 0.95)`);
      radial.addColorStop(1, `hsla(${(hue + 120) % 360}, 85%, 50%, 0.95)`);

      ctx.fillStyle = radial;
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 24 * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `hsla(${(hue + 200) % 360}, 80%, 65%, 0.85)`;
      ctx.beginPath();
      ctx.ellipse(-24 * 0.4, -10, 24 * 0.8, 24 * 0.5, 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `hsla(${(hue + 40) % 360}, 90%, 65%, 0.9)`;
      ctx.beginPath();
      ctx.moveTo(24 * 0.8, -6);
      ctx.quadraticCurveTo(24 * 1.4, 0, 24 * 0.8, 8);
      ctx.quadraticCurveTo(24 * 0.9, 0, 24 * 0.8, -6);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(24 * 0.2, -10, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
      ctx.beginPath();
      ctx.arc(24 * 0.5, -10, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    audioProfile: {
      ambient: {
        voices: [
          {
            type: 'sawtooth',
            frequency: 96,
            detune: -14,
            sweepFrequency: 0.05,
            sweepDepth: 160,
            vibratoFrequency: 0.9,
            vibratoDepth: 7.5,
            filter: { type: 'lowpass', frequency: 620, q: 12 },
            panDepth: 0.8,
          },
          {
            type: 'sawtooth',
            frequency: 162,
            detune: 12,
            sweepFrequency: 0.04,
            sweepDepth: 180,
            vibratoFrequency: 1.1,
            vibratoDepth: 5.5,
            filter: { type: 'lowpass', frequency: 580, q: 10 },
            panDepth: 0.65,
            panOffset: 0.35,
          },
          {
            type: 'triangle',
            frequency: 220,
            detune: -6,
            sweepFrequency: 0.06,
            sweepDepth: 190,
            vibratoFrequency: 0.7,
            vibratoDepth: 8.5,
            filter: { type: 'bandpass', frequency: 720, q: 8 },
            panDepth: 0.7,
            panOffset: -0.45,
          },
        ],
        levels: { idle: 0.32, running: 0.9, gameover: 0.22 },
      },
      flap: {
        type: 'triangle',
        startFreq: 360,
        peakFreq: 920,
        endFreq: 210,
        attack: 0.018,
        maxGain: 0.48,
        filterFrequency: 760,
      },
      score: {
        shimmerGain: 0.28,
        highMid: 1020,
        highEnd: 1400,
        highMidTime: 0.1,
        highEndTime: 0.22,
      },
      gameover: {
        startFreq: 520,
        endFreq: 160,
        filterStart: 1500,
        filterEnd: 260,
        noiseAmount: 0.42,
      },
    },
  },
  {
    id: 'dino',
    label: 'Crête Jurassique',
    emoji: '🦕',
    accentColor: '#ffb347',
    particleHue(pulse, index) {
      return (40 + Math.sin(pulse * 3 + index) * 20 + index * 12) % 360;
    },
    drawBackground(ctx, pulse, w, h) {
      ctx.save();
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#f7d79a');
      sky.addColorStop(0.5, '#f0a86f');
      sky.addColorStop(1, '#5b3f2b');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      const sunY = h * 0.25 + Math.sin(pulse * 0.6) * 12;
      const sunGradient = ctx.createRadialGradient(w * 0.65, sunY, 10, w * 0.65, sunY, 160);
      sunGradient.addColorStop(0, 'rgba(255, 240, 200, 0.9)');
      sunGradient.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx.fillStyle = sunGradient;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(120, 60, 30, 0.6)';
      ctx.beginPath();
      ctx.moveTo(-160, h * 0.7);
      for (let x = -160; x <= w + 160; x += 80) {
        const y = h * 0.7 + Math.sin(pulse * 0.5 + x * 0.01) * 18 + (x % 160 === 0 ? -40 : 0);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w + 160, h);
      ctx.lineTo(-160, h);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(70, 35, 18, 0.8)';
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.68);
      ctx.lineTo(w * 0.32, h * 0.42);
      ctx.lineTo(w * 0.44, h * 0.68);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(210, 120, 60, 0.25)';
      for (let i = 0; i < 16; i += 1) {
        const plumeX = w * 0.32 + Math.sin(pulse * 1.4 + i) * 18;
        const plumeY = h * 0.42 - i * 14 - Math.cos(pulse * 0.8 + i) * 6;
        ctx.beginPath();
        ctx.ellipse(plumeX, plumeY, 20 - i, 14 - i * 0.5, pulse * 0.2 + i * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },
    drawPipe(ctx, pipe, h, pulse, pipeWidth) {
      ctx.save();
      ctx.fillStyle = 'rgba(73, 44, 16, 0.95)';
      ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
      ctx.fillRect(pipe.x, pipe.bottom, pipeWidth, h - pipe.bottom);

      ctx.fillStyle = 'rgba(92, 58, 26, 0.9)';
      ctx.fillRect(pipe.x + 6, 0, pipeWidth - 12, pipe.top);
      ctx.fillRect(pipe.x + 6, pipe.bottom, pipeWidth - 12, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 2;
      for (let y = 18; y < pipe.top - 12; y += 26) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 10, y);
        ctx.quadraticCurveTo(pipe.x + pipeWidth / 2, y + 6, pipe.x + pipeWidth - 10, y - 4);
        ctx.stroke();
      }
      for (let y = pipe.bottom + 12; y < h - 18; y += 26) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 10, y);
        ctx.quadraticCurveTo(pipe.x + pipeWidth / 2, y + 6, pipe.x + pipeWidth - 10, y - 4);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(255, 240, 200, 0.25)';
      ctx.lineWidth = 4;
      ctx.strokeRect(pipe.x + 4, 0, pipeWidth - 8, pipe.top);
      ctx.strokeRect(pipe.x + 4, pipe.bottom, pipeWidth - 8, h - pipe.bottom);
      ctx.restore();
    },
    drawBird(ctx, pulse, radius) {
      ctx.save();
      const scale = radius / 24;
      ctx.scale(scale, scale);

      const wing = Math.sin(pulse * 9) * 12;
      ctx.fillStyle = 'rgba(90, 60, 35, 0.85)';
      ctx.beginPath();
      ctx.moveTo(-6, 6);
      ctx.lineTo(-2, 18);
      ctx.lineTo(2, 6);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(220, 140, 60, 0.9)';
      ctx.beginPath();
      ctx.moveTo(-30, -14);
      ctx.lineTo(18, -wing);
      ctx.lineTo(-30, 14);
      ctx.closePath();
      ctx.fill();

      const bodyGradient = ctx.createLinearGradient(-24, -12, 26, 12);
      bodyGradient.addColorStop(0, 'rgba(250, 220, 160, 0.92)');
      bodyGradient.addColorStop(1, 'rgba(200, 120, 60, 0.92)');
      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(240, 220, 180, 0.95)';
      ctx.beginPath();
      ctx.arc(16, -4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(30, 25, 20, 0.95)';
      ctx.beginPath();
      ctx.arc(18, -4, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(220, 140, 60, 0.9)';
      ctx.beginPath();
      ctx.moveTo(26, -2);
      ctx.lineTo(38, 0);
      ctx.lineTo(26, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    audioProfile: {
      ambient: {
        voices: [
          {
            type: 'triangle',
            frequency: 96,
            detune: -10,
            sweepFrequency: 0.03,
            sweepDepth: 90,
            vibratoFrequency: 0.6,
            vibratoDepth: 4.5,
            filter: { type: 'lowpass', frequency: 520, q: 10 },
            panDepth: 0.4,
            panOffset: -0.3,
          },
          {
            type: 'sine',
            frequency: 148,
            detune: 6,
            sweepFrequency: 0.028,
            sweepDepth: 120,
            vibratoFrequency: 0.7,
            vibratoDepth: 6.5,
            filter: { type: 'lowpass', frequency: 480, q: 8 },
            panDepth: 0.45,
            panOffset: 0.2,
          },
          {
            type: 'triangle',
            frequency: 198,
            detune: -10,
            sweepFrequency: 0.025,
            sweepDepth: 100,
            vibratoFrequency: 0.55,
            vibratoDepth: 5,
            filter: { type: 'bandpass', frequency: 420, q: 6 },
            panDepth: 0.35,
            panOffset: 0.45,
          },
        ],
        levels: { idle: 0.3, running: 0.75, gameover: 0.2 },
        transitionTime: 1.2,
      },
      flap: {
        type: 'sine',
        startFreq: 280,
        peakFreq: 520,
        endFreq: 200,
        filterType: 'bandpass',
        filterFrequency: 540,
        filterQ: 6,
        attack: 0.025,
        maxGain: 0.38,
        decay: 0.45,
      },
      score: {
        highType: 'sine',
        highStart: 520,
        highMid: 680,
        highEnd: 880,
        highMidTime: 0.14,
        highEndTime: 0.3,
        lowType: 'triangle',
        lowStart: 260,
        lowEnd: 340,
        shimmerGain: 0.18,
        delayTime: 0.28,
        feedbackGain: 0.26,
        release: 0.75,
      },
      gameover: {
        type: 'triangle',
        startFreq: 420,
        endFreq: 120,
        filterType: 'lowpass',
        filterStart: 1100,
        filterEnd: 200,
        attack: 0.05,
        maxGain: 0.48,
        release: 1.2,
        noiseAmount: 0.32,
      },
    },
  },
  {
    id: 'cyber',
    label: 'Cyber Rave',
    emoji: '🪩',
    accentColor: '#03e3ff',
    particleHue(pulse, index) {
      return (180 + Math.sin(pulse * 6 + index) * 90 + index * 15) % 360;
    },
    drawBackground(ctx, pulse, w, h) {
      ctx.save();
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#080322');
      gradient.addColorStop(0.5, '#110638');
      gradient.addColorStop(1, '#021f3f');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      const gridSize = 90;
      const offset = (pulse * 120) % gridSize;
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0, 255, 230, 0.12)';
      for (let x = -gridSize; x < w + gridSize; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x + offset, 0);
        ctx.lineTo(x + offset, h);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(0, 180, 255, 0.16)';
      for (let y = h; y > -gridSize; y -= gridSize) {
        ctx.beginPath();
        const yOffset = (pulse * 80 + y) % gridSize;
        ctx.moveTo(0, yOffset + y);
        ctx.lineTo(w, yOffset + y);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'lighter';
      const scans = 5;
      for (let i = 0; i < scans; i += 1) {
        const y = (pulse * 120 + (i * h) / scans) % h;
        const grad = ctx.createLinearGradient(0, y - 6, 0, y + 6);
        grad.addColorStop(0, 'rgba(0, 255, 200, 0)');
        grad.addColorStop(0.5, 'rgba(0, 255, 200, 0.35)');
        grad.addColorStop(1, 'rgba(0, 255, 200, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, y - 6, w, 12);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    },
    drawPipe(ctx, pipe, h, pulse, pipeWidth) {
      ctx.save();
      const glow = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipeWidth, 0);
      glow.addColorStop(0, 'rgba(0, 255, 210, 0.15)');
      glow.addColorStop(0.5, 'rgba(0, 120, 255, 0.5)');
      glow.addColorStop(1, 'rgba(0, 255, 210, 0.15)');

      ctx.fillStyle = 'rgba(10, 6, 32, 0.92)';
      ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
      ctx.fillRect(pipe.x, pipe.bottom, pipeWidth, h - pipe.bottom);

      ctx.strokeStyle = glow;
      ctx.lineWidth = 5;
      ctx.strokeRect(pipe.x + 2, 0, pipeWidth - 4, pipe.top);
      ctx.strokeRect(pipe.x + 2, pipe.bottom, pipeWidth - 4, h - pipe.bottom);

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0, 255, 200, 0.25)';
      for (let y = 16; y < pipe.top - 8; y += 28) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 6, y);
        ctx.lineTo(pipe.x + pipeWidth - 6, y);
        ctx.stroke();
      }
      for (let y = pipe.bottom + 12; y < h - 8; y += 28) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 6, y);
        ctx.lineTo(pipe.x + pipeWidth - 6, y);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(255, 0, 180, 0.35)';
      ctx.beginPath();
      const flicker = Math.sin(pulse * 10 + pipe.seed * Math.PI * 2) * 8;
      ctx.moveTo(pipe.x + pipeWidth / 2 + flicker, pipe.top - 18);
      ctx.lineTo(pipe.x + pipeWidth / 2 - flicker, pipe.top + 18);
      ctx.moveTo(pipe.x + pipeWidth / 2 - flicker, pipe.bottom - 18);
      ctx.lineTo(pipe.x + pipeWidth / 2 + flicker, pipe.bottom + 18);
      ctx.stroke();

      ctx.restore();
    },
    drawBird(ctx, pulse, radius) {
      ctx.save();
      const scale = radius / 24;
      ctx.scale(scale, scale);
      const wingOffset = Math.sin(pulse * 12) * 12;
      ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.beginPath();
      ctx.moveTo(-30, -14);
      ctx.lineTo(18, -wingOffset);
      ctx.lineTo(-30, 14);
      ctx.closePath();
      ctx.fill();

      const bodyGradient = ctx.createLinearGradient(-20, -20, 26, 20);
      bodyGradient.addColorStop(0, 'rgba(0, 255, 255, 0.9)');
      bodyGradient.addColorStop(1, 'rgba(0, 120, 255, 0.9)');
      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.moveTo(-18, -18);
      ctx.lineTo(12, -10);
      ctx.lineTo(26, 0);
      ctx.lineTo(12, 10);
      ctx.lineTo(-18, 18);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(0, 255, 255, 0.65)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 0, 180, 0.5)';
      ctx.beginPath();
      ctx.moveTo(-10, -14);
      ctx.lineTo(6, -4);
      ctx.lineTo(-10, 12);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(10, -6, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(20, 20, 20, 0.95)';
      ctx.beginPath();
      ctx.arc(12, -6, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 120, 0, 0.85)';
      ctx.beginPath();
      ctx.moveTo(26, -2);
      ctx.lineTo(34, 0);
      ctx.lineTo(26, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    audioProfile: {
      ambient: {
        voices: [
          {
            type: 'square',
            frequency: 128,
            detune: -6,
            sweepFrequency: 0.08,
            sweepDepth: 120,
            vibratoFrequency: 1.6,
            vibratoDepth: 4.5,
            filter: { type: 'bandpass', frequency: 880, q: 9 },
            panDepth: 0.5,
            panOffset: -0.4,
          },
          {
            type: 'square',
            frequency: 196,
            detune: 8,
            sweepFrequency: 0.06,
            sweepDepth: 160,
            vibratoFrequency: 1.2,
            vibratoDepth: 5.5,
            filter: { type: 'bandpass', frequency: 760, q: 8 },
            panDepth: 0.6,
            panOffset: 0.3,
          },
          {
            type: 'sawtooth',
            frequency: 288,
            detune: 2,
            sweepFrequency: 0.07,
            sweepDepth: 140,
            vibratoFrequency: 1.4,
            vibratoDepth: 6.5,
            filter: { type: 'highpass', frequency: 420, q: 7 },
            panDepth: 0.45,
          },
        ],
        levels: { idle: 0.28, running: 1, gameover: 0.24 },
        transitionTime: 0.6,
      },
      flap: {
        type: 'square',
        startFreq: 420,
        peakFreq: 980,
        endFreq: 240,
        filterType: 'highpass',
        filterFrequency: 860,
        filterQ: 11,
        attack: 0.015,
        maxGain: 0.42,
        decay: 0.32,
      },
      score: {
        highType: 'square',
        lowType: 'square',
        highStart: 720,
        highMid: 1080,
        highEnd: 1560,
        highMidTime: 0.1,
        highEndTime: 0.24,
        lowStart: 320,
        lowEnd: 560,
        shimmerGain: 0.22,
        delayTime: 0.16,
        feedbackGain: 0.34,
      },
      gameover: {
        type: 'square',
        startFreq: 640,
        endFreq: 220,
        filterType: 'bandpass',
        filterStart: 1800,
        filterEnd: 380,
        attack: 0.03,
        maxGain: 0.5,
        release: 1,
        noiseAmount: 0.28,
      },
    },
  },
  {
    id: 'fire',
    label: 'Brasier Céleste',
    emoji: '🔥',
    accentColor: '#ff5c2f',
    particleHue(pulse, index) {
      return (20 + Math.sin(pulse * 5 + index) * 40 + index * 25) % 360;
    },
    drawBackground(ctx, pulse, w, h) {
      ctx.save();
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#220102');
      sky.addColorStop(0.5, '#4a0a05');
      sky.addColorStop(1, '#0b0202');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i += 1) {
        const plumeX = ((i * w) / 4 + Math.sin(pulse * 0.6 + i) * 120 + w) % w;
        const gradient = ctx.createRadialGradient(plumeX, h * 0.78, 10, plumeX, h * 0.78, 220);
        gradient.addColorStop(0, 'rgba(255, 180, 50, 0.9)');
        gradient.addColorStop(0.5, 'rgba(255, 80, 30, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 40, 10, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(plumeX - 220, h * 0.3, 440, h);
      }
      ctx.globalCompositeOperation = 'source-over';

      ctx.fillStyle = 'rgba(120, 20, 6, 0.85)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.85);
      for (let x = 0; x <= w; x += 20) {
        const y = h * 0.85 + Math.sin(pulse * 2 + x * 0.04) * 18;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 120, 30, 0.4)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i += 1) {
        const flicker = Math.sin(pulse * 8 + i) * 14;
        ctx.beginPath();
        ctx.moveTo((i * w) / 8 + flicker, h);
        ctx.lineTo((i * w) / 8 + flicker / 2, h * 0.55);
        ctx.stroke();
      }

      ctx.restore();
    },
    drawPipe(ctx, pipe, h, pulse, pipeWidth) {
      ctx.save();
      const basalt = ctx.createLinearGradient(pipe.x, 0, pipe.x, h);
      basalt.addColorStop(0, 'rgba(40, 10, 5, 0.95)');
      basalt.addColorStop(0.5, 'rgba(22, 4, 2, 0.95)');
      basalt.addColorStop(1, 'rgba(14, 2, 1, 0.95)');
      ctx.fillStyle = basalt;
      ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
      ctx.fillRect(pipe.x, pipe.bottom, pipeWidth, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(255, 90, 20, 0.45)';
      ctx.lineWidth = 3;
      ctx.strokeRect(pipe.x + 3, 0, pipeWidth - 6, pipe.top);
      ctx.strokeRect(pipe.x + 3, pipe.bottom, pipeWidth - 6, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(255, 70, 15, 0.6)';
      ctx.lineWidth = 2;
      const crackOffset = Math.sin(pulse * 5 + pipe.seed * Math.PI * 2) * 14;
      for (let y = 12; y < pipe.top - 8; y += 30) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 14 + crackOffset, y);
        ctx.lineTo(pipe.x + pipeWidth - 14 - crackOffset, y + 12);
        ctx.stroke();
      }
      for (let y = pipe.bottom + 8; y < h - 12; y += 30) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 14 - crackOffset, y);
        ctx.lineTo(pipe.x + pipeWidth - 14 + crackOffset, y + 12);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255, 150, 40, 0.85)';
      ctx.beginPath();
      ctx.moveTo(pipe.x + pipeWidth / 2, pipe.top + 10);
      ctx.quadraticCurveTo(
        pipe.x + pipeWidth / 2 + 30,
        pipe.top + 40,
        pipe.x + pipeWidth / 2,
        pipe.top + 70,
      );
      ctx.quadraticCurveTo(
        pipe.x + pipeWidth / 2 - 30,
        pipe.top + 40,
        pipe.x + pipeWidth / 2,
        pipe.top + 10,
      );
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(pipe.x + pipeWidth / 2, pipe.bottom - 10);
      ctx.quadraticCurveTo(
        pipe.x + pipeWidth / 2 - 30,
        pipe.bottom - 40,
        pipe.x + pipeWidth / 2,
        pipe.bottom - 70,
      );
      ctx.quadraticCurveTo(
        pipe.x + pipeWidth / 2 + 30,
        pipe.bottom - 40,
        pipe.x + pipeWidth / 2,
        pipe.bottom - 10,
      );
      ctx.fill();

      ctx.restore();
    },
    drawBird(ctx, pulse, radius) {
      ctx.save();
      const scale = radius / 24;
      ctx.scale(scale, scale);
      const wing = Math.sin(pulse * 12) * 18;

      ctx.fillStyle = 'rgba(255, 110, 30, 0.92)';
      ctx.beginPath();
      ctx.moveTo(-24, 0);
      ctx.quadraticCurveTo(-52, wing, -12, -12);
      ctx.quadraticCurveTo(-44, wing + 10, -24, 0);
      ctx.fill();

      const body = ctx.createLinearGradient(-20, -30, 28, 30);
      body.addColorStop(0, 'rgba(255, 200, 60, 0.95)');
      body.addColorStop(1, 'rgba(255, 70, 20, 0.95)');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(16, -4, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(40, 10, 0, 0.9)';
      ctx.beginPath();
      ctx.arc(18, -4, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 180, 60, 0.95)';
      ctx.beginPath();
      ctx.moveTo(28, -2);
      ctx.lineTo(40, 0);
      ctx.lineTo(28, 2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 200, 120, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-6, 12);
      ctx.quadraticCurveTo(4, 24, 14, 12);
      ctx.stroke();
      ctx.restore();
    },
    audioProfile: {
      ambient: {
        voices: [
          {
            type: 'sawtooth',
            frequency: 160,
            detune: -8,
            sweepFrequency: 0.06,
            sweepDepth: 180,
            vibratoFrequency: 1.2,
            vibratoDepth: 6.5,
            filter: { type: 'bandpass', frequency: 960, q: 12 },
            panDepth: 0.45,
          },
          {
            type: 'triangle',
            frequency: 220,
            detune: 6,
            sweepFrequency: 0.05,
            sweepDepth: 160,
            vibratoFrequency: 1,
            vibratoDepth: 5.5,
            filter: { type: 'bandpass', frequency: 840, q: 10 },
            panDepth: 0.55,
            panOffset: -0.3,
          },
          {
            type: 'sawtooth',
            frequency: 320,
            detune: -12,
            sweepFrequency: 0.045,
            sweepDepth: 140,
            vibratoFrequency: 1.4,
            vibratoDepth: 7.5,
            filter: { type: 'highpass', frequency: 500, q: 9 },
            panDepth: 0.5,
            panOffset: 0.35,
          },
        ],
        levels: { idle: 0.32, running: 0.92, gameover: 0.26 },
        transitionTime: 0.5,
      },
      flap: {
        type: 'sawtooth',
        startFreq: 520,
        peakFreq: 980,
        endFreq: 280,
        attack: 0.015,
        maxGain: 0.5,
        filterType: 'highpass',
        filterFrequency: 860,
        filterQ: 10,
      },
      score: {
        shimmerGain: 0.3,
        highType: 'sawtooth',
        highStart: 820,
        highMid: 1160,
        highEnd: 1680,
        highMidTime: 0.08,
        highEndTime: 0.22,
        lowType: 'triangle',
        lowStart: 340,
        lowEnd: 520,
        delayTime: 0.18,
        feedbackGain: 0.36,
      },
      gameover: {
        type: 'sawtooth',
        startFreq: 720,
        endFreq: 200,
        filterType: 'bandpass',
        filterStart: 2000,
        filterEnd: 320,
        noiseAmount: 0.35,
        attack: 0.02,
        maxGain: 0.58,
        release: 1.1,
      },
    },
  },
  {
    id: 'forest',
    label: 'Canopy Drift',
    emoji: '🌿',
    accentColor: '#68e691',
    particleHue(pulse, index) {
      return (110 + Math.sin(pulse * 4 + index) * 30 + index * 8) % 360;
    },
    drawBackground(ctx, pulse, w, h) {
      ctx.save();
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#f3f7c0');
      gradient.addColorStop(0.4, '#9bd08f');
      gradient.addColorStop(1, '#0b4b2e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      const layers = 4;
      for (let i = 0; i < layers; i += 1) {
        ctx.fillStyle = `rgba(12, ${60 + i * 30}, ${40 + i * 40}, ${0.35 + i * 0.18})`;
        ctx.beginPath();
        ctx.moveTo(-120, h);
        for (let x = -120; x <= w + 120; x += 40) {
          const wave = Math.sin(pulse * (0.4 + i * 0.2) + x * 0.01) * (24 + i * 14);
          ctx.lineTo(x, h - (h * 0.25 + i * 40) - wave);
        }
        ctx.lineTo(w + 120, h);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(34, 120, 70, 0.25)';
      for (let i = 0; i < 30; i += 1) {
        const leafX = (i * 73 + Math.sin(pulse * 3 + i) * 120 + w) % w;
        const leafY = (i * 91 + Math.cos(pulse * 2.2 + i) * 80 + h) % h;
        ctx.beginPath();
        ctx.ellipse(leafX, leafY, 4, 12, pulse + i, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },
    drawPipe(ctx, pipe, h, pulse, pipeWidth) {
      ctx.save();
      ctx.fillStyle = 'rgba(73, 44, 16, 0.95)';
      ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
      ctx.fillRect(pipe.x, pipe.bottom, pipeWidth, h - pipe.bottom);

      ctx.fillStyle = 'rgba(92, 58, 26, 0.9)';
      ctx.fillRect(pipe.x + 6, 0, pipeWidth - 12, pipe.top);
      ctx.fillRect(pipe.x + 6, pipe.bottom, pipeWidth - 12, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 2;
      for (let y = 18; y < pipe.top - 12; y += 26) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 10, y);
        ctx.quadraticCurveTo(pipe.x + pipeWidth / 2, y + 6, pipe.x + pipeWidth - 10, y - 4);
        ctx.stroke();
      }
      for (let y = pipe.bottom + 12; y < h - 18; y += 26) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 10, y);
        ctx.quadraticCurveTo(pipe.x + pipeWidth / 2, y + 6, pipe.x + pipeWidth - 10, y - 4);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(46, 140, 80, 0.9)';
      ctx.beginPath();
      ctx.ellipse(pipe.x + pipeWidth / 2, pipe.top + 16, pipeWidth * 0.7, 30, 0, Math.PI, 0, true);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(pipe.x + pipeWidth / 2, pipe.bottom - 16, pipeWidth * 0.7, 30, 0, 0, Math.PI, true);
      ctx.fill();

      ctx.strokeStyle = 'rgba(34, 100, 60, 0.6)';
      ctx.lineWidth = 3;
      const vineOffset = Math.sin(pulse * 3 + pipe.seed * Math.PI * 2) * 12;
      ctx.beginPath();
      ctx.moveTo(pipe.x + 4 + vineOffset, pipe.bottom);
      ctx.bezierCurveTo(
        pipe.x + pipeWidth / 2,
        pipe.bottom + 50,
        pipe.x + pipeWidth / 2 - vineOffset,
        pipe.bottom + 90,
        pipe.x + pipeWidth - 6,
        pipe.bottom + 130,
      );
      ctx.stroke();

      ctx.restore();
    },
    drawBird(ctx, pulse, radius) {
      ctx.save();
      const scale = radius / 24;
      ctx.scale(scale, scale);

      const bodyGradient = ctx.createLinearGradient(0, -28, 0, 32);
      bodyGradient.addColorStop(0, 'rgba(255, 245, 170, 0.95)');
      bodyGradient.addColorStop(1, 'rgba(80, 140, 70, 0.95)');
      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.ellipse(0, 4, 24, 30, 0, 0, Math.PI * 2);
      ctx.fill();

      const wingLift = Math.sin(pulse * 8) * 10;
      ctx.fillStyle = 'rgba(90, 170, 100, 0.9)';
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.quadraticCurveTo(-28, wingLift, -4, 24);
      ctx.quadraticCurveTo(4, 18, -6, 0);
      ctx.fill();

      ctx.fillStyle = 'rgba(240, 170, 40, 0.9)';
      ctx.beginPath();
      ctx.moveTo(26, 0);
      ctx.lineTo(36, 4);
      ctx.lineTo(26, 8);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(12, -6, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(30, 30, 30, 0.95)';
      ctx.beginPath();
      ctx.arc(14, -6, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(80, 140, 70, 0.9)';
      ctx.beginPath();
      ctx.moveTo(-10, -22);
      ctx.quadraticCurveTo(0, -34, 10, -22);
      ctx.lineTo(0, -18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    audioProfile: {
      ambient: {
        voices: [
          {
            type: 'sine',
            frequency: 86,
            detune: -4,
            sweepFrequency: 0.03,
            sweepDepth: 110,
            vibratoFrequency: 0.5,
            vibratoDepth: 5.5,
            filter: { type: 'lowpass', frequency: 520, q: 9 },
            panDepth: 0.4,
            panOffset: -0.35,
          },
          {
            type: 'triangle',
            frequency: 148,
            detune: 6,
            sweepFrequency: 0.028,
            sweepDepth: 140,
            vibratoFrequency: 0.7,
            vibratoDepth: 6.5,
            filter: { type: 'lowpass', frequency: 480, q: 8 },
            panDepth: 0.45,
            panOffset: 0.2,
          },
          {
            type: 'sine',
            frequency: 198,
            detune: -10,
            sweepFrequency: 0.025,
            sweepDepth: 100,
            vibratoFrequency: 0.55,
            vibratoDepth: 5,
            filter: { type: 'bandpass', frequency: 420, q: 6 },
            panDepth: 0.35,
            panOffset: 0.45,
          },
        ],
        levels: { idle: 0.3, running: 0.75, gameover: 0.2 },
        transitionTime: 1.2,
      },
      flap: {
        type: 'sine',
        startFreq: 280,
        peakFreq: 520,
        endFreq: 200,
        filterType: 'bandpass',
        filterFrequency: 540,
        filterQ: 6,
        attack: 0.025,
        maxGain: 0.38,
        decay: 0.45,
      },
      score: {
        highType: 'sine',
        highStart: 520,
        highMid: 680,
        highEnd: 880,
        highMidTime: 0.14,
        highEndTime: 0.3,
        lowType: 'triangle',
        lowStart: 260,
        lowEnd: 340,
        shimmerGain: 0.18,
        delayTime: 0.28,
        feedbackGain: 0.26,
        release: 0.75,
      },
      gameover: {
        type: 'triangle',
        startFreq: 420,
        endFreq: 120,
        filterType: 'lowpass',
        filterStart: 1100,
        filterEnd: 200,
        attack: 0.05,
        maxGain: 0.48,
        release: 1.2,
        noiseAmount: 0.32,
      },
    },
  },
  {
    id: 'frozen',
    label: 'Rêve Gelé',
    emoji: '❄️',
    accentColor: '#9ddcff',
    particleHue(pulse, index) {
      return (200 + Math.sin(pulse * 4 + index) * 25 + index * 10) % 360;
    },
    drawBackground(ctx, pulse, w, h) {
      ctx.save();
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#0a1845');
      sky.addColorStop(0.4, '#123c74');
      sky.addColorStop(1, '#d0ecff');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      const aurora = ctx.createLinearGradient(0, h * 0.2, w, h * 0.4);
      aurora.addColorStop(0, 'rgba(80, 200, 255, 0)');
      aurora.addColorStop(0.5, 'rgba(120, 255, 255, 0.45)');
      aurora.addColorStop(1, 'rgba(40, 180, 255, 0)');
      ctx.fillStyle = aurora;
      ctx.save();
      ctx.translate(0, Math.sin(pulse * 0.5) * 20);
      ctx.fillRect(0, h * 0.15, w, h * 0.3);
      ctx.restore();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      const baseY = h * 0.65;
      for (let i = 0; i < 5; i += 1) {
        const peakX = (i * 220 + Math.sin(pulse * 0.6 + i) * 90 + w) % (w + 220) - 110;
        ctx.beginPath();
        ctx.moveTo(peakX - 120, h);
        ctx.lineTo(peakX, baseY - 120 - Math.cos(pulse * 0.4 + i) * 40);
        ctx.lineTo(peakX + 120, h);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(210, 230, 250, 0.7)';
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (let x = 0; x <= w; x += 18) {
        const y = baseY + Math.sin(pulse * 1.5 + x * 0.04) * 12;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      for (let i = 0; i < 40; i += 1) {
        const snowX = (i * 73 + pulse * 120) % w;
        const snowY = (i * 91 + pulse * 140) % h;
        const size = 1.2 + ((i + Math.floor(pulse * 6)) % 3) * 0.6;
        ctx.beginPath();
        ctx.arc(snowX, snowY, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },
    drawPipe(ctx, pipe, h, pulse, pipeWidth) {
      ctx.save();
      const ice = ctx.createLinearGradient(pipe.x, 0, pipe.x, h);
      ice.addColorStop(0, 'rgba(200, 235, 255, 0.95)');
      ice.addColorStop(0.5, 'rgba(120, 180, 255, 0.85)');
      ice.addColorStop(1, 'rgba(40, 80, 140, 0.9)');
      ctx.fillStyle = ice;
      ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
      ctx.fillRect(pipe.x, pipe.bottom, pipeWidth, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 4;
      ctx.strokeRect(pipe.x + 2, 0, pipeWidth - 4, pipe.top);
      ctx.strokeRect(pipe.x + 2, pipe.bottom, pipeWidth - 4, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      for (let y = 14; y < pipe.top - 12; y += 26) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 10, y);
        ctx.lineTo(pipe.x + pipeWidth - 10, y + 6);
        ctx.stroke();
      }
      for (let y = pipe.bottom + 12; y < h - 12; y += 26) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 10, y);
        ctx.lineTo(pipe.x + pipeWidth - 10, y - 6);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      const spikeOffset = Math.sin(pulse * 2.4 + pipe.seed * Math.PI * 2) * 6;
      ctx.beginPath();
      ctx.moveTo(pipe.x + 8, pipe.top + 6);
      ctx.lineTo(pipe.x + pipeWidth / 2 + spikeOffset, pipe.top + 32);
      ctx.lineTo(pipe.x + pipeWidth - 8, pipe.top + 6);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(pipe.x + 8, pipe.bottom - 6);
      ctx.lineTo(pipe.x + pipeWidth / 2 - spikeOffset, pipe.bottom - 32);
      ctx.lineTo(pipe.x + pipeWidth - 8, pipe.bottom - 6);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    },
    drawBird(ctx, pulse, radius) {
      ctx.save();
      const scale = radius / 24;
      ctx.scale(scale, scale);
      const wiggle = Math.sin(pulse * 9) * 8;

      ctx.fillStyle = 'rgba(180, 220, 255, 0.95)';
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.quadraticCurveTo(-34, wiggle - 4, -10, -10);
      ctx.quadraticCurveTo(-28, wiggle + 4, -16, 0);
      ctx.fill();

      ctx.fillStyle = 'rgba(90, 140, 220, 0.95)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(12, -4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(30, 40, 60, 0.9)';
      ctx.beginPath();
      ctx.arc(14, -4, 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 190, 120, 0.95)';
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(32, 2);
      ctx.lineTo(24, 4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.ellipse(-6, 10, 8, 10, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    audioProfile: {
      ambient: {
        voices: [
          {
            type: 'sine',
            frequency: 142,
            detune: -6,
            sweepFrequency: 0.02,
            sweepDepth: 120,
            vibratoFrequency: 0.5,
            vibratoDepth: 5,
            filter: { type: 'lowpass', frequency: 520, q: 11 },
            panDepth: 0.45,
          },
          {
            type: 'triangle',
            frequency: 188,
            detune: 4,
            sweepFrequency: 0.024,
            sweepDepth: 130,
            vibratoFrequency: 0.6,
            vibratoDepth: 6,
            filter: { type: 'bandpass', frequency: 620, q: 9 },
            panDepth: 0.4,
            panOffset: 0.35,
          },
          {
            type: 'sawtooth',
            frequency: 248,
            detune: 12,
            sweepFrequency: 0.03,
            sweepDepth: 150,
            vibratoFrequency: 0.7,
            vibratoDepth: 7,
            filter: { type: 'highpass', frequency: 380, q: 7 },
            panDepth: 0.6,
          },
        ],
        levels: { idle: 0.28, running: 0.82, gameover: 0.22 },
        transitionTime: 1,
      },
      flap: {
        type: 'triangle',
        startFreq: 320,
        peakFreq: 620,
        endFreq: 210,
        filterType: 'bandpass',
        filterFrequency: 600,
        filterQ: 7,
        attack: 0.02,
        maxGain: 0.4,
        decay: 0.42,
      },
      score: {
        highType: 'sine',
        highStart: 620,
        highMid: 840,
        highEnd: 1120,
        highMidTime: 0.16,
        highEndTime: 0.3,
        lowType: 'triangle',
        lowStart: 320,
        lowEnd: 420,
        shimmerGain: 0.2,
        delayTime: 0.2,
        feedbackGain: 0.22,
        release: 0.72,
      },
      gameover: {
        type: 'triangle',
        startFreq: 520,
        endFreq: 160,
        filterType: 'lowpass',
        filterStart: 1200,
        filterEnd: 260,
        attack: 0.04,
        maxGain: 0.5,
        release: 1.1,
        noiseAmount: 0.28,
      },
    },
  },
  {
    id: 'cosmic',
    label: 'Dérive Cosmique',
    emoji: '🌌',
    accentColor: '#b48fff',
    particleHue(pulse, index) {
      return (180 + Math.sin(pulse * 5 + index) * 60 + index * 18) % 360;
    },
    drawBackground(ctx, pulse, w, h) {
      ctx.save();
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#050118');
      gradient.addColorStop(0.5, '#12033b');
      gradient.addColorStop(1, '#031428');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      const nebulaCount = 3;
      for (let i = 0; i < nebulaCount; i += 1) {
        const cx = (w / nebulaCount) * (i + 0.5);
        const cy = h * 0.32 + Math.sin(pulse * 0.6 + i) * 40;
        const radius = w * 0.35;
        const nebula = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        nebula.addColorStop(0, `rgba(${120 + i * 20}, ${60 + i * 10}, 255, 0.35)`);
        nebula.addColorStop(1, 'rgba(10, 0, 40, 0)');
        ctx.fillStyle = nebula;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 45; i += 1) {
        const size = 1 + (i % 4) * 0.6;
        const starX = (i * 97 + Math.sin(pulse * 0.8 + i) * 180 + w) % w;
        const starY = (i * 61 + Math.cos(pulse * 1.1 + i) * 120 + h) % h;
        ctx.fillStyle = `hsla(${220 + (i % 6) * 14}, 80%, 70%, ${0.15 + (i % 3) * 0.05})`;
        ctx.beginPath();
        ctx.arc(starX, starY, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      const horizon = h * 0.78;
      ctx.fillStyle = 'rgba(20, 10, 45, 0.85)';
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      for (let x = 0; x <= w; x += 24) {
        const y = horizon + Math.sin(pulse * 1.2 + x * 0.03) * 14;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    drawPipe(ctx, pipe, h, pulse, pipeWidth) {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 6, 32, 0.92)';
      ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
      ctx.fillRect(pipe.x, pipe.bottom, pipeWidth, h - pipe.bottom);

      const glow = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipeWidth, 0);
      glow.addColorStop(0, 'rgba(0, 255, 210, 0.15)');
      glow.addColorStop(0.5, 'rgba(120, 80, 255, 0.55)');
      glow.addColorStop(1, 'rgba(0, 255, 210, 0.15)');
      ctx.strokeStyle = glow;
      ctx.lineWidth = 5;
      ctx.strokeRect(pipe.x + 2, 0, pipeWidth - 4, pipe.top);
      ctx.strokeRect(pipe.x + 2, pipe.bottom, pipeWidth - 4, h - pipe.bottom);

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0, 255, 200, 0.25)';
      for (let y = 16; y < pipe.top - 8; y += 28) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 6, y);
        ctx.lineTo(pipe.x + pipeWidth - 6, y);
        ctx.stroke();
      }
      for (let y = pipe.bottom + 12; y < h - 8; y += 28) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 6, y);
        ctx.lineTo(pipe.x + pipeWidth - 6, y);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(255, 0, 180, 0.35)';
      ctx.beginPath();
      const flicker = Math.sin(pulse * 10 + pipe.seed * Math.PI * 2) * 8;
      ctx.moveTo(pipe.x + pipeWidth / 2 + flicker, pipe.top - 18);
      ctx.lineTo(pipe.x + pipeWidth / 2 - flicker, pipe.top + 18);
      ctx.moveTo(pipe.x + pipeWidth / 2 - flicker, pipe.bottom - 18);
      ctx.lineTo(pipe.x + pipeWidth / 2 + flicker, pipe.bottom + 18);
      ctx.stroke();

      ctx.restore();
    },
    drawBird(ctx, pulse, radius) {
      ctx.save();
      const scale = radius / 24;
      ctx.scale(scale, scale);
      const tail = Math.sin(pulse * 6) * 12;
      const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 36);
      glow.addColorStop(0, 'rgba(255, 230, 250, 0.95)');
      glow.addColorStop(0.6, 'rgba(150, 90, 255, 0.8)');
      glow.addColorStop(1, 'rgba(60, 0, 120, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.moveTo(-32, -10);
      ctx.quadraticCurveTo(0, -26, 26, -4);
      ctx.quadraticCurveTo(32, 0, 26, 6);
      ctx.quadraticCurveTo(0, 26, -32, 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(8, -6, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(50, 10, 120, 0.9)';
      ctx.beginPath();
      ctx.arc(10, -6, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(180, 120, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-28, -8);
      ctx.quadraticCurveTo(-6, -tail - 12, 18, -4);
      ctx.moveTo(-28, 8);
      ctx.quadraticCurveTo(-6, tail + 12, 18, 4);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 200, 120, 0.85)';
      ctx.beginPath();
      ctx.moveTo(26, -2);
      ctx.lineTo(38, 0);
      ctx.lineTo(26, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    audioProfile: {
      ambient: {
        voices: [
          {
            type: 'sine',
            frequency: 102,
            detune: -12,
            sweepFrequency: 0.018,
            sweepDepth: 160,
            vibratoFrequency: 0.35,
            vibratoDepth: 9,
            filter: { type: 'lowpass', frequency: 480, q: 14 },
            panDepth: 0.55,
            panOffset: -0.5,
          },
          {
            type: 'triangle',
            frequency: 182,
            detune: 4,
            sweepFrequency: 0.022,
            sweepDepth: 150,
            vibratoFrequency: 0.48,
            vibratoDepth: 8,
            filter: { type: 'bandpass', frequency: 520, q: 10 },
            panDepth: 0.6,
            panOffset: 0.5,
          },
          {
            type: 'sawtooth',
            frequency: 260,
            detune: 14,
            sweepFrequency: 0.03,
            sweepDepth: 180,
            vibratoFrequency: 0.42,
            vibratoDepth: 10,
            filter: { type: 'bandpass', frequency: 680, q: 12 },
            panDepth: 0.7,
          },
        ],
        levels: { idle: 0.34, running: 0.92, gameover: 0.24 },
        transitionTime: 1.4,
      },
      flap: {
        type: 'sine',
        startFreq: 340,
        peakFreq: 760,
        endFreq: 180,
        filterType: 'bandpass',
        filterFrequency: 680,
        filterQ: 7,
        attack: 0.02,
        maxGain: 0.4,
        decay: 0.5,
      },
      score: {
        highType: 'triangle',
        highStart: 780,
        highMid: 1120,
        highEnd: 1480,
        highMidTime: 0.12,
        highEndTime: 0.26,
        lowType: 'sine',
        lowStart: 320,
        lowEnd: 480,
        shimmerGain: 0.24,
        delayTime: 0.22,
        feedbackGain: 0.28,
        release: 0.68,
      },
      gameover: {
        type: 'sawtooth',
        startFreq: 620,
        endFreq: 160,
        filterType: 'lowpass',
        filterStart: 1600,
        filterEnd: 280,
        attack: 0.05,
        maxGain: 0.52,
        release: 1.2,
        noiseAmount: 0.22,
      },
    },
  },
  {
    id: 'pirate',
    label: 'Marées Pirates',
    emoji: '🏴‍☠️',
    accentColor: '#37c5ff',
    particleHue(pulse, index) {
      return (205 + Math.sin(pulse * 3 + index) * 35 + index * 18) % 360;
    },
    drawBackground(ctx, pulse, w, h) {
      ctx.save();
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#061b3a');
      sky.addColorStop(0.45, '#0c2d55');
      sky.addColorStop(1, '#050b16');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      const horizon = h * 0.62;
      const sea = ctx.createLinearGradient(0, horizon - 30, 0, h);
      sea.addColorStop(0, 'rgba(8, 41, 70, 0.9)');
      sea.addColorStop(0.5, 'rgba(3, 26, 46, 0.95)');
      sea.addColorStop(1, 'rgba(1, 10, 22, 1)');
      ctx.fillStyle = sea;
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      const waveAmplitude = 18;
      for (let x = 0; x <= w; x += 16) {
        const y = horizon + Math.sin(pulse * 1.6 + x * 0.015) * waveAmplitude + Math.sin(pulse * 0.7 + x * 0.03) * 6;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      const moonX = w * 0.76 + Math.sin(pulse * 0.4) * 40;
      const moonY = h * 0.2 + Math.sin(pulse * 0.6) * 8;
      const moonGradient = ctx.createRadialGradient(moonX, moonY, 8, moonX, moonY, 90);
      moonGradient.addColorStop(0, 'rgba(255, 255, 220, 0.95)');
      moonGradient.addColorStop(1, 'rgba(255, 255, 220, 0)');
      ctx.fillStyle = moonGradient;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 90, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(12, 14, 24, 0.75)';
      const shipX = w * 0.32 + Math.sin(pulse * 0.5) * 90;
      const shipY = horizon - 18 + Math.sin(pulse * 1.2) * 4;
      ctx.beginPath();
      ctx.moveTo(shipX - 80, shipY + 20);
      ctx.quadraticCurveTo(shipX, shipY + 50, shipX + 90, shipY + 18);
      ctx.lineTo(shipX + 60, shipY + 6);
      ctx.lineTo(shipX - 50, shipY + 6);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(215, 225, 255, 0.2)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 6; i += 1) {
        const sparkleX = (i * 210 + pulse * 120) % (w + 60) - 30;
        const sparkleY = horizon + Math.sin(pulse * 2 + i) * 30 + 10;
        ctx.beginPath();
        ctx.moveTo(sparkleX - 6, sparkleY);
        ctx.lineTo(sparkleX + 6, sparkleY);
        ctx.moveTo(sparkleX, sparkleY - 6);
        ctx.lineTo(sparkleX, sparkleY + 6);
        ctx.stroke();
      }

      ctx.restore();
    },
    drawPipe(ctx, pipe, h, pulse, pipeWidth) {
      ctx.save();
      const wood = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipeWidth, 0);
      wood.addColorStop(0, 'rgba(44, 28, 18, 0.95)');
      wood.addColorStop(1, 'rgba(32, 20, 12, 0.95)');
      ctx.fillStyle = wood;
      ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
      ctx.fillRect(pipe.x, pipe.bottom, pipeWidth, h - pipe.bottom);

      ctx.fillStyle = 'rgba(55, 36, 20, 0.85)';
      ctx.fillRect(pipe.x + 6, 0, pipeWidth - 12, pipe.top);
      ctx.fillRect(pipe.x + 6, pipe.bottom, pipeWidth - 12, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(255, 215, 160, 0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(pipe.x + 4, 0, pipeWidth - 8, pipe.top);
      ctx.strokeRect(pipe.x + 4, pipe.bottom, pipeWidth - 8, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 2;
      for (let y = 18; y < pipe.top - 12; y += 24) {
        ctx.beginPath();
        const wobble = Math.sin(pulse * 1.5 + y * 0.05 + pipe.seed * Math.PI * 2) * 4;
        ctx.moveTo(pipe.x + 10 + wobble, y);
        ctx.lineTo(pipe.x + pipeWidth - 10 - wobble, y + 4);
        ctx.stroke();
      }
      for (let y = pipe.bottom + 12; y < h - 12; y += 24) {
        ctx.beginPath();
        const wobble = Math.cos(pulse * 1.5 + y * 0.05 + pipe.seed * Math.PI * 2) * 4;
        ctx.moveTo(pipe.x + 10 + wobble, y);
        ctx.lineTo(pipe.x + pipeWidth - 10 - wobble, y - 4);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255, 214, 120, 0.3)';
      ctx.beginPath();
      ctx.ellipse(pipe.x + pipeWidth / 2, pipe.top + 10, pipeWidth * 0.65, 26, 0, 0, Math.PI);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(pipe.x + pipeWidth / 2, pipe.bottom - 10, pipeWidth * 0.65, 26, 0, Math.PI, 0, true);
      ctx.fill();

      ctx.restore();
    },
    drawBird(ctx, pulse, radius) {
      ctx.save();
      const scale = radius / 24;
      ctx.scale(scale, scale);
      const sail = Math.sin(pulse * 6) * 10;

      ctx.fillStyle = 'rgba(255, 218, 140, 0.92)';
      ctx.beginPath();
      ctx.moveTo(-20, -4);
      ctx.quadraticCurveTo(-46, sail - 6, -6, 12);
      ctx.quadraticCurveTo(-30, sail + 6, -20, -4);
      ctx.fill();

      const body = ctx.createLinearGradient(-12, -18, 22, 18);
      body.addColorStop(0, 'rgba(60, 110, 180, 0.95)');
      body.addColorStop(1, 'rgba(20, 60, 110, 0.95)');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(12, -4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(20, 30, 50, 0.9)';
      ctx.beginPath();
      ctx.arc(14, -4, 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 180, 120, 0.95)';
      ctx.beginPath();
      ctx.moveTo(24, -2);
      ctx.lineTo(34, 0);
      ctx.lineTo(24, 2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 230, 180, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-16, 10);
      ctx.quadraticCurveTo(-4, 20, 12, 12);
      ctx.stroke();
      ctx.restore();
    },
    audioProfile: {
      ambient: {
        voices: [
          {
            type: 'sine',
            frequency: 126,
            detune: -4,
            sweepFrequency: 0.028,
            sweepDepth: 120,
            vibratoFrequency: 0.5,
            vibratoDepth: 4.5,
            filter: { type: 'bandpass', frequency: 420, q: 9 },
            panDepth: 0.45,
            panOffset: -0.4,
          },
          {
            type: 'triangle',
            frequency: 182,
            detune: 6,
            sweepFrequency: 0.024,
            sweepDepth: 140,
            vibratoFrequency: 0.64,
            vibratoDepth: 5.5,
            filter: { type: 'lowpass', frequency: 520, q: 8 },
            panDepth: 0.5,
            panOffset: 0.4,
          },
          {
            type: 'sawtooth',
            frequency: 248,
            detune: 12,
            sweepFrequency: 0.03,
            sweepDepth: 160,
            vibratoFrequency: 0.58,
            vibratoDepth: 6,
            filter: { type: 'highpass', frequency: 360, q: 7 },
            panDepth: 0.55,
          },
        ],
        levels: { idle: 0.32, running: 0.84, gameover: 0.24 },
        transitionTime: 1,
      },
      flap: {
        type: 'sine',
        startFreq: 300,
        peakFreq: 560,
        endFreq: 200,
        filterType: 'bandpass',
        filterFrequency: 520,
        filterQ: 6,
        attack: 0.02,
        maxGain: 0.42,
        decay: 0.4,
      },
      score: {
        highType: 'triangle',
        highStart: 640,
        highMid: 920,
        highEnd: 1220,
        highMidTime: 0.12,
        highEndTime: 0.24,
        lowType: 'sine',
        lowStart: 320,
        lowEnd: 460,
        shimmerGain: 0.2,
        delayTime: 0.18,
        feedbackGain: 0.24,
        release: 0.6,
      },
      gameover: {
        type: 'triangle',
        startFreq: 420,
        endFreq: 150,
        filterType: 'lowpass',
        filterStart: 1000,
        filterEnd: 240,
        attack: 0.05,
        maxGain: 0.48,
        release: 1,
        noiseAmount: 0.26,
      },
    },
  },
  {
    id: 'nocturne',
    label: 'Nocturne Souterrain',
    emoji: '🌙',
    accentColor: '#8c76ff',
    particleHue(pulse, index) {
      return (260 + Math.sin(pulse * 2 + index) * 18 + index * 8) % 360;
    },
    drawBackground(ctx, pulse, w, h) {
      ctx.save();
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#010103');
      gradient.addColorStop(0.5, '#060712');
      gradient.addColorStop(1, '#020104');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 40; i += 1) {
        const x = (i * 97 + Math.sin(pulse * 0.8 + i) * 180 + w) % w;
        const y = (i * 61 + Math.cos(pulse * 1.1 + i) * 120 + h) % h;
        const size = 1 + (i % 4) * 0.4;
        ctx.fillStyle = `hsla(${260 + (i % 5) * 24}, 70%, 60%, ${0.15 + (i % 3) * 0.05})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.strokeStyle = 'rgba(80, 40, 130, 0.15)';
      ctx.lineWidth = 1;
      const spacing = 90;
      const offset = (pulse * 40) % spacing;
      for (let x = -spacing; x < w + spacing; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x + offset, h * 0.4);
        ctx.lineTo(x + offset, h);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(10, 10, 18, 0.75)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.82);
      for (let x = 0; x <= w; x += 18) {
        const y = h * 0.82 + Math.sin(pulse * 1.6 + x * 0.05) * 8;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    drawPipe(ctx, pipe, h, pulse, pipeWidth) {
      ctx.save();
      const pillar = ctx.createLinearGradient(pipe.x, 0, pipe.x, h);
      pillar.addColorStop(0, 'rgba(18, 18, 26, 0.95)');
      pillar.addColorStop(0.5, 'rgba(10, 10, 16, 0.95)');
      pillar.addColorStop(1, 'rgba(6, 6, 10, 0.95)');
      ctx.fillStyle = pillar;
      ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
      ctx.fillRect(pipe.x, pipe.bottom, pipeWidth, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(120, 80, 200, 0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(pipe.x + 3, 0, pipeWidth - 6, pipe.top);
      ctx.strokeRect(pipe.x + 3, pipe.bottom, pipeWidth - 6, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(180, 120, 255, 0.25)';
      ctx.lineWidth = 2;
      for (let y = 16; y < pipe.top - 12; y += 30) {
        ctx.beginPath();
        const wobble = Math.sin(pulse * 2 + y * 0.1 + pipe.seed * Math.PI * 2) * 6;
        ctx.moveTo(pipe.x + 10 + wobble, y);
        ctx.lineTo(pipe.x + pipeWidth - 10 - wobble, y + 4);
        ctx.stroke();
      }
      for (let y = pipe.bottom + 12; y < h - 12; y += 30) {
        ctx.beginPath();
        const wobble = Math.cos(pulse * 2 + y * 0.1 + pipe.seed * Math.PI * 2) * 6;
        ctx.moveTo(pipe.x + 10 + wobble, y);
        ctx.lineTo(pipe.x + pipeWidth - 10 - wobble, y - 4);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(160, 120, 255, 0.2)';
      ctx.beginPath();
      ctx.ellipse(pipe.x + pipeWidth / 2, pipe.top + 12, pipeWidth * 0.65, 26, 0, 0, Math.PI);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(pipe.x + pipeWidth / 2, pipe.bottom - 12, pipeWidth * 0.65, 26, 0, Math.PI, 0, true);
      ctx.fill();

      ctx.restore();
    },
    drawBird(ctx, pulse, radius) {
      ctx.save();
      const scale = radius / 24;
      ctx.scale(scale, scale);
      const wave = Math.sin(pulse * 7) * 12;

      ctx.fillStyle = 'rgba(70, 40, 130, 0.85)';
      ctx.beginPath();
      ctx.moveTo(-22, -6);
      ctx.quadraticCurveTo(-48, wave - 6, -6, 10);
      ctx.quadraticCurveTo(-34, wave + 6, -22, -6);
      ctx.fill();

      const body = ctx.createLinearGradient(-14, -18, 22, 18);
      body.addColorStop(0, 'rgba(110, 70, 200, 0.95)');
      body.addColorStop(1, 'rgba(60, 30, 120, 0.95)');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(10, -4, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(40, 20, 80, 0.9)';
      ctx.beginPath();
      ctx.arc(12, -4, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(190, 120, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(24, -2);
      ctx.lineTo(34, 0);
      ctx.lineTo(24, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    audioProfile: {
      ambient: {
        voices: [
          {
            type: 'triangle',
            frequency: 120,
            detune: -6,
            sweepFrequency: 0.022,
            sweepDepth: 110,
            vibratoFrequency: 0.46,
            vibratoDepth: 5,
            filter: { type: 'bandpass', frequency: 420, q: 9 },
            panDepth: 0.45,
          },
          {
            type: 'sine',
            frequency: 168,
            detune: 4,
            sweepFrequency: 0.02,
            sweepDepth: 120,
            vibratoFrequency: 0.5,
            vibratoDepth: 5.5,
            filter: { type: 'bandpass', frequency: 520, q: 8 },
            panDepth: 0.5,
            panOffset: -0.4,
          },
          {
            type: 'sawtooth',
            frequency: 228,
            detune: 10,
            sweepFrequency: 0.024,
            sweepDepth: 140,
            vibratoFrequency: 0.6,
            vibratoDepth: 6,
            filter: { type: 'bandpass', frequency: 680, q: 10 },
            panDepth: 0.55,
            panOffset: 0.4,
          },
        ],
        levels: { idle: 0.3, running: 0.8, gameover: 0.22 },
        transitionTime: 1.1,
      },
      flap: {
        type: 'triangle',
        startFreq: 320,
        peakFreq: 620,
        endFreq: 190,
        filterType: 'bandpass',
        filterFrequency: 560,
        filterQ: 7,
        attack: 0.02,
        maxGain: 0.42,
        decay: 0.46,
      },
      score: {
        highType: 'sine',
        highStart: 540,
        highMid: 760,
        highEnd: 980,
        highMidTime: 0.1,
        highEndTime: 0.22,
        lowType: 'triangle',
        lowStart: 280,
        lowEnd: 360,
        shimmerGain: 0.18,
        delayTime: 0.24,
        feedbackGain: 0.28,
        release: 0.7,
      },
      gameover: {
        type: 'sine',
        startFreq: 480,
        endFreq: 140,
        filterType: 'lowpass',
        filterStart: 1200,
        filterEnd: 220,
        attack: 0.04,
        maxGain: 0.46,
        release: 1.2,
        noiseAmount: 0.2,
      },
    },
  },
  {
    id: 'sakura',
    label: 'Sakura Mirage',
    emoji: '🌸',
    accentColor: '#ff9ad5',
    particleHue(pulse, index) {
      return (320 + Math.sin(pulse * 2.4 + index) * 22 + index * 10) % 360;
    },
    drawBackground(ctx, pulse, w, h) {
      ctx.save();
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#2d0f4d');
      gradient.addColorStop(0.4, '#642a6d');
      gradient.addColorStop(1, '#f4bcd6');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      const ribbon = ctx.createLinearGradient(0, h * 0.35, w, h * 0.55);
      ribbon.addColorStop(0, 'rgba(255, 170, 220, 0)');
      ribbon.addColorStop(0.5, 'rgba(255, 190, 230, 0.35)');
      ribbon.addColorStop(1, 'rgba(255, 170, 220, 0)');
      ctx.fillStyle = ribbon;
      ctx.save();
      ctx.translate(0, Math.sin(pulse * 0.6) * 20);
      ctx.fillRect(0, h * 0.28, w, h * 0.24);
      ctx.restore();

      ctx.fillStyle = 'rgba(255, 210, 235, 0.65)';
      for (let i = 0; i < 50; i += 1) {
        const petalX = (i * 83 + pulse * 120) % (w + 60) - 30;
        const petalY = (i * 57 + pulse * 150) % (h + 60) - 30;
        const sway = Math.sin(pulse * 1.5 + i) * 12;
        ctx.beginPath();
        ctx.ellipse(petalX, petalY, 6, 14, pulse + i + sway * 0.02, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },
    drawPipe(ctx, pipe, h, pulse, pipeWidth) {
      ctx.save();
      const trunk = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipeWidth, 0);
      trunk.addColorStop(0, 'rgba(120, 60, 90, 0.95)');
      trunk.addColorStop(1, 'rgba(90, 40, 70, 0.95)');
      ctx.fillStyle = trunk;
      ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
      ctx.fillRect(pipe.x, pipe.bottom, pipeWidth, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(255, 190, 220, 0.4)';
      ctx.lineWidth = 3;
      ctx.strokeRect(pipe.x + 3, 0, pipeWidth - 6, pipe.top);
      ctx.strokeRect(pipe.x + 3, pipe.bottom, pipeWidth - 6, h - pipe.bottom);

      ctx.fillStyle = 'rgba(255, 200, 230, 0.25)';
      const drift = Math.sin(pulse * 2 + pipe.seed * Math.PI * 2) * 10;
      ctx.beginPath();
      ctx.moveTo(pipe.x + 8, pipe.top + 12);
      ctx.quadraticCurveTo(
        pipe.x + pipeWidth / 2 + drift,
        pipe.top + 40,
        pipe.x + pipeWidth - 8,
        pipe.top + 16,
      );
      ctx.lineTo(pipe.x + pipeWidth - 12, pipe.top + 36);
      ctx.quadraticCurveTo(
        pipe.x + pipeWidth / 2,
        pipe.top + 56,
        pipe.x + 12,
        pipe.top + 24,
      );
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(pipe.x + 8, pipe.bottom - 12);
      ctx.quadraticCurveTo(
        pipe.x + pipeWidth / 2 - drift,
        pipe.bottom - 40,
        pipe.x + pipeWidth - 8,
        pipe.bottom - 16,
      );
      ctx.lineTo(pipe.x + pipeWidth - 12, pipe.bottom - 36);
      ctx.quadraticCurveTo(
        pipe.x + pipeWidth / 2,
        pipe.bottom - 56,
        pipe.x + 12,
        pipe.bottom - 24,
      );
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    },
    drawBird(ctx, pulse, radius) {
      ctx.save();
      const scale = radius / 24;
      ctx.scale(scale, scale);
      const flutter = Math.sin(pulse * 10) * 14;

      ctx.fillStyle = 'rgba(255, 220, 235, 0.95)';
      ctx.beginPath();
      ctx.moveTo(-20, -6);
      ctx.quadraticCurveTo(-42, flutter - 4, -6, 10);
      ctx.quadraticCurveTo(-34, flutter + 4, -20, -6);
      ctx.fill();

      const body = ctx.createLinearGradient(-10, -18, 22, 18);
      body.addColorStop(0, 'rgba(255, 190, 225, 0.95)');
      body.addColorStop(1, 'rgba(220, 130, 200, 0.95)');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(12, -4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(90, 40, 100, 0.9)';
      ctx.beginPath();
      ctx.arc(14, -4, 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 210, 160, 0.9)';
      ctx.beginPath();
      ctx.moveTo(24, -2);
      ctx.lineTo(34, 0);
      ctx.lineTo(24, 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 200, 230, 0.6)';
      ctx.beginPath();
      ctx.ellipse(-4, 12, 10, 12, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    audioProfile: {
      ambient: {
        voices: [
          {
            type: 'sine',
            frequency: 138,
            detune: -6,
            sweepFrequency: 0.026,
            sweepDepth: 110,
            vibratoFrequency: 0.52,
            vibratoDepth: 5,
            filter: { type: 'bandpass', frequency: 440, q: 9 },
            panDepth: 0.4,
            panOffset: -0.4,
          },
          {
            type: 'triangle',
            frequency: 186,
            detune: 4,
            sweepFrequency: 0.022,
            sweepDepth: 120,
            vibratoFrequency: 0.64,
            vibratoDepth: 5.2,
            filter: { type: 'bandpass', frequency: 560, q: 8 },
            panDepth: 0.48,
            panOffset: 0.4,
          },
          {
            type: 'sine',
            frequency: 248,
            detune: 10,
            sweepFrequency: 0.03,
            sweepDepth: 150,
            vibratoFrequency: 0.58,
            vibratoDepth: 6,
            filter: { type: 'lowpass', frequency: 620, q: 8 },
            panDepth: 0.5,
          },
        ],
        levels: { idle: 0.32, running: 0.86, gameover: 0.24 },
        transitionTime: 1.05,
      },
      flap: {
        type: 'sine',
        startFreq: 300,
        peakFreq: 640,
        endFreq: 220,
        filterType: 'bandpass',
        filterFrequency: 600,
        filterQ: 7,
        attack: 0.018,
        maxGain: 0.44,
        decay: 0.38,
      },
      score: {
        highType: 'triangle',
        highStart: 620,
        highMid: 820,
        highEnd: 1040,
        highMidTime: 0.12,
        highEndTime: 0.26,
        lowType: 'sine',
        lowStart: 340,
        lowEnd: 420,
        shimmerGain: 0.22,
        delayTime: 0.18,
        feedbackGain: 0.24,
        release: 0.64,
      },
      gameover: {
        type: 'triangle',
        startFreq: 480,
        endFreq: 150,
        filterType: 'lowpass',
        filterStart: 1200,
        filterEnd: 240,
        attack: 0.03,
        maxGain: 0.5,
        release: 1,
        noiseAmount: 0.24,
      },
    },
  },
];

const THEME_SEQUENCE = THEMES.map((theme) => theme.id);

class Bird {
  x = 0;

  y = 0;

  velocity = 0;

  rotation = 0;

  radius = 24;

  constructor(private readonly metrics: { width: number; height: number; scale: number }) {
    this.reset();
  }

  reset() {
    this.x = this.metrics.width * 0.3;
    this.y = this.metrics.height * 0.46;
    this.velocity = 0;
    this.rotation = 0;
    this.radius = Math.max(18, this.metrics.height * 0.035);
  }

  start() {
    this.x = this.metrics.width * 0.3;
    this.y = this.metrics.height * 0.46;
    this.velocity = 0;
  }

  flap(force: number) {
    this.velocity = force;
  }

  update(dt: number, config: { gravity: number; maxVelocity: number }) {
    const gravity = config.gravity;
    const maxVelocity = config.maxVelocity;
    this.velocity = Math.min(maxVelocity, this.velocity + gravity * dt);
    this.y += this.velocity * dt;
    const tiltTarget = Math.max(-1.2, Math.min(1.3, this.velocity / (maxVelocity * 0.75)));
    this.rotation += (tiltTarget - this.rotation) * Math.min(1, dt * 8);
  }

  idleBob(time: number) {
    const amplitude = this.metrics.height * 0.015;
    this.y = this.metrics.height * 0.48 + Math.sin(time * 2.15) * amplitude;
    this.rotation = Math.sin(time * 1.3) * 0.22;
  }

  draw(ctx: CanvasRenderingContext2D, pulse: number, theme: Theme) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    theme.drawBird(ctx, pulse, this.radius);
    ctx.restore();
  }

  get top() {
    return this.y - this.radius * 0.9;
  }

  get bottom() {
    return this.y + this.radius * 0.9;
  }
}

class PipeManager {
  items: Pipe[] = [];

  spawnTimer = 0;

  width = 120;

  constructor(private readonly metrics: { width: number; height: number; scale: number }) {}

  reset(baseWidth: number) {
    this.items = [];
    this.spawnTimer = 0;
    this.width = baseWidth;
  }

  update(dt: number, speed: number, interval: number) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= interval) {
      this.spawnTimer = 0;
      this.spawn();
    }

    for (const pipe of this.items) {
      pipe.x -= speed * dt;
    }

    this.items = this.items.filter((pipe) => pipe.x + this.width > -10);
  }

  spawn() {
    const gapSize = this.metrics.height * (0.34 + Math.random() * 0.1);
    const safeZoneTop = this.metrics.height * 0.18;
    const safeZoneBottom = this.metrics.height * 0.82;
    const center = safeZoneTop + Math.random() * (safeZoneBottom - safeZoneTop);
    const topHeight = Math.max(center - gapSize * 0.5, this.metrics.height * 0.1);
    const bottom = Math.min(center + gapSize * 0.5, this.metrics.height - this.metrics.height * 0.1);

    this.items.push({
      x: this.metrics.width + this.width,
      top: topHeight,
      bottom,
      passed: false,
      seed: Math.random(),
    });
  }

  checkCollisions(bird: Bird) {
    for (const pipe of this.items) {
      if (circleRectCollision(bird.x, bird.y, bird.radius * 0.82, pipe.x, 0, this.width, pipe.top)) {
        return true;
      }
      const bottomRectHeight = this.metrics.height - pipe.bottom;
      if (
        circleRectCollision(
          bird.x,
          bird.y,
          bird.radius * 0.82,
          pipe.x,
          pipe.bottom,
          this.width,
          bottomRectHeight,
        )
      ) {
        return true;
      }
    }
    return false;
  }

  claimScores(birdX: number) {
    let earned = 0;
    for (const pipe of this.items) {
      if (!pipe.passed && pipe.x + this.width < birdX) {
        pipe.passed = true;
        earned += 1;
      }
    }
    return earned;
  }

  draw(ctx: CanvasRenderingContext2D, time: number, theme: Theme) {
    for (const pipe of this.items) {
      theme.drawPipe(ctx, pipe, this.metrics.height, time, this.width);
    }
  }
}

class ParticleSystem {
  items: Particle[] = [];

  constructor(private readonly getTheme: () => Theme) {}

  clear() {
    this.items = [];
  }

  emitFlap(x: number, y: number, scale: number) {
    const count = 7;
    const theme = this.getTheme();
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI + Math.PI;
      const speed = scale * lerp(90, 230, Math.random());
      this.items.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.38,
        age: 0,
        size: lerp(5, 9, Math.random()) * scale,
        hue: theme.particleHue(Date.now() / 1000, i),
      });
    }
  }

  emitScore(x: number, y: number, scale: number, pulse: number) {
    const count = 16;
    const theme = this.getTheme();
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = scale * lerp(130, 260, Math.random());
      this.items.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.7,
        age: 0,
        size: lerp(6, 12, Math.random()) * scale,
        hue: theme.particleHue(pulse, i),
      });
    }
  }

  update(dt: number, metrics: { height: number }) {
    this.items = this.items.filter((p) => {
      const damping = 0.92;
      p.age += dt;
      if (p.age >= p.life) {
        return false;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= damping;
      p.vy *= damping;
      return p.y < metrics.height + 100;
    });
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.items) {
      const alpha = 1 - p.age / p.life;
      ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size, p.size * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function easeInOutCubic(t: number) {
  if (t <= 0) {
    return 0;
  }
  if (t >= 1) {
    return 1;
  }
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function hexToRgba(hex: string, alpha: number) {
  const sanitized = hex.replace('#', '').trim();
  const value = sanitized.length === 3
    ? sanitized
        .split('')
        .map((char) => char + char)
        .join('')
    : sanitized.padEnd(6, '0');
  const int = Number.parseInt(value, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function extractRgbFromHex(hex: string): string {
  const sanitized = hex.replace('#', '').trim();
  const value = sanitized.length === 3
    ? sanitized
        .split('')
        .map((char) => char + char)
        .join('')
    : sanitized.padEnd(6, '0');
  const int = Number.parseInt(value, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `${r}, ${g}, ${b}`;
}

function drawAura(
  ctx: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number,
  color: string,
  intensity: number,
) {
  if (intensity <= 0) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const base = ctx.createRadialGradient(width / 2, height * 0.45, 0, width / 2, height * 0.45, Math.max(width, height) * 0.65);
  base.addColorStop(0, hexToRgba(color, 0.12 * intensity));
  base.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const bandCount = 3;
  for (let i = 0; i < bandCount; i += 1) {
    const bandHeight = height * (0.18 + i * 0.08);
    const offsetY = height * 0.25 + i * 70 + Math.sin(time * (0.9 + i * 0.15) + i) * 32;
    ctx.save();
    ctx.translate(width / 2, offsetY);
    ctx.rotate(Math.sin(time * 0.3 + i) * 0.18);
    const gradient = ctx.createLinearGradient(-width, 0, width, 0);
    gradient.addColorStop(0, hexToRgba(color, 0));
    gradient.addColorStop(0.5, hexToRgba(color, 0.16 * intensity));
    gradient.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(-width, -bandHeight / 2, width * 2, bandHeight);
    ctx.restore();
  }
  ctx.restore();
}

function drawTransitionOverlay(
  ctx: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number,
  fromColor: string,
  toColor: string,
  progress: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rings = 4;
  ctx.globalAlpha = 0.4 * (1 - progress);
  for (let i = 0; i < rings; i += 1) {
    const radius = (width * (0.25 + i * 0.12)) * (1 + 0.12 * Math.sin(time * 1.4 + i));
    ctx.strokeStyle = hexToRgba(fromColor, 0.2 * (1 - progress));
    ctx.lineWidth = 2 + i;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.45 * progress;
  for (let i = 0; i < rings; i += 1) {
    const radius = (width * (0.18 + i * 0.1));
    ctx.strokeStyle = hexToRgba(toColor, 0.3 * progress);
    ctx.lineWidth = 1.5 + i;
    const arcOffset = Math.sin(time * 1.6 + i) * Math.PI * 0.6;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, arcOffset, arcOffset + Math.PI * 1.2);
    ctx.stroke();
  }
  ctx.restore();
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function circleRectCollision(
  cx: number,
  cy: number,
  radius: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
) {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
}

function formatTime(value: number) {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(value));
  } catch (error) {
    console.warn('Time format error', error);
    return new Date(value).toLocaleTimeString();
  }
}

export default function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const overlayTitleRef = useRef<HTMLHeadingElement | null>(null);
  const overlayMessageRef = useRef<HTMLParagraphElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const toastRef = useRef<HTMLDivElement | null>(null);
  const shareButtonRef = useRef<HTMLButtonElement | null>(null);
  const historyBodyRef = useRef<HTMLTableSectionElement | null>(null);
  const themeLabelRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const nameFieldRef = useRef<HTMLDivElement | null>(null);
  const playerNameRef = useRef<HTMLDivElement | null>(null);
  const muteButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const overlayTitle = overlayTitleRef.current;
    const overlayMessage = overlayMessageRef.current;
    const playButton = playButtonRef.current;
    const toast = toastRef.current;
    const shareButton = shareButtonRef.current;
    const historyBody = historyBodyRef.current;
    const themeLabel = themeLabelRef.current;
    const nameInput = nameInputRef.current;
    const nameField = nameFieldRef.current;
    const playerNameBadge = playerNameRef.current;
    const muteButton = muteButtonRef.current;

    if (
      !canvas ||
      !overlay ||
      !overlayTitle ||
      !overlayMessage ||
      !playButton ||
      !toast ||
      !shareButton ||
      !historyBody ||
      !themeLabel ||
      !nameInput ||
      !nameField ||
      !playerNameBadge ||
      !muteButton
    ) {
      return undefined;
    }

    const canvasEl = canvas;
    const context = canvasEl.getContext('2d');
    const overlayEl = overlay;
    const overlayTitleEl = overlayTitle;
    const overlayMessageEl = overlayMessage;
    const playButtonEl = playButton;
    const toastEl = toast;
    const shareButtonEl = shareButton;
    const historyBodyEl = historyBody;
    const themeLabelEl = themeLabel;
    const nameInputEl = nameInput;
    const nameFieldEl = nameField;
    const playerNameEl = playerNameBadge;
    const muteButtonEl = muteButton;
    if (!context) {
      return undefined;
    }
    const ctx: CanvasRenderingContext2D = context;

    const metrics = { width: 1280, height: 720, scale: 1 };
    const bird = new Bird(metrics);
    const pipes = new PipeManager(metrics);
    const getTheme = () => THEMES[state.themeIndex];
    const particles = new ParticleSystem(getTheme);
    const audio = new AudioController(getTheme, () => state.mode);

    const state: {
      mode: Mode;
      score: number;
      best: number;
      speed: number;
      elapsed: number;
      lastTimestamp: number;
      needsTimeReset: boolean;
      themeIndex: number;
      previousThemeIndex: number;
      transitionProgress: number;
      transitionDuration: number;
      lastThemeSwitchScore: number;
      playerName: string;
      muted: boolean;
    } = {
      mode: 'idle',
      score: 0,
      best: 0,
      speed: 0,
      elapsed: 0,
      lastTimestamp: 0,
      needsTimeReset: true,
      themeIndex: 0,
      previousThemeIndex: 0,
      transitionProgress: 1,
      transitionDuration: 1,
      lastThemeSwitchScore: 0,
      playerName: 'Flappy Boys',
      muted: false,
    };

    let historyEntries: HistoryEntry[] = [];
    let animationFrame = 0;
    let toastTimer: ReturnType<typeof setTimeout> | null = null;

    const config = {
      baseSpeed: 230,
      speedRamp: 8,
      gravity: 2000,
      flapImpulse: -720,
      maxVelocity: 900,
      spawnInterval: 1.98,
      floorPadding: 36,
    };

    const onThemeAnimationEnd = () => {
      themeLabelEl.classList.remove('theme-chip--pulse');
    };

    init();

    function init() {
      loadBest();
      loadName();
      updateMuteButton();
      configureNameField(true);
      void loadHistory();
      resizeCanvas();
      updateScoreUI();
      updateThemeLabel();
      themeLabelEl.addEventListener('animationend', onThemeAnimationEnd);
      window.addEventListener('resize', resizeCanvas, { passive: true });
      window.addEventListener('keydown', onKeyDown);
      canvasEl.addEventListener('pointerdown', onPointer, { passive: false });
      playButtonEl.addEventListener('click', onPrimaryAction);
      overlayEl.addEventListener('click', onOverlayClick);
      shareButtonEl.addEventListener('click', shareScore);
      muteButtonEl.addEventListener('click', toggleMute);
      nameInputEl.addEventListener('keydown', onNameKeyDown);
      animationFrame = requestAnimationFrame(tick);
    }

    function getCurrentTheme() {
      return THEMES[state.themeIndex];
    }

    function updateThemeLabel() {
      const theme = getCurrentTheme();
      themeLabelEl.textContent = `${theme.emoji} ${theme.label}`;
      document.documentElement.style.setProperty('--accent-current', theme.accentColor);
      document.documentElement.style.setProperty('--accent-current-rgb', extractRgbFromHex(theme.accentColor));
      themeLabelEl.classList.remove('theme-chip--pulse');
      void themeLabelEl.offsetWidth;
      themeLabelEl.classList.add('theme-chip--pulse');
    }

    function resizeCanvas() {
      const parent = canvasEl.parentElement;
      if (!parent) {
        return;
      }
      const rect = parent.getBoundingClientRect();
      const aspect = 16 / 9;
      const width = rect.width;
      const height = width / aspect;
      metrics.width = Math.floor(width);
      metrics.height = Math.floor(height);
      metrics.scale = metrics.height / 720;
      const DPR = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
      canvasEl.width = Math.floor(metrics.width * DPR);
      canvasEl.height = Math.floor(metrics.height * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      bird.reset();
      const pipeWidth = Math.max(110 * metrics.scale, metrics.width * 0.11);
      pipes.reset(pipeWidth);
    }

    function tick(timestamp: number) {
      if (!state.lastTimestamp || state.needsTimeReset) {
        state.lastTimestamp = timestamp;
        state.needsTimeReset = false;
      }
      const delta = Math.min((timestamp - state.lastTimestamp) / 1000, 0.032);
      state.lastTimestamp = timestamp;
      state.elapsed += delta;

      update(delta);
      draw(timestamp / 1000);

      animationFrame = requestAnimationFrame(tick);
    }

    function update(dt: number) {
      if (state.transitionProgress < 1) {
        const duration = state.transitionDuration <= 0 ? 0.001 : state.transitionDuration;
        state.transitionProgress = Math.min(1, state.transitionProgress + dt / duration);
      }

      if (state.mode === 'paused') {
        return;
      }

      if (state.mode === 'idle') {
        bird.idleBob(state.elapsed);
        particles.update(dt, metrics);
        return;
      }

      if (state.mode === 'over') {
        bird.update(dt * 0.9, { gravity: config.gravity, maxVelocity: config.maxVelocity });
        particles.update(dt, metrics);
        return;
      }

      if (state.mode !== 'running') {
        return;
      }

      state.speed = (config.baseSpeed + state.score * config.speedRamp) * metrics.scale;
      bird.update(dt, { gravity: config.gravity * metrics.scale, maxVelocity: config.maxVelocity * metrics.scale });
      pipes.update(dt, state.speed, config.spawnInterval);
      particles.update(dt, metrics);

      if (bird.top <= 0 || bird.bottom >= metrics.height - config.floorPadding * metrics.scale) {
        endGame();
        return;
      }

      if (pipes.checkCollisions(bird)) {
        endGame();
        return;
      }

      const earned = pipes.claimScores(bird.x);
      if (earned > 0) {
        addScore(earned);
      }
    }

    function draw(time: number) {
      ctx.clearRect(0, 0, metrics.width, metrics.height);
      const currentTheme = getCurrentTheme();
      const previousTheme = THEMES[state.previousThemeIndex] ?? currentTheme;
      const transition = clamp(state.transitionProgress, 0, 1);
      const eased = easeInOutCubic(transition);
      if (transition < 1 && previousTheme !== currentTheme) {
        previousTheme.drawBackground(ctx, time, metrics.width, metrics.height);
        ctx.save();
        ctx.globalAlpha = eased;
        currentTheme.drawBackground(ctx, time, metrics.width, metrics.height);
        ctx.restore();
        drawAura(ctx, time - 0.3, metrics.width, metrics.height, previousTheme.accentColor, (1 - eased) * 0.6);
        drawAura(ctx, time, metrics.width, metrics.height, currentTheme.accentColor, eased * 0.85);
        drawTransitionOverlay(
          ctx,
          time,
          metrics.width,
          metrics.height,
          previousTheme.accentColor,
          currentTheme.accentColor,
          eased,
        );
      } else {
        currentTheme.drawBackground(ctx, time, metrics.width, metrics.height);
        drawAura(ctx, time, metrics.width, metrics.height, currentTheme.accentColor, 0.7);
      }

      pipes.draw(ctx, time, currentTheme);
      particles.draw(ctx);
      bird.draw(ctx, time, currentTheme);

      if (state.mode === 'paused') {
        ctx.fillStyle = 'rgba(10, 6, 18, 0.35)';
        ctx.fillRect(0, 0, metrics.width, metrics.height);
      }
    }

    function resetGameState() {
      state.score = 0;
      state.speed = config.baseSpeed * metrics.scale;
      state.previousThemeIndex = state.themeIndex;
      state.transitionProgress = 1;
      state.transitionDuration = 1;
      particles.clear();
      pipes.reset(Math.max(110 * metrics.scale, metrics.width * 0.11));
      bird.start();
      updateScoreUI();
    }

    function startGame() {
      state.mode = 'running';
      state.needsTimeReset = true;
      resetGameState();
      hideOverlay();
      audio.handleModeChange(true);
    }

    function endGame() {
      state.mode = 'over';
      const finalScore = state.score;
      const isNewBest = finalScore > state.best;
      particles.emitScore(bird.x, Math.min(bird.y, metrics.height - 60 * metrics.scale), metrics.scale, state.elapsed);
      if (isNewBest) {
        state.best = finalScore;
        saveBest();
      }
      void recordHistory(finalScore);
      audio.playGameOver();
      audio.handleModeChange();
      let body = `Final score ${finalScore}. Clique Play pour relancer.`;
      if (isNewBest) {
        body = 'New record! Partage ton run neon.';
        showToast('New personal best!');
      }
      showOverlay('Game over', body, 'Play again', { requireName: true });
      updateScoreUI();
      state.previousThemeIndex = state.themeIndex;
      state.themeIndex = 0;
      state.transitionProgress = 0;
      state.transitionDuration = 0.85;
      state.lastThemeSwitchScore = 0;
      updateThemeLabel();
      audio.setTheme(getCurrentTheme(), true);
    }

    function pauseGame() {
      if (state.mode !== 'running') {
        return;
      }
      state.mode = 'paused';
      audio.handleModeChange();
      showOverlay('Pause', "Respire un coup puis retourne sur le flux.", 'Resume', { requireName: false });
    }

    function resumeGame() {
      if (state.mode !== 'paused') {
        return;
      }
      hideOverlay();
      state.mode = 'running';
      state.needsTimeReset = true;
      audio.handleModeChange(true);
    }

    function configureNameField(requireName: boolean) {
      if (requireName) {
        nameFieldEl.classList.remove('overlay-name--hidden');
        nameInputEl.disabled = false;
        nameInputEl.value = state.playerName;
        requestAnimationFrame(() => {
          nameInputEl.focus();
          nameInputEl.select();
        });
      } else {
        nameFieldEl.classList.add('overlay-name--hidden');
        nameInputEl.disabled = true;
      }
    }

    function showOverlay(
      title: string,
      message: string,
      buttonLabel: string,
      options: { requireName?: boolean } = {},
    ) {
      overlayTitleEl.textContent = title;
      overlayMessageEl.textContent = message;
      playButtonEl.textContent = buttonLabel;
      configureNameField(Boolean(options.requireName));
      overlayEl.classList.add('overlay--visible');
    }

    function hideOverlay() {
      overlayEl.classList.remove('overlay--visible');
      if (!nameInputEl.disabled) {
        nameInputEl.blur();
      }
    }

    function showToast(message: string) {
      toastEl.textContent = message;
      toastEl.classList.add('toast--visible');
      if (toastTimer) {
        clearTimeout(toastTimer);
      }
      toastTimer = setTimeout(() => {
        toastEl.classList.remove('toast--visible');
      }, 2200);
    }

    function loadBest() {
      const stored = Number(window.localStorage.getItem(STORAGE_KEY));
      state.best = Number.isFinite(stored) && stored >= 0 ? stored : 0;
    }

    function loadName() {
      try {
        const stored = window.localStorage.getItem(NAME_STORAGE_KEY) ?? '';
        const sanitized = stored.trim();
        state.playerName = sanitized || 'Flappy Boys';
      } catch (error) {
        console.warn('Name load error', error);
        state.playerName = 'Flappy Boys';
      }
      nameInputEl.value = state.playerName;
      updatePlayerBadge();
    }

    function saveName() {
      try {
        window.localStorage.setItem(NAME_STORAGE_KEY, state.playerName);
      } catch (error) {
        console.warn('Name save error', error);
      }
    }

    function saveBest() {
      window.localStorage.setItem(STORAGE_KEY, String(state.best));
    }

    async function loadHistory() {
      try {
        const { data, error } = await supabaseClient
          .from('score_entries')
          .select('player_name, score, created_at')
          .order('score', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(HISTORY_LIMIT);

        if (error) {
          throw error;
        }

        historyEntries = (data ?? [])
          .map((entry) => {
            const rawName = typeof entry.player_name === 'string' ? entry.player_name.trim() : '';
            const resolvedScore = typeof entry.score === 'number' ? entry.score : 0;
            const timestamp = entry.created_at ? new Date(entry.created_at).getTime() : Date.now();
            const sanitized: HistoryEntry = {
              score: resolvedScore,
              playedAt: timestamp,
              name: rawName || 'Flappy Boys',
            };
            return sanitized;
          })
          .filter((entry) => Number.isFinite(entry.score) && entry.score >= 0)
          .sort((a, b) => b.score - a.score || b.playedAt - a.playedAt)
          .slice(0, HISTORY_LIMIT);
      } catch (error) {
        console.warn('History load error', error);
        if (!historyEntries.length) {
          historyEntries = [];
        }
      }
      renderHistory();
    }

    function capturePlayerName() {
      if (nameInputEl.disabled) {
        return;
      }
      const trimmed = nameInputEl.value.trim();
      state.playerName = trimmed || 'Flappy Boys';
      nameInputEl.value = state.playerName;
      saveName();
      updatePlayerBadge();
    }

    async function recordHistory(score: number) {
      try {
        const { error } = await supabaseClient.rpc('save_score', {
          player_name: state.playerName,
          score,
        });
        if (error) {
          throw error;
        }
        await loadHistory();
      } catch (error) {
        console.warn('History save error', error);
        showToast('Sauvegarde en ligne impossible. Réessaie plus tard.');
      }
    }

    function renderHistory() {
      historyBodyEl.innerHTML = '';
      if (historyEntries.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 4;
        emptyCell.className = 'history-empty';
        emptyCell.textContent = 'Joue une partie pour remplir le tableau.';
        emptyRow.appendChild(emptyCell);
        historyBodyEl.appendChild(emptyRow);
        return;
      }

      historyEntries.forEach((entry, index) => {
        const row = document.createElement('tr');
        if (entry.score === state.best && state.best > 0) {
          row.classList.add('history-row-best');
        }

        const rankCell = document.createElement('td');
        rankCell.textContent = String(index + 1);

        const nameCell = document.createElement('td');
        nameCell.textContent = entry.name;

        const scoreCell = document.createElement('td');
        scoreCell.textContent = String(entry.score);

        const timeCell = document.createElement('td');
        timeCell.textContent = formatTime(entry.playedAt);

        row.appendChild(rankCell);
        row.appendChild(nameCell);
        row.appendChild(scoreCell);
        row.appendChild(timeCell);
        historyBodyEl.appendChild(row);
      });
    }

    function updateScoreUI() {
      const scoreNode = document.getElementById('score-value');
      const bestNode = document.getElementById('best-value');
      if (scoreNode) {
        scoreNode.textContent = String(state.score);
      }
      if (bestNode) {
        bestNode.textContent = String(state.best);
      }
    }

    function updatePlayerBadge() {
      playerNameEl.textContent = state.playerName;
    }

    function updateMuteButton() {
      muteButtonEl.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
      muteButtonEl.textContent = state.muted ? '🔇' : '🔊';
      muteButtonEl.setAttribute('aria-label', state.muted ? 'Activer le son' : 'Couper le son');
      muteButtonEl.title = state.muted ? 'Son coupé' : 'Son actif';
    }

    function toggleMute() {
      state.muted = !state.muted;
      if (!state.muted) {
        ensureAudio();
      }
      audio.setMuted(state.muted);
      updateMuteButton();
      showToast(state.muted ? 'Audio coupé' : 'Audio actif');
    }

    function addScore(value: number) {
      state.score += value;
      particles.emitScore(bird.x + metrics.scale * 12, bird.y - metrics.scale * 8, metrics.scale, state.elapsed);
      updateScoreUI();
      audio.playScore();

      if (
        state.score > 0 &&
        state.score % THEME_SWITCH_INTERVAL === 0 &&
        state.score !== state.lastThemeSwitchScore
      ) {
        const previousIndex = state.themeIndex;
        state.previousThemeIndex = previousIndex;
        state.themeIndex = (previousIndex + 1) % THEME_SEQUENCE.length;
        state.transitionProgress = 0;
        state.transitionDuration = 0.9;
        state.lastThemeSwitchScore = state.score;
        audio.setTheme(getCurrentTheme(), true);
        updateThemeLabel();
        showToast(`${getCurrentTheme().emoji} Nouveau thème: ${getCurrentTheme().label}`);
      }
    }

    function ensureAudio() {
      audio.ensureContext();
      audio.setTheme(getCurrentTheme(), true);
      audio.setMuted(state.muted);
      audio.handleModeChange(true);
    }

    function shareScore() {
      const baseText = `${state.playerName} - score Flappy Dopamine: ${state.score}. Record perso: ${state.best}.`;
      let url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(baseText)}`;
      try {
        const origin = window.location?.origin;
        if (origin) {
          url += `&url=${encodeURIComponent(origin)}`;
        }
      } catch (error) {
        console.warn('Tweet url build error', error);
      }
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (win) {
        win.opener = null;
        showToast('Tweet prêt à être envoyé !');
      } else {
        showToast('Autorise les popups Twitter pour partager.');
      }
    }

    function onPrimaryAction() {
      ensureAudio();
      if (state.mode === 'idle') {
        capturePlayerName();
        startGame();
        flap();
        return;
      }
      if (state.mode === 'running') {
        flap();
        return;
      }
      if (state.mode === 'paused') {
        resumeGame();
        return;
      }
      if (state.mode === 'over') {
        capturePlayerName();
        startGame();
        flap();
      }
    }

    function flap() {
      if (state.mode !== 'running') {
        return;
      }
      bird.flap(config.flapImpulse * metrics.scale);
      particles.emitFlap(bird.x - bird.radius * 0.4, bird.y + bird.radius * 0.2, metrics.scale);
      audio.playFlap();
    }

    function onNameKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter') {
        event.preventDefault();
        onPrimaryAction();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.code === 'Space') {
        event.preventDefault();
        onPrimaryAction();
        return;
      }
      if (event.code === 'KeyP') {
        if (state.mode === 'running') {
          pauseGame();
        } else if (state.mode === 'paused') {
          resumeGame();
        }
      }
    }

    function onPointer(event: PointerEvent) {
      event.preventDefault();
      onPrimaryAction();
    }

    function onOverlayClick(event: MouseEvent) {
      if (event.target === overlay) {
        onPrimaryAction();
      }
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', onKeyDown);
      canvasEl.removeEventListener('pointerdown', onPointer as EventListener);
      overlayEl.removeEventListener('click', onOverlayClick);
      playButtonEl.removeEventListener('click', onPrimaryAction);
      shareButtonEl.removeEventListener('click', shareScore);
      muteButtonEl.removeEventListener('click', toggleMute);
      nameInputEl.removeEventListener('keydown', onNameKeyDown);
      themeLabelEl.removeEventListener('animationend', onThemeAnimationEnd);
      if (toastTimer) {
        clearTimeout(toastTimer);
      }
      audio.dispose();
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="title-block">
          <h1>Flappy Dopamine</h1>
          <p className="baseline">Vol hypnotique, vibes neon.</p>
        </div>
        <div ref={playerNameRef} className="player-badge" aria-live="polite">
          Flappy Boys
        </div>
        <div ref={themeLabelRef} className="theme-chip">⚡ Néon Pulse</div>
      </header>

      <main className="layout" aria-label="Jeu Flappy Dopamine">
        <aside className="side-panel">
          <section className="score-stack">
            <h2>Scoreboard</h2>
            <div className="score-grid" role="status" aria-live="polite">
              <div className="score-card">
                <span className="label">Score</span>
                <span className="value" id="score-value">
                  0
                </span>
              </div>
              <div className="score-card">
                <span className="label">Record</span>
                <span className="value" id="best-value">
                  0
                </span>
              </div>
            </div>
          </section>

          <section>
            <h2>Commands</h2>
            <ul className="controls-list">
              <li>
                <span className="key">Space</span> flap
              </li>
              <li>
                <span className="key">Click</span> ou tap pour flap
              </li>
              <li>
                <span className="key">P</span> pause / reprise
              </li>
            </ul>
          </section>
          <section>
            <h2>Conseils</h2>
            <p>Reste dans le flux neon, garde le rythme, et anticipe le boost toutes les cinq portes.</p>
          </section>
          <section className="actions">
            <button ref={shareButtonRef} className="ghost-btn" type="button">
              Tweeter mon score
            </button>
          </section>
          <section className="history">
            <h2>Hall Neon</h2>
            <table className="score-history">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Joueur</th>
                  <th>Score</th>
                  <th>Heure</th>
                </tr>
              </thead>
              <tbody ref={historyBodyRef}>
                <tr>
                  <td className="history-empty" colSpan={4}>
                    Joue une partie pour remplir le tableau.
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </aside>

        <section className="canvas-shell" aria-label="Zone de jeu">
          <canvas
            ref={canvasRef}
            className="game-canvas"
            role="img"
            aria-label="Jeu Flappy Dopamine"
          />
          <div ref={overlayRef} className="overlay overlay--visible" aria-live="polite">
            <div className="overlay-card">
              <h2 ref={overlayTitleRef}>Ready to vibe?</h2>
              <p ref={overlayMessageRef}>Clique Play ou tape l&apos;écran pour décoller.</p>
              <div ref={nameFieldRef} className="overlay-name">
                <label className="overlay-label" htmlFor="player-name">
                  Ton prénom
                </label>
                <input
                  ref={nameInputRef}
                  id="player-name"
                  className="overlay-input"
                  type="text"
                  name="player-name"
                  placeholder="Flappy Boys"
                  autoComplete="nickname"
                  maxLength={24}
                  inputMode="text"
                  aria-label="Ton prénom"
                />
              </div>
              <button ref={playButtonRef} className="primary-btn" type="button">
                Play
              </button>
            </div>
          </div>
          <button
            ref={muteButtonRef}
            className="audio-toggle"
            type="button"
            aria-label="Couper le son"
            aria-pressed="false"
          >
            🔊
          </button>
          <div ref={toastRef} className="toast" role="status" aria-live="polite" />
        </section>
      </main>
    </div>
  );
}
