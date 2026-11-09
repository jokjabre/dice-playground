# Enclosure Gallery

First targeted demo for the dice engine. Showcases the World, Physics,
Rendering, and Enclosures boundaries by switching between a box tray, a
sphere orb, and a cylinder cup while keeping the same six dice in play.

## Run

```bash
npm install
npm run dev:gallery
```

Open http://localhost:5175/apps/demos/enclosure-gallery/

## Controls

- **Enclosure** — switch between Box, Sphere, and Cylinder. Switching
  clears the dice, rebuilds the boundaries, and rolls again.
- **Enclosure size** — scale the active enclosure relative to its default
  size (75%–200%). Resizing rebuilds the boundaries and rolls again.
- **Throw** — roll six fresh dice.
- **Drag** — flick the stage with a mouse or touch to throw; the throw
  arrow tracks the drag and dice spawn around the projected press point.
- **Gravity preset / Gravity (z)** — presets (down, tilt left/right,
  zero gravity) plus a z-axis slider. Gravity applies immediately.
- **Camera distance / Reset camera** — zoom the camera and restore the
  default distance.
- **Light X/Y/Z / Reset light** — move the spotlight in scene-relative
  units and restore the default position.
- **Clear dice / Reset scene** — remove the dice, or remove them and
  re-apply the gallery content.

Query parameters:

- `?enclosure=box|sphere|cylinder` — start in a specific enclosure.
- `?seed=<value>` — repeatable throw vectors.
- `?maxSubSteps=<n>&maxFrameGap=<seconds>` — raise the game loop sub-step
  budget and frame-gap clamp. Used by the Playwright specs to fast-forward
  the fixed-step loop under software rendering, where frames arrive far
  below real time. Defaults match the engine defaults.

## Implementation notes

The app composes only public package entries (`@dice/engine`, `@dice/input`,
`@dice/ui`, `@dice/content`, `@dice/core`). Enclosure definitions live in
`@dice/enclosures`; app-local copy lives in `src/content.js`. The result
banner and control panel come from `@dice/ui` and follow `roll:settle`.
If the engine cannot start (for example, WebGL is unavailable), a readable
failure message is shown instead of the stage.
