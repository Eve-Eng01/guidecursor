import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The demo consumes the packages from source so it never runs against a stale build.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@guidecursor/core": src("../../packages/core/src/index.ts"),
      "@guidecursor/react": src("../../packages/react/src/index.ts"),
    },
  },
});
