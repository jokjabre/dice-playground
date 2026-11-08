# `@dice/content`

Declarative, serializable content packs: schema, validation, built-in
presets, and resolution. Content is plain JSON-compatible data; it never
imports physics, rendering, world, engine, DOM, or backend packages.

## Public entry

```js
import {
  defineContentPack,
  validateContentPack,
  resolveContent,
  classicTray
} from '@dice/content';

const pack = defineContentPack({
  id: 'my-tray',
  version: 1,
  enclosure: { type: 'box', margin: 0.93, ceiling: true },
  dice: { definition: 'd6', count: 6, style: 'classic' },
  table: { floorColor: '#2596be', background: '#0b0f19', lights: 'warm', shadows: true }
});

const check = validateContentPack(pack, { diceRegistry, enclosureRegistry, styleRegistry });
const resolved = resolveContent(pack, { diceRegistry, enclosureRegistry, styleRegistry, appOverrides });
```

- `defineContentPack(pack)` freezes and normalises a pack (structure only).
- `validateContentPack(pack, registries)` returns `{ ok, errors }` with
  content paths such as `dice.count must be >= 1`.
- `resolveContent(...)` merges defaults < pack < app overrides and returns
  concrete ids and values. Registries are injected; content never imports
  runtime packages.

## Presets

- Tables: `classic`, `darkStudio`, `greenFelt` (`TABLE_PRESETS`).
- Dice: `classic`, `dark`, `single`, `yambFive` (`DICE_PRESETS`), plus
  `DICE_STYLE_IDS = ['classic', 'dark']`.
- Enclosures: `box`, `sphere`, `cylinder` (`ENCLOSURE_PRESETS`) — ids and
  tunables only; definitions live in `@dice/enclosures`.
- Scenarios: `standard`, `singleDie`, `yambFive`, `predeterminedSix`
  (`SCENARIOS`).
- Built-in packs: `classicTray` (default) and `darkStudio`
  (`BUILTIN_CONTENT_PACKS`).

## Tests

```bash
npm test --workspace @dice/content
```
