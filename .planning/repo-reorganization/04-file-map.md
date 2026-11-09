# Current → Target File Map

This document maps every existing file to its target home or deletion. It is a guide for porting, not an instruction to mechanically move files. The legacy tree stays frozen in `legacy/` during migration; new packages are written fresh against the target contracts.

---

## 1. Legacy Move Set (Phase 0)

These paths move together into `legacy/`, preserving relative imports:

| Current | Legacy destination | Notes |
| :--- | :--- | :--- |
| `dice/` | `legacy/dice/` | Demo shell, legacy `DiceBox`, object adapters, CSS. |
| `src/` | `legacy/src/` | Current partially modular engine, used by the legacy demo. |
| `libs/` | `legacy/libs/` | Vendored Three r73 and old Cannon. |
| `teal.js` | `legacy/teal.js` | Legacy DOM helper. |
| `main.css` | `legacy/main.css` | Legacy global styles. |
| `readme.txt` | `legacy/readme.txt` | Stale; deleted with legacy. |

Keep the root `_config.yml` until the Pages workflow replaces it.

After the move, `legacy/dice/index.html` still resolves:

- `../main.css` → `legacy/main.css`
- `../src/...` → `legacy/src/...`
- `../libs/...` → `legacy/libs/...`

`legacy/dice/main.js` still resolves `../teal.js` → `legacy/teal.js`.

---

## 2. Engine Source Map

### 2.1 Core

| Current | Target | Notes |
| :--- | :--- | :--- |
| `src/core/EventBus.js` | `packages/core/src/events/EventBus.js` | Add once/off/error isolation, event catalog. |
| `src/core/GameLoop.js` | `packages/core/src/loop/GameLoop.js` | Remove world/strategy coupling; inject clock; add max sub-steps. |
| `src/core/GameLoop.js` (`StandardRollStrategy`) | `packages/core/src/loop/strategies/StandardRollStrategy.js` | Use narrow `WorldContract`. |
| `src/core/GameLoop.js` (`ContinuousMotionStrategy`) | `packages/core/src/loop/strategies/ContinuousMotionStrategy.js` | Keep behavior. |
| — | `packages/core/src/loop/schedulers/ManualScheduler.js` | No RAF; headless/tests. |
| — | `packages/core/src/loop/strategies/ManualStepStrategy.js` | New: headless/tests. |
| `src/utils/rndGen.js` | `packages/core/src/random/RandomSource.js` | No global singleton; seeded variant. |
| `src/config/options.js` (merge/default concept) | `packages/core/src/config/mergeConfig.js` | Split domain-specific defaults out. |
| `src/config/dimensions.js` (pure math) | `packages/core/src/viewport/metrics.js` | No DOM reads. |
| `src/core/DiceEngine.js` (shared event/config types) | `packages/core/src/contracts.js` | Lifecycle implementation moves to `@dice/engine`; see 2.9. |

### 2.2 Physics

| Current | Target | Notes |
| :--- | :--- | :--- |
| `src/physics/PhysicsWorld.js` | `packages/physics/src/PhysicsWorld.js` | Backend-neutral; no `world.instance`. |
| — | `packages/physics/src/backends/cannon-es/CannonEsBackend.js` | Cannon imports stay inside `packages/physics`. |
| — | `packages/physics/src/backends/cannon-es/createShape.js` | Descriptor → Cannon shape. |
| `src/physics/ContactManager.js` | `packages/physics/src/ContactManager.js` | Named material pairs; runtime updates. |
| `src/physics/PhysicsWorld.js` (body wrappers) | `packages/physics/src/BodyHandle.js` | Plain vectors/transforms. |
| `dice/objects/physics.js` | `packages/physics/src/config/defaults.js` | Gravity, mass, friction, restitution defaults. |
| `src/enclosures/SphereEnclosure.js` (containment callback) | `packages/physics/src/PhysicsWorld.js` (`addPostStep`) | Generic post-step hook. |

### 2.3 Rendering

| Current | Target | Notes |
| :--- | :--- | :--- |
| `src/rendering/RenderScene.js` | `packages/rendering/src/RenderScene.js` | Generic scene only; no desk. |
| `src/rendering/CameraController.js` | `packages/rendering/src/camera/CameraController.js` | Metrics-driven; no global options. |
| `src/rendering/LightingRig.js` | `packages/rendering/src/lighting/LightingRig.js` | Config-driven. |
| `src/dice/GeometryBuilder.js` (Three mesh creation) | `packages/rendering/src/backends/three-r73/buildGeometry.js` | Consumes pure `DiceMeshData`. |
| `src/dice/TextureGenerator.js` | `packages/rendering/src/materials/TextureFactory.js` | Canvas/texture creation belongs here. |
| `src/input/RaycastPicker.js` (raycast part) | `packages/rendering/src/picking/RaycastService.js` | Returns die ids, not meshes. |
| `libs/three.min.js` | `packages/rendering/vendor/three-r73/three.min.js` | Vendored behind adapter. |
| `libs/three.min copy.js` | — | Delete duplicate. |
| `libs/cannon.min.js` | — | Replaced by `cannon-es` dependency. |

### 2.4 Dice Domain

| Current | Target | Notes |
| :--- | :--- | :--- |
| `src/dice/GeometryBuilder.js` (chamfer math) | `packages/dice/src/geometry/chamfer.js` | Rewrite with core vector math. |
| `src/dice/GeometryBuilder.js` (mesh data) | `packages/dice/src/geometry/buildMeshData.js` | Pure vertices/faces/normals/UVs. |
| `src/dice/GeometryBuilder.js` (`cannon_shape`) | `packages/dice/src/geometry/buildCollisionData.js` | Collision descriptor, not a Cannon shape. |
| — | `packages/dice/src/definitions/D6.js` | Stable D6 definition. |
| — | `packages/dice/src/definitions/registry.js` | Dice definition registry and id lookup. |
| `src/dice/DiceEntity.js` | `packages/dice/src/DiceEntity.js` | Handles only; no Three/Cannon imports. |
| `src/determinism/FaceReader.js` | `packages/dice/src/faces/FaceReader.js` | Quaternion + face normals; no mesh traversal. |
| — | `packages/dice/src/faces/faceMapping.js` | Mapping utilities and permutation validation. |
| `src/config/options.js` (dice colors/style) | `packages/dice/src/styles.js` + `packages/content/src/presets/dice.js` | Style descriptors as data. |
| `src/dice/DiceFactory.js` | `packages/world/src/DiceFactory.js` | Composition needs physics + rendering. |

### 2.5 Enclosures

| Current | Target | Notes |
| :--- | :--- | :--- |
| `src/enclosures/Enclosure.js` | `packages/enclosures/src/Enclosure.js` | Split physics/visual lifecycle. |
| `src/enclosures/BoxEnclosure.js` | `packages/enclosures/src/BoxEnclosure.js` | Use public physics/rendering APIs. |
| `src/enclosures/SphereEnclosure.js` | `packages/enclosures/src/SphereEnclosure.js` | Preserve plane lattice + containment. |
| `src/enclosures/CylinderEnclosure.js` | `packages/enclosures/src/CylinderEnclosure.js` | Implement real wall/bottom physics. |
| `src/config/enclosureScale.js` | `packages/enclosures/src/sizing.js` | Pure metrics-based sizing. |
| — | `packages/enclosures/src/definitions.js` | Built-in enclosure ids/definitions. |

### 2.6 Input

| Current | Target | Notes |
| :--- | :--- | :--- |
| `src/input/InputManager.js` | `packages/input/src/PointerInput.js` | Plugin lifecycle; no body mutation. |
| `src/input/MotionController.js` | `packages/input/src/MotionInput.js` | Permission/status; public world API. |
| `src/input/RaycastPicker.js` (input part) | `packages/input/src/RaycastPicker.js` | Uses rendering picking service. |
| — | `packages/input/src/ProgrammaticInput.js` | Tests/demos. |
| — | `packages/input/src/gesture.js` | Pure gesture math. |

### 2.7 Determinism

| Current | Target | Notes |
| :--- | :--- | :--- |
| `src/determinism/FaceShifter.js` | `packages/determinism/src/FaceShifter.js` | Returns mappings; no geometry clone. |
| `src/determinism/OutcomePredictor.js` | `packages/determinism/src/OutcomePredictor.js` | Uses isolated physics session. |
| — | `packages/determinism/src/createDeterminismPlugin.js` | Engine plugin. |

### 2.8 World

| Current | Target | Notes |
| :--- | :--- | :--- |
| `dice/dice.js` (`DiceBox` concepts) | `packages/world/src/World.js` | Split orchestration, roll state, sync. |
| `dice/dice.js` (settle/check logic) | `packages/world/src/RollState.js` + core strategy | World exposes settle state; strategy decides. |
| `src/config/dimensions.js` (DOM/re-init) | `packages/world/src/Viewport.js` | Pure metrics cache; DOM reads live in the engine/app shell. |
| `src/config/spawnProfile.js` | `packages/world/src/SpawnProfile.js` | Injected RNG and metrics. |
| `src/rendering/MeshBodySync.js` | `packages/world/src/MeshBodySync.js` | Body→visual sync. |
| `dice/objects/world.js` (composition concept) | `packages/world/src/World.js` | No singleton/legacy objects map. |
| `dice/objects/diceFactory.js` | `packages/world/src/DiceFactory.js` | Creates entity + body + visual. |
| — | `packages/world/src/TableVisual.js` | Table/floor visual from content. |
| — | `packages/world/src/DiceSet.js` | Selection, held state, partial reroll. |
| — | `packages/world/src/prediction/PredictionSession.js` | Isolated headless session owned by the world. |
| — | `packages/world/src/backends.js` | Default physics/render backend factories. |

### 2.9 Engine Facade

| Current | Target | Notes |
| :--- | :--- | :--- |
| `src/core/DiceEngine.js` | `packages/engine/src/DiceEngine.js` | Lifecycle, plugins, loop, events. |
| `src/index.js` | `packages/engine/src/index.js` | Stable public exports; no global singleton exports. |
| — | `packages/engine/src/PluginRegistry.js` | Plugin lifecycle. |
| — | `packages/engine/src/scheduler/BrowserScheduler.js` | Browser RAF/performance adapter. |
| — | `packages/engine/src/createDiceEngine.js` | Async factory. |
| `dice/main.js` (`dice_initialize` concept) | App bootstrap files | No legacy global function. |

### 2.10 Config, Content, Rules, UI

| Current | Target | Notes |
| :--- | :--- | :--- |
| `src/config/options.js` | Split across `core/config`, `physics/config`, `rendering/config`, `dice/styles`, `content/presets` | No global mutable `options`. |
| `src/config/spawnProfile.js` | `packages/world/src/SpawnProfile.js` | Runtime concern. |
| `src/config/enclosureScale.js` | `packages/enclosures/src/sizing.js` | Pure. |
| — | `packages/content/src/defineContentPack.js` | Content schema. |
| — | `packages/content/src/presets/*` | Tables, dice, enclosures, scenarios. |
| — | `packages/rules/src/*` | Generic result helpers. |
| `src/presentation/ResultPresenter.js` | `packages/ui/src/presenters/*` | Event-driven presenters. |
| `src/presentation/ResultPresenter.css` | `packages/ui/src/styles/banner.css` | Themed via CSS variables. |
| `teal.js` | `packages/ui/src/dom/createElement.js` (only useful helpers) | RPC, cloning, and unused helpers dropped. |
| `main.css` | `packages/ui/src/styles/base.css` + app styles | Global selectors removed. |
| `dice/dice.css` | `apps/sandbox/src/styles.css` + `packages/ui/src/styles/*` | Split app layout from reusable UI. |
| `dice/index.html` (toolbar CSS) | `packages/ui/src/styles/controls.css` + sandbox styles | HUD styling moves to UI package/app. |
| `dice/objects/settingsRenderer.js` | — | Debug DOM panel not carried over. |

### 2.11 Apps

| Current | Target | Notes |
| :--- | :--- | :--- |
| `dice/index.html` | `apps/sandbox/index.html` | Rewritten, no global scripts. |
| `dice/main.js` | `apps/sandbox/src/main.js` + `app.js` | Rewritten composition. |
| `dice/dice.js` | `legacy` only | Concepts ported to World. |
| `dice/objects/scene.js` | `packages/rendering` + `packages/world` concepts | Old singleton/desk wrapper not carried over. |
| `dice/objects/world.js` | `packages/world/src/World.js` concept | No singleton or legacy objects map. |
| `dice/objects/diceFactory.js` | `packages/world/src/DiceFactory.js` concept | Composition needs physics + rendering. |
| `dice/objects/geometry.js` | `packages/dice` + `packages/world` concepts | Split pure geometry from spawn vectors. |
| `dice/objects/physics.js` | `packages/physics/src/config/defaults.js` | Tuning constants. |
| `dice/objects/options.js` | — | Legacy re-export shim; deleted with legacy. |
| `dice/objects/playingField.js` | — | Legacy re-export shim; deleted with legacy. |
| `dice/objects/rndGen.js` | — | Legacy re-export shim; deleted with legacy. |
| `dice/objects/settingsRenderer.js` | — | Debug DOM panel not carried over. |
| `dice/dice.css` | `apps/sandbox/src/styles.css` + `packages/ui/src/styles/*` | Split app layout from reusable UI. |
| Demo toolbar controls | `apps/sandbox/src/app.js` + `@dice/ui` | Schema-driven controls. |
| Current mode logic | `apps/sandbox/src/modes.js` | Standard/continuous/predetermined. |
| Current enclosure selector | `apps/sandbox/src/app.js` | Uses `engine.setEnclosure`. |
| Current camera controls | `apps/sandbox/src/app.js` + rendering config | Public engine/world API. |
| — | `apps/demos/enclosure-gallery/` | First targeted demo. |
| — | `apps/demos/physics-lab/` | Focused physics demo. |
| — | `apps/demos/predetermined-roll/` | Determinism showcase. |
| — | `apps/demos/dice-visual-lab/` | Dice/geometry showcase. |
| — | `apps/games/yamb/` | First game. |
| — | `apps/landing/` | Registry-driven app directory. |

---

## 3. Root and Tooling Map

| Current | Target | Notes |
| :--- | :--- | :--- |
| `_config.yml` | — | Removed when Pages workflow takes over. |
| `readme.txt` | `README.md` (new root) + `legacy/readme.txt` until cleanup | New README with quick start, scripts, app links, architecture; stale text archived with legacy. |
| `main.css` | `legacy/main.css`, then `packages/ui` styles | Do not carry global selectors forward. |
| `teal.js` | `packages/ui/src/dom/` (partial) | Drop RPC and legacy utilities. |
| `libs/three.min.js` | `packages/rendering/vendor/three-r73/three.min.js` | Adapter-only. |
| `libs/three.min copy.js` | — | Delete duplicate. |
| `libs/cannon.min.js` | — | Replace with `cannon-es` npm dependency. |
| `.vscode/launch.json` | Updated launch configs | Legacy at `/legacy/dice/`, apps at their dev URLs. |
| `.planning/modular_engine_plan.md` | Keep as historical | Mark superseded in a later docs pass. |
| `.planning/repo-reorganization/*` | New plan docs | This plan set. |
| — | `package.json` | Workspaces, scripts. |
| — | `package-lock.json` | npm lockfile. |
| — | `.nvmrc` | Node 22 LTS. |
| — | `.editorconfig` | Shared formatting. |
| — | `.gitignore` | `node_modules/`, `dist/`, coverage, Playwright output. |
| — | `eslint.config.js` | Lint + restricted globals. |
| — | `.dependency-cruiser.cjs` | Package boundaries. |
| — | `tsconfig.json` | `checkJs`, no emit. |
| — | `vitest.config.js` | Unit/component tests. |
| — | `playwright.config.js` | E2E. |
| — | `vite.config.js` | Root dev server for legacy. |
| — | `tools/vite-app.config.js` | Shared app Vite config. |
| — | `tools/build-apps.mjs` | Registry-driven build. |
| — | `apps/registry.json` | App metadata. |
| — | `.github/workflows/ci.yml` | Check, unit, build, e2e. |
| — | `.github/workflows/pages.yml` | GitHub Pages deploy. |
| — | `docs/` | Architecture, guides, ADRs. |

---

## 4. Delete List (Phase 12)

Delete with the legacy tree:

```text
legacy/
  ├─ dice/
  ├─ src/
  ├─ libs/
  ├─ teal.js
  ├─ main.css
  └─ readme.txt
```

Delete separately:

```text
_config.yml
```

Do not port:

- `teal.js` RPC and unused DOM helpers.
- `dice/objects/settingsRenderer.js` debug panel.
- `dice/objects/options.js`, `playingField.js`, `rndGen.js` re-export shims.
- Global singleton adapters (`scene`, `world`, `diceFactory`, `playingField`, `options`, `rndGen`).
- `world.objects` legacy material/body map.
- `renderScene.desk` special-case floor.
- `DiceBox` god object and its `setTimeout` render hacks.
- `dice_initialize()` and `$t.roll()` legacy APIs.
- URL parameters `chromakey`, `shadows`, and `color` unless reintroduced deliberately as app content/debug options.
- `libs/three.min copy.js`.
- `libs/cannon.min.js` after `cannon-es` migration.

Keep as historical:

- `.planning/modular_engine_plan.md` with a superseded note.
- `.planning/repo-reorganization/*` as the current plan.

---

## 5. Naming Conventions

- Package names: `@dice/<domain>`; apps: `@dice/app-<id>`.
- Public entry: primary `src/index.js`, plus only documented subpaths such as `@dice/ui/styles/*`.
- Event names: `domain:action` (`roll:settle`, `die:pick`).
- Shapes/descriptors: `*Descriptor` or `*Data` (`DiceMeshData`, `CollisionShapeDescriptor`).
- Runtime handles: `*Handle` (`BodyHandle`, `VisualHandle`).
- Contracts: JSDoc typedefs in `contracts.js`, named `*Contract` where a runtime interface is implied.
- Content ids: kebab-case (`classic-tray`, `predetermined-six`).
- App routes: kebab-case directories (`enclosure-gallery`, `dice-visual-lab`).
- Tests: `<subject>.test.js`; e2e: `<app>.spec.js`.

---

## 6. Quick "Where Does This Go?" Guide

| New thing | Home |
| :--- | :--- |
| Math helper used by geometry and loop | `@dice/core` |
| Cannon shape/material work | `@dice/physics` |
| Three geometry/material/texture work | `@dice/rendering` |
| New die definition | `@dice/dice` |
| New boundary/container | `@dice/enclosures` |
| New gesture/sensor | `@dice/input` |
| Prediction/face-mapping logic | `@dice/determinism` |
| Wiring physics + rendering + dice | `@dice/world` |
| Lifecycle/plugin/event facade | `@dice/engine` |
| Shared preset/table/dice content | `@dice/content` |
| Generic sum/straight/N-of-a-kind helper | `@dice/rules` |
| Shared button/banner/panel | `@dice/ui` |
| Yamb scoring, turns, scorecard | `apps/games/yamb` |
| Demo layout/copy/theme | The demo app |
| Build/deploy config | `tools/`, `.github/workflows/` |
| Investigation or migration plan | `.planning/` |
| Stable architecture/guide | `docs/` |
