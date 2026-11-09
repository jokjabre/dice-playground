import { DiceError } from '@dice/core';

/**
 * Built-in enclosure ids from `@dice/enclosures`. Content selects an
 * enclosure by id and tunes it; it never duplicates the enclosure
 * definitions or their physics/visual construction.
 *
 * @type {ReadonlyArray<string>}
 */
export const ENCLOSURE_PRESET_IDS = Object.freeze(['box', 'sphere', 'cylinder']);

/**
 * Shared enclosure presets: id plus tunables only.
 *
 * @type {Readonly<Record<string, Readonly<Record<string, any>>>>}
 */
export const ENCLOSURE_PRESETS = Object.freeze({
  box: Object.freeze({ type: 'box', margin: 0.93, ceiling: true }),
  sphere: Object.freeze({ type: 'sphere' }),
  cylinder: Object.freeze({ type: 'cylinder' })
});

/**
 * @param {string} id
 * @returns {Readonly<Record<string, any>>}
 */
export function getEnclosurePreset(id) {
  const preset = ENCLOSURE_PRESETS[id];
  if (!preset) {
    throw new DiceError(`Unknown enclosure preset: ${id}`, {
      code: 'UNKNOWN_ENCLOSURE_PRESET'
    });
  }
  return preset;
}
