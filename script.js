const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start');
const shareBtn = document.getElementById('share');
const scoreNode = document.getElementById('score');
const bestNode = document.getElementById('best');
const wrapper = document.querySelector('.wrapper');
const startMessage = document.getElementById('start-message');
const themeLabel = document.getElementById('theme-label');
const leaderboard = document.querySelector('.leaderboard');
const leaderboardToggle = document.getElementById('leaderboard-toggle');
const leaderboardPanel = document.getElementById('leaderboard-panel');
const leaderboardList = document.getElementById('leaderboard-list');

const DPR = window.devicePixelRatio || 1;
let width = 640;
let height = 960;

const BIRD_X = 180;
const GRAVITY = 1800;
const FLAP_VELOCITY = -620;
const PIPE_GAP = 220;
const PIPE_WIDTH = 120;
const PIPE_FREQUENCY = 1.6;
const MAX_DROP_SPEED = 900;

const LEADERBOARD_STORAGE_KEY = 'flappy-dopamine-leaderboard';
const LEADERBOARD_SIZE = 5;

let leaderboardEntries = [];
let leaderboardToggledManually = false;

const THEMES = [
  {
    id: 'neon',
    name: 'Néon Pulse',
    particleSaturation: 90,
    particleLightness: 60,
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
    drawPipe(ctx, pipe, h, pulse) {
      ctx.save();
      const baseHue = (pulse * 50 + pipe.seed * 360) % 360;
      const gradientTop = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, pipe.top);
      gradientTop.addColorStop(0, `hsla(${baseHue}, 80%, 70%, 0.95)`);
      gradientTop.addColorStop(1, `hsla(${(baseHue + 60) % 360}, 80%, 40%, 0.95)`);
      ctx.fillStyle = gradientTop;
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);

      const gradientBottom = ctx.createLinearGradient(pipe.x, pipe.bottom, pipe.x + PIPE_WIDTH, h);
      gradientBottom.addColorStop(0, `hsla(${(baseHue + 60) % 360}, 90%, 50%, 0.95)`);
      gradientBottom.addColorStop(1, `hsla(${(baseHue + 180) % 360}, 90%, 35%, 0.95)`);
      ctx.fillStyle = gradientBottom;
      ctx.fillRect(pipe.x, pipe.bottom, PIPE_WIDTH, h - pipe.bottom);

      ctx.fillStyle = `hsla(${baseHue}, 90%, 65%, 0.25)`;
      ctx.fillRect(pipe.x - 12, 0, 12, h);
      ctx.restore();
    },
    drawBird(ctx, pulse) {
      const bodyRadius = 24;
      const hue = (pulse * 120) % 360;
      const radial = ctx.createRadialGradient(0, -8, 6, 0, 0, bodyRadius);
      radial.addColorStop(0, `hsla(${hue}, 90%, 75%, 0.95)`);
      radial.addColorStop(1, `hsla(${(hue + 120) % 360}, 85%, 50%, 0.95)`);

      ctx.fillStyle = radial;
      ctx.beginPath();
      ctx.ellipse(0, 0, bodyRadius, bodyRadius * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `hsla(${(hue + 200) % 360}, 80%, 65%, 0.85)`;
      ctx.beginPath();
      ctx.ellipse(-bodyRadius * 0.4, -10, bodyRadius * 0.8, bodyRadius * 0.5, 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `hsla(${(hue + 40) % 360}, 90%, 65%, 0.9)`;
      ctx.beginPath();
      ctx.moveTo(bodyRadius * 0.8, -6);
      ctx.quadraticCurveTo(bodyRadius * 1.4, 0, bodyRadius * 0.8, 8);
      ctx.quadraticCurveTo(bodyRadius * 0.9, 0, bodyRadius * 0.8, -6);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(bodyRadius * 0.2, -10, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
      ctx.beginPath();
      ctx.arc(bodyRadius * 0.5, -10, 3, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'dino',
    particleSaturation: 65,
    particleLightness: 55,
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

      ctx.fillStyle = 'rgba(40, 80, 45, 0.65)';
      for (let i = 0; i < 12; i += 1) {
        const baseX = (i * 140 + Math.sin(pulse * 2 + i) * 40 + w) % (w + 120) - 60;
        const baseY = h * 0.82 + Math.sin(pulse * 1.2 + i) * 6;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(baseX + 18, baseY - 50);
        ctx.lineTo(baseX + 36, baseY);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    },
    drawPipe(ctx, pipe, h, pulse) {
      ctx.save();
      const stoneGradient = ctx.createLinearGradient(pipe.x, 0, pipe.x, pipe.bottom);
      stoneGradient.addColorStop(0, 'rgba(110, 84, 60, 0.95)');
      stoneGradient.addColorStop(0.6, 'rgba(90, 68, 48, 0.95)');
      stoneGradient.addColorStop(1, 'rgba(70, 52, 38, 0.95)');
      ctx.fillStyle = stoneGradient;
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
      ctx.fillRect(pipe.x, pipe.bottom, PIPE_WIDTH, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(255, 235, 200, 0.2)';
      ctx.lineWidth = 3;
      for (let y = 16; y < pipe.top - 12; y += 30) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 10, y);
        ctx.lineTo(pipe.x + PIPE_WIDTH - 10, y - 6);
        ctx.stroke();
      }
      for (let y = pipe.bottom + 12; y < h - 12; y += 30) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 10, y);
        ctx.lineTo(pipe.x + PIPE_WIDTH - 10, y + 6);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(50, 35, 25, 0.8)';
      ctx.lineWidth = 6;
      ctx.strokeRect(pipe.x + 3, 0, PIPE_WIDTH - 6, pipe.top);
      ctx.strokeRect(pipe.x + 3, pipe.bottom, PIPE_WIDTH - 6, h - pipe.bottom);

      ctx.fillStyle = 'rgba(120, 150, 70, 0.75)';
      ctx.beginPath();
      const vineWave = Math.sin(pulse * 2.5 + pipe.seed * Math.PI * 2) * 10;
      ctx.moveTo(pipe.x + PIPE_WIDTH / 2 + vineWave, pipe.top);
      ctx.bezierCurveTo(
        pipe.x + PIPE_WIDTH / 2 - 24,
        pipe.top + 80,
        pipe.x + PIPE_WIDTH / 2 + 24,
        pipe.bottom - 80,
        pipe.x + PIPE_WIDTH / 2 - vineWave,
        pipe.bottom
      );
      ctx.lineTo(pipe.x + PIPE_WIDTH / 2 - vineWave + 8, pipe.bottom + 18);
      ctx.lineTo(pipe.x + PIPE_WIDTH / 2 + vineWave + 12, pipe.bottom);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    },
    drawBird(ctx, pulse) {
      ctx.save();
      const wingFlap = Math.sin(pulse * 7) * 18;
      ctx.fillStyle = 'rgba(200, 150, 80, 0.9)';
      ctx.beginPath();
      ctx.moveTo(-30, 0);
      ctx.quadraticCurveTo(-50, -wingFlap - 6, -12, -4);
      ctx.quadraticCurveTo(-50, wingFlap + 6, -30, 4);
      ctx.closePath();
      ctx.fill();

      const bodyGradient = ctx.createLinearGradient(-10, -20, 26, 20);
      bodyGradient.addColorStop(0, 'rgba(230, 190, 120, 0.95)');
      bodyGradient.addColorStop(1, 'rgba(150, 100, 60, 0.95)');
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

      ctx.fillStyle = 'rgba(90, 60, 35, 0.85)';
      ctx.beginPath();
      ctx.moveTo(-6, 6);
      ctx.lineTo(-2, 18);
      ctx.lineTo(2, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'cyber',
    name: 'Cyber Rave',
    particleSaturation: 70,
    particleLightness: 55,
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
      ctx.restore();
    },
    drawPipe(ctx, pipe, h, pulse) {
      ctx.save();
      const glow = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
      glow.addColorStop(0, 'rgba(0, 255, 210, 0.15)');
      glow.addColorStop(0.5, 'rgba(0, 120, 255, 0.5)');
      glow.addColorStop(1, 'rgba(0, 255, 210, 0.15)');

      ctx.fillStyle = 'rgba(10, 6, 32, 0.92)';
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
      ctx.fillRect(pipe.x, pipe.bottom, PIPE_WIDTH, h - pipe.bottom);

      ctx.strokeStyle = glow;
      ctx.lineWidth = 5;
      ctx.strokeRect(pipe.x + 2, 0, PIPE_WIDTH - 4, pipe.top);
      ctx.strokeRect(pipe.x + 2, pipe.bottom, PIPE_WIDTH - 4, h - pipe.bottom);

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0, 255, 200, 0.25)';
      for (let y = 16; y < pipe.top - 8; y += 28) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 6, y);
        ctx.lineTo(pipe.x + PIPE_WIDTH - 6, y);
        ctx.stroke();
      }
      for (let y = pipe.bottom + 12; y < h - 8; y += 28) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 6, y);
        ctx.lineTo(pipe.x + PIPE_WIDTH - 6, y);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(255, 0, 180, 0.35)';
      ctx.beginPath();
      const flicker = Math.sin(pulse * 10 + pipe.seed * Math.PI * 2) * 8;
      ctx.moveTo(pipe.x + PIPE_WIDTH / 2 + flicker, pipe.top - 18);
      ctx.lineTo(pipe.x + PIPE_WIDTH / 2 - flicker, pipe.top + 18);
      ctx.moveTo(pipe.x + PIPE_WIDTH / 2 - flicker, pipe.bottom - 18);
      ctx.lineTo(pipe.x + PIPE_WIDTH / 2 + flicker, pipe.bottom + 18);
      ctx.stroke();

      ctx.restore();
    },
    drawBird(ctx, pulse) {
      ctx.save();
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
  },
  {
    id: 'forest',
    name: 'Forêt Luxuriante',
    particleSaturation: 70,
    particleLightness: 50,
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

      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      for (let i = 0; i < 30; i += 1) {
        const leafX = (i * 73 + Math.sin(pulse * 3 + i) * 120 + w) % w;
        const leafY = (i * 91 + Math.cos(pulse * 2.2 + i) * 80 + h) % h;
        ctx.beginPath();
        ctx.ellipse(leafX, leafY, 4, 12, pulse + i, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },
    drawPipe(ctx, pipe, h, pulse) {
      ctx.save();
      ctx.fillStyle = 'rgba(73, 44, 16, 0.95)';
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
      ctx.fillRect(pipe.x, pipe.bottom, PIPE_WIDTH, h - pipe.bottom);

      ctx.fillStyle = 'rgba(92, 58, 26, 0.9)';
      ctx.fillRect(pipe.x + 6, 0, PIPE_WIDTH - 12, pipe.top);
      ctx.fillRect(pipe.x + 6, pipe.bottom, PIPE_WIDTH - 12, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 2;
      for (let y = 18; y < pipe.top - 12; y += 26) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 10, y);
        ctx.quadraticCurveTo(pipe.x + PIPE_WIDTH / 2, y + 6, pipe.x + PIPE_WIDTH - 10, y - 4);
        ctx.stroke();
      }
      for (let y = pipe.bottom + 10; y < h - 12; y += 26) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 10, y);
        ctx.quadraticCurveTo(pipe.x + PIPE_WIDTH / 2, y + 6, pipe.x + PIPE_WIDTH - 10, y - 4);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(46, 140, 80, 0.9)';
      ctx.beginPath();
      ctx.ellipse(pipe.x + PIPE_WIDTH / 2, pipe.top + 16, PIPE_WIDTH * 0.7, 30, 0, Math.PI, 0, true);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(pipe.x + PIPE_WIDTH / 2, pipe.bottom - 16, PIPE_WIDTH * 0.7, 30, 0, 0, Math.PI, true);
      ctx.fill();

      ctx.strokeStyle = 'rgba(34, 100, 60, 0.6)';
      ctx.lineWidth = 3;
      const vineOffset = Math.sin(pulse * 3 + pipe.seed * Math.PI * 2) * 12;
      ctx.beginPath();
      ctx.moveTo(pipe.x + 4 + vineOffset, pipe.bottom);
      ctx.bezierCurveTo(
        pipe.x + PIPE_WIDTH / 2,
        pipe.bottom + 50,
        pipe.x + PIPE_WIDTH / 2 - vineOffset,
        pipe.bottom + 90,
        pipe.x + PIPE_WIDTH - 6,
        pipe.bottom + 130
      );
      ctx.stroke();

      ctx.restore();
    },
    drawBird(ctx, pulse) {
      ctx.save();
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
  },
  {
    id: 'cosmic',
    name: 'Dérive Cosmique',
    particleSaturation: 80,
    particleLightness: 70,
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
        highType: 'sine',
        highStart: 600,
        highMid: 900,
        highEnd: 1320,
        highMidTime: 0.16,
        highEndTime: 0.32,
        lowType: 'sine',
        lowStart: 300,
        lowEnd: 420,
        shimmerGain: 0.24,
        delayTime: 0.34,
        feedbackGain: 0.22,
        release: 0.75,
      },
      gameover: {
        type: 'sine',
        startFreq: 500,
        endFreq: 90,
        filterType: 'lowpass',
        filterStart: 1300,
        filterEnd: 180,
        attack: 0.06,
        maxGain: 0.5,
        release: 1.4,
        noiseAmount: 0.26,
        noiseDecay: 0.7,
      },
    },
    particleHue(pulse, index) {
      return (260 + Math.sin(pulse * 5 + index) * 50 + index * 20) % 360;
    },
    drawBackground(ctx, pulse, w, h) {
      ctx.save();
      const gradient = ctx.createRadialGradient(
        w * 0.5,
        h * 0.6,
        h * 0.1,
        w * 0.5,
        h * 0.6,
        h * 1.2
      );
      gradient.addColorStop(0, '#14023a');
      gradient.addColorStop(0.4, '#0b0630');
      gradient.addColorStop(1, '#01000f');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = 0.65;
      for (let i = 0; i < 70; i += 1) {
        const x = (i * 91 + Math.sin(pulse * 0.7 + i) * 200 + w) % w;
        const y = (i * 53 + Math.cos(pulse * 0.9 + i) * 160 + h) % h;
        const size = ((Math.sin(pulse * 4 + i) + 1.5) * 0.8 + (i % 3) * 0.3) + 0.3;
        ctx.fillStyle = `hsla(${260 + (i % 4) * 30}, 90%, 80%, ${0.3 + (i % 5) * 0.1})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = 'rgba(120, 40, 255, 0.2)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i += 1) {
        const radius = h * 0.2 + i * 60;
        ctx.beginPath();
        ctx.ellipse(
          w / 2,
          h * 0.65,
          radius,
          radius * (0.5 + Math.sin(pulse * 0.3 + i) * 0.1),
          pulse * 0.1,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }

      ctx.restore();
    },
    drawPipe(ctx, pipe, h, pulse) {
      ctx.save();
      const gradientTop = ctx.createLinearGradient(pipe.x, 0, pipe.x, pipe.top);
      gradientTop.addColorStop(0, 'rgba(80, 30, 200, 0.9)');
      gradientTop.addColorStop(1, 'rgba(10, 0, 40, 0.95)');

      const gradientBottom = ctx.createLinearGradient(pipe.x, pipe.bottom, pipe.x, h);
      gradientBottom.addColorStop(0, 'rgba(20, 0, 60, 0.95)');
      gradientBottom.addColorStop(1, 'rgba(120, 20, 240, 0.9)');

      ctx.fillStyle = gradientTop;
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
      ctx.fillStyle = gradientBottom;
      ctx.fillRect(pipe.x, pipe.bottom, PIPE_WIDTH, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(160, 100, 255, 0.45)';
      ctx.lineWidth = 4;
      ctx.strokeRect(pipe.x + 3, 0, PIPE_WIDTH - 6, pipe.top);
      ctx.strokeRect(pipe.x + 3, pipe.bottom, PIPE_WIDTH - 6, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i += 1) {
        ctx.setLineDash([8, 12]);
        ctx.lineDashOffset = (pulse * 80 + i * 40 + pipe.seed * 200) % (PIPE_WIDTH * 2);
        ctx.beginPath();
        const y = i % 2 === 0 ? pipe.top - 12 : pipe.bottom + 12;
        ctx.moveTo(pipe.x + 8, y);
        ctx.lineTo(pipe.x + PIPE_WIDTH - 8, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      ctx.shadowColor = 'rgba(160, 80, 255, 0.45)';
      ctx.shadowBlur = 16;
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = 'rgba(180, 120, 255, 0.6)';
      ctx.fillRect(pipe.x + PIPE_WIDTH / 2 - 6, 0, 12, pipe.top);
      ctx.fillRect(pipe.x + PIPE_WIDTH / 2 - 6, pipe.bottom, 12, h - pipe.bottom);
      ctx.restore();
    },
    drawBird(ctx, pulse) {
      ctx.save();
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
  },
  {
    id: 'pirate',
    name: 'Marées Pirates',
    particleSaturation: 75,
    particleLightness: 55,
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
        const y =
          horizon +
          Math.sin(pulse * 1.6 + x * 0.015) * waveAmplitude +
          Math.sin(pulse * 0.7 + x * 0.03) * 6;
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
    drawPipe(ctx, pipe, h, pulse) {
      ctx.save();
      const wood = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
      wood.addColorStop(0, '#4a2d16');
      wood.addColorStop(0.5, '#704523');
      wood.addColorStop(1, '#4a2d16');
      ctx.fillStyle = wood;
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
      ctx.fillRect(pipe.x, pipe.bottom, PIPE_WIDTH, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(22, 12, 6, 0.7)';
      ctx.lineWidth = 5;
      ctx.strokeRect(pipe.x + 2, 0, PIPE_WIDTH - 4, pipe.top);
      ctx.strokeRect(pipe.x + 2, pipe.bottom, PIPE_WIDTH - 4, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(235, 220, 180, 0.3)';
      ctx.lineWidth = 2;
      for (let y = 12; y < pipe.top - 8; y += 24) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 6, y);
        ctx.lineTo(pipe.x + PIPE_WIDTH - 6, y + 4);
        ctx.stroke();
      }
      for (let y = pipe.bottom + 12; y < h - 12; y += 24) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 6, y);
        ctx.lineTo(pipe.x + PIPE_WIDTH - 6, y - 4);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(230, 230, 220, 0.75)';
      const sailOffset = Math.sin(pulse * 1.8 + pipe.seed * Math.PI * 2) * 18;
      ctx.beginPath();
      ctx.moveTo(pipe.x + PIPE_WIDTH / 2, pipe.top + 14);
      ctx.lineTo(pipe.x + PIPE_WIDTH / 2 + 50 + sailOffset, pipe.top + PIPE_WIDTH);
      ctx.lineTo(pipe.x + PIPE_WIDTH / 2, pipe.top + PIPE_WIDTH - 10);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(pipe.x + PIPE_WIDTH / 2, pipe.bottom - PIPE_WIDTH + 10);
      ctx.lineTo(pipe.x + PIPE_WIDTH / 2 - 48 + sailOffset, pipe.bottom - 14);
      ctx.lineTo(pipe.x + PIPE_WIDTH / 2, pipe.bottom - 12);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(180, 150, 90, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pipe.x + PIPE_WIDTH / 2, 0);
      ctx.lineTo(pipe.x + PIPE_WIDTH / 2, h);
      ctx.stroke();

      ctx.restore();
    },
    drawBird(ctx, pulse) {
      ctx.save();
      const flap = Math.sin(pulse * 10) * 16;

      ctx.fillStyle = 'rgba(255, 210, 80, 0.9)';
      ctx.beginPath();
      ctx.moveTo(-18, 6);
      ctx.quadraticCurveTo(-38, flap - 4, -6, -6);
      ctx.quadraticCurveTo(-30, flap + 4, -18, 6);
      ctx.fill();

      const bodyGradient = ctx.createLinearGradient(-12, -24, 24, 24);
      bodyGradient.addColorStop(0, 'rgba(20, 160, 120, 0.95)');
      bodyGradient.addColorStop(1, 'rgba(12, 80, 200, 0.95)');
      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(16, -6, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(20, 20, 20, 0.9)';
      ctx.beginPath();
      ctx.arc(18, -6, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 150, 40, 0.95)';
      ctx.beginPath();
      ctx.moveTo(26, -2);
      ctx.lineTo(38, 0);
      ctx.lineTo(26, 2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(220, 60, 50, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-12, 6);
      ctx.quadraticCurveTo(-4, 14, 10, 10);
      ctx.stroke();

      ctx.restore();
    },
  },
  {
    id: 'frozen',
    name: 'Rêve Gelé',
    particleSaturation: 45,
    particleLightness: 80,
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
    drawPipe(ctx, pipe, h, pulse) {
      ctx.save();
      const ice = ctx.createLinearGradient(pipe.x, 0, pipe.x, h);
      ice.addColorStop(0, 'rgba(200, 235, 255, 0.95)');
      ice.addColorStop(0.5, 'rgba(120, 180, 255, 0.85)');
      ice.addColorStop(1, 'rgba(40, 80, 140, 0.9)');
      ctx.fillStyle = ice;
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
      ctx.fillRect(pipe.x, pipe.bottom, PIPE_WIDTH, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 4;
      ctx.strokeRect(pipe.x + 2, 0, PIPE_WIDTH - 4, pipe.top);
      ctx.strokeRect(pipe.x + 2, pipe.bottom, PIPE_WIDTH - 4, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      for (let y = 14; y < pipe.top - 12; y += 26) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 10, y);
        ctx.lineTo(pipe.x + PIPE_WIDTH - 10, y + 6);
        ctx.stroke();
      }
      for (let y = pipe.bottom + 12; y < h - 12; y += 26) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 10, y);
        ctx.lineTo(pipe.x + PIPE_WIDTH - 10, y - 6);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      const spikeOffset = Math.sin(pulse * 2.4 + pipe.seed * Math.PI * 2) * 6;
      ctx.beginPath();
      ctx.moveTo(pipe.x + 8, pipe.top + 6);
      ctx.lineTo(pipe.x + PIPE_WIDTH / 2 + spikeOffset, pipe.top + 32);
      ctx.lineTo(pipe.x + PIPE_WIDTH - 8, pipe.top + 6);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(pipe.x + 8, pipe.bottom - 6);
      ctx.lineTo(pipe.x + PIPE_WIDTH / 2 - spikeOffset, pipe.bottom - 32);
      ctx.lineTo(pipe.x + PIPE_WIDTH - 8, pipe.bottom - 6);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    },
    drawBird(ctx, pulse) {
      ctx.save();
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
  },
  {
    id: 'fire',
    name: 'Brasier Céleste',
    particleSaturation: 90,
    particleLightness: 55,
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
    drawPipe(ctx, pipe, h, pulse) {
      ctx.save();
      const basalt = ctx.createLinearGradient(pipe.x, 0, pipe.x, h);
      basalt.addColorStop(0, 'rgba(40, 10, 5, 0.95)');
      basalt.addColorStop(0.5, 'rgba(22, 4, 2, 0.95)');
      basalt.addColorStop(1, 'rgba(14, 2, 1, 0.95)');
      ctx.fillStyle = basalt;
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
      ctx.fillRect(pipe.x, pipe.bottom, PIPE_WIDTH, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(255, 90, 20, 0.45)';
      ctx.lineWidth = 3;
      ctx.strokeRect(pipe.x + 3, 0, PIPE_WIDTH - 6, pipe.top);
      ctx.strokeRect(pipe.x + 3, pipe.bottom, PIPE_WIDTH - 6, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(255, 70, 15, 0.6)';
      ctx.lineWidth = 2;
      const crackOffset = Math.sin(pulse * 5 + pipe.seed * Math.PI * 2) * 14;
      for (let y = 12; y < pipe.top - 8; y += 30) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 14 + crackOffset, y);
        ctx.lineTo(pipe.x + PIPE_WIDTH - 14 - crackOffset, y + 12);
        ctx.stroke();
      }
      for (let y = pipe.bottom + 8; y < h - 12; y += 30) {
        ctx.beginPath();
        ctx.moveTo(pipe.x + 14 - crackOffset, y);
        ctx.lineTo(pipe.x + PIPE_WIDTH - 14 + crackOffset, y + 12);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255, 150, 40, 0.85)';
      ctx.beginPath();
      ctx.moveTo(pipe.x + PIPE_WIDTH / 2, pipe.top + 10);
      ctx.quadraticCurveTo(
        pipe.x + PIPE_WIDTH / 2 + 30,
        pipe.top + 40,
        pipe.x + PIPE_WIDTH / 2,
        pipe.top + 70
      );
      ctx.quadraticCurveTo(
        pipe.x + PIPE_WIDTH / 2 - 30,
        pipe.top + 40,
        pipe.x + PIPE_WIDTH / 2,
        pipe.top + 10
      );
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(pipe.x + PIPE_WIDTH / 2, pipe.bottom - 10);
      ctx.quadraticCurveTo(
        pipe.x + PIPE_WIDTH / 2 - 30,
        pipe.bottom - 40,
        pipe.x + PIPE_WIDTH / 2,
        pipe.bottom - 70
      );
      ctx.quadraticCurveTo(
        pipe.x + PIPE_WIDTH / 2 + 30,
        pipe.bottom - 40,
        pipe.x + PIPE_WIDTH / 2,
        pipe.bottom - 10
      );
      ctx.fill();

      ctx.restore();
    },
    drawBird(ctx, pulse) {
      ctx.save();
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
  },
  {
    id: 'dark',
    name: 'Nocturne Souterrain',
    particleSaturation: 30,
    particleLightness: 45,
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
      ctx.globalCompositeOperation = 'source-over';

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
    drawPipe(ctx, pipe, h, pulse) {
      ctx.save();
      const pillar = ctx.createLinearGradient(pipe.x, 0, pipe.x, h);
      pillar.addColorStop(0, 'rgba(18, 18, 26, 0.95)');
      pillar.addColorStop(0.5, 'rgba(10, 10, 16, 0.95)');
      pillar.addColorStop(1, 'rgba(6, 6, 10, 0.95)');
      ctx.fillStyle = pillar;
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
      ctx.fillRect(pipe.x, pipe.bottom, PIPE_WIDTH, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(120, 80, 200, 0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(pipe.x + 3, 0, PIPE_WIDTH - 6, pipe.top);
      ctx.strokeRect(pipe.x + 3, pipe.bottom, PIPE_WIDTH - 6, h - pipe.bottom);

      ctx.strokeStyle = 'rgba(180, 120, 255, 0.25)';
      ctx.lineWidth = 2;
      for (let y = 16; y < pipe.top - 12; y += 30) {
        ctx.beginPath();
        const wobble = Math.sin(pulse * 2 + y * 0.1 + pipe.seed * Math.PI * 2) * 6;
        ctx.moveTo(pipe.x + 10 + wobble, y);
        ctx.lineTo(pipe.x + PIPE_WIDTH - 10 - wobble, y + 4);
        ctx.stroke();
      }
      for (let y = pipe.bottom + 12; y < h - 12; y += 30) {
        ctx.beginPath();
        const wobble = Math.cos(pulse * 2 + y * 0.1 + pipe.seed * Math.PI * 2) * 6;
        ctx.moveTo(pipe.x + 10 + wobble, y);
        ctx.lineTo(pipe.x + PIPE_WIDTH - 10 - wobble, y - 4);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(160, 120, 255, 0.2)';
      ctx.beginPath();
      ctx.ellipse(
        pipe.x + PIPE_WIDTH / 2,
        pipe.top + 12,
        PIPE_WIDTH * 0.65,
        26,
        0,
        0,
        Math.PI
      );
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(
        pipe.x + PIPE_WIDTH / 2,
        pipe.bottom - 12,
        PIPE_WIDTH * 0.65,
        26,
        0,
        Math.PI,
        0,
        true
      );
      ctx.fill();

      ctx.restore();
    },
    drawBird(ctx, pulse) {
      ctx.save();
      const wing = Math.sin(pulse * 11) * 14;

      ctx.fillStyle = 'rgba(90, 60, 140, 0.85)';
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.quadraticCurveTo(-42, -wing, -12, -10);
      ctx.quadraticCurveTo(-38, wing, -22, 0);
      ctx.fill();

      const body = ctx.createLinearGradient(-18, -28, 24, 26);
      body.addColorStop(0, 'rgba(40, 30, 70, 0.95)');
      body.addColorStop(1, 'rgba(18, 12, 36, 0.95)');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(220, 200, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(14, -4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(10, 8, 14, 0.9)';
      ctx.beginPath();
      ctx.arc(16, -4, 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(200, 140, 255, 0.7)';
      ctx.beginPath();
      ctx.moveTo(24, -2);
      ctx.lineTo(34, 0);
      ctx.lineTo(24, 2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(120, 80, 200, 0.75)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-8, 12);
      ctx.quadraticCurveTo(0, 22, 10, 12);
      ctx.stroke();

      ctx.restore();
    },
  },
];

const dynamicTheme = {
  currentHue: Math.random() * 360,
  startHue: 0,
  endHue: 0,
  progress: 0,
  duration: 8,
};

let lastAppliedHue = null;
let activeThemeId = null;

function wrapHue(value) {
  return ((value % 360) + 360) % 360;
}

function lerpHue(a, b, t) {
  const delta = ((b - a + 540) % 360) - 180;
  return wrapHue(a + delta * t);
}

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

function scheduleNextTheme(initial = false) {
  dynamicTheme.startHue = dynamicTheme.currentHue;
  const direction = initial ? 1 : Math.random() > 0.5 ? 1 : -1;
  const shift = initial ? 90 : 70 + Math.random() * 150;
  dynamicTheme.endHue = wrapHue(dynamicTheme.currentHue + direction * shift);
  dynamicTheme.progress = initial ? Math.random() * 0.5 : 0;
  dynamicTheme.duration = 6.5 + Math.random() * 5.5;
}

function applyGlobalHue() {
  const hue = dynamicTheme.currentHue;
  if (lastAppliedHue !== null && Math.abs(lastAppliedHue - hue) < 0.5) {
    return;
  }
  lastAppliedHue = hue;
  const root = document.documentElement;
  root.style.setProperty('--theme-hue', hue.toFixed(1));
  const body = document.body;
  const primaryHue = wrapHue(hue - 30);
  const secondaryHue = wrapHue(hue + 18);
  body.style.background = `radial-gradient(circle at 12% 18%, hsla(${primaryHue}, 85%, 28%, 0.45), transparent 52%), ` +
    `radial-gradient(circle at 86% 78%, hsla(${secondaryHue}, 80%, 30%, 0.4), transparent 55%), ` +
    `radial-gradient(circle at 45% 62%, hsla(${wrapHue(hue + 140)}, 82%, 32%, 0.35), transparent 58%), var(--bg)`;
}

function updateTheme(delta) {
  if (dynamicTheme.duration <= 0) {
    dynamicTheme.duration = 1;
  }
  dynamicTheme.progress = Math.min(dynamicTheme.progress + delta / dynamicTheme.duration, 1);
  const eased = easeInOut(dynamicTheme.progress);
  dynamicTheme.currentHue = lerpHue(dynamicTheme.startHue, dynamicTheme.endHue, eased);
  if (dynamicTheme.progress >= 1) {
    scheduleNextTheme();
  }
  applyGlobalHue();
}

function getThemeHue(offset = 0) {
  return wrapHue(dynamicTheme.currentHue + offset);
}

scheduleNextTheme(true);
updateTheme(0);

const STATE_IDLE = 'idle';
const STATE_RUNNING = 'running';
const STATE_GAMEOVER = 'gameover';

let state = STATE_IDLE;
let lastTime = 0;
let spawnTimer = 0;
let loopHandle = 0;
let bootAnimationTimeout = 0;
let loopStarted = false;
let score = 0;
let bestScore = Number(localStorage.getItem('flappy-dopamine-best')) || 0;
let pulse = 0;
let messageTimeout = 0;

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audio = {
  ctx: null,
  master: null,
  ambientGain: null,
  ambientVoices: [],
  profile: null,
  profileId: 'default',
  needsProfileRefresh: true,
};

const DEFAULT_AUDIO_PROFILE = {
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

syncThemeMetadata(true);

function cloneVoiceConfig(voice) {
  if (!voice) {
    return {};
  }
  const cloned = { ...voice };
  if (voice.filter) {
    cloned.filter = { ...voice.filter };
  }
  return cloned;
}

function getAudioProfile(theme) {
  const overrides = theme && theme.audioProfile ? theme.audioProfile : {};
  const ambientOverride = overrides.ambient || {};
  const ambient = {
    ...DEFAULT_AUDIO_PROFILE.ambient,
    ...ambientOverride,
  };
  ambient.levels = {
    ...DEFAULT_AUDIO_PROFILE.ambient.levels,
    ...(ambientOverride.levels || {}),
  };
  ambient.filter = {
    ...DEFAULT_AUDIO_PROFILE.ambient.filter,
    ...(ambientOverride.filter || {}),
  };
  const voicesSource = ambientOverride.voices && ambientOverride.voices.length
    ? ambientOverride.voices
    : DEFAULT_AUDIO_PROFILE.ambient.voices;
  ambient.voices = voicesSource.map((voice) => cloneVoiceConfig(voice));

  return {
    ambient,
    flap: { ...DEFAULT_AUDIO_PROFILE.flap, ...(overrides.flap || {}) },
    score: { ...DEFAULT_AUDIO_PROFILE.score, ...(overrides.score || {}) },
    gameover: { ...DEFAULT_AUDIO_PROFILE.gameover, ...(overrides.gameover || {}) },
  };
}

function getActiveAudioProfile() {
  if (!audio.profile) {
    audio.profile = getAudioProfile(getCurrentTheme());
  }
  return audio.profile || DEFAULT_AUDIO_PROFILE;
}

function ensureAudioContext() {
  if (!AudioContextClass) {
    return;
  }
  if (!audio.ctx) {
    audio.ctx = new AudioContextClass();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.3;
    audio.master.connect(audio.ctx.destination);
  } else if (audio.ctx.state === 'suspended') {
    audio.ctx.resume();
  }

  if (!audio.profile) {
    audio.profile = getAudioProfile(getCurrentTheme());
  }

  if (!audio.ambientGain || audio.needsProfileRefresh) {
    refreshAudioProfile(true);
  } else {
    updateAmbientState();
  }
}

function disposeAmbientPad() {
  if (!audio.ctx) {
    audio.ambientVoices = [];
    return;
  }
  const now = audio.ctx.currentTime;
  for (const voice of audio.ambientVoices) {
    if (voice.voiceGain) {
      voice.voiceGain.gain.setTargetAtTime(0.0001, now, 0.2);
    }
    if (voice.osc) {
      voice.osc.stop(now + 0.35);
    }
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
  audio.ambientVoices = [];
}

function createAmbientPad(ambientProfile) {
  if (!audio.ctx || !audio.master) {
    return;
  }
  if (!audio.ambientGain) {
    audio.ambientGain = audio.ctx.createGain();
    audio.ambientGain.gain.value = 0;
    audio.ambientGain.connect(audio.master);
  }

  disposeAmbientPad();

  const ctx = audio.ctx;
  const voices = ambientProfile.voices && ambientProfile.voices.length
    ? ambientProfile.voices
    : DEFAULT_AUDIO_PROFILE.ambient.voices;
  const voiceCount = voices.length || 1;

  audio.ambientVoices = [];

  voices.forEach((voiceConfig) => {
    const config = cloneVoiceConfig(voiceConfig);
    const osc = ctx.createOscillator();
    osc.type = config.type || ambientProfile.type || 'sawtooth';
    const baseFrequency = config.frequency !== undefined ? config.frequency : config.base || 220;
    osc.frequency.value = baseFrequency;
    if (config.detune !== undefined) {
      osc.detune.value = config.detune;
    }

    const filter = ctx.createBiquadFilter();
    const filterConfig = config.filter || ambientProfile.filter || DEFAULT_AUDIO_PROFILE.ambient.filter;
    filter.type = filterConfig.type || 'lowpass';
    filter.frequency.value = filterConfig.frequency !== undefined ? filterConfig.frequency : 560;
    filter.Q.value = filterConfig.q !== undefined ? filterConfig.q : 12;

    let sweepLfo = null;
    const sweepFrequency = config.sweepFrequency !== undefined ? config.sweepFrequency : config.sweep;
    if (sweepFrequency) {
      sweepLfo = ctx.createOscillator();
      sweepLfo.frequency.value = sweepFrequency;
      const sweepDepth = ctx.createGain();
      sweepDepth.gain.value = config.sweepDepth !== undefined ? config.sweepDepth : 160;
      sweepLfo.connect(sweepDepth);
      sweepDepth.connect(filter.frequency);
      sweepLfo.start();
    }

    let vibrato = null;
    const vibratoFrequency = config.vibratoFrequency !== undefined ? config.vibratoFrequency : config.vibrato;
    if (vibratoFrequency) {
      vibrato = ctx.createOscillator();
      const variance = config.vibratoVariance !== undefined ? config.vibratoVariance : 0.35;
      vibrato.frequency.value = vibratoFrequency + (Math.random() - 0.5) * variance;
      const vibratoDepth = ctx.createGain();
      vibratoDepth.gain.value = config.vibratoDepth !== undefined ? config.vibratoDepth : 6;
      vibrato.connect(vibratoDepth);
      vibratoDepth.connect(osc.frequency);
      vibrato.start();
    }

    let output = filter;
    let panLfo = null;
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      const panOffset = config.panOffset !== undefined ? config.panOffset : -0.6 + Math.random() * 1.2;
      panner.pan.value = panOffset;
      output.connect(panner);
      output = panner;

      const panDepth = config.panDepth !== undefined ? config.panDepth : ambientProfile.panDepth ?? 0.75;
      const panFrequency = config.panFrequency !== undefined
        ? config.panFrequency
        : ambientProfile.panFrequency ?? 0.03;
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
    const gainValue = config.gain !== undefined ? config.gain : ambientProfile.voiceGain ?? 0.24 / voiceCount;
    voiceGain.gain.value = gainValue;
    output.connect(voiceGain);
    voiceGain.connect(audio.ambientGain);

    osc.connect(filter);
    osc.start();

    audio.ambientVoices.push({
      osc,
      filter,
      voiceGain,
      sweepLfo,
      vibrato,
      panLfo,
    });
  });
}

function refreshAudioProfile(immediate = false) {
  if (!audio.ctx || !audio.master) {
    return;
  }
  if (!audio.profile) {
    audio.profile = getAudioProfile(getCurrentTheme());
  }
  createAmbientPad(audio.profile.ambient || DEFAULT_AUDIO_PROFILE.ambient);
  audio.needsProfileRefresh = false;
  updateAmbientState(immediate);
}

function setThemeAudio(theme, immediate = false) {
  audio.profile = getAudioProfile(theme);
  audio.profileId = theme && theme.id ? theme.id : 'default';
  audio.needsProfileRefresh = true;
  if (audio.ctx && audio.master) {
    refreshAudioProfile(immediate);
  }
}

function updateAmbientState(immediate = false) {
  if (!audio.ctx || !audio.ambientGain) {
    return;
  }
  const now = audio.ctx.currentTime;
  const profile = getActiveAudioProfile();
  const levels = profile.ambient.levels || DEFAULT_AUDIO_PROFILE.ambient.levels;
  const transition = profile.ambient.transitionTime ?? DEFAULT_AUDIO_PROFILE.ambient.transitionTime ?? 0.9;

  let target = levels.idle ?? 0.35;
  if (state === STATE_RUNNING) {
    target = levels.running ?? target;
  } else if (state === STATE_GAMEOVER) {
    target = levels.gameover ?? target;
  }

  audio.ambientGain.gain.cancelScheduledValues(now);
  if (immediate) {
    audio.ambientGain.gain.setValueAtTime(target, now);
  } else {
    audio.ambientGain.gain.setTargetAtTime(target, now, transition);
  }
}

function playFlapSfx() {
  if (!audio.ctx) {
    return;
  }
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const settings = getActiveAudioProfile().flap || DEFAULT_AUDIO_PROFILE.flap;

  const osc = ctx.createOscillator();
  osc.type = settings.type || 'triangle';
  const startFreq = settings.startFreq || 360;
  const peakFreq = settings.peakFreq || startFreq * 2.4;
  const endFreq = settings.endFreq || startFreq / 1.6;
  const peakTime = settings.peakTime ?? 0.08;
  const endTime = settings.endTime ?? settings.decay ?? 0.4;

  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(peakFreq, now + peakTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + endTime);

  const filter = ctx.createBiquadFilter();
  filter.type = settings.filterType || 'bandpass';
  filter.frequency.value = settings.filterFrequency || 720;
  filter.Q.value = settings.filterQ !== undefined ? settings.filterQ : 8;

  const gain = ctx.createGain();
  const attack = settings.attack ?? 0.02;
  const maxGain = settings.maxGain ?? 0.45;
  const decay = settings.decay ?? 0.4;

  gain.gain.setValueAtTime(settings.minGain ?? 0.0001, now);
  gain.gain.linearRampToValueAtTime(maxGain, now + attack);
  gain.gain.exponentialRampToValueAtTime(settings.endGain ?? 0.0001, now + decay);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);

  osc.start(now);
  osc.stop(now + Math.max(decay, 0.5));
}

function playScoreSfx() {
  if (!audio.ctx) {
    return;
  }
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const settings = getActiveAudioProfile().score || DEFAULT_AUDIO_PROFILE.score;

  const shimmer = ctx.createGain();
  shimmer.gain.value = settings.shimmerGain ?? 0.26;
  shimmer.connect(audio.master);

  const highs = ctx.createOscillator();
  highs.type = settings.highType || 'sine';
  highs.frequency.setValueAtTime(settings.highStart || 640, now);
  if (settings.highMid) {
    highs.frequency.linearRampToValueAtTime(settings.highMid, now + (settings.highMidTime ?? 0.12));
  }
  if (settings.highEnd) {
    highs.frequency.linearRampToValueAtTime(settings.highEnd, now + (settings.highEndTime ?? 0.22));
  }

  const lows = ctx.createOscillator();
  lows.type = settings.lowType || 'triangle';
  lows.frequency.setValueAtTime(settings.lowStart || 280, now);
  lows.frequency.linearRampToValueAtTime(settings.lowEnd || 420, now + (settings.lowEndTime ?? 0.18));

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

function playGameOverSfx() {
  if (!audio.ctx) {
    return;
  }
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const settings = getActiveAudioProfile().gameover || DEFAULT_AUDIO_PROFILE.gameover;

  const osc = ctx.createOscillator();
  osc.type = settings.type || 'sawtooth';
  const duration = settings.duration ?? Math.max(settings.release ?? 1.1, 1.1);
  osc.frequency.setValueAtTime(settings.startFreq || 520, now);
  osc.frequency.exponentialRampToValueAtTime(settings.endFreq || 140, now + duration);

  const filter = ctx.createBiquadFilter();
  filter.type = settings.filterType || 'lowpass';
  filter.frequency.setValueAtTime(settings.filterStart || 1400, now);
  filter.frequency.exponentialRampToValueAtTime(settings.filterEnd || 220, now + duration);

  const gain = ctx.createGain();
  const attack = settings.attack ?? 0.04;
  const maxGain = settings.maxGain ?? 0.55;
  const release = settings.release ?? duration;

  gain.gain.setValueAtTime(settings.minGain ?? 0.0001, now);
  gain.gain.linearRampToValueAtTime(maxGain, now + attack);
  gain.gain.exponentialRampToValueAtTime(settings.endGain ?? 0.0001, now + release);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);

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
    noiseGain.connect(audio.master);
    noise.start(now);
    noise.stop(now + noiseDuration);
  }

  osc.start(now);
  osc.stop(now + duration);
}

function loadLeaderboardEntries() {
  if (!window.localStorage) {
    return [];
  }
  try {
    const stored = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((entry) => entry && Number.isFinite(Number(entry.score)))
      .map((entry) => ({
        score: Number(entry.score),
        timestamp: Number(entry.timestamp) || Date.now(),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, LEADERBOARD_SIZE);
  } catch (error) {
    console.warn('Unable to load leaderboard data', error);
    return [];
  }
}

function saveLeaderboardEntries(entries) {
  if (!window.localStorage) {
    return;
  }
  try {
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('Unable to save leaderboard data', error);
  }
}

function formatLeaderboardDate(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('fr-FR', {
    month: 'short',
    day: 'numeric',
  });
}

function renderLeaderboard() {
  if (!leaderboardList) {
    return;
  }
  if (!leaderboardEntries.length) {
    leaderboardList.innerHTML = '<li class="leaderboard-empty">Joue pour entrer dans le classement</li>';
    return;
  }

  const fragment = document.createDocumentFragment();
  leaderboardEntries.forEach((entry) => {
    const item = document.createElement('li');
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'leaderboard-score';
    scoreSpan.textContent = `${entry.score}`;
    item.appendChild(scoreSpan);

    const dateSpan = document.createElement('span');
    dateSpan.className = 'leaderboard-date';
    dateSpan.textContent = formatLeaderboardDate(entry.timestamp);
    item.appendChild(dateSpan);

    fragment.appendChild(item);
  });
  leaderboardList.innerHTML = '';
  leaderboardList.appendChild(fragment);
}

function recordLeaderboardScore(value) {
  if (!value || !Number.isFinite(value)) {
    return;
  }
  const score = Math.max(0, Math.floor(value));
  if (score <= 0) {
    return;
  }
  const existingIndex = leaderboardEntries.findIndex((entry) => entry.score === score);
  const entry = { score, timestamp: Date.now() };
  if (existingIndex !== -1) {
    leaderboardEntries.splice(existingIndex, 1, entry);
  } else {
    leaderboardEntries.push(entry);
  }
  leaderboardEntries.sort((a, b) => b.score - a.score);
  leaderboardEntries = leaderboardEntries.slice(0, LEADERBOARD_SIZE);
  saveLeaderboardEntries(leaderboardEntries);
  renderLeaderboard();
}

function setLeaderboardCollapsed(collapsed, { manual = false } = {}) {
  if (!leaderboard) {
    return;
  }
  leaderboard.classList.toggle('collapsed', collapsed);
  if (manual) {
    leaderboardToggledManually = true;
  }
  const expanded = !leaderboard.classList.contains('collapsed');
  const expandedValue = String(expanded);
  leaderboard.setAttribute('aria-expanded', expandedValue);
  if (leaderboardToggle) {
    leaderboardToggle.setAttribute('aria-expanded', expandedValue);
  }
  if (leaderboardPanel) {
    leaderboardPanel.hidden = !expanded;
    leaderboardPanel.setAttribute('aria-hidden', String(!expanded));
  }
}

const desktopLeaderboardMedia = window.matchMedia('(min-width: 1100px)');

function syncLeaderboardForViewport({ force = false } = {}) {
  if (!leaderboard) {
    return;
  }
  if (desktopLeaderboardMedia.matches && (force || !leaderboardToggledManually)) {
    setLeaderboardCollapsed(false, { manual: false });
  } else if (!desktopLeaderboardMedia.matches && (force || !leaderboardToggledManually)) {
    setLeaderboardCollapsed(true, { manual: false });
  } else {
    setLeaderboardCollapsed(leaderboard.classList.contains('collapsed'));
  }
}

if (typeof desktopLeaderboardMedia.addEventListener === 'function') {
  desktopLeaderboardMedia.addEventListener('change', () => syncLeaderboardForViewport());
} else if (typeof desktopLeaderboardMedia.addListener === 'function') {
  desktopLeaderboardMedia.addListener(() => syncLeaderboardForViewport());
}

function updateThemeLabel(theme) {
  if (!themeLabel) {
    return;
  }

function syncThemeMetadata(force = false) {
  const theme = getCurrentTheme();
  const themeId = theme ? theme.id : 'default';
  if (force || themeId !== activeThemeId) {
    activeThemeId = themeId;
    updateThemeLabel(theme);
    setThemeAudio(theme, force);
  }
}

const bird = {
  y: 0,
  velocity: 0,
  rotation: 0,
};

const pipes = [];
const particles = [];
const textFragments = [];

leaderboardEntries = loadLeaderboardEntries();
renderLeaderboard();
setLeaderboardCollapsed(leaderboard ? leaderboard.classList.contains('collapsed') : true);
syncLeaderboardForViewport({ force: true });

if (leaderboardToggle && leaderboard) {
  leaderboardToggle.addEventListener('click', () => {
    const currentlyCollapsed = leaderboard.classList.contains('collapsed');
    setLeaderboardCollapsed(!currentlyCollapsed, { manual: true });
  });
}

bestNode.textContent = bestScore;

function hideShareButton() {
  shareBtn.style.display = 'none';
}

function showShareButton() {
  shareBtn.style.display = 'block';
}

function getEvolutionStage() {
  const stage = Math.floor(score / 3);
  return THEMES.length > 0 ? stage % THEMES.length : 0;
}

function getCurrentTheme() {
  return THEMES[getEvolutionStage()] || THEMES[0];
}
function resize() {
  const cssWidth = canvas.clientWidth || 640;
  const cssHeight = canvas.clientHeight || 480;
  width = cssWidth;
  height = cssHeight;
  const displayWidth = Math.round(cssWidth * DPR);
  const displayHeight = Math.round(cssHeight * DPR);
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(DPR, DPR);
}

function resetGame() {
  score = 0;
  scoreNode.textContent = score;
  pipes.length = 0;
  particles.length = 0;
  textFragments.length = 0;
  bird.y = height / 2;
  bird.velocity = 0;
  bird.rotation = 0;
  spawnTimer = 0;
  pulse = 0;
  hideShareButton();
  syncThemeMetadata(true);
}

function startGame() {
  state = STATE_RUNNING;
  startBtn.textContent = 'Rejouer';
  resetGame();
  triggerStartMessage();
  updateAmbientState();
}

function endGame() {
  if (state !== STATE_RUNNING) {
    return;
  }
  state = STATE_GAMEOVER;
  startBtn.textContent = 'Rejouer';
  playGameOverSfx();
  createTextExplosion('Perdu !', width / 2, height / 2 - 90, {
    font: '700 54px "Montserrat", sans-serif',
    spread: 320,
    gravity: 980,
  });
  createTextExplosion(`Score ${score}`, width / 2, height / 2 + 10, {
    font: '600 30px "Montserrat", sans-serif',
    spread: 220,
    gravity: 900,
  });
  if (score > bestScore) {
    bestScore = score;
    bestNode.textContent = bestScore;
    localStorage.setItem('flappy-dopamine-best', bestScore);
  }
  recordLeaderboardScore(score);
  showShareButton();
  updateAmbientState();
}

function flap() {
  if (state === STATE_IDLE) {
    startGame();
  }
  if (state === STATE_RUNNING) {
    bird.velocity = FLAP_VELOCITY;
    createBurst();
    playFlapSfx();
  }
  if (state === STATE_GAMEOVER) {
    startGame();
  }
}

function triggerStartMessage() {
  if (!startMessage) {
    return;
  }

  startMessage.classList.remove('visible');
  startMessage.querySelectorAll('.sparkle').forEach((node) => node.remove());

  // Force reflow so the animation restarts even if the class was already applied.
  startMessage.getBoundingClientRect();

  const sparkleCount = 12;
  for (let i = 0; i < sparkleCount; i += 1) {
    const sparkle = document.createElement('span');
    sparkle.className = 'sparkle';
    sparkle.style.setProperty('--dx', `${(Math.random() - 0.5) * 220}px`);
    sparkle.style.setProperty('--dy', `${(Math.random() - 0.5) * 160}px`);
    sparkle.style.setProperty('--delay', `${Math.random() * 0.25}s`);
    sparkle.style.setProperty('--hue', `${Math.floor(Math.random() * 240) + 40}`);
    startMessage.appendChild(sparkle);
    setTimeout(() => {
      sparkle.remove();
    }, 1200);
  }

  startMessage.classList.add('visible');

  if (messageTimeout) {
    clearTimeout(messageTimeout);
  }
  messageTimeout = setTimeout(() => {
    startMessage.classList.remove('visible');
    startMessage.querySelectorAll('.sparkle').forEach((node) => node.remove());
  }, 1900);
}

function createBurst() {
  const theme = getCurrentTheme();
  for (let i = 0; i < 8; i += 1) {
    const fallbackHue = getThemeHue(Math.sin(pulse * 2 + i) * 18 + i * 14);
    const hue = theme && theme.particleHue ? theme.particleHue(pulse, i) : fallbackHue;
    const saturation = theme && theme.particleSaturation !== undefined ? theme.particleSaturation : 90;
    const lightness = theme && theme.particleLightness !== undefined ? theme.particleLightness : 60;
    particles.push({
      x: BIRD_X,
      y: bird.y,
      vx: (Math.random() * 220 + 60) * (Math.random() > 0.5 ? 1 : -1),
      vy: Math.random() * -200 - 120,
      life: Math.random() * 0.4 + 0.3,
      radius: Math.random() * 6 + 4,
      hue,
      saturation,
      lightness,
    });
  }
}

function spawnPipe() {
  const margin = 120;
  const gapCenter = Math.random() * (height - PIPE_GAP - margin * 2) + margin + PIPE_GAP / 2;
  pipes.push({
    x: width + PIPE_WIDTH,
    top: gapCenter - PIPE_GAP / 2,
    bottom: gapCenter + PIPE_GAP / 2,
    passed: false,
    seed: Math.random(),
    hue: getThemeHue(Math.random() * 60 - 30 + Math.sin(pulse * 0.8) * 20),
  });
}

function update(delta) {
  syncThemeMetadata();
  updateTheme(delta);
  pulse += delta;
  spawnTimer += delta;

  if (state === STATE_RUNNING) {
    if (spawnTimer >= PIPE_FREQUENCY) {
      spawnPipe();
      spawnTimer = 0;
    }

    bird.velocity = Math.min(bird.velocity + GRAVITY * delta, MAX_DROP_SPEED);
    bird.y += bird.velocity * delta;
    bird.rotation = Math.atan2(bird.velocity, 600);

    for (let i = pipes.length - 1; i >= 0; i -= 1) {
      const pipe = pipes[i];
      pipe.x -= delta * 260;
      if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
        pipe.passed = true;
        score += 1;
        scoreNode.textContent = score;
        playScoreSfx();
      }
      if (pipe.x + PIPE_WIDTH < -50) {
        pipes.splice(i, 1);
      }
    }

    if (bird.y < 0 || bird.y > height) {
      endGame();
    }

    for (const pipe of pipes) {
      if (
        BIRD_X + 32 > pipe.x &&
        BIRD_X - 32 < pipe.x + PIPE_WIDTH &&
        (bird.y - 24 < pipe.top || bird.y + 24 > pipe.bottom)
      ) {
        endGame();
        break;
      }
    }
  } else if (state === STATE_IDLE) {
    bird.y = height / 2 + Math.sin(pulse * 2) * 20;
    bird.rotation = Math.sin(pulse * 3) * 0.3;
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life -= delta;
    if (particle.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 500 * delta;
  }

  updateTextFragments(delta);
}

function drawBackground() {
  const theme = getCurrentTheme();
  let usedCustom = false;
  if (theme && typeof theme.drawBackground === 'function') {
    theme.drawBackground(ctx, pulse, width, height);
    usedCustom = true;
  } else if (THEMES[0] && typeof THEMES[0].drawBackground === 'function') {
    THEMES[0].drawBackground(ctx, pulse, width, height);
    usedCustom = true;
  } else {
    drawDynamicBackgroundLayer(ctx, pulse, width, height, 1);
    return;
  }
  drawDynamicBackgroundLayer(ctx, pulse, width, height, usedCustom ? 0.2 : 1);
}

function drawDynamicBackgroundLayer(context, currentPulse, w, h, alpha = 1) {
  context.save();
  context.globalAlpha = alpha;
  const time = currentPulse * 0.8;
  const gradient = context.createLinearGradient(0, 0, w, h);
  const topHue = getThemeHue(Math.sin(currentPulse * 0.35) * 12);
  const midHue = getThemeHue(90 + Math.cos(currentPulse * 0.28) * 18);
  const bottomHue = getThemeHue(180 + Math.sin(currentPulse * 0.32) * 22);
  gradient.addColorStop(0, `hsl(${topHue}, 85%, 55%)`);
  gradient.addColorStop(0.5, `hsl(${midHue}, 80%, 45%)`);
  gradient.addColorStop(1, `hsl(${bottomHue}, 90%, 35%)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, w, h);

  const layers = 6;
  for (let i = 0; i < layers; i += 1) {
    context.beginPath();
    const amplitude = 40 + i * 14;
    const frequency = 0.006 + i * 0.002;
    const speed = 0.6 + i * 0.25;
    const offset = Math.sin(time * speed + i * 0.8) * 100;
    const hue = getThemeHue(i * 26 + Math.sin(currentPulse * 0.9 + i) * 22);
    context.strokeStyle = `hsla(${hue}, 90%, 65%, ${0.08 + i * 0.06})`;
    context.lineWidth = 8;

    context.moveTo(-100, h / 2);
    for (let x = -100; x <= w + 100; x += 18) {
      const y = h / 2 + Math.sin(x * frequency + time * speed) * amplitude + offset;
      context.lineTo(x, y);
    }
    context.stroke();
  }
  context.restore();
}

function drawPipes() {
  const theme = getCurrentTheme();
  ctx.save();
  for (const pipe of pipes) {
    let drawn = false;
    if (theme && typeof theme.drawPipe === 'function') {
      theme.drawPipe(ctx, pipe, height, pulse);
      drawn = true;
    } else if (THEMES[0] && typeof THEMES[0].drawPipe === 'function') {
      THEMES[0].drawPipe(ctx, pipe, height, pulse);
      drawn = true;
    }
    if (!drawn) {
      drawDynamicPipe(ctx, pipe, height, 1);
    } else {
      drawDynamicPipe(ctx, pipe, height, 0.22);
    }
  }
  ctx.restore();
}

function drawDynamicPipe(context, pipe, h, alpha = 1) {
  context.save();
  context.globalAlpha = alpha;
  const baseHue = pipe.hue !== undefined ? pipe.hue : getThemeHue();
  const topGradient = context.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, pipe.top);
  topGradient.addColorStop(0, `hsla(${baseHue}, 80%, 70%, 0.95)`);
  topGradient.addColorStop(1, `hsla(${wrapHue(baseHue + 60)}, 80%, 40%, 0.95)`);
  context.fillStyle = topGradient;
  context.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);

  const bottomGradient = context.createLinearGradient(pipe.x, pipe.bottom, pipe.x + PIPE_WIDTH, h);
  bottomGradient.addColorStop(0, `hsla(${wrapHue(baseHue + 60)}, 90%, 50%, 0.95)`);
  bottomGradient.addColorStop(1, `hsla(${wrapHue(baseHue + 180)}, 90%, 35%, 0.95)`);
  context.fillStyle = bottomGradient;
  context.fillRect(pipe.x, pipe.bottom, PIPE_WIDTH, h - pipe.bottom);

  context.fillStyle = `hsla(${baseHue}, 90%, 65%, 0.2)`;
  context.fillRect(pipe.x - 12, 0, 12, h);

  context.restore();
}

function drawBird() {
  ctx.save();
  ctx.translate(BIRD_X, bird.y);
  ctx.rotate(bird.rotation);
  const theme = getCurrentTheme();
  let drawn = false;
  if (theme && typeof theme.drawBird === 'function') {
    theme.drawBird(ctx, pulse);
    drawn = true;
  } else if (THEMES[0] && typeof THEMES[0].drawBird === 'function') {
    THEMES[0].drawBird(ctx, pulse);
    drawn = true;
  }
  drawDynamicBird(ctx, pulse, drawn ? 0.28 : 1);

  ctx.restore();
}

function drawDynamicBird(context, currentPulse, alpha = 1) {
  context.save();
  context.globalAlpha = alpha;
  const bodyRadius = 24;
  const hue = getThemeHue(Math.sin(currentPulse * 1.2) * 18);
  const wingHue = getThemeHue(200 + Math.cos(currentPulse * 0.9) * 12);
  const beakHue = getThemeHue(40 + Math.sin(currentPulse * 1.4) * 10);
  const highlightHue = getThemeHue(120 + Math.sin(currentPulse * 0.6) * 10);
  const radial = context.createRadialGradient(0, -8, 6, 0, 0, bodyRadius);
  radial.addColorStop(0, `hsla(${hue}, 90%, 75%, 0.95)`);
  radial.addColorStop(1, `hsla(${highlightHue}, 85%, 50%, 0.95)`);

  context.fillStyle = radial;
  context.beginPath();
  context.ellipse(0, 0, bodyRadius, bodyRadius * 0.82, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = `hsla(${wingHue}, 80%, 65%, 0.85)`;
  context.beginPath();
  context.ellipse(-bodyRadius * 0.4, -10, bodyRadius * 0.8, bodyRadius * 0.5, 0.6, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = `hsla(${beakHue}, 90%, 65%, 0.9)`;
  context.beginPath();
  context.moveTo(bodyRadius * 0.8, -6);
  context.quadraticCurveTo(bodyRadius * 1.4, 0, bodyRadius * 0.8, 8);
  context.quadraticCurveTo(bodyRadius * 0.9, 0, bodyRadius * 0.8, -6);
  context.fill();

  context.fillStyle = 'rgba(255, 255, 255, 0.85)';
  context.beginPath();
  context.arc(bodyRadius * 0.2, -10, 8, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(30, 30, 30, 0.9)';
  context.beginPath();
  context.arc(bodyRadius * 0.5, -10, 3, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const particle of particles) {
    const alpha = Math.max(particle.life, 0);
    const saturation = particle.saturation !== undefined ? particle.saturation : 90;
    const lightness = particle.lightness !== undefined ? particle.lightness : 60;
    ctx.fillStyle = `hsla(${particle.hue}, ${saturation}%, ${lightness}%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawOverlay() {
  if (state === STATE_RUNNING) {
    return;
  }
  ctx.save();
  ctx.fillStyle = 'rgba(10, 10, 15, 0.32)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (state === STATE_IDLE) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.font = '700 48px "Montserrat", sans-serif';
    ctx.fillText('Tap to fly', width / 2, height / 2 - 60);
    ctx.font = '400 22px "Montserrat", sans-serif';
    ctx.fillText('Dodge the vibrant portals', width / 2, height / 2 - 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '400 18px "Montserrat", sans-serif';
    ctx.fillText('Space, click or tap', width / 2, height / 2 + 64);
  } else if (state === STATE_GAMEOVER) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '600 26px "Montserrat", sans-serif';
    ctx.fillText('Score: ' + score, width / 2, height / 2 + 40);
    ctx.fillText('Record: ' + bestScore, width / 2, height / 2 + 80);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '400 20px "Montserrat", sans-serif';
    ctx.fillText('Tap to restart', width / 2, height / 2 + 126);
  }
  ctx.restore();
}

function drawTextFragments() {
  if (!textFragments.length) {
    return;
  }
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const fragment of textFragments) {
    ctx.save();
    ctx.translate(fragment.x, fragment.y);
    ctx.rotate(fragment.rotation);
    ctx.font = fragment.font;
    const alpha = Math.max(fragment.life, 0);
    ctx.fillStyle = `hsla(${fragment.hue}, 95%, 72%, ${alpha})`;
    ctx.fillText(fragment.char, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function updateTextFragments(delta) {
  if (!textFragments.length) {
    return;
  }
  for (let i = textFragments.length - 1; i >= 0; i -= 1) {
    const fragment = textFragments[i];
    fragment.vx *= 0.99;
    fragment.vy += (fragment.gravity || 900) * delta;
    fragment.x += fragment.vx * delta;
    fragment.y += fragment.vy * delta;
    fragment.rotation += fragment.spin * delta;
    fragment.life -= delta * (fragment.decay || 1);
    if (fragment.life <= 0) {
      textFragments.splice(i, 1);
    }
  }
}

function createTextExplosion(text, centerX, centerY, options = {}) {
  if (!text) {
    return;
  }
  const { font = '700 48px "Montserrat", sans-serif', spread = 260, gravity = 860 } = options;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = font;
  const totalWidth = ctx.measureText(text).width;
  let cursorX = centerX - totalWidth / 2;
  for (const char of text) {
    const charWidth = ctx.measureText(char).width || 20;
    if (char === ' ') {
      cursorX += charWidth;
      continue;
    }
    textFragments.push({
      char,
      font,
      x: cursorX + charWidth / 2,
      y: centerY,
      vx: (Math.random() - 0.5) * spread,
      vy: (Math.random() - 1.05) * (spread * 0.6),
      spin: (Math.random() - 0.5) * 6,
      rotation: (Math.random() - 0.5) * 0.8,
      life: 1,
      decay: 0.85 + Math.random() * 0.5,
      hue: (pulse * 140 + Math.random() * 120) % 360,
      gravity,
    });
    cursorX += charWidth;
  }
  ctx.restore();
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(DPR, DPR);
  ctx.clearRect(0, 0, width, height);
  drawBackground();
  drawPipes();
  drawParticles();
  drawBird();
  drawOverlay();
  drawTextFragments();
}

function loop(timestamp) {
  if (!lastTime) {
    lastTime = timestamp;
  }
  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  update(delta);
  draw();
  loopHandle = requestAnimationFrame(loop);
}

function startLoop() {
  if (loopStarted) {
    return;
  }
  loopStarted = true;
  lastTime = 0;
  loopHandle = requestAnimationFrame(loop);
}

function finalizeBoot() {
  if (loopStarted) {
    return;
  }
  if (bootAnimationTimeout) {
    clearTimeout(bootAnimationTimeout);
    bootAnimationTimeout = 0;
  }
  document.body.classList.remove('booting');
  wrapper?.classList.remove('camera-boot');
  startLoop();
}

function runBootSequence() {
  const prefersReducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  if (!wrapper || prefersReducedMotion) {
    finalizeBoot();
    return;
  }

  document.body.classList.add('booting');
  wrapper.classList.add('camera-boot');

  const handleAnimationEnd = () => {
    wrapper.removeEventListener('animationend', handleAnimationEnd);
    finalizeBoot();
  };

  wrapper.addEventListener('animationend', handleAnimationEnd);

  bootAnimationTimeout = window.setTimeout(() => {
    wrapper.removeEventListener('animationend', handleAnimationEnd);
    finalizeBoot();
  }, 2200);
}

function handlePress(event) {
  if (event) {
    event.preventDefault();
  }
  ensureAudioContext();
  flap();
}

window.addEventListener('resize', resize);

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.code === 'ArrowUp') {
    handlePress(event);
  }
});

if (window.PointerEvent) {
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', handlePress);
} else {
  canvas.addEventListener('mousedown', handlePress);
  canvas.addEventListener('touchstart', handlePress, { passive: false });
}
startBtn.addEventListener('click', handlePress);

shareBtn.addEventListener('click', () => {
  if (state !== STATE_GAMEOVER) {
    return;
  }
  const pointsLabel = score > 1 ? 'points' : 'point';
  const tweetText = `I just scored ${score} ${pointsLabel} in Flappy Dopamine! Come vibe with me ✨`;
  const tweetUrl = new URL('https://twitter.com/intent/tweet');
  tweetUrl.searchParams.set('text', tweetText);
  tweetUrl.searchParams.set('hashtags', 'FlappyDopamine');
  if (window.location.protocol.startsWith('http')) {
    tweetUrl.searchParams.set('url', window.location.href);
  }
  window.open(tweetUrl.toString(), '_blank', 'noopener');
});

resize();
resetGame();
draw();
runBootSequence();
