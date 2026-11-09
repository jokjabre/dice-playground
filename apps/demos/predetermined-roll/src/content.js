/**
 * Predetermined-roll showcase content and pure target helpers.
 *
 * The demo uses `@dice/determinism` as an optional engine plugin. Targets
 * are per-die values in the D6 label range `[1, 6]`. Everything in this
 * module is pure so it can be unit-tested without a browser.
 */

export const PRED_DICE_COUNT = 3;
export const PRED_MIN_DICE = 1;
export const PRED_MAX_DICE = 6;
export const TARGET_MIN = 1;
export const TARGET_MAX = 6;

/**
 * Default per-die targets. Matches the legacy/sandbox `6, 6, 6` example.
 *
 * @type {ReadonlyArray<number>}
 */
export const DEFAULT_TARGETS = Object.freeze([6, 6, 6]);

/**
 * @typedef {Object} DeterminismModeOption
 * @property {string} id
 * @property {string} label
 * @property {string} description
 */

/**
 * Determinism plugin modes offered by the showcase.
 *
 * @type {ReadonlyArray<DeterminismModeOption>}
 */
export const DETERMINISM_MODES = Object.freeze([
  {
    id: 'predict-and-shift',
    label: 'Predict and shift',
    description:
      'Predicts the natural roll, then shifts face mappings so the visible roll shows the requested targets.'
  },
  {
    id: 'predict-only',
    label: 'Predict only',
    description:
      'Predicts the natural roll without shifting anything. The visible roll shows whatever physics produces.'
  }
]);

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isDeterminismMode(id) {
  return DETERMINISM_MODES.some((mode) => mode.id === id);
}

/**
 * @param {string} id
 * @returns {DeterminismModeOption}
 */
export function getDeterminismMode(id) {
  const mode = DETERMINISM_MODES.find((entry) => entry.id === id);
  if (!mode) {
    throw new Error(`Unknown determinism mode: ${id}`);
  }
  return mode;
}

/**
 * Build the default target list for a dice count, reusing the legacy
 * `6, 6, 6` pattern and padding with sixes beyond three dice.
 *
 * @param {number} diceCount
 * @returns {number[]}
 */
export function defaultTargetsFor(diceCount) {
  const count = clampDiceCount(diceCount);
  /** @type {number[]} */
  const targets = [];
  for (let index = 0; index < count; index += 1) {
    targets.push(DEFAULT_TARGETS[index] ?? 6);
  }
  return targets;
}

/**
 * Clamp a dice count into the supported range.
 *
 * @param {number} diceCount
 * @returns {number}
 */
export function clampDiceCount(diceCount) {
  if (!Number.isInteger(diceCount)) return PRED_DICE_COUNT;
  return Math.min(PRED_MAX_DICE, Math.max(PRED_MIN_DICE, diceCount));
}

/**
 * @typedef {Object} ValidatedTargets
 * @property {number[]} values Target values, empty when invalid.
 * @property {string|null} error Human-readable error, null when valid.
 */

/**
 * Validate per-die target inputs for a roll of `diceCount` dice.
 *
 * Edge cases, matching the showcase spec:
 *
 * - Fewer targets than dice: an error is reported and no roll starts.
 *   (The sandbox instead rolls fewer dice; this demo keeps the dice
 *   count fixed so the per-die inputs stay aligned with the dice.)
 * - More targets than dice: an error is reported and no roll starts, to
 *   keep the inputs unambiguous.
 * - Any entry that is not an integer in `[TARGET_MIN, TARGET_MAX]` is an
 *   error naming the die.
 *
 * @param {Array<string|number>} rawInputs One input per die.
 * @param {number} diceCount
 * @returns {ValidatedTargets}
 */
export function validateTargets(rawInputs, diceCount) {
  const count = clampDiceCount(diceCount);
  const inputs = Array.isArray(rawInputs) ? rawInputs : [];

  if (inputs.length < count) {
    return {
      values: [],
      error: `Enter a target for each of the ${count} dice (${inputs.length} given).`
    };
  }
  if (inputs.length > count) {
    return {
      values: [],
      error: `Enter exactly ${count} targets, one per die (${inputs.length} given).`
    };
  }

  /** @type {number[]} */
  const values = [];
  for (let index = 0; index < inputs.length; index += 1) {
    const entry = String(inputs[index] ?? '').trim();
    const value = Number.parseInt(entry, 10);
    const isInteger = /^-?\d+$/.test(entry);
    if (!isInteger || !Number.isFinite(value) || value < TARGET_MIN || value > TARGET_MAX) {
      return {
        values: [],
        error: `Die ${index + 1}: "${entry}" is not a valid target. Enter a value from ${TARGET_MIN} to ${TARGET_MAX}.`
      };
    }
    values.push(value);
  }

  return { values, error: null };
}

/**
 * Compare a settled result against requested targets.
 *
 * @param {number[]} values
 * @param {number[]} targets
 * @returns {{ matched: boolean, matches: boolean[] }}
 */
export function compareTargets(values, targets) {
  const matches = targets.map((target, index) => values[index] === target);
  return {
    matched: matches.length > 0 && matches.every(Boolean) && values.length === targets.length,
    matches
  };
}

/**
 * Format a value list for display, e.g. `[6, 6, 6]` as `"6, 6, 6"`.
 *
 * @param {number[]} values
 * @returns {string}
 */
export function formatValues(values) {
  return (Array.isArray(values) ? values : []).join(', ');
}
