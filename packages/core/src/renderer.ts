import { GuideCursorEl, type Point } from "./cursor";
import { cancelRaf, isBrowser, prefersReducedMotion, raf } from "./env";
import { computePosition, isInViewport, type Rect } from "./position";
import { injectStyles } from "./styles";
import type { CursorOptions, GuideLabels, GuideOptions, GuideStep, GuideTour, PlacementOption } from "./types";

export interface RenderStep {
  tour: GuideTour;
  step: GuideStep;
  index: number;
  total: number;
  target: Element | null;
  content: string | Node | undefined;
}

export interface RendererCallbacks {
  onNext(): void;
  onBack(): void;
  onSkip(): void;
  onDismiss(): void;
  /** The current target left the DOM. */
  onTargetLost(): void;
}

export interface Renderer {
  show(step: RenderStep): Promise<void>;
  /** Hide popover + ring, keep the cursor where it is (between steps). */
  hideStep(): void;
  /** Hide everything (tour ended). */
  hide(): void;
  refresh(): void;
  destroy(): void;
  readonly popover: HTMLElement | null;
}

export type RendererOptions = Pick<
  GuideOptions,
  | "cursor"
  | "highlight"
  | "placement"
  | "offset"
  | "motion"
  | "focus"
  | "showDontShowAgain"
  | "showProgress"
  | "injectStyles"
  | "styleNonce"
  | "className"
  | "container"
> & { labels: GuideLabels };

let uid = 0;

export function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function viewport(): { width: number; height: number } {
  return { width: window.innerWidth, height: window.innerHeight };
}

/** Where the cursor tip rests on a target: the center of small targets, near the top-left of big ones. */
export function cursorPointFor(rect: Rect): Point {
  return {
    x: rect.left + Math.min(rect.width / 2, 56),
    y: rect.top + Math.min(rect.height / 2, 28),
  };
}

function needsScroll(rect: Rect): boolean {
  const vp = viewport();
  if (rect.height > vp.height * 0.8) return rect.top < 0 || rect.top > vp.height * 0.4;
  return !isInViewport(rect, vp, 8);
}

/** Waits until the element stops moving (smooth scroll finished), capped at `max` ms. */
function waitForSettle(el: Element, max = 900): Promise<void> {
  return new Promise((resolve) => {
    let last = rectOf(el);
    let stable = 0;
    const started = Date.now();
    let frame = 0;
    const tick = () => {
      const r = rectOf(el);
      stable = Math.abs(r.top - last.top) < 0.5 && Math.abs(r.left - last.left) < 0.5 ? stable + 1 : 0;
      last = r;
      if (stable >= 3 || Date.now() - started > max) {
        clearTimeout(timer);
        resolve();
      } else frame = raf(tick);
    };
    const timer = setTimeout(() => {
      cancelRaf(frame);
      resolve();
    }, max + 50);
    frame = raf(tick);
  });
}

export function createDomRenderer(getOptions: () => RendererOptions, cb: RendererCallbacks): Renderer {
  let root: HTMLDivElement | null = null;
  let cursor: GuideCursorEl | null = null;
  let ring: HTMLDivElement | null = null;
  let popover: HTMLDivElement | null = null;
  let live: HTMLDivElement | null = null;
  let titleEl: HTMLHeadingElement;
  let bodyEl: HTMLDivElement;
  let progressEl: HTMLParagraphElement;
  let backBtn: HTMLButtonElement;
  let nextBtn: HTMLButtonElement;
  let closeBtn: HTMLButtonElement;
  let dismissBtn: HTMLButtonElement;

  let current: RenderStep | null = null;
  let placement: PlacementOption = "auto";
  let frame = 0;
  let resizeObserver: ResizeObserver | null = null;
  let mutationObserver: MutationObserver | null = null;
  let lastPointer: Point | null = null;
  let showToken = 0;

  const reduced = () => {
    const m = getOptions().motion ?? "auto";
    return m === "reduce" || (m === "auto" && prefersReducedMotion());
  };
  const cursorOpts = (): CursorOptions | null => {
    const c = getOptions().cursor;
    if (c === false) return null;
    return c === true || c === undefined ? {} : c;
  };

  const onPointerMove = (e: PointerEvent) => {
    lastPointer = { x: e.clientX, y: e.clientY };
  };
  const schedule = () => {
    if (frame) return;
    frame = raf(() => {
      frame = 0;
      update();
    });
  };

  function button(cls: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  function mount(): void {
    if (!isBrowser()) return;
    if (root) {
      // Something (a full re-render of <body>) detached us: re-attach.
      if (!root.isConnected) (getOptions().container?.() ?? document.body).appendChild(root);
      return;
    }
    const o = getOptions();
    if (o.injectStyles !== false) injectStyles(document, o.styleNonce);
    const id = ++uid;
    root = document.createElement("div");
    root.className = `gc-root${o.className ? ` ${o.className}` : ""}`;
    root.setAttribute("data-guidecursor", "");

    ring = document.createElement("div");
    ring.className = "gc-ring";
    ring.setAttribute("aria-hidden", "true");

    popover = document.createElement("div");
    popover.className = "gc-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-modal", "false");
    popover.setAttribute("aria-labelledby", `gc-title-${id}`);
    popover.setAttribute("aria-describedby", `gc-body-${id}`);
    popover.tabIndex = -1;

    closeBtn = button("gc-close", () => cb.onSkip());
    closeBtn.innerHTML = '<span aria-hidden="true">&times;</span>';
    progressEl = document.createElement("p");
    progressEl.className = "gc-progress";
    titleEl = document.createElement("h2");
    titleEl.className = "gc-title";
    titleEl.id = `gc-title-${id}`;
    bodyEl = document.createElement("div");
    bodyEl.className = "gc-body";
    bodyEl.id = `gc-body-${id}`;
    const footer = document.createElement("div");
    footer.className = "gc-footer";
    dismissBtn = button("gc-link gc-dismiss", () => cb.onDismiss());
    const spacer = document.createElement("span");
    spacer.className = "gc-spacer";
    backBtn = button("gc-btn gc-back", () => cb.onBack());
    nextBtn = button("gc-btn gc-primary gc-next", () => cb.onNext());
    footer.append(dismissBtn, spacer, backBtn, nextBtn);
    popover.append(closeBtn, progressEl, titleEl, bodyEl, footer);

    live = document.createElement("div");
    live.className = "gc-sr-only";
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");

    cursor = new GuideCursorEl(document);
    root.append(ring, popover, cursor.el, live);
    (o.container?.() ?? document.body).appendChild(root);

    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
  }

  function observe(target: Element | null): void {
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    if (!target) return;
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(schedule);
      resizeObserver.observe(target);
    }
    if (typeof MutationObserver === "function") {
      mutationObserver = new MutationObserver(schedule);
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function placeRing(rect: Rect | null): void {
    if (!ring) return;
    const step = current?.step;
    const on = !!rect && (step?.highlight ?? getOptions().highlight ?? true);
    ring.classList.toggle("gc-visible", on);
    if (!rect || !on) return;
    const pad = 6;
    ring.style.transform = `translate(${rect.left - pad}px, ${rect.top - pad}px)`;
    ring.style.width = `${rect.width + pad * 2}px`;
    ring.style.height = `${rect.height + pad * 2}px`;
  }

  function placePopover(rect: Rect | null): void {
    if (!popover || !current) return;
    const size = { width: popover.offsetWidth, height: popover.offsetHeight };
    const pos = computePosition(rect, size, viewport(), {
      placement,
      align: current.step.align ?? "center",
      offset: getOptions().offset ?? 14,
    });
    popover.style.transform = `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px)`;
    popover.dataset.placement = pos.placement;
  }

  function update(): void {
    if (!current || !root) return;
    const target = current.target;
    if (target && !target.isConnected) {
      cb.onTargetLost();
      return;
    }
    const rect = target ? rectOf(target) : null;
    placeRing(rect);
    placePopover(rect);
    if (rect && cursor && !cursor.moving && cursor.el.classList.contains("gc-visible")) {
      cursor.jump(cursorPointFor(rect));
    }
  }

  function fillPopover(s: RenderStep): void {
    const o = getOptions();
    const { labels } = o;
    const isLast = s.index === s.total - 1;
    progressEl.textContent = labels.progress(s.index + 1, s.total);
    progressEl.hidden = o.showProgress === false || s.total < 2;
    titleEl.textContent = s.step.title ?? "";
    titleEl.hidden = !s.step.title;
    bodyEl.replaceChildren();
    if (typeof s.content === "string") bodyEl.textContent = s.content;
    else if (s.content) bodyEl.appendChild(s.content);
    backBtn.textContent = labels.back;
    backBtn.hidden = s.index === 0 || !!s.step.hideBack;
    nextBtn.textContent = isLast ? labels.done : labels.next;
    nextBtn.setAttribute("data-action", isLast ? "done" : "next");
    closeBtn.setAttribute("aria-label", labels.skip);
    closeBtn.title = labels.skip;
    dismissBtn.textContent = labels.dontShowAgain;
    dismissBtn.hidden = o.showDontShowAgain === false;
    popover?.setAttribute("data-step", String(s.index));
    if (s.step.id) popover?.setAttribute("data-step-id", s.step.id);
    else popover?.removeAttribute("data-step-id");
    if (live) {
      const text = typeof s.content === "string" ? s.content : (s.content?.textContent ?? "");
      live.textContent = `${labels.progress(s.index + 1, s.total)}. ${s.step.title ?? ""}. ${text}`.trim();
    }
  }

  const renderer: Renderer = {
    get popover() {
      return popover;
    },

    async show(s) {
      mount();
      if (!root || !popover || !cursor) return;
      const token = ++showToken;
      const isReduced = reduced();
      root.classList.toggle("gc-reduced", isReduced);
      root.dataset.gcMotion = isReduced ? "reduce" : "full";
      renderer.hideStep();
      current = s;
      placement = s.step.placement ?? getOptions().placement ?? "auto";
      observe(s.target);

      if (s.target && needsScroll(rectOf(s.target))) {
        try {
          s.target.scrollIntoView({ block: "center", inline: "nearest", behavior: isReduced ? "auto" : "smooth" });
        } catch {
          /* old browsers / jsdom */
        }
        if (!isReduced) await waitForSettle(s.target);
        if (token !== showToken) return;
      }

      const copts = cursorOpts();
      const target = s.target;
      if (copts && target && s.step.cursor !== false) {
        cursor.setLabel(copts.label);
        if (!cursor.position && !isReduced) {
          const vp = viewport();
          cursor.jump(lastPointer ?? { x: vp.width * 0.5, y: vp.height - 48 });
        }
        cursor.show();
        await cursor.moveTo(() => cursorPointFor(rectOf(target)), {
          reduced: isReduced,
          speed: copts.speed,
          ripple: copts.ripple,
        });
        if (token !== showToken) return;
      } else {
        cursor.hide();
      }

      fillPopover(s);
      const rect = s.target ? rectOf(s.target) : null;
      placeRing(rect);
      placePopover(rect);
      popover.classList.add("gc-visible");
      const shouldFocus = s.step.focus ?? getOptions().focus ?? true;
      if (shouldFocus) {
        try {
          popover.focus({ preventScroll: true });
        } catch {
          popover.focus();
        }
      }
    },

    hideStep() {
      popover?.classList.remove("gc-visible");
      ring?.classList.remove("gc-visible");
      current = null;
    },

    hide() {
      showToken++;
      renderer.hideStep();
      cursor?.reset();
      observe(null);
      if (live) live.textContent = "";
    },

    refresh() {
      schedule();
    },

    destroy() {
      renderer.hide();
      if (frame) cancelRaf(frame);
      frame = 0;
      if (isBrowser()) {
        window.removeEventListener("scroll", schedule, { capture: true });
        window.removeEventListener("resize", schedule);
        window.removeEventListener("pointermove", onPointerMove);
      }
      root?.remove();
      root = null;
      popover = null;
      cursor = null;
      ring = null;
      live = null;
    },
  };
  return renderer;
}
