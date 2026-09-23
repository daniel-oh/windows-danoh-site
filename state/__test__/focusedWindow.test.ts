import { createStore } from "jotai";
import { focusedWindowAtom, zOrderAtom } from "../focusedWindow";

describe("focusedWindowAtom z-order", () => {
  it("does not climb when the top window is focused again", () => {
    const store = createStore();
    store.set(focusedWindowAtom, "a");
    store.set(focusedWindowAtom, "b");
    const before = store.get(zOrderAtom).b;
    for (let i = 0; i < 1000; i++) store.set(focusedWindowAtom, "b");
    expect(store.get(zOrderAtom).b).toBe(before);
  });

  it("raises a window that is not on top", () => {
    const store = createStore();
    store.set(focusedWindowAtom, "a");
    store.set(focusedWindowAtom, "b");
    store.set(focusedWindowAtom, "a");
    const z = store.get(zOrderAtom);
    expect(z.a).toBeGreaterThan(z.b);
  });

  it("stays under the taskbar however long the session, keeping the order", () => {
    const store = createStore();
    for (let i = 0; i < 5000; i++) store.set(focusedWindowAtom, ["a", "b", "c"][i % 3]);
    const z = store.get(zOrderAtom);
    expect(Math.max(...Object.values(z))).toBeLessThan(1000);
    // The last one focused is on top.
    const order = Object.entries(z).sort((x, y) => x[1] - y[1]).map(([id]) => id);
    expect(order[order.length - 1]).toBe(["a", "b", "c"][4999 % 3]);
  });
});
