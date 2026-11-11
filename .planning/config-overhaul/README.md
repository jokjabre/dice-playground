# Configuration Overhaul Plan

**Status:** Proposed — planning complete, implementation pending
**Date:** 2026-11-11
**Branch context:** `settings-overhaul`
**Scope:** Unified, dynamic, shared settings UI per section across scene apps; canonical settings schema; incremental save/load/import/export; per-app defaults; and a settings-manager demo app.

This plan is based on the current codebase state (`apps/sandbox`, `apps/demos/*`, `apps/games/yamb`, `packages/*` configs/UI) and the clarified decisions below.

---

## 1. Goals

- **Unified settings UI per section:** one shared UI implementation per settings section; apps choose which sections to show.
- **Full configurability:** every existing configurable knob in code (runtime params and content/visual/definition aspects such as dice geometry/appearance, face mappings, enclosure options, table/scene, throw/spawn, etc.) is editable where applicable.
- **Immediate, fluid changes:** changes apply to the live world immediately when feasible (including after a throw has finished); structural/heavy changes auto-reload/rebuild while preserving settings/state where safe.
- **Portable persistence:** export/import as versioned JSON settings documents; load full config or only specific sections (from section files or from full/global files).
- **Incremental layering:** imports are additive patches by default (omit = no change) with an explicit reset marker; multiple files can be overlapped.
- **Per-app defaults:** a chosen settings file can be applied as the default for an app and loaded automatically on open (persisted in browser storage).
- **Settings manager:** a demo app to split/merge/streamline settings files, resolve conflicts, and (best effort) preview merged results in a scene.
- **Extensibility:** adding new options or hiding/excluding settings in the future must be easy (schema/registry-driven), without bespoke per-app rewiring.

## 2. Non-goals (unless required by an in-scope knob)

- New physics/rendering features, backends, or visual effects not already representable in code.
- New game rules/content beyond what is needed to expose existing settings.
- Cloud sync/sharing or collaborative editing of settings files.
- Undo/redo history beyond what the browser/session naturally provides (can be a follow-up).
- URL/back-compat guarantees outside the repo’s current app structure.

## 3. Clarified decisions (inputs to this plan)

| Topic | Decision |
| :--- | :--- |
| File format/envelope | **JSON + versioned envelope** (plain `.json`) with schema/version, scope/kind metadata, and settings payload. |
| Config model | **Single canonical settings schema** with adapters to/from engine/world/physics/rendering/dice/content layers. |
| Scope of settings | **All existing knobs incl. content/visuals** (runtime + dice/enclosure/table/throw/spawn/definition-like options present in code). |
| Incremental merge | **Omit = no change**; support an **explicit reset marker** to clear an override back to default/base. |
| Export modes (chosen at save time) | **Both:** (1) only explicit user overrides/top-level dirty changes, and (2) include defaults used = fully resolved effective config minus engine base (baked snapshot). Engine base never exported. |
| Per-app default file | **Persist file contents in browser storage** keyed by app; auto-load on open; user can replace/clear. |
| Big/structural changes | **Auto-reload/rebuild scene**; preserve settings/state where safe, else clean reset. |
| Apply timing | **Apply to current world immediately** when feasible (including after a throw finished); rebuild/re-throw only when in-place apply is impossible. |
| Settings manager app | **New demo app** under `apps/demos/` (e.g. `settings-manager`), added to `apps/registry.json` and landing. |
| Conflict resolution (manager) | **Manual resolution UI** with file-order/priority default suggestion. |
| Preview in manager | **Best-effort required** in deliverable; if blocked, a clearly scoped fallback phase (core split/merge remains functional). |
| App coverage | **All current scene apps:** `sandbox`, `enclosure-gallery`, `physics-lab`, `predetermined-roll`, `dice-visual-lab`, `yamb` (landing N/A as non-scene unless a setting becomes relevant). |
| Shared settings UI home | **Extend `@dice/ui`** with shared settings/section components (adjust boundaries/contracts as needed). |
| Additional constraints | **Add any currently missing options** to settings UI; **make future additions/hiding of settings easy** (declarative/registry-driven). |

---

## 4. Current state snapshot (grounding)

- **Config layers:** `packages/engine/src/config.js`, `packages/world/src/config.js`, `packages/physics/src/config/defaults.js`, `packages/rendering/src/config/defaults.js`, `packages/core/src/config/mergeConfig.js`; content translated via `configFromContent`; dice/enclosure definitions in `@dice/dice`/`@dice/enclosures`.
- **UI:** `@dice/ui` provides `ControlPanel`, `Panel`, HUD/presenters, styles (DOM-only, currently workspace dep limited to `@dice/core`).
- **Apps & existing controls (examples):**
  - `sandbox`: enclosure/type+scale, engine mode/flick-interrupt/max-roll-duration, camera distance, light position, actions/info, motion/predetermined flows.
  - `enclosure-gallery`: enclosure + scale, gravity preset/z, camera distance, light XYZ, throw/clear/reset.
  - `physics-lab`: enclosure, gravity XYZ, surface/contact pair friction & restitution, linear/angular damping, mass, solver iterations, fixed step, settle threshold/frames (+ throw/stats).
  - `dice-visual-lab`: chamfer, radius scale, body/label colors, shininess/specular, face-mapping presets, style application, preview stats.
  - `predetermined-roll`, `yamb`: app-specific flows with scene/runtime settings that must be brought under the unified system (and expose missing knobs).
- **Gaps:** no canonical unified schema, no save/load/import/export, no per-app persisted defaults, inconsistent per-app UIs, incomplete coverage of “all properties” per section, no incremental merge/reset semantics, no settings-manager.

---

## 5. Target architecture

### 5.1 Canonical settings document (versioned JSON)

Use a single envelope for all files (full, section, patch, default):

```jsonc
{
  "format": "dice-settings",          // stable identifier
  "schemaVersion": 1,                  // integer, migratable
  "kind": "full" | "section" | "patch",
  "appId": "sandbox",                 // optional; target/default association
  "sectionId": "light",               // optional; for section-scoped files
  "meta": {
    "name": "My light preset",
    "createdAt": "2026-11-11T00:00:00Z",
    "source": "user-export",          // optional provenance
    "includesDefaults": false          // reflects save-time choice when relevant
  },
  "settings": {
    /* canonical section tree; only present keys are meaningful for patches */
  }
}
```

Rules:
- **Plain `.json`** files. Default export names SHOULD be descriptive, e.g. `light.settings.json`, `sandbox-full.settings.json`, `<section>.settings.json` (exact convention finalized in Phase 1, but consistent and documented).
- **`schemaVersion` required.** Loader validates, rejects unknown major incompatibilities with clear errors, and runs migrations for older known versions when added.
- **`kind`/`sectionId` advisory + enforced by UI:** any file may be imported as a selected section if it contains applicable keys; section exports set them for convenience.

### 5.2 Canonical schema & adapters

- Define a **single canonical settings model** (typed/JSDoc contracts) organized by section namespaces (see §6). This is the source of truth for UI, merge, diff, persistence, and serialization.
- Implement **adapters/mappers**:
  - `canonical -> engine/world/physics/rendering/dice/enclosure/content/runtime` apply functions.
  - `current runtime/app state -> canonical` for export/snapshot and “effective” reads.
  - `legacy/layer configs/content packs -> canonical` for bootstrapping and compatibility.
- Keep layer packages authoritative for their domains but driven through canonical-derived inputs; avoid duplicating “meaning” of a setting in multiple places.
- **No engine base values written to files.** Adapters/loaders must be able to distinguish base/default/override (see §5.3).

### 5.3 Layering, merge, and reset semantics

**Runtime precedence (low → high):**
1. **Engine/base defaults** — hardcoded/package defaults (never exported).
2. **App-bundled content/config** — the app’s shipped baseline (treated as part of the resolved base below the user default file unless overridden).
3. **Per-app default settings file** — user-chosen, stored in browser storage, auto-applied on open.
4. **Side-panel/live overrides** — explicit user edits in the session (top layer).

**Incremental import/merge:**
- **Omit = no change** to the targeted scope.
- **Explicit reset marker** (canonical sentinel, e.g. `{ "$reset": true }` or an agreed equivalent) clears an override at that path so value falls back to lower layers/base. (Exact token/name finalized in Phase 1 and documented.)
- **Objects/maps:** deep-merge by key/path by default.
- **Arrays and structured definitions** (e.g. dice sets, face mappings, ordered lists): default to **replace-at-node** when the node is provided (to avoid ambiguous merges), unless a section defines an explicit keyed-merge contract; document per-section behavior. Face-mapping/contact-map partial edits supported via keyed/object form where applicable.
- **Section-scoped import from any file:** user can choose “import section X” (UI) and loader extracts only applicable canonical keys for X; non-applicable keys ignored safely with feedback.

**Export (chosen at save time):**
- **Option A — “Only top level” (explicit overrides/dirty):** export only keys explicitly changed by the user at the side-panel/live layer (dirty/override set) relative to the resolved state below it. Portable patch.
- **Option B — “Include default file options”:** export **fully resolved effective config minus engine base** (baked snapshot including values sourced from the per-app default file and live overrides). Self-contained.
- **Engine base never included.** Equality-to-base detection uses canonical defaults comparison (with normalization) to avoid leaking base values.

**Applying per-app default:**
- Persisted as **file contents (JSON string/canonical object)** in browser storage (e.g. `localStorage`/`IndexedDB`) keyed by `appId`.
- On app open: load base/bundled config → apply stored default (if any) → initialize side-panel live state from that resolved result (or empty dirty set as defined).
- User can set/replace/clear default; clearing removes stored entry and falls back to base/bundled behavior.

### 5.4 Apply pipeline & fluidity

- Every settings change flows through a **single apply controller**: validate → update canonical live state/dirty tracking → compute required action (`hot-apply`, `partial-rebuild`, `full-reload/recreate`).
- **Hot-apply immediately** where supported (camera, lights, gravity/forces, materials/contacts, damping/mass on bodies, colors/visual params that can update materials, mappings on live dice, etc.), including after dice have settled.
- **Structural changes** (e.g. enclosure type/scale/geometry, dice count/definition/geometry/chamfer/radius or registry-affecting changes, table/world rebuild needs) trigger **auto-reload/rebuild**; preserve non-conflicting settings and, where safe/feasible, world state (e.g. camera/light/UI state, and dice state when compatible) — otherwise perform a clean, predictable reset. No user confirmation required.
- Mid-roll: apply safe live params immediately; defer/reconcile changes that would invalidate the current simulation step only as needed, but ensure resulting state reflects the new settings without requiring a manual next throw.

### 5.5 Shared UI & extensibility

- **One shared UI per section** implemented in `@dice/ui` (components extended as needed; relax/adjust package boundaries deliberately if required, while keeping UI framework-agnostic and event/contract-driven).
- **Schema/registry-driven sections:** each section declares metadata (id, label, grouping, fields/controls, defaults, apply/reload classification, visibility rules, serialization hooks). Adding/hiding options should be primarily a **registry/schema/field definition change**, not scattered ad-hoc edits across every app.
- **Per-app composition:** apps declare which sections to render and in what order/grouping; apps must still accept/apply settings for sections they do not render (e.g. via per-app default files or imports) so cross-app reuse works (e.g. Dice Visual Lab dice defaults applied in Enclosure Gallery).
- **Import/export UX (shared):** consistent controls for export (scope: full or section; mode: overrides-only vs include-defaults/effective-minus-base), import (pick file, choose target section or full/auto), apply-as-default, clear-default, and reset markers where relevant.
- **Missing options:** audit current code for all settable properties per domain and add them to the UI/registry (even if previously hidden), with sensible grouping/sub-sections.

---

## 6. Proposed section taxonomy (target; finalized during implementation)

Organize into coherent, user-facing sections (each with shared UI). Split large domains into sub-sections/panels as needed:

- **Dice / Visuals:** definition/type, count, style, chamfer/geometry factors, radius/scale, body/label colors, material (shininess/specular/other existing props), face labels/mappings, per-die/instance options where they exist.
- **Enclosure:** type, scale/size, margin/ceiling and other enclosure options; (visual/boundary params if present).
- **Camera:** distance and all existing camera properties (FOV/near/far/offsets as supported by code), reset.
- **Light(s):** position and all existing light properties per light (color/intensity/type-relevant params, shadows flags if exposed); structured to support multiple lights if present.
- **Scene / Table / Rendering:** background/floor/desk colors, shadows/antialias and other render flags, spotlight/ambient params, environment options present in code.
- **Physics (World):** gravity (world-level).
- **Physics (Solver & Settle):** iterations, fixed step/timestep, substeps/frame caps where exposed, velocity/settle thresholds/frames, max frames/duration semantics.
- **Physics (Materials & Interactions):** mass, linear/angular damping, per-interaction contact pairs (die-die, die-floor/desk, die-wall/barriers/boundaries etc.) for friction/restitution and any other existing contact fields — grouped clearly; partial per-pair overrides supported.
- **Throw / Spawn / Input:** initial velocity/impulse ranges, flick/throw parameters, spawn profiles/positions/variance, mode-related throw behavior and any existing tunables (e.g. max roll duration/interrupt policies if represented in settings).
- **Determinism / Predetermined:** mode, requested values/mapping behavior and related options exposed by determinism plugin/config.
- **App / Mode (scoped):** app-specific toggles that are truly app-level; prefer promoting engine-relevant knobs into shared sections.

> Exact field inventory per section is produced in **Phase 0/1** by auditing code/packages/apps; the registry must make adding/hiding fields trivial thereafter.

---

## 7. Settings manager demo app (`apps/demos/settings-manager`)

- **Core capabilities:** load multiple settings files, inspect by section/key, **split** a full/large file into section (and optionally finer-grained) chunks, **merge/streamline** multiple files into one with deterministic base ordering.
- **Conflict resolution:** detect same-path/key differences; **manual resolution UI** showing conflicts with a default choice derived from file order/priority; allow per-conflict (and bulk/per-section where useful) decisions before export.
- **Validation & feedback:** schema/version checks, unknown/ignored keys reporting, reset-marker handling, and clear errors.
- **Preview (best effort):** embed/select a generic scene context and apply the merged (or selected) result to visualize outcome; if blocked by coupling/timing, ship core workflows and complete preview in a scoped fallback phase.
- **Integration:** registered in `apps/registry.json`, runnable/buildable like other demos, uses shared `@dice/ui` settings components and canonical schema utilities.

---

## 8. Atomic phases (buildable, agent-orchestratable)

Each phase MUST leave the repo in a buildable/testable state (`npm run check`, relevant `test`/`test:e2e`, and `build` as applicable for touched areas). Prefer small, verifiable increments; do not break untouched apps.

### Phase 0 — Audit, inventory, and contracts
- **Goal:** establish the complete knob/section inventory and the implementation contracts without disruptive behavior changes.
- **Work:**
  - Audit all packages/apps for existing configurable options (engine/world/physics/rendering/dice/enclosures/content/input/determinism/throw/spawn + per-app controls) and identify missing-from-UI options.
  - Produce/lock: canonical section taxonomy & IDs, field inventory, apply classification (hot vs rebuild), and per-app section visibility matrix.
  - Specify envelope, schemaVersion=1 shape, reset-marker token, merge rules for arrays/maps/contacts, default filename conventions, and storage key scheme (`appId`-scoped).
  - Add/adjust types/JSDoc contracts and pure helpers skeletons (no UI wiring required yet) with unit-test scaffolding where appropriate.
- **Deliverables:** documented inventory/contracts in `.planning/config-overhaul/` (and/or `docs/` as decided) and code-level schema/registry stubs.
- **Exit criteria:** inventory reviewed/complete for current code; `npm run check` and existing tests pass.

### Phase 1 — Canonical schema, merge engine, and persistence primitives
- **Goal:** implement the core data model and pure logic.
- **Work:**
  - Implement canonical schema definitions, defaults catalog (non-exported base), normalization, and validation.
  - Implement merge/patch engine (omit=no-change, explicit reset), diff/dirty tracking, and “effective minus base” / “overrides-only” snapshot builders.
  - Implement serialization/deserialization (versioned envelope), section extraction, and migration hook point.
  - Implement per-app default persistence in browser storage (load/save/clear) behind a small API.
  - Adapters/mappers scaffolding: canonical ↔ layer/app state (complete enough to support subsequent phases incrementally).
- **Deliverables:** tested utilities/modules usable by UI and apps; no required end-user UI yet beyond what’s needed for tests.
- **Exit criteria:** unit tests cover merge/reset/layering/export modes/section extraction; checks green.

### Phase 2 — Shared settings UI framework in `@dice/ui`
- **Goal:** one reusable, registry-driven UI per section, ready for app integration.
- **Work:**
  - Extend `@dice/ui` with shared settings primitives: section container/panel, field renderers, grouped/sub-section layout, reset/import/export/apply-default controls, and file pick/download helpers (framework-agnostic DOM).
  - Build a **section registry** binding canonical fields ↔ controls ↔ labels/help/constraints ↔ apply metadata; ensure adding/hiding a field is declarative.
  - Implement consistent import/export UX flows (scope and save-mode selection) wired to Phase 1 APIs.
  - Update/adapt `@dice/ui` boundaries and package contracts as needed (documented) while keeping it reusable.
- **Deliverables:** shared components/styles and registry infrastructure; story-like or demo harness/tests as feasible.
- **Exit criteria:** UI package checks/tests pass; sections render from registry definitions.

### Phase 3 — Runtime apply controller & live-update/reload behavior
- **Goal:** make settings changes immediate and correct.
- **Work:**
  - Implement a unified apply controller (validate, classify hot vs rebuild, apply adapters) integrated with engine/world lifecycles.
  - Wire hot paths for existing live-updatable domains (camera, light, gravity, contacts/materials, damping/mass, render/visual params, mappings, etc.).
  - Implement structural rebuild/reload handling with state preservation where safe (and clean reset fallback), including changes after throws settle and during safe mid-roll cases.
  - Ensure app-bundled content + stored default + live overrides resolve per §5.3 on init and on updates.
- **Deliverables:** runtime integration layer/hooks usable by all scene apps.
- **Exit criteria:** targeted tests (unit/integration/e2e where valuable) prove immediate apply, rebuild behavior, and layering; checks green.

### Phase 4 — Full section coverage & app integration (all scene apps)
- **Goal:** expose every existing knob through shared sections in every covered app.
- **Work:**
  - Implement all section definitions/fields from the Phase 0 inventory (including previously missing options) and map them to real runtime behavior.
  - Integrate shared settings UI into `sandbox`, `enclosure-gallery`, `physics-lab`, `predetermined-roll`, `dice-visual-lab`, and `yamb` with per-app visible-section composition; ensure hidden sections still apply via defaults/imports.
  - Replace/align divergent app-specific controls with shared section UIs where they represent the same settings (preserving necessary app-specific flows as scoped sections/controls).
  - Enable per-section and full export/import, save-time mode choice, and apply/clear per-app default in each app.
  - Handle cross-app reuse cases (e.g. dice visuals default from Dice Visual Lab affecting Enclosure Gallery).
- **Deliverables:** consistent, dynamic settings experience across all scene apps with complete coverage of existing knobs.
- **Exit criteria:** each app builds/runs; relevant e2e/unit tests updated/added; manual spot-checks for layering, incremental import, and immediate apply.

### Phase 5 — Settings manager demo app
- **Goal:** deliver file composition/management workflows.
- **Work:**
  - Scaffold `apps/demos/settings-manager` (Vite/app structure, registry entry, landing entry) using shared UI/schema utilities.
  - Implement load/inspect, split (section and finer-grained where supported), merge/streamline with file ordering, and **manual conflict resolution UI** (file-order defaults).
  - Implement validation/reporting and export of resolved results.
  - **Best-effort scene preview** of merged/selected settings in a selectable/generic context; if blocked, isolate blockers and complete via Phase 5b.
- **Deliverables:** working settings-manager app.
- **Exit criteria:** core split/merge/conflict/export flows functional; preview works or a documented Phase 5b fallback is scheduled.

### Phase 5b (fallback, only if needed) — Settings manager preview completion
- **Goal:** complete scene preview if not achieved in Phase 5.
- **Work:** resolve identified coupling/runtime issues and ship preview; keep scope limited to preview enablement.
- **Exit criteria:** preview demonstrates merged/separated results reliably for supported contexts.

### Phase 6 — Hardening, docs, and extensibility polish
- **Goal:** stabilize and make future changes easy.
- **Work:**
  - Finalize documentation: schema/envelope reference, section/field registry guide (“how to add/hide a setting”), layering/merge/export semantics, and per-app defaults behavior.
  - Add/expand automated tests for regressions (merge semantics, migrations hook, import/export, per-app defaults, hot vs rebuild, key app flows).
  - Performance/UX polish (large forms, validation messages, safe handling of unknown/invalid files) without changing semantics.
  - Ensure `npm run check`, `npm run test`, `npm run test:e2e` (as feasible), and `npm run build` pass for the integrated result.
- **Deliverables:** updated docs in `.planning/config-overhaul/` and/or `docs/`; green CI-relevant checks.
- **Exit criteria:** overhaul acceptance criteria met; adding/hiding a sample field is demonstrably low-touch.

---

## 9. Acceptance criteria (definition of done)

- All scene apps (`sandbox`, all demos, `yamb`) use shared per-section settings UI; each app shows its configured sections and applies settings from hidden sections via defaults/imports.
- Every existing configurable option discoverable in code is represented in the canonical schema/registry and editable via UI where applicable; missing options added.
- Immediate apply works (including after a throw finished) when feasible; structural changes auto-reload with state preserved where safe.
- Users can export/import full or per-section settings (from section or global files) as versioned `.json`; import is incremental (omit=no-change) with explicit reset support.
- Save dialog/time choice supports both export modes: overrides-only and include-defaults (effective minus engine base). Engine base never exported.
- Per-app default settings can be set/cleared, are persisted in browser storage, and auto-load on open; cross-app reuse works as specified.
- Settings-manager demo supports split/merge/streamline with manual conflict resolution (file-order default) and best-effort preview (or completed fallback).
- Adding or hiding a setting is primarily a declarative registry/schema change.
- Repo remains buildable and checks/tests pass for delivered phases.

---

## 10. Risks & mitigations

- **Config sprawl/inconsistency across layers:** mitigate with a single canonical schema + adapters and a code-derived inventory (Phase 0).
- **`@dice/ui` boundary constraints:** address explicitly (Phase 2) by evolving package contract/deps in a controlled, documented way.
- **Hot-apply vs rebuild correctness:** classify per-field in registry, test representative cases, and prefer safe rebuild fallback when uncertain.
- **Array/map merge ambiguity:** define per-section/node strategies (default replace-at-node for complex arrays) and document clearly.
- **Browser storage limits/failures:** handle quota/errors gracefully; keep exported files as the portable source of truth.
- **Preview coupling in settings manager:** treat as best-effort with a scoped fallback phase to protect core delivery.

---

## 11. Unified cold-start prompt (preferred)

Use this prompt to start or resume **any** phase in a fresh agent/session. Change only the `PHASE` value.

```text
You are implementing the Dice Playground "Configuration Overhaul".

PHASE: <PHASE_ID_AND_NAME>  (e.g. "Phase 1 — Canonical schema, merge engine, and persistence primitives")

Source of truth:
- Read and follow `.planning/config-overhaul/README.md` (especially: Clarified decisions, Target architecture, Proposed section taxonomy, Atomic phases, and Acceptance criteria).
- Inspect the current codebase before making changes; align with existing patterns/packages unless the plan requires a documented evolution.

Instructions:
1) Execute ONLY the specified PHASE (and its listed work/deliverables/exit criteria). Do not pull in unrelated future-phase work except minimal stubs/interfaces explicitly required for this phase to build and stay coherent.
2) Preserve buildability: keep `npm run check` and relevant tests passing for touched areas; update/add tests appropriate to the phase. Do not regress other apps/packages.
3) Honor clarified decisions: JSON + versioned envelope; single canonical schema with adapters; all existing knobs incl. content/visuals; omit=no-change with explicit reset marker; both export modes at save time (overrides-only and effective-minus-base, engine base never exported); per-app defaults persisted in browser storage; auto-reload for structural changes preserving state where safe; immediate apply when feasible; shared settings UI in `@dice/ui`; settings-manager as `apps/demos` with manual conflict resolution and best-effort preview.
4) Prioritize extensibility: settings/sections must be registry/schema-driven so adding or hiding options is easy.
5) When you finish, report: what changed, files touched, how exit criteria were met, commands/checks run and results, and any follow-ups or risks for the next phase.
```

**Phase IDs:** 

`Phase 0 — Audit, inventory, and contracts` 

`Phase 1 — Canonical schema, merge engine, and persistence primitives`

`Phase 2 — Shared settings UI framework in @dice/ui`

`Phase 3 — Runtime apply controller & live-update/reload behavior` 

`Phase 4 — Full section coverage & app integration (all scene apps)` 

`Phase 5 — Settings manager demo app` 

`Phase 5b (fallback) — Settings manager preview completion` 

`Phase 6 — Hardening, docs, and extensibility polish`
