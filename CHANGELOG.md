# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the packages use
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-11-27

### Added

- `@guidecursor/core`
  - `GuideStep.when(ctx)`: show a step only when it applies. It runs after `route` and `beforeShow`. When it returns `false`, the step is passed over in the direction the user is moving, without a `target-missing` error. If no earlier step applies on Back, the guide turns around.
  - `GuideStep.onMissingTarget` overrides the guide-wide setting for one step.
  - `MissingTargetMode` type export.
- `@guidecursor/react`
  - `<GuideMenu resume>`: `true` (default, unchanged), `"in-progress"`, `false`, or `(tour) => boolean`. It decides whether picking a half-finished tour continues or starts over.
- Demo: a "What's new" tour with a conditional step, plus an e2e test for it.
- Docs: `docs/` guides and recipes, `examples/`, animated GIFs recorded from the demo (`npm run record:gifs`), and a much longer CONTRIBUTING.md.
- Ready for public use: npm package metadata (`repository`, `homepage`, `bugs`, `publishConfig` with provenance), npm-friendly package READMEs, a release workflow, a GitHub Pages workflow for the demo (which now works under a base path), Dependabot, issue and pull request templates, `CODE_OF_CONDUCT.md` and `SECURITY.md`.

## [0.1.0] - 2026-11-25

### Added

- `@guidecursor/core`
  - `createGuide()` tour engine with phases `idle → navigating → waiting → moving → showing`.
  - Animated guide cursor: eased, curved glide using requestAnimationFrame, re-targets mid-flight, optional name tag and arrival ripple, honours `prefers-reduced-motion`.
  - Anchored popover with flip/shift positioning, scroll-into-view, scroll/resize/ResizeObserver repositioning, centered steps.
  - Soft highlight ring; no blocking overlay.
  - Keyboard shortcuts (Esc, ←, →, Enter), focus management, non-modal `role="dialog"`, `aria-live` announcements.
  - Skip, "Don't show again" (mutes auto-start), stop, resume, reset.
  - Persistence adapters: `localStorageAdapter()` (fault tolerant), `memoryStorage()`, custom async adapters.
  - Multi-page tours via step `route` / `routeMatch` and a host `navigate` hook; resume after full reloads.
  - Wait-for-element with MutationObserver and timeout; `onMissingTarget` = skip | end | center.
  - `advanceOn` to advance on real user actions; `beforeShow` / `onShow` / `onHide` hooks.
  - Events: start, step, skip, dismiss, complete, end, error.
  - CSS-variable theming; `injectStyles: false` + `@guidecursor/core/styles.css` for strict CSP.
  - SSR-safe; ESM + CJS + type declarations.
- `@guidecursor/react`
  - `<GuideCursorProvider>`, `useGuideCursor()`, `useGuide()`.
  - `<GuideMenu />` on-demand "Guides" dropdown with completion state.
- Demo app (Vite + React) with a three-page tour, Playwright e2e tests and vitest unit tests.

[Unreleased]: https://github.com/Eve-Eng01/guidecursor/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Eve-Eng01/guidecursor/releases/tag/v0.2.0
[0.1.0]: https://github.com/Eve-Eng01/guidecursor/commit/b76a751
