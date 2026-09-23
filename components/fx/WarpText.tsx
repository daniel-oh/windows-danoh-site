"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

// Text that bends: rendered to a texture, then pushed through a fragment
// shader that drifts it with noise, bulges and ripples it under the
// pointer, and splits the colour channels slightly like light through
// glass. The one place on this site where type is not pixel-locked.
//
// The shader and the pointer/idle motion are React Bits' WarpText
// (github.com/DavidHDev/react-bits, MIT + Commons Clause). Their component
// sits on the `ogl` library; this is the same thing on raw WebGL2, which is
// all it needs (one triangle, one texture, a dozen uniforms), so it adds
// no dependency. Other changes: segments in more than one colour (the
// terminal's "!" prompt is a different colour from its text), left or
// centre alignment, and an explicit fallback: if WebGL2 is unavailable the
// component renders the text as plain DOM so nothing is lost.
//
// Accessibility: the canvas is aria-hidden. Callers keep the real text in
// the DOM (visually hidden or otherwise) for readers and for search.

export type WarpSegment = { text: string; color: string };

export type WarpTextProps = {
  /** One line of text, in one or more colours. */
  segments: WarpSegment[];
  fontFamily: string;
  /** px */
  fontSize: number;
  fontWeight?: number | string;
  letterSpacing?: number;
  align?: "left" | "center";
  warpStrength?: number;
  warpScale?: number;
  speed?: number;
  pointerInfluence?: number;
  pointerStrength?: number;
  refraction?: number;
  ripple?: boolean;
  /** Extra glow drawn behind the glyphs, e.g. the terminal's text-shadow. */
  glow?: string;
  className?: string;
  style?: CSSProperties;
};

const VERT = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTextTexture;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uPointerActive;
uniform float uTime;
uniform float uWarpStrength;
uniform float uWarpScale;
uniform float uSpeed;
uniform float uPointerInfluence;
uniform float uPointerStrength;
uniform float uRefraction;
uniform float uRipple;
uniform float uMotion;
in vec2 vUv;
out vec4 fragColor;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i); float b = hash(i + vec2(1.0, 0.0)); float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0; float amp = 0.5; for (int i = 0; i < 4; i++) { v += amp * noise(p); p *= 2.02; amp *= 0.5; } return v; }
vec4 sampleText(vec2 uv) { if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0); return texture(uTextTexture, uv); }
void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float time = uTime * uSpeed;
  float scale = max(uWarpScale, 0.001);
  vec2 drift = vec2(time * 0.055, -time * 0.045);
  float n1 = fbm(uv * scale * 3.1 + drift);
  float n2 = fbm((uv + 19.17) * scale * 3.4 - drift.yx);
  vec2 ambient = (vec2(n1, n2) - 0.5) * uWarpStrength * 0.045 * uMotion;
  vec2 pointerDelta = uv - uPointer;
  vec2 aspectDelta = vec2(pointerDelta.x * aspect, pointerDelta.y);
  float dist = length(aspectDelta);
  float radius = max(uPointerInfluence, 0.001);
  float t = clamp(dist / radius, 0.0, 1.0);
  float lens = smoothstep(radius, 0.0, dist) * uPointerActive;
  float bulge = t * (1.0 - t) * (1.0 - t) * 6.75 * uPointerActive;
  vec2 dir = dist > 0.0001 ? vec2(aspectDelta.x / aspect, aspectDelta.y) / dist : vec2(0.0);
  float rippleWave = sin(dist * 28.0 - time * 4.2) * 0.5 + 0.5;
  float rippleRing = (rippleWave - 0.5) * uRipple;
  vec2 pointerWarp = -dir * bulge * uPointerStrength * 0.045;
  pointerWarp += dir * rippleRing * bulge * uPointerStrength * 0.016;
  vec2 displaced = uv + ambient + pointerWarp;
  vec2 splitDir = ambient + pointerWarp;
  float splitLen = length(splitDir);
  splitDir = splitLen > 0.00001 ? splitDir / splitLen : vec2(0.7071, 0.7071);
  vec2 split = splitDir * uRefraction * 0.16 * (0.35 + lens * 1.65);
  vec4 base = sampleText(displaced);
  float r = sampleText(displaced + split).r;
  float g = base.g;
  float b = sampleText(displaced - split).b;
  float a = max(max(sampleText(displaced + split).a, base.a), sampleText(displaced - split).a);
  vec3 color = vec3(r, g, b) + lens * base.a * 0.055;
  fragColor = vec4(color, a);
}`;

const UNIFORMS = [
  "uTextTexture", "uResolution", "uPointer", "uPointerActive", "uTime",
  "uWarpStrength", "uWarpScale", "uSpeed", "uPointerInfluence",
  "uPointerStrength", "uRefraction", "uRipple", "uMotion",
] as const;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("WarpText shader:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

/** Draws the segments on one line into a 2D canvas the size of the host. */
function rasterize(
  width: number,
  height: number,
  dpr: number,
  p: WarpTextProps
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.floor(width * dpr));
  c.height = Math.max(1, Math.floor(height * dpr));
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  let size = p.fontSize;
  let spacing = p.letterSpacing ?? 0;
  const font = () => {
    ctx.font = `${p.fontWeight ?? 700} ${size}px ${p.fontFamily}`;
  };
  font();
  const chars = p.segments.flatMap((s) => Array.from(s.text).map((ch) => ({ ch, color: s.color })));
  const measure = () =>
    chars.reduce((w, { ch }) => w + ctx.measureText(ch).width, 0) + Math.max(0, chars.length - 1) * spacing;
  // Shrink to fit the host rather than clip: a long headline on a phone.
  let total = measure();
  const maxWidth = width * 0.96;
  if (total > maxWidth) {
    const fit = maxWidth / total;
    size *= fit;
    spacing *= fit;
    font();
    total = measure();
  }
  let x = p.align === "center" ? (width - total) / 2 : 0;
  const y = height / 2;
  for (const { ch, color } of chars) {
    if (p.glow) {
      ctx.shadowColor = p.glow;
      ctx.shadowBlur = 2;
    }
    ctx.fillStyle = color;
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
  return c;
}

export function WarpText(props: WarpTextProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const propsRef = useRef(props);
  propsRef.current = props;
  const uploadRef = useRef<() => void>(() => {});

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
    });
    if (!gl) {
      setFailed(true);
      return;
    }
    // Hand the context back when giving up, rather than holding one of the
    // browser's few WebGL slots for a canvas that will never draw.
    const giveUp = () => {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      setFailed(true);
    };
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!vs || !fs || !program) {
      giveUp();
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("WarpText link:", gl.getProgramInfoLog(program));
      giveUp();
      return;
    }
    gl.useProgram(program);

    // One triangle that covers the clip space; uv spans 0..1 over the host.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 0, 0, 3, -1, 2, 0, -1, 3, 0, 2]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(program, "position");
    const aUv = gl.getAttribLocation(program, "uv");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

    const u = Object.fromEntries(
      UNIFORMS.map((n) => [n, gl.getUniformLocation(program, n)])
    ) as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.uniform1i(u.uTextTexture, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
    });
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    let raf = 0;
    let disposed = false;
    let lost = false;
    let pageVisible = !document.hidden;
    let inView = true;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let reduce = mq?.matches ?? false;
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, active: 0, target: 0 };
    const t0 = performance.now();

    const setStatic = () => {
      const p = propsRef.current;
      gl.uniform1f(u.uWarpStrength, p.warpStrength ?? 0.08);
      gl.uniform1f(u.uWarpScale, p.warpScale ?? 1.7);
      gl.uniform1f(u.uSpeed, p.speed ?? 0.55);
      gl.uniform1f(u.uPointerInfluence, p.pointerInfluence ?? 0.42);
      gl.uniform1f(u.uPointerStrength, p.pointerStrength ?? 0.38);
      gl.uniform1f(u.uRefraction, p.refraction ?? 0.018);
      gl.uniform1f(u.uRipple, p.ripple === false ? 0 : 1);
      gl.uniform1f(u.uMotion, reduce ? 0 : 1);
    };

    const render = () => {
      if (disposed || lost) return;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    let version = 0;
    const upload = async () => {
      const v = ++version;
      try {
        await document.fonts?.ready;
      } catch {
        /* fonts API unavailable: draw with what is loaded */
      }
      if (disposed || lost || v !== version) return;
      const rect = host.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const text = rasterize(rect.width, rect.height, dpr, propsRef.current);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, text);
      render();
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u.uResolution, canvas.width, canvas.height);
      void upload();
    };

    const loop = (now: number) => {
      if (disposed || lost) return;
      const t = (now - t0) * 0.001;
      const idleX = 0.5 + Math.sin(t * 0.33) * 0.12;
      const idleY = 0.5 + Math.cos(t * 0.27) * 0.1;
      const tx = pointer.target > 0 ? pointer.tx : idleX;
      const ty = pointer.target > 0 ? pointer.ty : idleY;
      const damping = pointer.target > 0 ? 0.12 : 0.035;
      pointer.x += (tx - pointer.x) * damping;
      pointer.y += (ty - pointer.y) * damping;
      pointer.active += ((pointer.target > 0 ? 1 : 0.18) - pointer.active) * 0.06;
      gl.uniform2f(u.uPointer, pointer.x, pointer.y);
      gl.uniform1f(u.uPointerActive, reduce ? pointer.active * 0.35 : pointer.active);
      gl.uniform1f(u.uTime, reduce ? 0 : t);
      render();
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!raf && pageVisible && inView) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    // The pointer is read on the whole window, not the canvas: the host
    // is one line of text and a lens only over that line reads as broken.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = canvas.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      pointer.tx = (e.clientX - r.left) / r.width;
      pointer.ty = 1 - (e.clientY - r.top) / r.height;
      pointer.target = 1;
    };
    const onLeave = () => {
      pointer.target = 0;
    };
    // Nothing here restores a lost context, so fall back to the plain text
    // rather than leaving an aria-hidden canvas where the headline was.
    const onLost = () => {
      lost = true;
      stop();
      setFailed(true);
    };
    const onVisibility = () => {
      pageVisible = !document.hidden;
      if (pageVisible) start();
      else stop();
    };
    const onReduce = (e: MediaQueryListEvent) => {
      reduce = e.matches;
      gl.uniform1f(u.uMotion, reduce ? 0 : 1);
      render();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) start();
      else stop();
    });
    io.observe(host);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("webglcontextlost", onLost, false);
    document.addEventListener("visibilitychange", onVisibility);
    mq?.addEventListener("change", onReduce);

    uploadRef.current = () => {
      setStatic();
      void upload();
    };
    setStatic();
    resize();
    start();

    return () => {
      disposed = true;
      stop();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("webglcontextlost", onLost);
      document.removeEventListener("visibilitychange", onVisibility);
      mq?.removeEventListener("change", onReduce);
      if (!lost) {
        gl.deleteTexture(tex);
        gl.deleteBuffer(buf);
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
      canvas.remove();
    };
    // Mount once; prop changes re-upload the texture below.
  }, []);

  const textKey = props.segments.map((s) => `${s.color}:${s.text}`).join("|");
  useEffect(() => {
    uploadRef.current();
  }, [textKey, props.fontSize, props.fontFamily, props.fontWeight, props.warpStrength, props.pointerStrength, props.refraction]);

  if (failed) {
    // No WebGL2: the text, plainly, in the same place.
    return (
      <div className={props.className} style={props.style} aria-hidden="true">
        <span
          style={{
            fontFamily: props.fontFamily,
            fontSize: props.fontSize,
            fontWeight: props.fontWeight ?? 700,
            letterSpacing: props.letterSpacing,
            display: "block",
            textAlign: props.align ?? "left",
            whiteSpace: "nowrap",
          }}
        >
          {props.segments.map((s, i) => (
            <span key={i} style={{ color: s.color }}>
              {s.text}
            </span>
          ))}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className={props.className}
      aria-hidden="true"
      style={{ position: "relative", ...props.style }}
    />
  );
}
