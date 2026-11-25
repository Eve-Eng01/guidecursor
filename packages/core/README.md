# @guidecursor/core

Framework-agnostic engine for [guidecursor](../../README.md): non-blocking, skippable product walkthroughs with an animated guide cursor.

```bash
npm install @guidecursor/core
```

```ts
import { createGuide } from "@guidecursor/core";

const guide = createGuide({
  tours: [{ id: "basics", title: "Basics", steps: [{ target: "#search", title: "Find anything" }] }],
});
guide.start("basics");
```

See the [main README](../../README.md) for the full API, theming and accessibility notes. MIT licensed.
