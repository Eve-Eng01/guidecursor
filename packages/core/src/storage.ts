import type { PersistedData, StorageAdapter } from "./types";

export function emptyData(): PersistedData {
  return { v: 1, tours: {}, active: null, muted: false };
}

/** Coerces unknown input (old versions, tampered storage, server payloads) into valid data. */
export function normalizeData(input: unknown): PersistedData {
  const data = emptyData();
  if (!input || typeof input !== "object") return data;
  const raw = input as Partial<PersistedData>;
  if (raw.tours && typeof raw.tours === "object") {
    for (const [id, p] of Object.entries(raw.tours)) {
      if (!p || typeof p !== "object") continue;
      const status = (p as { status?: unknown }).status;
      if (status !== "in-progress" && status !== "skipped" && status !== "completed" && status !== "dismissed") {
        continue;
      }
      const step = Number((p as { step?: unknown }).step);
      data.tours[id] = {
        status,
        step: Number.isFinite(step) && step >= 0 ? Math.floor(step) : 0,
        updatedAt: Number((p as { updatedAt?: unknown }).updatedAt) || 0,
      };
    }
  }
  if (raw.active && typeof raw.active === "object" && typeof raw.active.tourId === "string") {
    const step = Number(raw.active.step);
    data.active = { tourId: raw.active.tourId, step: Number.isFinite(step) && step >= 0 ? Math.floor(step) : 0 };
  }
  data.muted = raw.muted === true;
  return data;
}

export interface LocalStorageAdapterOptions {
  /** Storage key. Default `"guidecursor"`. Include a user id to keep users apart on shared devices. */
  key?: string;
  /** Use `sessionStorage` instead of `localStorage`. */
  session?: boolean;
}

/**
 * Default adapter. Every access is wrapped in try/catch: private mode, disabled storage,
 * quota errors and corrupted JSON all degrade to "no saved progress" instead of throwing.
 */
export function localStorageAdapter(options: LocalStorageAdapterOptions = {}): StorageAdapter {
  const key = options.key ?? "guidecursor";
  const getStore = (): Storage | null => {
    try {
      if (typeof window === "undefined") return null;
      return options.session ? window.sessionStorage : window.localStorage;
    } catch {
      return null;
    }
  };
  return {
    load() {
      try {
        const raw = getStore()?.getItem(key);
        return raw ? normalizeData(JSON.parse(raw)) : null;
      } catch {
        return null;
      }
    },
    save(data) {
      try {
        getStore()?.setItem(key, JSON.stringify(data));
      } catch {
        // Quota exceeded / storage disabled: progress simply is not persisted.
      }
    },
  };
}

/** Keeps progress in memory only (lost on reload). Useful for tests and SSR. */
export function memoryStorage(initial?: PersistedData): StorageAdapter {
  let data: PersistedData | null = initial ? normalizeData(initial) : null;
  return {
    load: () => (data ? normalizeData(data) : null),
    save: (next) => {
      data = normalizeData(JSON.parse(JSON.stringify(next)));
    },
  };
}
