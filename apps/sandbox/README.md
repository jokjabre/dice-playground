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

The options panel collapses through a hamburger toggle (it starts
collapsed on small screens) and groups its options into an accordion of
collapsible sections: opening one closes the others. Every group also has
its own reset; the global reset stays in the always-visible action row.

- **Actions (always visible)** — ↺ Reset scene (clears the dice and
  restores camera distance and light; keeps the mode and enclosure),
  🎲 Throw, 🧹 Clear.
- **Enclosure** — Type (Box / Sphere / Cylinder), Size (75%–200%),
  Reset enclosure (Box at 100%, rolls again).
- **Engine** — Mode; "Flick interrupts current roll" (a flick cancels the
  running roll and starts a new one instead of waiting for it to settle);
  Max roll duration in seconds (the roll settles by force after it);
  motion controls (Enable Motion, continuous mode only); predetermined
  targets (Target input + Roll Target, predetermined mode only — the
  number of values is the dice count); Reset engine options (Standard
  mode, flick waits, default duration, motion off, default targets).
- **Camera** — Distance slider, Reset camera.
- **Light** — Position X/Y/Z sliders, Reset light.
- **Details** — mode, enclosure, dice count, physics state, camera
  distance, light position, and last result.

Not exposed (the engine has no API for them): a camera view angle/yaw,
enclosure "view angle", and light "angle". Light controls adjust the
spotlight position; camera zoom is the distance multiplier.

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
- **Near/far fields removed** (owner decision): the legacy near/far inputs
  only set clipping planes; at sensible values they have no visible effect,
  so the sandbox exposes just the distance.
- **No global scripts or singletons.** Three and Cannon are loaded through
  the engine backends only, and the legacy `/dice/` URL is not preserved.

## Implementation notes

The app composes only public package entries (`@dice/engine`,
`@dice/input`, `@dice/determinism`, `@dice/ui`, `@dice/content`,
`@dice/core`). Enclosure definitions live in `@dice/enclosures`; app-local
copy and the classic tray content live in `src/content.js`, and mode
vocabulary plus target parsing live in `src/modes.js`. The result banner,
control panels, accordion groups, and motion status come from `@dice/ui`.
The Engine group uses two engine/input capabilities: flick interruption
(`PointerInput.interruptRolls` → `cancelActive`) and the standard-roll
force-settle cap (`engine.setLoopConfig({ maxFrames })`, configured from
the duration field in seconds). If the engine cannot start (for example,
WebGL is unavailable), a readable failure message is shown instead of the
stage.
