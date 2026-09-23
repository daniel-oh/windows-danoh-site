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
  /** Where distance is measured from. "center" suits something small and
   * round. "edge" suits a long line of text: from the centre, a pointer
   * over either end of a 400px line is too far away to count, so the line
   * only reacted near its middle. */
  measure?: Measure;
};

export type Measure = "center" | "edge";

/** How far the pointer is from the runner, the way dodgeOffset sees it. */
export function pointerDistance(
  pointer: { x: number; y: number },
  rect: { left: number; top: number; width: number; height: number },
  measure: Measure = "center"
): number {
  if (measure === "edge") {
    const nx = Math.min(Math.max(pointer.x, rect.left), rect.left + rect.width);
    const ny = Math.min(Math.max(pointer.y, rect.top), rect.top + rect.height);
    return Math.hypot(pointer.x - nx, pointer.y - ny);
  }
  return Math.hypot(
    rect.left + rect.width / 2 - pointer.x,
    rect.top + rect.height / 2 - pointer.y
  );
}

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

  const distance = pointerDistance(pointer, rect, input.measure);
  if (distance >= radius) return AT_REST;

  // Away from the pointer, through the centre. Dead centre: pick a
  // direction rather than dividing by zero.
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = cx - pointer.x;
  let dy = cy - pointer.y;
  if (axis === "x") dy = 0;
  if (axis === "y") dx = 0;
  if (dx === 0 && dy === 0) {
    if (axis === "y") dy = 1;
    else dx = 1;
  }
  const length = Math.hypot(dx, dy);
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
