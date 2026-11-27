// Playwright: run a tour end to end like a person would, and fail on any missing target.
// The app logs guide events to window.__guideEvents in development (see docs/guides/testing-tours.md).
import { expect, type Page, test } from "@playwright/test";
import { tours } from "../src/tours"; // the same tours the app uses

type GuideEvent = { type: string; tour?: string; index?: number };
const events = (page: Page) =>
  page.evaluate(() => (window as unknown as { __guideEvents?: GuideEvent[] }).__guideEvents ?? []);

async function runTour(page: Page, tourId: string): Promise<string[]> {
  const tour = tours.find((t) => t.id === tourId);
  if (!tour) throw new Error(`no tour ${tourId}`);
  const done = async () => (await events(page)).some((e) => e.type === "complete" && e.tour === tourId);

  await page.getByRole("button", { name: /Guides/ }).click();
  await page.locator(`.gc-menu-item[data-tour-id="${tourId}"]`).click();

  const popover = page.locator(".gc-popover.gc-visible");
  const shown: string[] = [];
  let seen = 0;
  for (let guard = 0; guard <= tour.steps.length; guard++) {
    await expect
      .poll(
        async () =>
          (await done()) || (await events(page)).filter((e) => e.type === "step" && e.tour === tourId).length > seen,
        { timeout: 20_000 },
      )
      .toBe(true);
    if (await done()) break;
    const steps = (await events(page)).filter((e) => e.type === "step" && e.tour === tourId);
    seen = steps.length;
    const index = steps.at(-1)?.index ?? 0;
    const step = tour.steps[index];
    shown.push(step.id ?? String(index));

    await expect(popover).toContainText(`${index + 1} of ${tour.steps.length}`);
    if (step.title) await expect(popover.locator(".gc-title")).toHaveText(step.title);

    // Click the real element for click-to-advance steps, like a person would
    if (step.advanceOn === "click" && typeof step.target === "string") await page.locator(step.target).first().click();
    else await popover.locator(".gc-next").click();
  }

  const missing = (await events(page)).filter((e) => e.type === "error:target-missing");
  expect(missing, JSON.stringify(missing)).toHaveLength(0);
  return shown;
}

test("Get paid tour", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);
  await expect(page.locator(".gc-popover")).toBeHidden(); // nothing starts on its own
  expect(await runTour(page, "get-paid")).toEqual(["stats", "payout-form"]);
});
