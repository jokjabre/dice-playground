import { DiceError } from '@dice/core';

import { assertValues } from './sum.js';

/**
 * Count how many times each distinct value occurs.
 *
 * @param {number[]} values
 * @returns {Record<number, number>} Plain object mapping value to count.
 */
export function countByValue(values) {
  assertValues(values);
  /** @type {Record<number, number>} */
  const counts = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

/**
 * @param {number} face
 * @param {number} count
 * @returns {void}
 */
function assertFaceAndCount(face, count) {
  if (!Number.isInteger(face)) {
    throw new DiceError('face must be an integer.', { code: 'INVALID_FACE' });
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new DiceError('count must be an integer >= 1.', {
      code: 'INVALID_COUNT'
    });
  }
}

/**
 * Whether `face` occurs at least `count` times.
 *
 * @param {number[]} values
 * @param {number} face
 * @param {number} count
 * @returns {boolean}
 */
export function hasAtLeast(values, face, count) {
  assertFaceAndCount(face, count);
  return (countByValue(values)[face] ?? 0) >= count;
}

/**
 * Whether `face` occurs exactly `count` times.
 *
 * @param {number[]} values
 * @param {number} face
 * @param {number} count
 * @returns {boolean}
 */
export function hasExactly(values, face, count) {
  assertFaceAndCount(face, count);
  return (countByValue(values)[face] ?? 0) === count;
}

/**
 * The `n` largest values, in descending order. Never mutates the input.
 *
 * @param {number[]} values
 * @param {number} n
 * @returns {number[]}
 */
export function topValues(values, n) {
  assertValues(values);
  if (!Number.isInteger(n) || n < 0) {
    throw new DiceError('n must be an integer >= 0.', { code: 'INVALID_COUNT' });
  }
  return values.slice().sort((a, b) => b - a).slice(0, n);
}
