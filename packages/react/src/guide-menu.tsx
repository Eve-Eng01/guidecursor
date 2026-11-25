import { injectStyles } from "@guidecursor/core";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { type TourSummary, useGuideCursor } from "./provider";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface GuideMenuProps {
  /** Trigger text. Default "Guides". */
  label?: ReactNode;
  /** Heading inside the panel. Default "Guides". Pass null to hide. */
  heading?: ReactNode;
  /** Only list these tour ids (in this order). Hidden tours are always excluded. */
  tours?: string[];
  /** Which edge of the trigger the panel aligns to. Default "end". */
  align?: "start" | "end";
  className?: string;
  /** Show a dot on the trigger while some tours are still new. Default true. */
  showNewIndicator?: boolean;
  emptyText?: ReactNode;
  /** Status chip text. */
  statusText?: (tour: TourSummary) => string;
  /** Called after a tour is started from the menu. */
  onSelect?: (tourId: string) => void;
}

function defaultStatusText(t: TourSummary): string {
  switch (t.status) {
    case "new":
      return "New";
    case "completed":
      return "Done";
    case "in-progress":
    case "skipped":
      return `${Math.min(t.step + 1, t.stepCount)}/${t.stepCount}`;
    case "dismissed":
      return "Hidden";
  }
}

function CompassIcon(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 8.5 13.4 13.4 8.5 15.5l2.1-4.9 4.9-2.1Z" fill="currentColor" />
    </svg>
  );
}

/**
 * A non-interrupting "Guides" dropdown. Users open it when they want help; nothing pops up
 * on its own. Lists tours with their completion state and starts/resumes them on click.
 */
export function GuideMenu(props: GuideMenuProps): ReactNode {
  const {
    label = "Guides",
    heading = "Guides",
    align = "end",
    className,
    showNewIndicator = true,
    emptyText = "No guides available yet.",
    statusText = defaultStatusText,
    onSelect,
  } = props;
  const { tours: all, start } = useGuideCursor();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  useIsoLayoutEffect(() => {
    injectStyles(document);
  }, []);

  const visible = (
    props.tours ? props.tours.map((id) => all.find((t) => t.id === id)).filter((t): t is TourSummary => !!t) : all
  ).filter((t) => !t.hidden);
  const hasNew = visible.some((t) => t.status === "new");
  itemsRef.current.length = visible.length;

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    itemsRef.current[0]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  const onMenuKeyDown = (e: ReactKeyboardEvent) => {
    const items = itemsRef.current.filter((el): el is HTMLButtonElement => !!el);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (n: number) => items[(n + items.length) % items.length]?.focus();
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusAt(i + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusAt(i - 1);
        break;
      case "Home":
        e.preventDefault();
        focusAt(0);
        break;
      case "End":
        e.preventDefault();
        focusAt(items.length - 1);
        break;
      case "Escape":
        // preventDefault also tells a running tour not to treat this Esc as "skip".
        e.preventDefault();
        e.stopPropagation();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
    }
  };

  const onTriggerKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const choose = (t: TourSummary) => {
    close(false);
    const resume = t.status === "in-progress" || t.status === "skipped";
    void start(t.id, { resume });
    onSelect?.(t.id);
  };

  return (
    <div ref={rootRef} className={`gc-menu${className ? ` ${className}` : ""}`} data-guidecursor-menu="">
      <button
        ref={triggerRef}
        type="button"
        className="gc-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        <CompassIcon />
        <span>{label}</span>
        {showNewIndicator && hasNew ? <span className="gc-menu-dot" title="New guides available" /> : null}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={typeof label === "string" ? label : "Guides"}
          className="gc-menu-panel"
          data-align={align}
          onKeyDown={onMenuKeyDown}
        >
          {heading !== null ? (
            <div className="gc-menu-heading" role="presentation">
              {heading}
            </div>
          ) : null}
          {visible.length === 0 ? <div className="gc-menu-empty">{emptyText}</div> : null}
          {visible.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                itemsRef.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="gc-menu-item"
              data-tour-id={t.id}
              onClick={() => choose(t)}
            >
              <span className="gc-menu-text">
                <span className="gc-menu-title">{t.title}</span>
                {t.description ? <span className="gc-menu-desc">{t.description}</span> : null}
              </span>
              <span className="gc-menu-status" data-status={t.status}>
                {statusText(t)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
