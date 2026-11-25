# @guidecursor/react

React 18/19 bindings for [guidecursor](../../README.md): `<GuideCursorProvider>`, `useGuideCursor()` and the on-demand `<GuideMenu />`.

```bash
npm install @guidecursor/react
```

```tsx
<GuideCursorProvider tours={tours} navigate={(to) => router.navigate({ href: to })}>
  <GuideMenu />
  <App />
</GuideCursorProvider>
```

Everything from `@guidecursor/core` is re-exported. See the [main README](../../README.md). MIT licensed.
