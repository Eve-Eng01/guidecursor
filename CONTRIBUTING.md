# Contributing to guidecursor

Thanks for helping. This guide covers everything you need to change guidecursor with confidence: how the code is laid out, how a tour actually runs, how to test, a worked example of adding a feature from start to finish, and how releases go out.

If you only want to fix a typo or a doc, skip to [Pull request checklist](#pull-request-checklist).

## Contents

- [Ways to contribute](#ways-to-contribute)
- [Project layout](#project-layout)
- [How a tour runs](#how-a-tour-runs)
- [Setup](#setup)
- [Everyday commands](#everyday-commands)
- [Working on the demo, and trying changes in a real app](#working-on-the-demo-and-trying-changes-in-a-real-app)
- [Tests](#tests)
- [Worked example: adding a step option](#worked-example-adding-a-step-option)
- [Design rules](#design-rules)
- [Docs and GIFs](#docs-and-gifs)
- [Pull request checklist](#pull-request-checklist)
- [Commit messages](#commit-messages)
- [Releasing (maintainers)](#releasing-maintainers)
- [Getting help](#getting-help)

## Ways to contribute

- **Report a bug.** Open an issue with what you expected, what happened, and a minimal tour definition that shows it. A failing test is even better. Say which browser, and whether `prefers-reduced-motion` is on.
- **Suggest a feature.** Open an issue first and describe the problem you're solving, not only the API you'd like. guidecursor stays small on purpose (core is under 10 kB min+gzip), so we talk about the trade-off before code is written.
- **Improve the docs.** Docs live in `README.md`, `docs/` and `examples/`. Small fixes can go straight to a pull request.
- **Fix a bug or build an agreed feature.** Read on.

## Project layout

An npm-workspaces monorepo:

```
packages/core     @guidecursor/core   framework-agnostic engine (vanilla DOM, no dependencies)
packages/react    @guidecursor/react  React provider, useGuideCursor() hook and <GuideMenu />
apps/demo         Vite + React demo app; also what the Playwright e2e suite and the GIFs run against
docs/             Guides, recipes and the GIFs (docs/media) used by the README
examples/         Copy-paste sample code (vanilla, routers, server storage, help buttons, tests)
scripts/          size.mjs (bundle size report) and record-gifs.mjs (re-records docs/media)
```

Inside `packages/core/src`:

| File | What it owns |
|---|---|
| `types.ts` | Every public type: `GuideTour`, `GuideStep`, `GuideOptions`, `Guide`, events. Start here when adding an option. |
| `guide.ts` | `createGuide()`: the state machine, step lifecycle, persistence, keyboard, auto-start and the public `Guide` methods. |
| `renderer.ts` | The DOM: overlay root, popover, highlight ring, focus handling, live region, repositioning on scroll and resize. |
| `cursor.ts` | The animated cursor: curved, eased glide on `requestAnimationFrame` that re-targets mid-flight. |
| `position.ts` | Pure maths for placing the popover (flip and shift to stay in the viewport). Easy to unit test. |
| `target.ts` | Resolving targets and `waitForElement()` (MutationObserver plus a slow poll, with a timeout). |
| `storage.ts` | `localStorageAdapter()`, `memoryStorage()`, and normalising persisted data. |
| `styles.ts` | The stylesheet as a string, driven by `--gc-*` CSS custom properties. `scripts/write-css.mjs` also writes it to `dist/styles.css` for strict CSP setups. |
| `env.ts` | `isBrowser()` and friends, so nothing touches `window` at import time. |

`packages/react/src` is thin on purpose: `provider.tsx` creates one guide per provider and keeps callbacks fresh with a ref, `guide-menu.tsx` is the dropdown. Any behaviour that isn't React-specific belongs in core.

## How a tour runs

Knowing this order makes most bugs easy to place. `guide.start(id)` sets the tour and calls `showStep(index)`, which does this for every step:

```
showStep(i)
  1. route      step.route doesn't match getCurrentRoute()?  persist progress, then await navigate(route)
  2. beforeShow await step.beforeShow(ctx)            open a menu, switch a tab, click through to a record
  3. when       await step.when(ctx) === false?       pass over the step in the current direction (no error)
  4. target     await waitForElement(step.target)     missing → onMissingTarget: skip | end | center
  5. render     scroll into view, glide the cursor, show the popover and ring   (phase: moving → showing)
  6. wire up    advanceOn listener, onShow(ctx), emit "step"
```

Phases go `idle → navigating → waiting → moving → showing`. Every async gap checks a `token`, so if the user presses Next twice or starts another tour mid-flight, the stale `showStep` returns quietly. Keep that pattern in any new async code in `showStep`:

```ts
const my = ++token;
await somethingAsync();
if (my !== token) return; // someone moved on while we waited
```

Statuses persist per tour: `new → in-progress → completed | skipped | dismissed`. `stop()`, an interruption or an error keep the tour `in-progress`, so it can be resumed after a reload.

## Setup

```bash
git clone <this repo> && cd guidecursor
npm install
npx playwright install chromium   # once, for the e2e tests and the GIF recorder
```

Node 18 or newer works. CI uses Node 22. Recording GIFs also needs `ffmpeg` on your PATH (`brew install ffmpeg` or `apt install ffmpeg`).

## Everyday commands

| Command | What it does |
|---|---|
| `npm run build` | Builds core, then react, with tsup (ESM + CJS + `.d.ts`) |
| `npm test` | Unit tests (vitest + jsdom) for core and react |
| `npm run test:e2e` | Builds the demo, serves it and runs Playwright against it |
| `npm run lint` / `npm run lint:fix` | Biome lint and format check / fix |
| `npm run typecheck` | `tsc` for every workspace |
| `npm run size` | Min+gzip size of the built bundles |
| `npm run dev -w @guidecursor/demo` | The demo with hot reload (it uses the package sources directly) |
| `npm run record:gifs` | Re-records every GIF in `docs/media` (see [Docs and GIFs](#docs-and-gifs)) |
| `npm run ci` | Everything CI runs: lint, build, typecheck, unit and e2e tests |

Run one test file or one test while you work:

```bash
npx vitest run packages/core/test/guide.test.ts -t "conditional steps"
npm run test:e2e -w @guidecursor/demo -- -g "when"
```

## Working on the demo, and trying changes in a real app

`npm run dev -w @guidecursor/demo` starts the demo at http://localhost:5173. It has three pages, a late-loading form (to exercise waiting for targets), a click-to-advance step, a conditional step and an auto-start tour behind `?welcome`. Add `?motion=reduce` to see the reduced-motion path.

To try an unreleased build in your own app, pack the packages and install the tarballs. This is exactly how apps that vendor guidecursor pick up a new version:

```bash
npm run build
npm pack -w @guidecursor/core -w @guidecursor/react --pack-destination ../my-app/vendor/guidecursor
cd ../my-app
npm install ./vendor/guidecursor/guidecursor-core-0.2.0.tgz ./vendor/guidecursor/guidecursor-react-0.2.0.tgz
```

> **Yarn 1 users:** `@guidecursor/react` depends on `@guidecursor/core` by version, so yarn looks for core on the registry. Point both at the tarball with a single lockfile entry (`"@guidecursor/core@0.2.0", "@guidecursor/core@file:vendor/…tgz":`), or add a `resolutions` field.

`npm link` works too, but two copies of React can sneak in. If hooks start throwing "Invalid hook call", use the tarballs instead.

## Tests

Every behaviour change needs a test. Pick the cheapest test that proves it:

| Change | Test |
|---|---|
| Engine logic: lifecycle, persistence, routing, events | Unit test in `packages/core/test/guide.test.ts` |
| Pure maths: positioning, the cursor's arc | `position.test.ts` and similar |
| React binding or `<GuideMenu />` | `packages/react/test/react.test.tsx` |
| Anything visual, timing or real-browser (scrolling, focus, glide, small screens) | Playwright in `apps/demo/e2e/guide.spec.ts` |
| Imports must stay SSR-safe | `ssr.test.ts` in both packages already guards this. Keep it green. |

### Unit tests (core)

`packages/core/test/helpers.ts` gives you a guide with in-memory storage, reduced motion and a short target timeout, plus small DOM helpers:

```ts
import { describe, expect, it, vi } from "vitest";
import type { GuideTour } from "../src";
import { html, makeGuide, popoverTitle, waitForPhase } from "./helpers";

describe("my feature", () => {
  it("shows the second step after Next", async () => {
    html(`<button id="a">A</button><button id="b">B</button>`);
    const tour: GuideTour = {
      id: "t",
      title: "Tour",
      steps: [
        { id: "a", target: "#a", title: "Step A" },
        { id: "b", target: "#b", title: "Step B" },
      ],
    };
    const onError = vi.fn();
    const guide = makeGuide({ tours: [tour], onError });

    await guide.start("t");
    await waitForPhase(guide, "showing");
    await guide.next();

    expect(popoverTitle()).toBe("Step B");
    expect(onError).not.toHaveBeenCalled();
    guide.destroy();
  });
});
```

Tips:

- Use `waitForPhase(guide, "showing")` rather than timers. Each `await guide.next()` resolves once the next step is shown.
- Seed saved progress with `memoryStorage({ v: 1, tours: { t: { status: "skipped", step: 1, updatedAt: 1 } }, active: null, muted: false })`.
- Saved progress loads asynchronously. In React tests, wait for the UI to reflect it (for example the menu chip) before you click.

### End-to-end tests (demo)

The demo logs lifecycle events to `window.__guideEvents`. Drive the UI like a person would and assert on what they'd see:

```ts
test("my feature works in a real browser", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Guides/ }).click();
  await page.locator('[data-tour-id="quick-tips"]').click();
  const popover = page.locator(".gc-popover.gc-visible");
  await expect(popover.locator(".gc-title")).toHaveText("Find anything");
  await popover.locator(".gc-next").click();
  await expect(popover).toContainText("2 of 4");
});
```

If a feature needs new UI in the demo, add it to `apps/demo/src` (a tour in `tours.ts`, markup in `app.tsx`) and keep it small and realistic.

## Worked example: adding a step option

This is how `when` (conditional steps) was added in 0.2.0. Follow the same path for any new option.

**1. Agree on the behaviour first.** Write down the rules in the issue: when it runs, what it can see, what happens in each direction, and what happens on error. For `when`: it runs after `route` and `beforeShow` (so it can inspect the page), `false` moves on in the current direction, nothing applying before step 0 turns around, and a throwing `when` is reported as a `callback` error and the step shows anyway (never break the tour).

**2. Add the type with a doc comment** in `packages/core/src/types.ts`. The comment is the reference people see in their editor, so say what it does and when it runs:

```ts
export interface GuideStep {
  // …
  /**
   * Show this step only when it applies right now. Runs after `route` navigation and
   * `beforeShow`. Returning false moves on in the direction the user is going.
   * Unlike a missing target, a step that doesn't apply is not an error.
   */
  when?: (ctx: StepContext) => boolean | Promise<boolean>;
}
```

**3. Implement it in the lifecycle** (`showStep` in `guide.ts`) at the right point, with the token check after every `await` and errors reported, never thrown:

```ts
if (step.when) {
  let applies = true;
  try {
    applies = await step.when(ctx);
  } catch (error) {
    reportError({ type: "callback", error, tour, step, index });
  }
  if (my !== token) return;
  if (!applies) {
    const nextIndex = index + direction;
    if (nextIndex >= tour.steps.length) finish("completed");
    else if (nextIndex < 0) {
      direction = 1;
      await showStep(index + 1);
    } else await showStep(nextIndex);
    return;
  }
}
```

**4. Unit test every rule** from step 1: forward, back, turning around, completing, async conditions, ordering after `beforeShow`, and a throwing condition. See `describe("conditional steps (when)")` in `guide.test.ts`.

**5. Show it in the demo and add an e2e test** if people will see it. For `when`, the demo got a "Beta features" switch and a "What's new" tour, plus a Playwright test that runs the tour with the switch off and then on.

**6. Document it:** the `GuideStep` block in `README.md`, the relevant page in `docs/` (here `docs/guides/interactive-steps.md`) and the changelog under "Unreleased". If it's visual, re-record the GIF (`npm run record:gifs -- conditional-steps`).

**7. Check the size budget** with `npm run size`. Core should stay under 10 kB min+gzip. If a feature can't fit, it probably belongs in user land as a recipe in `docs/`.

## Design rules

These are what make guidecursor what it is. A pull request that breaks one needs a very good reason.

- **Non-blocking is the point.** Nothing may intercept pointer events outside the popover. New UI stays `pointer-events: none` unless the user has to interact with it. No dimmed overlays.
- **Never pop up uninvited.** Tours start from a user action or an explicit `autoStart`. Defaults must never change that.
- **No `window` or `document` at import time.** DOM work runs lazily so SSR imports stay safe. The node-environment tests in `ssr.test.ts` enforce this.
- **Never throw into the host app.** Storage, navigation and user callbacks are wrapped. Report problems through the `error` event and keep the tour going.
- **Respect reduced motion.** Every animation needs a reduced path (`prefers-reduced-motion` and the `.gc-reduced` class). The e2e suite checks the cursor jumps instead of gliding.
- **Strings are text.** Never render user strings with `innerHTML`. Rich content is passed as a DOM `Node`.
- **Accessible by default.** The popover is a non-modal `role="dialog"` with a label, progress is announced through an `aria-live` region, focus moves in and is restored, and every control works from the keyboard. If you add a control, give it an accessible name and keyboard support, and check it with a screen reader.
- **Small.** No runtime dependencies in core. Check `npm run size` on every change.
- **Theme through CSS variables.** New visuals read `--gc-*` custom properties with sensible fallbacks, and the variable gets documented in `styles.ts` and the README.

## Docs and GIFs

- `README.md` is the front door: what guidecursor is, quick starts, and the API reference.
- `docs/` holds task-focused guides and recipes. Each page answers one question ("How do I run a tour across pages?") with runnable code.
- `examples/` holds sample code you can copy. `examples/vanilla` runs as is with `npx vite examples/vanilla`.

Write docs for someone who has never seen guidecursor. Show the code first, keep sentences short, and say what the user sees, not only what the API does.

### Recording the GIFs

The GIFs in `docs/media` are recorded from the demo app, so they always match the real look:

```bash
npm run record:gifs                      # every scene
npm run record:gifs -- hero menu         # just these
```

`scripts/record-gifs.mjs` builds the packages and the demo, serves it with `vite preview` on port 4173, drives each scene in Chromium with video recording on, and converts each video to a GIF with ffmpeg (14 fps, 880 px wide, a palette built from the clip). Each scene is a short async function. To add one, add a function to `scenes` that drives the page and waits long enough for a reader to read each popover, then reference `docs/media/<scene>.gif` from the docs with alt text that describes what happens.

Keep GIFs under about 1.5 MB. Shorter scenes, a lower `FPS` or a narrower `GIF_WIDTH` all help.

## Pull request checklist

- [ ] The change is covered by tests (unit, React or e2e, whichever is cheapest and proves it)
- [ ] `npm run ci` passes locally (lint, build, typecheck, unit and e2e tests)
- [ ] `npm run size`: core is still under 10 kB min+gzip
- [ ] Public types have doc comments, and the README and the relevant `docs/` page are updated
- [ ] `CHANGELOG.md` has an entry under "Unreleased"
- [ ] Visual changes: screenshots or a re-recorded GIF are in the PR
- [ ] Nothing blocks the page, nothing pops up uninvited, and reduced motion and keyboard use still work

## Commit messages

Use conventional prefixes: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`. Mention the package when it helps (`feat(core): when for conditional steps`). Keep the first line under about 72 characters and explain the why in the body.

## Releasing (maintainers)

1. Move the "Unreleased" changelog entries under a new version heading with today's date.
2. Bump `version` in `packages/core/package.json` and `packages/react/package.json`. They stay in lockstep. Also bump react's dependency on core, and the demo's dependencies, to the same version.
3. `npm install` to refresh the lockfile, then `npm run ci` and `npm run size`.
4. `npm publish -w @guidecursor/core --access public && npm publish -w @guidecursor/react --access public`
5. Tag the release: `git tag v0.2.0 && git push --tags`.
6. Apps that vendor tarballs (`file:vendor/guidecursor/*.tgz`) need the new tarballs packed and their lockfiles updated (see [Working on the demo](#working-on-the-demo-and-trying-changes-in-a-real-app)).

## Getting help

Open an issue with your question and a minimal tour definition. For anything security-related, don't open a public issue: email the maintainers instead.
