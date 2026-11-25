# Contributing to guidecursor

Thanks for helping! This is a small npm-workspaces monorepo:

```
packages/core    @guidecursor/core   – framework-agnostic engine (vanilla DOM)
packages/react   @guidecursor/react  – React provider, hook and GuideMenu
apps/demo        Vite + React demo, also the target of the Playwright e2e suite
```

## Setup

```bash
npm install
npx playwright install chromium   # once, for e2e
```

Node 18+ works; CI uses Node 22.

## Everyday commands

| Command | What it does |
|---|---|
| `npm run build` | Build core then react with tsup (ESM + CJS + d.ts) |
| `npm test` | Unit tests (vitest + jsdom) for core and react |
| `npm run test:e2e` | Build the demo, serve it and run Playwright against it |
| `npm run lint` / `npm run lint:fix` | Biome lint + format check |
| `npm run typecheck` | `tsc` for every workspace |
| `npm run size` | Min+gzip size of the built bundles |
| `npm run dev -w @guidecursor/demo` | Demo with hot reload (consumes package sources directly) |

## Guidelines

- **Non-blocking is the point.** Nothing should intercept pointer events outside the popover. If you add UI, keep it `pointer-events: none` unless the user must interact with it.
- **No `window`/`document` at import time.** Everything DOM-related must run lazily so SSR imports stay safe (there is a node-environment test for this).
- **Never throw into the host app.** Storage, navigation and user callbacks are wrapped; report problems through the `error` event instead.
- **Respect reduced motion** for any new animation (CSS `prefers-reduced-motion` and the `.gc-reduced` class).
- **Strings are text.** Never render user strings with `innerHTML`.
- Add or update tests: unit tests for engine behaviour, e2e for anything visual or interactive.
- Update `CHANGELOG.md` under "Unreleased".

## Commit messages

Conventional-ish prefixes (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) are appreciated.

## Releasing (maintainers)

1. Bump versions in `packages/*/package.json` (keep them in lockstep) and the changelog.
2. `npm run ci`
3. `npm publish -w @guidecursor/core --access public && npm publish -w @guidecursor/react --access public`
