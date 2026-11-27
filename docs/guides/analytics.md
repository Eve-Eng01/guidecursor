# Analytics

Every lifecycle moment is an event. Pass callbacks to `createGuide` (or as props to `<GuideCursorProvider>`), or subscribe with `guide.on(event, fn)`:

```ts
createGuide({
  tours,
  onStart: ({ tour }) => track("tour_start", { tour: tour.id }),
  onStep: ({ tour, step, index, total }) => track("tour_step", { tour: tour.id, step: step.id ?? index, index, total }),
  onSkip: ({ tour, step, index }) => track("tour_skip", { tour: tour.id, step: step?.id ?? index }),
  onDismiss: ({ tour }) => track("tour_dismiss", { tour: tour.id }),
  onComplete: ({ tour }) => track("tour_complete", { tour: tour.id }),
  onError: (e) => e.type === "target-missing" && track("tour_target_missing", { tour: e.tour?.id, step: e.step?.id ?? e.index }),
});
```

A callback that throws never breaks the tour. The error is reported through `onError` with `type: "callback"`.

## What to look at

- **Completion rate per tour**: `tour_complete / tour_start`. A low rate on a short tour usually means a confusing step.
- **Where people leave**: group `tour_skip` by step. One step with most of the skips is the one to rewrite.
- **`target-missing` in production**: it should be zero. When it isn't, a release changed the UI under a tour. Fix the anchor, or use `when` if the step really only applies sometimes.
- **Help buttons vs. the menu**: tag starts with where they came from (`start(id, { step })` from a hint vs. the menu's `onSelect`) to see which entry points people actually use.

## Give steps ids

`step.id` keeps reports readable and stable when you reorder steps. Index 4 means something different after you insert a step, but `"payment-plan"` doesn't.
