/** True when running in a browser-like environment. Never evaluated at import time. */
export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function prefersReducedMotion(): boolean {
  if (!isBrowser() || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function raf(cb: FrameRequestCallback): number {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(cb);
  return setTimeout(() => cb(Date.now()), 16) as unknown as number;
}

export function cancelRaf(id: number): void {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
  else clearTimeout(id);
}

export function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
