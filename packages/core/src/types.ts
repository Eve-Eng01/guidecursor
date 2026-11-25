/** Side of the target the popover is placed on. */
export type Placement = "top" | "bottom" | "left" | "right";
/** `auto` picks the side with the most room, preferring bottom → top → right → left. */
export type PlacementOption = Placement | "auto";
export type Align = "start" | "center" | "end";

/**
 * How a step finds its target element:
 * - a CSS selector (resolved with `document.querySelector`)
 * - an element
 * - a getter that returns the element (or null while it does not exist yet)
 */
export type TargetInput = string | Element | (() => Element | null | undefined);

/** Matches the current route against a step's route. */
export type RouteMatcher = string | RegExp | ((currentRoute: string) => boolean);

/** Content of a popover body. Strings are rendered as text (never as HTML). */
export type StepContent = string | Node | ((ctx: StepContext) => string | Node);

export interface StepContext {
  tour: GuideTour;
  step: GuideStep;
  index: number;
  total: number;
  guide: Guide;
}

export interface GuideStep {
  /** Optional stable id. Lets you `goTo("id")` and keeps analytics readable. */
  id?: string;
  /** Element to point at. Omit it for a centered step that has no anchor. */
  target?: TargetInput;
  title?: string;
  content?: StepContent;
  /** Preferred popover side. Default: the guide's `placement` option (`auto`). */
  placement?: PlacementOption;
  align?: Align;
  /**
   * Route the step lives on. If the current route does not match, the guide calls
   * your `navigate(route)` hook and waits for the target to appear.
   */
  route?: string;
  /** Custom matcher for `route` (for dynamic segments like `/events/$id`). */
  routeMatch?: RouteMatcher;
  /** Draw the soft highlight ring around the target. Default: guide option `highlight`. */
  highlight?: boolean;
  /** Set to false to hide the cursor for this step. */
  cursor?: boolean;
  /**
   * Advance automatically when the user does something:
   * - `"click"` advances when the target is clicked
   * - `{ event, selector }` advances when `event` fires on an element matching `selector`
   */
  advanceOn?: "click" | { event: string; selector?: string };
  /** Override the guide's `targetTimeout` (ms) for this step. */
  timeout?: number;
  /** Hide the Back button on this step. */
  hideBack?: boolean;
  /** Move keyboard focus into the popover when the step shows. Default: guide option. */
  focus?: boolean;
  /** Runs before the guide looks for the target. Can be async (open a menu, fetch data…). */
  beforeShow?: (ctx: StepContext) => void | Promise<void>;
  onShow?: (ctx: StepContext & { target: Element | null }) => void;
  onHide?: (ctx: StepContext) => void;
  /** Free-form data, passed through to callbacks. */
  data?: Record<string, unknown>;
}

export interface AutoStartContext {
  tour: GuideTour;
  status: TourStatus;
  route: string;
  guide: Guide;
}

export interface GuideTour {
  id: string;
  title: string;
  description?: string;
  steps: GuideStep[];
  /**
   * Tours never pop up on their own unless this is set. `true` starts the tour the first time
   * the guide initialises (only if the user has never seen it). A function decides per call.
   */
  autoStart?: boolean | ((ctx: AutoStartContext) => boolean | Promise<boolean>);
  /** Delay before an auto-started tour begins (ms). Default 600. */
  autoStartDelay?: number;
  /** Hide this tour from `<GuideMenu />` (it can still be started in code). */
  hidden?: boolean;
}

/** Lifecycle status of a tour for the current user. */
export type TourStatus = "new" | "in-progress" | "skipped" | "completed" | "dismissed";

export interface TourProgress {
  status: Exclude<TourStatus, "new">;
  /** Index of the last step that was shown. */
  step: number;
  updatedAt: number;
}

/** Everything the guide persists. Small and JSON-safe so it can live on your server. */
export interface PersistedData {
  v: 1;
  tours: Record<string, TourProgress>;
  /** The tour that was running when the page unloaded / navigated. */
  active: { tourId: string; step: number } | null;
  /** Set by "Don't show again": no tour will auto-start any more. */
  muted: boolean;
}

/**
 * Where progress is stored. Both methods may be sync or async and may throw;
 * the guide catches failures and keeps working in memory.
 */
export interface StorageAdapter {
  load(): PersistedData | null | undefined | Promise<PersistedData | null | undefined>;
  save(data: PersistedData): void | Promise<void>;
}

export type GuidePhase = "idle" | "navigating" | "waiting" | "moving" | "showing";

export interface GuideState {
  phase: GuidePhase;
  /** Id of the running tour, or null. */
  tourId: string | null;
  stepIndex: number;
  stepCount: number;
  progress: Record<string, TourProgress>;
  muted: boolean;
  /** True once persisted progress has been loaded. */
  ready: boolean;
}

export type EndReason = "completed" | "skipped" | "dismissed" | "stopped" | "interrupted" | "error";

export interface TourEventPayload {
  tour: GuideTour;
}
export interface StepEventPayload extends TourEventPayload {
  step: GuideStep;
  index: number;
  total: number;
  target: Element | null;
}
export interface SkipEventPayload extends TourEventPayload {
  step: GuideStep | null;
  index: number;
}
export interface EndEventPayload extends TourEventPayload {
  reason: EndReason;
  index: number;
}
export interface GuideErrorPayload {
  type: "target-missing" | "storage" | "navigation" | "callback";
  error?: unknown;
  tour?: GuideTour;
  step?: GuideStep;
  index?: number;
}

export interface GuideEvents {
  start: TourEventPayload;
  step: StepEventPayload;
  skip: SkipEventPayload;
  complete: TourEventPayload;
  dismiss: SkipEventPayload;
  end: EndEventPayload;
  error: GuideErrorPayload;
}

export interface GuideLabels {
  next: string;
  back: string;
  done: string;
  skip: string;
  dontShowAgain: string;
  progress: (current: number, total: number) => string;
}

export interface CursorOptions {
  /** Multiplier for glide duration. 1 = default, 0.5 = twice as fast. */
  speed?: number;
  /** Optional name tag shown next to the cursor, like a multiplayer cursor. */
  label?: string;
  /** Play a soft "click" ripple when the cursor arrives. Default true. */
  ripple?: boolean;
}

export interface GuideOptions {
  tours?: GuideTour[];
  /** Persistence. Default: `localStorageAdapter()`. Pass `memoryStorage()` to persist nothing. */
  storage?: StorageAdapter;
  /** Host router hook for steps that declare a `route`. May return a promise. */
  navigate?: (route: string) => void | Promise<void>;
  /** Returns the current route. Default: `window.location.pathname`. */
  getCurrentRoute?: () => string;
  /** The animated cursor. `false` disables it entirely. */
  cursor?: boolean | CursorOptions;
  /** Draw a soft ring around targets. Default true. It never blocks the page. */
  highlight?: boolean;
  placement?: PlacementOption;
  /** Gap between target and popover (px). Default 14. */
  offset?: number;
  /** How long to wait for a step's target (ms). Default 5000. */
  targetTimeout?: number;
  /** What to do when a target never appears. Default `"skip"` (go to the next step). */
  onMissingTarget?: "skip" | "end" | "center";
  /** `auto` follows `prefers-reduced-motion`. */
  motion?: "auto" | "reduce" | "full";
  /** Keyboard shortcuts (Esc skips, ←/→/Enter navigate). Default true. */
  keyboard?: boolean;
  /** Focus the popover when a step shows. Default true. */
  focus?: boolean;
  /** Show the "Don't show again" button. Default true. */
  showDontShowAgain?: boolean;
  /** Show "Step x of y". Default true. */
  showProgress?: boolean;
  labels?: Partial<GuideLabels>;
  /** Resume a tour that was in progress when the page was (re)loaded. Default true. */
  resumeOnLoad?: boolean;
  /** Evaluate tours' `autoStart` when the guide initialises. Default true. */
  autoStart?: boolean;
  /**
   * Initialise (load progress, resume, auto-start) right away in the browser. Default true.
   * Framework adapters pass false and call `guide.init()` from an effect.
   */
  init?: boolean;
  /** Inject the default stylesheet. Default true. Set false and import `@guidecursor/core/styles.css`. */
  injectStyles?: boolean;
  /** CSP nonce for the injected `<style>` tag. */
  styleNonce?: string;
  /** Extra class on the overlay root, handy for theming. */
  className?: string;
  /** Element the guide UI is appended to. Default `document.body`. */
  container?: () => HTMLElement;

  onStart?: (e: TourEventPayload) => void;
  onStep?: (e: StepEventPayload) => void;
  onSkip?: (e: SkipEventPayload) => void;
  onComplete?: (e: TourEventPayload) => void;
  onDismiss?: (e: SkipEventPayload) => void;
  onEnd?: (e: EndEventPayload) => void;
  onError?: (e: GuideErrorPayload) => void;
}

export interface StartOptions {
  /** Step index or id to start from. */
  step?: number | string;
  /** Continue from the saved step if the tour was left half-way. Default false. */
  resume?: boolean;
}

export interface Guide {
  /** Resolves once persisted progress is loaded. */
  readonly ready: Promise<void>;
  /** Load progress, resume an interrupted tour and evaluate auto-start. Idempotent. */
  init(): Promise<void>;
  start(tourId: string, options?: StartOptions): Promise<boolean>;
  /** Resume a tour at its saved step (defaults to the last active tour). */
  resume(tourId?: string): Promise<boolean>;
  next(): Promise<void>;
  back(): Promise<void>;
  goTo(step: number | string): Promise<void>;
  /** End the tour early (Esc / ×). Progress is kept so it can be resumed. */
  skip(): void;
  /** "Don't show again": ends the tour and mutes all auto-starting tours. */
  dismiss(): void;
  /** Stop silently. The tour stays "in progress" and can be resumed. */
  stop(): void;
  /** Mark the running tour as completed. */
  complete(): void;
  /** Forget progress for one tour, or everything. */
  reset(tourId?: string): void;
  getState(): GuideState;
  subscribe(listener: (state: GuideState) => void): () => void;
  on<K extends keyof GuideEvents>(event: K, handler: (payload: GuideEvents[K]) => void): () => void;
  getTours(): GuideTour[];
  setTours(tours: GuideTour[]): void;
  getTourStatus(tourId: string): TourStatus;
  /** Update callbacks / hooks after creation (used by framework adapters). */
  setOptions(options: Partial<Pick<GuideOptions, "navigate" | "getCurrentRoute" | "labels">>): void;
  /** Re-evaluate `autoStart` conditions, e.g. after a route change. */
  checkAutoStart(): Promise<void>;
  /** Recompute positions (after layout changes the guide could not observe). */
  refresh(): void;
  /** Tear down UI and listeners. The instance stays usable and re-mounts lazily. */
  destroy(): void;
}
