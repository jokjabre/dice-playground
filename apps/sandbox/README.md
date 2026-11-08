# Sandbox

Full multi-mode dice playground and the parity target for the legacy demo
at `/legacy/dice/`. Standard, continuous, and predetermined rolls on the
same six D6 dice, with enclosure switching, camera controls, and a
collapsible engine options panel.

## Run

```bash
npm install
npm run dev:sandbox
```

Open http://localhost:5174/apps/sandbox/

## Modes

- **Standard Roll (Flick & Settle)** — flick/drag the stage or press Throw.
  Dice settle and the result banner reports individual values and total.
- **Continuous Live (Tilt & Shake)** — physics never auto-stops. Motion
  sensors map tilt to gravity and shake to impulses. Entering the mode
  starts a live continuous run and enables motion automatically.
- **Predetermined Roll (Target Values)** — enter comma-separated targets
  (e.g. `6, 6, 6`) and press Roll Target. The determinism plugin predicts
  the natural roll headlessly and maps faces so the visible roll lands on
  the targets. Invalid entries show an inline error and start no roll.

## Controls

- **Engine Mode** — switch between standard, continuous, and predetermined.
- **Enable Motion** — request/disable motion sensors (continuous mode
  only). Status is shown next to the button.
- **Enclosure** — switch between Box, Sphere, and Cylinder. Switching
  clears the dice, rebuilds the boundaries, and rolls again.
- **Camera / Near / Far / Reset** — distance slider plus near/far clipping
  fields. Empty near/far fall back to the defaults (near `1`, far `0` for
  auto); Reset restores all three.
- **Throw** — roll a normal set of dice. While a settling roll is running
  the button is disabled; in continuous mode it replaces the live run.
- **Clear** — remove the dice and the result banner.
- **Engine options panel** — the "+" toggle collapses/expands the panel;
  Escape inside the panel collapses it and returns focus to the toggle.
  The panel starts collapsed on small screens.

Query parameters:

- `?mode=standard|continuous|predetermined` — start in a specific mode.
- `?enclosure=box|sphere|cylinder` — start in a specific enclosure.
- `?seed=<value>` — repeatable throw vectors.
- `?maxSubSteps=<n>&maxFrameGap=<seconds>` — raise the game loop sub-step
  budget and frame-gap clamp. Used by the Playwright specs to fast-forward
  the fixed-step loop under software rendering, where frames arrive far
  below real time. Defaults match the engine defaults.

## Parity with the legacy demo

The sandbox covers the legacy checklist: six D6 dice by default, mouse and
touch flick throws, settle reporting with values and total, continuous
mode, motion enable/disable with status and permission handling,
predetermined target values, box/sphere/cylinder enclosures, camera
distance/near/far/reset, clear, an initial roll on load, and responsive
resize.

Intentional differences from the legacy demo:

- **Layout and accessibility.** The toolbar is a collapsible panel with
  labels, focus handling, and `aria-live` regions, rather than a fixed
  hidden toolbar. New UI composition is expected.
- **Real cylinder physics.** The cylinder enclosure has real polygonal wall
  collision instead of the legacy placeholder.
- **Fresh spawn per roll.** Each roll spawns new dice. The legacy
  continuous mode reused live dice and blocked clear while continuous; the
  sandbox cancels the live continuous run on clear or mode change instead.
- **Throw vs. Roll Target.** The standalone Throw button always rolls a
  normal set without targets. Only Roll Target uses predetermined values,
  and it rolls as many dice as there are targets (as the legacy did).
- **Invalid targets.** Non-integer or out-of-range entries show an error
  and start no roll, instead of being silently filtered.
- **Camera readout.** Camera state is shown in the info panel in the same
  `distance×` format as the legacy readout.
- **No global scripts or singletons.** Three and Cannon are loaded through
  the engine backends only, and the legacy `/dice/` URL is not preserved.

## Implementation notes

The app composes only public package entries (`@dice/engine`,
`@dice/input`, `@dice/determinism`, `@dice/ui`, `@dice/content`,
`@dice/core`). Enclosure definitions live in `@dice/enclosures`; app-local
copy and the classic tray content live in `src/content.js`, and mode
vocabulary plus target parsing live in `src/modes.js`. The result banner,
control panel, collapsible panel, and motion status come from `@dice/ui`.
If the engine cannot start (for example, WebGL is unavailable), a readable
failure message is shown instead of the stage.
