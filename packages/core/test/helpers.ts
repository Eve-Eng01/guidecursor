import { vi } from "vitest";
import type { Guide, GuideOptions, GuidePhase, PersistedData, StorageAdapter } from "../src";
import { createGuide, memoryStorage } from "../src";

export function html(markup: string): void {
  document.body.innerHTML = markup;
}

export function makeGuide(options: GuideOptions = {}): Guide {
  return createGuide({
    storage: memoryStorage(),
    motion: "reduce",
    init: false,
    targetTimeout: 200,
    ...options,
  });
}

export async function waitForPhase(guide: Guide, phase: GuidePhase): Promise<void> {
  await vi.waitFor(
    () => {
      if (guide.getState().phase !== phase) throw new Error(`phase is ${guide.getState().phase}, want ${phase}`);
    },
    { timeout: 2000, interval: 5 },
  );
}

export function popover(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".gc-popover.gc-visible");
}

export function popoverTitle(): string | null {
  return popover()?.querySelector(".gc-title")?.textContent ?? null;
}

/** Storage spy that records every save. */
export function spyStorage(initial?: PersistedData): StorageAdapter & { saves: PersistedData[] } {
  const inner = memoryStorage(initial);
  const saves: PersistedData[] = [];
  return {
    saves,
    load: () => inner.load(),
    save: (d) => {
      saves.push(JSON.parse(JSON.stringify(d)));
      return inner.save(d);
    },
  };
}

export const threeSteps = {
  id: "t",
  title: "Tour",
  steps: [
    { id: "a", target: "#a", title: "Step A", content: "First" },
    { id: "b", target: "#b", title: "Step B", content: "Second" },
    { id: "c", target: "#c", title: "Step C", content: "Third" },
  ],
};

export const abcMarkup = `<button id="a">A</button><button id="b">B</button><button id="c">C</button>`;
