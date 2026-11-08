import { DiceError } from '@dice/core';

/**
 * Dice style ids known to `@dice/dice` (`DICE_STYLES`). Content references
 * styles by id and never duplicates the style descriptors.
 *
 * @type {ReadonlyArray<string>}
 */
export const DICE_STYLE_IDS = Object.freeze(['classic', 'dark']);

/**
 * Shared dice-set presets. Definitions and styles are referenced by id.
 *
 * @type {Readonly<Record<string, Readonly<Record<string, any>>>>}
 */
export const DICE_PRESETS = Object.freeze({
  classic: Object.freeze({ definition: 'd6', count: 6, style: 'classic' }),
  dark: Object.freeze({ definition: 'd6', count: 6, style: 'dark' }),
  single: Object.freeze({ definition: 'd6', count: 1, style: 'classic' }),
  yambFive: Object.freeze({ definition: 'd6', count: 5, style: 'classic' })
});

/**
 * @param {string} id
 * @returns {Readonly<Record<string, any>>}
 */
export function getDicePreset(id) {
  const preset = DICE_PRESETS[id];
  if (!preset) {
    throw new DiceError(`Unknown dice preset: ${id}`, {
      code: 'UNKNOWN_DICE_PRESET'
    });
  }
  return preset;
}
