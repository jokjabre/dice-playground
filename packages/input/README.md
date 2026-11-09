# @dice/input

Browser input plugins on `@dice/core` contracts: pointer flick throws, tilt and
shake motion, tap picking, and a programmatic driver for tests and demos.

The package never imports `@dice/world`, `@dice/engine`, `@dice/rendering`,
`@dice/physics`, `@dice/dice`, `@dice/enclosures`, `@dice/content`, `@dice/ui`,
or `@dice/determinism`. Every effect goes through the engine-provided
`InputHost`:

```js
{
  roll(request),
  setGravity(x, y, z),
  applyImpulse(ids, impulse, worldPoint?),
  getDiceIds(),
  getSelection(),
  setSelection(ids),
  toggleSelection(id),
  pick(ndc),
  getMetrics(),
  getSpawnProfile(),
  events
}
```

## Public entry

```js
import { PointerInput, MotionInput, RaycastPicker, ProgrammaticInput } from '@dice/input';

engine.use(new PointerInput({ container }));
engine.use(new MotionInput({ target: window }));
engine.use(new RaycastPicker({ container }));
```

Each source implements the `InputSource` contract (`attach(host)` / `detach()`).
`MotionInput` additionally exposes `enable()` / `disable()` returning whether
sensors were attached; permission denial is reported through `motion:status`
and attaches no listeners.

## Gesture math

The pure helpers in `gesture.js` are exported for tests and demos:

- `evaluateGesture({ start, end, durationMs, metrics })` returns the vector,
  normalized direction, distance, boost, and whether the move clears the swipe
  threshold.
- `gestureBoost(distance, durationMs)` matching the legacy curve.
- `clientToNdc(x, y, rect)` mapping client coordinates to `[-1, 1]`.
- `buildThrowVectors({ direction, boost, count, rng, metrics, spawnProfile })`
  producing one throw vector per die with an injected `RandomSource`.

## Tests

```bash
npm test --workspace @dice/input
```
