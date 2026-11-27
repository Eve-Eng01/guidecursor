// React Router (v6.4+ / v7): mount the provider in the root layout so it can use router hooks.
import { GuideCursorProvider, GuideMenu, type GuideTour } from "@guidecursor/react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const tours: GuideTour[] = [
  {
    id: "get-paid",
    title: "Get paid",
    steps: [
      { route: "/", target: "[data-tour=stats]", title: "Your sales" },
      { route: "/settings/payouts", target: "[data-tour=payout-form]", title: "Add a payout account" },
    ],
  },
];

export function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <GuideCursorProvider
      tours={tours}
      navigate={(to) => navigate(to)}
      currentRoute={location.pathname + location.search}
    >
      <header>
        <GuideMenu />
      </header>
      <Outlet />
    </GuideCursorProvider>
  );
}
