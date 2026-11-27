# How a tour runs

Every guidecursor feature hangs off one lifecycle. Once you know the order in which a step runs, choosing between `route`, `beforeShow`, `when`, `target` and `advanceOn` becomes easy.

## Tours, steps and statuses

A **tour** is an ordered list of **steps** with an `id` and a `title` (shown in the Guides menu). For each person, every tour has a **status** that is saved between visits:

| Status | Meaning |
|---|---|
| `new` | Never started |
| `in-progress` | Started and not finished. Also used when a tour was cut off by a reload, so it can resume. |
| `skipped` | Closed with Esc, ×, or `skip()`. The step they reached is remembered. |
| `completed` | Finished the last step |
| `dismissed` | "Don't show again". This also stops every auto-starting tour. |

## The life of a step

When a tour moves to a step, guidecursor runs these stages in order:

```
1. route        If the step has a route and we're not on it: save progress, then await navigate(route)
2. beforeShow   Your hook: open a menu, switch a tab, click through to a record, load data
3. when         Your check: if it returns false, pass over this step (no error)
4. target       Wait for the target to exist and be visible (MutationObserver, up to targetTimeout)
5. render       Scroll it into view, glide the cursor there, show the ring and the popover
6. listen       Start waiting for advanceOn, call onShow, emit the "step" event
```

The phases you'll see in `getState().phase` follow the same order: `idle → navigating → waiting → moving → showing`.

Two consequences are worth remembering:

- **`when` sees the page after navigation and `beforeShow`.** So a condition like "is there a booking on screen?" works, as long as the page has finished loading. Wait for the list to settle inside `when` (see [Interactive and conditional steps](guides/interactive-steps.md#wait-for-data-before-you-decide)).
- **Progress is saved before navigating.** If your navigation does a full page load, the tour resumes on the new page at the same step.

## Passed over vs. missing

There are two ways a step can end up not showing, and they mean different things:

| | `when` returns `false` | The target never appears |
|---|---|---|
| Means | The step doesn't apply to this person right now | The tour and the UI have drifted apart, or the page is slow |
| Reported | No | Yes: an `error` event with `type: "target-missing"` |
| What happens | Moves on in the direction the user is going | Depends on `onMissingTarget`: `skip` (default), `end`, or `center` |

Use `when` for steps that legitimately apply only sometimes. Keep `target-missing` for bugs, and watch for it in your tests and analytics. If you'd rather never drop a step silently, set `onMissingTarget: "center"`: the step then shows in the middle of the page with its explanation.

## Moving on

A step moves on when the person:

- presses **Next** (or →, or Enter while the popover has focus), or **Back** (←)
- does what `advanceOn` waits for, like clicking the target
- or when your code calls `next()`, `back()` or `goTo(id)`

**Esc** or **×** skips the tour, and "Don't show again" dismisses it. Each of these fires an event you can track (see [Analytics](guides/analytics.md)).

## Starting, resuming and restarting

- `start(id)` starts at the first step. `start(id, { step: "payment-plan" })` starts at a step id or index. That's how contextual help buttons work (see [Contextual help buttons](guides/contextual-help.md)).
- `start(id, { resume: true })` continues from the saved step of a tour that's `in-progress` or `skipped`.
- On page load, a tour that was `in-progress` when the page unloaded resumes automatically, unless you set `resumeOnLoad: false`.
- `<GuideMenu />` resumes half-finished tours by default. Pass `resume="in-progress"` to resume only tours cut off by a reload, so a tour someone closed starts again from the top.

## Nothing pops up uninvited

Tours start from a user action, a menu pick, a help button or your own code. A tour only starts by itself when it sets `autoStart` and the person has never seen it. "Don't show again" turns every auto-start off for that person.
