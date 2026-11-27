# Contextual help buttons

People rarely open a Guides menu before they're stuck. They get stuck at a specific screen, looking at something complex: a payment schedule, a privacy setting, a fee breakdown. Put a small **"How does this work?"** button right there, and have it start the matching tour **at that step**.

```tsx
import { useGuideCursor } from "@guidecursor/react";

export function HelpHint({ tour, step, children = "How does this work?" }: { tour: string; step?: string; children?: React.ReactNode }) {
  const { start, tours } = useGuideCursor();
  if (!tours.some((t) => t.id === tour)) return null; // tour not registered here
  return (
    <button type="button" className="help-hint" onClick={() => start(tour, step ? { step } : undefined)}>
      <span aria-hidden>?</span> {children}
    </button>
  );
}
```

```tsx
<h2>
  Payment steps <HelpHint tour="manage-booking" step="payment-steps">How do payment steps work?</HelpHint>
</h2>
```

Give the steps you link to an `id`, so the button keeps working when someone reorders the tour:

```ts
{ id: "payment-steps", target: "[data-tour=payment-steps]", title: "Payment steps", content: "…" }
```

## Good places for a hint

- Money: fees, payment schedules, escrow or "protected" balances, payouts and their waiting periods
- Privacy and access: public vs. private, invite lists, access codes
- Anything with a deadline or an automatic action ("released automatically after 14 days")
- Dense dashboards, where a hint can start a tour of the whole page

## Tips

- Keep the label a question people would actually ask ("Public or private?", "How do earnings work?"). Avoid generic "Help".
- Starting mid-tour is fine: the tour carries on to the end, and Back still works.
- Only render the hint where a provider exists. In React, check a context, or the `tours` list as above, so shared components don't show dead buttons.
- If the hint lives inside a dialog, make sure the dialog doesn't trap focus, or set `focus: false` on that step.
