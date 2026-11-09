# Architecture Decision Records

This is the decision log for the reorganization. Each entry records the context, the decision, alternatives considered, and consequences. Future work should add new ADRs rather than silently changing these.

---

## ADR-001 — Use an npm Workspaces Monorepo

**Context:** The repository currently mixes a working legacy demo, a partially extracted engine under `src/`, and multiple concerns in single files. Future demos and games need to consume the engine without reaching into internals.

**Decision:** Use npm workspaces with `packages/*` for engine libraries and `apps/*` for experiences. Each package declares its workspace dependencies and exposes a primary public entry plus any documented subpaths.

**Alternatives:**

- Simple top-level folders with relative imports. Simpler, but boundaries are convention-only.
- A single package with subpath exports. Less overhead, but weaker isolation and harder to enforce backend boundaries.

**Consequences:**

- Cross-package imports are explicit and checkable.
- Boundaries can be enforced by `dependency-cruiser` and package `exports`.
- Each package declares its own `dependencies` with workspace versions (`"*"`); apps declare the packages they consume.
- Slightly more setup and more `package.json` files.
- Packages can later be published or private without restructuring.

---

## ADR-002 — JavaScript + JSDoc, Enforced by `tsc --checkJs`

**Context:** The codebase is JavaScript. A full TypeScript rewrite would add risk to an already large structural migration. At the same time, contracts between packages need to be explicit.

**Decision:** Keep JavaScript and document contracts with JSDoc. Enable `checkJs` with a single root `tsconfig.json` checked by `tsc -p tsconfig.json` in CI, starting with packages and extending to apps. Split into project references later if needed.

**Alternatives:**

- Full TypeScript now. Strongest contracts, but a second large migration.
- Plain JavaScript without type checking. Fastest, weakest long-term maintainability.

**Consequences:**

- Contracts are visible in editors and checked in CI without a rewrite.
- JSDoc typedefs must be maintained carefully.
- The root `tsconfig` uses `module: "ESNext"`, `moduleResolution: "bundler"`, and explicit include/exclude for legacy/vendor/build output.
- DOM types are available repo-wide at first; purity is enforced by ESLint globals and the `check:dom` gate. A later project-reference split can make the type-level separation strict.
- A future TypeScript migration remains possible, package by package.

---

## ADR-003 — Vite + npm Dependencies

**Context:** The current demo uses vendored UMD scripts and plain ES modules with no build step. Future apps need multiple pages, testability, and a modern dev server. `cannon-es` and future Three upgrades are ESM packages.

**Decision:** Use Vite for development and multi-app builds, npm for dependencies, and npm workspaces for package linking.

**Alternatives:**

- Zero-build with vendored scripts. Keeps today's simplicity but blocks testing, modern dependencies, and multi-app builds.
- Vite with vendored globals. Adds build tooling without solving dependency management.

**Consequences:**

- npm and Node become required developer prerequisites.
- Vite resolves workspace imports and app entry points.
- Production builds are generated into `dist/` for GitHub Pages.
- The legacy demo is served through Vite during migration, even though it remains a static-style app.

---

## ADR-004 — Migrate Cannon to `cannon-es` Behind a Strict Physics Adapter

**Context:** The bundled Cannon build is old, uses `RigidBody` aliases, and leaks `CANNON` objects into scene and dice code. Future physics work (better enclosure shapes, prediction isolation, a possible Rapier swap) needs a stable boundary.

**Decision:** Use maintained `cannon-es` as the first backend. Only `@dice/physics` imports it. All other packages use `PhysicsWorld`, `BodyHandle`, shape descriptors, and plain vectors.

**Alternatives:**

- Keep the bundled Cannon build. Lowest immediate risk, but keeps the leak and blocks backend changes.
- Migrate to Rapier now. Better performance and modern engineering, but a separate large migration with different tuning.

**Consequences:**

- Physics behavior may change slightly; tuning must be verified with tests.
- A future Rapier backend can be added behind the same public API.
- Prediction can use isolated physics sessions instead of mutating the live world.
- No `CANNON` class leaves the physics package.

---

## ADR-005 — Defer the Three.js Upgrade; Vendored r73 Behind a Render Adapter

**Context:** The project uses Three.js r73 from 2015. Modern Three removes `THREE.Geometry`, `THREE.MeshFaceMaterial`, `CanvasRenderer`, and old shadow APIs. Upgrading now would combine two large projects: repository reorganization and renderer modernization.

**Decision:** Keep Three r73 vendored in `packages/rendering/vendor/three-r73/`. Isolate it behind a `RenderBackend` adapter. Design pure mesh/material data so a modern backend can be added later without touching dice or world code.

**Alternatives:**

- Upgrade immediately. Better long-term stack, but high risk and mixed concerns.
- Keep r73 globally. Simpler, but leaks Three everywhere and blocks the upgrade.

**Consequences:**

- The old demo continues to render identically in the new engine architecture.
- App HTML must not include Three script tags; the rendering package loads the vendor build lazily via a Vite `?url` asset from a dynamically imported backend module.
- Importing `@dice/rendering` in Node must not touch the DOM or load Three until a scene is created.
- The upgrade becomes a contained rendering-package project later.
- Some legacy code paths (desk special case, geometry cloning) are removed during migration rather than preserved.

---

## ADR-006 — Separate World Runtime from Content

**Context:** The user wants both an assembled simulation runtime and a game-content layer; a demo is itself a kind of game.

**Decision:**

- `@dice/world` is one live simulation instance: physics, rendering, dice, enclosure, dimensions, roll state. It is the composition root that constructs or accepts physics/render backends.
- `@dice/content` is declarative, serializable definitions used to construct worlds: tables, dice sets, enclosures, physics tuning, scenarios.
- Apps combine both and may add local content.

**Alternatives:**

- Content inside the world. Simpler, but mixes runtime state with definitions.
- Content only inside apps. Fewer shared presets, but no reusable content layer.
- One large "game framework". Too broad for the current needs.

**Consequences:**

- Worlds can be built from presets, JSON, or app-local content.
- Content can later load from files or a server without engine changes.
- The world remains stateful; content remains data.
- Apps own routes, scorecards, and game rules.

---

## ADR-007 — Event-Driven, Framework-Agnostic UI

**Context:** Current UI code is entangled with scene singletons, DOM IDs, and debug writes. Future apps may use different UI approaches.

**Decision:** The engine exposes events and commands. `@dice/ui` provides vanilla DOM presenters, controls, and styles. UI never imports world internals. Apps may add a framework later, but the engine does not depend on one.

**Alternatives:**

- React for all apps. Strong ecosystem, heavier dependency and a framework decision for every demo.
- Svelte for all apps. Light runtime, still a global framework choice.
- UI inside `@dice/engine`. Convenient, but couples presentation to lifecycle.

**Consequences:**

- `roll:settle` and other events are the integration contract.
- UI can be replaced without touching the engine.
- Result banners and controls can be shared across apps.
- Apps that want a framework can adopt one locally.

---

## ADR-008 — Make Determinism Optional

**Context:** Predetermined rolls and face shifting are valuable but unusual. Not every demo or game needs prediction, and it adds complexity to the engine core.

**Decision:** Put outcome prediction and face shifting in `@dice/determinism` as an optional plugin. The engine works normally without it. The plugin uses an isolated physics session and logical face mappings.

**Alternatives:**

- Put determinism in the engine core. Simpler access, but couples optional behavior to every app.
- Keep it only in the sandbox. Loses reuse and testability.
- Remove it. Drops a distinctive capability.

**Consequences:**

- Headless and standard apps do not pay for determinism code.
- Prediction can be tested independently.
- The plugin exposes async `prepareRoll`; `engine.roll()` awaits it before spawning the visible dice.
- The live world is never mutated during prediction.
- `@dice/world` owns the isolated `PredictionSession` because it knows the enclosure and dice state.
- Face mapping is renderer-agnostic and survives the Three upgrade.

---

## ADR-009 — Freeze Legacy, Build the New Tree Alongside, Delete at Parity

**Context:** The current demo works and is the only end-to-end validation of many behaviors. A big-bang move would make regressions hard to isolate.

**Decision:** Move the complete legacy set into `legacy/` in Phase 0, preserve its relative imports, and keep it runnable. Build new packages and apps beside it. Do not edit legacy after Phase 0. Delete `legacy/` after sandbox parity and final cleanup.

**Alternatives:**

- Big-bang restructure. Faster to a single tree, higher risk.
- Compatibility shims for every old module. Preserves module imports but creates long-term dual maintenance.
- Keep legacy forever. Avoids deletion risk but leaves two architectures.

**Consequences:**

- Every migration phase has a working reference demo.
- Some code is duplicated temporarily. This is intentional and time-boxed.
- `/dice/` production URL is not preserved; no redirect is required.
- Cleanup is explicit and final.

---

## ADR-010 — Build Content as Serializable Data

**Context:** Presets, table styles, dice sets, and scenarios should be reusable across sandbox, demos, and games.

**Decision:** Content packs are plain, JSON-compatible objects validated at the boundary. Built-in packs live in `@dice/content`; apps can define local packs. Content references definitions by id.

**Alternatives:**

- Content as runtime classes. More powerful, harder to serialize and validate.
- Content only in app code. No shared presets.
- A full scene-graph/level framework. Too heavy for dice experiences.

**Consequences:**

- Presets can later load from JSON or a server.
- Validation must be explicit and produce useful errors.
- Content cannot hold engine instances or DOM nodes.
- App-local content remains the escape hatch for one-off experiences.

---

## ADR-011 — Keep Game Rules in Game Apps

**Context:** Yamb scoring is specific. Other future games will have different rules. Putting rules in the engine would make every game inherit one game's assumptions.

**Decision:** `@dice/rules` contains only generic dice helpers (sum, counts, combinations, keep plans). Yamb scoring, columns, announcements, turns, and scorecards live in `apps/games/yamb`.

**Alternatives:**

- A shared rules engine for all games. Only worth it after multiple games share a model.
- Rules in the engine core. Couples physics to game logic.
- No shared helpers. Duplicates simple combination logic.

**Consequences:**

- Engine packages remain game-agnostic.
- Yamb rules are testable in isolation.
- Shared helpers can grow only when proven by multiple games.
- A future tabletop rules framework would be a new package, not a rewrite of core.

---

## ADR-012 — Deploy Multiple Apps to GitHub Pages

**Context:** The repository already targets GitHub Pages. Future demos and games need discoverable URLs.

**Decision:** Build every app under `dist/apps/<category>/<id>/`, build a registry-driven landing page at `dist/index.html`, and deploy the whole `dist/` directory with a GitHub Actions Pages workflow.

**Alternatives:**

- Publish only the sandbox. Simpler, but hides demos and games.
- One giant SPA with routes. Heavier landing bundle and more coupling between apps.
- Local-only. No shareable demos.

**Consequences:**

- Each app is isolated and independently buildable.
- The landing page is fast and engine-free.
- Each app uses its full route as Vite `base`, e.g. `/dice-playground/apps/demos/enclosure-gallery/`; a single root base would break nested assets.
- The build script cleans `dist` once and uses `emptyOutDir: false` for every sub-build so the landing build cannot erase apps.
- The workflow needs `pages: write`/`id-token: write`, `actions/configure-pages`, and a repository Pages-source switch to GitHub Actions.
- The old Jekyll `_config.yml` is removed once the workflow is live.

---

## ADR-013 — Facade First, Public Subpaths Allowed

**Context:** Apps need a stable entry point, but advanced demos may need direct access to physics, rendering, or determinism.

**Decision:** Apps import `@dice/engine`, `@dice/ui`, and `@dice/content` by default. Documented public subpaths (for example `@dice/determinism` as a plugin) are allowed. Deep imports into `@dice/*/src/**` are forbidden.

**Alternatives:**

- Facade only. Cleanest, but limits advanced demos.
- Direct package imports everywhere. More flexible, weaker public API discipline.

**Consequences:**

- The common path is simple and stable.
- Advanced use cases remain possible without exposing internals.
- Package `exports` and dependency checks enforce the rule.
- Public subpaths must be documented and tested.

---

## ADR-014 — Organize Apps as `sandbox`, `demos`, and `games`

**Context:** The user wants the current experience classified as a sandbox, plus targeted demos and real mini-games.

**Decision:**

- `apps/sandbox` — full playground.
- `apps/demos/*` — focused subsystem showcases.
- `apps/games/*` — playable rule-driven games.
- `apps/landing` — app directory.

**Alternatives:**

- Flat `apps/*`. Simpler paths, but category is implicit.
- Top-level `demos/` and `games/` outside `apps/`. Less consistent workspace layout.

**Consequences:**

- Categories are visible in the tree and registry.
- Build and deployment paths mirror the categories.
- New apps have an obvious home.
- The first targeted demo is the enclosure gallery, followed by sandbox parity, then remaining demos and Yamb.

---

## ADR-015 — Yamb Uses a Confirmed Variant, Not an Implicit Rules Set

**Context:** Yamb has multiple regional variants for columns, category formulas, bonuses, and announcement rules. The engine must not bake in assumptions, and the app cannot be "playable" without a fixed rules contract.

**Decision:** Write `docs/adr/ADR-015-yamb-variant.md` before Phase 11. It fixes:

- Dice count (Yamb standard is five D6).
- Columns and fill order.
- Category list and exact scoring formulas.
- Bonus thresholds and applicability.
- Announcement timing, eligibility, and penalty.
- Tie-breaking and winner rules.
- Player count and turn order.

Scoring fixtures are derived from that ADR. Yamb-specific rules stay in `apps/games/yamb`; only generic helpers go to `@dice/rules`.

**Alternatives:**

- Implement a "common" variant from memory. Fast, but likely wrong and untestable.
- Build a general tabletop rules framework first. Too broad and delays the first game.
- Skip Yamb. Contradicts the goal of a first real game.

**Consequences:**

- Phase 11 is explicitly blocked until the variant ADR exists.
- The scorecard data model is driven by the confirmed columns/categories.
- Engine capabilities (five dice, stable ids, partial reroll, selection) are defined independently of Yamb scoring.
- Future Yamb variants can be additional profiles or a later app.
