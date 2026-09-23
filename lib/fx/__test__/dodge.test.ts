import { AT_REST, dodgeOffset, isAtRest } from "../dodge";

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
