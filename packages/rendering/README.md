# `@dice/rendering`

Backend-neutral rendering for the dice engine. This is the only package allowed
to load or reference the vendored Three.js r73 build. Everything else talks to a
`RenderScene` and opaque visual handles.

## Public entry

```js
import {
  createRenderScene,
  createThreeLegacyBackend,
  RenderScene,
  createDiceMaterialSet
} from '@dice/rendering';
import { D6, createDiceMeshData, getDiceStyle } from '@dice/dice';

const backend = await createThreeLegacyBackend();
const renderer = await createRenderScene({ backend, container });

const materialSet = createDiceMaterialSet({
  style: getDiceStyle('classic'),
  labels: [1, 2, 3, 4, 5, 6]
});

const visual = renderer.createDiceVisual({
  id: 'die-1',
  meshData: createDiceMeshData(D6, { radius: 100 }),
  materialSet,
  faceMapping: D6.createFaceMapping()
});

visual.setTransform({
  position: { x: 0, y: 0, z: 100 },
  quaternion: { x: 0, y: 0, z: 0, w: 1 }
});

renderer.render();
```

`createThreeLegacyBackend()` is asynchronous. It dynamically imports the r73
adapter and loads the vendored UMD script once. Importing `@dice/rendering` in
Node is safe: the vendor script and the DOM are only touched when a backend is
created.

## RenderScene

- `scene` / `camera` are opaque handles that only this package consumes.
- `add`, `remove`, `createDiceVisual`, `createEnclosureVisual`,
  `createTableVisual`, `createLight`, `setCamera`, `resetCamera`, `resize`,
  `render`, `pick`, and `dispose`.
- `resize(metrics)` accepts the shared `ViewportMetrics` from `@dice/core`; the
  caller owns DOM reads.
- `pick(ndc, candidates)` returns `{ dieId, distance, point }` or `null`.
- `dispose()` releases geometries, materials, textures, lights, the canvas, and
  event listeners. It is idempotent.

## Visual descriptors

```js
{ type: 'plane', width, height, color, receiveShadow }
{ type: 'box-outline', width, height, depth, color, opacity }
{ type: 'sphere-shell', radius, color, opacity }
{ type: 'cylinder-shell', radius, height, color, opacity }
{ type: 'ambient', color, intensity }
{ type: 'spot', color, intensity, position, target, castShadow }
```

Descriptors are plain data. No `THREE.Mesh`, `THREE.Scene`, or `THREE.Vector3`
leaves the package.

## Mesh data and face mapping

`createDiceVisual` consumes the pure `DiceMeshData` emitted by `@dice/dice`.
Every triangle keeps its geometric `faceIndex`; `faceMapping[faceIndex]` selects
the displayed label without cloning geometry. Chamfer triangles always use
material slot `0`.

The r73 adapter builds `THREE.Geometry`, `THREE.Face3`, and
`THREE.MeshFaceMaterial`. A future modern backend can build `BufferGeometry`
groups instead; no other package changes.

## Boundaries

- Only this package imports or loads Three.js.
- No Cannon or UI imports.
- The vendor build is emitted as a base-aware, hashed Vite asset.

## Tests

```bash
npm test --workspace @dice/rendering
npm run test:e2e -- --grep rendering
```
