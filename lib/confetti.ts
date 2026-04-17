// Tiny dependency-free confetti burst. Spawns emoji particles at (x, y)
// with randomised velocity + rotation, integrates gravity, and removes
// themselves when their life runs out. Single rAF loop handles all
// particles in one burst.

const EMOJIS = ["🎉", "🎊", "✨", "💖", "🔥", "⭐", "💫"];

type Particle = {
  el: HTMLElement;
  vx: number;
  vy: number;
  rot: number;
  life: number;
  dead: boolean;
};

export function burstConfetti(x: number, y: number, count = 28): void {
  if (typeof window === "undefined") return;

  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    el.style.position = "fixed";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.fontSize = `${18 + Math.random() * 12}px`;
    el.style.pointerEvents = "none";
    el.style.zIndex = "9999";
    el.style.userSelect = "none";
    el.style.willChange = "transform, opacity";
    document.body.appendChild(el);

    // Upward cone: -30° to -150° in standard math convention.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.8);
    const speed = 220 + Math.random() * 360;
    particles.push({
      el,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: (Math.random() - 0.5) * 720,
      life: 1400 + Math.random() * 700,
      dead: false,
    });
  }

  const GRAVITY = 1500; // px/s²
  const start = performance.now();

  function tick(now: number) {
    const elapsed = now - start;
    let anyAlive = false;
    for (const p of particles) {
      if (p.dead) continue;
      if (elapsed >= p.life) {
        p.el.remove();
        p.dead = true;
        continue;
      }
      const t = elapsed / 1000;
      const dx = p.vx * t;
      const dy = p.vy * t + 0.5 * GRAVITY * t * t;
      p.el.style.transform = `translate(${dx}px, ${dy}px) rotate(${p.rot * t}deg)`;
      p.el.style.opacity = `${Math.max(0, 1 - elapsed / p.life)}`;
      anyAlive = true;
    }
    if (anyAlive) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
