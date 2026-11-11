# `@dice/ui`

Framework-agnostic vanilla DOM UI: result presenters, schema-driven
controls, HUD primitives, shared settings UI primitives, and styles.
The package may import `@dice/core` (event names) and `@dice/settings`
(canonical settings contracts/Phase 1 APIs) from the workspace; it never
imports engine/runtime packages, and it never uses `innerHTML` with
dynamic strings.

## Public entry

```js
import {
  ResultBanner,
  SilentPresenter,
  CustomPresenter,
  ControlPanel,
  Toolbar,
  Panel,
  Status,
  createElement
} from '@dice/ui';
```

- **Presenters** accept `{ events }`, not an engine instance. The banner
  is an `aria-live="polite"` region with `data-testid="result-banner"`.
- **Controls** are `ControlItem` schemas (`select | range | number |
  text | toggle | button`) with labels, focus styles, and test ids.
  `ControlPanel` supports `on('change')`, `getValue`, `setValue`
  (silent), `setDisabled`, and `destroy`.
- **HUD** — `Toolbar` buttons, the collapsible `Panel` (Escape collapses
  and returns focus to its toggle), and `Status` (follows
  `motion:status`).

## Settings UI (Phase 2)

Shared, registry-driven settings primitives for per-section UI and
import/export flows (wired to `@dice/settings` Phase 1 APIs):

```js
import {
  SettingsSection,
  SettingsPanel,
  registerUiSection,
  getUiSection,
  listUiSections,
  createUiRegistry,
  renderField,
  downloadJsonFile,
  pickJsonFile
} from '@dice/ui';

registerUiSection({
  id: 'camera',
  label: 'Camera',
  fields: [
    { id: 'distance', path: ['distance'], type: 'range', label: 'Distance', min: 0.5, max: 3, step: 0.05, apply: 'hot' }
  ]
});

const section = new SettingsSection({ sectionId: 'camera', value: { distance: 1.1 } });
section.onChange(({ sectionId, path, value }) => { /* apply */ });
```

- **`SettingsSection`** renders one section from a UI definition (container/panel, grouped/sub-section layout via `group` fields, help text/constraints, per-field apply metadata).
- **`SettingsPanel`** composes multiple sections and provides consistent controls for export (scope: full/section, mode: overrides-only vs effective-minus-base), import (file pick + target section/auto), and apply/clear per-app default in browser storage.
- **File helpers:** `downloadTextFile`, `downloadJsonFile`, `pickTextFile`, `pickJsonFile` (DOM-only at call time).
- **UI registry:** declarative field/section definitions so adding or hiding a setting is primarily a registry change.

## Styles

Import the documented subpaths, e.g. `import '@dice/ui/styles/base.css'`,
`import '@dice/ui/styles/controls.css'`, and
`import '@dice/ui/styles/settings.css'`. Themes are CSS variables
(`--dice-ui-*`); apps override variables, not selectors.

## Tests

```bash
npm test --workspace @dice/ui
```
