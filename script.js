const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start');
const scoreNode = document.getElementById('score');
const bestNode = document.getElementById('best');

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

const STATE_IDLE = 'idle';
const STATE_RUNNING = 'running';
const STATE_GAMEOVER = 'gameover';

let state = STATE_IDLE;
let lastTime = 0;
let spawnTimer = 0;
let loopHandle = 0;
let score = 0;
let bestScore = Number(localStorage.getItem('flappy-dopamine-best')) || 0;
let pulse = 0;

const theme = {
  currentHue: Math.random() * 360,
  startHue: 0,
  endHue: 0,
  progress: 0,
  duration: 8,
};

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
  theme.startHue = theme.currentHue;
  const direction = initial ? 1 : (Math.random() > 0.5 ? 1 : -1);
  const shift = initial ? 90 : 70 + Math.random() * 150;
  theme.endHue = wrapHue(theme.currentHue + direction * shift);
  theme.progress = initial ? Math.random() * 0.5 : 0;
  theme.duration = 6.5 + Math.random() * 5.5;
}

function updateTheme(delta) {
  if (theme.duration <= 0) {
    theme.duration = 1;
  }
  theme.progress = Math.min(theme.progress + delta / theme.duration, 1);
  const eased = easeInOut(theme.progress);
  theme.currentHue = lerpHue(theme.startHue, theme.endHue, eased);
  if (theme.progress >= 1) {
    scheduleNextTheme();
  }
}

function getThemeHue(offset = 0) {
  return wrapHue(theme.currentHue + offset);
}

scheduleNextTheme(true);
updateTheme(0);

const bird = {
  y: 0,
  velocity: 0,
  rotation: 0,
};

const pipes = [];
const particles = [];

bestNode.textContent = bestScore;

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
  bird.y = height / 2;
  bird.velocity = 0;
  bird.rotation = 0;
  spawnTimer = 0;
  pulse = 0;
}

function startGame() {
  state = STATE_RUNNING;
  startBtn.textContent = 'Rejouer';
  resetGame();
}

function endGame() {
  state = STATE_GAMEOVER;
  startBtn.textContent = 'Rejouer';
  if (score > bestScore) {
    bestScore = score;
    bestNode.textContent = bestScore;
    localStorage.setItem('flappy-dopamine-best', bestScore);
  }
}

function flap() {
  if (state === STATE_IDLE) {
    startGame();
  }
  if (state === STATE_RUNNING) {
    bird.velocity = FLAP_VELOCITY;
    createBurst();
  }
  if (state === STATE_GAMEOVER) {
    startGame();
  }
}

function createBurst() {
  for (let i = 0; i < 8; i += 1) {
    particles.push({
      x: BIRD_X,
      y: bird.y,
      vx: (Math.random() * 220 + 60) * (Math.random() > 0.5 ? 1 : -1),
      vy: Math.random() * -200 - 120,
      life: Math.random() * 0.4 + 0.3,
      radius: Math.random() * 6 + 4,
      hue: getThemeHue(Math.sin(pulse * 2 + i) * 18 + i * 14),
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
}

function drawBackground() {
  ctx.save();
  const time = pulse * 0.8;
  const w = width;
  const h = height;

  const gradient = ctx.createLinearGradient(0, 0, w, h);
  const topHue = getThemeHue(Math.sin(pulse * 0.35) * 12);
  const midHue = getThemeHue(90 + Math.cos(pulse * 0.28) * 18);
  const bottomHue = getThemeHue(180 + Math.sin(pulse * 0.32) * 22);
  gradient.addColorStop(0, `hsl(${topHue}, 85%, 55%)`);
  gradient.addColorStop(0.5, `hsl(${midHue}, 80%, 45%)`);
  gradient.addColorStop(1, `hsl(${bottomHue}, 90%, 35%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const layers = 6;
  for (let i = 0; i < layers; i += 1) {
    ctx.beginPath();
    const amplitude = 40 + i * 14;
    const frequency = 0.006 + i * 0.002;
    const speed = 0.6 + i * 0.25;
    const offset = Math.sin(time * speed + i * 0.8) * 100;
    const hue = getThemeHue(i * 26 + Math.sin(pulse * 0.9 + i) * 22);
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
}

function drawPipes() {
  ctx.save();
  ctx.translate(0, 0);
  for (const pipe of pipes) {
    const gradientTop = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, pipe.top);
    gradientTop.addColorStop(0, `hsla(${pipe.hue}, 80%, 70%, 0.95)`);
    gradientTop.addColorStop(1, `hsla(${(pipe.hue + 60) % 360}, 80%, 40%, 0.95)`);
    ctx.fillStyle = gradientTop;
    ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);

    const gradientBottom = ctx.createLinearGradient(pipe.x, pipe.bottom, pipe.x + PIPE_WIDTH, height);
    gradientBottom.addColorStop(0, `hsla(${(pipe.hue + 60) % 360}, 90%, 50%, 0.95)`);
    gradientBottom.addColorStop(1, `hsla(${(pipe.hue + 180) % 360}, 90%, 35%, 0.95)`);
    ctx.fillStyle = gradientBottom;
    ctx.fillRect(pipe.x, pipe.bottom, PIPE_WIDTH, height - pipe.bottom);

    ctx.fillStyle = `hsla(${pipe.hue}, 90%, 65%, 0.25)`;
    ctx.fillRect(pipe.x - 12, 0, 12, height);
  }
  ctx.restore();
}

function drawBird() {
  ctx.save();
  ctx.translate(BIRD_X, bird.y);
  ctx.rotate(bird.rotation);

  const bodyRadius = 24;
  const hue = getThemeHue(Math.sin(pulse * 1.2) * 18);
  const wingHue = getThemeHue(200 + Math.cos(pulse * 0.9) * 12);
  const beakHue = getThemeHue(40 + Math.sin(pulse * 1.4) * 10);
  const highlightHue = getThemeHue(120 + Math.sin(pulse * 0.6) * 10);
  const radial = ctx.createRadialGradient(0, -8, 6, 0, 0, bodyRadius);
  radial.addColorStop(0, `hsla(${hue}, 90%, 75%, 0.95)`);
  radial.addColorStop(1, `hsla(${highlightHue}, 85%, 50%, 0.95)`);

  ctx.fillStyle = radial;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyRadius, bodyRadius * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsla(${wingHue}, 80%, 65%, 0.85)`;
  ctx.beginPath();
  ctx.ellipse(-bodyRadius * 0.4, -10, bodyRadius * 0.8, bodyRadius * 0.5, 0.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsla(${beakHue}, 90%, 65%, 0.9)`;
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

  ctx.restore();
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const particle of particles) {
    const alpha = Math.max(particle.life, 0);
    ctx.fillStyle = `hsla(${particle.hue}, 90%, 60%, ${alpha})`;
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
  ctx.fillStyle = 'rgba(10, 10, 15, 0.35)';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '700 48px "Montserrat", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Tape pour planer', width / 2, height / 2 - 60);
  ctx.font = '400 22px "Montserrat", sans-serif';
  ctx.fillText('Esquive les portails vibrants', width / 2, height / 2 - 16);
  if (state === STATE_GAMEOVER) {
    ctx.fillText('Score: ' + score, width / 2, height / 2 + 40);
    ctx.fillText('Record: ' + bestScore, width / 2, height / 2 + 76);
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

function handlePress(event) {
  event.preventDefault();
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

resize();
resetGame();
loopHandle = requestAnimationFrame(loop);
