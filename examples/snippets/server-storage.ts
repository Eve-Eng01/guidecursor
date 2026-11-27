// Save tour progress on your server. Writes are debounced, and if the server can't be reached,
// progress still lives in localStorage so nobody loses their place.
import { localStorageAdapter, type PersistedData, type StorageAdapter } from "@guidecursor/core";

export function serverStorage(userId: string, { endpoint = "/api/me/guides", debounceMs = 800 } = {}): StorageAdapter {
  const local = localStorageAdapter({ key: `guides:${userId}` });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: PersistedData | null = null;

  const flush = async () => {
    if (!pending) return;
    const body = JSON.stringify(pending);
    pending = null;
    await fetch(endpoint, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body,
    });
  };

  // Don't lose the last write when the tab closes
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
      if (pending) navigator.sendBeacon?.(endpoint, new Blob([JSON.stringify(pending)], { type: "application/json" }));
    });
  }

  return {
    async load() {
      try {
        const res = await fetch(endpoint, { credentials: "include" });
        if (res.ok) return (await res.json()) as PersistedData;
      } catch {
        // offline or server error: fall back to this browser's copy
      }
      return local.load();
    },
    save(data) {
      local.save(data);
      pending = data;
      clearTimeout(timer);
      timer = setTimeout(() => void flush().catch(() => {}), debounceMs);
    },
  };
}
