# Getting started

This page takes you from nothing to a working three-step tour. You'll install guidecursor, mark the elements you want to point at, describe the tour, and start it from a button.

## 1. Install

```bash
npm install @guidecursor/react   # React 18 or 19 (includes core)
# or, for any other framework or plain JavaScript:
npm install @guidecursor/core
```

## 2. Mark what you want to point at

A step points at its **target**, which is a CSS selector, an element, or a function that returns one. A dedicated attribute such as `data-tour` is the most robust choice, because it won't change when someone renames a class or restyles the page:

```html
<input data-tour="search" type="search" placeholder="Search…" />
<button data-tour="new-event">+ New event</button>
<section data-tour="stats">…</section>
```

Point at the whole field or card, not just the input. The highlight ring then frames the label too, and the popover has room to sit beside it.

## 3. Describe the tour

```ts
// tours.ts
import type { GuideTour } from "@guidecursor/react";

const t = (name: string) => `[data-tour="${name}"]`;

export const tours: GuideTour[] = [
  {
    id: "dashboard",
    title: "Find your way around",
    description: "Search, stats and creating events",
    steps: [
      { target: t("search"), title: "Find anything", content: "Search events, people and payouts." },
      { target: t("stats"), title: "Your numbers", content: "Sales and attendance, updated live." },
      { target: t("new-event"), title: "Create an event", content: "Start here when you're ready.", placement: "left" },
    ],
  },
];
```

Good step copy is short: a title that names the thing, and one or two sentences on why it matters. Strings are always rendered as text, never as HTML.

## 4. Start it

### React

Wrap your app once, then let people pick a tour from the built-in Guides menu, or start one from your own button:

```tsx
import { GuideCursorProvider, GuideMenu, useGuideCursor } from "@guidecursor/react";
import { tours } from "./tours";

export function App() {
  return (
    <GuideCursorProvider tours={tours} cursor={{ label: "Guide" }}>
      <header>
        <GuideMenu /> {/* a "Guides" dropdown; nothing starts on its own */}
      </header>
      <Dashboard />
    </GuideCursorProvider>
  );
}

function HelpButton() {
  const { start } = useGuideCursor();
  return <button onClick={() => start("dashboard")}>Show me around</button>;
}
```

### Vanilla JavaScript

```ts
import { createGuide } from "@guidecursor/core";
import { tours } from "./tours";

const guide = createGuide({ tours, cursor: { label: "Guide" } });
document.querySelector("#help")?.addEventListener("click", () => guide.start("dashboard"));
```

A complete, runnable version is in [`examples/vanilla`](../examples/vanilla).

## 5. Try it

Click your button. The cursor glides to the search box, the popover explains it, and **Next** moves on. The page stays usable the whole time: people can click, type and scroll. **Esc** or **×** skips the tour, and progress is saved, so the Guides menu shows how far they got.

## Next steps

- Tour across pages: [Multi-page tours](guides/multi-page-tours.md)
- Wait for real clicks, or show steps only when they apply: [Interactive and conditional steps](guides/interactive-steps.md)
- Understand the lifecycle: [How a tour runs](concepts.md)
