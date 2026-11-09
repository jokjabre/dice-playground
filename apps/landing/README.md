# Landing Page

Registry-driven directory of the sandbox, demos, and games. Imports
`apps/registry.json` at build time through the shared `@registry` Vite
alias, groups cards by category (Sandbox, Demos, Games), and shows a
status badge for every entry.

The landing page contains no engine bundle; it is a static shell that
links to apps relative to the GitHub Pages base path (`./<app url>`).

## Run

```bash
npm install
npm run dev:landing
```

Open http://localhost:5176/
