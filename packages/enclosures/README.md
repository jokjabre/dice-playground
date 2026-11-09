# @dice/enclosures

Composable physics boundaries for the dice world: a rectangular box, a hollow
sphere, and an open cylinder.

The package depends only on `@dice/core` contracts. Physics worlds and render
scenes are injected as handles, so no `@dice/physics`, `@dice/rendering`,
Three.js, or Cannon code appears here. Each enclosure keeps its physics bodies
and visuals derived from the same `ViewportMetrics`, which prevents the two
representations from diverging.

## Usage

```js
import { createEnclosure } from '@dice/enclosures';

const enclosure = createEnclosure('box', { ceiling: true });
enclosure.createPhysics(physicsWorld, metrics);
enclosure.createVisuals(renderScene, metrics);

// Resize: bodies and visuals are recomputed from the same metrics.
enclosure.update(nextMetrics);

// Tear down: removes bodies, visuals, and post-step callbacks.
enclosure.dispose();
```

Built-in ids: `box`, `sphere`, `cylinder`.
