import { act, render } from "@testing-library/react";
import { Odometer } from "../Odometer";

// jsdom has no rAF by default in this config; drive it by hand so the
// "settled" frame is deterministic.
beforeEach(() => {
  let cb: FrameRequestCallback | null = null;
  window.requestAnimationFrame = (fn) => {
    cb = fn;
    return 1;
  };
  window.cancelAnimationFrame = () => {};
  (window as unknown as { __tick: () => void }).__tick = () => cb?.(0);
});

const strips = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('[class*="strip"]'));

describe("Odometer", () => {
  test("renders every digit at 0 first, then rolls to the value", () => {
    const { container } = render(<Odometer value={1234} />);
    expect(strips(container).map((s) => s.style.transform)).toEqual(
      Array(4).fill("translateY(0%)")
    );
    act(() => (window as unknown as { __tick: () => void }).__tick());
    expect(strips(container).map((s) => s.style.transform)).toEqual([
      "translateY(-10%)",
      "translateY(-20%)",
      "translateY(-30%)",
      "translateY(-40%)",
    ]);
  });

  test("keeps separators and staggers from the right", () => {
    const { container } = render(<Odometer value={12345} />);
    act(() => (window as unknown as { __tick: () => void }).__tick());
    expect(container.textContent?.includes(",")).toBe(true);
    const delays = strips(container).map((s) => s.style.transitionDelay);
    expect(delays).toEqual(["360ms", "270ms", "180ms", "90ms", "0ms"]);
  });

  test("is hidden from assistive tech (the badge carries the label)", () => {
    const { container } = render(<Odometer value={7} />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });
});
