import { cancelRaf, now, raf } from "./env";

export interface Point {
  x: number;
  y: number;
}

// Arrow pointer drawn in a 24x24 box. The tip sits at (TIP_X, TIP_Y).
const TIP_X = 4;
const TIP_Y = 3;
const POINTER_PATH = "M4 3 L4 19.5 L8.6 15.4 L11.7 22.2 L14.6 20.9 L11.6 14.2 L17.8 14.2 Z";

const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Duration (ms) for a glide of `distance` px. Short hops are quick, long ones never drag. */
export function glideDuration(distance: number, speed = 1): number {
  const base = Math.min(1100, Math.max(380, 260 + distance * 0.55));
  return Math.max(0, base * speed);
}

/** A point on a gentle arc between `from` and `to` (quadratic Bézier), like a hand moving a mouse. */
export function arcPoint(from: Point, to: Point, t: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  // Bend perpendicular to the travel direction, proportional to distance (capped).
  const bend = Math.min(120, dist * 0.18);
  const cx = (from.x + to.x) / 2 + (-dy / dist) * bend;
  const cy = (from.y + to.y) / 2 + (dx / dist) * bend;
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * cx + t * t * to.x,
    y: u * u * from.y + 2 * u * t * cy + t * t * to.y,
  };
}

export class GuideCursorEl {
  readonly el: HTMLDivElement;
  private ripple: HTMLSpanElement;
  private labelEl: HTMLSpanElement;
  private pos: Point | null = null;
  private frame = 0;
  private fallback: ReturnType<typeof setTimeout> | undefined;
  private finishCurrent: (() => void) | null = null;

  constructor(doc: Document) {
    this.el = doc.createElement("div");
    this.el.className = "gc-cursor";
    this.el.setAttribute("aria-hidden", "true");
    this.el.dataset.state = "hidden";
    const ns = "http://www.w3.org/2000/svg";
    const svg = doc.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    svg.setAttribute("class", "gc-cursor-svg");
    const path = doc.createElementNS(ns, "path");
    path.setAttribute("d", POINTER_PATH);
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    this.ripple = doc.createElement("span");
    this.ripple.className = "gc-cursor-ripple";
    this.labelEl = doc.createElement("span");
    this.labelEl.className = "gc-cursor-label";
    this.el.append(this.ripple, svg, this.labelEl);
  }

  setLabel(label: string | undefined): void {
    this.labelEl.textContent = label ?? "";
    this.labelEl.hidden = !label;
  }

  get position(): Point | null {
    return this.pos ? { ...this.pos } : null;
  }

  get moving(): boolean {
    return this.finishCurrent !== null;
  }

  private place(p: Point): void {
    this.pos = p;
    this.el.style.transform = `translate3d(${p.x - TIP_X}px, ${p.y - TIP_Y}px, 0)`;
  }

  show(): void {
    this.el.dataset.state = this.moving ? "moving" : "idle";
    this.el.classList.add("gc-visible");
  }

  hide(): void {
    this.cancel();
    this.el.classList.remove("gc-visible");
    this.el.dataset.state = "hidden";
  }

  /** Snap to a point without animating (used while following a scrolling target). */
  jump(p: Point): void {
    this.place(p);
  }

  /**
   * Glide to the point returned by `getTo`. The destination is re-read every frame, so
   * the cursor still lands correctly if the page scrolls or reflows mid-flight.
   */
  moveTo(getTo: () => Point, opts: { reduced: boolean; speed?: number; ripple?: boolean }): Promise<void> {
    this.cancel();
    const to0 = getTo();
    const from = this.pos;
    if (!from || opts.reduced) {
      this.place(to0);
      this.show();
      if (!opts.reduced && opts.ripple !== false) this.pulse();
      this.el.dataset.state = "idle";
      return Promise.resolve();
    }
    const duration = glideDuration(Math.hypot(to0.x - from.x, to0.y - from.y), opts.speed);
    if (duration <= 0) {
      this.place(to0);
      return Promise.resolve();
    }
    this.el.dataset.state = "moving";
    this.show();
    return new Promise<void>((resolve) => {
      const start = now();
      const done = () => {
        cancelRaf(this.frame);
        clearTimeout(this.fallback);
        this.finishCurrent = null;
        this.place(getTo());
        this.el.dataset.state = "idle";
        if (opts.ripple !== false) this.pulse();
        resolve();
      };
      this.finishCurrent = done;
      const tick = () => {
        const t = Math.min(1, (now() - start) / duration);
        this.place(arcPoint(from, getTo(), easeInOutCubic(t)));
        if (t >= 1) done();
        else this.frame = raf(tick);
      };
      this.frame = raf(tick);
      // rAF is paused in background tabs; never leave the tour hanging on it.
      this.fallback = setTimeout(() => this.finishCurrent?.(), duration + 250);
    });
  }

  /** Finish any in-flight glide immediately (resolves its promise). */
  cancel(): void {
    this.finishCurrent?.();
  }

  pulse(): void {
    this.ripple.classList.remove("gc-pulse");
    // Force reflow so the animation restarts.
    void this.ripple.offsetWidth;
    this.ripple.classList.add("gc-pulse");
  }

  reset(): void {
    this.hide();
    this.pos = null;
  }
}
