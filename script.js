const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start');
const shareBtn = document.getElementById('share');
const scoreNode = document.getElementById('score');
const bestNode = document.getElementById('best');
const wrapper = document.querySelector('.wrapper');
const startMessage = document.getElementById('start-message');

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

const THEMES = [
  {
    id: 'neon',
    particleSaturation: 90,
    particleLightness: 60,
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
    id: 'cyber',
    particleSaturation: 70,
    particleLightness: 55,
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
    particleSaturation: 70,
    particleLightness: 50,
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
    particleSaturation: 80,
    particleLightness: 70,
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
];

const dynamicTheme = {
  currentHue: Math.random() * 360,
  startHue: 0,
  endHue: 0,
  progress: 0,
  duration: 8,
};

let lastAppliedHue = null;

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
};

function ensureAudioContext() {
  if (!AudioContextClass) {
    return;
  }
  if (!audio.ctx) {
    audio.ctx = new AudioContextClass();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.3;
    audio.master.connect(audio.ctx.destination);
    createAmbientPad();
    updateAmbientState(true);
  } else if (audio.ctx.state === 'suspended') {
    audio.ctx.resume();
  }
  updateAmbientState();
}

function createAmbientPad() {
  if (!audio.ctx || audio.ambientGain) {
    return;
  }
  const ctx = audio.ctx;
  const ambientGain = ctx.createGain();
  ambientGain.gain.value = 0;
  ambientGain.connect(audio.master);
  audio.ambientGain = ambientGain;

  const voices = [
    { base: 96, detune: -14, sweep: 0.05, vibrato: 0.6 },
    { base: 162, detune: 9, sweep: 0.035, vibrato: 0.4 },
    { base: 224, detune: 16, sweep: 0.045, vibrato: 0.7 },
  ];

  for (const voice of voices) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = voice.base;
    osc.detune.value = voice.detune;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 560;
    filter.Q.value = 12;

    const sweepLfo = ctx.createOscillator();
    sweepLfo.frequency.value = voice.sweep;
    const sweepDepth = ctx.createGain();
    sweepDepth.gain.value = 180;
    sweepLfo.connect(sweepDepth);
    sweepDepth.connect(filter.frequency);

    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 0.8 + Math.random() * 0.6;
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.value = voice.vibrato * 12;
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(osc.frequency);

    let output = filter;
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = -0.6 + Math.random() * 1.2;
      output.connect(panner);
      output = panner;
      const panLfo = ctx.createOscillator();
      panLfo.frequency.value = 0.02 + Math.random() * 0.03;
      const panDepth = ctx.createGain();
      panDepth.gain.value = 0.75;
      panLfo.connect(panDepth);
      panDepth.connect(panner.pan);
      panLfo.start();
    }

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0.22 / voices.length;
    output.connect(voiceGain);
    voiceGain.connect(ambientGain);

    osc.connect(filter);
    osc.start();
    sweepLfo.start();
    vibrato.start();
  }
}

function updateAmbientState(immediate = false) {
  if (!audio.ctx || !audio.ambientGain) {
    return;
  }
  const now = audio.ctx.currentTime;
  let target = 0.35;
  if (state === STATE_RUNNING) {
    target = 0.85;
  } else if (state === STATE_GAMEOVER) {
    target = 0.2;
  }
  audio.ambientGain.gain.cancelScheduledValues(now);
  if (immediate) {
    audio.ambientGain.gain.setValueAtTime(target, now);
  } else {
    audio.ambientGain.gain.setTargetAtTime(target, now, 0.9);
  }
}

function playFlapSfx() {
  if (!audio.ctx) {
    return;
  }
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(360, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.34);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 720;
  filter.Q.value = 8;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.45, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);

  osc.start(now);
  osc.stop(now + 0.5);
}

function playScoreSfx() {
  if (!audio.ctx) {
    return;
  }
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const shimmer = ctx.createGain();
  shimmer.gain.value = 0.26;
  shimmer.connect(audio.master);

  const highs = ctx.createOscillator();
  highs.type = 'sine';
  highs.frequency.setValueAtTime(640, now);
  highs.frequency.linearRampToValueAtTime(960, now + 0.12);
  highs.frequency.linearRampToValueAtTime(1280, now + 0.22);

  const lows = ctx.createOscillator();
  lows.type = 'triangle';
  lows.frequency.setValueAtTime(280, now);
  lows.frequency.linearRampToValueAtTime(420, now + 0.18);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.5, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

  const delay = ctx.createDelay();
  delay.delayTime.value = 0.24;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.3;
  delay.connect(feedback);
  feedback.connect(delay);

  highs.connect(gain);
  lows.connect(gain);
  gain.connect(shimmer);
  gain.connect(delay);
  delay.connect(shimmer);

  highs.start(now);
  highs.stop(now + 0.5);
  lows.start(now);
  lows.stop(now + 0.5);
}

function playGameOverSfx() {
  if (!audio.ctx) {
    return;
  }
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(140, now + 0.9);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, now);
  filter.frequency.exponentialRampToValueAtTime(220, now + 0.9);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.55, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = (Math.random() * 2 - 1) * (1 - i / channel.length);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.linearRampToValueAtTime(0.4, now + 0.02);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  noise.connect(noiseGain);
  noiseGain.connect(audio.master);

  osc.start(now);
  osc.stop(now + 1.2);
  noise.start(now);
  noise.stop(now + 0.6);
}

const bird = {
  y: 0,
  velocity: 0,
  rotation: 0,
};

const pipes = [];
const particles = [];
const textFragments = [];

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

canvas.addEventListener('pointerdown', handlePress);
canvas.addEventListener('touchstart', handlePress, { passive: false });
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
