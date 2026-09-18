"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import styles from "./GlassPane.module.css";

// A sheet of glass over whatever is painted behind it. The desktop is the
// only thing on this site that is not Win98 chrome, and this is the one
// surface that breaks that rule: it appears where the AI is working, and
// in the Glass toy.
//
// Ported from React Bits' GlassSurface (github.com/DavidHDev/react-bits,
// MIT + Commons Clause). The refraction is an SVG feDisplacementMap fed by
// a generated gradient map and applied through backdrop-filter, which only
// Chromium honours; Safari and Firefox get a frosted blur with the same
// edge light, as the original does. Props are trimmed to what the site
// uses. The pane is purely visual: content goes in `children`.

type Props = {
  children?: ReactNode;
  /** Corner radius in px. Win98 has none; the default is 0. */
  radius?: number;
  /** How hard the edges bend the backdrop. Negative pulls inward. */
  distortion?: number;
  /** 0..1 white frost laid over the backdrop. */
  frost?: number;
  /** Frost colour: light (white) or dark (black). */
  tint?: "light" | "dark";
  blur?: number;
  /** false = frosted blur only, never the displacement filter. */
  refract?: boolean;
  className?: string;
  style?: CSSProperties;
};

function supportsSvgBackdrop(filterId: string) {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const webkit = /Safari/.test(ua) && !/Chrome/.test(ua);
  if (webkit || /Firefox/.test(ua)) return false;
  const div = document.createElement("div");
  div.style.backdropFilter = `url(#${filterId})`;
  return div.style.backdropFilter !== "";
}

export function GlassPane({
  children,
  radius = 0,
  distortion = -150,
  frost = 0.08,
  tint = "light",
  blur = 14,
  refract = true,
  className,
  style,
}: Props) {
  const rawId = useId();
  const filterId = `glass-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<SVGFEImageElement>(null);
  const [svg, setSvg] = useState<boolean | null>(null);

  useEffect(() => {
    // Decided on the client after mount, so the server and the first paint
    // agree (the fallback), and only Chromium upgrades to refraction.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection needs the DOM
    setSvg(refract && supportsSvgBackdrop(filterId));
  }, [filterId, refract]);

  useEffect(() => {
    const host = hostRef.current;
    const map = mapRef.current;
    if (!svg || !host || !map) return;

    // The displacement map, as in the original: a red ramp for x, a blue
    // ramp in difference mode, and a blurred mid-grey plate in the middle.
    // Mid grey means "no displacement", so the centre stays flat and only
    // the rim bends, like a pane thicker at the edge.
    const paint = () => {
      const w = Math.max(1, Math.round(host.clientWidth));
      const h = Math.max(1, Math.round(host.clientHeight));
      const edge = Math.min(w, h) * 0.06;
      const body = `
        <svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="r" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="red"/>
            </linearGradient>
            <linearGradient id="b" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="blue"/>
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="${w}" height="${h}" fill="black"/>
          <rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" fill="url(#r)"/>
          <rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" fill="url(#b)" style="mix-blend-mode:difference"/>
          <rect x="${edge}" y="${edge}" width="${w - edge * 2}" height="${h - edge * 2}" rx="${radius}" fill="hsl(0 0% 50% / 0.93)" style="filter:blur(${blur}px)"/>
        </svg>`;
      map.setAttribute("href", `data:image/svg+xml,${encodeURIComponent(body)}`);
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(host);
    return () => ro.disconnect();
  }, [svg, radius, blur]);

  const vars = {
    ...style,
    borderRadius: radius,
    "--glass-frost": frost,
    "--glass-filter": `url(#${filterId})`,
  } as CSSProperties;

  return (
    <div
      ref={hostRef}
      className={[
        styles.pane,
        svg ? styles.svg : styles.fallback,
        tint === "dark" ? styles.dark : "",
        className ?? "",
      ].join(" ")}
      style={vars}
    >
      {svg && (
        <svg className={styles.filter} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id={filterId} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
              <feImage ref={mapRef} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
              <feDisplacementMap in="SourceGraphic" in2="map" scale={distortion} xChannelSelector="R" yChannelSelector="G" result="dr" />
              <feColorMatrix in="dr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
              <feDisplacementMap in="SourceGraphic" in2="map" scale={distortion + 6} xChannelSelector="R" yChannelSelector="G" result="dg" />
              <feColorMatrix in="dg" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
              <feDisplacementMap in="SourceGraphic" in2="map" scale={distortion + 12} xChannelSelector="R" yChannelSelector="G" result="db" />
              <feColorMatrix in="db" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
              <feBlend in="red" in2="green" mode="screen" result="rg" />
              <feBlend in="rg" in2="blue" mode="screen" result="rgb" />
              <feGaussianBlur in="rgb" stdDeviation="0.7" />
            </filter>
          </defs>
        </svg>
      )}
      <div className={styles.content}>{children}</div>
    </div>
  );
}
