# Target Architecture

This document defines the package boundaries, contracts, and data flow for the reorganized engine. It is the reference for every migration phase.

---

## 1. Vocabulary

| Term | Meaning |
| :--- | :--- |
| **Engine** | Public facade and lifecycle owner. Owns the event bus, game loop, plugins, and one world. |
| **World** | One live simulation instance. Composes physics, rendering, dice, enclosure, dimensions, and roll state. |
| **Content** | Declarative, serializable definitions used to construct a world: table, dice set, enclosure, physics tuning, scenarios. |
| **App** | An experience built from engine + UI + content. Sandbox, demo, or game. |
| **Backend** | A concrete adapter for an external system. Today: `cannon-es` physics and Three r73 rendering. |
| **Plugin** | An optional engine extension attached at runtime, such as pointer input or determinism. |
| **Die definition** | Pure description of a die: mesh data, collision data, faces, normals, labels. |
| **Face mapping** | A permutation assigning displayed labels to geometric faces. This replaces mutating mesh material indices. |
| **Predetermined roll** | A visually natural roll whose displayed labels are mapped to requested values. Not bitwise cross-device simulation determinism. |

---

## 2. Package Catalog

| Package | Owns | May depend on | Must not depend on |
| :--- | :--- | :--- | :--- |
| `@dice/core` | Event bus, game loop, strategies, scheduler contract, RNG, pure math, viewport math, config merge, shared contracts and errors | — | DOM, Three.js, Cannon, app UI |
| `@dice/physics` | `PhysicsWorld`, `cannon-es` backend, shapes, materials, body handles, post-step hooks, tuning/introspection | core | Three.js, DOM, dice visuals |
| `@dice/rendering` | Three r73 backend, scene, camera, lights, mesh factory, texture factory, raycast service, resize/dispose | core | Cannon, game rules, DOM UI |
| `@dice/dice` | D6 geometry data, die definitions, face mapping, `DiceEntity`, `FaceReader`, style descriptors | core | Three.js, Cannon, DOM |
| `@dice/enclosures` | Box, sphere, cylinder; sizing; physics body creation through the physics API; visual descriptors through the rendering API | core (contracts; physics/rendering handles are injected) | direct Three/Cannon imports, physics/rendering package imports |
| `@dice/input` | Pointer/flick input, motion sensors, raycast picking, programmatic input | core (contracts; picking/metrics/selection via `InputHost`) | world/engine/rendering imports, direct Physics internals, UI mutation |
| `@dice/determinism` | Outcome predictor, face shifter, determinism plugin | core, dice (prediction session supplied by the world) | rendering, physics, UI |
| `@dice/world` | World runtime, backend factories, dice factory, dice set, spawn/throw/reroll/selection, settle tracking, table/enclosure composition, mesh sync | core, physics, rendering, dice, enclosures | RAF loop, UI, app routing, input/determinism |
| `@dice/content` | Content schema, validation, built-in presets, scenario definitions | core, dice | runtime state, DOM, physics/render backends |
| `@dice/rules` | Generic dice result helpers: sum, counts, N-of-a-kind, straights, keep plans | core | game-specific scoring, physics |
| `@dice/ui` | DOM helper, result presenters, control panel, HUD, styles, accessibility | core (event names/types) | world, engine runtime, physics, rendering |
| `@dice/engine` | Public facade, lifecycle, loop ownership, plugin registry, event catalog, browser scheduler | core, world, content | UI, game rules, input/determinism internals |

### Package shape

Every package uses the same minimal shape:

```text
packages/<name>/
├─ package.json
├─ README.md
├─ src/
│  ├─ index.js               # primary public entry
│  └─ ...internal modules
└─ test/
   └─ *.test.js
```

`package.json`:

```json
{
  "name": "@dice/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.js"
  },
  "dependencies": {},
  "scripts": {
    "test": "vitest run"
  }
}
```

Packages may expose additional **documented** subpaths, for example:

```json
{
  "exports": {
    ".": "./src/index.js",
    "./styles/*": "./src/styles/*"
  }
}
```

Internal relative imports are allowed inside a package. Cross-package imports use the package name and declared workspace versions (`"*"` inside the monorepo). No app or package may deep-import another package's `src/`.

---

## 3. Boundary Enforcement

Three layers of enforcement:

1. **Package exports.** Each package exposes a primary `"."` entry and only explicitly documented subpaths. Vite and Node resolve only those entries.
2. **Dependency Cruiser.** A `dependency-cruiser` config encodes the graph and forbids:
   - `three`/vendored Three outside `packages/rendering/**`
   - `cannon-es` outside `packages/physics/**`
   - any package importing `@dice/world` or `@dice/engine` except apps and the world/engine layering itself
   - `@dice/ui` importing runtime packages
   - `@dice/input` importing `@dice/rendering`, `@dice/world`, or `@dice/engine`
   - `@dice/enclosures` importing `@dice/physics` or `@dice/rendering` packages (handles are injected)
   - `@dice/determinism` importing `@dice/physics` or `@dice/rendering`
   - deep imports into `@dice/*/src/**`
   - circular dependencies
3. **ESLint overrides.** Browser globals (`document`, `window`, `navigator`) are forbidden in `core`, `physics`, `dice`, `enclosures`, `determinism`, `content`, `rules`, `world`, and `engine`. Backend globals `THREE`/`CANNON` are forbidden outside `rendering`/`physics`.

A package boundary is not "clean" because files live in different folders. It is clean when the dependency rule is executable in CI.

**Node-import safety:** `@dice/core`, `@dice/physics`, `@dice/dice`, `@dice/enclosures`, `@dice/content`, `@dice/rules`, `@dice/world`, and `@dice/engine` must be importable in Node without `document` or `window`. `@dice/rendering` must also be import-safe; it may touch the DOM only when a renderer is created. `@dice/input` and `@dice/ui` are browser-only leaf packages. Add a Node import smoke test for every claimed import-safe package.

---

## 4. Core Contracts

`@dice/core` is the only package with no backend dependencies. It provides shared primitives and JSDoc contracts.

### 4.1 Events

```js
/**
 * @template {Record<string, any>} Events
 */
export class EventBus {
  on(name, handler, options = {}) {}   // returns an unsubscribe function
  once(name, handler) {}
  off(name, handler) {}
  emit(name, payload) {}
  clear() {}
}
```

- Listener errors are isolated: one failing listener must not stop others. The bus emits `engine:error` with the scope and original error. Failures in the `engine:error` path are swallowed to avoid recursion.
- Event names are exported constants, not magic strings. The shared `EventMap` typedef gives handlers typed payloads under `checkJs`.
- Event payloads are plain serializable objects where practical.

### 4.2 Game loop

```js
export class GameLoop {
  constructor({
    step,
    render,
    world,
    scheduler,
    eventBus,
    fixedStep = 1 / 60,
    maxSubSteps = 4
  }) {}
  start(strategy) {}
  pause() {}
  resume() {}
  stop() {}
  step(dt) {}              // manual/headless stepping
  setStrategy(strategy) {}
}
```

`Scheduler` contract (injected):

```js
{
  now(): number,
  requestFrame(callback): number,
  cancelFrame(id): void
}
```

- `BrowserScheduler` lives in `@dice/engine` and wraps `performance.now`/`requestAnimationFrame`.
- `ManualScheduler` lives in `@dice/core` and never schedules; `step(dt)` drives it.
- `@dice/core` must not touch `requestAnimationFrame` directly.

Responsibilities:

- Own the fixed-step accumulator through the injected scheduler.
- Clamp large frame gaps, cap sub-steps, and avoid the spiral of death.
- Emit `loop:start`, `loop:pause`, `loop:resume`, `loop:stop`, and `tick`.
- Never know about dice, physics, or DOM.
- Accept an injectable scheduler/clock for tests.

Strategies:

- `StandardRollStrategy`: returns `{ continue: false, settled: true }` when the world reports all dice settled. It does **not** emit the public `roll:settle` event.
- `ContinuousMotionStrategy`: never auto-stops.
- `ManualStepStrategy`: no scheduling; used by headless simulation and tests.
- Strategies receive the loop and a `WorldContract` with `areDiceSettled()`, `getValues()`, and `getDice()`.

Event ownership: the loop emits `loop:*` and `tick`; the engine reads the settle result and emits the public `roll:settle` with the canonical `RollResult`. This prevents duplicate settle events and keeps one payload shape.

### 4.3 Randomness

```js
export class RandomSource {
  next() {}                 // [0, 1), independent stream
  int(min, max) {}          // inclusive on both ends
  pick(array) {}
  fork(seed) {}             // independent stream; does not advance the parent
}

export function createSeededRandom(seed) {}   // mulberry32-style, for tests/demos
export function createBrowserRandom() {}      // crypto if available, Math.random fallback
```

Rules:

- No module-level singleton. A `RandomSource` is created per engine/world.
- String seeds are hashed to a 32-bit state deterministically; numeric seeds are used directly.
- `fork` creates an independent stream; using the child must not change the parent sequence.
- Input, spawn profiles, and scenarios accept an injected source.
- `seed` is recorded in roll results for reproducible test runs.
- Seeded RNG makes vectors repeatable. It does not guarantee cross-device physics bitwise equality.

### 4.4 Configuration

```js
export function mergeConfig(...layers) {}
```

- Precedence: package defaults → content preset → app config → runtime override.
- Objects merge deeply; arrays replace.
- Unknown top-level keys are rejected in development.
- No module-level mutable `options` object.
- Each runtime value has a single source of truth. Gravity is set by content/app config with a physics-package fallback of `{ x: 0, y: 0, z: -2940 }`; settle thresholds live in core/world config; enclosure ids live in the enclosures package. Determinism reads the world's settle config instead of redefining its own.

### 4.5 Viewport and metrics

`@dice/core` provides pure math only:

```js
export function computeViewportMetrics({
  containerWidth,
  containerHeight,
  sceneWidth,
  sceneHeight,
  devicePixelRatio
}) {}

/**
 * @typedef {Object} ViewportMetrics
 * @property {number} containerWidth
 * @property {number} containerHeight
 * @property {number} sceneWidth
 * @property {number} sceneHeight
 * @property {number} scale
 * @property {number} aspect
 * @property {number} wallHeight
 * @property {number} pixelRatio
 */
```

The DOM read (`container.clientWidth`, etc.) belongs to the app or world adapter. `@dice/core` never touches the DOM. `World.resize()` accepts `ViewportMetrics`; `RenderScene.resize()` consumes the same object.

### 4.6 Shared contracts

JSDoc typedefs only, no runtime implementations:

- `Vec3`, `Quat`, `Transform`
- `PhysicsBackend`, `PhysicsWorldContract`, `BodyHandle`
- `RenderBackend`, `RenderSceneContract`, `VisualHandle`
- `WorldContract`, `DieContract`, `PredictionSession`
- `InputSource`, `InputHost`, `EnginePlugin`
- `Scheduler`, `StepResult`
- `RollRequest`, `RollResult`
- `ContentPack`, `EnclosureDefinition`, `DicePreset`, `ControlItem`
- `EventMap`

Contracts use plain data at boundaries, never backend classes.

---

## 5. Physics

### 5.1 Public API

`@dice/physics` exposes a backend-neutral world:

```js
const physics = new PhysicsWorld({
  backend,
  gravity: { x: 0, y: 0, z: -2940 },
  iterations: 20,
  materials: { ... }
});
```

Methods:

```js
physics.createBody({ shape, mass, material, transform, linearDamping, angularDamping });
physics.removeBody(body);
physics.step(dt);
physics.setGravity(x, y, z);
physics.getGravity();
physics.setContactMaterial(materialA, materialB, { friction, restitution });
physics.getMaterialNames();
physics.getContactMaterial(materialA, materialB);   // { friction, restitution }
physics.setSolverIterations(iterations);
physics.addPostStep(callback);
physics.removePostStep(callback);
physics.dispose();
```

`BodyHandle` exposes plain snapshots and explicit commands:

```js
body.id;
body.mass;
body.isStatic;
body.getPosition();       // returns a new plain { x, y, z }
body.getQuaternion();     // returns a new plain { x, y, z, w }
body.getVelocity();       // returns a new plain vector
body.getAngularVelocity();
body.getSleepState();
body.setTransform({ position, quaternion });
body.setVelocity(vec);
body.setAngularVelocity(vec);
body.setMass(mass);
body.setDamping(linear, angular);
body.applyImpulse(vec, worldPoint);
body.applyForce(vec);
body.wakeUp();
```

- Accessors return copies, never live backend objects.
- Mutations go through explicit setters/commands.
- No `CANNON.Body`, `CANNON.Vec3`, or `CANNON.World` leaves the package.

### 5.2 Shape descriptors

```js
{ type: 'plane', normal: { x: 0, y: 0, z: 1 } }
{ type: 'box', halfExtents: { x: 1, y: 1, z: 1 } }
{ type: 'sphere', radius: 10 }
{ type: 'convex', vertices: [...], faces: [...] }
{ type: 'cylinder', radius: 300, height: 800, segments: 24, axis: 'z' }
```

- The world is Z-up. The Cannon backend converts a `cylinder` with `axis: 'z'` to Cannon's Y-axis cylinder orientation inside the adapter.
- `material` is a material name resolved by the backend; no material object leaks.
- The dice package produces collision descriptors; the physics backend turns them into `cannon-es` shapes. Enclosures produce plane/convex/cylinder descriptions. No other package constructs Cannon shapes.

### 5.3 Cannon-es backend

`packages/physics/src/backends/cannon-es/` contains:

- `CannonEsBackend.js` — implements the internal backend interface.
- `createShape.js` — descriptor → Cannon shape.
- `toPlain.js` — body/quaternion/vector conversion helpers.

Explicit constructor mapping:

| Legacy / target concept | `cannon-es` |
| :--- | :--- |
| `new CANNON.RigidBody(mass, shape, material)` | `new CANNON.Body({ mass, shape, material })` |
| `new CANNON.ContactMaterial(a, b, friction, restitution)` | `new CANNON.ContactMaterial(a, b, { friction, restitution })` |
| `world.add(body)` | `world.addBody(body)` |
| `world.remove(body)` | `world.removeBody(body)` |
| `new CANNON.ConvexPolyhedron(vertices, faces)` | `new CANNON.ConvexPolyhedron({ vertices, faces })` |
| `CANNON.Plane` | `CANNON.Plane` (normal along +Z after orientation) |
| `CANNON.NaiveBroadphase` | keep or switch to `SAPBroadphase` after parity tests |

Migration notes:

- The bundled Cannon build uses `CANNON.RigidBody`; `cannon-es` uses `CANNON.Body`. All references go through the adapter.
- Broadphase and solver settings are configurable; defaults preserve current behavior.
- Contact materials are registered by name, not by leaking material objects.
- Existing friction/restitution tables move into physics defaults.
- Gravity defaults: the legacy demo uses `{ x: 0, y: 0, z: -2940 }`. That value is authoritative for parity; the newer `-980` default in `src/core/DiceEngine.js` is not carried forward.

### 5.4 Prediction sessions

The current `OutcomePredictor` steps the live world and relies on resetting dice. The target avoids that. `@dice/world` owns a `PredictionSession`:

```js
const session = world.createPredictionSession({
  vectors,
  diceStates,          // optional kept/initial dice state
  enclosure            // defaults to the active enclosure definition
});

session.stepUntilSettled({
  velocityThreshold,
  settleFrames,
  maxIterations,
  fixedStep
});

const values = session.getValues();
session.dispose();
```

- The session owns an independent physics world, the same enclosure bodies, and independent dice bodies. It never renders and never touches the live world.
- `@dice/physics` provides the bodies/step primitives; `@dice/world` assembles the session because it knows the enclosure and dice state.
- `@dice/determinism` obtains the session from `engine.world` (captured in `attach`); it does not construct physics worlds itself.
- The live world is never stepped during prediction.

This also makes headless simulation and future server-side validation straightforward.

### 5.5 Disposal

- Bodies are removed from the world.
- Materials/contact materials are released.
- Post-step callbacks are unregistered.
- Backend caches are cleared.
- `dispose()` is idempotent.

---

## 6. Rendering

### 6.1 Public API

`@dice/rendering` exposes a backend-neutral scene:

```js
const renderer = await createRenderScene({
  backend: await createThreeLegacyBackend(),   // dynamically imports the r73 backend
  container,
  config
});
```

`createThreeLegacyBackend()` is async and dynamically imports the r73 backend/loader only in the browser. `createCannonEsBackend()` is synchronous and lives in `@dice/physics`.

Methods:

```js
renderer.scene;                   // opaque scene handle
renderer.camera;                  // opaque camera handle
renderer.add(object);
renderer.remove(object);
renderer.createDiceVisual({ meshData, materialSet, faceMapping });
renderer.createEnclosureVisual(descriptor);
renderer.createTableVisual(descriptor);
renderer.createLight(descriptor);
renderer.setCamera({ distance, near, far });
renderer.resetCamera();
renderer.resize(viewportMetrics);
renderer.render();
renderer.pick(ndc, candidates);
renderer.dispose();
```

Visual descriptors are plain data:

```js
// table
{ type: 'plane', width, height, color, receiveShadow }

// box enclosure outline
{ type: 'box-outline', width, height, depth, color, opacity }

// sphere / cylinder shell
{ type: 'sphere-shell' | 'cylinder-shell', radius, height?, color, opacity }

// light
{ type: 'ambient' | 'spot', color, intensity, position?, target?, castShadow? }
```

No `THREE.Mesh`, `THREE.Scene`, or `THREE.Vector3` leaves the package. `scene` and `camera` are opaque handles used only by the package itself or passed back into it.

### 6.2 Backend interface

The internal `RenderBackend` contract covers only what the engine needs:

```js
createScene()
createCamera(spec)
createRenderer({ container, antialias })
createGeometry(meshData)
createMaterial(materialSpec)
createTexture(textureSpec)
createMesh({ geometry, materials, castShadow, receiveShadow })
createLineSegments(descriptor)
createLight(spec)
add(scene, object)
remove(scene, object)
render(scene, camera)
resize(renderer, width, height, pixelRatio)
setBackground(scene, color)
pick(scene, camera, ndc, candidates)
disposeObject(object)
dispose()
```

### 6.3 Three r73 backend

The old Three build remains vendored:

```text
packages/rendering/vendor/three-r73/three.min.js
packages/rendering/src/backends/three-r73/
├─ loadThree.js          # loads the vendor script once; exports THREE
├─ ThreeLegacyBackend.js
├─ buildGeometry.js      # DiceMeshData -> THREE.Geometry
└─ buildMaterial.js      # MaterialSpec -> MeshPhongMaterial/MeshFaceMaterial
```

Exact loading strategy:

```js
// loadThree.js — shape, not final syntax
import vendorUrl from '../../../vendor/three-r73/three.min.js?url';

let loadPromise = null;

export function loadThree() {
  if (globalThis.THREE) return Promise.resolve(globalThis.THREE);
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = vendorUrl;
      script.async = true;
      script.onload = () => globalThis.THREE
        ? resolve(globalThis.THREE)
        : reject(new Error('Vendored Three loaded without exposing THREE'));
      script.onerror = () => reject(new Error('Failed to load vendored Three r73'));
      document.head.appendChild(script);
    });
  }
  return loadPromise;
}
```

- The vendor file is imported with Vite's `?url`, so Vite emits it as a hashed, base-aware asset.
- `ThreeLegacyBackend`/`loadThree` are **dynamically imported** by `createRenderScene` only when a renderer is actually created. This keeps the package entry import-safe in Node (Node never resolves the Vite-specific `?url` import).
- The loader caches the promise, so multiple engine instances share one load.
- Failure is reported through `engine:error` and the app's initialization error state.
- Other packages must not add Three script tags to app HTML.

The loader is **lazy**: importing `@dice/rendering` in Node must not touch `document` or load Three. Three is loaded only when a render scene/backend is created. This keeps headless world and engine tests free of browser globals. Add a Node import test and a built-site Playwright smoke test that verifies the hashed asset URL works under the Pages base path.

Why not upgrade now: Three r73 uses `THREE.Geometry`, `THREE.MeshFaceMaterial`, and old shadow/camera APIs. The modern upgrade is a real project. The adapter makes it a single-package change later.

### 6.4 Dice mesh data

The dice domain emits pure mesh data:

```js
{
  vertices: [{ x, y, z }],
  faces: [{
    faceIndex: 0,            // stable geometric face (0..faceCount-1)
    indices: [0, 1, 2],      // triangle vertex indices
    materialSlot: 1,         // default material slot for the face's label
    normal: { x, y, z },
    uvs: [{ x, y }, { x, y }, { x, y }]
  }],
  boundingRadius: 100
}
```

- Every triangle carries its geometric `faceIndex`; chamfer triangles use `faceIndex: -1` and `materialSlot: 0`.
- The r73 backend builds `THREE.Geometry` with `Face3` and `faceVertexUvs`.
- A future modern backend builds `BufferGeometry` with groups.
- Both consume the same data; the upgrade does not touch `@dice/dice`.

### 6.5 Face mapping and materials

The renderer receives:

- `meshData` — geometry with `faceIndex` on every triangle.
- `materialSet` — an ordered list: slot `0` is the chamfer material; slots `1..N` correspond to label order (for D6, labels `1..6`).
- `faceMapping` — `faceMapping[geometricFaceIndex] = displayedLabel`.

`MaterialSet` shape:

```js
{
  chamfer: MaterialSpec,
  labels: [
    { value: 1, material: MaterialSpec },
    { value: 2, material: MaterialSpec }
    // ...
  ]
}
```

For D6, the material array is `[chamfer, label1, label2, ..., label6]`. For a triangle with `faceIndex >= 0`, the renderer looks up `displayedLabel = faceMapping[faceIndex]` and uses the material slot for that label. Chamfer triangles keep slot `0`. When the mapping changes before a throw, the backend updates face material groups/slots without cloning geometry. This is the replacement for `FaceShifter` mutating `materialIndex` on a cloned geometry.

### 6.6 Scene composition

`RenderScene` owns the generic scene, camera, renderer, and lighting. It does **not** own a desk or enclosure. The world composes:

- Table visual from content.
- Enclosure visual from the enclosure package.
- Dice visuals from the dice factory.
- Lights from rendering config.

This removes the current `renderScene.desk` special case and the `scene.recreate_desk()` legacy code.

### 6.7 Picking

`RaycastService.pick(ndc, candidates)` returns:

```js
{ dieId, distance, point }   // point is in world space
```

The input package calls this through a small public `PickingService` contract. It never imports Three or touches meshes. `ndc` is normalized device coordinates in `[-1, 1]`.

### 6.8 Resize, camera, and disposal

- `resize(metrics)` updates renderer size, pixel ratio, camera aspect/projection, and any viewport-dependent visuals.
- `setCamera({ distance, near, far })` updates the camera from content/app controls; `resetCamera()` restores content defaults.
- `dispose()` releases geometries, materials, textures, renderer, event listeners, and the canvas.
- The world triggers resize from a `ResizeObserver` owned by the app shell, not from within the rendering package.

---

## 7. Dice Domain

### 7.1 Die definition

```js
export const D6 = {
  id: 'd6',
  faceCount: 6,
  chamfer: 0.96,
  faces: [
    { index: 0, normal: { x: 0, y: 0, z: 1 }, defaultLabel: 1 },
    // ...
  ],
  labelRange: [1, 6],
  createFaceMapping() {
    return [1, 2, 3, 4, 5, 6];
  }
};

export function createDiceMeshData(definition, { radius }) {}
export function createDiceCollisionData(definition, { radius }) {}
```

- Geometry is built by a pure `GeometryBuilder` using vector math from `@dice/core`.
- No Three or Cannon imports.
- The same data feeds rendering and physics.
- `DiceRegistry` in `@dice/dice` maps ids to definitions (`register`, `get`, built-in `d6`). Content references ids; the world resolves them.
- Future die types implement the same definition shape and register by id.

### 7.2 Face mapping

`faceMapping` is a permutation:

```text
faceMapping[geometricFaceIndex] = displayedLabel
```

- Default D6 mapping is the identity `[1,2,3,4,5,6]` for geometric faces 0..5 whose default labels are 1..6. The mapping is a label assignment, not a material index.
- Face mapping is the single source of truth for displayed values.
- Rendering applies it through `faceIndex` and the label-to-material-slot lookup.
- `FaceReader` returns the mapped label of the top geometric face.
- The optional determinism package's `FaceShifter` produces a new permutation instead of cloning geometry. For D6 it applies a cyclic label shift matching the legacy behavior; tests verify uniqueness and the requested top value. Opposite-face sums are not guaranteed to remain `7` after a predetermined shift.
- Golden tests compare new mapping/reader results against the legacy `materialIndex` behavior for known quaternions.

This makes predetermined rolls backend-agnostic and compatible with a future Three upgrade.

### 7.3 DiceEntity

```js
export class DiceEntity {
  id;               // stable within a world/turn: `die-<worldSeq>-<counter>`
  definition;
  body;             // physics BodyHandle contract
  visual;           // rendering VisualHandle contract, or null in headless mode
  faceMapping;
  selected;         // held/kept by the player
  state;            // 'idle' | 'rolling' | 'settled' | 'removed'

  get value() {}
  setFaceMapping(mapping) {}
  sync() {}         // body transform -> visual
  reset(transform) {}
  dispose() {}
}
```

- IDs are generated by the world and remain stable across partial rerolls for kept dice.
- `selected` is the single held/keep model; there is no separate `held` state.
- Setting a mapping updates the entity and asks the world to refresh the visual.
- `DiceEntity` does not import physics or rendering. It stores handles and delegates through the contracts.

### 7.4 FaceReader

```js
FaceReader.getTopFace(definition, quaternion) -> faceIndex
FaceReader.getValue(definition, quaternion, faceMapping) -> displayedValue
FaceReader.getValues(dice) -> number[]
```

- Uses the body quaternion and known face normals; no mesh traversal.
- Up vector defaults to world Z; configurable for alternate camera conventions.
- Works for any die definition with known face normals.

### 7.5 Dice styles

Style descriptors are data:

```js
{
  bodyColor: '#202020',
  labelColor: '#aaaaaa',
  fontFamily: 'Arial',
  material: { shininess: 30, specular: 0x172022 },
  textureSize: 256
}
```

The rendering package turns them into materials and textures. The dice package does not create canvases.

---

## 8. Enclosures

### 8.1 Interface

```js
export class Enclosure {
  createPhysics(physicsWorld, metrics) {}
  createVisuals(renderScene, metrics) {}
  update(metrics) {}
  dispose(physicsWorld, renderScene) {}
}
```

Built-ins:

- `BoxEnclosure`: desk/floor plane, four walls, optional ceiling, optional tray outline.
- `SphereEnclosure`: tangent plane approximation, containment post-step, translucent shell and wireframe.
- `CylinderEnclosure`: bottom cap plus polygonal wall facets, open top, wireframe/glass visual. The current cylinder is a visual placeholder; the target implements real physics.

### 8.2 Sizing

`packages/enclosures/src/sizing.js` provides pure functions:

```js
computeDieRadius(metrics)
computeBoxBounds(metrics)
computeSphereRadius(metrics)
computeCylinderSize(metrics)
```

World passes the same metrics to physics and visuals, so boundaries cannot diverge.

### 8.3 Boundaries

- Enclosures use only core contracts (`PhysicsWorldContract`, `RenderSceneContract`) and the injected handles' public APIs.
- No direct `THREE` or `CANNON` references.
- `@dice/enclosures` exports built-in definitions/ids (`box`, `sphere`, `cylinder`) and sizing. `@dice/content` selects and tunes them by id; `resolveContent` validates against the enclosure registry.
- Custom enclosures can be registered with the world API (`world.registerEnclosure(id, factory)`) and referenced by id in content.

---

## 9. World Runtime

`@dice/world` is the composition root for one simulation.

```js
export class World {
  constructor({
    config, content, rng, events, headless,
    container,                  // render target; null/headless for Node
    physicsFactory,             // optional injected fake/backend factory
    rendererFactory             // optional injected fake/backend factory
  });
  async init(viewport);             // engine supplies initial ViewportMetrics and container; skips renderer when headless
  resize(viewport);                // engine supplies ViewportMetrics; world never reads DOM
  registerEnclosure(id, factory);
  setEnclosure(typeOrDefinition);
  setCamera({ distance, near, far });
  resetCamera();
  spawnDice(spec);
  removeDice(ids);
  clearDice();
  resetDice();
  getDice();
  getDiceIds();
  getSelection();
  setSelection(ids);
  toggleSelection(id);
  getMetrics();
  getSpawnProfile();
  pick(ndc);
  setGravity(x, y, z);
  applyImpulse(ids, impulse, worldPoint?);
  jostle(intensity);
  setDiceConfig({ definition, count, style });
  setSettleConfig({ velocityThreshold, settleFrames });
  getSettleConfig();
  createThrowPlan(request);       // vectors + seed + spawn profile
  roll(request);
  step(dt);
  sync();
  render(alpha);
  getValues();
  areDiceSettled();
  createPredictionSession({ vectors, diceStates, enclosure } = {});
  reset();                         // clears dice and re-applies the active content
  dispose();
}
```

Responsibilities:

- Own the physics world, render scene (optional), enclosure, dice set, and metrics.
- Own backend factories (`createCannonEsBackend`, async `createThreeLegacyBackend`) by default; accept injected backends for tests/headless. This is the composition root: the engine passes the container and initial metrics, and does not construct physics/render backends itself.
- Create dice through a `DiceFactory` that wires a body from physics, a visual from rendering, and a `DiceEntity`.
- Compose the table visual from content.
- Manage spawn profiles, throw planning, and throw vectors.
- Track settled state and selection.
- Expose metrics, spawn profile, selection, and picking to the engine's `InputHost`.
- Support reroll of a subset for games like Yamb.
- Support headless mode with a null renderer and no DOM reads.
- Emit events through the engine's event bus, not its own.

`World` does **not**:

- Own scheduling or `requestAnimationFrame`.
- Own the game loop.
- Know about UI or DOM.
- Define game rules.
- Store app navigation or scorecards.

### Roll model

```js
{
  id: 'roll-17',
  dice: 6,
  keep: ['die-1-3', 'die-1-5'],  // stable die ids, not indices
  values: [6, 6, 6, 6, 6, 6],   // optional predetermined request
  vectors: [/* optional explicit throw vectors */],
  faceMappings: [/* optional mappings prepared by determinism */],
  seed: 'optional-seed',
  mode: 'standard' | 'continuous'
}
```

```js
{
  id: 'roll-17',
  values: [6, 6, 6, 6, 6, 6],
  total: 36,
  dice: [{ id, value, selected, position }],
  seed: 'optional-seed',
  durationMs: 1234,
  request: { /* original request */ }
}
```

### Throw planning

`engine.roll({ dice: 6 })` and the sandbox initial roll do not supply vectors. The engine asks the world for a throw plan before running plugins:

```js
const plan = world.createThrowPlan({
  dice: 6,
  definition: 'd6',
  seed: request.seed,
  mode: request.mode
});

// plan shape
{
  vectors: [
    { pos, velocity, angle, axis }
  ],
  seed: 'resolved-seed',
  dice: 6,
  spawnProfile: { mode: 'box', ... }
}
```

- `createThrowPlan` uses the active spawn profile, metrics, and injected `RandomSource`.
- The resolved seed is recorded in the plan and the final `RollResult`.
- The same plan is passed to the prediction session and the live spawn, so predetermined rolls predict the exact visible trajectory.
- Runtime overrides may supply explicit `vectors`; those bypass generation.
- `engine.roll` builds the plan before calling plugin `prepareRoll` hooks.

Reroll flow for Yamb:

1. First roll spawns five dice (Yamb) or six (sandbox).
2. User selects dice to keep; non-selected dice are removed.
3. Next roll spawns replacements with new throw vectors while keeping selected dice at rest.
4. Values, mappings, and stable die ids are preserved for kept dice.
5. `keep` refers to those stable ids. `spawnDice`/`DiceFactory` never reuses an id.

This requires the world to support partial rerolls; the current engine always clears all dice.

---

## 10. Engine Facade

`@dice/engine` is the public API and lifecycle owner.

```js
export class DiceEngine {
  static async create(config) {}
  get events() {}
  get world() {}
  use(plugin) {}
  unuse(pluginId) {}
  roll(request): Promise<RollResult> {}
  cancelRoll(reason) {}
  simulate(request): Promise<RollResult> {}   // isolated headless one-shot
  setMode(mode) {}
  setEnclosure(type) {}
  setCamera(settings) {}
  resetCamera() {}
  setDiceConfig(config) {}
  setSettleConfig(config) {}
  setLoopConfig(config) {}
  clear() {}
  reset() {}
  start() {}
  pause() {}
  resume() {}
  stop() {}
  resize(viewport = null) {}    // reads the container when omitted
  destroy() {}
}
```

Factory:

```js
export async function createDiceEngine(config) {
  return DiceEngine.create(config);
}
```

Config shape:

```js
{
  container: HTMLElement | null,
  headless: false,
  seed: 'optional',
  content: contentPack,
  physics: { /* overrides */ },
  rendering: { /* overrides */ },
  dice: { count, definition, style },
  loop: { fixedStep, maxSubSteps },
  plugins: [ /* optional */ ]
}
```

The factory is async because the rendering backend may need to load the vendored Three script. Headless engines can resolve synchronously in practice but keep one async public path for consistency.

Scheduler selection:

- `headless: true` or `container: null` → `ManualScheduler`; `start()` does not schedule frames, `simulate()`/manual `step()` drives the loop.
- Browser mode with a container → `BrowserScheduler` wrapping `performance.now`/`requestAnimationFrame`.
- Engine construction must be import-safe in Node; the browser scheduler is only instantiated in browser mode.

### Roll semantics

- `roll(request)` returns a promise that resolves with the canonical `RollResult` when settled, or rejects on cancellation/error. It builds a throw plan when vectors are absent, emits `roll:start` immediately, and `roll:settle` once.
- If a roll is already active, `roll()` rejects with `RollInProgressError` unless `{ cancelActive: true }` is passed.
- `cancelRoll(reason)` stops the loop, emits `roll:cancel`, and rejects the pending roll promise.
- `simulate(request)` builds an isolated headless world/session, runs to settle, emits no public engine events, and resolves with a `RollResult`. It never touches the live world.
- Invalid `values` are rejected with `UnsupportedRollOptionError` when the determinism plugin is not installed, or `InvalidRollTargetError` when a target is outside the die's label range.
- `clear()` removes dice and results; `reset()` clears dice and re-applies the active content/config.

### Plugins

All plugins use one lifecycle:

```js
{
  id: 'pointer-input',
  attach(engine) {},              // called by engine.use()
  detach(engine) {},              // called by engine.unuse()/destroy()
  prepareRoll?(request): Promise<{
    request?: RollRequest,
    faceMappings?: Array<number[]>,
    diagnostics?: object
  }>,
  afterRoll?(result) {}
}
```

- `prepareRoll` is async so determinism can run a headless prediction session before the visible roll.
- The engine awaits every plugin's `prepareRoll` in registration order, merges mapping results into the effective request, and then starts the world roll.
- `InputSource` is an engine plugin with an additional `enable()`/`disable()` capability; its `attach(host)` wires DOM listeners, `detach` removes them. The engine itself implements `InputHost`, so the same object is passed to every plugin's `attach`.
- Input plugins receive an `InputHost` contract (implemented by the engine) instead of importing the engine or world:
  - `roll(request)`
  - `setGravity(x, y, z)`
  - `applyImpulse(ids, impulse)`
  - `getDiceIds()`
  - `getSelection()`
  - `setSelection(ids)`
  - `toggleSelection(id)`
  - `pick(ndc)`
  - `getMetrics()`
  - `getSpawnProfile()`
  - `events`

Built-in plugin packages:

- `@dice/input` — pointer, motion, programmatic.
- `@dice/determinism` — predicts natural outcomes and applies face mappings before a roll.

Apps opt in. The engine package does not import them, so headless use has no DOM/input cost.

### Engine ownership

- Event bus.
- Browser scheduler and game loop.
- World instance.
- Plugin registry.
- Lifecycle and error handling.
- DOM reads from the configured `container` (`clientWidth`, `clientHeight`, `devicePixelRatio`) and conversion to `ViewportMetrics` via `@dice/core`; headless mode reads no DOM.
- No UI.
- No game rules.
- No content-specific code.

---

## 11. Content Model

`@dice/content` defines serializable content packs.

```js
export const classicTray = defineContentPack({
  id: 'classic-tray',
  version: 1,
  label: 'Classic Tray',
  enclosure: {
    type: 'box',
    margin: 0.93,
    ceiling: true
  },
  table: {
    floorColor: '#2596be',
    background: '#0b0f19',
    lights: 'warm',
    shadows: true
  },
  camera: {
    distance: 1,
    near: 1,
    far: 0
  },
  dice: {
    definition: 'd6',
    count: 6,
    style: 'classic'
  },
  physics: {
    gravity: { x: 0, y: 0, z: -2940 },
    materials: 'default-dice'
  },
  scenarios: {
    standard: { throw: 'flick', dice: 6 },
    predeterminedSix: { throw: 'flick', dice: 6, values: [6, 6, 6, 6, 6, 6] }
  }
});
```

Rules:

- Content is plain data, JSON-compatible, and frozen after validation.
- Built-in packs live in `packages/content/src/presets/`; enclosure definitions/ids live in `@dice/enclosures`; dice definitions/styles live in `@dice/dice`. Content references them by id and does not duplicate their definitions.
- App-local content lives in `apps/<app>/src/content/`.
- Content may reference definitions by id (`'d6'`, `'classic'`, `'box'`), never import runtime classes.
- Validation reports actionable errors with the content path.
- A content pack can be loaded from JSON later without engine changes.

Schema and resolution API:

```js
defineContentPack(pack) -> frozen ContentPack
validateContentPack(pack, registries) -> { ok, errors }
resolveContent(pack, {
  diceRegistry,          // from @dice/dice
  enclosureRegistry,     // from @dice/enclosures
  styleRegistry,         // from @dice/dice
  appOverrides
}) -> ResolvedContent
```

- `defineContentPack` only freezes/normalizes; full validation happens when registries are available.
- `resolveContent` merges defaults < pack < app overrides and returns concrete ids/values.
- `@dice/content` stays free of physics/rendering imports by accepting registries as arguments. `@dice/world`/apps supply them at startup.
- Registry ids are stable and covered by tests.

Resolution order:

```text
package defaults
  → content pack
    → app config
      → runtime API override
```

---

## 12. Rules Layer

`@dice/rules` is a small, pure library of generic dice operations. It is deliberately not a game framework.

```js
sum(values)
countByValue(values)
hasAtLeast(values, face, count)
hasExactly(values, face, count)
isNOfAKind(values, n)
isFullHouse(values)
isStraight(values, length)
topValues(values, n)
createKeepPlan({ values, keep })
```

- No physics, no DOM, no UI.
- Yamb scoring imports these helpers but lives in the Yamb app.
- Future games can reuse the helpers without inheriting Yamb rules.
- Tests use table-driven fixtures.

---

## 13. UI Layer

`@dice/ui` is framework-agnostic vanilla DOM.

Modules:

```text
packages/ui/src/
├─ dom/                 # createElement, class names, safe text, focus helpers
├─ presenters/          # ResultBanner, SilentPresenter, CustomPresenter
├─ controls/            # ControlPanel, Select, Range, Number, Toggle, Button
├─ hud/                 # Toolbar, Panel, Status, Toast
├─ styles/              # base.css, banner.css, controls.css, theme.css
└─ index.js
```

`@dice/ui` package exports a primary entry plus documented styles:

```json
{
  "exports": {
    ".": "./src/index.js",
    "./styles/*": "./src/styles/*"
  }
}
```

Rules:

- UI subscribes to engine events; it never reads world internals.
- UI commands go through the public engine API.
- Presenters accept `{ events }`, not an engine instance.
- Controls are schema-driven and emit change events.
- All interactive elements have labels, focus styles, and `data-testid` attributes.
- The result banner uses `aria-live="polite"`.
- Styles use CSS variables for theming; apps override variables, not selectors.
- No `innerHTML` with user-provided strings.

`ControlItem` schema:

```js
{
  id: string,
  type: 'select' | 'range' | 'number' | 'text' | 'toggle' | 'button',
  label: string,
  value?: any,
  options?: Array<{ value: string, label: string }>,
  min?: number,
  max?: number,
  step?: number,
  disabled?: boolean,
  testId?: string
}
```

`ControlPanel` API:

```js
const panel = new ControlPanel({ title, items });
panel.on('change', ({ id, value }) => {});
panel.setValue(id, value);
panel.setDisabled(id, disabled);
panel.destroy();
```

Example:

```js
const banner = new ResultBanner({
  events: engine.events,
  autoHide: 4000
});

const panel = new ControlPanel({
  title: 'Engine',
  items: [
    { id: 'enclosure', type: 'select', label: 'Enclosure', options: [...] },
    { id: 'gravity', type: 'range', label: 'Gravity', min: -5000, max: 0, step: 10 }
  ]
});

panel.on('change', ({ id, value }) => {
  if (id === 'enclosure') engine.setEnclosure(value);
  if (id === 'gravity') engine.world.setGravity(0, 0, value);
});
```

---

## 14. Input

`@dice/input` provides plugins and helpers. It depends on `@dice/core` contracts only. It must not import `@dice/rendering`, `@dice/world`, or `@dice/engine`; it receives an `InputHost` from the engine.

### InputHost

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

### PointerInput

- Converts pointer/touch drag gestures into throw vectors.
- Uses `host.getSpawnProfile()` and `host.getMetrics()`.
- Calls `host.roll({ vectors })`.
- Cleans up listeners on detach.
- No direct body mutation.

### MotionInput

- Listens to `deviceorientation` and `devicemotion`.
- Low-pass filters sensor values.
- Maps orientation to gravity through `host.setGravity`.
- Maps shake spikes to impulses through `host.applyImpulse`.
- Requests iOS permission from a user gesture; emits `motion:status`.
- Never writes to the DOM.

### RaycastPicker

- Converts pointer coordinates to NDC.
- Calls `host.pick(ndc)`, which delegates to the rendering picking service.
- Emits `die:pick` and/or calls `host.toggleSelection(dieId)` or a configured selection handler.
- Works with `host.getDiceIds()`/`getSelection()` for held-die UI.

### ProgrammaticInput

- Test/demo helper that can inject throws, picks, gravity, and sensor values.
- Used by e2e tests and deterministic demos.

### InputSource contract

`InputSource` is an engine plugin with input capabilities:

```js
{
  id,
  attach(host),              // called by engine.use()
  detach(),                  // called by engine.unuse()/destroy()
  enable?(): Promise<boolean>,
  disable?()
}
```

The engine adapts its own public API to `InputHost`; input packages never reach into world internals.

---

## 15. Determinism

`@dice/determinism` is optional and plugin-shaped.

```js
const determinism = createDeterminismPlugin({
  mode: 'predict-and-shift',   // or 'predict-only'
  // optional overrides; defaults come from world.getSettleConfig()
  velocityThreshold: undefined,
  settleFrames: undefined,
  maxIterations: 1000
});
engine.use(determinism);
```

The predictor reads the world's settle configuration by default so the visible roll and the headless prediction use the same thresholds.

Flow for `engine.roll({ values: [6, 6, 6] })`:

1. Engine builds a `ThrowPlan` (or accepts explicit vectors).
2. Engine calls the plugin's async `prepareRoll(request)` with the plan applied.
3. Plugin asks the engine/world for a prediction session with the same content/config and enclosure.
4. Spawn dice in the session with the plan's vectors and seed.
5. Step the session headlessly until settled.
6. Read natural values with `FaceReader`.
7. Compute face mappings so requested values land on the predicted top faces.
8. Dispose the prediction session.
9. Return `{ request, faceMappings, diagnostics }`.
10. Engine merges the mappings into the effective request.
11. World spawns the live dice with the same plan and mappings applied and runs the visible roll.

No live-world mutation. No rendering dependency. No geometry cloning. `prepareRoll` is async; `engine.roll` awaits it before starting the loop.

Terminology:

- **Predetermined roll** — the feature above. Guarantees displayed values for a given local run.
- **Seeded RNG** — repeatable throw vectors and tests.
- **Bitwise simulation determinism** — not promised across devices/browsers/builds.

---

## 16. Event Catalog

Event names are constants exported from `@dice/core`.

| Event | Payload | Emitted by |
| :--- | :--- | :--- |
| `engine:ready` | `{ engineId }` | engine |
| `engine:resize` | `ViewportMetrics` | engine |
| `engine:error` | `{ scope, error }` | engine |
| `loop:start` | `{ runId, mode }` | loop |
| `loop:pause` | `{ runId }` | loop |
| `loop:resume` | `{ runId }` | loop |
| `loop:stop` | `{ runId, reason }` | loop |
| `tick` | `{ iteration, dt, elapsed }` | loop |
| `roll:start` | `{ rollId, request }` | engine |
| `roll:progress` | `{ rollId, settled, total }` | world |
| `roll:settle` | `{ rollId, result }` — canonical `RollResult` | engine |
| `roll:cancel` | `{ rollId, reason }` | engine |
| `die:spawn` | `{ dieId, index }` | world |
| `die:remove` | `{ dieId }` | world |
| `die:pick` | `{ dieId, point: { x, y, z } }` — world space | input |
| `die:select` | `{ dieId, selected }` | world |
| `enclosure:change` | `{ type, preset }` | world |
| `physics:gravity` | `{ x, y, z }` | world |
| `motion:status` | `{ status, message }` | input |
| `result:present` | `{ values, total, metadata }` | UI presenter |

`roll:settle` is the primary integration point for UI and games. The loop's internal settle signal is not public; the engine produces exactly one `roll:settle` per roll with the same payload shape used by the `roll()` promise.

---

## 17. Data Flow Examples

### Normal roll

```text
PointerInput
  → host.roll({ vectors })
    → engine.roll(request) [async]
    → engine builds ThrowPlan (explicit vectors or generated)
    → engine runs plugin prepareRoll hooks
    → world.spawnDice()
      → physics.createBody() + rendering.createDiceVisual()
    → loop.start(StandardRollStrategy)
      → world.step(dt) → physics.step(dt)
      → world.sync() → visual.setTransform(body)
      → renderer.render()
      → strategy sees world.areDiceSettled()
    → engine builds RollResult and emits roll:settle
    → roll() promise resolves
      → UI banner renders values
      → Yamb app scores the turn
```

### Predetermined roll

```text
engine.roll({ values })
  → engine builds ThrowPlan
  → determinism.prepareRoll(request) [async]
    → world.createPredictionSession({ vectors: plan.vectors, diceStates })
    → spawn dice + step headless
    → FaceReader natural values
    → FaceShifter mappings
    → return { request, faceMappings, diagnostics }
  → engine merges faceMappings into request
  → world.spawnDice() with the same plan and mappings
  → visible roll as normal
  → FaceReader returns requested values
```

### Enclosure switch

```text
UI select change
  → engine.setEnclosure('sphere')
    → world.setEnclosure()
      → old enclosure.dispose()
      → new enclosure.createPhysics(physics, metrics)
      → new enclosure.createVisuals(renderer, metrics)
      → world.resetDice()
      → app rerolls
```

### Yamb reroll

```text
User taps die
  → input pick → host.toggleSelection(dieId)
User presses Roll
  → game calls engine.roll({ keep: engine.world.getSelection() })
    → world removes non-kept dice
    → world spawns replacements with new ids
    → standard loop settles
    → game scores based on returned values
```

### Resize

```text
App ResizeObserver
  → engine.resize()
    → reads container -> ViewportMetrics
    → world.resize(metrics)
      → renderer.resize(metrics)
      → enclosure.update(metrics)
      → camera/lighting update
```

---

## 18. Coordinates, Units, and Time

- Simulation space is right-handed, Z-up, matching the current physics and camera setup.
- Gravity default is `{ x: 0, y: 0, z: -2940 }` in current scene units. This is the authoritative parity value; `-980` in the old `DiceEngine` default is not carried forward.
- Dice mass default is `300` in current units.
- Distances are engine scene units; apps should not assume pixels.
- Quaternions use `{ x, y, z, w }`.
- Time is in seconds at public boundaries; UI may display milliseconds.
- The loop uses a fixed physics step and a render alpha in the future. The initial migration keeps fixed-step behavior to preserve parity.

---

## 19. Extension Points

| Extension | Mechanism | Packages touched |
| :--- | :--- | :--- |
| New die type (D4/D8/D20) | Add a `DieDefinition` with mesh, collision, faces, and mapping; register by id | `@dice/dice`, content presets, demo |
| New enclosure | Implement the `Enclosure` contract; `world.registerEnclosure(id, factory)`; reference by id in content | `@dice/enclosures`, `@dice/world`, content |
| New physics backend | Implement `PhysicsBackend`; select via world/engine backend factory config | `@dice/physics`, `@dice/world` |
| New render backend | Implement `RenderBackend`; select via world/engine backend factory config | `@dice/rendering`, `@dice/world` |
| Three upgrade | Add a modern backend; swap the backend factory | `@dice/rendering` only |
| New input source | Implement `InputSource`; attach to engine | `@dice/input` or app |
| New result UI | Subscriber or presenter on `roll:settle` | `@dice/ui` or app |
| New demo | Add an app folder + registry entry | `apps/demos/*` |
| New game | Add an app with local rules; reuse engine + ui + content | `apps/games/*` |
| Audio | Event-driven audio package later | new `@dice/audio` |
| Persistence | App-level store/localStorage or future service | game app |
| Localization | UI/app-level message catalogs later | `@dice/ui`, apps |

---

## 20. Testing Architecture

| Layer | Test style |
| :--- | :--- |
| `@dice/core` | Node unit tests: EventBus, loop with fake scheduler, RNG repeatability, config merge, metrics. |
| `@dice/physics` | Headless `cannon-es` tests: gravity, collision, materials, body snapshots, containment primitives. |
| `@dice/dice` | Pure geometry/topology tests, face normals, mapping permutations, `FaceReader` quaternion fixtures, golden comparisons against legacy face values. |
| `@dice/enclosures` | Headless containment tests for box/sphere/cylinder; sizing invariants. |
| `@dice/rendering` | Node import-safety test; render smoke fixture in Playwright; backend contract tests with a fake scene; built-asset loader test. |
| `@dice/input` | Gesture math unit tests; Playwright pointer/motion emulation for integration; `InputHost` fake. |
| `@dice/determinism` | Predicted values match settled values with fixed seed; mapping never duplicates/misses labels; live world unchanged. |
| `@dice/world` | Headless world with fake renderer: spawn, settle, partial reroll with stable ids, selection, prediction session isolation, dispose. |
| `@dice/content` | Schema validation, registry resolution, precedence. |
| `@dice/rules` | Table-driven helper tests. |
| `@dice/ui` | happy-dom/jsdom component tests; Playwright for real app interactions. |
| Apps | Playwright smoke + focused interaction tests per app; Yamb full turn/game tests. |

The most important test is **headless world simulation**. If the engine can roll, settle, and score without a browser, the architecture is genuinely decoupled.

Browser tests must account for headless WebGL: configure Chromium with software rendering/ANGLE flags where needed, and test both WebGL success and the graceful "WebGL unavailable" path.

---

## 21. Accessibility and UX Baseline

- Result values announced via `aria-live`.
- Controls are real buttons/inputs/selects with labels.
- Keyboard focus is visible and logical.
- Panel toggles support Escape and restore focus.
- Touch targets are at least 44px on mobile.
- Canvas has an accessible text fallback/status region.
- Motion sensor permission is requested only from a user gesture, with a clear status message.
- Reduced motion preference disables non-essential banner animation.

---

## 22. Performance Baseline

- Fixed physics step with capped sub-steps.
- Reuse geometries and materials across dice; cache by definition/style.
- Avoid cloning geometry on face mapping changes.
- Dispose removed dice and switched enclosures.
- Keep the landing page free of engine bundles.
- Track app bundle sizes in CI once apps exist.
- Profile before adding optimization layers.
