import { DiceError } from '@dice/core';

import { assertValues } from './sum.js';

/**
 * Build a keep plan for a partial reroll.
 *
 * `keep` may be an array of indices into `values` (the dice to hold) or an
 * array of booleans with the same length as `values` (`true` means hold).
 * The plan is plain data: it never mutates the input and never touches dice
 * entities or the world.
 *
 * @param {{ values: number[], keep: number[]|boolean[] }} input
 * @returns {{ keepIndices: number[], keptValues: number[], rerollIndices: number[], rerolledValues: number[], keptCount: number, rerollCount: number }}
 */
export function createKeepPlan({ values, keep }) {
  assertValues(values, 'values');
  if (!Array.isArray(keep)) {
    throw new DiceError('keep must be an array of indices or booleans.', {
      code: 'INVALID_KEEP_PLAN'
    });
  }

  /** @type {number[]} */
  let keepIndices;

  if (keep.length > 0 && typeof keep[0] === 'boolean') {
    if (keep.length !== values.length) {
      throw new DiceError(
        'A boolean keep plan must have the same length as values.',
        { code: 'INVALID_KEEP_PLAN' }
      );
    }
    keepIndices = [];
    keep.forEach((held, index) => {
      if (held) keepIndices.push(index);
    });
  } else {
    keepIndices = [];
    const seen = new Set();
    for (const index of keep) {
      const numericIndex = /** @type {number} */ (index);
      if (
        !Number.isInteger(numericIndex) ||
        numericIndex < 0 ||
        numericIndex >= values.length
      ) {
        throw new DiceError(
          `Keep index ${String(index)} is outside 0..${values.length - 1}.`,
          { code: 'INVALID_KEEP_PLAN' }
        );
      }
      if (seen.has(numericIndex)) {
        throw new DiceError(`Keep index ${numericIndex} is duplicated.`, {
          code: 'INVALID_KEEP_PLAN'
        });
      }
      seen.add(numericIndex);
      keepIndices.push(numericIndex);
    }
    keepIndices.sort((a, b) => a - b);
  }

  const keepSet = new Set(keepIndices);
  const rerollIndices = values
    .map((_, index) => index)
    .filter((index) => !keepSet.has(index));

  return {
    keepIndices,
    keptValues: keepIndices.map((index) => values[index]),
    rerollIndices,
    rerolledValues: rerollIndices.map((index) => values[index]),
    keptCount: keepIndices.length,
    rerollCount: rerollIndices.length
  };
}

/**
 * Whether `keep` is a valid keep plan for `values` without throwing.
 *
 * @param {{ values: number[], keep: number[]|boolean[] }} input
 * @returns {boolean}
 */
export function isValidKeepPlan({ values, keep }) {
  try {
    createKeepPlan({ values, keep });
    return true;
  } catch {
    return false;
  }
}
