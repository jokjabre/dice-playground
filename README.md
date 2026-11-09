# Dice Playground

A modular 3D dice engine and a collection of sandbox, demo, and game apps.

The repository is being reorganized in phases. The new engine lives in
`packages/` and the apps live in `apps/`; the pre-reorganization demo is frozen
in `legacy/` and remains runnable until the new sandbox reaches parity.

## Requirements

- Node 22 LTS with npm

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:5173/legacy/dice/> to run the frozen legacy demo.

## Scripts

| Script | Purpose |
| :--- | :--- |
| `npm run dev` | Root Vite server; serves the legacy demo at `/legacy/dice/`. |
| `npm run dev:legacy` | Same server, opening the legacy demo URL. |
| `npm run dev:sandbox` | Future sandbox app dev server. |
| `npm run build` | Registry-driven multi-app production build. |
| `npm run preview` | Preview the production build. |
| `npm test` | Vitest unit/component tests. |
| `npm run test:e2e` | Playwright end-to-end tests. |
| `npm run check` | Type check, lint, and package-boundary check. |

## Layout

```text
packages/   Engine libraries, added phase by phase.
apps/       Sandbox, demos, games, and landing page.
tools/      Shared Vite, build, registry, and check scripts.
docs/       Stable architecture guides and ADR index.
.planning/  Plans and migration notes.
legacy/     Frozen pre-reorganization demo.
```

## Documentation

- [Migration roadmap](.planning/repo-reorganization/02-migration-roadmap.md)
- [Target architecture](.planning/repo-reorganization/01-architecture.md)
- [Docs index](docs/README.md)

