# Yamb

First real game for the dice engine, and the proof that the engine/rules
split works. Five D6 dice, three rolls per turn, keep/hold rerolls, and a
four-column scorecard.

Rules are fixed by
[`docs/adr/ADR-015-yamb-variant.md`](../../../../docs/adr/ADR-015-yamb-variant.md)
(Dice Playground Yamb variant v1). Scoring fixtures in
`test/scoring.test.js` are derived from that ADR. Yamb-specific rules
live in `src/game/`; only generic helpers come from `@dice/rules`.

## Run

```bash
npm install
npm run dev:yamb
```

Open http://localhost:5180/apps/games/yamb/

## Play

1. Choose 2–4 players and press **Start game**. Player 1 rolls.
2. **Roll** throws five dice. Activate dice in the tray to hold them for
   the reroll. You may reroll up to three times total; rerolling with all
   five dice held is not allowed.
3. Select an unfilled category in the active column (the preview shows
   its score), then press **Score**. The turn passes to the next player
   and their first roll starts automatically.
4. Columns fill strictly in order: Down → Up → Free → Announcement. In
   the Announcement column you must select (announce) a category before
   rolling; the announced category is locked for that turn.
5. The game ends when every player has filled all 13 categories in all
   four columns. Highest grand total wins; ties are shown as ties.

Progress is saved to `localStorage`. Reloading offers **Continue saved
game** (the active turn restarts). **New game** returns to setup.

## Controls

- **Roll** — start the next roll (first roll or reroll of unheld dice).
- Dice tray buttons — hold/release a die (keyboard: Tab + Space/Enter).
- Scorecard cells — select a category; filled cells are locked.
- **Score** — commit the selected category for the current hand.
- **Clear holds** — release all held dice.
- **New game** — back to setup.

Query parameters:

- `?seed=<value>` — repeatable throw vectors.
- `?maxSubSteps=<n>&maxFrameGap=<seconds>` — raise the game loop sub-step
  budget and frame-gap clamp. Used by the Playwright specs to fast-forward
  the fixed-step loop under software rendering, where frames arrive far
  below real time. Defaults match the engine defaults.

## Implementation notes

The app composes only public package entries (`@dice/engine`,
`@dice/input`, `@dice/ui`, `@dice/content`, `@dice/core`,
`@dice/rules`). Turn flow is a pure reducer (`src/game/gameState.js`);
scoring is pure (`src/game/scoring.js`) on top of generic `@dice/rules`
helpers. The engine provides five dice, stable die ids, selection, and
partial reroll through `roll({ keep })`. If the engine cannot start (for
example, WebGL is unavailable), a readable failure message is shown
instead of the stage.
