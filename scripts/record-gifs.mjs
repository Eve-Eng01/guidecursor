#!/usr/bin/env node
/**
 * Records the animated GIFs in docs/media from the demo app.
 *
 *   npm run record:gifs                # all scenes
 *   npm run record:gifs -- hero menu   # just these scenes
 *
 * Needs ffmpeg on your PATH and Playwright's Chromium (`npx playwright install chromium`).
 * It builds the packages and the demo, serves the demo with `vite preview`, drives each scene in
 * a real browser with video recording on, then turns each video into an optimised GIF.
 * Re-run it whenever the UI changes so the docs never show an old look.
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "docs/media");
const PORT = 4173;
const BASE = `http://localhost:${PORT}`;
const VIEWPORT = { width: 1100, height: 640 };
const GIF_WIDTH = 880;
const FPS = 14;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const popover = (page) => page.locator(".gc-popover.gc-visible");

async function openTour(page, id) {
  await page.getByRole("button", { name: /Guides/ }).click();
  await wait(700);
  await page.locator(`[data-tour-id="${id}"]`).click();
}

/** Press the popover's Next button and give the cursor time to glide and the reader time to read. */
async function next(page, readMs = 1800) {
  await popover(page).locator(".gc-next").click();
  await wait(readMs);
}

/** Each scene gets a fresh page that already shows the demo; return when the last frame is done. */
const scenes = {
  // Hero: a three-page tour that waits for a late-loading form.
  hero: async (page) => {
    await openTour(page, "app-tour");
    await wait(2200);
    await next(page, 2000);
    await next(page, 2300);
    await next(page, 2600);
    await next(page, 1800);
    await next(page, 600);
  },

  // advanceOn: the tour waits for a real click, and scrolls to an off-screen target.
  "advance-on-click": async (page) => {
    await openTour(page, "quick-tips");
    await wait(1800);
    await next(page, 1800);
    await page.locator("#counter").click();
    await wait(400);
    await page.locator("#counter").click();
    await wait(2200);
    await next(page, 1600);
    await next(page, 600);
  },

  // The on-demand Guides menu: progress chips, skipping with Esc, picking up again.
  menu: async (page) => {
    await page.getByRole("button", { name: /Guides/ }).click();
    await wait(1800);
    await page.locator('[data-tour-id="quick-tips"]').click();
    await wait(1600);
    await next(page, 1400);
    await page.keyboard.press("Escape");
    await wait(900);
    await page.getByRole("button", { name: /Guides/ }).click();
    await wait(1800);
    await page.locator('[data-tour-id="quick-tips"]').click();
    await wait(1800);
  },

  // `when`: a step that only shows once the page says it applies.
  "conditional-steps": async (page) => {
    await openTour(page, "whats-new");
    await wait(1600);
    await next(page, 1700);
    await next(page, 700);
    await page.locator("#beta-toggle input").check();
    await wait(800);
    await openTour(page, "whats-new");
    await wait(1500);
    await next(page, 2000);
    await next(page, 1300);
    await next(page, 500);
  },

  // Theming with CSS custom properties only.
  theming: async (page) => {
    await page.addStyleTag({
      content: `:root{--gc-accent:#0ea5e9;--gc-bg:#0f172a;--gc-fg:#e2e8f0;--gc-muted:#94a3b8;--gc-border:rgba(148,163,184,.25);--gc-radius:6px;--gc-cursor-fill:#0ea5e9}
        body{background:#020617;color:#e2e8f0} .panel,.cards article{background:#0f172a!important;color:#e2e8f0!important;border-color:#1e293b!important}`,
    });
    await openTour(page, "app-tour");
    await wait(2200);
    await next(page, 2200);
    await next(page, 900);
  },
};

async function serve() {
  const server = spawn("npm", ["run", "preview", "-w", "@guidecursor/demo"], {
    cwd: ROOT,
    stdio: "ignore",
    detached: true,
  });
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return server;
    } catch {
      /* not up yet */
    }
    await wait(150);
  }
  throw new Error(`demo did not start on ${BASE}`);
}

function toGif(video, gif, startSeconds) {
  // One pass: build a palette from the clip itself, then dither with it (small files, crisp text).
  const graph =
    `fps=${FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,split[a][b];` +
    "[a]palettegen=max_colors=96:stats_mode=diff[p];" +
    "[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle";
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-ss",
    startSeconds.toFixed(2),
    "-i",
    video,
    "-vf",
    graph,
    "-loop",
    "0",
    gif,
  ]);
}

async function main() {
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : Object.keys(scenes);
  for (const n of names)
    if (!scenes[n]) throw new Error(`unknown scene "${n}". Scenes: ${Object.keys(scenes).join(", ")}`);

  execFileSync("npm", ["run", "build"], { cwd: ROOT, stdio: "inherit" });
  execFileSync("npm", ["run", "build:demo"], { cwd: ROOT, stdio: "inherit" });
  mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch();
  try {
    for (const name of names) {
      const dir = mkdtempSync(join(tmpdir(), `gc-${name}-`));
      const context = await browser.newContext({
        viewport: VIEWPORT,
        recordVideo: { dir, size: VIEWPORT },
        deviceScaleFactor: 1,
      });
      const started = Date.now();
      const page = await context.newPage();
      await page.goto(BASE);
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForLoadState("networkidle");
      await wait(500);
      const sceneStart = (Date.now() - started) / 1000;
      await scenes[name](page);
      await context.close();
      const video = join(
        dir,
        readdirSync(dir).find((f) => f.endsWith(".webm")),
      );
      const gif = join(OUT, `${name}.gif`);
      toGif(video, gif, Math.max(0, sceneStart - 0.3));
      rmSync(dir, { recursive: true, force: true });
      console.log(`${name}.gif  ${(statSync(gif).size / 1024).toFixed(0)} KB`);
    }
  } finally {
    await browser.close();
    process.kill(-server.pid);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
