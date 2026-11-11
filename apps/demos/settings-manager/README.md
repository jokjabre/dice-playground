# Settings Manager

Demo app for Dice Playground settings files (Phase 5).

## Features

- Load and inspect multiple settings files/envelopes
- Split files by section (and finer-grained key paths where supported)
- Merge/streamline multiple files with deterministic file ordering
- Manual conflict resolution UI with file-order/priority default suggestions
- Validation/reporting (envelope/schema issues, unknown/ignored keys, reset markers)
- Export resolved results (full or section, overrides-only or effective-minus-base)
- Best-effort scene preview of merged/selected settings in a selectable/generic context

## Notes

- Uses shared `@dice/settings` and `@dice/ui` utilities.
- Preview is best-effort and may be limited by runtime coupling; blockers are documented in the Phase 5 report when applicable.
