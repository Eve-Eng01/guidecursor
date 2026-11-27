# Examples

Copy-paste sample code. Each file is small and stands on its own.

| Example | What it shows |
|---|---|
| [`vanilla/`](vanilla) | A complete page with no framework: a tour started from a button, `advanceOn`, a conditional step, and events logged to the console. Runnable. |
| [`../apps/demo`](../apps/demo) | The React demo: three pages, the Guides menu, a late-loading form, auto-start behind `?welcome`. Runnable with `npm run dev -w @guidecursor/demo`. |
| [`snippets/react-router.tsx`](snippets/react-router.tsx) | Provider wired to React Router |
| [`snippets/tanstack-router.tsx`](snippets/tanstack-router.tsx) | Provider wired to TanStack Router, per-user storage |
| [`snippets/next-app-router.tsx`](snippets/next-app-router.tsx) | Provider for the Next.js App Router (client component) |
| [`snippets/help-hint.tsx`](snippets/help-hint.tsx) | A "How does this work?" button that starts a tour at a step |
| [`snippets/server-storage.ts`](snippets/server-storage.ts) | Saving progress on your server: debounced, with a `localStorage` fallback |
| [`snippets/tours.spec.ts`](snippets/tours.spec.ts) | A Playwright test that runs a tour end to end and fails on any `target-missing` |

## Run the vanilla example

```bash
npm install
npm run build              # the example imports the built @guidecursor/core
npx vite examples/vanilla  # then open the URL it prints
```

The snippets import libraries this repo doesn't install (React Router, Next.js…). They're references to copy into your app, not part of the build.
