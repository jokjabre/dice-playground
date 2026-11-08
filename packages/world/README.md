# `@dice/world`

One live simulation instance: it composes the physics world, an optional
render scene, dice, an enclosure, the table visual, and lighting into a
single runtime. The world has no scheduler; the engine's game loop calls
`step(dt)`. It never reads the DOM — the engine supplies `ViewportMetrics`
on `init(viewport)` and `resize(viewport)`.

The package may depend on `@dice/core`, `@dice/physics`, `@dice/rendering`,
`@dice/dice`, and `@dice/enclosures`. It is the only package that constructs
both physics and rendering backends, and the only composition layer that
wires dice, enclosures, the table, and lighting together.

Headless mode (`headless: true` or no container) skips the renderer
entirely, so a Node-only test can spawn dice, step to settle, and read
values:

```js
import { World } from '@dice/world';

const world = new World({ headless: true });
await world.init(metrics);
world.spawnDice({ dice: 6, seed: 'fixed' });
while (!world.areDiceSettled()) world.step(1 / 60);
const values = world.getValues();
```

Custom backends are injected as factories:

```js
const world = new World({
  container,
  physicsFactory: () => new PhysicsWorld({ /* ... */ }),
  rendererFactory: async ({ container, config }) => createRenderScene({ container, config })
});
```

## Public entry

```js
import {
  World,
  DiceFactory,
  DiceSet,
  TableVisual,
  RollState,
  Viewport,
  PredictionSession,
  createWorldConfig,
  createDefaultPhysicsFactory,
  createDefaultRendererFactory
} from '@dice/world';
```

## What the world owns

- **Backend factories** — `createCannonEsBackend()` and the async
  `createThreeLegacyBackend()` are the defaults (`backends.js`); either can be
  replaced with a fake for tests/headless.
- **Dice** — `DiceFactory` creates a physics `BodyHandle`, an optional
  `VisualHandle`, and a `DiceEntity` per die. Ids are stable
  (`die-<worldSeq>-<counter>`) and never reused; kept dice retain values,
  mappings, and ids across partial rerolls (`roll({ keep })`).
- **Throw planning** — `createThrowPlan({ dice, definition, seed })` returns
  `{ vectors, seed, dice, spawnProfile }`. Plans are repeatable for a fixed
  seed (generation forks the world's rng, so the parent is never advanced)
  and record the resolved seed. `SpawnProfile` holds the enclosure mode,
  radius, and inertia used to generate spawn positions.
- **Enclosures** — `registerEnclosure(id, factory)` for custom enclosures;
  `setEnclosure(id)` clears dice, rebuilds physics/visual boundaries, and
  emits `enclosure:change`.
- **Settle tracking** — `RollState` mirrors the legacy velocity-threshold
  check (`velocityThreshold`, `settleFrames`); `areDiceSettled()` is
  side-effect free, updates happen in `step(dt)` which also emits
  `roll:progress` during an active roll.
- **Prediction** — `createPredictionSession({ vectors, diceStates, enclosure })`
  builds an equivalent headless session with its own physics world and dice;
  the live world is never stepped or mutated.
- **Interaction surface** — `getDice`/`getDiceIds`/`getSelection`,
  `setSelection`/`toggleSelection`, `pick(ndc)`, `setGravity`, `applyImpulse`,
  `jostle(intensity)`, `setDiceConfig`, `setSettleConfig`, `setCamera`/
  `resetCamera`, `reset`, `dispose` (idempotent).

Content packs arrive as plain data (`content: { enclosure, table, camera,
dice, physics }`); the world never imports `@dice/content`.

## Tests

```bash
npm test --workspace @dice/world
```
