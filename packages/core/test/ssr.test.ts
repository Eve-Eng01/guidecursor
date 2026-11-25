// @vitest-environment node
import { describe, expect, it } from "vitest";

describe("SSR safety", () => {
  it("imports and creates a guide without window or document", async () => {
    expect(typeof window).toBe("undefined");
    const mod = await import("../src");
    const guide = mod.createGuide({ tours: [{ id: "t", title: "T", steps: [{ target: "#a" }] }] });
    expect(guide.getState().phase).toBe("idle");
    expect(guide.getTourStatus("t")).toBe("new");
    expect(await guide.start("t")).toBe(false);
    await guide.init();
    guide.destroy();
    expect(mod.localStorageAdapter().load()).toBeNull();
  });
});
