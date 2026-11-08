# `@dice/engine`

Public facade and lifecycle owner. The engine owns the event bus, the game
loop, one world, and the plugin registry. It never imports `@dice/ui`,
`@dice/input`, or `@dice/determinism`, and it contains no game rules.

## Public entry

```js
import { createDiceEngine, DiceEngine, PluginRegistry, BrowserScheduler } from '@dice/engine';

const engine = await createDiceEngine({
  container: stage,          // null + headless for Node
  headless: false,
  seed: 'optional',
  content: classicTray,       // serializable content pack (plain data)
  dice: { count: 6, definition: 'd6', style: 'classic' },
  loop: { fixedStep: 1 / 60, maxSubSteps: 4 }
});

engine.use(new PointerInput({ container: stage })); // input plugin
const result = await engine.roll({ dice: 6 });
```

The factory is async because the rendering backend may load the vendored
Three script. Headless engines resolve through the same public path.

## What the engine owns

- **Scheduler selection** — `headless: true` or no container uses
  `ManualScheduler` (never touches RAF); a container uses
  `BrowserScheduler` (`performance.now` / `requestAnimationFrame`).
- **Rolls** — `roll(request)` builds a throw plan before plugin hooks,
  awaits async `prepareRoll`, spawns the world roll, and emits exactly one
  `roll:settle` with the canonical `RollResult`. The returned promise
  resolves with that result. `cancelRoll()` rejects with
  `RollCancelledError` (name `RollCancelledError`). `values` without a
  mapping-supplying plugin reject with `UnsupportedRollOptionError`.
- **Simulation** — `simulate(request)` runs an isolated headless world
  with its own event bus: no public engine events, no live-world contact.
- **Lifecycle** — `start` / `pause` / `resume` / `stop`, `clear`, `reset`,
  `resize` (reads the container when no metrics are supplied), and
  idempotent `destroy`.
- **Configuration** — `setMode`, `setEnclosure`, `setCamera`,
  `resetCamera`, `setDiceConfig`, `setSettleConfig`, `setLoopConfig`.
- **InputHost** — the engine itself implements `roll`, `setGravity`,
  `applyImpulse`, `getDiceIds`, `getSelection`, `setSelection`,
  `toggleSelection`, `pick`, `getMetrics`, `getSpawnProfile`, and
  `events`, so input plugins attach to the engine object directly.

## Plugins

```js
{
  id: 'my-plugin',
  attach(engine) {},        // engine === InputHost for input plugins
  detach(engine) {},
  async prepareRoll(request) { return { request, faceMappings, diagnostics }; },
  afterRoll(result) {}
}
```

Hooks run in registration order. Face mappings returned by `prepareRoll`
are merged into the effective request and reach the world spawn.

## Tests

```bash
npm test --workspace @dice/engine
```
