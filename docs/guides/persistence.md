# Saving progress

guidecursor remembers, for each person, which tours they've finished, skipped or dismissed, and where a running tour was. That's what makes "pick up where you left off" and the Guides menu's progress chips work.

By default progress lives in `localStorage` under the key `guidecursor`. All of it is one small JSON object:

```json
{
  "v": 1,
  "tours": { "create-event": { "status": "skipped", "step": 4, "updatedAt": 1764230400000 } },
  "active": null,
  "muted": false
}
```

## One person per browser? Key it by user

On shared computers, or when people switch accounts, key progress by user so tours don't leak between them. In React, also give the provider a `key`, so it starts fresh when the user changes:

```tsx
const storage = useMemo(() => localStorageAdapter({ key: `guides:${user.id}` }), [user.id]);

<GuideCursorProvider key={user.id} tours={tours} storage={storage}>
```

`localStorageAdapter({ session: true })` uses `sessionStorage` instead, so progress is forgotten when the tab closes.

## Save on your server

Two functions make an adapter. Both may be async, and both may throw: failures are reported as `error` events with `type: "storage"`, and the tour keeps working in memory.

```ts
import type { PersistedData, StorageAdapter } from "@guidecursor/core";

export const serverStorage: StorageAdapter = {
  async load() {
    const res = await fetch("/api/me/guides", { credentials: "include" });
    return res.ok ? ((await res.json()) as PersistedData) : null;
  },
  async save(data) {
    await fetch("/api/me/guides", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
};
```

`save` runs on every step. If that's too chatty for your API, debounce it, or write through to `localStorage` and sync in the background. See [`examples/snippets/server-storage.ts`](../../examples/snippets/server-storage.ts) for a debounced version that also falls back to `localStorage` when the server is unreachable.

## Don't save anything

Use `memoryStorage()` for tests, kiosks and demos:

```ts
createGuide({ tours, storage: memoryStorage() });
```

## Resetting

`guide.reset("create-event")` forgets one tour, and `guide.reset()` forgets everything, including "Don't show again". A "Reset tips" item in your settings page is a friendly way to offer this.
