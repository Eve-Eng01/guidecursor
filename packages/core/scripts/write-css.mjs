// Writes dist/styles.css from the stylesheet string, for hosts that set `injectStyles: false`.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { guidecursorCss } = await import(join(here, "../dist/index.js"));
writeFileSync(join(here, "../dist/styles.css"), `${guidecursorCss.trim()}\n`);
console.log("wrote dist/styles.css");
