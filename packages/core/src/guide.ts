import { isBrowser } from "./env";
import { createDomRenderer, type Renderer, type RendererCallbacks, type RendererOptions } from "./renderer";
import { emptyData, localStorageAdapter, normalizeData } from "./storage";
import { waitForElement } from "./target";
import type {
  EndReason,
  Guide,
  GuideErrorPayload,
  GuideEvents,
  GuideLabels,
  GuideOptions,
  GuideState,
  GuideStep,
  GuideTour,
  PersistedData,
  RouteMatcher,
  StartOptions,
  StepContext,
  TourProgress,
  TourStatus,
} from "./types";

export const defaultLabels: GuideLabels = {
  next: "Next",
  back: "Back",
  done: "Done",
  skip: "Skip tour",
  dontShowAgain: "Don't show again",
  progress: (current, total) => `${current} of ${total}`,
};

/** Internal hook so tests (and exotic hosts) can swap the DOM renderer. */
export interface CreateGuideInternals {
  renderer?: (getOptions: () => RendererOptions, cb: RendererCallbacks) => Renderer;
}

function splitRoute(route: string): { path: string; query: URLSearchParams } {
  const [beforeHash = ""] = route.split("#");
  const q = beforeHash.indexOf("?");
  const rawPath = q < 0 ? beforeHash : beforeHash.slice(0, q);
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath || "/";
  return { path, query: new URLSearchParams(q < 0 ? "" : beforeHash.slice(q + 1)) };
}

/**
 * Does the current route satisfy a step's route? Strings compare paths (trailing slashes and
 * hash ignored); query params in the step's route must be present with the same value
 * (`/account?tab=payout` matches `/account?tab=payout&x=1`, not `/account`).
 */
export function routeMatches(matcher: RouteMatcher, current: string): boolean {
  if (typeof matcher === "function") return matcher(current);
  if (matcher instanceof RegExp) return matcher.test(current);
  const want = splitRoute(matcher);
  const have = splitRoute(current);
  if (want.path !== have.path) return false;
  for (const [key, value] of want.query) {
    if (have.query.get(key) !== value) return false;
  }
  return true;
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

/**
 * Create a guide. Nothing touches `window`/`document` until a tour starts (or `init()` runs in
 * a browser), so this is safe to call during SSR.
 */
export function createGuide(options: GuideOptions = {}, internals: CreateGuideInternals = {}): Guide {
  let opts: GuideOptions = { ...options };
  let tours: GuideTour[] = [...(options.tours ?? [])];
  let labels: GuideLabels = { ...defaultLabels, ...options.labels };
  const storage = options.storage ?? localStorageAdapter();

  let data: PersistedData = emptyData();
  let state: GuideState = {
    phase: "idle",
    tourId: null,
    stepIndex: 0,
    stepCount: 0,
    progress: {},
    muted: false,
    ready: false,
  };
  const listeners = new Set<(s: GuideState) => void>();
  const handlers: { [K in keyof GuideEvents]?: Set<(p: GuideEvents[K]) => void> } = {};

  let readyPromise: Promise<void> | null = null;
  let initialized = false;
  let token = 0;
  let abort: AbortController | null = null;
  let renderer: Renderer | null = null;
  let detachStep: (() => void) | null = null;
  let keyListener: ((e: KeyboardEvent) => void) | null = null;
  let restoreFocus: HTMLElement | null = null;
  let autoTimer: ReturnType<typeof setTimeout> | undefined;
  let direction: 1 | -1 = 1;
  let destroyed = false;

  // ---------------------------------------------------------------- state & events

  function setState(patch: Partial<GuideState>): void {
    state = { ...state, ...patch };
    for (const l of [...listeners]) {
      try {
        l(state);
      } catch (error) {
        emit("error", { type: "callback", error });
      }
    }
  }

  const optionHandler: { [K in keyof GuideEvents]: () => ((p: GuideEvents[K]) => void) | undefined } = {
    start: () => opts.onStart,
    step: () => opts.onStep,
    skip: () => opts.onSkip,
    complete: () => opts.onComplete,
    dismiss: () => opts.onDismiss,
    end: () => opts.onEnd,
    error: () => opts.onError,
  };

  function emit<K extends keyof GuideEvents>(event: K, payload: GuideEvents[K]): void {
    const fns: ((p: GuideEvents[K]) => void)[] = [];
    const fromOptions = optionHandler[event]();
    if (fromOptions) fns.push(fromOptions);
    const set = handlers[event] as Set<(p: GuideEvents[K]) => void> | undefined;
    if (set) fns.push(...set);
    for (const fn of fns) {
      try {
        fn(payload);
      } catch (error) {
        // Analytics callbacks must never break the tour.
        if (event !== "error") emit("error", { type: "callback", error });
      }
    }
  }

  function reportError(payload: GuideErrorPayload): void {
    emit("error", payload);
  }

  // ---------------------------------------------------------------- persistence

  async function persist(): Promise<void> {
    try {
      await storage.save(JSON.parse(JSON.stringify(data)) as PersistedData);
    } catch (error) {
      reportError({ type: "storage", error });
    }
  }

  function setProgress(tourId: string, status: TourProgress["status"], step: number): void {
    data.tours[tourId] = { status, step, updatedAt: Date.now() };
    setState({ progress: { ...data.tours } });
  }

  function load(): Promise<void> {
    if (!readyPromise) {
      readyPromise = (async () => {
        try {
          const loaded = await storage.load();
          if (loaded) data = normalizeData(loaded);
        } catch (error) {
          reportError({ type: "storage", error });
        }
        setState({ progress: { ...data.tours }, muted: data.muted, ready: true });
      })();
    }
    return readyPromise;
  }

  // ---------------------------------------------------------------- helpers

  const findTour = (id: string | null): GuideTour | undefined => (id ? tours.find((t) => t.id === id) : undefined);
  const activeTour = (): GuideTour | undefined => findTour(state.tourId);

  function currentRoute(): string {
    try {
      if (opts.getCurrentRoute) return opts.getCurrentRoute();
    } catch (error) {
      reportError({ type: "callback", error });
    }
    return isBrowser() ? window.location.pathname + window.location.search : "/";
  }

  function stepIndexOf(tour: GuideTour, step: number | string | undefined): number {
    if (step === undefined) return 0;
    if (typeof step === "number") return step;
    const i = tour.steps.findIndex((s) => s.id === step);
    return i < 0 ? 0 : i;
  }

  function context(tour: GuideTour, index: number): StepContext {
    return { tour, step: tour.steps[index] as GuideStep, index, total: tour.steps.length, guide };
  }

  function getRenderer(): Renderer {
    if (!renderer) {
      const factory = internals.renderer ?? createDomRenderer;
      renderer = factory(
        () => ({
          cursor: opts.cursor,
          highlight: opts.highlight,
          placement: opts.placement,
          offset: opts.offset,
          motion: opts.motion,
          focus: opts.focus,
          showDontShowAgain: opts.showDontShowAgain,
          showProgress: opts.showProgress,
          injectStyles: opts.injectStyles,
          styleNonce: opts.styleNonce,
          className: opts.className,
          container: opts.container,
          labels,
        }),
        {
          onNext: () => void guide.next(),
          onBack: () => void guide.back(),
          onSkip: () => guide.skip(),
          onDismiss: () => guide.dismiss(),
          onTargetLost: () => void handleTargetLost(),
        },
      );
    }
    return renderer;
  }

  function attachKeyboard(): void {
    if (keyListener || opts.keyboard === false || !isBrowser()) return;
    keyListener = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !state.tourId || e.altKey || e.ctrlKey || e.metaKey) return;
      const pop = renderer?.popover;
      const inPopover = !!pop && pop.contains(e.target as Node);
      const editable = isEditable(e.target) && !inPopover;
      if (editable) return;
      const free = inPopover || e.target === document.body || e.target === document.documentElement;
      if (e.key === "Escape") {
        e.preventDefault();
        guide.skip();
      } else if (state.phase !== "showing") {
        return;
      } else if (e.key === "ArrowRight" && free) {
        e.preventDefault();
        void guide.next();
      } else if (e.key === "ArrowLeft" && free) {
        e.preventDefault();
        void guide.back();
      } else if (e.key === "Enter" && (e.target === pop || (!inPopover && free))) {
        e.preventDefault();
        void guide.next();
      }
    };
    document.addEventListener("keydown", keyListener);
  }

  function detachKeyboard(): void {
    if (keyListener) document.removeEventListener("keydown", keyListener);
    keyListener = null;
  }

  function cleanupStep(): void {
    abort?.abort();
    abort = null;
    detachStep?.();
    detachStep = null;
  }

  function setupAdvanceOn(step: GuideStep, target: Element | null, index: number): void {
    const spec = step.advanceOn;
    if (!spec || !isBrowser()) return;
    const event = spec === "click" ? "click" : spec.event;
    const selector = spec === "click" ? undefined : spec.selector;
    const listener = (e: Event) => {
      const t = e.target as Element | null;
      const hit = selector ? !!t?.closest?.(selector) : !!target && !!t && target.contains(t);
      if (hit && state.stepIndex === index && state.tourId) void guide.next();
    };
    document.addEventListener(event, listener, true);
    detachStep = () => document.removeEventListener(event, listener, true);
  }

  // ---------------------------------------------------------------- core flow

  async function showStep(index: number): Promise<void> {
    const tour = activeTour();
    if (!tour || destroyed) return;
    if (index >= tour.steps.length) {
      finish("completed");
      return;
    }
    if (index < 0) index = 0;
    const my = ++token;
    cleanupStep();
    const controller = new AbortController();
    abort = controller;
    const prevIndex = state.stepIndex;
    const prevStep = tour.steps[prevIndex];
    if (prevStep?.onHide && state.phase === "showing") {
      try {
        prevStep.onHide(context(tour, prevIndex));
      } catch (error) {
        reportError({ type: "callback", error });
      }
    }

    const step = tour.steps[index] as GuideStep;
    const ctx = context(tour, index);
    renderer?.hideStep();
    setState({ stepIndex: index, stepCount: tour.steps.length, phase: "waiting" });
    setProgress(tour.id, "in-progress", index);
    data.active = { tourId: tour.id, step: index };

    // 1. Route: persist first, so a full page load can resume here.
    if (step.route && !routeMatches(step.routeMatch ?? step.route, currentRoute())) {
      setState({ phase: "navigating" });
      await persist();
      if (my !== token) return;
      try {
        if (opts.navigate) await opts.navigate(step.route);
        else if (isBrowser()) window.location.assign(step.route);
      } catch (error) {
        reportError({ type: "navigation", error, tour, step, index });
      }
      if (my !== token) return;
      setState({ phase: "waiting" });
    } else {
      void persist();
    }

    // 2. Host preparation hook.
    if (step.beforeShow) {
      try {
        await step.beforeShow(ctx);
      } catch (error) {
        reportError({ type: "callback", error, tour, step, index });
      }
      if (my !== token) return;
    }

    // 3. Target.
    let target: Element | null = null;
    if (step.target) {
      target = await waitForElement(step.target, {
        timeout: step.timeout ?? opts.targetTimeout ?? 5000,
        signal: controller.signal,
      });
      if (my !== token) return;
      if (!target) {
        reportError({ type: "target-missing", tour, step, index });
        const mode = opts.onMissingTarget ?? "skip";
        if (mode === "end") {
          finish("error");
          return;
        }
        if (mode === "skip") {
          const nextIndex = index + direction;
          if (nextIndex < 0 || nextIndex >= tour.steps.length) {
            finish(direction === 1 ? "completed" : "error");
          } else {
            await showStep(nextIndex);
          }
          return;
        }
        // "center": fall through with no anchor.
      }
    }

    // 4. Render (scroll, glide, popover).
    if (!isBrowser()) return;
    setState({ phase: "moving" });
    let content: string | Node | undefined;
    try {
      content = typeof step.content === "function" ? step.content(ctx) : step.content;
    } catch (error) {
      reportError({ type: "callback", error, tour, step, index });
    }
    await getRenderer().show({ tour, step, index, total: tour.steps.length, target, content });
    if (my !== token) return;
    setState({ phase: "showing" });
    setupAdvanceOn(step, target, index);
    if (step.onShow) {
      try {
        step.onShow({ ...ctx, target });
      } catch (error) {
        reportError({ type: "callback", error, tour, step, index });
      }
    }
    emit("step", { tour, step, index, total: tour.steps.length, target });
  }

  async function handleTargetLost(): Promise<void> {
    const tour = activeTour();
    if (!tour || state.phase !== "showing") return;
    const index = state.stepIndex;
    const step = tour.steps[index];
    if (!step?.target) return;
    const my = ++token;
    cleanupStep();
    renderer?.hideStep();
    setState({ phase: "waiting" });
    const controller = new AbortController();
    abort = controller;
    // The user navigated away or the UI re-rendered: wait for the target to come back.
    const el = await waitForElement(step.target, {
      timeout: step.timeout ?? opts.targetTimeout ?? 5000,
      signal: controller.signal,
    });
    if (my !== token) return;
    if (el) await showStep(index);
    else finish("interrupted");
  }

  function finish(reason: EndReason, keepActive = false): void {
    const tour = activeTour();
    token++;
    cleanupStep();
    clearTimeout(autoTimer);
    renderer?.hide();
    detachKeyboard();
    if (!tour) {
      setState({ phase: "idle", tourId: null });
      return;
    }
    const index = state.stepIndex;
    const step = tour.steps[index] ?? null;
    if (reason === "completed") setProgress(tour.id, "completed", tour.steps.length - 1);
    else if (reason === "skipped") setProgress(tour.id, "skipped", index);
    else if (reason === "dismissed") setProgress(tour.id, "dismissed", index);
    // stopped / interrupted / error keep "in-progress" so the tour can be resumed.
    if (reason === "dismissed") data.muted = true;
    if (!keepActive) data.active = null;
    void persist();
    setState({ phase: "idle", tourId: null, muted: data.muted });

    if (reason === "completed") emit("complete", { tour });
    if (reason === "skipped") emit("skip", { tour, step, index });
    if (reason === "dismissed") emit("dismiss", { tour, step, index });
    emit("end", { tour, reason, index });

    if (restoreFocus?.isConnected && isBrowser()) {
      const pop = renderer?.popover;
      const active = document.activeElement;
      if (!active || active === document.body || pop?.contains(active)) {
        try {
          restoreFocus.focus({ preventScroll: true });
        } catch {
          /* ignore */
        }
      }
    }
    restoreFocus = null;
  }

  async function runAutoStart(): Promise<void> {
    clearTimeout(autoTimer);
    if (opts.autoStart === false || state.tourId || data.muted || !isBrowser()) return;
    for (const tour of tours) {
      if (!tour.autoStart) continue;
      const status = guide.getTourStatus(tour.id);
      if (status !== "new") continue;
      let ok = false;
      try {
        ok =
          typeof tour.autoStart === "function"
            ? await tour.autoStart({ tour, status, route: currentRoute(), guide })
            : true;
      } catch (error) {
        reportError({ type: "callback", error, tour });
      }
      if (!ok || state.tourId || destroyed) continue;
      autoTimer = setTimeout(() => {
        if (!state.tourId && guide.getTourStatus(tour.id) === "new") void guide.start(tour.id);
      }, tour.autoStartDelay ?? 600);
      return;
    }
  }

  // ---------------------------------------------------------------- public API

  const guide: Guide = {
    get ready() {
      return load();
    },

    async init() {
      destroyed = false;
      if (initialized || !isBrowser()) return;
      initialized = true;
      await load();
      if (destroyed) return;
      const active = data.active;
      if (opts.resumeOnLoad !== false && active && !state.tourId) {
        const tour = findTour(active.tourId);
        if (tour && data.tours[tour.id]?.status === "in-progress") {
          await guide.start(tour.id, { step: active.step });
          return;
        }
      }
      await runAutoStart();
    },

    async start(tourId, startOptions: StartOptions = {}) {
      destroyed = false;
      await load();
      const tour = findTour(tourId);
      if (!tour || tour.steps.length === 0 || !isBrowser()) return false;
      // Switching tours: end the current one quietly, keeping its progress.
      if (state.tourId) finish("stopped");
      clearTimeout(autoTimer);
      let index = stepIndexOf(tour, startOptions.step);
      if (startOptions.resume && startOptions.step === undefined) {
        const p = data.tours[tour.id];
        if (p && (p.status === "in-progress" || p.status === "skipped")) index = p.step;
      }
      index = Math.min(Math.max(index, 0), tour.steps.length - 1);
      if (isBrowser() && !restoreFocus) {
        const a = document.activeElement;
        restoreFocus = a instanceof HTMLElement && a !== document.body ? a : null;
      }
      direction = 1;
      setState({ tourId: tour.id, stepIndex: index, stepCount: tour.steps.length });
      attachKeyboard();
      emit("start", { tour });
      void showStep(index);
      return true;
    },

    async resume(tourId) {
      await load();
      const id = tourId ?? data.active?.tourId;
      if (!id) return false;
      return guide.start(id, { resume: true });
    },

    async next() {
      const tour = activeTour();
      if (!tour) return;
      direction = 1;
      if (state.stepIndex >= tour.steps.length - 1) finish("completed");
      else await showStep(state.stepIndex + 1);
    },

    async back() {
      if (!activeTour() || state.stepIndex <= 0) return;
      direction = -1;
      await showStep(state.stepIndex - 1);
    },

    async goTo(step) {
      const tour = activeTour();
      if (!tour) return;
      const index = stepIndexOf(tour, step);
      direction = index >= state.stepIndex ? 1 : -1;
      await showStep(index);
    },

    skip() {
      if (state.tourId) finish("skipped");
    },
    dismiss() {
      if (state.tourId) finish("dismissed");
    },
    stop() {
      if (state.tourId) finish("stopped");
    },
    complete() {
      if (state.tourId) finish("completed");
    },

    reset(tourId) {
      if (tourId) {
        delete data.tours[tourId];
        if (data.active?.tourId === tourId) data.active = null;
      } else {
        data = emptyData();
      }
      void persist();
      setState({ progress: { ...data.tours }, muted: data.muted });
    },

    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    on(event, handler) {
      let set = handlers[event] as Set<typeof handler> | undefined;
      if (!set) {
        set = new Set();
        (handlers as Record<string, Set<typeof handler>>)[event] = set;
      }
      set.add(handler);
      return () => set.delete(handler);
    },

    getTours: () => tours,

    setTours(next) {
      tours = [...next];
      if (state.tourId && !findTour(state.tourId)) finish("stopped");
      else setState({});
    },

    getTourStatus(tourId): TourStatus {
      return data.tours[tourId]?.status ?? "new";
    },

    setOptions(partial) {
      opts = { ...opts, ...partial };
      if (partial.labels) labels = { ...defaultLabels, ...partial.labels };
    },

    checkAutoStart: () => runAutoStart(),

    refresh() {
      renderer?.refresh();
    },

    destroy() {
      destroyed = true;
      initialized = false;
      clearTimeout(autoTimer);
      // Keep `active` so a remount (React StrictMode, HMR) resumes where the user was.
      if (state.tourId) finish("stopped", true);
      detachKeyboard();
      renderer?.destroy();
      renderer = null;
    },
  };

  if (options.init !== false && isBrowser()) {
    // Defer so callers can attach `guide.on(...)` listeners first.
    queueMicrotask(() => void guide.init());
  }

  return guide;
}
