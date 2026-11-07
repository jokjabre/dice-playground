# @dice/determinism

Optional predetermined-roll plugin: isolated outcome prediction and face
shifting for the dice engine.

The package depends only on `@dice/core` and `@dice/dice`. It never imports
physics or rendering and never constructs a physics world itself; the world
supplies an isolated `PredictionSession` through
`world.createPredictionSession()`.

## Public entry

```js
import { createDeterminismPlugin } from '@dice/determinism';

engine.use(createDeterminismPlugin({ mode: 'predict-and-shift' }));
// or
engine.use(createDeterminismPlugin({ mode: 'predict-only' }));
```

`prepareRoll(request)` is async. It creates a prediction session with the
roll vectors and seed, steps it headlessly to settle, reads the natural
values, and returns `{ request, faceMappings, diagnostics }`:

- `predict-and-shift`: `faceMappings` place each requested value on the face
  that naturally landed on top. A mapping change never clones geometry.
- `predict-only`: `faceMappings` is empty and `diagnostics.naturalValues`
  reports the natural outcome.
- `diagnostics` always carries `{ mode, naturalValues, targetValues }`.

When no `values` are requested, no shift is needed and `faceMappings` is
empty. Targets outside the die label range reject with
`InvalidRollTargetError` from `@dice/core`.

## Headless use

`OutcomePredictor` and `FaceShifter` are also exported for direct headless
tests:

```js
import { OutcomePredictor } from '@dice/determinism';

const predictor = new OutcomePredictor({ fixedStep: 1 / 60 });
const natural = predictor.predictNaturalValues(session);
```

The live world is never stepped during prediction; the session is disposed
before `prepareRoll` resolves.

## Tests

```bash
npm test --workspace @dice/determinism
```
