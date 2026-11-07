# `@dice/physics`

Backend-neutral physics for the dice engine. This is the only package allowed to
import `cannon-es`; everything else uses `PhysicsWorld`, `BodyHandle`, plain
vectors, and shape descriptors.

## Public entry

```js
import {
  PhysicsWorld,
  createCannonEsBackend,
  DEFAULT_GRAVITY,
  DEFAULT_MASS
} from '@dice/physics';

const physics = new PhysicsWorld({ backend: createCannonEsBackend() });
const body = physics.createBody({
  shape: { type: 'sphere', radius: 40 },
  mass: DEFAULT_MASS,
  transform: {
    position: { x: 0, y: 0, z: 400 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 }
  }
});

physics.step(1 / 60);
console.log(body.getTransform());
physics.dispose();
```

## Shape descriptors

```js
{ type: 'plane', normal: { x: 0, y: 0, z: 1 } }
{ type: 'box', halfExtents: { x: 1, y: 1, z: 1 } }
{ type: 'sphere', radius: 10 }
{ type: 'convex', vertices: [{ x, y, z }], faces: [[0, 1, 2]] }
{ type: 'cylinder', radius: 300, height: 800, segments: 24, axis: 'z' }
```

The simulation is Z-up. A `cylinder` with `axis: 'z'` is converted to the
`cannon-es` local Y axis inside the backend only.

## Boundaries

- Only this package imports `cannon-es`.
- No DOM or Three.js imports.
- `BodyHandle` returns copies of plain vectors and quaternions; live backend
  objects never escape.
