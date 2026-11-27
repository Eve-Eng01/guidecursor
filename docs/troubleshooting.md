# Troubleshooting

## A step was skipped

guidecursor skips a step in two cases:

1. **Its `when` returned `false`.** That's on purpose. Check the condition, and if it depends on loaded data, wait for the data first (see [Wait for data before you decide](guides/interactive-steps.md#wait-for-data-before-you-decide)).
2. **Its target never appeared** within `targetTimeout` (5 s by default), and `onMissingTarget` is `"skip"` (the default). You'll get an `error` event with `type: "target-missing"`. Log it:

   ```ts
   createGuide({ onError: (e) => console.warn("[guide]", e.type, e.tour?.id, e.step?.id ?? e.index) });
   ```

   Common causes: the selector changed, the element is hidden (`display: none`, a collapsed accordion, a different breakpoint), it's inside a tab that isn't open (open it in `beforeShow`), or the page loads slower than the timeout (raise `timeout` on that step).

   If you'd rather never drop a step silently, set `onMissingTarget: "center"`, globally or per step. The step then shows in the middle of the page.

## A half-finished tour starts in the middle

That's resume. `<GuideMenu />` continues tours that are `in-progress` or `skipped` by default. To restart tours people closed, use `<GuideMenu resume="in-progress" />`. To always start from the top, use `resume={false}`. From code, `start(id)` always starts at the first step unless you pass `{ resume: true }`.

## The popover is behind my modal, or my modal is behind it

The guide UI uses `z-index: var(--gc-z, 2147483000)`. Lower `--gc-z` if your own modals must sit on top. If your modal traps focus, set `focus: false` on steps inside it, so focus doesn't bounce between the two.

## Esc closes my dialog as well as the tour

guidecursor handles Esc on `document` and calls `preventDefault()`. Make your dialog's Esc handler ignore events with `e.defaultPrevented`. Most dialog libraries already do.

## The cursor jumps instead of gliding

The person (or their OS) has reduced motion turned on, or you passed `motion: "reduce"`. That's intended. Use `motion: "full"` only for demos and recordings.

## The tour doesn't navigate between pages

- Pass your router's `navigate`. Without it, guidecursor falls back to a full page load.
- Pass the current route (`currentRoute` in React, or `getCurrentRoute`), including `?search` if your steps' routes have query params.
- For dynamic URLs, use `routeMatch` (see [Multi-page tours](guides/multi-page-tours.md#how-routes-match)).

## "useGuideCursor must be used inside `<GuideCursorProvider>`"

The component calling the hook is rendered outside the provider. Move the provider higher (around your router outlet), or render the component only where a provider exists.

## Server-side rendering

Importing guidecursor is safe on the server. Nothing touches `window` until a tour starts or `init()` runs in the browser. In Next.js, mount `<GuideCursorProvider>` in a `"use client"` component.

## Still stuck?

Open an issue with a minimal tour definition and the events you see in `onError`. See [CONTRIBUTING.md](../CONTRIBUTING.md#getting-help).
