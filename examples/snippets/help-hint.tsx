// A "How does this work?" button for a complex feature. It starts the tour at the step that
// explains this part of the screen, then carries on through the rest of the flow.
import { useGuideCursor } from "@guidecursor/react";

interface HelpHintProps {
  tour: string;
  /** Step id to start from. Give the step an `id` so reordering the tour doesn't break the hint. */
  step?: string;
  children?: React.ReactNode;
}

export function HelpHint({ tour, step, children = "How does this work?" }: HelpHintProps) {
  const { start, tours } = useGuideCursor();
  // Only offer help that exists here (tours can differ by role or feature flag)
  if (!tours.some((t) => t.id === tour)) return null;
  return (
    <button
      type="button"
      className="help-hint"
      data-guide-hint={tour}
      onClick={() => void start(tour, step ? { step } : undefined)}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      {children}
    </button>
  );
}

// Usage:
//   <h2>Payment steps <HelpHint tour="manage-booking" step="payment-steps">How do payment steps work?</HelpHint></h2>
