/**
 * @jest-environment node
 */
import { createRateLimitBucket } from "@/lib/api/rateLimit";
import { constantTimeEqual } from "@/lib/api/constantTimeEqual";

const WINDOW = 15 * 60 * 1000;

describe("createRateLimitBucket", () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date("2026-09-17T12:00:00Z")));
  afterEach(() => jest.useRealTimers());

  describe("tripAndRecord (budget: every call counts)", () => {
    it("allows exactly `limit` calls, then trips", () => {
      const b = createRateLimitBucket();
      for (let i = 0; i < 5; i++) expect(b.tripAndRecord("ip", 5, WINDOW)).toBe(false);
      expect(b.tripAndRecord("ip", 5, WINDOW)).toBe(true);
    });

    it("starts a fresh window once the old one has passed", () => {
      const b = createRateLimitBucket();
      for (let i = 0; i < 5; i++) b.tripAndRecord("ip", 5, WINDOW);
      jest.advanceTimersByTime(WINDOW + 1);
      expect(b.tripAndRecord("ip", 5, WINDOW)).toBe(false);
    });

    it("keeps keys independent", () => {
      const b = createRateLimitBucket();
      for (let i = 0; i < 6; i++) b.tripAndRecord("a", 5, WINDOW);
      expect(b.tripAndRecord("b", 5, WINDOW)).toBe(false);
    });
  });

  describe("isTripped / record / reset (lockout: only failures count)", () => {
    // Regression: /api/invite called tripAndRecord ahead of the token
    // compare, so the admin's own sixth correct call in 15 minutes got 401.
    it("never trips on checks alone", () => {
      const b = createRateLimitBucket();
      for (let i = 0; i < 50; i++) expect(b.isTripped("admin", 5, WINDOW)).toBe(false);
    });

    it("trips after `limit` recorded failures and not before", () => {
      const b = createRateLimitBucket();
      for (let i = 0; i < 4; i++) b.record("ip", WINDOW);
      expect(b.isTripped("ip", 5, WINDOW)).toBe(false);
      b.record("ip", WINDOW);
      expect(b.isTripped("ip", 5, WINDOW)).toBe(true);
    });

    it("a success clears the count", () => {
      const b = createRateLimitBucket();
      for (let i = 0; i < 4; i++) b.record("ip", WINDOW);
      b.reset("ip");
      b.record("ip", WINDOW);
      expect(b.isTripped("ip", 5, WINDOW)).toBe(false);
    });

    it("unlocks when the window expires, and the next failure starts at 1", () => {
      const b = createRateLimitBucket();
      for (let i = 0; i < 5; i++) b.record("ip", WINDOW);
      jest.advanceTimersByTime(WINDOW + 1);
      expect(b.isTripped("ip", 5, WINDOW)).toBe(false);
      b.record("ip", WINDOW);
      expect(b.isTripped("ip", 2, WINDOW)).toBe(false);
    });
  });
});

describe("constantTimeEqual", () => {
  it.each([
    ["Bearer abc", "Bearer abc", true],
    ["Bearer abc", "Bearer abd", false],
    ["Bearer abc", "Bearer abcd", false], // prefix of the secret
    ["Bearer abcd", "Bearer abc", false],
    ["", "Bearer abc", false],
    ["", "", true],
  ])("%p vs %p -> %p", (a, b, want) => {
    expect(constantTimeEqual(a, b)).toBe(want);
  });
});
