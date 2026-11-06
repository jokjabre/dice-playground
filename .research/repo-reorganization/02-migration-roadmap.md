# Migration Roadmap

This document turns the target architecture into an incremental, always-runnable migration.

The strategy is a **strangler with a frozen legacy tree**:

1. Move the current demo and its dependencies into `legacy/` in one mechanical step.
2. Build the new package/app tree beside it.
3. Port concepts and code deliberately, without dual-maintaining the legacy files.
4. Keep the legacy demo runnable until the new sandbox reaches parity.
5. Delete `legacy/` only at the end.

No phase should require editing `legacy/` after Phase 0. The old tree is a reference and a safety net, not a second codebase.

---

## 1. Guardrails

- Every phase is a separate PR or commit series.
- Every phase leaves the new tree buildable and the legacy demo runnable.
- No package receives "temporary" imports from `legacy/`.
- No phase mixes the Three.js upgrade with the reorganization.
- No phase adds game rules to engine packages.
- Boundary checks are part of CI from the first extracted package.
- A phase is not complete until its exit criteria are met. Do not accumulate half-migrated packages.

---

## 2. Environment and Tooling Baseline

### Prerequisites

- Node 22 LTS (or the current active LTS) with npm.
- A modern evergreen browser for development.
- Playwright browser binaries installed in CI and locally.

The current planning environment has Node but no `npm` on `PATH`; the implementation session must install or expose npm before Phase 0.

### Root tooling

Add:

```text
package.json
package-lock.json
.nvmrc
.editorconfig
.gitignore
eslint.config.js
.dependency-cruiser.cjs
tsconfig.json
vitest.config.js
playwright.config.js
vite.config.js
tools/
├─ build-apps.mjs
├─ vite-app.config.js
└─ check-bundles.mjs        # later, once apps exist
apps/registry.json
docs/
└─ ...
.github/workflows/
├─ ci.yml
└─ pages.yml
```

### Root manifest

The root `package.json` is private, ESM, and owns the toolchain:

```json
{
  "name": "dice-playground",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "workspaces": [
    "packages/*",
    "apps/*",
    "apps/demos/*",
    "apps/games/*"
  ],
  "scripts": {
    "dev": "vite",
    "dev:legacy": "vite --open /legacy/dice/",
    "dev:sandbox": "vite --config apps/sandbox/vite.config.js",
    "build": "node tools/build-apps.mjs",
    "preview": "vite preview",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check": "npm run check:types && npm run lint && npm run check:boundaries",
    "check:types": "tsc -p tsconfig.json",
    "lint": "eslint .",
    "check:boundaries": "depcruise packages apps tools --config .dependency-cruiser.cjs --exclude '^legacy/' --exclude 'dist/'"
  },
  "devDependencies": {
    "@playwright/test": "*",
    "@types/node": "*",
    "dependency-cruiser": "*",
    "eslint": "*",
    "happy-dom": "*",
    "typescript": "*",
    "vite": "*",
    "vitest": "*"
  }
}
```

Pin exact versions in the lockfile; `*` above only means "current at implementation time". Add `cannon-es` as a dependency of `@dice/physics`, not the root.

Workspace packages declare their own dependencies:

```json
{
  "name": "@dice/world",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.js" },
  "dependencies": {
    "@dice/core": "*",
    "@dice/dice": "*",
    "@dice/enclosures": "*",
    "@dice/physics": "*",
    "@dice/rendering": "*"
  }
}
```

Apps declare `@dice/engine`, `@dice/ui`, `@dice/content`, and any plugins they use.

Keep the workspaces list in sync with existing `package.json` files. `apps/*` covers `apps/landing` and `apps/sandbox`; the nested globs cover demos and games. A missing app directory is tolerated by the globs, so Phase 0 does not need placeholder app manifests.

### Type checking

Start with one root config. It checks every package and app, including browser code, so DOM libs are available where they are legitimately needed.

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node", "vite/client"]
  },
  "include": [
    "packages/**/*.js",
    "apps/**/*.js",
    "e2e/**/*.js",
    "tools/**/*.js",
    "tools/**/*.mjs"
  ],
  "exclude": [
    "legacy/**",
    "**/vendor/**",
    "**/node_modules/**",
    "**/dist/**",
    "**/coverage/**",
    "**/playwright-report/**",
    "**/test-results/**"
  ]
}
```

- Add an ambient `types/three-r73.d.ts` declaring the vendored `THREE` global and include it in `tsconfig.json`.
- `check:types` runs `tsc -p tsconfig.json`.
- DOM purity is enforced by ESLint `no-restricted-globals` and the `check:dom` grep gate, not by removing DOM libs.
- Later, once the package tree is stable, split into `tsconfig.node.json` / `tsconfig.browser.json` project references. Keep the `check:types` script name so CI does not change.

This keeps Phase 1 unblocked. A stricter lib split is an optimization, not a prerequisite.

### Test, lint, and boundary scopes

- `vitest.config.js` includes `packages/**/test/**/*.test.js` and `apps/**/test/**/*.test.js`; excludes `e2e/`, `legacy/`, `node_modules/`, `dist/`.
- Playwright uses `testDir: "./e2e"` and never picks up Vitest tests.
- ESLint flat config ignores `legacy/`, `**/vendor/**`, `dist/`, `coverage/`, `playwright-report/`, `test-results/`.
- dependency-cruiser scans `packages`, `apps`, and `tools`, excludes `legacy/`, `vendor/`, and build output.

### Shared app config

`tools/vite-app.config.js` exports a factory for app Vite configs:

- Sets `root` to the app directory, so `index.html` and `/src/main.js` resolve correctly from the repo root.
- Uses the same app-route base in development and production: `${BASE_PATH}${app.url}`. In local development, `BASE_PATH` defaults to `/`, so the sandbox is served at `/apps/sandbox/` and matches the production route shape.
- Each app dev script runs its own Vite server on a distinct port; the dev URL includes that app's route (e.g. `http://localhost:5174/apps/sandbox/`).
- Sets an absolute `build.outDir` under the repository's `dist/<app-url>` and `emptyOutDir: false` (the build script cleans `dist` once).
- Enables source maps in development.
- Adds a `@registry` alias to `apps/registry.json` so the landing app can import it at build time.
- Shares aliases for workspace packages if needed.
- Uses a single `resolve` configuration so every app behaves the same.

### Build orchestration

`tools/build-apps.mjs`:

1. Deletes `dist/` once at the start.
2. Reads and validates `apps/registry.json`.
3. Builds every `live` app into `dist/<url>` with `emptyOutDir: false`.
4. Builds the landing page into `dist/` with `emptyOutDir: false`.
5. Writes a `dist/.nojekyll` file.
6. Fails if a live app has no `index.html` or output.
7. Prints a route summary.

Do not build the landing page with a Vite config that empties `dist/` after the apps exist.

### App registry

`apps/registry.json` is the source of truth for the landing page, build script, and e2e smoke selection:

```json
[
  {
    "id": "sandbox",
    "category": "sandbox",
    "title": "Sandbox",
    "description": "Full multi-mode dice playground.",
    "path": "apps/sandbox",
    "url": "apps/sandbox/",
    "status": "planned"
  },
  {
    "id": "enclosure-gallery",
    "category": "demo",
    "title": "Enclosure Gallery",
    "description": "Box, sphere, and cylinder physics showcase.",
    "path": "apps/demos/enclosure-gallery",
    "url": "apps/demos/enclosure-gallery/",
    "status": "planned"
  },
  {
    "id": "yamb",
    "category": "game",
    "title": "Yamb",
    "description": "Scorecard dice game built on the engine.",
    "path": "apps/games/yamb",
    "url": "apps/games/yamb/",
    "status": "planned"
  }
]
```

`url` is required and is the route relative to the Pages base. `status` is one of `planned`, `wip`, `live`, `archived`. The build script builds `live` entries and validates that every `live` entry has an existing `path`, `url`, and `index.html`. When a phase ships an app, update its status to `live` in the same PR.

---

## 3. Phase Overview

| Phase | Deliverable | Effort | Risk | Depends on |
| :--- | :--- | :--- | :--- | :--- |
| 0 | Freeze legacy + tooling | M | L | — |
| 1 | `@dice/core` | S | L | 0 |
| 2 | `@dice/physics` | M | M | 1 |
| 3 | `@dice/dice` | M | M | 1 |
| 4 | `@dice/rendering` | L | H | 1 |
| 5 | `@dice/enclosures` | M | M | 2, 4 |
| 6 | `@dice/input` + `@dice/determinism` | M | M | 2, 3, 4, 5 |
| 7 | `@dice/world` | L | H | 2–6 |
| 8 | `@dice/engine`, `content`, `rules`, `ui` | M | M | 3, 7 |
| 9 | Enclosure gallery app | M | M | 8 |
| 10 | Sandbox parity | L | H | 9 |
| 11 | Remaining demos + Yamb | L | M | 10 |
| 12 | Legacy deletion + release | S | L | 11 |

Phases 2, 3, and 4 can run in parallel after Phase 1. Phase 6's two packages can run in parallel. Content, rules, and UI can start after Phase 3 while the engine facade waits for Phase 7.

---

## 4. Phase Details

### Phase 0 — Freeze Legacy and Establish Tooling

**Objective:** Make the new tree unambiguous and give the migration a safety net.

**Bootstrap prerequisites:**

- Install or activate Node 22 LTS and npm. The current planning environment has Node but no `npm` on `PATH`; fix that before running Phase 0.
- Confirm the chosen Vite/Vitest/Playwright versions support the selected Node LTS.
- Keep the npm lockfile committed.

**Move legacy set with `git mv`:**

```text
dice/            → legacy/dice/
src/             → legacy/src/
libs/            → legacy/libs/
teal.js          → legacy/teal.js
main.css         → legacy/main.css
readme.txt       → legacy/readme.txt
```

These files move together because they reference each other through relative paths:

- `legacy/dice/index.html` imports `../main.css`, `../src/presentation/...`, `../libs/...`.
- `legacy/dice/main.js` imports `../teal.js`.
- `legacy/dice/dice.js` imports `../src/...`.

Add `legacy/README.md`:

> Frozen pre-reorganization demo. Do not add features. Kept only for parity checks until Phase 12. New work belongs in `packages/` and `apps/`.

**Root files to add:**

- `package.json` with workspaces, scripts, engines, and dev dependencies (see §2).
- `.gitignore` for `node_modules/`, `dist/`, `coverage/`, `.vite/`, `playwright-report/`, `test-results/`.
- `.nvmrc` with Node 22.
- `.editorconfig`.
- `vite.config.js` serving the repository root in development.
- `tsconfig.json` with the full `checkJs` configuration from §2, including `include`/`exclude` and no legacy/vendor scanning.
- ESLint flat config with ignores for `legacy/`, `vendor/`, and build output.
- Dependency Cruiser config with the initial rule set and ignores.
- `vitest.config.js` scoped to unit/component tests.
- `playwright.config.js` with `testDir: "./e2e"`.
- `apps/registry.json` with planned entries and required `url` fields.
- Empty `packages/` and `apps/` directories with `.gitkeep` so boundary/config tools have a valid root.
- `tools/placeholder.js` containing `export {};` so type-check and dependency-cruiser have at least one input in Phase 0. Remove it when the first real package lands.
- `docs/` skeleton and ADR index.
- `.github/workflows/ci.yml` limited to install + legacy smoke until Phase 1; do not run full type/boundary/build gates against an empty tree.
- New root `README.md`.
- Update `.vscode/launch.json` to open `http://localhost:5173/legacy/dice/`.

**Phase 0 CI scope:** there are no packages or apps yet, so `tsc`, `depcruise`, `vitest`, and the app build have no meaningful inputs. The placeholder file plus `--passWithNoTests` keeps the commands runnable; disable the e2e/deploy jobs until Phase 9. A no-op `tools/build-apps.mjs` is acceptable only if it exits successfully when the registry has no live apps.

**Do not** move `_config.yml` yet. It is only the Jekyll theme setting; it does not control the GitHub Pages source. The actual Pages source switch happens with the workflow in Phase 9/12.

**Verification:**

```bash
npm install
npm run dev
# open http://localhost:5173/legacy/dice/
```

- Dice throw, settle, result banner, enclosure switching, camera controls, and motion controls behave as before.
- No console errors caused by the move.
- `git status` shows only the expected move and tooling files.
- Phase 0 CI only smoke-tests the legacy demo; the full check gate starts in Phase 1.

**Accepted side effect:** the published legacy URL moves from `/dice/` to `/legacy/dice/`. No compatibility/redirect is required, per the project decision. The new production apps replace it in Phase 9+.

**Exit criteria:**

- Legacy demo runs through Vite from `legacy/`.
- Root workspace/tooling files exist.
- No new engine code added.
- Old import paths inside `legacy/` are untouched and valid.

---

### Phase 1 — `@dice/core`

**Objective:** Extract all environment-agnostic primitives.

**Port from `legacy/src/core/` and `legacy/src/utils/`:**

```text
packages/core/
├─ src/
│  ├─ events/EventBus.js
│  ├─ events/catalog.js
│  ├─ loop/GameLoop.js
│  ├─ loop/schedulers/ManualScheduler.js
│  ├─ loop/strategies/StandardRollStrategy.js
│  ├─ loop/strategies/ContinuousMotionStrategy.js
│  ├─ loop/strategies/ManualStepStrategy.js
│  ├─ random/RandomSource.js
│  ├─ config/mergeConfig.js
│  ├─ math/vec3.js
│  ├─ math/quat.js
│  ├─ viewport/metrics.js
│  ├─ contracts.js
│  ├─ errors.js
│  └─ index.js
└─ test/
```

**Changes from legacy:**

- Remove all implicit `options` and global RNG usage; inject config and `RandomSource`.
- Split loop strategies into files.
- Add `ManualStepStrategy` and an injectable `Scheduler`; core provides `ManualScheduler`, engine provides the browser scheduler later.
- Add `maxSubSteps` and frame-gap clamping.
- Define event name constants and JSDoc payload types; make `EventBus` generic over the event map.
- Add `createSeededRandom` for tests and demos; define `int` as inclusive and `fork` as independent.
- Move pure vector/quaternion helpers here so dice geometry no longer needs Three's `Vector3`.
- Keep settle checks behind a narrow `WorldContract` (`areDiceSettled`, `getValues`, `getDice`).
- Strategies return `StepResult` (`{ continue, settled }`); they do not emit public `roll:settle`.

**Tests:**

- EventBus subscription, unsubscribe function, once, error isolation.
- GameLoop fixed-step behavior with a fake/manual scheduler; importing core in Node does not touch `requestAnimationFrame`.
- Standard strategy returns settled on a settled world and does not emit.
- Continuous strategy never stops.
- Seeded RNG produces repeatable sequences; `fork` does not advance the parent.
- Config merge precedence and array replacement.
- Metrics math for known aspect ratios and the `ViewportMetrics` shape.

**Boundary checks:**

- No `document`, `window`, `navigator`, `THREE`, or `CANNON` imports.
- `@dice/core` has zero runtime dependencies.

**Exit criteria:**

- Package tests pass.
- `@dice/core/src/index.js` is the only public entry.
- CI runs type check, lint, boundaries, and unit tests for the package.

---

### Phase 2 — `@dice/physics`

**Objective:** Own Cannon behind a strict adapter and eliminate CANNON from every other package.

**Install:** `cannon-es`.

**Create:**

```text
packages/physics/
├─ src/
│  ├─ PhysicsWorld.js
│  ├─ ContactManager.js
│  ├─ BodyHandle.js
│  ├─ shapes.js
│  ├─ config/defaults.js
│  ├─ backends/
│  │  └─ cannon-es/
│  │     ├─ CannonEsBackend.js
│  │     ├─ createShape.js
│  │     └─ toPlain.js
│  └─ index.js
└─ test/
```

**Port from:**

- `legacy/src/physics/PhysicsWorld.js`
- `legacy/src/physics/ContactManager.js`
- `legacy/dice/objects/physics.js` for default gravity, mass, friction, and restitution values.

**Changes from legacy:**

- Replace `CANNON.RigidBody` with `cannon-es` `Body` inside the adapter only. Use the explicit constructor mapping in the architecture doc (`Body`, object-style `ContactMaterial`, `addBody`/`removeBody`, object-style `ConvexPolyhedron`).
- Wrap bodies in `BodyHandle` with copy-returning getters and explicit setters/commands. No live Cannon vectors escape.
- Normalize shapes into descriptors, including cylinder `axis: 'z'` conversion.
- Support named material pairs, runtime friction/restitution updates, material introspection, and solver iteration tuning.
- Add `addPostStep` / `removePostStep` callbacks used by sphere containment.
- Add idempotent `dispose()`.
- Move `world.instance` and all direct CANNON access out of the public API.
- Keep the legacy gravity `{ x: 0, y: 0, z: -2940 }` as the authoritative default; do not carry the `-980` newer default.

**Tests:**

- Gravity changes affect a falling body.
- Static plane collision contains a dropping body.
- Contact material friction/restitution changes are reflected and introspectable.
- Body add/remove, mass/damping updates, snapshots, and dispose.
- Box, sphere, and cylinder shape descriptors produce expected collision behavior, including Z-up cylinder orientation.
- A legacy-vs-cannon-es parity fixture captures drop/settle behavior and tuning constants.
- No live Cannon object is exposed through `BodyHandle`.

**Boundary checks:**

- Only `packages/physics` imports `cannon-es`.
- No Three.js or DOM imports.

**Exit criteria:**

- Physics tests pass headlessly.
- A small Node script can create a world, drop a body, step it, and read its transform.
- No public API leaks Cannon classes.

---

### Phase 3 — `@dice/dice`

**Objective:** Make dice a pure domain package with geometry data, face mapping, and face reading.

**Port from:**

- `legacy/src/dice/GeometryBuilder.js`
- `legacy/src/dice/DiceEntity.js`
- `legacy/src/determinism/FaceReader.js`
- `legacy/src/config/options.js` for die style defaults.

**Create:**

```text
packages/dice/
├─ src/
│  ├─ definitions/D6.js
│  ├─ definitions/registry.js
│  ├─ geometry/chamfer.js
│  ├─ geometry/buildMeshData.js
│  ├─ geometry/buildCollisionData.js
│  ├─ faces/FaceReader.js
│  ├─ faces/faceMapping.js
│  ├─ DiceEntity.js
│  ├─ styles.js
│  └─ index.js
└─ test/
```

**Changes from legacy:**

- Rewrite the chamfer algorithm with `@dice/core` vector math instead of `THREE.Vector3`.
- Output plain `DiceMeshData` and collision descriptors; no `THREE.Geometry`, no `geometry.cannon_shape`.
- Every triangle carries a stable `faceIndex`; chamfer triangles use `faceIndex: -1` and slot `0`.
- Define stable geometric face indices, outward normals, default labels, and a `DiceRegistry` (`register`, `get`, built-in `d6`).
- `createDiceMeshData(definition, { radius })` / `createDiceCollisionData(...)` take the radius/metrics explicitly instead of reading global dimensions.
- Replace `materialIndex` mutation with `faceMapping` permutations; document label-to-slot conversion.
- `FaceReader` reads the top face from the body quaternion and definition normals; it no longer traverses mesh faces.
- `DiceEntity` stores body/visual handles and never imports physics or rendering. IDs are assigned by the world, not the entity.
- Style descriptors are data; texture generation belongs to rendering.

**Tests:**

- D6 vertex/face counts, chamfer topology, and `faceIndex` continuity.
- Every face has a valid outward normal.
- Face mapping is always a complete permutation of `1..6`.
- `FaceReader` returns expected values for known quaternions (identity, 90°, 180° rotations) and matches legacy golden values.
- Face mapping utility produces the requested top value while preserving uniqueness.
- Registry resolves `d6` and rejects unknown ids.
- No DOM, Three, or Cannon imports.

**Exit criteria:**

- Pure domain tests pass in Node.
- The D6 definition can produce mesh data, collision data, and face values without a renderer or physics world.

---

### Phase 4 — `@dice/rendering`

**Objective:** Own Three.js behind an adapter while keeping r73.

**Vendor:**

```text
packages/rendering/vendor/three-r73/three.min.js
```

Copy from `legacy/libs/three.min.js`. Delete `three.min copy.js` as part of cleanup.

**Create:**

```text
packages/rendering/
├─ vendor/three-r73/three.min.js
├─ src/
│  ├─ backends/three-r73/
│  │  ├─ loadThree.js
│  │  ├─ ThreeLegacyBackend.js
│  │  ├─ buildGeometry.js
│  │  └─ buildMaterial.js
│  ├─ RenderScene.js
│  ├─ camera/CameraController.js
│  ├─ lighting/LightingRig.js
│  ├─ geometry/meshData.js
│  ├─ materials/TextureFactory.js
│  ├─ picking/RaycastService.js
│  ├─ config/defaults.js
│  └─ index.js
└─ test/
```

**Port from:**

- `legacy/src/rendering/RenderScene.js`
- `legacy/src/rendering/CameraController.js`
- `legacy/src/rendering/LightingRig.js`
- `legacy/src/dice/TextureGenerator.js`
- The visual parts of `legacy/src/dice/GeometryBuilder.js`
- The raycast parts of `legacy/src/input/RaycastPicker.js`

**Changes from legacy:**

- Load the vendored UMD build once through a dynamically imported backend module using Vite's `?url` asset import, a cached promise, and base-aware emission. No app-level Three script tags.
- Add the internal `RenderBackend` contract.
- `RenderScene` no longer owns a desk. Table/enclosure visuals are composed by the world.
- `MeshFactory` consumes pure `DiceMeshData` including `faceIndex`.
- `TextureFactory` creates label textures from descriptors.
- Material slots follow `faceMapping`; no geometry cloning on mapping changes.
- `RaycastService` returns die ids and world-space points, not meshes.
- Add `setCamera`, `resetCamera`, `resize(metrics)`, and idempotent `dispose()`.
- Keep r73-specific APIs inside `backends/three-r73/`.

**Tests/smoke:**

- A Playwright fixture page mounts a scene, adds a dice mesh, a light, and a camera; renders one frame without console errors.
- Importing `@dice/rendering` in Node does not touch the DOM or load the vendor script until a scene is created.
- The built app loads the hashed vendor asset under the Pages base path; a forced load failure surfaces a readable error.
- Geometry builder produces the expected vertex/face counts and `faceIndex` groups for a D6.
- Material/texture factory creates one chamfer material and six label materials.
- Pick returns the correct die id and world-space point for a known screen point.
- Resize updates renderer and camera aspect; camera set/reset updates projection.
- dispose removes the canvas and listeners.

**Boundary checks:**

- Only `packages/rendering` imports `three` or references the vendored global.
- No Cannon or UI imports.

**Exit criteria:**

- The render smoke fixture passes in Playwright.
- Node import of `@dice/rendering` is safe.
- The built vendor asset loads under a nested base path.
- A future modern backend can be added without touching other packages.

---

### Phase 5 — `@dice/enclosures`

**Objective:** Move boundaries into a composable package and complete the cylinder.

**Create:**

```text
packages/enclosures/
├─ src/
│  ├─ Enclosure.js
│  ├─ BoxEnclosure.js
│  ├─ SphereEnclosure.js
│  ├─ CylinderEnclosure.js
│  ├─ sizing.js
│  ├─ definitions.js
│  └─ index.js
└─ test/
```

**Port from:**

- `legacy/src/enclosures/Enclosure.js`
- `legacy/src/enclosures/BoxEnclosure.js`
- `legacy/src/enclosures/SphereEnclosure.js`
- `legacy/src/enclosures/CylinderEnclosure.js`
- `legacy/src/config/enclosureScale.js`

**Changes from legacy:**

- Enclosures use only core contracts (`PhysicsWorldContract`, `RenderSceneContract`) and the injected handles' public APIs; no direct `THREE`/`CANNON` and no imports of `@dice/physics`/`@dice/rendering`.
- Split physics creation from visual creation.
- Box: floor plane, four walls, optional ceiling, optional tray outline.
- Sphere: tangent-plane approximation plus post-step containment; preserved from current implementation.
- Cylinder: implement real physics instead of the current placeholder — bottom plane/cap plus polygonal wall facets. Keep the visual wireframe/glass shell.
- Sizing functions are pure and shared by physics and visuals.
- `update(metrics)` recomputes bodies and visuals consistently.
- `dispose()` removes bodies, visuals, and post-step callbacks.

**Tests:**

- Each enclosure contains a falling die for a fixed number of headless steps.
- Sphere containment reflects outward radial velocity.
- Cylinder radius/height changes move wall bodies and visuals together.
- Switching enclosures via world leaves no stale bodies or visuals.

**Exit criteria:**

- All three enclosures pass headless containment tests.
- Enclosure package has no backend imports.

---

### Phase 6 — `@dice/input` and `@dice/determinism`

Both packages can proceed in parallel.

#### 6A — `@dice/input`

**Create:**

```text
packages/input/
├─ src/
│  ├─ PointerInput.js
│  ├─ MotionInput.js
│  ├─ RaycastPicker.js
│  ├─ ProgrammaticInput.js
│  ├─ gesture.js
│  └─ index.js
└─ test/
```

**Port from:**

- `legacy/src/input/InputManager.js`
- `legacy/src/input/MotionController.js`
- `legacy/src/input/RaycastPicker.js`

**Changes from legacy:**

- Input sources implement the `InputSource` plugin contract (`attach(host)`/`detach()`).
- Input depends on `@dice/core` contracts only; picking, metrics, spawn profile, selection, and rolling arrive through `InputHost`. It never imports `@dice/rendering`, `@dice/world`, or `@dice/engine`.
- The engine provides an `InputHost` (`roll`, `setGravity`, `applyImpulse`, `getDiceIds`, `getSelection`, `setSelection`, `toggleSelection`, `pick`, `getMetrics`, `getSpawnProfile`, `events`).
- Pointer input emits throw vectors; it does not mutate dice bodies directly.
- Motion input maps orientation to gravity and shake to impulses through `host.setGravity`/`host.applyImpulse`.
- Motion permission is explicit and reported via `motion:status`.
- Raycast picking uses the rendering `PickingService`, not Three directly.
- Remove all debug DOM writes and `middleDiv` references.
- Add `ProgrammaticInput` for tests and demos.
- Clean `attach`/`detach` lifecycle.

**Tests:**

- Gesture distance/boost math for known pointer paths.
- Motion low-pass filter converges and clamps.
- Permission denial produces a status and no listeners.
- Picking maps NDC correctly with a fake picking service.
- `InputHost` fake records roll/gravity/impulse/selection/pick/toggle calls.
- Detach removes every listener.

#### 6B — `@dice/determinism`

**Create:**

```text
packages/determinism/
├─ src/
│  ├─ OutcomePredictor.js
│  ├─ FaceShifter.js
│  ├─ createDeterminismPlugin.js
│  └─ index.js
└─ test/
```

**Port from:**

- `legacy/src/determinism/FaceShifter.js`
- `legacy/src/determinism/OutcomePredictor.js`

**Changes from legacy:**

- Prediction runs in an isolated `PredictionSession` created by `world.createPredictionSession`.
- The plugin provides an async `prepareRoll(request)` that returns `{ request, faceMappings, diagnostics }`.
- Face shifting produces a new mapping; it does not clone or mutate geometry.
- Plugin modes: `predict-and-shift` and `predict-only`.
- Clear error when target values are outside the die's label range.
- Raw natural values are returned for diagnostics and testing.
- The determinism package does not import physics or rendering and does not construct physics worlds itself; the world supplies the isolated prediction session.

**Tests:**

- Predicted values match the settled values for a fixed seed and fixed timestep.
- Live world is unchanged after prediction.
- Mapping always contains each label exactly once.
- `FaceShifter` mapping produces the requested top value (moved here from Phase 3).
- Requested values are returned by `FaceReader` after mapping.
- Invalid targets are rejected with a descriptive error.

**Exit criteria for Phase 6:**

- Input and determinism packages are independent of UI.
- Determinism passes headlessly without rendering.
- Input passes unit tests with a fake `InputHost` and fake picking service.

---

### Phase 7 — `@dice/world`

**Objective:** Compose the runtime and prove the engine can work headlessly.

**Create:**

```text
packages/world/
├─ src/
│  ├─ World.js
│  ├─ DiceFactory.js
│  ├─ DiceSet.js
│  ├─ TableVisual.js
│  ├─ RollState.js
│  ├─ SpawnProfile.js
│  ├─ MeshBodySync.js
│  ├─ Viewport.js
│  ├─ prediction/PredictionSession.js
│  ├─ backends.js              # default physics/render backend factories
│  ├─ config.js
│  └─ index.js
└─ test/
```

**Port concepts from:**

- `legacy/dice/dice.js` (`DiceBox` orchestration)
- `legacy/src/config/dimensions.js`
- `legacy/src/config/spawnProfile.js`
- `legacy/src/dice/DiceFactory.js`
- `legacy/src/rendering/MeshBodySync.js`

**World responsibilities:**

- Create/own physics world, render scene (optional), enclosure, dice set, table visual, and viewport metrics.
- Receive initial `ViewportMetrics` from the engine on `init(viewport)`; never read `clientWidth`/`clientHeight` itself.
- Own default backend factories (`createCannonEsBackend`, `createThreeLegacyBackend`); accept injected backends for tests/headless. This is the only package allowed to construct both.
- Create dice through `DiceFactory`: physics body + rendering visual + `DiceEntity`.
- Assign stable die ids (`die-<worldSeq>-<counter>`) and preserve them for kept dice.
- Spawn profiles and throw plan generation (`createThrowPlan`), using an injected `RandomSource`.
- Roll state, settle detection, selection, `getDice`/`getDiceIds`/`getSelection`.
- Partial reroll support (`keep` stable die ids) for Yamb.
- Face mapping application before a roll.
- Headless mode with a null renderer.
- `createPredictionSession({ vectors, diceStates, enclosure })` that builds an equivalent headless session.
- Resize, reset, dispose.
- `registerEnclosure(id, factory)`, `setCamera`, `setDiceConfig`, `setSettleConfig`, `applyImpulse`, `jostle`.

**Changes from legacy:**

- Remove `DiceBox` god object; world has no scheduler/RAF.
- Remove global `options`, `playingField`, `scene`, `world`, `diceFactory` singletons.
- Remove legacy `diceFactory.dices` mesh array; world exposes `DiceEntity[]`.
- Remove `setTimeout` render hacks.
- Dice selection and held state become first-class; `selected` is the only held model.
- Kept dice retain values, mappings, and stable ids during rerolls.

**Tests:**

- Headless world: spawn 1/6 dice, apply throw vectors, step to settle, read values.
- `createThrowPlan` is repeatable for a fixed seed and records the resolved seed.
- Partial reroll keeps selected dice/ids and replaces the rest.
- Enclosure switch clears dice and rebuilds boundaries.
- Resize updates metrics and enclosure.
- Dispose removes bodies, visuals, listeners.
- World with a fake renderer records expected visual creation/removal.
- Prediction session is isolated and does not affect live dice.
- Stable ids are unique and never reused.
- Backend factories can be replaced with fakes for headless tests.

**Exit criteria:**

- A Node-only test can run a complete roll and return values.
- The world has no direct DOM access.
- The world is the only package that composes physics, rendering, dice, enclosure, table visuals, and lighting into one simulation.

---

### Phase 8 — Engine Facade, Content, Rules, and UI

These can be split into four sub-phases and parallelized after Phase 7 (content/rules can start earlier).

#### 8A — `@dice/engine`

**Create:**

```text
packages/engine/
├─ src/
│  ├─ DiceEngine.js
│  ├─ PluginRegistry.js
│  ├─ scheduler/BrowserScheduler.js
│  ├─ createDiceEngine.js
│  ├─ config.js
│  └─ index.js
└─ test/
```

**Responsibilities:**

- Async factory because the rendering backend may load the vendored Three script.
- Own event bus, browser scheduler, game loop, world, and plugin registry.
- `roll` returns `Promise<RollResult>`; `simulate` runs an isolated headless one-shot.
- `cancelRoll`, `clear`, `reset`, `setMode`, `setEnclosure`, `setCamera`, `setDiceConfig`, `setSettleConfig`, `setLoopConfig`, `start/pause/resume/stop`, `resize`, `destroy`.
- Attach/detach plugins; await async `prepareRoll` hooks.
- Emit exactly one public `roll:settle` per roll with the canonical payload.
- No UI or game rules.

**Tests:**

- Create headless engine and simulate a roll in Node; it uses `ManualScheduler` and never touches RAF.
- Browser engine with a container uses `BrowserScheduler`.
- `roll()` resolves with `RollResult`; `cancelRoll` rejects it.
- Plugin attach/detach and async `prepareRoll`/`afterRoll` hooks.
- Determinism plugin mappings reach the world spawn request.
- Lifecycle start/pause/resume/stop.
- Destroy is idempotent.
- Engine does not import `@dice/ui`, `@dice/input`, or `@dice/determinism`.
- Node import smoke test for the engine package.

#### 8B — `@dice/content`

**Create:**

```text
packages/content/
├─ src/
│  ├─ defineContentPack.js
│  ├─ validateContentPack.js
│  ├─ resolveContent.js
│  ├─ registries.js
│  ├─ presets/
│  │  ├─ tables.js
│  │  ├─ dice.js
│  │  ├─ enclosures.js
│  │  └─ scenarios.js
│  └─ index.js
└─ test/
```

**Responsibilities:**

- `defineContentPack(pack)` freezes/normalizes data.
- `validateContentPack(pack, registries)` returns `{ ok, errors }` with paths.
- `resolveContent(pack, { diceRegistry, enclosureRegistry, styleRegistry, appOverrides })` merges defaults and returns concrete ids/values.
- Content stays free of physics/rendering imports; registries are supplied by the world/app.
- Built-in packs reference ids from `@dice/enclosures`, `@dice/dice`, and physics presets; they do not duplicate definitions.

**Tests:**

- Validation rejects missing ids, bad enclosure types, unknown dice/styles, and invalid dice counts.
- Resolution merges defaults < content < app overrides and validates against injected registries.
- Presets are JSON-serializable and frozen.
- Built-in packs cover box/sphere/cylinder and classic/dark styles.

#### 8C — `@dice/rules`

**Create:**

```text
packages/rules/
├─ src/
│  ├─ sum.js
│  ├─ counts.js
│  ├─ combinations.js
│  ├─ keepPlan.js
│  └─ index.js
└─ test/
```

**Tests:**

- Sum/count helpers.
- N-of-a-kind, full house, straights.
- Keep-plan validation.
- No imports beyond `@dice/core`.

#### 8D — `@dice/ui`

**Create:**

```text
packages/ui/
├─ src/
│  ├─ dom/createElement.js
│  ├─ presenters/ResultBanner.js
│  ├─ presenters/SilentPresenter.js
│  ├─ presenters/CustomPresenter.js
│  ├─ controls/ControlPanel.js
│  ├─ hud/Toolbar.js
│  ├─ hud/Panel.js
│  ├─ hud/Status.js
│  ├─ styles/
│  │  ├─ base.css
│  │  ├─ controls.css
│  │  ├─ banner.css
│  │  └─ theme.css
│  └─ index.js
└─ test/
```

**Port from:**

- `legacy/src/presentation/ResultPresenter.js`
- `legacy/src/presentation/ResultPresenter.css`
- `legacy/teal.js` for the few DOM helpers worth keeping (no RPC or legacy extras).
- The toolbar/panel CSS currently embedded in `legacy/dice/index.html`.

**Changes from legacy:**

- Presenters subscribe to an event bus; no engine instance required.
- Controls are schema-driven (`ControlItem`) and emit `change` events.
- Package exposes `"./styles/*"` as a documented subpath.
- No `innerHTML` with dynamic strings.
- Accessibility attributes and test ids are built in.
- UI package imports only `@dice/core` types/constants.

**Tests:**

- happy-dom component tests for banner present/hide/clear.
- Control panel schema, change events, setValue/setDisabled, and teardown.
- Escape/focus behavior for the panel.
- Styles import through the documented `@dice/ui/styles/*` subpath.
- No engine/runtime imports.

**Exit criteria for Phase 8:**

- A headless integration test creates an engine, rolls, and receives results.
- A DOM integration test mounts a banner and control panel against a fake event bus.
- No app exists yet, but the public API is stable enough to build one.

---

### Phase 9 — Enclosure Gallery App

**Objective:** Ship the first targeted demo and prove the app template, build, and deployment.

**Create:**

```text
apps/landing/
apps/demos/enclosure-gallery/
├─ index.html
├─ vite.config.js
├─ package.json
├─ src/
│  ├─ main.js
│  ├─ app.js
│  ├─ content.js
│  └─ styles.css
└─ README.md
```

**Gallery features:**

- Box / sphere / cylinder selector.
- Throw button and drag-to-throw.
- Result banner.
- Gravity direction/slider.
- Camera distance and reset.
- Physics/enclosure info panel.
- Clear/reset.
- Responsive layout and mobile touch.
- Graceful WebGL failure message.

**Also add:**

- `apps/landing` importing the registry through the shared `@registry` alias, with a card for every app and status badge.
- `tools/build-apps.mjs` with a single `dist/` clean, `emptyOutDir: false` sub-builds, and landing built last.
- `apps/*/vite.config.js` using the shared config; the factory sets `root` and a per-app base like `/dice-playground/apps/demos/enclosure-gallery/`.
- Playwright e2e for gallery: load, switch enclosure, throw, result appears, resize.
- GitHub Pages workflow with the required permissions/actions, initially deploying landing + gallery; switch the repository Pages source to GitHub Actions.
- Registry entries for landing and gallery set to `live` in the same PR.

**Exit criteria:**

- `npm run build` produces `dist/index.html` and `dist/apps/demos/enclosure-gallery/index.html` without one build erasing another.
- The gallery works on the project-site base path, including the hashed Three vendor asset.
- `vite preview` of the built `dist/` serves nested apps correctly.
- No deep imports; implementation imports only public package entries.
- E2E passes in CI.

---

### Phase 10 — Sandbox Parity

**Objective:** Rebuild the existing multi-mode demo on the new architecture.

**Create:**

```text
apps/sandbox/
├─ index.html
├─ vite.config.js
├─ package.json
├─ src/
│  ├─ main.js
│  ├─ app.js
│  ├─ modes.js
│  ├─ content.js
│  └─ styles.css
└─ README.md
```

**Parity checklist:**

- [ ] Six D6 dice by default.
- [ ] Drag/flick throw on mouse and touch.
- [ ] Standard roll settles and displays values.
- [ ] Continuous mode never auto-stops.
- [ ] Motion sensor enable/disable with status and permission handling.
- [ ] Predetermined roll values (e.g. `6,6,6`).
- [ ] Enclosure switching: box, sphere, cylinder.
- [ ] Camera distance, near, far, reset.
- [ ] Clear/reset.
- [ ] Initial roll on load.
- [ ] Responsive resize.
- [ ] No console errors on desktop or mobile viewport.
- [ ] No regression in dice containment/settling behavior.

**Comparison process:**

1. Run legacy at `/legacy/dice/` and sandbox at `/apps/sandbox/` side by side.
2. Walk the checklist.
3. Record intentional differences (e.g., new UI layout, fixed cylinder physics).
4. Fix regressions before marking the phase complete.

**Exit criteria:**

- Checklist complete.
- Playwright smoke test for each mode.
- The new sandbox is the primary demo; legacy is no longer needed for coverage.

---

### Phase 11 — Remaining Demos and Yamb

Build these after sandbox parity. They can be parallelized.

#### 11A — Physics lab

- Gravity vector controls.
- Friction/restitution per surface.
- Linear/angular damping.
- Die mass.
- Fixed timestep / settle threshold.
- Live body count and simple performance readout.
- Reset to defaults.

#### 11B — Predetermined roll showcase

- Per-die target values.
- Predict-only mode showing natural results.
- Predict-and-shift mode showing applied mapping.
- Explanation panel.
- Edge cases: invalid targets, fewer targets than dice.
- Uses `@dice/determinism`.

#### 11C — Dice visual lab

- Chamfer factor, radius, label color, body color, material options.
- Face mapping preview.
- Future home for polyhedral dice.
- Uses pure dice data + rendering.

#### 11D — Yamb

See [03-apps-and-games.md](03-apps-and-games.md) for the full game plan.

Before implementing scoring, expand ADR-015 from the planning decision log into `docs/adr/ADR-015-yamb-variant.md`. It must fix the variant: dice count (Yamb normally uses five), columns, category formulas, bonuses, and announcement timing/penalties. The app ships only against that confirmed variant.

Deliver in slices:

1. Rules ADR + scoring fixtures.
2. Game shell and scorecard layout.
3. Turn state, five dice, three rolls, keep/reroll.
4. Scoring categories and totals.
5. Column rules and announcement rules for the confirmed variant.
6. Local hot-seat players.
7. Persistence and polish.

**Exit criteria for Phase 11:**

- All four demos and Yamb are live in the registry.
- Each has an e2e smoke test.
- Yamb scoring and turn transitions have unit tests aligned with the rules ADR.
- No game rules leaked into engine packages.

---

### Phase 12 — Cleanup and Release

**Delete:**

```text
legacy/
_config.yml                  # Jekyll config no longer used after Pages source switch
```

Do not list root `readme.txt` here: it moved to `legacy/readme.txt` in Phase 0 and is deleted with the legacy tree.

**Remove:**

- Any remaining compatibility references to `legacy/` or old `src/`.
- Unused root CSS and duplicate library files.
- Old migration notes that no longer apply.
- Dead scripts/aliases from `package.json`.

**Update:**

- Root `README.md` with quick start, scripts, app links, and architecture overview.
- `docs/` with final architecture, guides, and ADRs.
- `.vscode/launch.json` with app dev URLs.
- `.research/modular_engine_plan.md` header noting it is superseded (or leave historical with a pointer).
- `apps/registry.json` statuses to `live`.

**Final audit:**

```bash
npm run check
npm test
npm run build
npm run test:e2e
```

Boundary greps:

```bash
# Three must only appear in rendering
rg "THREE\\.|three-r73" packages --glob '!packages/rendering/**'

# Cannon must only appear in physics
rg "cannon-es|CANNON\\." packages --glob '!packages/physics/**'

# DOM must not appear in pure packages
rg "document\\.|window\\.|navigator\\." \
  packages/core packages/physics packages/dice packages/enclosures \
  packages/determinism packages/content packages/rules packages/world

# No legacy references in shipped code
rg "legacy/" packages apps tools .github

# Node import safety for claimed packages
node -e "await import('@dice/core'); await import('@dice/physics'); await import('@dice/dice'); await import('@dice/enclosures'); await import('@dice/content'); await import('@dice/rules'); await import('@dice/world'); await import('@dice/engine');"
```

**Tag:** `reorg/complete`.

**Exit criteria:**

- Definition of Done in the plan README is fully satisfied.
- GitHub Pages deployment is green.
- Legacy URL is intentionally gone; no redirect required.

---

## 5. Compatibility Strategy

### The old demo

- Moved to `legacy/` in Phase 0.
- Served by Vite at `/legacy/dice/` during development.
- Never modified after Phase 0.
- Not part of the production build after Phase 9.
- Deleted in Phase 12.

Because the relative paths among `dice/`, `src/`, `libs/`, `teal.js`, and `main.css` are preserved by moving the whole set, the demo keeps working without shims.

### New packages

- New packages are written fresh using legacy as a reference.
- Do not import from `legacy/`.
- Do not dual-maintain old and new files.
- Where a file is barely changed, port it and adapt imports; otherwise rewrite it to fit the new contracts.

### What is intentionally not preserved

- The `/dice/` production URL.
- Global script tags for Three and Cannon.
- `teal.js` RPC stubs and unused helpers.
- `window.engineApp`/`dice_initialize` legacy APIs.
- The singleton `scene`, `world`, `diceFactory`, `playingField`, `options`, and `rndGen` objects.
- `CANNON`/`THREE` classes in public APIs.

---

## 6. Test Strategy by Phase

| Phase | Minimum automated coverage | Manual check |
| :--- | :--- | :--- |
| 0 | Tooling starts; placeholder check | Legacy demo roll |
| 1 | Core unit tests | — |
| 2 | Headless physics tests | — |
| 3 | Pure dice/face tests | — |
| 4 | Render smoke fixture | Visual sanity |
| 5 | Enclosure containment | Visual sanity |
| 6 | Input/determinism unit tests | — |
| 7 | Headless world tests | Optional visual harness |
| 8 | Engine/content/rules/ui tests | — |
| 9 | Gallery e2e | Mobile viewport |
| 10 | Sandbox mode e2e | Side-by-side legacy |
| 11 | Per-app e2e + Yamb rules | Full Yamb game |
| 12 | Full suite + boundary audit | Pages smoke |

### E2E determinism

- Use seeded RNG (`?seed=` or test API) for roll tests.
- Prefer `expect.poll` on result elements over fixed sleeps.
- Do not pixel-compare WebGL canvas frames.
- Keep one screenshot smoke for static UI layout, not physics.
- Expose `window.__diceApp` only in development/test builds for `page.evaluate` control.

### CI jobs

1. **Check:** install, `npm run check` (types, lint, boundaries).
2. **Unit:** `npm test`.
3. **Build:** `npm run build`.
4. **E2E:** build, install Playwright Chromium with software WebGL flags, `npm run test:e2e`.
5. **Deploy:** on `main`, after checks, upload `dist/` and deploy Pages.

Before Phase 9 there are no e2e specs or live apps; keep the e2e/deploy jobs disabled or seed placeholder smoke tests so CI does not fail on empty inputs. Enable the full jobs when the enclosure gallery lands.

Cache npm and Playwright browsers where possible.

### GitHub Pages workflow

The Pages workflow must include:

```yaml
permissions:
  contents: read
  pages: write
  id-token: write

env:
  BASE_PATH: /dice-playground/

environment:
  name: github-pages
  url: ${{ steps.deployment.outputs.page_url }}

steps:
  - actions/checkout
  - actions/setup-node
  - npm ci
  - npm run build          # uses BASE_PATH from env
  - actions/configure-pages
  - actions/upload-pages-artifact   # path: dist
  - actions/deploy-pages
```

The landing Vite config sets its base to `${BASE_PATH}` (not `/`), and every app config sets base to `${BASE_PATH}${app.url}`. `vite preview` must use the same base/config in preview mode so the project-site path is tested locally.

Also switch the repository's **Settings → Pages → Source** to "GitHub Actions". `_config.yml` does not do that; it only configures the old Jekyll theme. Keep the old source until the workflow has been tested, then switch and remove `_config.yml` in Phase 12.

---

## 7. Dependency and Boundary Checks

`dependency-cruiser` rules to add incrementally:

Allowed package matrix (enforced by rules and package `exports`):

| From | May import (workspace) | May import (external) |
| :--- | :--- | :--- |
| `core` | — | — |
| `physics` | core | `cannon-es` |
| `rendering` | core | vendored Three |
| `dice` | core | — |
| `enclosures` | core | — |
| `input` | core | DOM APIs |
| `determinism` | core, dice | — |
| `world` | core, physics, rendering, dice, enclosures | — |
| `content` | core, dice | — |
| `rules` | core | — |
| `ui` | core | DOM APIs |
| `engine` | core, world, content | browser APIs |
| apps | public package entries | app-local deps |

```js
// Shape, not final syntax.
forbidden: [
  {
    name: 'three-only-in-rendering',
    from: { pathNot: '^packages/rendering/' },
    to: { path: '^packages/rendering/vendor/three-r73/' }
  },
  {
    name: 'no-npm-three',
    from: {},
    to: { path: 'node_modules/three' }
  },
  {
    name: 'cannon-only-in-physics',
    from: { pathNot: '^packages/physics/' },
    to: { path: 'node_modules/cannon-es' }
  },
  {
    name: 'core-has-no-workspace-deps',
    from: { path: '^packages/core/' },
    to: { path: '^packages/(?!core/)' }
  },
  {
    name: 'physics-rendering-dice-core-only',
    from: { path: '^packages/(physics|rendering|dice)/' },
    to: { path: '^packages/(?!core/)' }
  },
  {
    name: 'content-core-dice-only',
    from: { path: '^packages/content/' },
    to: { path: '^packages/(?!core/|dice/)' }
  },
  {
    name: 'rules-core-only',
    from: { path: '^packages/rules/' },
    to: { path: '^packages/(?!core/)' }
  },
  {
    name: 'enclosures-allowed-only',
    from: { path: '^packages/enclosures/' },
    to: { path: '^packages/(?!core/)' }
  },
  {
    name: 'ui-core-only',
    from: { path: '^packages/ui/' },
    to: { path: '^packages/(?!core/)' }
  },
  {
    name: 'engine-imports-only-allowed',
    from: { path: '^packages/engine/' },
    to: { path: '^packages/(physics|rendering|dice|enclosures|input|determinism|ui)/' }
  },
  {
    name: 'world-imports-only-allowed',
    from: { path: '^packages/world/' },
    to: { path: '^packages/(content|input|determinism|ui|engine)/' }
  },
  {
    name: 'input-imports-only-allowed',
    from: { path: '^packages/input/' },
    to: { path: '^packages/(physics|rendering|dice|enclosures|determinism|world|engine|ui|content)/' }
  },
  {
    name: 'determinism-imports-only-allowed',
    from: { path: '^packages/determinism/' },
    to: { path: '^packages/(physics|rendering|enclosures|input|world|engine|ui|content)/' }
  },
  {
    name: 'ui-does-not-import-runtime',
    from: { path: '^packages/ui/' },
    to: { path: '^packages/(world|engine|physics|rendering|input|determinism)/' }
  },
  {
    name: 'content-rules-ui-are-leaves',
    from: { path: '^packages/(content|rules|ui)/' },
    to: { path: '^packages/(world|engine)/' }
  },
  {
    name: 'apps-no-deep-imports',
    from: { path: '^apps/' },
    to: { path: '^packages/[^/]+/src/' }
  },
  {
    name: 'no-legacy-imports',
    from: { path: '^(packages|apps)/' },
    to: { path: '^legacy/' }
  },
  {
    name: 'no-circular',
    from: {},
    to: { circular: true }
  }
]
```

Package-to-package deep imports are additionally prevented by each package's `exports` field. Add per-package `pathNot` rules if dependency-cruiser needs to catch a specific case.

ESLint overrides:

```js
// Shape, not final syntax.
{
  files: ['packages/{core,physics,dice,enclosures,determinism,content,rules,world}/**/*.js'],
  rules: {
    'no-restricted-globals': [
      'error',
      { name: 'document', message: 'Pure packages must not access the DOM.' },
      { name: 'window', message: 'Pure packages must not access the DOM.' },
      { name: 'navigator', message: 'Pure packages must not access the DOM.' }
    ]
  }
}
```

Separate override for backend globals:

```js
// Shape, not final syntax.
{
  files: ['packages/**/*.js', 'apps/**/*.js'],
  ignores: ['packages/rendering/**', 'packages/physics/**'],
  rules: {
    'no-restricted-globals': [
      'error',
      { name: 'THREE', message: 'Only @dice/rendering may touch Three.js.' },
      { name: 'CANNON', message: 'Only @dice/physics may touch Cannon.' }
    ]
  }
}
```

---

## 8. Risks and Mitigations

| # | Risk | Impact | Mitigation | Phase |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Vendored Three r73 UMD does not load cleanly under Vite | High | Dedicated `loadThree.js` script injection, one-time global, render smoke fixture in Playwright. Fallback: app-level script tag isolated to rendering, documented as temporary. | 4 |
| 2 | `cannon-es` behavior differs from bundled Cannon | High | Port tuning constants exactly, add headless parity tests (drop, settle, containment), compare visual behavior. Keep constants centralized in content presets. | 2 |
| 3 | Predetermined roll prediction mutates live world | High | Use isolated `PredictionSession`; test that live transforms are unchanged after prediction. | 6 |
| 4 | Legacy demo breaks during Phase 0 move | Medium | Move the complete relative-path set together; smoke test immediately; adjust `.vscode` and Vite config only. | 0 |
| 5 | Package boundaries erode | Medium | Dependency Cruiser + ESLint + package exports; review every new cross-package import. | 1–12 |
| 6 | Over-splitting creates package overhead | Medium | Review at Phase 7; merge packages that have no independent reason to change (e.g., if enclosures remain tiny). | 7 |
| 7 | E2E physics tests are flaky | Medium | Seeded RNG, fixed timestep, headless unit tests for physics, UI assertions only for app e2e. | 9–11 |
| 8 | GitHub Pages base path breaks nested app assets | High | Per-app base (`/dice-playground/<app-url>/`), load Three via a Vite `?url` asset from a dynamically imported backend, build with `emptyOutDir: false`, test `dist/` under `vite preview`. | 9 |
| 9 | Motion sensor permissions differ on iOS | Medium | Request only from a user gesture, show status, provide pointer fallback, test on a real device before marking sandbox parity. | 10 |
| 10 | Yamb scope expands into a rules framework | Medium | Keep Yamb scoring in the app; only generic helpers enter `@dice/rules`; write the variant ADR before Phase 11. | 11 |
| 11 | JSDoc type checking becomes noisy | Low | Enable `checkJs` for packages first, then apps. Use precise typedefs and `unknown` at boundaries; do not use blanket `any`. | 1–8 |
| 12 | Duplicate code lives during migration | Low | Legacy is frozen; no dual maintenance; phases port and then delete. | 1–11 |
| 13 | App bundles accidentally include the landing page | Low | One Vite build per app; landing imports only its own code; bundle checks later. | 9 |
| 14 | Face mapping breaks on modern Three upgrade | Low | Mapping is logical and renderer-agnostic; both r73 and future backend consume the same data. | 3–4 |
| 15 | Landing build erases app output | High | Clean `dist` once; every sub-build uses `emptyOutDir: false`; verify routes after build. | 9 |
| 16 | Async determinism preparation races the visible roll | High | `engine.roll` awaits all `prepareRoll` hooks; tests assert mappings arrive before spawn. | 6–8 |
| 17 | No legal composition root for backends | High | `@dice/world` owns default backend factories and accepts injected fakes; engine constructs only the world. | 7 |
| 18 | Headless packages accidentally import DOM | High | Lazy Three loader, Node import smoke tests, ESLint restricted globals, dependency-cruiser. | 1–8 |
| 19 | Yamb rules remain undefined | High | Write the Yamb rules ADR with scoring fixtures before implementing the game. | 11 |
| 20 | CI test runners collide | Medium | Vitest include/exclude, Playwright `testDir: e2e`, ESLint/tsc/depcruise ignores for legacy/vendor/dist. | 0 |

---

## 9. Rollback Plan

- Tag the repository at the start: `reorg/baseline`.
- Tag every phase: `reorg/phase-0`, `reorg/phase-1`, …
- Each phase is a separate merge. Reverting one phase does not affect the frozen legacy demo.
- Do not delete `legacy/` until the final phase and after tagging `reorg/parity`.
- Do not switch GitHub Pages to the new build until the enclosure gallery and landing page pass e2e. Keep the old `_config.yml` until then.
- If the Three r73 backend proves unworkable, the escape hatch is an app-level vendored script tag behind the rendering package, with the upgrade planned immediately after. This is a fallback, not the default.

---

## 10. Phase Completion Checklist Template

Before marking any phase complete:

- [ ] Public package entry exists and exports only the intended API.
- [ ] Unit tests cover the new contracts.
- [ ] `npm run check` passes.
- [ ] `npm test` passes.
- [ ] No forbidden imports (`three`, `cannon-es`, DOM, `legacy/`).
- [ ] No circular dependencies.
- [ ] Package README documents its responsibility and public API.
- [ ] Legacy demo still runs if this phase precedes Phase 12.
- [ ] Phase tag created.
- [ ] Next phase dependencies are unblocked.

---

## 11. Post-Reorganization Roadmap

After Phase 12, the architecture is ready for:

1. **Modern Three backend** — add `backends/three-modern/` and switch the factory.
2. **Rapier backend** — implement `PhysicsBackend`, keep the public world API unchanged.
3. **Polyhedral dice** — add definitions and geometry data; update the visual lab.
4. **Audio package** — event-driven clacks, rolls, and UI sounds.
5. **More games** — Yahtzee-like variants, Liar's Dice, D&D roller, each as an app.
6. **Persistence and profiles** — app-level storage, optional shared service.
7. **Networked play** — later, after local hot-seat games are solid.
8. **Server-side scoring** — headless world and rules make this possible without a browser.
