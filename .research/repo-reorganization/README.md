# Repository Reorganization Plan

**Status:** Proposed — planning only, no code moved yet
**Date:** 2026-11-06
**Scope:** Restructure the entire repository into a decoupled engine + content + apps layout, with room for focused demos and real games.
**Supersedes:** `.research/modular_engine_plan.md` (kept as historical implementation record)

---

## 1. Goal

Turn this repository from a working dice demo with a partially extracted engine into a small, coherent engine platform:

- Independent packages for engine, physics, rendering, dice, enclosures, input, determinism, world runtime, content, rules, UI, and the public facade.
- Apps that are pure compositions of those packages: a sandbox, focused demos, and eventually playable games such as Yamb.
- Clear dependency direction, enforced by tooling, so sections cannot silently re-couple.
- A migration path that keeps the existing demo available until the new sandbox reaches parity.
- Extension points for new die types, new physics/render backends, new demos, and new games.

The target is not "more folders". The target is **one reason to change per package**, and **apps as customers of a stable engine API**.

---

## 2. Decisions Already Made

| Area | Decision |
| :--- | :--- |
| Deliverable | Plan documents only for now. Implementation begins in later sessions. |
| Repository shape | npm workspaces monorepo: `packages/*` + `apps/*`. |
| Build tooling | Vite + npm dependencies. |
| Language | JavaScript + JSDoc, with `tsc --checkJs` enforcement in CI. |
| Three.js | Defer the modern upgrade. Keep vendored Three r73 behind a rendering adapter. |
| Physics | Migrate to maintained `cannon-es` now, behind a strict physics adapter. |
| World | Two layers: `@dice/world` (live simulation runtime) and `@dice/content` (declarative game/world content). |
| UI | Framework-agnostic engine; vanilla DOM UI package; apps may add frameworks later. |
| Legacy code | Freeze in `legacy/`, keep runnable during migration, delete after parity. No `/dice/` URL compatibility requirement. |
| Migration style | Incremental strangler: build the new tree beside the frozen legacy tree, one phase at a time. |
| Quality | Vitest unit tests, Playwright e2e tests, GitHub Actions CI. |
| Deployment | GitHub Pages, multi-app build with a landing page. |
| Game rules | Game-specific rules live in each game app; generic dice helpers live in `@dice/rules`. |
| Determinism | Optional `@dice/determinism` package for predetermined rolls and face mapping. |
| First targeted demo | Enclosure gallery (box / sphere / cylinder). |
| Documentation | Plans and investigations in `.research/`; stable architecture and guides in `docs/`. |
| Package scope | `@dice/*`. |
| App layout | `apps/sandbox`, `apps/demos/*`, `apps/games/*`, `apps/landing`. |
| Content | Shared `@dice/content` presets + local content inside each app. |
| Physics isolation | Strict: only `@dice/physics` may import `cannon-es`. |
| Render isolation | Strict: only `@dice/rendering` may import Three.js. |
| Public API | Facade first: apps import `@dice/engine`, `@dice/ui`, `@dice/content`; documented public subpaths allowed for advanced demos. |

---

## 3. Guiding Principles

1. **The core knows nothing about the browser.** `@dice/core` must run in Node and in tests without DOM, Three.js, or Cannon.
2. **Backends are replaceable.** Only `@dice/physics` knows `cannon-es`; only `@dice/rendering` knows Three.js. Everything else uses engine-level contracts.
3. **UI is a subscriber.** The engine emits events and exposes commands. UI never reaches into physics, bodies, meshes, or internal mutable state.
4. **Content is data.** Presets and scenarios are serializable descriptors. Apps and users can provide new content without editing engine packages.
5. **World is composition.** `@dice/world` is the only layer that composes physics, rendering, dice, enclosures, table visuals, and lighting into one simulation. Enclosure implementations may use the physics and rendering public APIs, but they never wire dice, tables, or app UI.
6. **Apps are experiences, not architecture.** A demo or game should be replaceable without touching engine packages.
7. **No global singletons.** No module-level mutable `options`, `scene`, `world`, `rng`, or DOM lookups. Dependencies are injected.
8. **One primary public entry per package.** Packages may expose documented subpaths (for example styles or a plugin entry), but apps cannot deep-import `src/` files.
9. **Test the boundaries.** Pure domain logic is tested without a browser. Visual apps get a small number of focused e2e tests.
10. **Incremental and always runnable.** Each phase leaves the legacy demo working and the new tree testable.

---

## 4. Target Tree

```text
dice-playground/
├─ packages/
│  ├─ core/                  # @dice/core — events, loop, clock, RNG, math, contracts
│  ├─ physics/               # @dice/physics — cannon-es backend, bodies, materials
│  ├─ rendering/             # @dice/rendering — Three r73 backend, scene, meshes, picking
│  ├─ dice/                  # @dice/dice — die definitions, pure geometry, entities, face reading
│  ├─ enclosures/            # @dice/enclosures — box, sphere, cylinder
│  ├─ input/                 # @dice/input — pointer, motion sensors, raycast picking
│  ├─ determinism/           # @dice/determinism — outcome prediction, face mapping
│  ├─ world/                 # @dice/world — live simulation composition
│  ├─ content/               # @dice/content — presets, scenarios, validation
│  ├─ rules/                 # @dice/rules — generic dice result helpers
│  ├─ ui/                    # @dice/ui — DOM presenters, HUD controls, styles
│  └─ engine/                # @dice/engine — public facade, lifecycle, plugins
├─ apps/
│  ├─ landing/               # app directory / showcase
│  ├─ sandbox/               # full multi-mode playground
│  ├─ demos/
│  │  ├─ enclosure-gallery/  # first targeted demo
│  │  ├─ physics-lab/
│  │  ├─ predetermined-roll/
│  │  └─ dice-visual-lab/
│  └─ games/
│     └─ yamb/               # first real game
├─ tools/                    # shared Vite, build, registry and check scripts
├─ docs/                     # stable architecture docs, guides, ADRs
├─ .research/                # plans, investigations, migration tracking
├─ .github/workflows/        # CI and GitHub Pages deployment
├─ legacy/                   # frozen old demo + old src, deleted after parity
├─ package.json              # workspaces + scripts
├─ tsconfig.json             # checkJs configuration
├─ vite.config.js            # shared dev config
└─ README.md
```

The legacy tree is moved into `legacy/` in Phase 0, preserving the relative paths between `dice/`, `src/`, `libs/`, `teal.js`, and `main.css`. This makes the new tree unambiguous while keeping the old demo runnable at `/legacy/dice/`.

---

## 5. Layer Model

```text
┌──────────────────────────────────────────────────────────────────┐
│ Apps: landing, sandbox, demos, games                             │
│ Compose engine + UI + content; own routing, DOM shell, game flow │
└───────────────────────┬──────────────────────────┬───────────────┘
                        │                          │
                @dice/engine                 @dice/ui
              (facade, lifecycle,          (DOM, presenters,
               loop, plugins)               HUD, styles)
                        │
┌───────────────────────▼──────────────────────────────────────────┐
│ @dice/world — one live simulation:                              │
│ physics + rendering + dice + enclosure + dimensions + rolls      │
└───────┬──────────────┬──────────────┬──────────────┬─────────────┘
        │              │              │              │
 @dice/physics  @dice/rendering  @dice/dice   @dice/enclosures
        │              │              │              │
        └──────────────┴──────────────┴──────────────┘
                        │
                   @dice/core

Supporting: @dice/input, @dice/determinism, @dice/content, @dice/rules
```

Rules of the graph:

- `@dice/core` depends on nothing.
- `@dice/physics` and `@dice/rendering` depend on `@dice/core`.
- `@dice/dice` is a pure domain package and may depend only on `@dice/core`.
- `@dice/enclosures` depends on `@dice/core` contracts only; it receives `PhysicsWorld`/`RenderScene` handles and calls their public APIs.
- `@dice/input` depends on `@dice/core` contracts only; picking, metrics, selection, and rolling are injected through the engine's `InputHost`.
- `@dice/determinism` depends on `@dice/core` and `@dice/dice`; it obtains the isolated prediction session from `engine.world` (captured in `attach`).
- `@dice/world` is the composition layer and may use `@dice/core`, `@dice/physics`, `@dice/rendering`, `@dice/dice`, and `@dice/enclosures`.
- `@dice/content`, `@dice/rules`, and `@dice/ui` are leaf consumers; they never import `@dice/world` or `@dice/engine`.
- `@dice/engine` owns lifecycle and the public facade; it does not import `@dice/ui`.
- Apps import the facade and leaf packages, never internal `src/` files.

See [01-architecture.md](01-architecture.md) for contracts and package details.

---

## 6. Documents

| Document | Purpose |
| :--- | :--- |
| [01-architecture.md](01-architecture.md) | Target package catalog, contracts, data flow, events, API sketches, extension points. |
| [02-migration-roadmap.md](02-migration-roadmap.md) | Phase-by-phase migration, compatibility strategy, verification gates, risks, cleanup. |
| [03-apps-and-games.md](03-apps-and-games.md) | Sandbox parity, focused demos, Yamb design, content packs, deployment. |
| [04-file-map.md](04-file-map.md) | Current file → target package/app mapping and deletion list. |
| [05-decisions.md](05-decisions.md) | Architecture decision records with alternatives and consequences. |

---

## 7. Migration at a Glance

| Phase | Outcome |
| :--- | :--- |
| 0 | Legacy frozen in `legacy/`; workspaces, Vite, tests, CI, docs skeleton in place. |
| 1 | `@dice/core` extracted and tested. |
| 2 | `@dice/physics` with `cannon-es` backend behind a strict adapter. |
| 3 | `@dice/dice` pure domain and geometry data. |
| 4 | `@dice/rendering` with vendored Three r73 behind an adapter. |
| 5 | `@dice/enclosures` including a real cylinder implementation. |
| 6 | `@dice/input` and optional `@dice/determinism`. |
| 7 | `@dice/world` runtime composition, headless mode, reroll support. |
| 8 | `@dice/engine`, `@dice/content`, `@dice/rules`, `@dice/ui`. |
| 9 | Enclosure gallery demo, first deployed app. |
| 10 | Sandbox parity with the legacy demo. |
| 11 | Remaining demos + playable Yamb. |
| 12 | Delete legacy tree, final docs, Pages release, cleanup. |

Detailed gates and file moves are in [02-migration-roadmap.md](02-migration-roadmap.md).

---

## 8. Definition of Done

The reorganization is complete when all of the following are true:

1. `legacy/` is deleted, and no code imports from it.
2. Only `packages/physics` imports `cannon-es`.
3. Only `packages/rendering` imports Three.js.
4. `@dice/core`, `@dice/dice`, `@dice/enclosures`, `@dice/content`, and `@dice/rules` have no DOM references.
5. Every package exposes a documented primary entry (plus only documented subpaths) and has at least smoke/unit tests.
6. `npm run check`, `npm test`, `npm run build`, and `npm run test:e2e` pass in CI.
7. The sandbox matches the legacy feature checklist.
8. Enclosure gallery, physics lab, predetermined roll, and dice visual lab are runnable and linked from the landing page.
9. Yamb is playable end-to-end for the variant specified by a rules ADR written before Phase 11, with tested scoring and reroll behavior.
10. GitHub Pages deploys the landing page and every app from a single build.
11. Architecture, event, content, and contribution guides live in `docs/`.
12. Adding a new demo requires only a new app folder, a registry entry, and app-local code.

---

## 9. Non-Goals of This Plan

- Upgrading to modern Three.js in the same effort. The render adapter is designed to make that a later, contained project.
- Replacing physics with Rapier now. The adapter leaves that door open.
- Building a general tabletop rules framework. Yamb-specific rules stay in the Yamb app.
- Final visual branding, audio, assets, or marketing site.
- Networked multiplayer.

---

## 10. Open Questions for Later

These do not block the architecture and should be answered before the relevant app is built.

1. **Yamb variant:** which columns, announcement rules, and scoring variant should the first release use?
2. **Polyhedral dice:** should D4/D8/D10/D12/D20 support land in the first engine release, or after the sandbox?
3. **Browser matrix:** which minimum browser and mobile platforms should CI and manual testing target?
4. **Audio and assets:** do we want dice/table audio, GLTF dice models, or keep procedural visuals only?
5. **Publishing:** are `@dice/*` packages ever intended to be published, or are they private workspace packages?
6. **Landing identity:** name, theme, and whether the landing page should include live mini-previews.
7. **Localization:** is i18n needed for games, or English-only for now?
8. **Physics determinism guarantees:** do we need cross-device reproducible simulations, or only repeatable behavior on the same build? The current plan assumes the latter.
