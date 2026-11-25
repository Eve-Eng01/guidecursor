// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GuideCursorProvider, GuideMenu, useGuideCursor } from "../src";

function State() {
  const { phase, tours } = useGuideCursor();
  return (
    <p>
      {phase}:{tours.length}
    </p>
  );
}

describe("SSR (no window)", () => {
  it("renders provider, hook and menu with the default localStorage adapter", () => {
    expect(typeof window).toBe("undefined");
    const html = renderToString(
      <GuideCursorProvider tours={[{ id: "t", title: "T", steps: [{ target: "#x" }] }]}>
        <State />
        <GuideMenu />
      </GuideCursorProvider>,
    );
    expect(html).toContain("idle<!-- -->:<!-- -->1");
    expect(html).toContain('aria-haspopup="menu"');
  });
});
