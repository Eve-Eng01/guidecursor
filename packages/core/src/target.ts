import type { TargetInput } from "./types";

export function resolveTarget(target: TargetInput, root: ParentNode = document): Element | null {
  try {
    if (typeof target === "string") return root.querySelector(target);
    if (typeof target === "function") return target() ?? null;
    return target;
  } catch {
    // Invalid selector or a throwing getter: treat as "not found".
    return null;
  }
}

/** Connected and rendered (not display:none / inside a hidden ancestor). */
export function isUsable(el: Element): boolean {
  if (!el.isConnected) return false;
  const check = (el as Element & { checkVisibility?: (o?: object) => boolean }).checkVisibility;
  if (typeof check === "function") {
    try {
      return check.call(el);
    } catch {
      return true;
    }
  }
  return true;
}

export interface WaitForElementOptions {
  /** Give up after this many ms and resolve null. Default 5000. `Infinity` waits forever. */
  timeout?: number;
  signal?: AbortSignal;
  root?: ParentNode;
}

/**
 * Resolves the target as soon as it exists and is visible. Uses a MutationObserver
 * (plus a slow poll for CSS-only visibility changes) and resolves null on timeout or abort.
 */
export function waitForElement(target: TargetInput, options: WaitForElementOptions = {}): Promise<Element | null> {
  const { timeout = 5000, signal, root = document } = options;
  return new Promise((resolve) => {
    const check = (): Element | null => {
      const el = resolveTarget(target, root);
      return el && isUsable(el) ? el : null;
    };
    const found = check();
    if (found || signal?.aborted) {
      resolve(found);
      return;
    }

    let done = false;
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    const finish = (el: Element | null) => {
      if (done) return;
      done = true;
      observer?.disconnect();
      clearTimeout(timer);
      clearInterval(poll);
      signal?.removeEventListener("abort", onAbort);
      resolve(el);
    };
    const onAbort = () => finish(null);
    const tryResolve = () => {
      const el = check();
      if (el) finish(el);
    };

    if (typeof MutationObserver === "function") {
      observer = new MutationObserver(tryResolve);
      const node = (root as Document).documentElement ?? (root as Node);
      observer.observe(node, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "hidden", "id", "open", "aria-hidden", "data-state"],
      });
    }
    poll = setInterval(tryResolve, 200);
    if (Number.isFinite(timeout)) timer = setTimeout(() => finish(null), timeout);
    signal?.addEventListener("abort", onAbort);
  });
}
