import { useEffect, useState } from "react";

// A deliberately tiny history router so the demo has no router dependency.
// Real apps pass their router's navigate (TanStack Router, React Router, Next.js…).
// Routes are app paths like "/events"; BASE is where the demo is served from
// ("/" locally, "/guidecursor/" on GitHub Pages).
const EVENT = "demo:navigate";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** The current app route (the URL path without the base). */
export function currentPath(): string {
  const path = window.location.pathname;
  const route = BASE && path.startsWith(BASE) ? path.slice(BASE.length) : path;
  return route || "/";
}

export function navigate(to: string): void {
  if (to === currentPath()) return;
  window.history.pushState(null, "", BASE + to);
  window.dispatchEvent(new Event(EVENT));
}

export function usePathname(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const update = () => setPath(currentPath());
    window.addEventListener("popstate", update);
    window.addEventListener(EVENT, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(EVENT, update);
    };
  }, []);
  return path;
}
