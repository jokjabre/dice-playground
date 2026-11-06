# Apps, Demos, and Games

This document defines what lives above the engine packages: the sandbox, focused demos, the landing page, and the first real game, Yamb.

The core rule: **apps compose; they do not extend engine internals.** If an app needs a new engine capability, it is added as a documented public API or plugin, not by reaching into a package's internals.

---

## 1. App Taxonomy

| Category | Purpose | Examples |
| :--- | :--- | :--- |
| **Sandbox** | Explore the full engine and all major controls in one place. | `apps/sandbox` |
| **Demo** | Showcase one subsystem or capability well. Small, focused, educational. | Enclosure gallery, physics lab, predetermined roll, dice visual lab |
| **Game** | Deliver an actual playable experience with rules, turns, and scoring. | Yamb |
| **Landing** | Directory of apps with status, description, and links. | `apps/landing` |

Apps are independent Vite projects. They may share code through packages, but not through each other. If two apps need the same app-level utility, promote it to a package only when the third use appears.

---

## 2. App Template

Every app follows the same structure:

```text
apps/<category>/<app-id>/
├─ index.html
├─ vite.config.js
├─ package.json
├─ README.md
├─ src/
│  ├─ main.js          # bootstrap: mount root, create engine, handle teardown
│  ├─ app.js           # composition: engine + UI + content
│  ├─ content.js       # app-local content presets
│  └─ styles.css       # app-specific layout/theme
└─ test/               # optional app-local unit tests
```

Conventions:

- `index.html` contains a mount element and `<script type="module" src="./src/main.js"></script>`. No global Three/Cannon scripts.
- `package.json` is private and uses `@dice/app-<id>`.
- `vite.config.js` uses `tools/vite-app.config.js`.
- `main.js` must handle:
  - Loading state.
  - WebGL/engine initialization failure with a readable message.
  - `ResizeObserver` → `engine.resize(...)`.
  - Teardown on `beforeunload` and `import.meta.hot.dispose`.
- `app.js` wires engine, UI, input, and content. It should be readable without opening engine packages.
- `content.js` holds app-specific content packs; shared presets come from `@dice/content`.
- Interactive elements get stable `data-testid` attributes for Playwright.
- `window.__diceApp` may expose the engine only in development/test builds.
- No direct DOM access to engine internals; use public API and events.
- No game rules in `main.js` or `app.js` beyond wiring; games put rules in `src/game/`.

### Bootstrap sketch

```js
import { createDiceEngine } from '@dice/engine';
import { PointerInput } from '@dice/input';
import { ResultBanner, ControlPanel } from '@dice/ui';
import { classicTray } from '@dice/content';
import './styles.css';

const stage = document.querySelector('#stage');

try {
  const engine = await createDiceEngine({
    container: stage,
    content: classicTray,
    seed: new URLSearchParams(location.search).get('seed') || undefined
  });

  engine.use(new PointerInput({ container: stage }));

  const banner = new ResultBanner({ events: engine.events, autoHide: 4000 });

  const resize = new ResizeObserver(() => engine.resize());
  resize.observe(stage);

  engine.roll({ dice: 6 }).catch((error) => {
    if (error.name !== 'RollCancelledError') console.error(error);
  });

  if (import.meta.env.DEV) {
    window.__diceApp = { engine, banner };
  }

  window.addEventListener('beforeunload', () => engine.destroy());
  import.meta.hot?.dispose(() => engine.destroy());
} catch (error) {
  stage.textContent = 'Unable to start the 3D dice engine: ' + error.message;
  console.error(error);
}
```

---

## 3. Registry, Build, and Landing

### Registry

`apps/registry.json` is the single source of truth for:

- Landing page cards.
- Build script inputs.
- CI app smoke tests.
- Documentation links.

Entry shape:

```json
{
  "id": "enclosure-gallery",
  "category": "demo",
  "title": "Enclosure Gallery",
  "description": "Box, sphere, and cylinder physics with live switching.",
  "path": "apps/demos/enclosure-gallery",
  "url": "apps/demos/enclosure-gallery/",
  "status": "planned",
  "tags": ["physics", "enclosures", "rendering"]
}
```

Statuses: `planned`, `wip`, `live`, `archived`.

### Build script

`tools/build-apps.mjs`:

1. Deletes `dist/` once at the start.
2. Reads and validates the registry.
3. For each `live` or explicitly selected app, runs Vite build with the app config.
4. Writes output to `dist/<url>` with `emptyOutDir: false`.
5. Builds the landing page last into `dist/` with `emptyOutDir: false`.
6. Writes `dist/.nojekyll`.
7. Fails if a live app has no `index.html` or build output.
8. Prints a route summary for deployment.

Each app's Vite base is its route, for example `/dice-playground/apps/demos/enclosure-gallery/`. Do not use a single root-level base for nested apps; that points assets at the wrong directory. The shared factory sets `root` to the app directory and `emptyOutDir: false`.

### Landing page

`apps/landing`:

- Imports the registry at build time through the shared `@registry` Vite alias.
- Groups cards by category: Sandbox, Demos, Games.
- Shows status badges and short descriptions.
- Links to each app relative to the Pages base path.
- Links to the repository README or absolute GitHub docs URLs; `docs/` is not part of the Pages artifact unless explicitly copied.
- Contains no engine bundle; it should load instantly.
- Supports light/dark via CSS variables and `prefers-color-scheme`.

---

## 4. Sandbox

**Path:** `apps/sandbox`
**Role:** Full multi-mode playground and parity target for the legacy demo.

### Modes

| Mode | Behavior |
| :--- | :--- |
| **Standard roll** | Flick/drag to throw; dice settle; result banner; loop stops. |
| **Continuous** | Physics never stops; motion sensors and pointer interaction can keep jostling dice. |
| **Predetermined** | Enter target values; prediction + face mapping make the visible roll land on them. |

### Controls

- Mode selector.
- Enclosure selector: box / sphere / cylinder.
- Throw.
- Clear.
- Motion enable/disable with status.
- Predetermined target input and roll button.
- Camera distance slider, near/far fields, reset.
- Optional debug panel: gravity, body count, iteration rate. Keep it behind a toggle.

### Layout

- Full-viewport stage.
- Floating engine panel, initially collapsed on mobile.
- Result banner centered and accessible.
- Escape closes the panel; focus returns to the toggle.
- Safe-area insets on notched devices.

### Parity checklist

- [ ] Six D6 default dice.
- [ ] Mouse drag/flick.
- [ ] Touch drag/flick.
- [ ] Standard settle detection.
- [ ] Result banner with individual values and total.
- [ ] Continuous mode.
- [ ] Motion permission and status.
- [ ] Predetermined values.
- [ ] Box enclosure.
- [ ] Sphere enclosure.
- [ ] Cylinder enclosure.
- [ ] Camera distance/near/far/reset.
- [ ] Resize.
- [ ] Clear.
- [ ] Initial roll.
- [ ] No console errors.
- [ ] Mobile viewport usable.

### Intentional differences from legacy

- New UI composition and accessibility.
- Real cylinder collision instead of placeholder physics.
- No global Three/Cannon scripts or singleton objects.
- Legacy URL is not preserved.

---

## 5. Focused Demos

### 5.1 Enclosure Gallery (first demo)

**Path:** `apps/demos/enclosure-gallery`
**Purpose:** Prove the World, Physics, Rendering, and Enclosure boundaries.

Features:

- Three large enclosure cards/buttons: Box, Sphere, Cylinder.
- Switching clears dice, rebuilds boundaries, and performs a fresh roll.
- Throw and clear controls.
- Result banner.
- Gravity direction presets (down, tilt left, tilt right, zero-g).
- Camera distance/reset.
- Info panel: enclosure dimensions, body count, active material pairs.
- Short explanatory copy for each enclosure.
- Visual treatment: wireframe/glass shell for sphere and cylinder, tray outline for box.

Tests:

- Load app, no console errors.
- Switch to sphere; dice remain contained after a roll.
- Switch to cylinder; dice remain contained.
- Result banner appears after settle.
- Gravity preset changes behavior.
- Resize does not distort the scene.

Stretch goals:

- Register a custom enclosure from app-local code as a documented example.
- URL parameter to deep-link an enclosure (`?enclosure=sphere`).

### 5.2 Physics Lab

**Path:** `apps/demos/physics-lab`
**Purpose:** Make the physics adapter observable and tunable.

Features:

- Gravity X/Y/Z sliders with numeric readouts.
- Global friction/restitution controls.
- Per-surface material table (desk, walls, sphere, glass).
- Linear and angular damping.
- Die mass.
- Settle threshold and fixed timestep through `engine.setSettleConfig`/`engine.setLoopConfig`.
- Reset to content defaults.
- Live stats: body count, iterations, elapsed time.
- Throw/clear/reset.
- Enclosure selector.

Tests:

- Changing gravity moves dice in the expected direction.
- Friction change affects slide/settle behavior in a headless assertion.
- Reset restores defaults.
- No direct Cannon imports in the app.

### 5.3 Predetermined Roll Showcase

**Path:** `apps/demos/predetermined-roll`
**Purpose:** Explain and demonstrate the optional determinism package.

Features:

- Per-die target inputs (1–6).
- Mode toggle: `predict-only` / `predict-and-shift`.
- Predict-only shows natural results after a headless prediction.
- Predict-and-shift shows requested values and the applied face mapping.
- Explanation panel: what is predicted, what is shifted, what is not promised.
- Validation for invalid or incomplete targets.
- Throw and clear.
- Optional seed input for repeatable vectors.

Tests:

- `[6,6,6]` target produces three sixes after settle.
- Predict-only does not force values.
- Invalid target shows an error and does not throw.
- Prediction does not move live dice before the visible throw.
- Determinism package remains optional: app without plugin rejects `values`.

### 5.4 Dice Visual Lab

**Path:** `apps/demos/dice-visual-lab`
**Purpose:** Showcase pure dice data, rendering, and face mapping.

Features:

- Chamfer slider.
- Radius slider.
- Body/label color pickers.
- Material shininess/specular controls.
- Face mapping editor or preset rotations.
- Flat vs smooth shading (when the modern backend exists).
- Future: die type selector for D4/D8/D10/D12/D20.
- Wireframe toggle.
- Reset.

Tests:

- Geometry rebuilds without memory leaks.
- Face mapping update changes displayed labels, not geometry identity.
- Changing colors updates materials.
- No Cannon imports.

### 5.5 Optional Future Demos

- **Motion playground:** tilt/shake visualization with live gravity vector.
- **Throw physics:** trajectory and impulse visualization.
- **Polyhedral gallery:** D4–D20 comparison.
- **Performance lab:** body count and timestep stress test.

Add these only when they demonstrate something the existing demos do not.

---

## 6. Yamb

**Path:** `apps/games/yamb`
**Role:** First real game and the proof that the engine + rules split works.

**Rules prerequisite:** Expand ADR-015 from the planning decision log into `docs/adr/ADR-015-yamb-variant.md`. It must fix:

- Dice count (Yamb standard is five D6; the engine supports any count).
- Columns and their fill order.
- Category list and exact scoring formulas.
- Bonus thresholds and whether they apply to every column.
- Announcement timing, eligibility, and penalty.
- Tie-breaking and final winner rules.
- Turn order and player count limits.

Phase 11 is blocked until this ADR exists. Tests are written from its fixture table; the app does not invent rules during implementation.

### 6.1 Scope for the First Release

- Five D6 dice, confirmed by the rules ADR.
- Two to four local hot-seat players.
- Three rolls per turn.
- Keep/hold selected dice between rolls.
- Scorecard with number categories and combination categories.
- Configurable column rules, with one default variant from the ADR.
- New game, player setup, turn indicator, totals.
- No network play.
- Optional practice mode with predetermined rolls (clearly labeled).
- Persistence can land in a later slice.

### 6.2 Engine Capabilities Required

The engine already needs these before Yamb:

- Configurable dice count (five, not the sandbox default six).
- Stable die ids across a turn.
- Selection/held state per die.
- Partial reroll: keep selected dice, remove and respawn the rest.
- Values and face mappings preserved for kept dice.
- Event with all dice values on settle.
- Touch/tap picking through `InputHost.pick()` (rendering picking service behind it).
- Optional predetermined values for tests/practice.
- Headless simulation for rule tests.

These capabilities belong in `@dice/world` and public engine APIs, not in Yamb.

### 6.3 App Structure

```text
apps/games/yamb/
├─ index.html
├─ vite.config.js
├─ package.json
├─ README.md
├─ src/
│  ├─ main.js
│  ├─ app.js
│  ├─ content.js
│  ├─ game/
│  │  ├─ gameState.js
│  │  ├─ gameReducer.js
│  │  ├─ turn.js
│  │  ├─ actions.js
│  │  └─ scoring/
│  │     ├─ categories.js
│  │     ├─ scoreCategory.js
│  │     ├─ columns.js
│  │     ├─ totals.js
│  │     └─ variant.js
│  ├─ ui/
│  │  ├─ scorecard.js
│  │  ├─ diceTray.js
│  │  ├─ controls.js
│  │  ├─ playerBar.js
│  │  └─ dialogs.js
│  └─ styles.css
└─ test/
   ├─ scoring.test.js
   └─ turn.test.js
```

### 6.4 State Model

```js
{
  variant: { /* columns, categories, announcement rules */ },
  players: [
    {
      id: 'p1',
      name: 'Player 1',
      scorecard: {
        down: { ones: null, twos: null, /* ... */ },
        up: { /* ... */ },
        free: { /* ... */ },
        announcement: { /* ... */ }
      }
    }
  ],
  activePlayerIndex: 0,
  phase: 'setup' | 'idle' | 'rolling' | 'selecting' | 'scoring' | 'game-over',
  turn: {
    rollCount: 0,
    selected: [false, false, false, false, false],
    values: [1, 2, 3, 4, 5],
    announced: null
  }
}
```

Rules:

- `rollCount` max 3.
- A held die stays across rerolls.
- Scoring requires an unfilled category in the active player's active column.
- Announcement rules may require a category/column to be chosen before a roll; this is variant-specific.
- Totals are derived, never stored as source of truth.
- Game over when all required categories are filled.

### 6.5 Rules and Scoring

Yamb-specific scoring stays in the app:

- Number categories: sum or count-based depending on variant.
- Min/Max.
- Straight variants.
- Full house.
- Poker (four of a kind).
- Yamb (five of a kind).
- Column bonuses and final totals.

`@dice/rules` provides generic helpers only:

```js
sum(values)
countByValue(values)
hasAtLeast(values, face, count)
isFullHouse(values)
isStraight(values, length)
```

Tests use table-driven fixtures:

- Every category with a fixed five-dice hand.
- Zero-score hands.
- Maximum-score hands.
- Column bonus thresholds.
- Announcement eligibility.
- Total calculation.

**Do not** implement scoring in `@dice/rules`. If a future game shares a genuinely generic primitive, add it there with its own tests.

### 6.6 Game Flow

```text
Setup players and variant
  → Active player starts turn
    → Roll 1 (all dice)
    → Select dice to keep
    → Roll 2 (reroll unheld)
    → Select dice to keep
    → Roll 3 (optional)
    → Choose a score category
    → Preview score
    → Commit score
    → Next player
  → Game over when all scorecard cells are filled
  → Final totals and winner
```

Edge cases:

- Scoring without rolling is not allowed.
- Rerolling with all dice held is not allowed.
- A category can only be filled once per player/column.
- If no valid category remains, the game should already be over.
- Ties are supported and displayed explicitly.
- Player changes during an active turn require a confirmation.

### 6.7 UI

Layout:

- Header: game title, active player, roll counter, new game.
- Main: 3D dice tray with five dice.
- Dice tray: tap/click a die to hold/release; held dice have a distinct visual state.
- Controls: Roll, Score, Clear selection.
- Scorecard: columns and categories, preview of potential score for the selected category, filled cells locked.
- Player bar: names, totals, active highlight.
- Result toast/banner for roll values.
- Game-over dialog with totals and winner.

Interaction:

- Click/tap die to toggle hold.
- Keyboard: focusable dice, Space/Enter toggles hold.
- Roll button disabled while rolling or after three rolls.
- Score button enabled only when a category is selected and valid.
- Category selection previews score before commit.
- `aria-live` announces roll results and score changes.
- Reduced motion disables non-essential animations.
- Mobile layout stacks scorecard below dice.

### 6.8 Persistence

Optional after the first playable slice:

- Save players, variant, scorecard, and turn state to `localStorage`.
- Restore on reload with a "Continue game" prompt.
- Version the save shape and migrate or discard incompatible saves.
- Never store engine instances, bodies, or meshes.

### 6.9 Delivery Slices

| Slice | Scope | Exit criteria |
| :--- | :--- | :--- |
| Y1 | Game shell, player setup, scorecard layout | App loads, players can start a game |
| Y2 | Turn/roll state, keep/reroll | Three rolls with five dice, held dice work |
| Y3 | Scoring categories and columns | All categories score correctly; totals update |
| Y4 | Announcement/variant rules | Selected variant fully playable |
| Y5 | Polish, persistence, accessibility | Full game e2e, mobile pass, save/restore |

### 6.10 Tests

Unit:

- Scoring fixtures for every category and column.
- Turn reducer: roll → hold → reroll → score → next player.
- Validation: no fourth roll, no duplicate category, no scoring before roll.
- Totals and bonuses.
- Variant configuration.

E2E:

- Start a game with two players.
- Roll, hold dice, reroll, score a category.
- Verify turn passes and totals update.
- Play a shortened game to completion with predetermined rolls.
- Reload and continue (persistence slice).
- Mobile viewport smoke.

---

## 7. Future Games and Mini-Apps

The architecture should make each of these an app, not an engine feature:

| Game | Engine needs | Notes |
| :--- | :--- | :--- |
| **Yahtzee-like** | 5 dice, keep/reroll, scorecard | Could share generic helpers with Yamb, not rules. |
| **Liar's Dice** | hidden dice, multiple players, bidding | Needs per-player visibility and network later. |
| **D&D dice roller** | polyhedral dice, many dice, modifiers | No physics rules; rendering + dice definitions. |
| **Craps** | two dice, betting state | Rules entirely app-local. |
| **Dice poker** | 5 dice, combinations, betting | App-local scoring. |
| **Bowling dice** | custom dice faces | Requires custom dice definitions and labels. |

Shared candidates only when proven by at least two games:

- Generic combination helpers → `@dice/rules`.
- Turn/scorecard framework → only if three games need the same model.
- Local save helpers → app-level until repeated.
- Online transport → a separate package much later.

---

## 8. Content Packs

### Shared presets (`@dice/content`)

- Tables: classic blue, dark studio, green felt (optional).
- Dice: classic dark, ivory, high-contrast.
- Enclosures: box tray, orb, cup.
- Scenarios: standard six, single die, Yamb five, predetermined six.

### App-local content

Each app may define local content in `src/content.js`:

- Demo-specific camera positions.
- Physics lab default overrides.
- Yamb table theme and five-dice set.
- Demo copy/descriptions.

Rules:

- Content is data, not classes.
- Content ids are stable; renaming requires a migration note.
- Content does not import engine runtime classes.
- Apps can load JSON content later without engine changes.
- Validation errors identify the exact path, e.g. `dice.count must be >= 1`.

---

## 9. UI and UX Conventions

- Shared visual language comes from `@dice/ui` CSS variables.
- Apps may override variables and layout, not internal selectors.
- Floating panels use the same focus/Escape behavior.
- Result banners are consistent across apps.
- Loading, empty, error, and WebGL-unavailable states are designed, not afterthoughts.
- Mobile first for controls: touch targets, safe areas, no hover-only actions.
- Prefer explicit labels over icon-only buttons.
- Use `prefers-reduced-motion`.
- Avoid blocking alerts; use inline status or dialogs.
- Every app has a short "what this shows" caption linking to docs.

---

## 10. Deployment

### Routes

```text
/dice-playground/                                  → landing
/dice-playground/apps/sandbox/                     → sandbox
/dice-playground/apps/demos/enclosure-gallery/     → enclosure gallery
/dice-playground/apps/demos/physics-lab/           → physics lab
/dice-playground/apps/demos/predetermined-roll/    → predetermined roll
/dice-playground/apps/demos/dice-visual-lab/       → dice visual lab
/dice-playground/apps/games/yamb/                  → Yamb
```

The old `/dice/` route is intentionally not preserved.

### Build

- `BASE_PATH=/dice-playground/` for production.
- The landing page's Vite base is `${BASE_PATH}` (`/dice-playground/`).
- Each app's Vite `base` is its full route, e.g. `/dice-playground/apps/demos/enclosure-gallery/`.
- Each app builds into its route path with `emptyOutDir: false`.
- `dist/` is cleaned once by the build script, then the landing page is built last with `emptyOutDir: false`.
- The vendored Three asset is loaded through a Vite `?url` import from a dynamically imported backend module, so it follows the app base.
- The Pages artifact is the entire `dist/` directory plus `.nojekyll`.

### Workflow

`.github/workflows/pages.yml`:

1. Trigger on `main` after CI succeeds.
2. Install dependencies with `npm ci`.
3. Set `BASE_PATH=/dice-playground/` in the job env.
4. Build all live apps.
5. Configure Pages with `actions/configure-pages`.
6. Upload `dist/` with `actions/upload-pages-artifact`.
7. Deploy with `actions/deploy-pages` using `pages: write` and `id-token: write` permissions.
8. Switch the repository's Pages source to GitHub Actions.

### Preview

- PR builds run Playwright against `vite preview` with the same `BASE_PATH` and app base as production.
- Verify nested routes and hashed assets in the built `dist/`, not only the dev server.
- Optional: deploy preview artifacts for manual mobile testing.

---

## 11. Definition of Done for an App

- Registered in `apps/registry.json` with status `live`.
- Builds through the shared app config with the correct base path.
- Loads without console errors on desktop and a mobile viewport.
- Has a README with purpose, controls, and implementation notes.
- Uses only public package imports.
- Has a Playwright smoke test and at least one focused interaction test; browser tests use software WebGL flags where needed and also cover the graceful WebGL-unavailable path.
- Handles loading, WebGL failure, and cleanup.
- Is responsive, keyboard-usable, and respects reduced motion.
- Links back to the landing page or docs.
- Adds no app-specific code to engine packages.
