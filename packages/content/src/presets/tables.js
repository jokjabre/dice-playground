import { DiceError } from '@dice/core';

/**
 * Shared table presets. Plain frozen data; the world renders them.
 *
 * @type {Readonly<Record<string, Readonly<Record<string, any>>>>}
 */
export const TABLE_PRESETS = Object.freeze({
  classic: Object.freeze({
    id: 'classic',
    floorColor: '#2596be',
    background: '#0b0f19',
    lights: 'warm',
    shadows: true
  }),
  darkStudio: Object.freeze({
    id: 'dark-studio',
    floorColor: '#1a1d24',
    background: '#05070c',
    lights: 'studio',
    shadows: true
  }),
  greenFelt: Object.freeze({
    id: 'green-felt',
    floorColor: '#1e6b4a',
    background: '#0b1f16',
    lights: 'warm',
    shadows: false
  })
});

/**
 * @type {ReadonlyArray<string>}
 */
export const TABLE_PRESET_IDS = Object.freeze(Object.keys(TABLE_PRESETS));

/**
 * @param {string} id
 * @returns {Readonly<Record<string, any>>}
 */
export function getTablePreset(id) {
  const preset = TABLE_PRESETS[id];
  if (!preset) {
    throw new DiceError(`Unknown table preset: ${id}`, {
      code: 'UNKNOWN_TABLE_PRESET'
    });
  }
  return preset;
}
