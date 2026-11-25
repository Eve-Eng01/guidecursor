import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2020",
  tsconfig: "tsconfig.build.json",
  external: ["react", "react-dom", "@guidecursor/core"],
  banner: { js: '"use client";' },
});
