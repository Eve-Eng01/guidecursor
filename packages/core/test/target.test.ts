import { afterEach, describe, expect, it } from "vitest";
import { resolveTarget, waitForElement } from "../src";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("waitForElement", () => {
  it("resolves immediately when the element exists", async () => {
    document.body.innerHTML = '<p id="x"></p>';
    expect((await waitForElement("#x"))?.id).toBe("x");
  });

  it("resolves when the element is added later", async () => {
    setTimeout(() => document.body.insertAdjacentHTML("beforeend", '<p id="late"></p>'), 20);
    const el = await waitForElement("#late", { timeout: 1000 });
    expect(el?.id).toBe("late");
  });

  it("resolves null on timeout", async () => {
    const start = Date.now();
    expect(await waitForElement("#never", { timeout: 40 })).toBeNull();
    expect(Date.now() - start).toBeGreaterThanOrEqual(35);
  });

  it("resolves null when aborted", async () => {
    const c = new AbortController();
    const p = waitForElement("#never", { timeout: 5000, signal: c.signal });
    c.abort();
    expect(await p).toBeNull();
  });

  it("treats invalid selectors and throwing getters as not found", () => {
    expect(resolveTarget("##bad")).toBeNull();
    expect(
      resolveTarget(() => {
        throw new Error("boom");
      }),
    ).toBeNull();
  });
});
