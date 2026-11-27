# Testing your tours

Tours point at real UI, and UI changes. A tour that silently loses a step is worse than no tour. A short end-to-end test per tour catches drift the day it happens.

The approach:

1. Log guidecursor's events to `window` in development builds.
2. In Playwright, start each tour from the Guides menu like a person would.
3. Loop until the tour completes. At each step, check the title and progress, then press Next, or click the real element for `advanceOn` steps.
4. Assert which steps showed, and that there were **zero** `target-missing` errors.

## 1. Log events in development

```tsx
function log(entry: { type: string; tour?: string; index?: number }) {
  if (!import.meta.env.DEV) return;
  (window as any).__guideEvents = [...((window as any).__guideEvents ?? []), entry];
}

<GuideCursorProvider
  tours={tours}
  onStep={({ tour, index }) => log({ type: "step", tour: tour.id, index })}
  onComplete={({ tour }) => log({ type: "complete", tour: tour.id })}
  onError={(e) => log({ type: `error:${e.type}`, tour: e.tour?.id, index: e.index })}
/>
```

## 2. Run every tour

The full runner is in [`examples/snippets/tours.spec.ts`](../../examples/snippets/tours.spec.ts). The heart of it:

```ts
for (;;) {
  await expect.poll(async () => (await events(page)).filter((e) => e.type === "step").length > seen || (await done(page))).toBe(true);
  if (await done(page)) break;
  const index = (await events(page)).filter((e) => e.type === "step").at(-1)!.index!;
  const step = tour.steps[index];
  shown.push(step.id!);
  await expect(popover).toContainText(`${index + 1} of ${tour.steps.length}`);
  await expect(popover.locator(".gc-title")).toHaveText(step.title!);

  if (step.advanceOn === "click" && typeof step.target === "string") await page.locator(step.target).first().click();
  else await popover.locator(".gc-next").click();
}

expect(shown).toEqual(["search", "filters", "open", "packages", "book"]);
expect((await events(page)).filter((e) => e.type === "error:target-missing")).toHaveLength(0);
```

## What to assert

- **The exact list of steps shown** for a known data set. With `when`, a tour can legitimately pass over steps, so checking "every step showed" is wrong. Check the list you expect for this scenario instead (for example, a public event never shows the "Guest list" step).
- **Zero `target-missing` errors.** This catches renamed anchors, removed elements and slow pages.
- **Nothing starts on its own.** Load the page, wait a second, and assert no popover is visible.
- **The page stays usable.** Check that `document.elementFromPoint` outside the popover isn't covered by guide UI.

## Tips

- Seed realistic data (a mock server, or route stubs) so the click-through steps have something to open.
- Run each tour against at least two scenarios when it has `when` steps: with the optional thing present, and without it.
- Import the same `tours` array the app uses, so the test always knows each step's title and position.
