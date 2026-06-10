"use client";

import { useEffect, useRef, useState } from "react";

// The boot sequence: BIOS POST text, a branded splash with the classic
// sliding loading bar, then the desktop assembles (icons stagger in,
// taskbar rises). Pure theatre, so it follows theatre rules:
//   - once per browser session
//   - any key/click/tap skips it instantly
//   - reduced-motion users never see it
//   - no-JS visitors and crawlers never see it (hidden by default;
//     only the inline script below can reveal it)
//   - GSAP is dynamically imported, so it costs the initial bundle
//     nothing
//
// The overlay starts display:none and the inline <script> right after
// it decides synchronously DURING HTML PARSE whether to show it. That
// ordering is the whole trick: no flash of desktop before the curtain
// on first visits, no flash of curtain on return visits.

const BOOT_KEY = "danoh_booted";

const GATE_SCRIPT = `(function(){try{
  if (sessionStorage.getItem("${BOOT_KEY}")) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var el = document.getElementById("danoh-boot");
  if (el) el.style.display = "flex";
}catch(e){}})();`;

const BIOS_LINES = [
  "DANOH BIOS v4.0 · Pixel Edition",
  "Memory Test : 65,536 KB ............ OK",
  "CPU         : Imagination Coprocessor OK",
  "Mouse       : detected, 3 clicks enabled",
  "Boot device : C:\\DANOH",
  "",
  "Starting danoh.com ...",
];

export function BootScreen() {
  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    // The inline gate decided this session doesn't get the show.
    if (!root || root.style.display !== "flex") {
      setDone(true);
      return;
    }
    sessionStorage.setItem(BOOT_KEY, "1");

    let killed = false;
    let cleanupInput = () => {};
    let tl: { progress: (n: number) => void; kill: () => void } | null = null;

    void import("gsap").then(({ gsap }) => {
      if (killed) return;

      const lines = root.querySelectorAll("[data-bios-line]");
      const splash = root.querySelector("[data-splash]");
      const bios = root.querySelector("[data-bios]");
      const bar = root.querySelector("[data-loadbar]");

      // The classic boot bar: a blue block sliding across a track,
      // looping for as long as the splash is up.
      const barTween = gsap.fromTo(
        bar,
        { x: "-110%" },
        { x: "420%", duration: 0.8, ease: "none", repeat: -1 }
      );

      const timeline = gsap.timeline({
        onComplete: () => {
          barTween.kill();
          finish();
        },
      });
      tl = timeline;

      timeline
        .from(lines, { opacity: 0, duration: 0.01, stagger: 0.09 })
        .to(bios, { opacity: 0, duration: 0.12 }, "+=0.35")
        .fromTo(
          splash,
          { opacity: 0 },
          { opacity: 1, duration: 0.18 },
          "<0.05"
        )
        .to(splash, { opacity: 1, duration: 0.55 }) // hold
        .to(root, { opacity: 0, duration: 0.3 });

      // Desktop assembly plays under the lifting curtain.
      timeline.add(() => {
        gsap.from("[class*='programIcon']", {
          y: -10,
          opacity: 0,
          duration: 0.3,
          stagger: 0.05,
          ease: "power2.out",
          clearProps: "transform,opacity",
        });
        gsap.from("[class*='taskbar']:not([class*='taskbarClock'])", {
          yPercent: 100,
          duration: 0.32,
          ease: "power3.out",
          clearProps: "transform",
        });
      }, "-=0.25");

      const finish = () => {
        cleanupInput();
        setDone(true);
      };

      const skip = () => {
        // Jump the show to its end; the onComplete handler tears down.
        timeline.progress(1);
      };
      window.addEventListener("pointerdown", skip);
      window.addEventListener("keydown", skip);
      cleanupInput = () => {
        window.removeEventListener("pointerdown", skip);
        window.removeEventListener("keydown", skip);
      };
    });

    return () => {
      killed = true;
      cleanupInput();
      tl?.kill();
    };
  }, []);

  if (done) return null;

  return (
    <>
      <div
        id="danoh-boot"
        ref={rootRef}
        role="presentation"
        style={{
          display: "none",
          position: "fixed",
          inset: 0,
          zIndex: 20000,
          background: "#000",
          color: "#b7b7b7",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <pre
          data-bios
          style={{
            position: "absolute",
            top: 24,
            left: 28,
            margin: 0,
            fontFamily: "'Courier New', Menlo, monospace",
            fontSize: 14,
            lineHeight: 1.7,
            textAlign: "left",
          }}
        >
          {BIOS_LINES.map((l, i) => (
            <span key={i} data-bios-line style={{ display: "block" }}>
              {l || " "}
            </span>
          ))}
        </pre>

        <div
          data-splash
          style={{
            opacity: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/danoh-logo.svg"
            alt=""
            style={{ width: 200, filter: "invert(1) brightness(1.4)" }}
          />
          <div
            style={{
              fontFamily: "'Pixelated MS Sans Serif', Arial, sans-serif",
              fontSize: 14,
              color: "#fff",
              letterSpacing: 1,
            }}
          >
            danoh.com
          </div>
          <div
            style={{
              width: 220,
              height: 14,
              border: "1px solid #5a5a5a",
              overflow: "hidden",
              background: "#101010",
            }}
          >
            <div
              data-loadbar
              style={{
                width: "26%",
                height: "100%",
                background:
                  "linear-gradient(90deg, #000080, #1084d0, #000080)",
              }}
            />
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 18,
            fontSize: 11,
            color: "#5a5a5a",
            fontFamily: "'Courier New', Menlo, monospace",
          }}
        >
          press any key to skip
        </div>
      </div>
      {/* Synchronous gate — see header comment. Must be the immediate
          next element so it runs before anything else paints. */}
      <script dangerouslySetInnerHTML={{ __html: GATE_SCRIPT }} />
    </>
  );
}
