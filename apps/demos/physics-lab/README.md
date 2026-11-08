# Physics Lab

Second demo for the dice engine. Makes the physics adapter observable and
tunable: gravity, contact materials, damping, die mass, and solver
settings can be changed live while dice roll in the same stage.

## Run

```bash
npm install
npm run dev:physics-lab
```

Open http://localhost:5177/apps/demos/physics-lab/

## Controls

- **Throw / Clear dice** — roll six fresh dice or empty the tray.
- **Enclosure** — switch between Box, Sphere, and Cylinder; switching
  rebuilds the boundaries and rolls again.
- **Gravity X/Y/Z** — set the gravity vector immediately (default
  `0, 0, -2940`).
- **Surface pair** — pick a material pair (die vs desk, die vs die, die vs
  box walls, die vs sphere boundary, die vs glass boundary).
- **Friction / Restitution** — sliders for the selected pair. Values are
  applied to the running physics world and read back into the stats panel.
- **Linear / Angular damping, Die mass** — applied to live dice
  immediately and to every newly spawned die, so a roll uses the current
  settings from spawn.
- **Solver iterations, Fixed timestep, Settle threshold/frames** — solver
  iterations and the loop timestep go through the engine; settle
  threshold/frames go through the world's settle config.
- **Reset to defaults** — restores every control, every default contact
  pair, gravity, mass/damping, solver, timestep, and settle settings,
  then rolls.

The stats panel shows live body count, dice count, gravity, the selected
surface's friction/restitution, mass, damping, solver iterations, fixed
timestep, settle settings, registered materials, a simple running/idle
performance readout with the last roll duration, and the last result.

Query parameters:

- `?seed=<value>` — repeatable throw vectors.
- `?maxSubSteps=<n>&maxFrameGap=<seconds>` — raise the game loop sub-step
  budget and frame-gap clamp. Used by the Playwright specs to fast-forward
  the fixed-step loop under software rendering, where frames arrive far
  below real time. Defaults match the engine defaults.

## Implementation notes

The app composes only public package entries (`@dice/engine`,
`@dice/input`, `@dice/ui`, `@dice/content`, `@dice/core`,
`@dice/physics`). Defaults (gravity, mass, solver iterations, contact
pairs) come from `@dice/physics` public exports. Live contact/solver/body
stats are reached through the world's public `physicsWorld` handle.
No `cannon-es` import appears in the app. If the engine cannot start (for
example, WebGL is unavailable), a readable failure message is shown instead
of the stage.
