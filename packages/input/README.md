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
  mode, // 'standard' | 'continuous', read live on every flick
  events
}
```

`PointerInput` reads `host.mode` on every flick: in `standard` mode a flick
delegates a fresh roll via `host.roll()`, while in `continuous` mode it
applies a per-die impulse to every active die via `host.applyImpulse()`
and never calls `host.roll()`, so the live dice are not cleared or
respawned. Both flick paths share one throw-strength setting (`throwStrength`,
default `THROW_STRENGTH` = 3): standard throw vectors and continuous
impulses both launch at `boost × throwStrength`, so a flick has the same
power in either mode. The launch angle still differs per mode — spawned
dice lob at the throw ratio, while continuous impulses are launched steeply
off the floor (`continuousUpwardRatio`, default
`CONTINUOUS_UPWARD_VELOCITY_RATIO` = 1.5, ~56° above horizontal) because
those dice start resting on the floor rather than airborne at the spawn
height. Continuous impulses are additionally scaled by the die mass
(`dieMass`, default `DEFAULT_DIE_MASS` = 300, parity with the physics
default), because physics divides an impulse by mass — without the scaling
a flick would change the velocity by only ~1 unit and be imperceptible.

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

## Throw arrow (`ThrowVisualizer`)
`PointerInput` drives an SVG throw arrow over the container alongside the
gesture: the arrow base stays anchored at the pointer-down point
(`P_start`) and the tip follows the cursor (`P_current`), clamping to the
maximum length (`THROW_VISUALIZER_MAX_LENGTH` = 190 px) along the drag ray.
The colour interpolates with the power ratio (clamped length over maximum
length) from teal through gold to fiery orange-red. Drags shorter than
`THROW_VISUALIZER_THRESHOLD` (18 px) stay hidden, so taps keep working for
`RaycastPicker`; a longer drag plays a fade + scale snap on release, and
the overlay is removed when the input detaches. The overlay never
intercepts pointer events and never affects the throw math.

Pass `visualizer: false` (or `null`) to `PointerInput` to disable it, or
an options object (`maxLength`, `threshold`, `releaseDurationMs`) to tune
it — the overlay's threshold is also the dispatch threshold.

Apps whose rolls carry extra state can pass a `rollRequest` callback;
its returned fields are merged into every standard-mode flick roll under
the flick's own `vectors`, `dice`, and `cancelActive`. The dice visual lab
uses it to keep face mappings on flicks (a flick calls `host.roll()`
directly, bypassing the app's own throw helper). Continuous-mode flicks
ignore it, since they never roll.

## Gesture math

The pure helpers in `gesture.js` are exported for tests and demos:

- `evaluateGesture({ start, end, durationMs, metrics })` returns the vector,
  normalized direction, distance, boost, and whether the move clears the swipe
  threshold.
- `gestureBoost(distance, durationMs)` matching the legacy curve.
- `clientToNdc(x, y, rect)` mapping client coordinates to `[-1, 1]`.
- `clientToSpawnOrigin(point, rect, metrics, spawnProfile)` projecting a
  client-space pointer point (`P_start`) into world space
  (`X`, `Y`, `Z_spawn`) — the spawn origin both flick paths share.
- `buildThrowVectors({ direction, boost, count, rng, metrics, spawnProfile })`
  producing one throw vector per die with an injected `RandomSource`. Dice
  spawn scattered around the spawn origin with centre-to-centre separation
  of at least the die diameter plus margin, clamped inside the enclosure,
  each with per-die speed jitter (±15%), a horizontal cone deviation
  (±10°), an upward velocity (`Vz > 0`), and 3D spin proportional to the
  throw power.
- `buildContinuousImpulses({ direction, boost, ids, rng })` producing one
  varied impulse per active die for continuous mode (directional, upward
  `+Z`, with per-die cone deviation and speed jitter).

## Tests

```bash
npm test --workspace @dice/input
```
