# Architecture Decision Records

This directory holds the stable decision log. During the reorganization, the
proposed decisions and full context are in
`.research/repo-reorganization/05-decisions.md`.

| ADR | Decision | Status |
| :--- | :--- | :--- |
| ADR-001 | Use an npm workspaces monorepo | Proposed |
| ADR-002 | JavaScript + JSDoc enforced by `tsc --checkJs` | Proposed |
| ADR-003 | Vite + npm dependencies | Proposed |
| ADR-004 | Migrate Cannon to `cannon-es` behind a strict adapter | Proposed |
| ADR-005 | Defer the Three.js upgrade; vendor r73 behind an adapter | Proposed |
| ADR-006 | Separate world runtime from content | Proposed |
| ADR-007 | Event-driven, framework-agnostic UI | Proposed |
| ADR-008 | Make determinism optional | Proposed |
| ADR-009 | Freeze legacy, build alongside, delete at parity | Proposed |
| ADR-010 | Build content as serializable data | Proposed |
| ADR-011 | Keep game rules in game apps | Proposed |
| ADR-012 | Deploy multiple apps to GitHub Pages | Proposed |
| ADR-013 | Facade first, public subpaths allowed | Proposed |
| ADR-014 | Organize apps as sandbox, demos, and games | Proposed |
| ADR-015 | Yamb uses a confirmed variant | Accepted ([ADR-015-yamb-variant.md](ADR-015-yamb-variant.md)) |

New stable ADRs should be added here as numbered files, for example
`ADR-016-<slug>.md`, and linked from this index.
