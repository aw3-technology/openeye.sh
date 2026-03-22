import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import {
  timeAgo,
  formatDuration,
  formatElapsed,
  formatDateRange,
  latencyColor,
  fpsColor,
} from "../format-utils";

describe("format-utils", () => {
  // ── timeAgo ───────────────────────────────────────────────────

  describe("timeAgo", () => {
    it("returns 'just now' for timestamps within the last 60 seconds", () => {
      const now = new Date().toISOString();
      expect(timeAgo(now)).toBe("just now");
    });

    it("returns minutes ago", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
      expect(timeAgo(fiveMinAgo)).toBe("5m ago");
    });

    it("returns hours ago", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
      expect(timeAgo(twoHoursAgo)).toBe("2h ago");
    });

    it("returns days ago for less than 7 days", () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
      expect(timeAgo(threeDaysAgo)).toBe("3d ago");
    });

    it("returns locale date string for 7+ days", () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
      const result = timeAgo(tenDaysAgo);
      // Should not end with "ago"
      expect(result).not.toContain("ago");
      // Should be a date string like "3/11/2026" or similar locale format
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ── formatDuration ────────────────────────────────────────────

  describe("formatDuration", () => {
    it("formats seconds only", () => {
      expect(formatDuration(45)).toBe("45s");
    });

    it("formats sub-second as 0s", () => {
      expect(formatDuration(0.5)).toBe("0s");
    });

    it("formats minutes and seconds", () => {
      expect(formatDuration(125)).toBe("2m 5s");
    });

    it("formats exactly one minute", () => {
      expect(formatDuration(60)).toBe("1m 0s");
    });

    it("formats hours and minutes", () => {
      expect(formatDuration(3725)).toBe("1h 2m");
    });

    it("formats large durations", () => {
      expect(formatDuration(7200)).toBe("2h 0m");
    });
  });

  // ── formatElapsed ─────────────────────────────────────────────

  describe("formatElapsed", () => {
    it("returns <1m for very short durations", () => {
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 30_000).toISOString();
      expect(formatElapsed(start, end)).toBe("<1m");
    });

    it("returns minutes for sub-hour durations", () => {
      const start = new Date("2026-01-01T00:00:00Z").toISOString();
      const end = new Date("2026-01-01T00:15:00Z").toISOString();
      expect(formatElapsed(start, end)).toBe("15m");
    });

    it("returns hours and minutes", () => {
      const start = new Date("2026-01-01T00:00:00Z").toISOString();
      const end = new Date("2026-01-01T02:30:00Z").toISOString();
      expect(formatElapsed(start, end)).toBe("2h 30m");
    });

    it("returns days and hours for long durations", () => {
      const start = new Date("2026-01-01T00:00:00Z").toISOString();
      const end = new Date("2026-01-03T05:00:00Z").toISOString();
      expect(formatElapsed(start, end)).toBe("2d 5h");
    });

    it("uses Date.now() when endStr is null", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
      expect(formatElapsed(fiveMinAgo, null)).toBe("5m");
    });

    it("uses Date.now() when endStr is undefined", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
      expect(formatElapsed(fiveMinAgo)).toBe("5m");
    });
  });

  // ── formatDateRange ───────────────────────────────────────────

  describe("formatDateRange", () => {
    it("returns minutes only when less than an hour", () => {
      expect(formatDateRange("2026-01-01T00:00:00Z", "2026-01-01T00:45:00Z")).toBe("45m");
    });

    it("returns hours only when exact hours", () => {
      expect(formatDateRange("2026-01-01T00:00:00Z", "2026-01-01T03:00:00Z")).toBe("3h");
    });

    it("returns hours and minutes", () => {
      expect(formatDateRange("2026-01-01T00:00:00Z", "2026-01-01T02:15:00Z")).toBe("2h 15m");
    });
  });

  // ── latencyColor ──────────────────────────────────────────────

  describe("latencyColor", () => {
    it("returns green for low latency (<50ms)", () => {
      expect(latencyColor(30)).toBe("text-terminal-green");
    });

    it("returns amber for medium latency (50-149ms)", () => {
      expect(latencyColor(100)).toBe("text-terminal-amber");
    });

    it("returns red for high latency (>=150ms)", () => {
      expect(latencyColor(200)).toBe("text-red-400");
    });

    it("handles boundary at 50ms", () => {
      expect(latencyColor(50)).toBe("text-terminal-amber");
    });

    it("handles boundary at 150ms", () => {
      expect(latencyColor(150)).toBe("text-red-400");
    });
  });

  // ── fpsColor ──────────────────────────────────────────────────

  describe("fpsColor", () => {
    it("returns green for high FPS (>=20)", () => {
      expect(fpsColor(30)).toBe("text-terminal-green");
    });

    it("returns amber for medium FPS (10-19)", () => {
      expect(fpsColor(15)).toBe("text-terminal-amber");
    });

    it("returns red for low FPS (<10)", () => {
      expect(fpsColor(5)).toBe("text-red-400");
    });

    it("handles boundary at 20", () => {
      expect(fpsColor(20)).toBe("text-terminal-green");
    });

    it("handles boundary at 10", () => {
      expect(fpsColor(10)).toBe("text-terminal-amber");
    });
  });
});
