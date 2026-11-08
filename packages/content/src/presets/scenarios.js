import { DiceError } from '@dice/core';

/**
 * Shared throw scenarios. Plain frozen data.
 *
 * @type {Readonly<Record<string, Readonly<Record<string, any>>>>}
 */
export const SCENARIOS = Object.freeze({
  standard: Object.freeze({ throw: 'flick', dice: 6 }),
  singleDie: Object.freeze({ throw: 'flick', dice: 1 }),
  yambFive: Object.freeze({ throw: 'flick', dice: 5 }),
  predeterminedSix: Object.freeze({
    throw: 'flick',
    dice: 6,
    values: Object.freeze([6, 6, 6, 6, 6, 6])
  })
});

/**
 * @param {string} id
 * @returns {Readonly<Record<string, any>>}
 */
export function getScenario(id) {
  const scenario = SCENARIOS[id];
  if (!scenario) {
    throw new DiceError(`Unknown scenario: ${id}`, {
      code: 'UNKNOWN_SCENARIO'
    });
  }
  return scenario;
}
