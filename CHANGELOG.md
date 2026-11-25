# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the packages use
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
