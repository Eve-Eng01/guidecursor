import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const nodeMajor = Number(process.versions.node.split(".")[0]);

export default defineConfig({
  resolve: {
    alias: { "@guidecursor/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    // Node 25+ ships its own (file-backed) localStorage global that shadows jsdom's.
    poolOptions: { forks: { execArgv: nodeMajor >= 22 ? ["--no-experimental-webstorage"] : [] } },
    include: ["test/**/*.test.tsx"],
  },
});
