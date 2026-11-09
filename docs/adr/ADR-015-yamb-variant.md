# ADR-015 — Yamb Uses a Confirmed Variant, Not an Implicit Rules Set

**Status:** Accepted
**Date:** 2026-11-08
**Context:** See `.planning/repo-reorganization/05-decisions.md` (ADR-015,
planning decision log). Yamb has multiple regional variants. This ADR
fixes the one variant the Dice Playground Yamb app ships. Scoring
fixtures in `apps/games/yamb/test/scoring.test.js` are derived from the
table below.

This is the **Dice Playground Yamb variant v1**, based on the standard
Yamb structure (five D6 dice, three rolls, four columns). Where standard
Yamb traditions differ, the formulas below are authoritative.

## Decision

### Dice and players

- Five D6 dice per roll.
- Two to four local hot-seat players.
- Players take turns in fixed order (Player 1, Player 2, ...).
- Each turn: up to three rolls. After roll 1 and roll 2 the player may
  keep any subset of dice and reroll the rest. After roll 3 the player
  must score. Rerolling with all five dice kept is not allowed.
- Kept dice keep their values across rerolls.

### Columns and fill order

- Four columns per player, filled strictly in this order:
  `down` → `up` → `free` → `announcement`. A column may only receive
  scores once every earlier column is complete (all 13 categories
  filled). The active column is derived, never chosen.
- Within the active column, categories may be scored in any order.
- A category may be scored at most once per player per column.

### Announcement rules (announcement column only)

- Before the first roll of a turn played in the announcement column,
  the player must announce (select) the category they intend to score.
  Rolling is disabled until a category is announced.
- The announced category is locked for the turn. The score recorded is
  the score of the announced category for the final hand, including 0
  when the hand does not qualify. There is no fallback to another
  category.

### Categories and exact scoring formulas

Scores are computed from the final five values of the turn.

| Category | Score |
| :--- | :--- |
| `ones` | Sum of dice showing 1 |
| `twos` | Sum of dice showing 2 |
| `threes` | Sum of dice showing 3 |
| `fours` | Sum of dice showing 4 |
| `fives` | Sum of dice showing 5 |
| `sixes` | Sum of dice showing 6 |
| `total` | Sum of all five dice |
| `min` | Value of the lowest die |
| `max` | Value of the highest die |
| `straight` | 30 if the hand is exactly {1,2,3,4,5} or {2,3,4,5,6}; otherwise 0 |
| `fullHouse` | 25 if the hand is three of one value plus two of another; otherwise 0. Five of a kind is not a full house. |
| `poker` | 30 if at least four dice show the same value; otherwise 0 |
| `yamb` | 50 if all five dice show the same value; otherwise 0 |

### Bonuses and totals

- Upper bonus: for each column independently, when `ones` through
  `sixes` are all filled and their subtotal is 60 or more, add a
  one-time bonus of 20 to that column's subtotal.
- Column subtotal = sum of the column's category scores, plus the upper
  bonus when earned.
- Grand total = sum of the four column subtotals.
- Totals are always derived from the scorecard; they are never stored
  as source of truth.

### Tie-breaking and winner

- The player with the highest grand total wins. Ties are displayed as
  ties (all tied players are named); there is no further tie-break.
- The game ends when every player has filled all 13 categories in all
  four columns (52 scored cells per player).

### Scoring fixtures

| Hand (sorted) | ones | twos | threes | fours | fives | sixes | total | min | max | straight | fullHouse | poker | yamb |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [1,1,1,1,1] | 5 | 0 | 0 | 0 | 0 | 0 | 5 | 1 | 1 | 0 | 0 | 30 | 50 |
| [6,6,6,6,6] | 0 | 0 | 0 | 0 | 0 | 30 | 30 | 6 | 6 | 0 | 0 | 30 | 50 |
| [1,2,3,4,5] | 1 | 2 | 3 | 4 | 5 | 0 | 15 | 1 | 5 | 30 | 0 | 0 | 0 |
| [2,3,4,5,6] | 0 | 2 | 3 | 4 | 5 | 6 | 20 | 2 | 6 | 30 | 0 | 0 | 0 |
| [3,3,3,5,5] | 0 | 0 | 9 | 0 | 10 | 0 | 19 | 3 | 5 | 0 | 25 | 0 | 0 |
| [4,4,4,4,2] | 0 | 2 | 0 | 16 | 0 | 0 | 18 | 2 | 4 | 0 | 0 | 30 | 0 |
| [2,2,3,5,6] | 0 | 4 | 3 | 0 | 5 | 6 | 18 | 2 | 6 | 0 | 0 | 0 | 0 |
| [1,1,2,3,4] | 2 | 2 | 3 | 4 | 0 | 0 | 11 | 1 | 4 | 0 | 0 | 0 | 0 |

Upper-bonus example: a column with ones=3, twos=6, threes=9, fours=12,
fives=15, sixes=18 sums to 63, which is at least 60, so the column
subtotal includes a 20-point bonus. A subtotal of 59 earns no bonus.

## Alternatives considered

- Implement a "common" variant from memory. Rejected: likely wrong and
  untestable.
- Build a general tabletop rules framework first. Rejected: too broad;
  delays the first game.
- Skip Yamb. Rejected: contradicts the goal of a first real game.

## Consequences

- Phase 11 (Yamb) is unblocked: the app ships only against this variant.
- The scorecard data model is driven by the columns/categories above.
- Yamb-specific rules stay in `apps/games/yamb`; only generic helpers
  live in `@dice/rules`.
- Future Yamb variants can be additional profiles or a later app without
  changing the ADR-015 v1 contract.
