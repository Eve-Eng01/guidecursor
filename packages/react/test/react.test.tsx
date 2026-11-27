import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuideCursorProvider, GuideMenu, type GuideTour, memoryStorage, useGuideCursor } from "../src";

const tours: GuideTour[] = [
  {
    id: "basics",
    title: "Basics",
    description: "The essentials",
    steps: [
      { target: "#one", title: "One" },
      { target: "#two", title: "Two" },
    ],
  },
  { id: "advanced", title: "Advanced", steps: [{ target: "#two", title: "Adv" }] },
  { id: "secret", title: "Secret", hidden: true, steps: [{ title: "S" }] },
];

function Status() {
  const g = useGuideCursor();
  return (
    <div>
      <span data-testid="state">{g.isActive ? `${g.currentTour?.id}:${g.stepIndex}:${g.phase}` : "idle"}</span>
      <button type="button" onClick={() => g.start("basics")}>
        start
      </button>
      <button type="button" onClick={() => g.next()}>
        next
      </button>
      <ul>
        {g.tours.map((t) => (
          <li key={t.id} data-testid={`status-${t.id}`}>
            {t.status}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Page() {
  return (
    <>
      <button id="one" type="button">
        one
      </button>
      <button id="two" type="button">
        two
      </button>
      <GuideMenu />
      <Status />
    </>
  );
}

function setup(props: Partial<React.ComponentProps<typeof GuideCursorProvider>> = {}) {
  return render(
    <StrictMode>
      <GuideCursorProvider tours={tours} storage={memoryStorage()} motion="reduce" {...props}>
        <Page />
      </GuideCursorProvider>
    </StrictMode>,
  );
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("GuideCursorProvider + useGuideCursor", () => {
  it("throws a helpful error outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Status />)).toThrow(/GuideCursorProvider/);
    spy.mockRestore();
  });

  it("exposes reactive state and controls", async () => {
    const onStep = vi.fn();
    setup({ onStep });
    expect(screen.getByTestId("state").textContent).toBe("idle");
    fireEvent.click(screen.getByText("start"));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("basics:0:showing"));
    expect(screen.getByTestId("status-basics").textContent).toBe("in-progress");
    fireEvent.click(screen.getByText("next"));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("basics:1:showing"));
    fireEvent.click(screen.getByText("next"));
    await waitFor(() => expect(screen.getByTestId("status-basics").textContent).toBe("completed"));
    expect(onStep).toHaveBeenCalledTimes(2);
  });

  it("uses the latest navigate callback", async () => {
    const routed: GuideTour[] = [{ id: "r", title: "R", steps: [{ target: "#one", route: "/elsewhere" }] }];
    const first = vi.fn();
    const second = vi.fn();
    const ui = (navigate: (to: string) => void) => (
      <GuideCursorProvider
        tours={routed}
        storage={memoryStorage()}
        motion="reduce"
        navigate={navigate}
        currentRoute="/"
      >
        <Page />
      </GuideCursorProvider>
    );
    const { rerender } = render(ui(first));
    rerender(ui(second));
    await act(async () => {
      document.querySelector<HTMLButtonElement>(".gc-menu-trigger")?.click();
    });
    await act(async () => {
      screen.getByRole("menuitem", { name: /R/ }).click();
    });
    await waitFor(() => expect(second).toHaveBeenCalledWith("/elsewhere"));
    expect(first).not.toHaveBeenCalled();
  });

  it("re-checks autoStart when currentRoute changes", async () => {
    const auto: GuideTour[] = [
      {
        id: "auto",
        title: "Auto",
        autoStart: ({ route }) => route === "/dash",
        autoStartDelay: 0,
        steps: [{ target: "#one", title: "Auto step" }],
      },
    ];
    const ui = (route: string) => (
      <GuideCursorProvider tours={auto} storage={memoryStorage()} motion="reduce" currentRoute={route}>
        <Page />
      </GuideCursorProvider>
    );
    const { rerender } = render(ui("/"));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByTestId("state").textContent).toBe("idle");
    rerender(ui("/dash"));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("auto:0:showing"));
  });

  it("renders to a string (SSR)", () => {
    const html = renderToString(
      <GuideCursorProvider tours={tours} storage={memoryStorage()}>
        <Status />
        <GuideMenu />
      </GuideCursorProvider>,
    );
    expect(html).toContain("idle");
    expect(html).toContain("Guides");
  });
});

describe("GuideMenu", () => {
  it("is closed by default and never starts a tour on its own", async () => {
    setup();
    expect(screen.queryByRole("menu")).toBeNull();
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector(".gc-popover.gc-visible")).toBeNull();
  });

  it("lists visible tours with status and starts one on click", async () => {
    setup();
    const trigger = screen.getByRole("button", { name: /Guides/ });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.dataset.tourId)).toEqual(["basics", "advanced"]);
    expect(items[0]?.textContent).toContain("New");
    expect(items[0]?.textContent).toContain("The essentials");
    fireEvent.click(items[0]!);
    expect(screen.queryByRole("menu")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("basics:0:showing"));
  });

  it("supports keyboard navigation and Esc without skipping a running tour", async () => {
    setup();
    fireEvent.click(screen.getByText("start"));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("basics:0:showing"));
    const trigger = screen.getByRole("button", { name: /Guides/ });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const items = await screen.findAllByRole("menuitem");
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
    fireEvent.keyDown(items[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0]!, { key: "End" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1]!, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(screen.getByTestId("state").textContent).toBe("basics:0:showing");
  });

  it("closes on outside click and shows progress for a half-finished tour", async () => {
    setup();
    fireEvent.click(screen.getByText("start"));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("basics:0:showing"));
    fireEvent.click(screen.getByText("next"));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("basics:1:showing"));
    fireEvent.click(screen.getByRole("button", { name: /Guides/ }));
    expect(screen.getAllByRole("menuitem")[0]?.textContent).toContain("2/2");
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("resume controls where a skipped tour picks up", async () => {
    const skipped = () =>
      memoryStorage({
        v: 1,
        tours: { basics: { status: "skipped", step: 1, updatedAt: 1 } },
        active: null,
        muted: false,
      });
    const pick = async (resume?: React.ComponentProps<typeof GuideMenu>["resume"]) => {
      const view = render(
        <GuideCursorProvider tours={tours} storage={skipped()} motion="reduce">
          <Page />
          <GuideMenu label="Help" resume={resume} />
        </GuideCursorProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: /Help/ }));
      // Saved progress loads asynchronously; the chip shows it once it has
      await waitFor(() => expect(screen.getAllByRole("menuitem")[0]?.textContent).toContain("2/2"));
      fireEvent.click(screen.getAllByRole("menuitem")[0]!);
      await waitFor(() => expect(screen.getByTestId("state").textContent).toMatch(/:showing$/));
      const state = screen.getByTestId("state").textContent;
      view.unmount();
      document.body.innerHTML = "";
      return state;
    };
    expect(await pick()).toBe("basics:1:showing");
    expect(await pick("in-progress")).toBe("basics:0:showing");
    expect(await pick(false)).toBe("basics:0:showing");
    expect(await pick(() => true)).toBe("basics:1:showing");
  });

  it("can be limited to specific tours", () => {
    render(
      <GuideCursorProvider tours={tours} storage={memoryStorage()}>
        <GuideMenu tours={["advanced"]} label="Help" />
      </GuideCursorProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Help/ }));
    expect(screen.getAllByRole("menuitem").map((i) => i.dataset.tourId)).toEqual(["advanced"]);
  });
});
