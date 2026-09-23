// The geometry behind DodgeField, kept here so it can be tested without a
// pointer: given where the cursor is and where the thing is, how far should
// the thing move to get out of the way?

export type Axis = "x" | "y" | "both";
export type Wall = "clamp" | "free";

export type DodgeInput = {
  pointer: { x: number; y: number };
  /** The runner's rect while at rest, in viewport coordinates. */
  rect: { left: number; top: number; width: number; height: number };
  /** How far it will move at most. */
  reach: number;
  /** How close the pointer has to get before it reacts. */
  radius: number;
  /** Shape of the response: 1 is linear, higher means it only bolts when
   * the pointer is genuinely close. */
  falloff: number;
  axis: Axis;
  wall: Wall;
  /** Viewport size, so clamping can keep the runner on screen. */
  viewport?: { width: number; height: number };
};

export type Offset = { x: number; y: number };

export const AT_REST: Offset = { x: 0, y: 0 };

/**
 * Where to translate the runner. Zero when the pointer is outside the
 * radius, growing to `reach` as it closes in, directly away from the
 * pointer. With `wall: "clamp"` the result is trimmed so the runner cannot
 * be pushed off the edge of the screen, which is what would otherwise
 * happen to anything near the viewport's border.
 */
export function dodgeOffset(input: DodgeInput): Offset {
  const { pointer, rect, reach, radius, falloff, axis, wall, viewport } = input;
  if (!(radius > 0) || !(reach > 0)) return AT_REST;

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = cx - pointer.x;
  let dy = cy - pointer.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= radius) return AT_REST;

  // Dead centre: pick a direction rather than dividing by zero.
  if (distance === 0) {
    dx = 1;
    dy = 0;
  }
  const length = distance === 0 ? 1 : distance;
  const strength = Math.pow(1 - distance / radius, Math.max(0.1, falloff));
  let x = (dx / length) * reach * strength;
  let y = (dy / length) * reach * strength;

  if (axis === "x") y = 0;
  if (axis === "y") x = 0;

  if (wall === "clamp" && viewport) {
    // Keep the whole runner on screen, with a small margin so it never
    // kisses the edge.
    const margin = 8;
    const minX = margin - rect.left;
    const maxX = viewport.width - margin - (rect.left + rect.width);
    const minY = margin - rect.top;
    const maxY = viewport.height - margin - (rect.top + rect.height);
    x = Math.min(Math.max(x, Math.min(minX, 0)), Math.max(maxX, 0));
    y = Math.min(Math.max(y, Math.min(minY, 0)), Math.max(maxY, 0));
  }

  return { x: round(x), y: round(y) };
}

/** Sub-pixel precision is invisible and makes for noisy style writes. */
function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export function isAtRest(offset: Offset): boolean {
  return offset.x === 0 && offset.y === 0;
}
