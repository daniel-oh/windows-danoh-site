import { padForKey, padForKeyEvent, secondsLabel } from "../pads";

describe("padForKeyEvent", () => {
  it("follows the physical key, so AZERTY keeps the grid", () => {
    // On AZERTY the key where QWERTY has Z types "w".
    expect(padForKeyEvent({ code: "KeyZ", key: "w" })).toBe(padForKey("z"));
    expect(padForKeyEvent({ code: "Digit1", key: "&" })).toBe(padForKey("1"));
  });

  it("ignores keys outside the grid", () => {
    expect(padForKeyEvent({ code: "KeyP", key: "p" })).toBe(-1);
    expect(padForKeyEvent({ code: "Numpad1", key: "1" })).toBe(-1);
  });

  it("falls back to the character when there is no code (virtual keyboards)", () => {
    expect(padForKeyEvent({ code: "", key: "z" })).toBe(padForKey("z"));
  });
});

describe("secondsLabel", () => {
  // 288,000 frames per pad at the rates devices actually run.
  it.each([
    [288_000 / 48_000, "6"],
    [288_000 / 44_100, "6.5"],
    [288_000 / 96_000, "3"],
  ])("%p seconds reads as %s", (seconds, label) => {
    expect(secondsLabel(seconds)).toBe(label);
  });
});
