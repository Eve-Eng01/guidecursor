import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Guide, GuideTour, StorageAdapter } from "../src";
import { createGuide, localStorageAdapter, memoryStorage } from "../src";
import { abcMarkup, html, makeGuide, popover, popoverTitle, spyStorage, threeSteps, waitForPhase } from "./helpers";

let guide: Guide | null = null;

beforeEach(() => {
  html(abcMarkup);
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  guide?.destroy();
  guide = null;
  document.body.innerHTML = "";
  localStorage.clear();
});

describe("state transitions", () => {
  it("starts, moves forward and back, then completes", async () => {
    const onStart = vi.fn();
    const onStep = vi.fn();
    const onComplete = vi.fn();
    const onEnd = vi.fn();
    guide = makeGuide({ tours: [threeSteps], onStart, onStep, onComplete, onEnd });

    expect(guide.getState().phase).toBe("idle");
    expect(await guide.start("t")).toBe(true);
    await waitForPhase(guide, "showing");
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(popoverTitle()).toBe("Step A");
    expect(guide.getState()).toMatchObject({ tourId: "t", stepIndex: 0, stepCount: 3 });

    await guide.next();
    expect(guide.getState().stepIndex).toBe(1);
    expect(popoverTitle()).toBe("Step B");

    await guide.back();
    expect(guide.getState().stepIndex).toBe(0);

    await guide.goTo("c");
    expect(popoverTitle()).toBe("Step C");
    expect(popover()?.querySelector(".gc-next")?.textContent).toBe("Done");

    await guide.next();
    expect(guide.getState()).toMatchObject({ phase: "idle", tourId: null });
    expect(guide.getTourStatus("t")).toBe("completed");
    expect(onComplete).toHaveBeenCalledWith({ tour: threeSteps });
    expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ reason: "completed" }));
    expect(onStep.mock.calls.map((c) => c[0].index)).toEqual([0, 1, 0, 2]);
    expect(popover()).toBeNull();
  });

  it("returns false for unknown or empty tours", async () => {
    guide = makeGuide({ tours: [{ id: "empty", title: "E", steps: [] }] });
    expect(await guide.start("nope")).toBe(false);
    expect(await guide.start("empty")).toBe(false);
  });

  it("notifies subscribers with immutable snapshots", async () => {
    guide = makeGuide({ tours: [threeSteps] });
    const seen: string[] = [];
    const before = guide.getState();
    const unsub = guide.subscribe((s) => seen.push(s.phase));
    await guide.start("t");
    await waitForPhase(guide, "showing");
    unsub();
    expect(guide.getState()).not.toBe(before);
    expect(seen).toContain("waiting");
    expect(seen.at(-1)).toBe("showing");
  });

  it("starting another tour stops the current one but keeps its progress", async () => {
    const other: GuideTour = { id: "o", title: "Other", steps: [{ target: "#c", title: "Other step" }] };
    guide = makeGuide({ tours: [threeSteps, other] });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    await guide.next();
    await guide.start("o");
    await waitForPhase(guide, "showing");
    expect(popoverTitle()).toBe("Other step");
    expect(guide.getTourStatus("t")).toBe("in-progress");
    expect(guide.getState().progress.t?.step).toBe(1);
  });

  it("supports centered steps with no target", async () => {
    guide = makeGuide({ tours: [{ id: "c", title: "C", steps: [{ title: "Hello", content: "Centered" }] }] });
    await guide.start("c");
    await waitForPhase(guide, "showing");
    expect(popover()?.dataset.placement).toBe("center");
    expect(document.querySelector(".gc-cursor")?.classList.contains("gc-visible")).toBe(false);
  });

  it("keeps working when a callback throws", async () => {
    const onError = vi.fn();
    guide = makeGuide({
      tours: [threeSteps],
      onStep: () => {
        throw new Error("analytics down");
      },
      onError,
    });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    await guide.next();
    expect(guide.getState().stepIndex).toBe(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ type: "callback" }));
  });
});

describe("skip, dismiss and keyboard", () => {
  it("skip ends the tour, records the step and fires onSkip", async () => {
    const onSkip = vi.fn();
    const storage = spyStorage();
    guide = makeGuide({ tours: [threeSteps], onSkip, storage });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    await guide.next();
    guide.skip();
    expect(guide.getState().tourId).toBeNull();
    expect(guide.getTourStatus("t")).toBe("skipped");
    expect(onSkip).toHaveBeenCalledWith(expect.objectContaining({ index: 1 }));
    await vi.waitFor(() => expect(storage.saves.at(-1)?.tours.t?.status).toBe("skipped"));
    expect(storage.saves.at(-1)?.active).toBeNull();
  });

  it("the × button skips", async () => {
    guide = makeGuide({ tours: [threeSteps] });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    popover()?.querySelector<HTMLButtonElement>(".gc-close")?.click();
    expect(guide.getTourStatus("t")).toBe("skipped");
  });

  it("Esc skips; arrows and Enter navigate", async () => {
    guide = makeGuide({ tours: [threeSteps] });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    const pop = popover()!;
    expect(document.activeElement).toBe(pop);

    pop.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await waitForPhase(guide, "showing");
    expect(guide.getState().stepIndex).toBe(1);

    popover()!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    await vi.waitFor(() => expect(guide!.getState().stepIndex).toBe(0));
    await waitForPhase(guide, "showing");

    popover()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await vi.waitFor(() => expect(guide!.getState().stepIndex).toBe(1));
    await waitForPhase(guide, "showing");

    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(guide.getTourStatus("t")).toBe("skipped");
  });

  it("ignores arrow keys typed into page inputs, and Esc already handled by the page", async () => {
    document.body.insertAdjacentHTML("beforeend", '<input id="field" />');
    guide = makeGuide({ tours: [threeSteps] });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    const field = document.getElementById("field")!;
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const handled = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    handled.preventDefault();
    document.body.dispatchEvent(handled);
    expect(guide.getState()).toMatchObject({ tourId: "t", stepIndex: 0 });
  });

  it("keyboard: false disables shortcuts", async () => {
    guide = makeGuide({ tours: [threeSteps], keyboard: false });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(guide.getState().tourId).toBe("t");
  });

  it("dismiss mutes auto-start for every tour", async () => {
    const onDismiss = vi.fn();
    const auto: GuideTour = {
      id: "auto",
      title: "Auto",
      autoStart: true,
      autoStartDelay: 0,
      steps: [{ target: "#a" }],
    };
    const storage = memoryStorage();
    guide = makeGuide({ tours: [threeSteps, auto], onDismiss, storage });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    popover()?.querySelector<HTMLButtonElement>(".gc-dismiss")?.click();
    expect(onDismiss).toHaveBeenCalled();
    expect(guide.getState().muted).toBe(true);
    expect(guide.getTourStatus("t")).toBe("dismissed");
    guide.destroy();

    guide = makeGuide({ tours: [threeSteps, auto], storage });
    await guide.init();
    await new Promise((r) => setTimeout(r, 20));
    expect(guide.getState().tourId).toBeNull();
  });
});

describe("persistence and resume", () => {
  it("resumes a skipped tour where the user left off", async () => {
    const storage = memoryStorage();
    guide = makeGuide({ tours: [threeSteps], storage });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    await guide.next();
    await guide.next();
    guide.skip();
    guide.destroy();

    guide = makeGuide({ tours: [threeSteps], storage });
    await guide.ready;
    expect(guide.getTourStatus("t")).toBe("skipped");
    await guide.resume("t");
    await waitForPhase(guide, "showing");
    expect(guide.getState().stepIndex).toBe(2);
    expect(popoverTitle()).toBe("Step C");
  });

  it("resumes the active tour on load (e.g. after a full page navigation)", async () => {
    const storage = memoryStorage({
      v: 1,
      tours: { t: { status: "in-progress", step: 1, updatedAt: 1 } },
      active: { tourId: "t", step: 1 },
      muted: false,
    });
    const onStart = vi.fn();
    guide = makeGuide({ tours: [threeSteps], storage, onStart });
    await guide.init();
    await waitForPhase(guide, "showing");
    expect(onStart).toHaveBeenCalled();
    expect(popoverTitle()).toBe("Step B");
  });

  it("does not resume on load when resumeOnLoad is false", async () => {
    const storage = memoryStorage({
      v: 1,
      tours: { t: { status: "in-progress", step: 1, updatedAt: 1 } },
      active: { tourId: "t", step: 1 },
      muted: false,
    });
    guide = makeGuide({ tours: [threeSteps], storage, resumeOnLoad: false });
    await guide.init();
    expect(guide.getState().tourId).toBeNull();
  });

  it("stop() keeps the tour in progress without auto-resuming it later", async () => {
    const storage = memoryStorage();
    guide = makeGuide({ tours: [threeSteps], storage });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    guide.stop();
    expect(guide.getTourStatus("t")).toBe("in-progress");
    guide.destroy();
    guide = makeGuide({ tours: [threeSteps], storage });
    await guide.init();
    expect(guide.getState().tourId).toBeNull();
  });

  it("destroy() keeps the active tour so a remount resumes it", async () => {
    const storage = memoryStorage();
    guide = makeGuide({ tours: [threeSteps], storage });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    await guide.next();
    guide.destroy();
    expect(document.querySelector(".gc-root")).toBeNull();
    await guide.init();
    await waitForPhase(guide, "showing");
    expect(popoverTitle()).toBe("Step B");
  });

  it("survives a storage adapter that throws on load and save", async () => {
    const onError = vi.fn();
    const broken: StorageAdapter = {
      load: () => {
        throw new Error("load failed");
      },
      save: async () => {
        throw new Error("save failed");
      },
    };
    guide = makeGuide({ tours: [threeSteps], storage: broken, onError });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    await guide.next();
    guide.skip();
    expect(guide.getTourStatus("t")).toBe("skipped");
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ type: "storage" })));
    expect(onError.mock.calls.filter((c) => c[0].type === "storage").length).toBeGreaterThanOrEqual(2);
  });

  it("localStorageAdapter tolerates corrupted JSON and throwing storage", () => {
    localStorage.setItem("guidecursor", "{not json");
    const adapter = localStorageAdapter();
    expect(adapter.load()).toBeNull();

    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => adapter.save({ v: 1, tours: {}, active: null, muted: false })).not.toThrow();
    setItem.mockRestore();

    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(adapter.load()).toBeNull();
    getItem.mockRestore();
  });

  it("localStorageAdapter round-trips and normalises data", async () => {
    const adapter = localStorageAdapter({ key: "k" });
    guide = makeGuide({ tours: [threeSteps], storage: adapter });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    guide.complete();
    const saved = JSON.parse(localStorage.getItem("k")!);
    expect(saved.tours.t.status).toBe("completed");

    localStorage.setItem(
      "k",
      JSON.stringify({ tours: { x: { status: "bogus" }, y: { status: "skipped", step: -3 } } }),
    );
    expect(adapter.load()).toEqual({
      v: 1,
      tours: { y: { status: "skipped", step: 0, updatedAt: 0 } },
      active: null,
      muted: false,
    });
  });

  it("reset() forgets progress", async () => {
    guide = makeGuide({ tours: [threeSteps] });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    guide.complete();
    expect(guide.getTourStatus("t")).toBe("completed");
    guide.reset("t");
    expect(guide.getTourStatus("t")).toBe("new");
  });
});

describe("targets", () => {
  it("waits for a target that appears later", async () => {
    html('<button id="a">A</button>');
    guide = makeGuide({ tours: [threeSteps], targetTimeout: 1000 });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    const pending = guide.next();
    expect(guide.getState().phase).toBe("waiting");
    setTimeout(() => document.body.insertAdjacentHTML("beforeend", '<button id="b">B</button>'), 30);
    await pending;
    expect(popoverTitle()).toBe("Step B");
  });

  it("skips a step whose target never appears (default)", async () => {
    const onError = vi.fn();
    html('<button id="a">A</button><button id="c">C</button>');
    guide = makeGuide({ tours: [threeSteps], targetTimeout: 50, onError });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    await guide.next();
    expect(popoverTitle()).toBe("Step C");
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ type: "target-missing", index: 1 }));
  });

  it("skips backwards over a missing target when going back", async () => {
    html('<button id="a">A</button><button id="c">C</button>');
    guide = makeGuide({ tours: [threeSteps], targetTimeout: 30 });
    await guide.start("t", { step: "c" });
    await waitForPhase(guide, "showing");
    await guide.back();
    expect(popoverTitle()).toBe("Step A");
  });

  it("can end the tour on a missing target", async () => {
    const onEnd = vi.fn();
    html('<button id="a">A</button>');
    guide = makeGuide({ tours: [threeSteps], targetTimeout: 30, onMissingTarget: "end", onEnd });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    await guide.next();
    expect(guide.getState().tourId).toBeNull();
    expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ reason: "error" }));
    expect(guide.getTourStatus("t")).toBe("in-progress");
  });

  it("can show a missing-target step centered", async () => {
    html('<button id="a">A</button>');
    guide = makeGuide({ tours: [threeSteps], targetTimeout: 30, onMissingTarget: "center" });
    await guide.start("t", { step: 1 });
    await waitForPhase(guide, "showing");
    expect(popoverTitle()).toBe("Step B");
    expect(popover()?.dataset.placement).toBe("center");
  });

  it("a step can override onMissingTarget", async () => {
    html('<button id="a">A</button><button id="c">C</button>');
    const tour: GuideTour = {
      ...threeSteps,
      steps: threeSteps.steps.map((s) => (s.id === "b" ? { ...s, onMissingTarget: "center" as const } : s)),
    };
    guide = makeGuide({ tours: [tour], targetTimeout: 30 });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    await guide.next();
    expect(popoverTitle()).toBe("Step B");
    expect(popover()?.dataset.placement).toBe("center");
  });

  it("accepts element getters and elements as targets", async () => {
    const el = document.getElementById("b")!;
    guide = makeGuide({
      tours: [
        {
          id: "g",
          title: "G",
          steps: [
            { target: () => document.getElementById("a"), title: "getter" },
            { target: el, title: "element" },
          ],
        },
      ],
    });
    await guide.start("g");
    await waitForPhase(guide, "showing");
    expect(popoverTitle()).toBe("getter");
    await guide.next();
    expect(popoverTitle()).toBe("element");
  });

  it("advances when the target is clicked (advanceOn)", async () => {
    const tour: GuideTour = {
      id: "c",
      title: "C",
      steps: [
        { target: "#a", advanceOn: "click" },
        { target: "#b", title: "after click" },
      ],
    };
    guide = makeGuide({ tours: [tour] });
    await guide.start("c");
    await waitForPhase(guide, "showing");
    document.getElementById("a")!.click();
    await vi.waitFor(() => expect(popoverTitle()).toBe("after click"));
  });

  it("re-anchors when the target is re-rendered", async () => {
    guide = makeGuide({ tours: [threeSteps], targetTimeout: 1000 });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    const firstTarget = document.getElementById("a")!;
    firstTarget.remove();
    guide.refresh();
    await vi.waitFor(() => expect(guide!.getState().phase).toBe("waiting"));
    document.body.insertAdjacentHTML("afterbegin", '<button id="a">A again</button>');
    await waitForPhase(guide, "showing");
    expect(popoverTitle()).toBe("Step A");
  });
});

describe("conditional steps (when)", () => {
  const withWhen = (applies: (id: string) => boolean): GuideTour => ({
    ...threeSteps,
    steps: threeSteps.steps.map((s) => ({ ...s, when: () => applies(s.id) })),
  });

  it("passes over a step that doesn't apply, without reporting an error", async () => {
    const onError = vi.fn();
    const onStep = vi.fn();
    guide = makeGuide({ tours: [withWhen((id) => id !== "b")], onError, onStep });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    await guide.next();
    expect(popoverTitle()).toBe("Step C");
    expect(onError).not.toHaveBeenCalled();
    expect(onStep.mock.calls.map((c) => c[0].index)).toEqual([0, 2]);
  });

  it("skips backwards when going back", async () => {
    guide = makeGuide({ tours: [withWhen((id) => id !== "b")] });
    await guide.start("t", { step: "c" });
    await waitForPhase(guide, "showing");
    await guide.back();
    expect(popoverTitle()).toBe("Step A");
  });

  it("turns around when nothing before the step applies", async () => {
    guide = makeGuide({ tours: [withWhen((id) => id !== "a")] });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    expect(popoverTitle()).toBe("Step B");
    await guide.back();
    expect(popoverTitle()).toBe("Step B");
  });

  it("completes the tour when no later step applies", async () => {
    const onComplete = vi.fn();
    guide = makeGuide({ tours: [withWhen((id) => id === "a")], onComplete });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    await guide.next();
    expect(guide.getState().tourId).toBeNull();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("runs after beforeShow, supports async conditions, and shows the step if the condition throws", async () => {
    const order: string[] = [];
    const onError = vi.fn();
    const tour: GuideTour = {
      id: "w",
      title: "When",
      steps: [
        {
          target: "#a",
          title: "Async",
          beforeShow: () => void order.push("beforeShow"),
          when: async () => {
            order.push("when");
            await new Promise((r) => setTimeout(r, 10));
            return true;
          },
        },
        {
          target: "#b",
          title: "Throws",
          when: () => {
            throw new Error("boom");
          },
        },
      ],
    };
    guide = makeGuide({ tours: [tour], onError });
    await guide.start("w");
    await waitForPhase(guide, "showing");
    expect(order).toEqual(["beforeShow", "when"]);
    expect(popoverTitle()).toBe("Async");
    await guide.next();
    expect(popoverTitle()).toBe("Throws");
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ type: "callback", index: 1 }));
  });
});

describe("routes", () => {
  const routed: GuideTour = {
    id: "r",
    title: "Routed",
    steps: [
      { target: "#a", route: "/", title: "Home" },
      { target: "#settings-form", route: "/settings", title: "Settings" },
      { target: "#a", route: "/", title: "Back home" },
    ],
  };

  it("calls navigate, persists first, then waits for the target", async () => {
    const storage = spyStorage();
    let route = "/";
    const navigate = vi.fn(async (to: string) => {
      // Progress must already be saved, so a full page load could resume here.
      expect(storage.saves.at(-1)?.active).toEqual({ tourId: "r", step: 1 });
      route = to;
      setTimeout(() => {
        document.body.innerHTML = '<form id="settings-form"></form>';
      }, 20);
    });
    guide = makeGuide({ tours: [routed], storage, navigate, getCurrentRoute: () => route, targetTimeout: 1000 });
    await guide.start("r");
    await waitForPhase(guide, "showing");
    expect(navigate).not.toHaveBeenCalled();

    await guide.next();
    expect(navigate).toHaveBeenCalledWith("/settings");
    expect(popoverTitle()).toBe("Settings");

    // Going back to "/" navigates again.
    const back = guide.next();
    await vi.waitFor(() => expect(navigate).toHaveBeenLastCalledWith("/"));
    document.body.innerHTML = '<button id="a">A</button>';
    await back;
    expect(popoverTitle()).toBe("Back home");
  });

  it("does not navigate when the route already matches (ignores trailing slash and query)", async () => {
    const navigate = vi.fn();
    html('<form id="settings-form"></form>');
    guide = makeGuide({ tours: [routed], navigate, getCurrentRoute: () => "/settings/" });
    await guide.start("r", { step: 1 });
    await waitForPhase(guide, "showing");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("supports custom route matchers for dynamic segments", async () => {
    const navigate = vi.fn();
    html('<div id="ev"></div>');
    const tour: GuideTour = {
      id: "d",
      title: "D",
      steps: [{ target: "#ev", route: "/events/new", routeMatch: /^\/events\/[^/]+$/ }],
    };
    guide = makeGuide({ tours: [tour], navigate, getCurrentRoute: () => "/events/42" });
    await guide.start("d");
    await waitForPhase(guide, "showing");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("reports navigation errors and keeps going", async () => {
    const onError = vi.fn();
    html('<form id="settings-form"></form>');
    guide = makeGuide({
      tours: [routed],
      navigate: () => {
        throw new Error("router exploded");
      },
      getCurrentRoute: () => "/",
      onError,
    });
    await guide.start("r", { step: 1 });
    await waitForPhase(guide, "showing");
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ type: "navigation" }));
  });
});

describe("auto start", () => {
  it("never auto-starts unless a tour opts in", async () => {
    guide = makeGuide({ tours: [threeSteps] });
    await guide.init();
    await new Promise((r) => setTimeout(r, 20));
    expect(guide.getState().tourId).toBeNull();
  });

  it("auto-starts a new tour whose condition passes, only once", async () => {
    const storage = memoryStorage();
    const when = vi.fn(({ route }: { route: string }) => route === "/dashboard");
    const auto: GuideTour = { ...threeSteps, id: "auto", autoStart: when, autoStartDelay: 0 };
    let route = "/";
    guide = makeGuide({ tours: [auto], storage, getCurrentRoute: () => route });
    await guide.init();
    await new Promise((r) => setTimeout(r, 10));
    expect(guide.getState().tourId).toBeNull();

    route = "/dashboard";
    await guide.checkAutoStart();
    await waitForPhase(guide, "showing");
    expect(guide.getState().tourId).toBe("auto");
    guide.skip();

    await guide.checkAutoStart();
    await new Promise((r) => setTimeout(r, 10));
    expect(guide.getState().tourId).toBeNull();
  });

  it("autoStart: false on the guide disables auto-start entirely", async () => {
    const auto: GuideTour = { ...threeSteps, id: "auto", autoStart: true, autoStartDelay: 0 };
    guide = makeGuide({ tours: [auto], autoStart: false });
    await guide.init();
    await new Promise((r) => setTimeout(r, 10));
    expect(guide.getState().tourId).toBeNull();
  });
});

describe("accessibility", () => {
  it("renders a non-modal dialog with labelled content and a live region", async () => {
    guide = makeGuide({ tours: [threeSteps] });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    const pop = popover()!;
    expect(pop.getAttribute("role")).toBe("dialog");
    expect(pop.getAttribute("aria-modal")).toBe("false");
    const title = document.getElementById(pop.getAttribute("aria-labelledby")!);
    expect(title?.textContent).toBe("Step A");
    const live = document.querySelector("[aria-live=polite]");
    expect(live?.textContent).toContain("Step A");
    expect(live?.textContent).toContain("First");
    expect(document.querySelector(".gc-cursor")?.getAttribute("aria-hidden")).toBe("true");
    expect(pop.querySelector(".gc-close")?.getAttribute("aria-label")).toBe("Skip tour");
  });

  it("renders string content as text, never HTML", async () => {
    guide = makeGuide({
      tours: [{ id: "x", title: "X", steps: [{ title: "<b>t</b>", content: "<img src=x onerror=alert(1)>" }] }],
    });
    await guide.start("x");
    await waitForPhase(guide, "showing");
    expect(popover()?.querySelector("img")).toBeNull();
    expect(popover()?.querySelector(".gc-body")?.textContent).toBe("<img src=x onerror=alert(1)>");
  });

  it("restores focus to the previously focused element when the tour ends", async () => {
    const trigger = document.getElementById("c")!;
    trigger.focus();
    guide = makeGuide({ tours: [threeSteps] });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    expect(document.activeElement).toBe(popover());
    guide.skip();
    expect(document.activeElement).toBe(trigger);
  });

  it("uses custom labels", async () => {
    guide = makeGuide({ tours: [threeSteps], labels: { next: "Weiter", progress: (c, t) => `Schritt ${c}/${t}` } });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    expect(popover()?.querySelector(".gc-next")?.textContent).toBe("Weiter");
    expect(popover()?.querySelector(".gc-progress")?.textContent).toBe("Schritt 1/3");
  });
});

describe("styles", () => {
  it("injects the stylesheet once, and not at all with injectStyles: false", async () => {
    document.getElementById("guidecursor-styles")?.remove();
    guide = makeGuide({ tours: [threeSteps], injectStyles: false });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    expect(document.getElementById("guidecursor-styles")).toBeNull();
    guide.destroy();
    guide = createGuide({ tours: [threeSteps], storage: memoryStorage(), motion: "reduce", init: false });
    await guide.start("t");
    await waitForPhase(guide, "showing");
    await guide.next();
    expect(document.querySelectorAll("#guidecursor-styles").length).toBe(1);
  });
});
