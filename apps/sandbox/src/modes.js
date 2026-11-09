/**
 * Sandbox mode vocabulary and pure helpers.
 *
 * The sandbox exposes three modes, mirroring the legacy demo's mode
 * selector:
 *
 * - `standard` — flick/drag to throw; dice settle and the result banner
 *   reports values and total.
 * - `continuous` — physics never auto-stops; motion sensors and pointer
 *   interaction keep jostling the dice.
 * - `predetermined` — enter target values; prediction + face mapping make
 *   the visible roll land on them (via `@dice/determinism`).
 *
 * `predetermined` is a UI mode, not an engine loop mode: it rolls in the
 * standard strategy with requested `values`. Everything in this module is
 * pure so it can be unit-tested without a browser.
 */

/**
 * @typedef {Object} SandboxMode
 * @property {string} id
 * @property {string} label
 * @property {'standard'|'continuous'} engineMode
 * @property {string} description
 */

/**
 * Sandbox modes in selector order.
 *
 * @type {ReadonlyArray<SandboxMode>}
 */
export const SANDBOX_MODES = Object.freeze([
  {
    id: 'standard',
    label: 'Standard Roll (Flick & Settle)',
    engineMode: 'standard',
    description: 'Flick or drag to throw; dice settle and report values.'
  },
  {
    id: 'continuous',
    label: 'Continuous Live (Tilt & Shake)',
    engineMode: 'continuous',
    description: 'Physics never auto-stops; motion sensors keep the dice live.'
  },
  {
    id: 'predetermined',
    label: 'Predetermined Roll (Target Values)',
    engineMode: 'standard',
    description: 'Target values are predicted and mapped onto the visible roll.'
  }
]);

/**
 * Fallback target values used when the input field is empty. Matches the
 * legacy demo's `6, 6, 6` placeholder.
 *
 * @type {ReadonlyArray<number>}
 */
export const DEFAULT_TARGET_VALUES = Object.freeze([6, 6, 6]);

/**
 * Valid label range for a D6 die.
 */
export const TARGET_MIN = 1;

/**
 * @type {number}
 */
export const TARGET_MAX = 6;

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isSandboxMode(id) {
  return SANDBOX_MODES.some((mode) => mode.id === id);
}

/**
 * @param {string} id
 * @returns {SandboxMode}
 */
export function getSandboxMode(id) {
  const mode = SANDBOX_MODES.find((entry) => entry.id === id);
  if (!mode) {
    throw new Error(`Unknown sandbox mode: ${id}`);
  }
  return mode;
}

/**
 * Engine loop mode for a sandbox mode id. Only `continuous` maps to the
 * continuous loop strategy; `standard` and `predetermined` both settle.
 *
 * @param {string} id
 * @returns {'standard'|'continuous'}
 */
export function engineModeFor(id) {
  return getSandboxMode(id).engineMode;
}

/**
 * Whether the motion controls section is visible for a mode.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function shouldShowMotion(id) {
  return id === 'continuous';
}

/**
 * Whether the predetermined controls section is visible for a mode.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function shouldShowPredetermined(id) {
  return id === 'predetermined';
}

/**
 * @typedef {Object} ParsedTargetValues
 * @property {number[]} values Target values, empty when the input is invalid.
 * @property {string|null} error Human-readable error, null when valid.
 */

/**
 * Parse a comma-separated target string such as `"6, 6, 6"` into die
 * values. Empty entries are ignored and an entirely empty input falls back
 * to {@link DEFAULT_TARGET_VALUES}, matching the legacy demo. Any entry
 * that is not an integer in `[TARGET_MIN, TARGET_MAX]` is an error and no
 * roll should be started.
 *
 * @param {string} input Raw input text.
 * @returns {ParsedTargetValues}
 */
export function parseTargetValues(input) {
  const text = typeof input === 'string' ? input.trim() : '';
  if (text.length === 0) {
    return { values: [...DEFAULT_TARGET_VALUES], error: null };
  }

  /** @type {number[]} */
  const values = [];
  for (const rawEntry of text.split(',')) {
    const entry = rawEntry.trim();
    if (entry.length === 0) continue;
    const value = Number.parseInt(entry, 10);
    const isInteger = /^-?\d+$/.test(entry);
    if (!isInteger || !Number.isFinite(value) || value < TARGET_MIN || value > TARGET_MAX) {
      return {
        values: [],
        error: `Invalid target "${entry}". Enter comma-separated values from ${TARGET_MIN} to ${TARGET_MAX}.`
      };
    }
    values.push(value);
  }

  if (values.length === 0) {
    return { values: [...DEFAULT_TARGET_VALUES], error: null };
  }

  return { values, error: null };
}

/**
 * Format target values for display or for prefilling the input field.
 *
 * @param {number[]} values
 * @returns {string}
 */
export function formatTargetValues(values) {
  return (Array.isArray(values) ? values : []).join(', ');
}
