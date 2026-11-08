import { DiceError } from '@dice/core';

/**
 * Validate that a value is an array of finite numbers.
 *
 * @param {unknown} values
 * @param {string} [label]
 * @returns {number[]}
 */
export function assertValues(values, label = 'values') {
  if (!Array.isArray(values)) {
    throw new DiceError(`${label} must be an array of numbers.`, {
      code: 'INVALID_VALUES'
    });
  }
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new DiceError(`${label} must contain only finite numbers.`, {
        code: 'INVALID_VALUES'
      });
    }
  }
  return values;
}

/**
 * Sum a list of dice values. An empty list sums to zero.
 *
 * @param {number[]} values
 * @returns {number}
 */
export function sum(values) {
  assertValues(values);
  return values.reduce((total, value) => total + value, 0);
}
