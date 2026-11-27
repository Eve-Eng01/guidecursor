import { expect, type Locator, type Page, test } from "@playwright/test";

const popover = (page: Page) => page.locator(".gc-popover.gc-visible");
const title = (page: Page) => popover(page).locator(".gc-title");

async function openMenuAndStart(page: Page, tourId: string) {
  await page.getByRole("button", { name: /Guides/ }).click();
  await page.locator(`[data-tour-id="${tourId}"]`).click();
}

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("element has no box");
  return b;
}

/** The cursor tip in viewport coordinates (tip is drawn at 4,3 inside the 24px SVG). */
async function cursorTip(page: Page) {
  const b = await box(page.locator(".gc-cursor"));
  return { x: b.x + 4, y: b.y + 3 };
}

function inside(p: { x: number; y: number }, b: { x: number; y: number; width: number; height: number }) {
  return p.x >= b.x - 1 && p.x <= b.x + b.width + 1 && p.y >= b.y - 1 && p.y <= b.y + b.height + 1;
}

/** Records every data-state the cursor goes through. */
async function recordCursorStates(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __cursorStates: string[] };
    w.__cursorStates = [];
    const el = document.querySelector(".gc-cursor") as HTMLElement;
    new MutationObserver(() => w.__cursorStates.push(el.dataset.state ?? "")).observe(el, {
      attributes: true,
      attributeFilter: ["data-state", "style"],
    });
  });
}
const cursorStates = (page: Page) =>
  page.evaluate(() => (window as unknown as { __cursorStates: string[] }).__cursorStates);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("no tour pops up on its own", async ({ page }) => {
  await page.waitForTimeout(1000);
  await expect(popover(page)).toHaveCount(0);
  await expect(page.getByTestId("tour-status")).toHaveText("No tour running");
});

test("cursor glides to the target and the popover is anchored beside it", async ({ page }) => {
  await openMenuAndStart(page, "app-tour");
  await expect(title(page)).toHaveText("Your dashboard");
  await expect(page.locator(".gc-cursor")).toHaveAttribute("data-state", "idle");

  const stats = await box(page.locator("#stats"));
  expect(inside(await cursorTip(page), stats)).toBe(true);
  const pop = await box(popover(page));
  const vp = page.viewportSize()!;
  expect(pop.x).toBeGreaterThanOrEqual(0);
  expect(pop.x + pop.width).toBeLessThanOrEqual(vp.width);
  expect(pop.y + pop.height).toBeLessThanOrEqual(vp.height);
  // Placed below the target without covering it.
  expect(pop.y).toBeGreaterThanOrEqual(stats.y + stats.height);
  await expect(page.locator(".gc-ring.gc-visible")).toHaveCount(1);

  // Next: the cursor animates (several intermediate frames) to the new target.
  await recordCursorStates(page);
  const before = await cursorTip(page);
  await popover(page).getByRole("button", { name: "Next" }).click();
  await expect(title(page)).toHaveText("Start something new");
  const states = await cursorStates(page);
  expect(states).toContain("moving");
  expect(states.length).toBeGreaterThan(5);
  const target = await box(page.locator("[data-tour='new-event']"));
  const after = await cursorTip(page);
  expect(inside(after, target)).toBe(true);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(50);
  // Requested placement "left".
  const pop2 = await box(popover(page));
  expect(pop2.x + pop2.width).toBeLessThanOrEqual(target.x);
});

test("the page stays clickable and typeable during a tour", async ({ page }) => {
  await openMenuAndStart(page, "app-tour");
  await expect(title(page)).toHaveText("Your dashboard");
  await page.locator("#counter").click();
  await page.locator("#counter").click();
  await expect(page.locator("#counter")).toHaveText("Clicked 2 times");
  await page.locator("#search").fill("rooftop");
  await expect(page.locator("#search")).toHaveValue("rooftop");
  // Nothing of ours sits on top of the target.
  const hit = await page.evaluate(() => {
    const r = document.querySelector("#stats article")!.getBoundingClientRect();
    return (
      document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("[data-guidecursor]") === null
    );
  });
  expect(hit).toBe(true);
  // Typing arrows in a page input does not drive the tour.
  await page.locator("#search").press("ArrowRight");
  await expect(title(page)).toHaveText("Your dashboard");
});

test("skip via the close button ends the tour and remembers where it stopped", async ({ page }) => {
  await openMenuAndStart(page, "app-tour");
  await expect(title(page)).toHaveText("Your dashboard");
  await popover(page).getByRole("button", { name: "Next" }).click();
  await expect(title(page)).toHaveText("Start something new");
  await popover(page).getByRole("button", { name: "Skip tour" }).click();
  await expect(popover(page)).toHaveCount(0);
  await expect(page.locator(".gc-cursor")).toHaveAttribute("data-state", "hidden");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("guidecursor") ?? "{}"));
  expect(saved.tours["app-tour"]).toMatchObject({ status: "skipped", step: 1 });
  expect(await page.evaluate(() => window.__guideEvents)).toContain("skip:app-tour:1");

  // The menu offers to resume at step 2.
  await page.getByRole("button", { name: /Guides/ }).click();
  await expect(page.locator('[data-tour-id="app-tour"] .gc-menu-status')).toHaveText("2/5");
  await page.locator('[data-tour-id="app-tour"]').click();
  await expect(title(page)).toHaveText("Start something new");
});

test("keyboard: arrows and Enter navigate, Esc skips, focus moves into the dialog", async ({ page }) => {
  await openMenuAndStart(page, "app-tour");
  await expect(title(page)).toHaveText("Your dashboard");
  await expect(popover(page)).toBeFocused();
  await expect(popover(page)).toHaveAttribute("role", "dialog");
  await expect(popover(page)).toHaveAttribute("aria-modal", "false");

  await page.keyboard.press("ArrowRight");
  await expect(title(page)).toHaveText("Start something new");
  await page.keyboard.press("ArrowLeft");
  await expect(title(page)).toHaveText("Your dashboard");
  await page.keyboard.press("Enter");
  await expect(title(page)).toHaveText("Start something new");
  await page.keyboard.press("Escape");
  await expect(popover(page)).toHaveCount(0);
  await expect(page.getByTestId("tour-status")).toHaveText("No tour running");
});

test("multi-page tour navigates, waits for late targets and resumes after a reload", async ({ page }) => {
  await openMenuAndStart(page, "app-tour");
  await expect(title(page)).toHaveText("Your dashboard");
  await page.keyboard.press("ArrowRight");
  await expect(title(page)).toHaveText("Start something new");
  await page.keyboard.press("ArrowRight");

  await expect(page).toHaveURL(/\/events$/);
  await expect(title(page)).toHaveText("Events live here");
  expect(inside(await cursorTip(page), await box(page.locator("#create-event")))).toBe(true);

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/settings$/);
  // The payout form renders ~700ms late; the guide waits for it.
  await expect(title(page)).toHaveText("Get paid");
  expect(inside(await cursorTip(page), await box(page.locator("#payout-form")))).toBe(true);

  // Full reload mid-tour: the guide resumes on the same step.
  await page.reload();
  await expect(title(page)).toHaveText("Get paid");
  await expect(page.getByTestId("tour-status")).toHaveText("Take the full tour: 4/5");

  await popover(page).getByRole("button", { name: "Next" }).click();
  await expect(title(page)).toHaveText("You're all set");
  await expect(popover(page)).toHaveAttribute("data-placement", "center");
  await popover(page).getByRole("button", { name: "Done" }).click();
  await expect(popover(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.__guideEvents)).toContain("complete:app-tour");

  await page.getByRole("button", { name: /Guides/ }).click();
  await expect(page.locator('[data-tour-id="app-tour"] .gc-menu-status')).toHaveText("Done");
});

test("advanceOn waits for the user's click; off-screen targets are scrolled into view", async ({ page }) => {
  await openMenuAndStart(page, "quick-tips");
  await expect(title(page)).toHaveText("Find anything");
  await page.keyboard.press("ArrowRight");
  await expect(title(page)).toHaveText("Try it yourself");
  await page.locator("#counter").click();
  await expect(title(page)).toHaveText("Even off-screen targets");
  await expect(page.locator("#footnote")).toBeInViewport();
  const foot = await box(page.locator("#footnote"));
  expect(inside(await cursorTip(page), foot)).toBe(true);
  const pop = await box(popover(page));
  expect(pop.y + pop.height).toBeLessThanOrEqual(foot.y);
});

test("auto-start runs only when the tour's condition passes", async ({ page }) => {
  await page.goto("/?welcome");
  await expect(title(page)).toHaveText("Need a hand?");
  await page.keyboard.press("Escape");
  await page.goto("/?welcome");
  await page.waitForTimeout(800);
  await expect(popover(page)).toHaveCount(0);
});

test.describe("reduced motion", () => {
  test("the cursor jumps instead of gliding", async ({ page }) => {
    // (test.use({ reducedMotion }) is not applied by this Playwright build; emulate explicitly.)
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await openMenuAndStart(page, "app-tour");
    await expect(title(page)).toHaveText("Your dashboard");
    await expect(page.locator(".gc-root")).toHaveAttribute("data-gc-motion", "reduce");
    await recordCursorStates(page);
    await page.keyboard.press("ArrowRight");
    await expect(title(page)).toHaveText("Start something new");
    const states = await cursorStates(page);
    expect(states).not.toContain("moving");
    expect(inside(await cursorTip(page), await box(page.locator("[data-tour='new-event']")))).toBe(true);
    const transition = await page.locator(".gc-popover").evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(transition.split(",").every((d) => Number.parseFloat(d) === 0)).toBe(true);
  });
});

test.describe("small screens", () => {
  test.use({ viewport: { width: 390, height: 760 } });

  test("the popover stays inside the viewport", async ({ page }) => {
    await openMenuAndStart(page, "app-tour");
    await expect(title(page)).toHaveText("Your dashboard");
    for (const nextTitle of ["Start something new", "Events live here"]) {
      const pop = await box(popover(page));
      expect(pop.x).toBeGreaterThanOrEqual(0);
      expect(pop.x + pop.width).toBeLessThanOrEqual(390);
      expect(pop.y).toBeGreaterThanOrEqual(0);
      expect(pop.y + pop.height).toBeLessThanOrEqual(760);
      await page.keyboard.press("ArrowRight");
      await expect(title(page)).toHaveText(nextTitle);
    }
  });
});

test("a `when` step is passed over until it applies, with no missing-target error", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await openMenuAndStart(page, "whats-new");
  await expect(title(page)).toHaveText("Beta features");
  await popover(page).locator(".gc-next").click();
  // Beta is off: straight to the wrap-up (step 3 of 3)
  await expect(title(page)).toHaveText("That's what's new");
  await expect(popover(page)).toContainText("3 of 3");
  await popover(page).locator(".gc-next").click();
  await expect(popover(page)).toHaveCount(0);

  await page.locator("#beta-toggle input").check();
  await openMenuAndStart(page, "whats-new");
  await expect(title(page)).toHaveText("Beta features");
  await popover(page).locator(".gc-next").click();
  await expect(title(page)).toHaveText("Beta insights");
  await expect(popover(page)).toContainText("2 of 3");
  expect(errors).toEqual([]);
});
