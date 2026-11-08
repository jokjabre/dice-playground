import { DiceError } from '@dice/core';

import { countByValue } from './counts.js';
import { assertValues } from './sum.js';

/**
 * Whether any value occurs at least `n` times.
 *
 * @param {number[]} values
 * @param {number} n
 * @returns {boolean}
 */
export function isNOfAKind(values, n) {
  assertValues(values);
  if (!Number.isInteger(n) || n < 1) {
    throw new DiceError('n must be an integer >= 1.', { code: 'INVALID_COUNT' });
  }
  return Object.values(countByValue(values)).some((count) => count >= n);
}

/**
 * Whether the hand is a full house: one value occurring three times and
 * another occurring twice (the five-dice shape). Five of a kind is not a
 * full house.
 *
 * @param {number[]} values
 * @returns {boolean}
 */
export function isFullHouse(values) {
  assertValues(values);
  const counts = Object.values(countByValue(values)).sort((a, b) => a - b);
  return counts.length === 2 && counts[0] === 2 && counts[1] === 3;
}

/**
 * Whether the hand contains a run of `length` consecutive distinct values.
 * When `length` is omitted it defaults to the number of dice, so
 * `isStraight([2, 3, 4, 5, 6])` checks the whole hand.
 *
 * @param {number[]} values
 * @param {number} [length]
 * @returns {boolean}
 */
export function isStraight(values, length) {
  assertValues(values);
  const needed = length ?? values.length;
  if (!Number.isInteger(needed) || needed < 1) {
    throw new DiceError('length must be an integer >= 1.', {
      code: 'INVALID_COUNT'
    });
  }
  if (needed === 1) return values.length > 0;

  const distinct = [...new Set(values)].sort((a, b) => a - b);
  if (distinct.length < needed) return false;

  let run = 1;
  for (let i = 1; i < distinct.length; i += 1) {
    if (distinct[i] === distinct[i - 1] + 1) {
      run += 1;
      if (run >= needed) return true;
    } else {
      run = 1;
    }
  }
  return false;
}
