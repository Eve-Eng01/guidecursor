// Next.js App Router: the provider uses browser APIs, so it lives in a client component.
// Use it in app/layout.tsx: <GuidesProvider>{children}</GuidesProvider>
"use client";

import { GuideCursorProvider } from "@guidecursor/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { tours } from "./tours";

export function GuidesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return (
    <GuideCursorProvider
      tours={tours}
      // router.push doesn't return a promise; guidecursor waits for the next target instead
      navigate={(to) => router.push(to)}
      currentRoute={search ? `${pathname}?${search}` : pathname}
    >
      {children}
    </GuideCursorProvider>
  );
}
