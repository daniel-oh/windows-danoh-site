import { getDefaultStore } from "jotai";
import { programsAtom, type ProgramEntry } from "@/state/programs";
import { createWindow } from "./createWindow";

// A pre-baked "generated" program. The Welcome window promises
// describe-an-app-and-watch-it-build, but anonymous visitors hit the
// access-code gate before they ever see the trick. This is a real
// output of the same pipeline (saved-program srcDoc path) shipped as
// static HTML, so every visitor gets the demo at zero marginal AI
// cost — and the gate can point at it.
const SNAKE_ID = "Snake";
// v3: hand-made icon artwork. Each bump migrates browsers that
// seeded an earlier version (upsert refreshes code + icon).
const SEEDED_FLAG = "danoh_demo_seeded_v3";

// Hand-made artwork (public/icons/snake-neon.png): a Win98 beveled
// tile with the neon snake, background removed. A path, not a data
// URI, so the stored program entry stays small and the file caches.
// Pre-set so opening the demo never calls the paid /api/icon endpoint.
const SNAKE_ICON = "/icons/snake-neon.png";

const SNAKE_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://unpkg.com/98.css">
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 10px;
    background: #05030f;
    color: #00ffd5;
    font-family: "Pixelated MS Sans Serif", Arial, sans-serif;
    user-select: none; touch-action: none;
  }
  /* CRT scanlines over everything — pure decoration */
  body::after {
    content: ""; position: fixed; inset: 0; pointer-events: none;
    background: repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 3px);
  }
  .hud { display: flex; gap: 14px; font-size: 13px; }
  .hud .cell {
    background: #0b0b1e; border: 1px solid #00ffd5;
    box-shadow: 0 0 8px rgba(0,255,213,0.35), inset 0 0 6px rgba(0,255,213,0.15);
    padding: 3px 12px; min-width: 76px; text-align: center;
    color: #00ffd5; text-shadow: 0 0 6px rgba(0,255,213,0.8);
  }
  .hud .cell b { color: #ff2bd6; text-shadow: 0 0 6px rgba(255,43,214,0.8); }
  canvas {
    border: 2px solid #00ffd5;
    box-shadow: 0 0 16px rgba(0,255,213,0.4), inset 0 0 24px rgba(0,255,213,0.06);
    background: #05030f;
    max-width: 92vw; max-height: 60vh;
  }
  .controls { display: flex; gap: 8px; align-items: center; }
  .hint { font-size: 11px; color: #6c6ca8; text-align: center; padding: 0 8px; }
</style>
</head>
<body>
  <div class="hud"><span class="cell">SCORE <b id="score">0</b></span><span class="cell">BEST <b id="best">0</b></span></div>
  <canvas id="c" width="320" height="320"></canvas>
  <div class="controls"><button id="restart">New Game</button></div>
  <p class="hint">Arrow keys / WASD, or swipe. Walls are walls. Don't eat yourself.</p>
<script>
(function () {
  var canvas = document.getElementById("c"), ctx = canvas.getContext("2d");
  var N = 16, CELL = canvas.width / N;
  var snake, dir, nextDir, apple, score, best = 0, dead, timer, speed, pulse = 0;

  function reset() {
    snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
    dir = { x: 1, y: 0 }; nextDir = dir;
    score = 0; dead = false; speed = 150;
    placeApple(); updateHud(); draw(); loop();
  }
  function placeApple() {
    do {
      apple = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) };
    } while (snake.some(function (s) { return s.x === apple.x && s.y === apple.y; }));
  }
  function updateHud() {
    document.getElementById("score").textContent = score;
    document.getElementById("best").textContent = best;
  }
  function die() { dead = true; clearTimeout(timer); draw(); }
  function tick() {
    dir = nextDir;
    var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    // Walls are solid — no wrap-around.
    if (head.x < 0 || head.x >= N || head.y < 0 || head.y >= N) return die();
    var eating = head.x === apple.x && head.y === apple.y;
    // Self-collision. The tail cell is vacated this same tick (unless
    // we're growing), so moving into it is legal — checking the whole
    // body would call that classic move a death.
    var body = eating ? snake : snake.slice(0, -1);
    if (body.some(function (s) { return s.x === head.x && s.y === head.y; })) return die();
    snake.unshift(head);
    if (eating) {
      score += 10; best = Math.max(best, score); speed = Math.max(60, speed - 4);
      placeApple(); updateHud();
    } else snake.pop();
    draw(); loop();
  }
  function loop() { clearTimeout(timer); timer = setTimeout(tick, speed); }
  function glow(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
  function draw() {
    pulse = (pulse + 1) % 60;
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#05030f"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // neon grid
    ctx.strokeStyle = "rgba(0,255,213,0.07)"; ctx.lineWidth = 1;
    for (var i = 1; i < N; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(canvas.width, i * CELL); ctx.stroke();
    }
    // apple: hot magenta, pulsing glow
    glow("#ff2bd6", 12 + 4 * Math.sin(pulse / 6));
    ctx.fillStyle = "#ff2bd6";
    ctx.fillRect(apple.x * CELL + 3, apple.y * CELL + 3, CELL - 6, CELL - 6);
    // snake: cyan head, body fades cyan -> green -> deep teal
    snake.forEach(function (s, i) {
      var t = snake.length === 1 ? 0 : i / (snake.length - 1);
      if (i === 0) { glow("#00ffd5", 14); ctx.fillStyle = "#00ffd5"; }
      else {
        glow("#00ff84", 7);
        var g = Math.round(255 - 110 * t), b = Math.round(132 - 90 * t);
        ctx.fillStyle = "rgb(0," + g + "," + b + ")";
      }
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    });
    ctx.shadowBlur = 0;
    if (dead) {
      ctx.fillStyle = "rgba(5,3,15,0.72)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = "center";
      glow("#ff2bd6", 18);
      ctx.fillStyle = "#ff2bd6"; ctx.font = "bold 26px monospace";
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 8);
      glow("#00ffd5", 10);
      ctx.fillStyle = "#00ffd5"; ctx.font = "12px monospace";
      ctx.fillText("SCORE " + score + " — press New Game or Space", canvas.width / 2, canvas.height / 2 + 18);
      ctx.shadowBlur = 0;
    }
  }
  function steer(x, y) {
    if (x === -dir.x && y === -dir.y) return; // no instant reversal
    nextDir = { x: x, y: y };
  }
  window.addEventListener("keydown", function (e) {
    var k = e.key.toLowerCase();
    if (dead && (k === " " || k === "enter")) { reset(); e.preventDefault(); return; }
    if (k === "arrowup" || k === "w") steer(0, -1);
    else if (k === "arrowdown" || k === "s") steer(0, 1);
    else if (k === "arrowleft" || k === "a") steer(-1, 0);
    else if (k === "arrowright" || k === "d") steer(1, 0);
    else return;
    e.preventDefault();
  });
  var touchStart = null;
  window.addEventListener("touchstart", function (e) {
    var t = e.touches[0]; touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  window.addEventListener("touchend", function (e) {
    if (!touchStart) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    touchStart = null;
    if (dead && Math.abs(dx) < 20 && Math.abs(dy) < 20) { reset(); return; }
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 1 : -1, 0);
    else steer(0, dy > 0 ? 1 : -1);
  });
  document.getElementById("restart").addEventListener("click", reset);
  reset();
})();
</script>
</body>
</html>`;

const DEMO_PROGRAM: ProgramEntry = {
  id: SNAKE_ID,
  name: SNAKE_ID,
  prompt:
    "a neon retro snake game with arrow keys, touch controls, and a scoreboard",
  code: SNAKE_HTML,
  icon: SNAKE_ICON,
};

async function upsertDemo(): Promise<void> {
  const store = getDefaultStore();
  const { programs } = await store.get(programsAtom);
  if (programs.some((p) => p.id === SNAKE_ID)) {
    // Browser already has a (possibly v1) copy — refresh code + icon.
    await store.set(programsAtom, {
      type: "UPDATE_PROGRAM",
      payload: {
        id: SNAKE_ID,
        code: SNAKE_HTML,
        icon: SNAKE_ICON,
        prompt: DEMO_PROGRAM.prompt,
      },
    });
  } else {
    await store.set(programsAtom, {
      type: "ADD_PROGRAM",
      payload: DEMO_PROGRAM,
    });
  }
}

/** Seed/refresh the demo once per browser per version. Respects
 * deletion AFTER the migration: trashing Snake.exe keeps it gone. */
export async function seedDemoProgram(): Promise<void> {
  try {
    if (localStorage.getItem(SEEDED_FLAG)) return;
    await upsertDemo();
    localStorage.setItem(SEEDED_FLAG, "1");
  } catch {
    /* IndexedDB unavailable — the gate link still works via openDemoProgram */
  }
}

/** Open the demo, re-adding it first if it was deleted. */
export async function openDemoProgram(): Promise<void> {
  const store = getDefaultStore();
  const { programs } = await store.get(programsAtom);
  if (!programs.some((p) => p.id === SNAKE_ID)) {
    await store.set(programsAtom, {
      type: "ADD_PROGRAM",
      payload: DEMO_PROGRAM,
    });
  }
  createWindow({
    title: SNAKE_ID,
    program: { type: "iframe", programID: SNAKE_ID },
    icon: SNAKE_ICON,
    size: { width: 460, height: 580 },
  });
}
