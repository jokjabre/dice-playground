# `@dice/rules`

Generic dice result helpers: sums, counts, combinations, and keep plans.
Pure functions over plain value arrays. No physics, no DOM, no UI, and no
game-specific scoring — Yamb and future games compose these helpers.

## Public entry

```js
import {
  sum,
  countByValue,
  hasAtLeast,
  hasExactly,
  isNOfAKind,
  isFullHouse,
  isStraight,
  topValues,
  createKeepPlan
} from '@dice/rules';

sum([1, 2, 3]);                    // 6
countByValue([3, 3, 5]);           // { '3': 2, '5': 1 }
hasAtLeast([4, 4, 4], 4, 3);       // true
isFullHouse([3, 3, 3, 5, 5]);      // true
isStraight([2, 3, 4, 5, 6]);       // true (whole hand by default)
createKeepPlan({ values: [1, 2, 3], keep: [0] });
// { keepIndices: [0], keptValues: [1], rerollIndices: [1, 2], ... }
```

- `countByValue` returns a plain object mapping value to count.
- `isStraight(values, length?)` checks for a consecutive run; without a
  length it checks the whole hand. Duplicates do not break a run.
- `topValues(values, n)` returns the `n` largest values, descending.
- `createKeepPlan({ values, keep })` accepts keep indices or a boolean
  array and returns `{ keepIndices, keptValues, rerollIndices,
  rerolledValues, keptCount, rerollCount }`. Invalid plans throw a
  `DiceError`; `isValidKeepPlan` checks without throwing.

## Tests

```bash
npm test --workspace @dice/rules
```
