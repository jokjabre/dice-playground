import { countByValue, isFullHouse, isStraight, sum } from '@dice/rules';

import {
  FULL_HOUSE_POINTS,
  POKER_POINTS,
  STRAIGHT_POINTS,
  UPPER_BONUS_POINTS,
  UPPER_BONUS_THRESHOLD,
  UPPER_CATEGORIES,
  YAMB_POINTS,
  getCategory,
  isCategory
} from './variant.js';

/**
 * Yamb scoring (Dice Playground Yamb variant v1).
 *
 * Pure functions over a five-dice hand. Generic combination helpers come
 * from `@dice/rules`; every Yamb-specific formula lives here and is
 * pinned by fixtures derived from `docs/adr/ADR-015-yamb-variant.md`.
 */

/**
 * Assert a five-dice hand of integers in 1..6.
 *
 * @param {number[]} values
 * @returns {number[]}
 */
export function assertHand(values) {
  if (!Array.isArray(values) || values.length !== 5) {
    throw new RangeError('A Yamb hand must contain exactly five dice.');
  }
  for (const value of values) {
    if (!Number.isInteger(value) || value < 1 || value > 6) {
      throw new RangeError('Yamb dice values must be integers from 1 to 6.');
    }
  }
  return values;
}

/**
 * Score one category for a hand. Returns 0 when the hand does not
 * qualify for a fixed-points category.
 *
 * @param {number[]} values
 * @param {string} categoryId
 * @returns {number}
 */
export function scoreCategory(values, categoryId) {
  assertHand(values);
  if (!isCategory(categoryId)) {
    throw new Error(`Unknown Yamb category: ${categoryId}`);
  }
  getCategory(categoryId);

  switch (categoryId) {
    case 'ones':
    case 'twos':
    case 'threes':
    case 'fours':
    case 'fives':
    case 'sixes': {
      const face = categoryId === 'ones' ? 1
        : categoryId === 'twos' ? 2
          : categoryId === 'threes' ? 3
            : categoryId === 'fours' ? 4
              : categoryId === 'fives' ? 5
                : 6;
      return (countByValue(values)[face] ?? 0) * face;
    }
    case 'total':
      return sum(values);
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'straight':
      return isStraight(values, 5) ? STRAIGHT_POINTS : 0;
    case 'fullHouse':
      return isFullHouse(values) ? FULL_HOUSE_POINTS : 0;
    case 'poker': {
      const counts = Object.values(countByValue(values));
      return counts.some((count) => count >= 4) ? POKER_POINTS : 0;
    }
    case 'yamb': {
      const counts = Object.values(countByValue(values));
      return counts.some((count) => count >= 5) ? YAMB_POINTS : 0;
    }
    default:
      // Unreachable: isCategory guards the switch.
      throw new Error(`Unknown Yamb category: ${categoryId}`);
  }
}

/**
 * Upper-section subtotal (ones..sixes) for one column.
 *
 * @param {Record<string, number|null>} column
 * @returns {number}
 */
export function upperSubtotal(column) {
  let total = 0;
  for (const category of UPPER_CATEGORIES) {
    total += column[category] ?? 0;
  }
  return total;
}

/**
 * Whether the upper bonus applies to a column: the upper section is
 * complete and its subtotal reaches the threshold.
 *
 * @param {Record<string, number|null>} column
 * @returns {boolean}
 */
export function hasUpperBonus(column) {
  const complete = UPPER_CATEGORIES.every(
    (category) => column[category] !== null && column[category] !== undefined
  );
  return complete && upperSubtotal(column) >= UPPER_BONUS_THRESHOLD;
}

/**
 * Column subtotal: sum of filled category scores plus the upper bonus
 * when earned.
 *
 * @param {Record<string, number|null>} column
 * @returns {number}
 */
export function columnSubtotal(column) {
  /** @type {number} */
  let total = 0;
  for (const value of Object.values(column)) {
    total += value ?? 0;
  }
  return total + (hasUpperBonus(column) ? UPPER_BONUS_POINTS : 0);
}

/**
 * Grand total for one player: sum of the four column subtotals.
 *
 * @param {{ scorecard: Record<string, Record<string, number|null>> }} player
 * @returns {number}
 */
export function grandTotal(player) {
  return Object.values(player.scorecard).reduce(
    (total, column) => total + columnSubtotal(column),
    0
  );
}

/**
 * Indices of the winning players (highest grand total). Ties return
 * every tied index.
 *
 * @param {Array<{ scorecard: Record<string, Record<string, number|null>> }>} players
 * @returns {number[]}
 */
export function winningPlayers(players) {
  if (players.length === 0) return [];
  const totals = players.map(grandTotal);
  const best = Math.max(...totals);
  /** @type {number[]} */
  const winners = [];
  totals.forEach((total, index) => {
    if (total === best) winners.push(index);
  });
  return winners;
}

/**
 * Whether every cell of a scorecard is filled.
 *
 * @param {Record<string, Record<string, number|null>>} scorecard
 * @returns {boolean}
 */
export function isScorecardComplete(scorecard) {
  return Object.values(scorecard).every((column) =>
    Object.values(column).every((value) => value !== null && value !== undefined)
  );
}
