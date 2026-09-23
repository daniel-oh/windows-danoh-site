import { AT_REST, dodgeOffset, isAtRest, pointerDistance } from "../dodge";

const rect = { left: 100, top: 100, width: 100, height: 20 };
const base = {
  rect,
  reach: 20,
  radius: 100,
  falloff: 2,
  axis: "both" as const,
  wall: "free" as const,
};
const centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

describe("dodge geometry", () => {
  test("ignores a pointer outside the radius", () => {
    expect(dodgeOffset({ ...base, pointer: { x: centre.x + 400, y: centre.y } })).toEqual(AT_REST);
    expect(isAtRest(AT_REST)).toBe(true);
  });

  test("moves directly away from the pointer", () => {
    const left = dodgeOffset({ ...base, pointer: { x: centre.x - 40, y: centre.y } });
    expect(left.x).toBeGreaterThan(0); // pointer on the left, so it goes right
    expect(Math.abs(left.y)).toBeLessThan(0.2);

    const below = dodgeOffset({ ...base, pointer: { x: centre.x, y: centre.y + 40 } });
    expect(below.y).toBeLessThan(0); // pointer below, so it goes up
  });

  test("moves further the closer the pointer gets, up to reach", () => {
    const far = dodgeOffset({ ...base, pointer: { x: centre.x - 90, y: centre.y } });
    const near = dodgeOffset({ ...base, pointer: { x: centre.x - 10, y: centre.y } });
    expect(near.x).toBeGreaterThan(far.x);
    expect(near.x).toBeLessThanOrEqual(base.reach);
  });

  test("never sits still when the pointer is on top of it", () => {
    const on = dodgeOffset({ ...base, pointer: centre });
    expect(isAtRest(on)).toBe(false);
    expect(Math.hypot(on.x, on.y)).toBeCloseTo(base.reach, 1);
  });

  test("an axis lock keeps the other axis at zero", () => {
    const pointer = { x: centre.x - 30, y: centre.y - 30 };
    expect(dodgeOffset({ ...base, axis: "x", pointer }).y).toBe(0);
    expect(dodgeOffset({ ...base, axis: "y", pointer }).x).toBe(0);
  });

  test("clamping keeps it on screen at the edges", () => {
    const atEdge = { left: 4, top: 100, width: 100, height: 20 };
    const pushed = dodgeOffset({
      ...base,
      rect: atEdge,
      wall: "clamp",
      viewport: { width: 1000, height: 800 },
      pointer: { x: atEdge.left + 120, y: 110 },
    });
    expect(atEdge.left + pushed.x).toBeGreaterThanOrEqual(0);
  });

  test("a zero radius or reach means it never moves", () => {
    expect(dodgeOffset({ ...base, radius: 0, pointer: centre })).toEqual(AT_REST);
    expect(dodgeOffset({ ...base, reach: 0, pointer: centre })).toEqual(AT_REST);
  });
});

describe("measuring from the edge (long lines of text)", () => {
  // A 400px line, 16px tall, well inside a big viewport.
  const line = { left: 300, top: 200, width: 400, height: 16 };
  const edge = {
    rect: line,
    reach: 20,
    radius: 60,
    falloff: 2,
    axis: "x" as const,
    wall: "clamp" as const,
    viewport: { width: 1400, height: 900 },
    measure: "edge" as const,
  };

  test("reacts over the ends of the line, not only its middle", () => {
    const overLeftEnd = { x: 320, y: 208 };
    // From the centre this point is 180px away, outside the radius.
    expect(pointerDistance(overLeftEnd, line, "center")).toBeGreaterThan(60);
    expect(isAtRest(dodgeOffset({ ...edge, pointer: overLeftEnd }))).toBe(false);
  });

  test("slides away from the pointer along the line", () => {
    expect(dodgeOffset({ ...edge, pointer: { x: 320, y: 208 } }).x).toBeGreaterThan(0);
    expect(dodgeOffset({ ...edge, pointer: { x: 680, y: 208 } }).x).toBeLessThan(0);
    expect(dodgeOffset({ ...edge, pointer: { x: 320, y: 208 } }).y).toBe(0);
  });

  test("distance is to the nearest edge", () => {
    expect(pointerDistance({ x: 500, y: 180 }, line, "edge")).toBe(20);
    expect(pointerDistance({ x: 500, y: 208 }, line, "edge")).toBe(0);
    expect(isAtRest(dodgeOffset({ ...edge, pointer: { x: 500, y: 100 } }))).toBe(true);
  });
});
