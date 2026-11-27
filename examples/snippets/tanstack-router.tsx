// TanStack Router: provider inside the router (e.g. src/routes/__root.tsx), progress kept per user.
import { GuideCursorProvider, GuideMenu, localStorageAdapter } from "@guidecursor/react";
import { createRootRoute, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { useCurrentUser } from "../auth"; // your auth hook
import { tours } from "../tours";

function Root() {
  const router = useRouter();
  const href = useRouterState({ select: (s) => s.location.href }); // pathname + search
  const user = useCurrentUser();
  const storage = useMemo(() => localStorageAdapter({ key: `guides:${user?.id ?? "anon"}` }), [user?.id]);

  return (
    <GuideCursorProvider
      key={user?.id ?? "anon"} // a different person gets a fresh guide
      tours={tours}
      storage={storage}
      currentRoute={href}
      navigate={(to) => router.navigate({ href: to })} // resolves once loaders finish
      targetTimeout={8000} // data-heavy pages can take a moment
      onMissingTarget="center" // never drop a step silently
    >
      <header>
        <GuideMenu resume="in-progress" />
      </header>
      <Outlet />
    </GuideCursorProvider>
  );
}

export const Route = createRootRoute({ component: Root });
