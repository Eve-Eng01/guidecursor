import { GuideCursorProvider, GuideMenu, useGuideCursor } from "@guidecursor/react";
import { useEffect, useState } from "react";
import { navigate, usePathname } from "./router";
import { tours } from "./tours";

declare global {
  interface Window {
    __guideEvents?: string[];
  }
}

function log(entry: string) {
  window.__guideEvents ??= [];
  window.__guideEvents.push(entry);
}

function Link({ to, children }: { to: string; children: React.ReactNode }) {
  const path = usePathname();
  return (
    <a
      href={import.meta.env.BASE_URL.replace(/\/$/, "") + to}
      aria-current={path === to ? "page" : undefined}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

function Header() {
  const { isActive, currentTour, stepIndex, stepCount, reset } = useGuideCursor();
  return (
    <header className="topbar">
      <strong className="brand">Eventful</strong>
      <nav>
        <Link to="/">Dashboard</Link>
        <Link to="/events">Events</Link>
        <Link to="/settings">Settings</Link>
      </nav>
      <span className="status" data-testid="tour-status">
        {isActive ? `${currentTour?.title}: ${stepIndex + 1}/${stepCount}` : "No tour running"}
      </span>
      <button type="button" className="ghost" onClick={() => reset()}>
        Reset progress
      </button>
      <GuideMenu />
    </header>
  );
}

function Home() {
  const [count, setCount] = useState(0);
  const [beta, setBeta] = useState(false);
  return (
    <main>
      <div className="row">
        <h1>Dashboard</h1>
        <input id="search" type="search" placeholder="Search…" aria-label="Search" />
        <button type="button" className="primary" data-tour="new-event" onClick={() => navigate("/events")}>
          + New event
        </button>
      </div>
      <section id="stats" className="cards">
        <article>
          <span>Tickets sold</span>
          <b>1,284</b>
        </article>
        <article>
          <span>Attendees</span>
          <b>963</b>
        </article>
        <article>
          <span>Next payout</span>
          <b>$4,120</b>
        </article>
      </section>
      <section className="panel row">
        <label id="beta-toggle" className="toggle">
          <input type="checkbox" checked={beta} onChange={(e) => setBeta(e.target.checked)} /> Beta features
        </label>
        {beta ? (
          <p id="beta-insights" className="beta">
            Beta insights: 38% of tickets sold in the last 7 days.
          </p>
        ) : null}
      </section>
      <section className="panel">
        <h2>Page stays usable</h2>
        <p>Click this while a tour is running — nothing blocks it.</p>
        <button id="counter" type="button" onClick={() => setCount((c) => c + 1)}>
          Clicked {count} times
        </button>
      </section>
      <div className="spacer" />
      <p className="footnote" id="footnote">
        Bottom of the page.
      </p>
    </main>
  );
}

function Events() {
  return (
    <main>
      <div className="row">
        <h1>Events</h1>
        <button id="create-event" type="button" className="primary">
          Create event
        </button>
      </div>
      <ul className="list">
        <li>Summer Rooftop Party · Jul 12</li>
        <li>Founders Breakfast · Aug 3</li>
        <li>Art Night · Sep 21</li>
      </ul>
    </main>
  );
}

function Settings() {
  // Rendered late on purpose to exercise wait-for-element.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 700);
    return () => clearTimeout(t);
  }, []);
  return (
    <main>
      <h1>Settings</h1>
      {loaded ? (
        <form id="payout-form" className="panel" onSubmit={(e) => e.preventDefault()}>
          <h2>Payout account</h2>
          <label>
            Bank name <input name="bank" />
          </label>
          <label>
            Account number <input name="account" />
          </label>
          <button type="submit" className="primary">
            Save
          </button>
        </form>
      ) : (
        <p className="loading">Loading payout settings…</p>
      )}
    </main>
  );
}

function Page() {
  const path = usePathname();
  if (path === "/events") return <Events />;
  if (path === "/settings") return <Settings />;
  return <Home />;
}

export function App() {
  const path = usePathname();
  const reducedFromUrl = new URLSearchParams(window.location.search).get("motion");
  return (
    <GuideCursorProvider
      tours={tours}
      navigate={navigate}
      currentRoute={path}
      cursor={{ label: "Guide" }}
      motion={reducedFromUrl === "reduce" ? "reduce" : "auto"}
      onStart={(e) => log(`start:${e.tour.id}`)}
      onStep={(e) => log(`step:${e.tour.id}:${e.index}`)}
      onSkip={(e) => log(`skip:${e.tour.id}:${e.index}`)}
      onComplete={(e) => log(`complete:${e.tour.id}`)}
    >
      <Header />
      <Page />
    </GuideCursorProvider>
  );
}
