import { describe, expect, it } from "vitest";
import { arcPoint, computePosition, glideDuration, routeMatches } from "../src";

const vp = { width: 1000, height: 800 };
const pop = { width: 300, height: 150 };

describe("computePosition", () => {
  it("places below by default when there is room", () => {
    const r = computePosition({ top: 100, left: 400, width: 200, height: 40 }, pop, vp);
    expect(r).toEqual({ x: 350, y: 154, placement: "bottom" });
  });

  it("flips to the top when there is no room below", () => {
    const r = computePosition({ top: 700, left: 400, width: 200, height: 40 }, pop, vp, { placement: "bottom" });
    expect(r.placement).toBe("top");
    expect(r.y).toBe(700 - 150 - 14);
  });

  it("honours a preferred side that fits", () => {
    const r = computePosition({ top: 300, left: 100, width: 100, height: 40 }, pop, vp, {
      placement: "right",
      offset: 10,
    });
    expect(r.placement).toBe("right");
    expect(r.x).toBe(210);
  });

  it("shifts back inside the viewport near the edges", () => {
    const r = computePosition({ top: 100, left: 960, width: 30, height: 30 }, pop, vp, { placement: "bottom" });
    expect(r.x).toBe(1000 - 300 - 8);
    const l = computePosition({ top: 100, left: 0, width: 30, height: 30 }, pop, vp, { placement: "bottom" });
    expect(l.x).toBe(8);
  });

  it("aligns start/end", () => {
    const ref = { top: 100, left: 400, width: 200, height: 40 };
    expect(computePosition(ref, pop, vp, { align: "start" }).x).toBe(400);
    expect(computePosition(ref, pop, vp, { align: "end" }).x).toBe(300);
  });

  it("uses the roomiest side when nothing fits", () => {
    const r = computePosition({ top: 50, left: 50, width: 900, height: 700 }, pop, vp);
    expect(["top", "bottom", "left", "right"]).toContain(r.placement);
    expect(r.y).toBeGreaterThanOrEqual(8);
    expect(r.y + pop.height).toBeLessThanOrEqual(800 - 8);
  });

  it("centers when there is no reference", () => {
    expect(computePosition(null, pop, vp)).toEqual({ x: 350, y: 325, placement: "center" });
  });
});

describe("cursor path", () => {
  it("starts and ends exactly on the endpoints and bends in between", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 400, y: 0 };
    expect(arcPoint(a, b, 0)).toEqual(a);
    expect(arcPoint(a, b, 1)).toEqual(b);
    expect(Math.abs(arcPoint(a, b, 0.5).y)).toBeGreaterThan(10);
  });

  it("scales duration with distance within bounds", () => {
    expect(glideDuration(0)).toBe(380);
    expect(glideDuration(5000)).toBe(1100);
    expect(glideDuration(400)).toBeGreaterThan(glideDuration(100));
    expect(glideDuration(400, 0.5)).toBe(glideDuration(400) / 2);
  });
});

describe("routeMatches", () => {
  it("compares paths, ignoring trailing slashes, query and hash", () => {
    expect(routeMatches("/settings", "/settings/")).toBe(true);
    expect(routeMatches("/settings?tab=payouts", "/settings")).toBe(true);
    expect(routeMatches("/", "/")).toBe(true);
    expect(routeMatches("/a", "/b")).toBe(false);
  });
  it("supports RegExp and functions", () => {
    expect(routeMatches(/^\/events\/\d+$/, "/events/12")).toBe(true);
    expect(routeMatches((p) => p.startsWith("/org"), "/org/x")).toBe(true);
  });
});
