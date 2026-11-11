# Phase 0 — Inventory (audit & taxonomy)

**Status:** Phase 0 draft/locked baseline for implementation handoff  
**Date:** 2026-11-11  
**Scope:** Audit of existing configurable options across packages/apps, canonical section taxonomy & IDs, field inventory, apply classification, and per-app section visibility matrix.  
**No disruptive behavior changes** were made as part of Phase 0; this document records the current state and target contracts.

Companion: [CONTRACTS.md](./CONTRACTS.md) (envelope, schema shape, reset marker, merge, filenames, storage keys). Source plan: [README.md](./README.md).

---

## 1. Apps & current settings surfaces (audit)

Scene apps in scope (all must be covered by the unified system in later phases):

| App (appId) | Path | Current controls / configurable behavior (observed) | Notable gaps vs “all existing knobs” |
| --- | --- | --- | --- |
| `sandbox` | `apps/sandbox` | Enclosure type/scale, engine mode (standard/continuous/predetermined/motion as exposed), flick interrupts current roll, max roll duration (s), camera distance, light position XYZ, throw/clear/reset actions, predetermined target input flow, motion enable/status (mode-gated) | Render/scene colors & flags, full camera/light params, full physics/material/solver/settle, dice visuals/geometry/mapping/count/style as editable settings (beyond fixed defaults), throw/spawn tuning, determinism details, per-app persisted defaults/import/export, hidden-section application |
| `enclosure-gallery` | `apps/demos/enclosure-gallery` | Enclosure, enclosure scale, gravity preset/z, camera distance/reset, light XYZ/reset, throw/clear/reset, info | Full camera/light/render, dice visuals/definitions, materials/contacts/solver/settle, spawn/throw, determinism, persistence/import/export |
| `physics-lab` | `apps/demos/physics-lab` | Enclosure, gravity XYZ, per-surface-pair friction & restitution (selected pair), linear/angular damping, die mass, solver iterations, fixed timestep, settle threshold/frames, reset defaults, throw/clear, live stats | Camera/light/render/scene, dice visuals/geometry/mapping/count, all contact pairs editable as data, spawn/throw controls, determinism, persistence/import/export |
| `dice-visual-lab` | `apps/demos/dice-visual-lab` | Chamfer factor, die radius scale, body/label colors, shininess/specular, face-mapping preset (live apply), apply-style+roll, reset visuals, roll/clear, preview stats | Enclosure/camera/light/physics/throw/spawn/determinism, count/definition registry choices as general settings, persistence/import/export, cross-app reuse UX |
| `predetermined-roll` | `apps/demos/predetermined-roll` | Determinism mode, dice count, per-die targets, predict (simulate), roll, clear, explanation | Full scene/camera/light/physics/visuals/enclosure/throw/spawn tuning, persistence/import/export |
| `yamb` | `apps/games/yamb` | Game flow/scorecard/keep/roll/score, setup/continue/new game (local save of game state, not settings envelope) | Unified scene/engine settings exposure (as applicable), per-app settings defaults/import/export, deterministic/visual/physics tuning surfaces where relevant |

Non-scene: `landing` (N/A as a 3D scene app for settings panels unless a future setting becomes relevant).

### 1.1 Cross-cutting runtime knobs observed in code (non-exhaustive but audited)

- **Engine (`@dice/engine`)**: container/headless, seed, content, dice count/definition/style, loop `fixedStep`/`maxSubSteps`/`maxFrameGap`/`maxFrames`, settle overrides, plugins (e.g. determinism), viewport/metrics, RNG/factories/registries (advanced/injectable). APIs: `roll/simulate/cancel/clear/reset/resize`, `setMode/setLoopConfig/setSettleConfig/setGravity/setCamera/resetCamera/setLight/setEnclosure/setEnclosureScale/setDiceConfig`, `use/unuse`.
- **World (`@dice/world`)**: dice count/definition/style, enclosure type + options (margin/ceiling/scale, etc.), gravity, physics iterations/mass/linear & angular damping, settle (velocityThreshold/settleFrames/maxIterations/fixedStep), render/table/camera config objects, spawn profiles, dice factory/registry, enclosure rebuild/scale, light/camera passthrough, metrics/viewport sizing.
- **Physics (`@dice/physics`)**: default gravity `{0,0,-2940}`, mass `300`, solver iterations `20`, cylinder segments `24`, linear/angular damping `0.01`, body material `die`, named contact-material pairs (friction/restitution) e.g. `die:die`, `die:desk`, `die:screen`, `die:barrier_{left,right,top,bottom}`, `die:sphere_boundary`, `die:glass_boundary`; live body APIs and contact material get/set.
- **Rendering (`@dice/rendering`)**: fov/aspect/near/far, cameraDistance multiplier, cameraNear/cameraFar overrides, background, shadows, antialias, spotlightIntensity, castShadow, colors `{ambient, spotlight, desk}`; camera/light control support via world/engine.
- **Dice (`@dice/dice`)**: definitions/registry (built-in D6), chamfer/geometry/radius, collision vs mesh data, styles (`classic`, `dark`: bodyColor/labelColor/fontFamily/material shininess+specular/textureSize) and style descriptors, face mappings/labels/reading/shift helpers.
- **Enclosures (`@dice/enclosures`)**: `box|sphere|cylinder` definitions/options/sizing/scale; content presets expose margin/ceiling for box.
- **Content (`@dice/content`)**: serializable packs/presets for enclosure, table (floorColor/background/lights/shadows), camera (distance/near/far), dice (definition/count/style), physics (gravity, materials ref), scenarios (e.g. predetermined values) — translated into world overrides (`configFromContent`).
- **Input/throw/spawn (`@dice/input`, `@dice/world` SpawnProfile)**: pointer/gesture throw behavior, throw strength/speed/angle jitter/upward ratio, spawn origin/height/collision distance/margin/die radius/inertia, enclosure-radius/mode-derived spawning; motion input; programmatic/raycast/visualizer utilities.
- **Determinism (`@dice/determinism`)**: plugin modes (`predict-and-shift`, `predict-only`), requested values, prediction/simulation flows, face shifting/mapping application.

> Phase 1-4 must convert this audit into an exhaustive, field-level canonical registry (including any additional code-discoverable tunables) so every existing knob is representable and editable where applicable.

---

## 2. Canonical section taxonomy & IDs (locked)

Stable `sectionId` values (used in envelopes, registry, visibility, import/export targeting, and storage-adjacent logic):

| sectionId | Label (target UI) | Domain / intent | Primary apply tendency* |
| --- | --- | --- | --- |
| `diceVisuals` | Dice / Visuals | Dice definition/type/count, style, geometry (chamfer/radius/scale), body/label colors, material (shininess/specular/etc.), face labels/mappings, per-die/instance options where present | mixed: visual/material/mapping often **hot**; geometry/count/definition/registry **rebuild** |
| `enclosure` | Enclosure | Enclosure type, scale/size, margin/ceiling and other enclosure options, boundary/visual params if present | **rebuild** (structural) |
| `camera` | Camera | Distance and all existing camera properties (fov/near/far/offsets/yaw if supported), reset semantics as actions not persisted as state except values | **hot** (immediate) |
| `lighting` | Light(s) | Position and all existing light properties per light (color/intensity/type-relevant, shadow flags if exposed); structured for multiple lights if present | **hot** (immediate; may need render refresh) |
| `scene` | Scene / Table / Rendering | Background/floor/desk colors, shadows/antialias and render flags, spotlight/ambient params, environment/table options present in code | mixed: colors/flags often **hot** or **partial-rebuild** depending on backend path |
| `physicsWorld` | Physics (World) | World-level gravity and related world-physics toggles/params exposed in code | **hot** (immediate) |
| `physicsSolver` | Physics (Solver & Settle) | Iterations, fixed step/timestep, substeps/frame caps where exposed, velocity/settle thresholds/frames, max frames/duration semantics | mixed: some **hot**, step/frame/strategy-affecting may be **partial-rebuild**/**reload** |
| `physicsMaterials` | Physics (Materials & Interactions) | Mass, linear/angular damping, per-interaction contact pairs (die-die, die-floor/desk, die-wall/barriers/boundaries, etc.) for friction/restitution and other existing contact fields; keyed/object form for partial pair edits | **hot** for live material/contact/body updates where supported; spawn-time defaults applied on rebuild/spawn |
| `throwSpawn` | Throw / Spawn / Input | Throw strength/ranges, flick/interrupt behavior (where representable), spawn profiles/positions/variance/height/collision, mode-related throw behavior and existing tunables | mixed: most **hot** for next throw/spawn; some affect live behavior immediately |
| `determinism` | Determinism / Predetermined | Mode, requested values/mapping behavior and related exposed options; simulation/prediction settings if configurable | **hot** for mode/config; roll requests are actions but defaults/mode are settings |
| `appMode` | App / Mode (scoped) | Truly app-level toggles/preferences; engine-relevant knobs should be promoted into shared sections. Scoped per `appId` in schema/visibility. | **hot** unless app declares rebuild semantics |

\*Apply classification is finalized per-field in Phase 1/3; table shows dominant tendency for planning. `hot` = apply in-place when feasible (including after settle), `partial-rebuild`/`full-reload` = structural/heavy auto-rebuild preserving state where safe.

---

## 3. Field inventory (Phase 0 baseline)

This is the **authoritative baseline inventory** to drive Phase 1 schema/registry work. Each bullet is a canonical concern; exact field names/paths are finalized in Phase 1 but MUST cover every item below (and any other code-discovered knob).

### 3.1 `diceVisuals`
- **Definition/registry:** active definition id (e.g. `d6`), extensible to registered definitions.
- **Count:** dice count (engine/world; per-app defaults vary: sandbox/gallery 6, lab 6, visual 6, pred 1-6 selectable, yamb 5).
- **Style:** named style id (`classic|dark`) and/or full style descriptor (bodyColor, labelColor, fontFamily, material.shininess, material.specular, textureSize).
- **Geometry:** chamfer factor, radius/scale factor (and any radius derivation inputs exposed), mesh/collision-affecting params.
- **Face mapping/labels:** per-die/global mapping arrays, presets, shift/display mapping behavior as representable; label range/labels from definition.
- **Apply:** mapping/material/style often hot on live dice where supported; chamfer/definition/count/radius changes that alter geometry/registry are structural rebuild/re-roll paths (as in visual lab).

### 3.2 `enclosure`
- **Type:** `box|sphere|cylinder` (+ registered/custom ids where supported).
- **Size/scale:** enclosure scale (e.g. gallery/sandbox presets 0.75–2.0) and any size/radius/height params.
- **Options:** `margin`, `ceiling` (box/content), and any other enclosure-specific tunables in definitions/implementations.
- **Apply:** structural → auto-rebuild/recreate boundaries and world enclosure; preserve compatible state where safe.

### 3.3 `camera`
- **Distance/zoom:** camera distance multiplier/value (apps expose sliders/selects/reset).
- **Clipping/projection:** near/far (and override fields in render config), FOV/aspect where exposed/configurable.
- **Position/orientation:** offsets/yaw/pitch or equivalent if present in API; reset-to-default action.
- **Apply:** hot via `setCamera`/`resetCamera` and render refresh.

### 3.4 `lighting`
- **Primary light position:** XYZ (scene-relative) as currently exposed.
- **Light properties:** color(s), intensity (spotlightIntensity), ambient/spotlight colors, castShadow/shadows flags where tied to lights, and any additional light params present in rendering/world.
- **Multiplicity:** structure must support multiple lights if/when present (array/keyed lights).
- **Apply:** hot; settled scenes may require explicit render tick.

### 3.5 `scene`
- **Background & table:** background color, desk/floor color, table presets (floorColor/background/lights/shadows) and render `colors.desk/ambient/spotlight`.
- **Render flags:** shadows, antialias, castShadow, and other existing render toggles.
- **Apply:** mixed; some flags/colors hot, others may require renderer/scene refresh or rebuild depending on backend.

### 3.6 `physicsWorld`
- **Gravity:** world gravity vector XYZ (default `0,0,-2940`), presets as UI affordances not separate stored truth except values.
- **Apply:** hot via `setGravity`/physics world updates.

### 3.7 `physicsSolver`
- **Solver:** iterations (default 20) and any solver tuning exposed.
- **Time step / loop:** fixed step (engine loop & settle), maxSubSteps, maxFrameGap, maxFrames / roll-duration cap semantics.
- **Settle:** velocityThreshold, settleFrames, maxIterations (and their current defaults across layers).
- **Apply:** some values live; step/strategy/loop-affecting changes classified as partial-rebuild or controlled apply in Phase 3.

### 3.8 `physicsMaterials`
- **Body properties:** mass, linear damping, angular damping (defaults 300 / 0.01 / 0.01 in physics; world/engine layers may differ — canonical defaults must be sourced from authoritative base).
- **Contact pairs:** per-material-pair friction/restitution for all existing named pairs (`die:die`, `die:desk`, `die:screen`, `die:barrier_left/right/top/bottom`, `die:sphere_boundary`, `die:glass_boundary`) and extensibility for new pairs.
- **Materials:** body material identifiers (e.g. `die`) where configurable.
- **Apply:** hot updates to live bodies/contacts where supported; next-spawn defaults for newly created bodies.

### 3.9 `throwSpawn`
- **Throw:** throw strength, speed jitter, angle deviation, upward velocity ratio, flick interrupt/behavior flags as representable, max roll duration policy hooks.
- **Spawn:** spawn origin/mode/height, die radius/inertia, collision distance/margin, enclosure-derived insets/radius inputs, randomization profiles/variance as exposed.
- **Input modes:** pointer/motion/programmatic affordances and related tunables present in code.
- **Apply:** primarily affects subsequent throws/spawns; some flags (e.g. interrupt) hot.

### 3.10 `determinism`
- **Mode:** `predict-and-shift` / `predict-only` (plugin modes).
- **Targets/values:** requested face values per die and related mapping behavior.
- **Prediction:** simulate/predict flows and options exposed (seed handling is global/engine-level where applicable).
- **Apply:** mode/config hot (plugin swap/configure as needed); value requests are per-roll actions but defaults/templates may be representable.

### 3.11 `appMode`
- **Per-app scoped:** UI layout prefs are generally out of scope unless represented as settings; include any truly app-level toggles currently treated as settings (and promote engine-relevant ones out). Initial baseline: mostly empty/minimal; yamb game-state persistence remains separate from settings envelope.

---

## 4. Apply classification (hot vs rebuild) — Phase 0 baseline

| Class | Meaning | Typical examples (current codebase) |
| --- | --- | --- |
| `hot` | Apply immediately to live world/renderer/physics without recreating the scene; feasible after a throw has settled | camera distance/position, light position/properties, gravity, material/contact friction/restitution, damping/mass on live bodies, render colors/intensity where supported, face mappings on live dice, mode flags like flick-interrupt (input), determinism mode swap |
| `partial-rebuild` | Recreate a subset (bodies, boundaries, renderer resources, dice instances) while preserving compatible state/settings | enclosure scale/type boundary rebuilds (dice often cleared today), dice visual/style re-spawn paths, loop/settle timing changes requiring controller reconfiguration |
| `full-reload` | Recreate world/engine scene context; used when in-place/partial update is unsafe or unsupported | definition/geometry/chamfer changes requiring geometry cache reset and respawn (as in visual lab patterns), major content/registry changes |

**Structural triggers (auto-rebuild, no confirmation):** enclosure type/scale/geometry, dice definition/geometry/chamfer/radius/registry-affecting changes, count changes requiring respawn strategy, table/world rebuild needs, and other changes classified as non-hot by the registry. Preserve settings/state where safe (camera/light/UI/live dice when compatible) else clean reset.

---

## 5. Per-app section visibility matrix (baseline)

Legend: **V** = visible/editable in that app’s settings UI by default; **H** = hidden by default but MUST still be accepted/applied from per-app defaults and imports (cross-app reuse). (Exact composition finalized in Phase 4; this matrix is the Phase 0 contract baseline.)

| sectionId | sandbox | enclosure-gallery | physics-lab | predetermined-roll | dice-visual-lab | yamb |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `diceVisuals` | H | H | H | H | V | H |
| `enclosure` | V | V | V | H | H | H |
| `camera` | V | V | H | H | H | H |
| `lighting` | V | V | H | H | H | H |
| `scene` | H | H | H | H | H | H |
| `physicsWorld` | H | V (gravity) | V | H | H | H |
| `physicsSolver` | H | H | V | H | H | H |
| `physicsMaterials` | H | H | V | H | H | H |
| `throwSpawn` | H | H | H | H | H | H |
| `determinism` | H | H | H | V | H | H |
| `appMode` | V (scoped) | V (scoped, if any) | V (scoped, if any) | V (scoped, if any) | V (scoped, if any) | V (scoped, if any) |

Notes:
- Apps may expose additional composed groupings, but shared section UIs/IDs remain canonical.
- Sandbox currently shows engine/mode/camera/light/enclosure; migration to shared sections keeps those visible and brings others in as V or H per product decisions refined in Phase 4 while honoring “apply hidden sections from defaults/imports”.

---

## 6. Phase 0 outcomes

- **Inventory reviewed/complete for current code:** audited packages (`engine/world/physics/rendering/dice/enclosures/content/core/input/determinism/ui`) and all scene apps; gaps and missing-from-UI knobs identified for implementation.
- **Contracts locked:** section IDs/taxonomy, apply classification model, visibility matrix baseline, and field inventory scope recorded here and in [CONTRACTS.md](./CONTRACTS.md).
- **Code-level stubs:** `@dice/settings` package added with schema/registry/envelope/merge/storage/persistence helper skeletons, JSDoc types, and unit-test scaffolding (no UI wiring, no runtime behavior changes).

## 7. Follow-ups for Phase 1+

- Finalize exact canonical field paths/names and authoritative base-default sourcing per field (resolve layer discrepancies, e.g. damping/mass defaults across physics vs world).
- Implement full validation, normalization, migration hooks, adapters/mappers, diff/dirty tracking, effective-minus-base and overrides-only snapshots, and real browser-storage persistence.
- Complete per-section keyed-merge contracts (notably contact pairs, face mappings, ordered definition lists) and exhaustive field-level apply classification.
- Wire shared UI and apply controller; promote any remaining app-specific controls into shared/scoped sections per plan.
