import type { GuideTour } from "@guidecursor/react";

export const tours: GuideTour[] = [
  {
    id: "app-tour",
    title: "Take the full tour",
    description: "Dashboard, events and payouts across three pages.",
    steps: [
      {
        id: "stats",
        route: "/",
        target: "#stats",
        title: "Your dashboard",
        content: "Sales, attendees and payouts at a glance. The page stays fully usable while I show you around.",
      },
      {
        id: "new-event",
        route: "/",
        target: "[data-tour='new-event']",
        title: "Start something new",
        content: "Create an event from anywhere on the dashboard.",
        placement: "left",
      },
      {
        id: "create-event",
        route: "/events",
        target: "#create-event",
        title: "Events live here",
        content: "I moved us to the Events page. Every event you create shows up in this list.",
      },
      {
        id: "payouts",
        route: "/settings",
        target: "#payout-form",
        title: "Get paid",
        content:
          "Add a payout account so ticket sales land in your bank. (This form loads late on purpose — the guide waits for it.)",
        placement: "right",
      },
      {
        id: "done",
        title: "You're all set",
        content: "Open the Guides menu any time to replay a tour.",
      },
    ],
  },
  {
    id: "quick-tips",
    title: "Quick tips",
    description: "A few dashboard tips. Learn by clicking.",
    steps: [
      {
        id: "search",
        route: "/",
        target: "#search",
        title: "Find anything",
        content: "Search events, vendors and payouts.",
      },
      {
        id: "counter",
        route: "/",
        target: "#counter",
        title: "Try it yourself",
        content: "Click the button — the tour advances when you do.",
        advanceOn: "click",
        focus: false,
      },
      {
        id: "footnote",
        target: "#footnote",
        title: "Even off-screen targets",
        content: "The guide scrolls targets into view before pointing at them.",
        placement: "top",
      },
      {
        id: "thanks",
        title: "Nice!",
        content: "Tours can wait for real actions with `advanceOn`.",
      },
    ],
  },
  {
    id: "whats-new",
    title: "What's new",
    description: "A step that only shows when beta features are on.",
    steps: [
      {
        id: "beta-toggle",
        route: "/",
        target: "#beta-toggle",
        title: "Beta features",
        content: "Turn this on to see beta insights. The next step only appears when it's on.",
      },
      {
        id: "beta-insights",
        route: "/",
        // `when` passes over a step that doesn't apply, without counting it as a missing target.
        when: () => document.querySelector("#beta-insights") !== null,
        target: "#beta-insights",
        title: "Beta insights",
        content: "This step uses `when`, so it only shows while beta features are on.",
      },
      {
        id: "wrap-up",
        title: "That's what's new",
        content: "Steps can check the page before they show, so every tour fits the person taking it.",
      },
    ],
  },
  {
    id: "welcome",
    title: "Welcome",
    description: "Auto-starts only when the URL has ?welcome.",
    autoStart: () => new URLSearchParams(window.location.search).has("welcome"),
    autoStartDelay: 300,
    steps: [
      {
        target: "[data-guidecursor-menu]",
        title: "Need a hand?",
        content: "Guides live here. Nothing pops up unless you ask (or the app opts in, like this one).",
      },
    ],
  },
];
