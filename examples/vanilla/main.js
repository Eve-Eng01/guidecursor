import { createGuide } from "@guidecursor/core";

const t = (name) => `[data-tour="${name}"]`;

const guide = createGuide({
  cursor: { label: "Guide" },
  tours: [
    {
      id: "basics",
      title: "The basics",
      steps: [
        { id: "search", target: t("search"), title: "Find anything", content: "Search events, people and payouts." },
        { id: "stats", target: t("stats"), title: "Your numbers", content: "Sales update as tickets sell." },
        {
          id: "pro",
          // Only shown on the Pro plan; otherwise passed over without an error
          when: () => !document.querySelector("#pro-insights").hidden,
          target: t("pro-insights"),
          title: "Pro insights",
          content: "Pro plans get weekly patterns like this one.",
        },
        {
          id: "create",
          target: t("create"),
          title: "Create an event",
          content: "Click the button to try it. The tour moves on when you do.",
          advanceOn: "click",
          focus: false,
        },
        { id: "done", title: "You're all set", content: "Press Show me around any time to see this again." },
      ],
    },
  ],
  onStep: ({ tour, step, index, total }) => console.log(`[guide] ${tour.id} ${index + 1}/${total}`, step.id),
  onComplete: ({ tour }) => console.log(`[guide] completed ${tour.id}`),
  onError: (e) => console.warn("[guide]", e.type, e.step?.id ?? e.index),
});

document.querySelector("#help").addEventListener("click", () => guide.start("basics"));
document.querySelector("#pro").addEventListener("change", (e) => {
  document.querySelector("#pro-insights").hidden = !e.target.checked;
});
document.querySelector(t("create")).addEventListener("click", () => {
  document.querySelector("#created").textContent = "Created!";
});
