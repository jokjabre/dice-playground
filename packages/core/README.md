# @dice/core

Environment-agnostic primitives shared by every engine package. The package has
no runtime dependencies and never touches the DOM, Three.js, Cannon, or browser
animation APIs.

## Responsibility

- `EventBus`: typed event subscriptions with listener error isolation.
- `EVENTS` / `EVENT_NAMES`: the public event catalog.
- `GameLoop`: fixed-step loop driven by an injected scheduler.
- `ManualScheduler`: deterministic scheduler for headless runs and tests.
- `StandardRollStrategy`, `ContinuousMotionStrategy`, `ManualStepStrategy`: loop
  strategies that return `StepResult` and never emit `roll:settle`.
- `RandomSource`, `createSeededRandom`, `createBrowserRandom`: explicit random
  streams with inclusive integer ranges and independent forks.
- `mergeConfig`: deep config merge where later layers win and arrays replace.
- `vec3` / `quat`: pure plain-object math helpers.
- `computeViewportMetrics`: shared viewport math; DOM reads belong to the caller.
- Error classes shared by the engine facade and packages.

## Public API

The only public entry is the package root:

```js
import {
  EventBus,
  EVENTS,
  GameLoop,
  ManualScheduler,
  StandardRollStrategy,
  createSeededRandom,
  computeViewportMetrics,
  vec3
} from '@dice/core';
```

Contracts are JSDoc typedefs in `src/contracts.js`. They are types only and have
no runtime exports.

## Tests

```bash
npm test --workspace @dice/core
```
