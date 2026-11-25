import {
  createGuide,
  type Guide,
  type GuideOptions,
  type GuideState,
  type GuideStep,
  type GuideTour,
  type StartOptions,
  type TourStatus,
} from "@guidecursor/core";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const GuideContext = createContext<Guide | null>(null);

export interface GuideCursorProviderProps extends Omit<GuideOptions, "tours" | "init"> {
  tours: GuideTour[];
  /**
   * The current route (e.g. `useLocation().pathname`). When it changes, `autoStart`
   * conditions are re-evaluated. Also used as the default `getCurrentRoute`.
   */
  currentRoute?: string;
  /** Bring your own guide instance instead (other props except `tours` are then ignored). */
  guide?: Guide;
  children?: ReactNode;
}

/**
 * Creates one guide for the subtree. Callbacks (`navigate`, `onStep`, …) can change between
 * renders; the latest ones are always used. Safe under StrictMode and SSR.
 */
export function GuideCursorProvider(props: GuideCursorProviderProps): ReactNode {
  const { tours, currentRoute, guide: external, children } = props;
  const latest = useRef(props);
  latest.current = props;

  const [guide] = useState<Guide>(
    () =>
      external ??
      createGuide({
        ...props,
        tours,
        init: false,
        navigate: (route) => latest.current.navigate?.(route),
        getCurrentRoute: () => {
          const p = latest.current;
          if (p.getCurrentRoute) return p.getCurrentRoute();
          if (p.currentRoute !== undefined) return p.currentRoute;
          return typeof window !== "undefined" ? window.location.pathname : "/";
        },
        onStart: (e) => latest.current.onStart?.(e),
        onStep: (e) => latest.current.onStep?.(e),
        onSkip: (e) => latest.current.onSkip?.(e),
        onComplete: (e) => latest.current.onComplete?.(e),
        onDismiss: (e) => latest.current.onDismiss?.(e),
        onEnd: (e) => latest.current.onEnd?.(e),
        onError: (e) => latest.current.onError?.(e),
      }),
  );

  useEffect(() => {
    guide.setTours(tours);
  }, [guide, tours]);

  useEffect(() => {
    if (props.labels) guide.setOptions({ labels: props.labels });
  }, [guide, props.labels]);

  useEffect(() => {
    void guide.init();
    return () => guide.destroy();
  }, [guide]);

  const firstRoute = useRef(true);
  useEffect(() => {
    // The initial evaluation happens in init(); later route changes re-check auto-start.
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    if (currentRoute !== undefined) void guide.checkAutoStart();
  }, [guide, currentRoute]);

  return <GuideContext.Provider value={guide}>{children}</GuideContext.Provider>;
}

export interface TourSummary {
  id: string;
  title: string;
  description?: string;
  hidden: boolean;
  status: TourStatus;
  /** Last step reached (0-based). */
  step: number;
  stepCount: number;
}

export interface UseGuideCursor extends GuideState {
  guide: Guide;
  isActive: boolean;
  currentTour: GuideTour | null;
  currentStep: GuideStep | null;
  tours: TourSummary[];
  start: (tourId: string, options?: StartOptions) => Promise<boolean>;
  resume: (tourId?: string) => Promise<boolean>;
  next: () => Promise<void>;
  back: () => Promise<void>;
  goTo: (step: number | string) => Promise<void>;
  skip: () => void;
  dismiss: () => void;
  stop: () => void;
  reset: (tourId?: string) => void;
}

export function useGuide(): Guide {
  const guide = useContext(GuideContext);
  if (!guide) throw new Error("useGuideCursor must be used inside <GuideCursorProvider>.");
  return guide;
}

/** Reactive guide state plus bound controls. */
export function useGuideCursor(): UseGuideCursor {
  const guide = useGuide();
  const state = useSyncExternalStore(guide.subscribe, guide.getState, guide.getState);
  return useMemo(() => {
    const all = guide.getTours();
    const currentTour = all.find((t) => t.id === state.tourId) ?? null;
    return {
      ...state,
      guide,
      isActive: state.tourId !== null,
      currentTour,
      currentStep: currentTour?.steps[state.stepIndex] ?? null,
      tours: all.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        hidden: !!t.hidden,
        status: state.progress[t.id]?.status ?? "new",
        step: state.progress[t.id]?.step ?? 0,
        stepCount: t.steps.length,
      })),
      start: guide.start,
      resume: guide.resume,
      next: guide.next,
      back: guide.back,
      goTo: guide.goTo,
      skip: guide.skip,
      dismiss: guide.dismiss,
      stop: guide.stop,
      reset: guide.reset,
    };
  }, [guide, state]);
}
