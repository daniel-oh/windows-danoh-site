import { getDefaultStore } from "jotai";
import { programsAtom, type ProgramEntry } from "@/state/programs";
import { createWindow } from "./createWindow";

// A pre-baked "generated" program. The Welcome window promises
// describe-an-app-and-watch-it-build, but anonymous visitors hit the
// access-code gate before they ever see the trick. This is a real
// output of the same pipeline (saved-program srcDoc path, 98.css, the
// works) shipped as static HTML, so every visitor gets the demo at
// zero marginal AI cost — and the gate can point at it.
const SNAKE_ID = "Snake";
const SEEDED_FLAG = "danoh_demo_seeded";

// Tiny 16x16 Win98-flavored snake tile, so opening the demo never
// calls the paid /api/icon endpoint.
const SNAKE_ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#c0c0c0"/><path d="M2 11h6V7h6V3h-2v2H6v4H2z" fill="#007a00"/><rect x="12" y="3" width="2" height="2" fill="#005400"/><rect x="2" y="11" width="2" height="2" fill="#9aff9a"/></svg>`
  );

const SNAKE_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://unpkg.com/98.css">
<style>
  html, body { height: 100%; margin: 0; }
  body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; background: #c0c0c0; font-family: "Pixelated MS Sans Serif", Arial, sans-serif; user-select: none; touch-action: none; }
  .hud { display: flex; gap: 16px; font-size: 13px; }
  .hud .cell { background: #fff; border: 1px solid #808080; box-shadow: inset 1px 1px #404040; padding: 2px 10px; min-width: 70px; text-align: center; }
  canvas { border: 2px solid; border-color: #404040 #fff #fff #404040; background: #002800; max-width: 92vw; max-height: 60vh; }
  .controls { display: flex; gap: 8px; align-items: center; }
  .hint { font-size: 11px; color: #444; text-align: center; padding: 0 8px; }
</style>
</head>
<body>
  <div class="hud"><span class="cell">Score: <b id="score">0</b></span><span class="cell">Best: <b id="best">0</b></span></div>
  <canvas id="c" width="320" height="320"></canvas>
  <div class="controls"><button id="restart">New Game</button></div>
  <p class="hint">Arrow keys / WASD, or swipe. Eat the apples. Don't eat yourself.</p>
<script>
(function () {
  var canvas = document.getElementById("c"), ctx = canvas.getContext("2d");
  var N = 16, CELL = canvas.width / N;
  var snake, dir, nextDir, apple, score, best = 0, dead, timer, speed;

  function reset() {
    snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
    dir = { x: 1, y: 0 }; nextDir = dir;
    score = 0; dead = false; speed = 140;
    placeApple(); updateHud(); loop();
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
  function tick() {
    dir = nextDir;
    var head = { x: (snake[0].x + dir.x + N) % N, y: (snake[0].y + dir.y + N) % N };
    if (snake.some(function (s) { return s.x === head.x && s.y === head.y; })) { dead = true; draw(); return; }
    snake.unshift(head);
    if (head.x === apple.x && head.y === apple.y) {
      score += 10; best = Math.max(best, score); speed = Math.max(60, speed - 4);
      placeApple(); updateHud();
    } else snake.pop();
    draw(); loop();
  }
  function loop() { clearTimeout(timer); timer = setTimeout(tick, speed); }
  function draw() {
    ctx.fillStyle = "#002800"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ff4040";
    ctx.fillRect(apple.x * CELL + 2, apple.y * CELL + 2, CELL - 4, CELL - 4);
    snake.forEach(function (s, i) {
      ctx.fillStyle = i === 0 ? "#9aff9a" : "#00c000";
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    });
    if (dead) {
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff"; ctx.font = "bold 22px Arial"; ctx.textAlign = "center";
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 6);
      ctx.font = "13px Arial";
      ctx.fillText("Press New Game", canvas.width / 2, canvas.height / 2 + 16);
    }
  }
  function steer(x, y) {
    if (x === -dir.x && y === -dir.y) return; // no instant reversal
    nextDir = { x: x, y: y };
  }
  window.addEventListener("keydown", function (e) {
    var k = e.key.toLowerCase();
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
  prompt: "a snake game with arrow keys, touch controls, and a scoreboard",
  code: SNAKE_HTML,
  icon: SNAKE_ICON,
};

/** Seed the demo once per browser. Respects deletion: if the visitor
 * trashes Snake.exe, it stays gone (the flag persists). */
export async function seedDemoProgram(): Promise<void> {
  try {
    if (localStorage.getItem(SEEDED_FLAG)) return;
    const store = getDefaultStore();
    const { programs } = await store.get(programsAtom);
    if (!programs.some((p) => p.id === SNAKE_ID)) {
      await store.set(programsAtom, {
        type: "ADD_PROGRAM",
        payload: DEMO_PROGRAM,
      });
    }
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
    size: { width: 460, height: 560 },
  });
}
