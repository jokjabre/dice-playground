# `@dice/ui`

Framework-agnostic vanilla DOM UI: result presenters, schema-driven
controls, HUD primitives, and styles. The package imports only
`@dice/core` event names; it never imports the engine or any runtime
package, and it never uses `innerHTML` with dynamic strings.

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

const banner = new ResultBanner({ events: engine.events, autoHide: 4000 });
const panel = new ControlPanel({
  title: 'Engine',
  items: [
    { id: 'enclosure', type: 'select', label: 'Enclosure', options: [...] },
    { id: 'gravity', type: 'range', label: 'Gravity', min: -5000, max: 0, step: 10 }
  ]
});
panel.on('change', ({ id, value }) => { /* wire to engine commands */ });
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
- **Styles** — import the documented subpath, e.g.
  `import '@dice/ui/styles/base.css'`. Themes are CSS variables
  (`--dice-ui-*`); apps override variables, not selectors.

## Tests

```bash
npm test --workspace @dice/ui
```
