# @dice/settings (Phase 0 stub)

This package holds the **code-level contracts and stubs** for the Dice Playground configuration overhaul. Phase 0 establishes the canonical section/field inventory direction, envelope/schema contracts, reset/merge semantics, and pure helper skeletons **without UI wiring or disruptive behavior changes**.

- Source-of-truth planning: `.planning/config-overhaul/README.md`
- Phase 0 inventory/contracts: `.planning/config-overhaul/INVENTORY.md`, `.planning/config-overhaul/CONTRACTS.md`

Subsequent phases (Phase 1+) will implement the full schema definitions, validation, adapters, diff/dirty tracking, persistence, and registry-driven UI bindings on top of these stubs. Current exports are intentionally minimal and side-effect free.
