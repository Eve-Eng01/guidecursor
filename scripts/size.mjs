// Reports minified + gzipped size of each package's ESM bundle (dependencies excluded).
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";

for (const pkg of ["core", "react"]) {
  const entry = `packages/${pkg}/dist/index.js`;
  const raw = readFileSync(entry);
  const out = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    external: ["react", "react-dom", "react/jsx-runtime", "@guidecursor/core"],
  });
  const min = out.outputFiles[0].contents;
  const kb = (n) => `${(n / 1024).toFixed(2)} kB`;
  console.log(
    `@guidecursor/${pkg}: ${kb(raw.length)} raw, ${kb(min.length)} min, ${kb(gzipSync(min, { level: 9 }).length)} min+gzip`,
  );
}
