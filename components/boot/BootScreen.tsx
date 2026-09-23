"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

// The name bends. For the 1.5s the splash holds, "danoh.com" is drawn
// through a WebGL shader that ripples and refracts it under the pointer:
// three seconds of "this is not what it looks like" before the pixel
// desktop assembles. Loaded only once the gate has decided this session
// gets the show (repeat visits and reduced-motion visitors never fetch
// it), in parallel with the BIOS lines so it is ready when the splash
// fades in. Without WebGL2 the component draws the same text plainly.
const WarpText = dynamic(
  () => import("@/components/fx/WarpText").then((m) => m.WarpText),
  { ssr: false }
);

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
  if (!el) return;
  el.style.display = "flex";
  // If the page never hydrates (a script failed to load), React cannot
  // take the curtain down, so this does. Hydrated, the element is gone.
  setTimeout(function(){ if (el.isConnected) el.style.display = "none"; }, 12000);
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
  // Set once the show is confirmed, from inside the gsap import callback
  // (async, so it is not a setState-in-effect).
  const [warp, setWarp] = useState(false);
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
    let finished = false;
    let tl: { progress: (n: number) => void; kill: () => void } | null = null;

    // Everything that ends the boot is wired before GSAP loads. It used to
    // live inside the import's then(), so a chunk that failed to load (a
    // stale deploy, a flaky network, a blocker) left a black screen over
    // the whole site with no way past it.
    const finish = () => {
      if (finished) return;
      finished = true;
      cleanupInput();
      clearTimeout(safety);
      setDone(true);
    };
    const skip = () => {
      // Jump the show to its end; the onComplete handler tears down.
      if (tl) tl.progress(1);
      else finish();
    };
    // The key that skips the boot is spent on skipping it. It used to
    // carry on into the page: Enter typed a newline into Run's prompt or
    // pressed Welcome's focused button, Esc closed Welcome.
    const skipKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      skip();
    };
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skipKey, true);
    const cleanupInput = () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skipKey, true);
    };
    // The show runs about three and a half seconds; past eight, something
    // went wrong and the desktop matters more than the curtain.
    const safety = setTimeout(finish, 8000);

    void import("gsap").then(({ gsap }) => {
      if (killed) return;
      setWarp(true);

      const lines = root.querySelectorAll("[data-bios-line]");
      const splash = root.querySelector("[data-splash]");
      const bios = root.querySelector("[data-bios]");
      const bar = root.querySelector("[data-loadbar]");
      const hint = root.querySelector("[data-hint]");

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
          { opacity: 1, duration: 0.32 },
          "<0.05"
        )
        // Hold the branded splash long enough to land as a deliberate
        // first-run "wow" rather than a flicker — the logo is the payoff
        // of the whole boot, so let it breathe. This pushes total boot to
        // ~3s; it's still skippable (any key/click/tap) and only ever
        // plays once per browser session, so the dwell can't become a tax.
        .to(splash, { opacity: 1, duration: 1.5 }) // hold
        // The hint goes the instant the curtain starts to lift: faded
        // halfway over the desktop it is grey on grey, unreadable text.
        .set(hint, { visibility: "hidden" })
        .to(root, { opacity: 0, duration: 0.35 });

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
    }).catch(finish);

    return () => {
      killed = true;
      clearTimeout(safety);
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
            // 98.css styles every <pre> as a white sunken textarea box
            // (background, inset border, padding). On the black boot
            // screen that rendered as a stray white rectangle around the
            // POST text. Strip the chrome so it reads as terminal output.
            background: "transparent",
            boxShadow: "none",
            padding: 0,
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
          {warp ? (
            <WarpText
              segments={[{ text: "danoh.com", color: "#ffffff" }]}
              fontFamily="'Pixelated MS Sans Serif', Arial, sans-serif"
              fontSize={40}
              fontWeight={700}
              letterSpacing={2}
              align="center"
              warpStrength={0.07}
              warpScale={1.6}
              speed={0.5}
              pointerInfluence={0.55}
              pointerStrength={0.4}
              refraction={0.022}
              ripple
              style={{ width: "min(420px, 90vw)", height: 72 }}
            />
          ) : (
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
          )}
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
          data-hint
          style={{
            position: "absolute",
            bottom: 18,
            fontSize: 11,
            // 6.1:1 on the black. It was #5a5a5a, 2.9:1, which failed at
            // any size, let alone 11px.
            color: "#8a8a8a",
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
