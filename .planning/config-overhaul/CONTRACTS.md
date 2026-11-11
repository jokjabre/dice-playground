# Phase 0 — Contracts (envelope, schema, merge, persistence)

**Status:** Phase 0 locked implementation contracts (baseline)  
**Date:** 2026-11-11  
**Scope:** Versioned envelope, schema version/shape rules, reset marker, merge semantics (objects/arrays/maps/contacts), export modes, default filename conventions, storage key scheme, and code-level stub locations.

Companion: [INVENTORY.md](./INVENTORY.md). Source plan: [README.md](./README.md).

---

## 1. Envelope (versioned JSON)

All settings files (full, section, patch, default snapshots) use a single envelope.

```jsonc
{
  "format": "dice-settings",          // stable identifier (required)
  "schemaVersion": 1,                  // integer, migratable (required)
  "kind": "full" | "section" | "patch", // optional but recommended/set by exporters
  "appId": "sandbox",                 // optional; target/default association
  "sectionId": "lighting",            // optional; for section-scoped files
  "meta": {
    "name": "My light preset",
    "createdAt": "2026-11-11T00:00:00Z",
    "source": "user-export",
    "includesDefaults": false          // reflects save-time choice when relevant
  },
  "settings": {
    /* canonical section tree; only present keys are meaningful for patches */
  }
}
```

### 1.1 Rules
- **Plain `.json` files.**
- **`format` required** and must equal `dice-settings`.
- **`schemaVersion` required.** Loader validates, rejects unknown major incompatibilities with clear errors, and runs migrations for older known versions when added (migration hook point from Phase 1).
- **`kind`/`sectionId` advisory + UI-enforced:** any file may be imported as a selected section if it contains applicable keys; section exports set them for convenience. Non-applicable keys ignored safely with feedback (Phase 2+ UX).
- **`settings` required:** canonical payload object keyed by `sectionId` (or containing the targeted section subtree).

### 1.2 Schema v1 shape (canonical payload)

- **Top-level keys:** canonical `sectionId`s from the locked taxonomy:
  `diceVisuals`, `enclosure`, `camera`, `lighting`, `scene`, `physicsWorld`, `physicsSolver`, `physicsMaterials`, `throwSpawn`, `determinism`, `appMode`.
- **Values:** per-section objects whose internal field paths are defined by the canonical schema/registry (Phase 1 finalizes exact paths/names). Patches may include only a subset of sections/paths.
- **`appMode`:** scoped by `appId` where values are app-specific (exact nesting finalized in Phase 1; e.g. `appMode[appId]` or namespaced keys) so imports can target/ignore appropriately.
- **No engine base values written to files.** Export/snapshot builders must exclude engine/base defaults (see §4).

---

## 2. Reset marker

- **Token:** the plain object `{ "$reset": true }` (key: `$reset`).
- **Meaning:** clears an override at that path so the effective value falls back to lower layers/base (engine/base → app-bundled → per-app default file → live overrides).
- **Scope:** applies at the node/path where present (including within deep-merged objects, subject to per-node merge strategy). For arrays/replace-at-node fields, reset at the node restores the lower-layer/base value for that node.
- **Detection:** canonical helper `isResetMarker(value)` (stubbed in `@dice/settings`) treats an object with `$reset === true` as a reset marker.
- **Serialization:** reset markers are serialized as-is in JSON; loaders must recognize them before normal merge application.

---

## 3. Merge & layering semantics

### 3.1 Runtime precedence (low → high)
1. **Engine/base defaults** — hardcoded/package defaults (**never exported**).
2. **App-bundled content/config** — shipped baseline (resolved base below user default unless overridden).
3. **Per-app default settings file** — user-chosen, persisted in browser storage, auto-applied on open.
4. **Side-panel/live overrides** — explicit user edits in session (top/dirty layer).

### 3.2 Incremental import/merge
- **Omit = no change** to the targeted scope.
- **Explicit reset marker** `{ "$reset": true }` clears override at path (falls back to lower layers/base).
- **Plain objects/maps:** deep-merge by key/path by default.
- **Arrays and structured definitions:** **replace-at-node** by default when the node is provided (avoids ambiguous merges), unless a section/field defines an explicit keyed-merge contract.
- **Section-scoped import from any file:** UI may import “section X” by extracting only applicable canonical keys for X; non-applicable keys ignored safely with feedback.

### 3.3 Per-section/node strategies (contract baseline)

| Data shape | Default strategy | Notes / examples |
| --- | --- | --- |
| Plain config objects | Deep merge by key | camera, lighting, gravity, scalar tuning groups |
| Primitive fields | Replace | numbers/strings/booleans |
| Arrays (ordered lists, sets-as-arrays) | Replace-at-node | dice lists/count-derived arrays, ordered presets unless keyed contract defined |
| Contact materials / pair maps | **Keyed merge by pair key** when represented as an object/map; replace-at-node when represented as an opaque array form | Named pairs like `die:desk`, `die:die`, barriers/boundaries must support partial per-pair overrides |
| Face mappings | Keyed/object or per-die targeted form supports partial edits where applicable; full array form replace-at-node | Preserve ability to patch specific mappings without unintended reorder loss |
| Definitions/registries references | Replace-at-node for selection; definition content itself treated as structured nodes per registry rules (Phase 1+) | geometry/definition changes are structural |

Phase 1 finalizes the exact keyed-merge contracts and normal forms in the registry/schema.

### 3.4 Diff/dirty & export modes (save-time choice)

- **Option A — “Only top level” (overrides-only/dirty):** export only keys explicitly changed by the user at the side-panel/live layer relative to the resolved state below it. Portable patch (`kind` typically `patch` or `section`/`full` as scoped).
- **Option B — “Include default file options” (effective minus base):** export **fully resolved effective config minus engine base** (baked snapshot including values sourced from the per-app default file and live overrides). Self-contained (`meta.includesDefaults: true` when relevant).
- **Engine base never included/exported.** Equality-to-base detection uses canonical defaults comparison with normalization.
- **`appId`/`sectionId` metadata:** set according to scope; loaders remain tolerant but UIs should guide correct targeting.

---

## 4. Persistence (per-app defaults in browser storage)

- **Storage:** browser storage (`localStorage` preferred for small JSON strings, `IndexedDB` acceptable if needed) — Phase 1 selects and encapsulates behind a small API.
- **Key scheme:** `dice.settings.default.<appId>` (appId-scoped). Example: `dice.settings.default.sandbox`.
- **Value:** persisted **file contents** as a JSON string representing a canonical envelope/object (canonical form decided in implementation, but semantically the user-chosen default settings document).
- **Lifecycle:**
  - On app open: load base/bundled config → apply stored default (if any) → initialize side-panel live state from resolved result (dirty tracking as defined).
  - **Set/replace:** validate/parse, store serialized contents under key.
  - **Clear:** remove key and fall back to base/bundled behavior.
- **Error handling:** quota/parse/storage failures handled gracefully; exported files remain the portable source of truth.

---

## 5. Default filename conventions

Consistent, descriptive, and documented (exporters should default to these):

| Scope | Convention | Example |
| --- | --- | --- |
| Full (app-scoped) | `<appId>-full.settings.json` | `sandbox-full.settings.json` |
| Section-scoped | `<sectionId>.settings.json` | `lighting.settings.json`, `physicsMaterials.settings.json` |
| Patch/other | same patterns allowed; `kind`/`meta.name` may disambiguate | `camera.settings.json` |

Apps/export UI may prepend a user label, but SHOULD preserve the `.settings.json` suffix.

---

## 6. Validation & migration (Phase 1+ behavior, contracted now)

- Validate envelope structure, `format`, supported `schemaVersion`, and canonical section/field shapes.
- Reject unknown/unsupported major versions with clear, user-readable errors; ignore safely or warn on unknown keys as appropriate (with reporting in UI/manager).
- Provide a migration hook point: `schemaVersion < current` runs registered migrations to current (none required for v1).
- Normalize values (types/ranges/enums) per registry before apply/export.

---

## 7. Code-level stubs (Phase 0)

Implemented in **`packages/settings`** (`@dice/settings`, no UI wiring, no runtime behavior changes):

- `src/constants.js` — `SETTINGS_FORMAT`, `SCHEMA_VERSION`, `SETTINGS_KINDS`, `RESET_MARKER_KEY`, `SECTION_IDS`, filename helpers, `defaultSettingsStorageKey`, reset-marker helpers.
- `src/envelope.js` — `createEnvelope`, `validateEnvelopeStructure` (skeleton).
- `src/schema.js` — canonical settings skeleton/normalize/validate stubs (Phase 1 to complete).
- `src/merge.js` — `mergeSettingsPatch` (deep object merge + reset removal skeleton), `extractSection` stub; replace-at-node arrays per contract baseline.
- `src/storage.js` — per-app storage key + `load/save/clearDefaultSettings` no-op skeletons (API locked for Phase 1).
- `src/registry.js` — section registry/descriptor stubs, `listSections`, `getSectionDescriptor`, visibility stub (matrix documented in INVENTORY.md).
- `src/index.js` — public exports.
- `test/contracts.test.js` — unit-test scaffolding covering core contract constants/helpers.

Phase 1 will replace stubs with full implementations, adapters, and comprehensive tests while preserving these contracts unless a documented, versioned evolution is required.
