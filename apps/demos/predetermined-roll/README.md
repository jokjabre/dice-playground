# Predetermined Roll

Third demo for the dice engine. Demonstrates the optional
`@dice/determinism` package: a headless prediction runs first, then face
mappings are shifted so the visible roll lands on requested values.

## Run

```bash
npm install
npm run dev:predetermined-roll
```

Open http://localhost:5178/apps/demos/predetermined-roll/

## Controls

- **Determinism mode** — `Predict and shift` (predict, then shift face
  mappings so the visible roll shows the targets) or `Predict only`
  (predict and display natural values, shift nothing). Changing the mode
  swaps the attached determinism plugin.
- **Dice count** — 1–6 dice. Changing it rebuilds the per-die target
  inputs with the legacy `6, 6, 6` defaults.
- **Per-die targets** — one input per die, values 1–6.
- **Predict (no live roll)** — runs an isolated headless simulation for the
  current seed and shows the natural values. The live dice are not moved.
- **Roll** — in predict-and-shift mode, rolls with the requested values
  and reports whether every die matched. In predict-only mode, rolls
  unforced dice and compares the result against the targets.
- **Clear dice** — empties the tray.

Edge cases: invalid targets (non-integer, outside 1–6, or a count that
does not match the dice count) show an inline error and start no roll.
The explanation panel states what is predicted, what is shifted, and what
is not promised (no cross-device reproducibility guarantee).

Query parameters:

- `?seed=<value>` — repeatable throw vectors.
- `?maxSubSteps=<n>&maxFrameGap=<seconds>` — raise the game loop sub-step
  budget and frame-gap clamp. Used by the Playwright specs to fast-forward
  the fixed-step loop under software rendering, where frames arrive far
  below real time. Defaults match the engine defaults.

## Implementation notes

The app composes only public package entries (`@dice/engine`,
`@dice/determinism`, `@dice/input`, `@dice/ui`, `@dice/content`,
`@dice/core`). The engine rejects requested `values` when no plugin
supplies face mappings; this demo always attaches the determinism plugin.
Prediction uses `engine.simulate()` (isolated headless world) for display
and the plugin's isolated prediction session for the visible roll. If the
engine cannot start (for example, WebGL is unavailable), a readable
failure message is shown instead of the stage.
