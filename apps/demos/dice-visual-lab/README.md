# Dice Visual Lab

Fourth demo for the dice engine. Showcases pure dice data plus rendering:
geometry, colors, materials, and face mappings are all driven from the
same data the world uses, so the preview cannot diverge from the live
dice.

## Run

```bash
npm install
npm run dev:dice-visual-lab
```

Open http://localhost:5179/apps/demos/dice-visual-lab/

## Controls

- **Roll** — roll three dice with the active face mapping applied.
- **Drag** — flick the stage with a mouse or touch to throw; the throw
  arrow tracks the drag and dice spawn around the projected press point.
- **Chamfer factor** — rebuilds die geometry from pure mesh data
  (`createDiceMeshData`) and rerolls. Range 0.5–1, default 0.96.
- **Die radius scale** — scales the live die radius through viewport
  metrics and rerolls.
- **Body color / Label color** — `#rrggbb` inputs. Press
  **Apply colors and roll** to rebuild materials/textures for the next
  spawn.
- **Material shininess / specular** — shininess slider plus a specular
  hex color (`#rrggbb`), applied with the colors on the next roll.
- **Face mapping preview** — identity or label-shift presets. Live dice
  are remapped immediately; rolls also spawn with the mapping.
- **Reset visuals / Clear dice** — restore defaults and reroll, or empty
  the tray.

The preview panel shows live pure-data stats: chamfer, die radius, mesh
vertex/face counts (including chamfer faces), collision vertex count,
colors, material values, and the active face mapping.

This lab is the future home for polyhedral dice: a new die definition
would register in the same registry and appear here without engine
changes. Wireframe rendering has no public rendering API yet, so no
wireframe toggle is faked here.

Query parameters:

- `?seed=<value>` — repeatable throw vectors.
- `?maxSubSteps=<n>&maxFrameGap=<seconds>` — raise the game loop sub-step
  budget and frame-gap clamp. Used by the Playwright specs to fast-forward
  the fixed-step loop under software rendering, where frames arrive far
  below real time. Defaults match the engine defaults.

## Implementation notes

The app composes only public package entries (`@dice/engine`,
`@dice/dice`, `@dice/enclosures`, `@dice/input`, `@dice/ui`,
`@dice/content`, `@dice/core`). It registers a mutable D6 clone through
the engine's `diceRegistry` option so chamfer changes flow through the
world's geometry pipeline. If the engine cannot start (for example, WebGL
is unavailable), a readable failure message is shown instead of the stage.
