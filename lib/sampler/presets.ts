// Patterns to start from, so the program is fun before you have decided
// anything. Each one is written here as step numbers per pad, which is the
// only part of a groove that is really yours to write: the sounds come from
// the synthesised kit, so nothing here is anyone else's recording.
//
// Pads are the kit order in dsp/src/kit.rs: 0 kick, 1 kick 2, 2 snare,
// 3 rim, 4 clap, 5 hat, 6 open hat, 7 tom lo, 8 tom mid, 9 tom hi,
// 10 cowbell, 11 clave, 12 shaker, 13 zap, 14 blip, 15 sweep.

export type Preset = {
  name: string;
  bpm: number;
  swing: number;
  /** Twelve bit converter on, for the ones that want it. */
  vintage?: boolean;
  /** pad -> the steps it plays, and how hard. */
  hits: { pad: number; steps: number[]; velocity?: number }[];
};

export const PRESETS: Preset[] = [
  {
    // Four to the floor, open hat on the off beat: the oldest trick there is.
    name: "House",
    bpm: 124,
    swing: 0,
    hits: [
      { pad: 0, steps: [0, 4, 8, 12] },
      { pad: 6, steps: [2, 6, 10, 14], velocity: 0.6 },
      { pad: 4, steps: [4, 12], velocity: 0.8 },
      { pad: 12, steps: [1, 3, 5, 7, 9, 11, 13, 15], velocity: 0.35 },
    ],
  },
  {
    // Swung, snare late on the two and four, the way a sampler with a
    // twelve bit converter was usually pointed.
    name: "Boom bap",
    bpm: 88,
    swing: 0.55,
    vintage: true,
    hits: [
      { pad: 0, steps: [0, 3, 8, 10] },
      { pad: 2, steps: [4, 12] },
      { pad: 5, steps: [0, 2, 4, 6, 8, 10, 12, 14], velocity: 0.5 },
      { pad: 3, steps: [7], velocity: 0.7 },
    ],
  },
  {
    // A break: the kick moves around, the snare answers it, the hats fill in.
    name: "Breakbeat",
    bpm: 168,
    swing: 0.15,
    hits: [
      { pad: 0, steps: [0, 6, 10] },
      { pad: 2, steps: [4, 12], velocity: 0.95 },
      { pad: 3, steps: [14], velocity: 0.7 },
      { pad: 5, steps: [2, 6, 8, 14], velocity: 0.55 },
      { pad: 6, steps: [11], velocity: 0.5 },
    ],
  },
  {
    // Straight, hard, and one cowbell, because techno.
    name: "Techno",
    bpm: 132,
    swing: 0,
    hits: [
      { pad: 1, steps: [0, 4, 8, 12] },
      { pad: 5, steps: [2, 6, 10, 14], velocity: 0.6 },
      { pad: 10, steps: [7, 15], velocity: 0.45 },
      { pad: 4, steps: [12], velocity: 0.7 },
    ],
  },
  {
    // Slow, with the hats rolling underneath.
    name: "Half time",
    bpm: 74,
    swing: 0.3,
    vintage: true,
    hits: [
      { pad: 0, steps: [0, 7] },
      { pad: 2, steps: [8] },
      { pad: 5, steps: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14], velocity: 0.45 },
      { pad: 11, steps: [6, 14], velocity: 0.5 },
    ],
  },
];

/** Flattened to (step, pad, velocity), which is what the engine takes. */
export function presetSteps(preset: Preset): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const { pad, steps, velocity = 0.9 } of preset.hits) {
    for (const step of steps) out.push([step, pad, velocity]);
  }
  return out;
}
